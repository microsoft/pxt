import * as data from "./data";
import * as React from "react";
import * as core from "./core";
import * as workspace from "./workspace";
import * as pkg from "./package";

import { Button } from "../../react-common/components/controls/Button";
import { Input } from "../../react-common/components/controls/Input";
import { useState, useEffect, useMemo } from "react";
import { ImportModal } from "../../react-common/components/extensions/ImportModal";
import { ExtensionCard } from "../../react-common/components/extensions/ExtensionCard";
import { Modal } from "../../react-common/components/controls/Modal";
import { classList } from "../../react-common/components/util";
import { TabList, TabListProps } from "../../react-common/components/controls/TabList";

type ExtensionMeta = pxtc.service.ExtensionMeta;
const ExtensionType = pxtc.service.ExtensionType;
type EmptyCard = { name: string, loading?: boolean }
const emptyCard: EmptyCard = { name: "", loading: true }

interface ExtensionsProps {
    hideExtensions: () => void;
    importExtensionCallback: () => void;
    header: pxt.workspace.Header;
    reloadHeaderAsync: () => Promise<void>;
}

const RECOMMENDED_TAG_ID = "extensions-recommended";
const LOCAL_TAG_ID = "extensions-local";
const SEARCH_TAG_ID = "extensions-search-results";
const TARGET_TAG_PREFIX = "extensions-category-";

export const ExtensionsBrowser = (props: ExtensionsProps) => {

    const [searchFor, setSearchFor] = useState("");
    const [searchComplete, setSearchComplete] = useState(true)
    const [allExtensions, setAllExtensions] = useState(fetchBundled());
    const extensionsInDevelopment = useMemo(() => fetchLocalRepositories(), []);
    const [extensionsToShow, setExtensionsToShow] = useState<(ExtensionMeta & EmptyCard)[]>([]);
    const [currentTab, setCurrentTab] = useState(RECOMMENDED_TAG_ID);
    const [showImportExtensionDialog, setShowImportExtensionDialog] = useState(false);
    const [preferredExts, setPreferredExts] = useState<(ExtensionMeta & EmptyCard)[]>([])
    const [extensionTags, setExtensionTags] = useState(new Map<string, string[]>())


    const onSearchBarChange = (newValue: string) => {
        setSearchFor(newValue || "");
    }

    useEffect(() => {
        updateExtensionTags();
        updatePreferredExts();
    }, [])

    useEffect(() => {
        if (searchFor && searchFor != "") {
            searchForBundledAndGithubAsync();
        }
    }, [searchFor])

    /**
     * Github search
     */
    async function searchForBundledAndGithubAsync() {
        // Hidden navigation, used to test /beta or other versions
        // Secret prefix is /@, e.g.: /@beta
        const urlPathExec = /^\/@(.*)$/.exec(searchFor);
        let urlPath = urlPathExec?.[1];
        if (urlPath) {
            let homeUrl = pxt.appTarget.appTheme.homeUrl;
            if (!/\/$/.test(homeUrl)) {
                homeUrl += "/";
            }
            urlPath = urlPath.replace(/^\//, "");
            window.location.href = `${homeUrl}${urlPath}`;
        }

        setCurrentTab(SEARCH_TAG_ID)
        setSearchComplete(false)
        setExtensionsToShow([emptyCard, emptyCard, emptyCard, emptyCard])

        const config = await pxt.packagesConfigAsync();

        let exts = await fetchGithubDataAsync([searchFor])
        exts = exts?.filter(e => !pxt.github.isRepoHidden(e, config));
        const parsedExt = exts?.map(repo => parseGithubRepo(repo)) ?? [];
        //Search bundled extensions as well
        fetchBundled().forEach(e => {
            if (e.name.toLowerCase().indexOf(searchFor.toLowerCase()) > -1) {
                //Fuzzy search here?
                parsedExt.unshift(e)
            }
        })

        const shareUrlData = await fetchShareUrlDataAsync(searchFor);
        if (shareUrlData) {
            parsedExt.unshift(parseShareScript(shareUrlData));
        }

        addExtensionsToPool(parsedExt)
        setExtensionsToShow(parsedExt)
        setSearchComplete(true)
    }

    function addExtensionsToPool(newExtension: ExtensionMeta[]) {
        if (!newExtension) {
            return;
        }
        const addedExtensions = allExtensions;
        newExtension.forEach(e => {
            if (!addedExtensions.has(e.name.toLowerCase())) {
                addedExtensions.set(e.name.toLowerCase(), e)
            }
        })
        setAllExtensions(addedExtensions);
    }

    function getExtensionFromFetched(extensionUrl: string) {
        const parsedGithubRepo = pxt.github.parseRepoId(extensionUrl);
        if (parsedGithubRepo)
            return allExtensions.get(parsedGithubRepo.fullName.toLowerCase());

        const fullName = allExtensions.get(extensionUrl.toLowerCase())
        if (fullName)
            return fullName

        return undefined;
    }

    async function addDepIfNoConflict(config: pxt.PackageConfig, version: string) {
        try {
            props.hideExtensions();
            core.showLoading("installingextension", lf("Adding extension..."));
            const added = await pkg.mainEditorPkg()
                .addDependencyAsync({ ...config, isExtension: true }, version, false)
            if (added) {
                await pxt.Util.delay(200);
                await props.reloadHeaderAsync();
            }
        }
        finally {
            core.hideLoading("installingextension")
        }
    }


    async function updateExtensionTags() {
        if (extensionTags.size > 0)
            return
        let trgConfig = await data.getAsync<pxt.TargetConfig>("target-config:")
        const approvedRepos = trgConfig?.packages?.approvedRepoLib;
        const builtinExtensions = trgConfig?.packages?.builtinExtensionsLib;
        let allExtensions: string[] = [];
        const newMap = extensionTags;
        if (!approvedRepos && !builtinExtensions)
            return;
        if (approvedRepos)
            allExtensions = allExtensions.concat(Object.keys(approvedRepos));
        if (builtinExtensions)
            allExtensions = allExtensions.concat(Object.keys(builtinExtensions));
        allExtensions.forEach(repoSlug => {
            const repoData = approvedRepos?.[repoSlug] || builtinExtensions?.[repoSlug];
            repoData.tags?.forEach(tag => {
                if (!newMap.has(tag)) {
                    newMap.set(tag, [])
                }
                const tagRepos = newMap.get(tag)
                if (tagRepos.indexOf(repoSlug) === -1) {
                    tagRepos.push(repoSlug);
                }
            })
        })
        setExtensionTags(newMap)
    }

    async function addGithubPackage(scr: ExtensionMeta) {
        let r: { version: string, config: pxt.PackageConfig };
        try {
            core.showLoading("downloadingpackage", lf("downloading extension..."));
            const pkg = getExtensionFromFetched(scr.repo.fullName);
            if (pkg) {
                const useProxy = pxt.github.shouldUseProxyForRepo(pkg.repo.fullName);
                r = await pxt.github.downloadLatestPackageAsync(pkg.repo, useProxy);
            } else {
                const res = await fetchGithubDataAsync([scr.repo.fullName]);
                if (res && res.length > 0) {
                    const parsed = parseGithubRepo(res[0])
                    addExtensionsToPool([parsed])
                    const useProxy = pxt.github.shouldUseProxyForRepo(parsed.repo.fullName);
                    r = await pxt.github.downloadLatestPackageAsync(parsed.repo, useProxy)
                }
            }
        }
        catch (e) {
            core.handleNetworkError(e);
        } finally {
            core.hideLoading("downloadingpackage");
        }
        return await addDepIfNoConflict(r.config, r.version)
    }

    async function fetchShareUrlDataAsync(potentialShareUrl: string): Promise<pxt.Cloud.JsonScript> {
        const scriptId = pxt.Cloud.parseScriptId(potentialShareUrl);
        if (!scriptId)
            return undefined;

        const scriptData = await data.getAsync<pxt.Cloud.JsonScript>(`cloud-search:${scriptId}`);

        // TODO: fix typing on getAsync? it looks like it returns T or the failed network request
        if ((scriptData as any).statusCode == 404) {
            return undefined;
        }
        // unwrap array if returned as array
        if (Array.isArray(scriptData)) {
            return scriptData[0];
        }

        return scriptData;
    }
    async function addShareUrlExtension(scr: pxt.Cloud.JsonScript): Promise<void> {
        // todo: we justed used name before but that's easy to lead to conflicts?
        // should this be scr.id or something as pkgid?
        // todo: how to handle persistent links? right now scr.id is the current version,
        // we should probably persist the s id and make it updatable with a refresh.
        const shareScript = await workspace.getPublishedScriptAsync(scr.id);
        const config = pxt.Util.jsonTryParse(shareScript[pxt.CONFIG_NAME]);
        addDepIfNoConflict({ ...config, version: scr.id }, `pub:${scr.id}`);
    }

    async function fetchGithubDataAsync(preferredRepos: string[]): Promise<pxt.github.GitRepo[]> {
        // When searching multiple repos at the same time, use 'extension-search' which caches results
        // for much longer than 'gh-search'
        const virtualApi = preferredRepos.length <= 1 ? 'gh-search' : 'extension-search';

        // Users can put anything in the search box.
        // Make sure there are no secrets in it before we send to backend.
        const cleanedRepos = preferredRepos.map(repo => pxt.Util.cleanData(repo));

        return data.getAsync<pxt.github.GitRepo[]>(`${virtualApi}:${cleanedRepos.join("|")}`);
    }

    async function fetchGithubDataAndAddAsync(repos: string[]): Promise<ExtensionMeta[]> {
        if (!repos.length)
            return [];
        const fetched = await fetchGithubDataAsync(repos)
        if (!fetched) {
            return []
        }
        const parsed = fetched.map(r => parseGithubRepo(r))
        addExtensionsToPool(parsed)
        return parsed;
    }

    function fetchLocalRepositories(): pxt.workspace.Header[] {
        let r = workspace.getHeaders()
        if (!/localdependencies=1/i.test(window.location.href))
            r = r.filter(h => !!h.githubId);
        if (props.header)
            r = r.filter(h => h.id != props.header.id) // don't self-reference
        return r;
    }

    function addLocal(hd: pxt.workspace.Header) {
        pxt.tickEvent("extensions.local");
        workspace.getTextAsync(hd.id)
            .then(files => {
                let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
                return addDepIfNoConflict(cfg, "workspace:" + hd.id)
            })
    }

    function installExtension(scr: ExtensionMeta) {
        switch (scr.type) {
            case ExtensionType.Bundled:
                pxt.tickEvent("extensions.bundled", { name: scr.name });
                props.hideExtensions();
                addDepIfNoConflict(scr.pkgConfig, "*");
                break;
            case ExtensionType.Github:
                pxt.tickEvent("extensions.github", {
                    name: scr.repo.fullName,
                    slug: scr.repo.slug.toLowerCase(),
                    tag: scr.repo.tag,
                    fileName: scr.repo.fileName
                });
                props.hideExtensions();
                addGithubPackage(scr);
                break;
            case ExtensionType.ShareScript:
                pxt.tickEvent("extensions.sharescript", {
                    name: scr.scriptInfo.id //This is share script as extension, so safe to assume it is public
                });
                props.hideExtensions();
                addShareUrlExtension(scr.scriptInfo);
                break;
        }
    }

    function importExtension() {
        pxt.tickEvent("extensions.importfile", undefined, { interactiveConsent: true });
        props.hideExtensions()
        props.importExtensionCallback()
    }

    function ghName(scr: pxt.github.GitRepo) {
        let n = scr.name.replace(/^pxt-/, "");
        return n;
    }

    function parseGithubRepo(r: pxt.github.GitRepo): ExtensionMeta {
        return {
            name: ghName(r),
            displayName: r.displayName,
            type: ExtensionType.Github,
            imageUrl: pxt.github.repoIconUrl(r),
            repo: r,
            description: r.description,
            fullRepo: r.fullName
        }
    }

    function parseShareScript(s: pxt.Cloud.JsonScript): ExtensionMeta {
        return {
            name: s.name,
            type: ExtensionType.ShareScript,
            imageUrl: s.thumb ? `${pxt.Cloud.apiRoot}/${s.id}/thumb` : undefined,
            description: s.description,
            scriptInfo: s,
        }
    }


    function getCategoryNames(): string[] {
        if (!extensionTags) return [];
        return Array.from(extensionTags.keys())
    }

    async function handleCategoryClick(category: string) {
        setSearchFor("")

        const categoryExtensions = extensionTags.get(category)

        const toBeFetched: string[] = []
        const extensionsWeHave: ExtensionMeta[] = []

        categoryExtensions.forEach(repoSlug => {
            const fetched = getExtensionFromFetched(repoSlug);
            if (!fetched) {
                toBeFetched.push(repoSlug)
            } else {
                extensionsWeHave.push(fetched)
            }
        })

        const loadingCards = []
        for (let i = 0; i < toBeFetched.length; i++) {
            loadingCards.push(emptyCard)
        }
        setExtensionsToShow([...extensionsWeHave, ...loadingCards]);
        if (toBeFetched.length > 0) {
            const exts = await fetchGithubDataAndAddAsync(toBeFetched)
            setExtensionsToShow([...extensionsWeHave, ...exts])
        }
    }

    function packageConfigToExtensionMeta(p: pxt.PackageConfig): ExtensionMeta {
        return {
            name: p.name,
            displayName: p.displayName,
            imageUrl: p.icon,
            type: ExtensionType.Bundled,
            learnMoreUrl: `/reference/${p.name}`,
            pkgConfig: p,
            description: p.description
        }
    }

    function fetchBundled(): Map<string, ExtensionMeta> {
        const bundled = pxt.appTarget.bundledpkgs;
        const extensionsMap = new Map<string, ExtensionMeta>();
        Object.keys(bundled).filter(k => !/prj$/.test(k))
            .map(k => JSON.parse(bundled[k]["pxt.json"]) as pxt.PackageConfig)
            .filter(pk => !pk.hidden)
            .filter(pk => !/---/.test(pk.name))
            .filter(pk => !pk.searchOnly || searchFor?.length != 0)
            .filter(pk => pk.name != "core")
            .filter(pk => false == !!pk.core) // show core in "boards" mode
            .sort((a, b) => {
                // core first
                if (a.core != b.core)
                    return a.core ? -1 : 1;

                // non-beta first
                const abeta = pxt.isPkgBeta(a);
                const bbeta = pxt.isPkgBeta(b);
                if (abeta != bbeta)
                    return abeta ? 1 : -1;

                // use weight if core packages
                const aweight = a.weight === undefined ? 50 : a.weight;
                const bweight = b.weight === undefined ? 50 : b.weight;
                if (aweight != bweight)
                    return -aweight + bweight;

                // alphabetical sort
                return pxt.Util.strcmp(a.name, b.name)
            })
            .forEach(e => extensionsMap.set(e.name, packageConfigToExtensionMeta(e)))
        return extensionsMap
    }

    async function updatePreferredExts() {
        const bundled = fetchBundled();
        const repos: ExtensionMeta[] = [];
        bundled.forEach(e => {
            repos.push(e)
        })
        let trgConfig = await data.getAsync<pxt.TargetConfig>("target-config:")

        const toBeFetched: string[] = [];
        if (trgConfig?.packages?.approvedRepoLib) {
            Object.keys(trgConfig.packages.approvedRepoLib).forEach(repoSlug => {
                const repoData = trgConfig.packages.approvedRepoLib[repoSlug];
                if (!repoData.preferred)
                    return;
                const fetched = getExtensionFromFetched(repoSlug);
                if (fetched) {
                    repos.push(fetched);
                } else {
                    toBeFetched.push(repoSlug);
                }
            })
        }
        const loadingCards = [];
        for (let i = 0; i < toBeFetched.length; i++) {
            loadingCards.push(emptyCard)
        }
        setPreferredExts([...repos, ...loadingCards])

        const exts = await fetchGithubDataAndAddAsync(toBeFetched);
        setPreferredExts([...repos, ...exts])
    }

    async function handleImportUrl(url: string) {
        setShowImportExtensionDialog(false)
        props.hideExtensions()
        const ext = getExtensionFromFetched(url)
        if (!ext) {
            const exts = await fetchGithubDataAndAddAsync([url])
            addExtensionsToPool(exts)
        } else {
            addGithubPackage(ext)
        }
    }

    function ExtensionMetaCard(props: {
        extensionInfo: ExtensionMeta & EmptyCard,
    }) {
        const { extensionInfo } = props;
        const {
            description,
            fullRepo,
            imageUrl,
            learnMoreUrl,
            loading,
            name,
            displayName,
            repo,
            type,
        } = extensionInfo;

        return <ExtensionCard
            title={displayName || name || fullRepo}
            description={description}
            imageUrl={imageUrl}
            extension={extensionInfo}
            onClick={installExtension}
            learnMoreUrl={learnMoreUrl || (fullRepo ? `/pkg/${fullRepo}` : undefined)}
            loading={loading}
            label={pxt.isPkgBeta(extensionInfo) ? lf("Beta") : undefined}
            showDisclaimer={type != ExtensionType.Bundled && repo?.status != pxt.github.GitRepoStatus.Approved}
        />;
    }

    const onTabSelected = (id: string) => {
        setCurrentTab(id);

        if (id.startsWith(TARGET_TAG_PREFIX)) {
            const category = id.replace(TARGET_TAG_PREFIX, "")
            handleCategoryClick(category);
        }
    };

    const categoryNames = getCategoryNames();
    const panelId = "extensions-results-panel";

    const tabs: TabListProps["tabs"] = [
        {
            id: RECOMMENDED_TAG_ID,
            className: "extension-tag",
            label: lf("Recommended"),
            title: lf("Recommended Extensions"),
            ariaControls: panelId,
        }
    ];

    for (const category of categoryNames) {
        tabs.push({
            id: `${TARGET_TAG_PREFIX}${category}`,
            className: "extension-tag",
            label: pxt.Util.rlf(`{id:extension-tag}${category}`),
            title: pxt.Util.rlf(`{id:extension-tag}${category}`),
            ariaControls: panelId,
        });
    }

    if (extensionsInDevelopment.length) {
        tabs.push({
            id: LOCAL_TAG_ID,
            className: "extension-tag",
            label: lf("Local"),
            title: lf("Local GitHub Projects"),
            ariaControls: panelId,
        });
    }

    if (searchFor !== "") {
        tabs.push({
            id: SEARCH_TAG_ID,
            className: "extension-tag",
            label: lf("Search Results"),
            title: lf("Search Results"),
            ariaControls: panelId,
        });
    }

    return (
        <Modal
            title={lf("Extensions")}
            fullscreen={true}
            className={"extensions-browser"}
            onClose={props.hideExtensions}
            helpUrl={"/extensions"}
        >
            <div className="ui">
                {showImportExtensionDialog &&
                    <ImportModal
                        onCancelClick={() => setShowImportExtensionDialog(false)}
                        onImportClick={handleImportUrl}
                    />
                }
                <div className="extension-search-header">
                    <Input
                        placeholder={lf("Search or enter project URL...")}
                        ariaLabel={lf("Search or enter project URL...")}
                        iconTitle={lf("Search")}
                        onEnterKey={onSearchBarChange}
                        onIconClick={onSearchBarChange}
                        preserveValueOnBlur={true}
                        icon="fas fa-search"
                    />
                    <TabList
                        className="extension-tags"
                        tabs={tabs}
                        manualActivation={true}
                        selectedId={currentTab}
                        onTabSelected={onTabSelected}
                        orientation="horizontal"
                    />
                </div>
                <div className="extension-display" id={panelId} role="tabpanel" aria-labelledby={currentTab}>
                    <>
                        <div className="extension-cards">
                            {currentTab === RECOMMENDED_TAG_ID &&
                                preferredExts?.map(
                                    (scr, index) => <ExtensionMetaCard extensionInfo={scr} key={index} />
                                )
                            }
                            {currentTab === LOCAL_TAG_ID &&
                                extensionsInDevelopment.map((p, index) =>
                                    <ExtensionCard
                                        key={`local:${index}`}
                                        title={p.name}
                                        description={lf("Local copy of {0} hosted on github.com", p.githubId)}
                                        imageUrl={p.icon}
                                        extension={p}
                                        onClick={addLocal}
                                    />
                                )
                            }
                            {currentTab !== RECOMMENDED_TAG_ID && currentTab !== LOCAL_TAG_ID &&
                                extensionsToShow?.map(
                                    (scr, index) => <ExtensionMetaCard extensionInfo={scr} key={index} />
                                )
                            }
                        </div>
                        {currentTab === SEARCH_TAG_ID && searchComplete && extensionsToShow.length == 0 &&
                            <div aria-label="Extension search results">
                                <p>{lf("We couldn't find any extensions matching '{0}'", searchFor)}</p>
                            </div>
                        }
                    </>
                </div>
            </div>
        </Modal>
    )
}
