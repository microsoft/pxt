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
import { TabList, TabListProps } from "../../react-common/components/controls/TabList";
import { Link } from "../../react-common/components/controls/Link";

type ExtensionMeta = pxtc.service.ExtensionMeta & {
    dependencyName?: string;
    installed?: boolean;
};
const ExtensionType = pxtc.service.ExtensionType;
type EmptyCard = { name: string, loading?: boolean }
const emptyCard: EmptyCard = { name: "", loading: true }

interface InstalledDependency {
    name: string;
    version: string;
}

interface ExtensionsProps {
    hideExtensions: () => void;
    importExtensionCallback: () => void;
    header: pxt.workspace.Header;
    hasBlocksFromExtensionAsync: (dependencyName: string) => Promise<boolean>;
    reloadHeaderAsync: () => Promise<void>;
    saveProjectAsync: () => Promise<void>;
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

    function currentProjectDependencies(): pxt.Map<string> {
        return pkg.mainPkg?.config?.dependencies || {};
    }

    function dependencyVersions(): string[] {
        const dependencies = currentProjectDependencies();
        return Object.keys(dependencies).map(dep => dependencies[dep]);
    }

    function isDependencyInstalled(name?: string): boolean {
        return !!name && !!currentProjectDependencies()[name];
    }

    function normalizedPublishedScriptId(version: string): string | undefined {
        if (!version) return undefined;
        if (version.slice(0, 4) === "pub:") return version.slice(4);
        return pxt.Cloud.parseScriptId(version);
    }

    function githubReposMatch(a?: pxt.github.ParsedRepo, b?: pxt.github.ParsedRepo): boolean {
        if (!a || !b) return false;
        if (a.fileName || b.fileName)
            return a.fullName.toLowerCase() === b.fullName.toLowerCase();
        return a.slug.toLowerCase() === b.slug.toLowerCase();
    }

    function installedDependency(extensionInfo: ExtensionMeta): InstalledDependency | undefined {
        const dependencies = currentProjectDependencies();
        const namedCandidates = [
            extensionInfo.dependencyName,
            extensionInfo.pkgConfig?.name,
            extensionInfo.name
        ];

        for (const name of namedCandidates) {
            if (isDependencyInstalled(name)) {
                return { name, version: dependencies[name] };
            }
        }

        const extensionRepos: pxt.github.ParsedRepo[] = [];
        const repoIds = [extensionInfo.repo?.fullName, extensionInfo.fullRepo];
        repoIds.forEach(repoId => {
            const parsed = repoId && pxt.github.parseRepoId(repoId);
            if (parsed) extensionRepos.push(parsed);
        });

        for (const name of Object.keys(dependencies)) {
            const version = dependencies[name];
            const dependencyRepo = pxt.github.parseRepoId(version);
            if (extensionRepos.some(repo => githubReposMatch(repo, dependencyRepo))) {
                return { name, version };
            }
            if (extensionInfo.scriptInfo?.id
                && normalizedPublishedScriptId(version) === extensionInfo.scriptInfo.id) {
                return { name, version };
            }
        }

        return undefined;
    }

    function isLocalExtensionInstalled(header: pxt.workspace.Header): boolean {
        return dependencyVersions().some(version => version === `workspace:${header.id}`);
    }

    function isExtensionInstalled(extensionInfo: ExtensionMeta): boolean {
        return !!installedDependency(extensionInfo);
    }

    function withInstalledFlag<T extends ExtensionMeta>(extensionInfo: T): T {
        const dependency = installedDependency(extensionInfo);
        return {
            ...extensionInfo,
            dependencyName: extensionInfo.dependencyName || dependency?.name,
            installed: !!dependency
        };
    }

    function prioritizeInstalledExtensions(extensions: (ExtensionMeta & EmptyCard)[]): (ExtensionMeta & EmptyCard)[] {
        const extensionsWithStatus = extensions.map(extension => withInstalledFlag(extension));
        return [
            ...extensionsWithStatus.filter(extension => extension.installed),
            ...extensionsWithStatus.filter(extension => !extension.installed)
        ];
    }

    function extensionIdentities(extension: ExtensionMeta): string[] {
        const result: string[] = [];
        const packageNames = [extension.dependencyName, extension.pkgConfig?.name];
        packageNames.forEach(name => {
            if (name) result.push(`package:${name.toLowerCase()}`);
        });
        const repo = pxt.github.parseRepoId(extension.repo?.fullName || extension.fullRepo);
        if (repo) result.push(`github:${repo.fullName.toLowerCase()}`);
        if (!result.length) result.push(`package:${extension.name.toLowerCase()}`);
        return result;
    }

    function mergeUniqueExtensions(...extensionGroups: ExtensionMeta[][]): ExtensionMeta[] {
        const result: ExtensionMeta[] = [];
        const seen = new Set<string>();

        extensionGroups.forEach(extensions => extensions.forEach(extension => {
            const identities = extensionIdentities(extension);
            if (identities.some(identity => seen.has(identity))) return;
            identities.forEach(identity => seen.add(identity));
            result.push(extension);
        }));

        return result;
    }

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
        const addedExtensions = new Map(allExtensions);
        newExtension.forEach(e => {
            const extensionWithStatus = withInstalledFlag(e);
            if (!addedExtensions.has(extensionWithStatus.name.toLowerCase())) {
                addedExtensions.set(extensionWithStatus.name.toLowerCase(), extensionWithStatus)
            }
            if (extensionWithStatus.fullRepo && !addedExtensions.has(extensionWithStatus.fullRepo.toLowerCase())) {
                addedExtensions.set(extensionWithStatus.fullRepo.toLowerCase(), extensionWithStatus)
            }
            if (extensionWithStatus.repo?.fullName && !addedExtensions.has(extensionWithStatus.repo.fullName.toLowerCase())) {
                addedExtensions.set(extensionWithStatus.repo.fullName.toLowerCase(), extensionWithStatus)
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
            await props.saveProjectAsync();
            const beforeText = await workspace.getTextAsync(props.header.id, true);
            const added = await pkg.mainEditorPkg()
                .addDependencyAsync({ ...config, isExtension: true }, version, false)
            if (added) {
                const displayName = config.displayName || config.name;
                await workspace.saveSnapshotAsync(props.header.id, {
                    type: "extension-added",
                    phase: "before",
                    extensionName: displayName
                }, beforeText);
                await workspace.saveSnapshotAsync(props.header.id, {
                    type: "extension-added",
                    phase: "after",
                    extensionName: displayName
                });
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

    async function showInstalledExtensionDialog(scr: ExtensionMeta): Promise<void> {
        const dependency = installedDependency(scr);
        if (!dependency) return;

        await props.saveProjectAsync();

        const displayName = scr.displayName || scr.name || dependency.name;
        const hasExtensionBlocks = await props.hasBlocksFromExtensionAsync(dependency.name);
        if (hasExtensionBlocks || pkg.mainPkg.isPackageInUse(dependency.name)) {
            await core.confirmAsync({
                header: lf("Cannot remove {0} extension", displayName),
                body: lf("This extension cannot be removed because blocks or code from it are used in your project. Remove them and try again."),
                hideCancel: true,
                agreeLbl: lf("OK")
            });
            return;
        }

        const transitiveDependents = getTransitiveDependents(dependency.name);
        if (transitiveDependents.length) {
            const dependentNames = transitiveDependents.map(dependent =>
                dependent.config?.displayName || dependent.config?.name || dependent.id
            );
            const body = dependentNames.length === 1
                ? lf("Removing {0} as a direct dependency would not remove it from this project because {1} also depends on it. Remove {1} first.", displayName, dependentNames[0])
                : lf("Removing {0} as a direct dependency would not remove it from this project because these extensions also depend on it: {1}. Remove them first.", displayName, dependentNames.join(", "));
            await core.confirmAsync({
                header: lf("Cannot remove {0} extension", displayName),
                body,
                hideCancel: true,
                agreeLbl: lf("OK")
            });
            return;
        }

        const latestVersion = await getAvailableExtensionUpdateAsync(dependency.name);
        const action = await core.confirmAsync(latestVersion ? {
            header: lf("{0} extension", displayName),
            body: lf("A newer version ({0}) is available. Would you like to update or remove this extension?", latestVersion),
            agreeIcon: "refresh",
            agreeLbl: lf("Update extension"),
            deleteLbl: lf("Remove extension")
        } : {
            header: lf("Remove {0} extension?", displayName),
            body: lf("Do you want to remove this extension from your project?"),
            agreeClass: "red",
            agreeIcon: "trash",
            agreeLbl: lf("Remove extension")
        });
        if (!action) return;

        if (latestVersion && action === 1) {
            await updateExtensionAsync(dependency.name, displayName, latestVersion);
            return;
        }

        props.hideExtensions();
        core.showLoading("removingextension", lf("Removing extension..."));
        try {
            await workspace.saveSnapshotAsync(props.header.id, {
                type: "extension-removed",
                phase: "before",
                extensionName: displayName
            });
            await pkg.mainEditorPkg().removeDepAsync(dependency.name);
            await workspace.saveSnapshotAsync(props.header.id, {
                type: "extension-removed",
                phase: "after",
                extensionName: displayName
            });
            await props.reloadHeaderAsync();
        }
        finally {
            core.hideLoading("removingextension");
        }
    }

    async function getAvailableExtensionUpdateAsync(dependencyName: string): Promise<string | undefined> {
        const extensionPackage = pkg.mainPkg?.resolveDep(dependencyName);
        if (!extensionPackage || extensionPackage.verProtocol() !== "github") return undefined;

        const currentRepo = pxt.github.parseRepoId(extensionPackage.installedVersion || extensionPackage.version());
        const currentVersion = pxt.semver.tryParse(currentRepo?.tag)
            || pxt.semver.tryParse(extensionPackage.config?.version);
        if (!currentRepo || !currentVersion) return undefined;

        try {
            const packagesConfig = await pxt.packagesConfigAsync();
            const latestTag = await pxt.github.latestVersionAsync(currentRepo.slug, packagesConfig, true /* use proxy */, true /* no cache */);
            const latestVersion = pxt.semver.tryParse(latestTag);
            return latestVersion && pxt.semver.cmp(currentVersion, latestVersion) < 0
                ? latestTag
                : undefined;
        }
        catch {
            return undefined;
        }
    }

    async function updateExtensionAsync(dependencyName: string, displayName: string, latestVersion: string): Promise<void> {
        pxt.tickEvent("extensions.update", { name: dependencyName, version: latestVersion });
        props.hideExtensions();
        core.showLoading("updatingextension", lf("Updating extension..."));
        try {
            await workspace.saveSnapshotAsync(props.header.id, {
                type: "extension-updated",
                phase: "before",
                extensionName: displayName
            });
            await pkg.mainEditorPkg().updateDepAsync(dependencyName, latestVersion);
            await workspace.saveSnapshotAsync(props.header.id, {
                type: "extension-updated",
                phase: "after",
                extensionName: displayName
            });
            await props.reloadHeaderAsync();
        }
        finally {
            core.hideLoading("updatingextension");
        }
    }

    function getTransitiveDependents(dependencyName: string): pxt.Package[] {
        const extensionPackage = pkg.mainPkg?.resolveDep(dependencyName);
        if (!extensionPackage) return [];

        const directDependencies = currentProjectDependencies();
        const result: pxt.Package[] = [];
        const visited = new Set<pxt.Package>();

        const visit = (dependent: pxt.Package) => {
            if (!dependent || dependent === pkg.mainPkg || visited.has(dependent)) return;
            visited.add(dependent);

            if (dependent.id !== dependencyName && directDependencies[dependent.id]) {
                result.push(dependent);
                return;
            }

            dependent.addedBy?.forEach(visit);
        };

        extensionPackage.addedBy?.forEach(visit);
        return result;
    }

    function installExtension(scr: ExtensionMeta) {
        if (isExtensionInstalled(scr)) {
            showInstalledExtensionDialog(scr).catch(core.handleNetworkError);
            return;
        }

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
        return withInstalledFlag({
            name: ghName(r),
            displayName: r.displayName,
            type: ExtensionType.Github,
            imageUrl: pxt.github.repoIconUrl(r),
            repo: r,
            description: r.description,
            fullRepo: r.fullName
        })
    }

    function parseShareScript(s: pxt.Cloud.JsonScript): ExtensionMeta {
        return withInstalledFlag({
            name: s.name,
            type: ExtensionType.ShareScript,
            imageUrl: s.thumb ? `${pxt.Cloud.apiRoot}/${s.id}/thumb` : undefined,
            description: s.description,
            scriptInfo: s,
        })
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
        return withInstalledFlag({
            name: p.name,
            displayName: p.displayName,
            imageUrl: p.icon,
            type: ExtensionType.Bundled,
            learnMoreUrl: `/reference/${p.name}`,
            pkgConfig: p,
            description: p.description
        })
    }

    function installedExtensions(packagesConfig: pxt.PackagesConfig): ExtensionMeta[] {
        const dependencies = currentProjectDependencies();
        const result: ExtensionMeta[] = [];

        Object.keys(dependencies).forEach(dependencyName => {
            const version = dependencies[dependencyName];
            const resolvedPackage = pkg.mainPkg?.resolveDep(dependencyName);
            const config = resolvedPackage?.config;
            if (!config || config.hidden || config.searchOnly) return;

            const githubRepo = pxt.github.parseRepoId(version);
            if (githubRepo) {
                if (pxt.github.isRepoHidden(githubRepo, packagesConfig)) return;

                const repo: pxt.github.GitRepo = {
                    ...githubRepo,
                    name: githubRepo.project,
                    displayName: config.displayName,
                    description: config.description || "",
                    defaultBranch: "",
                    status: pxt.github.repoStatus(githubRepo, packagesConfig)
                };
                result.push(withInstalledFlag({
                    dependencyName,
                    name: config.name || dependencyName,
                    displayName: config.displayName,
                    type: ExtensionType.Github,
                    imageUrl: config.icon || pxt.github.repoIconUrl(repo),
                    repo,
                    description: config.description,
                    fullRepo: githubRepo.fullName
                }));
                return;
            }

            if (normalizedPublishedScriptId(version) || /^workspace:/.test(version)) {
                result.push(withInstalledFlag({
                    dependencyName,
                    name: config.name || dependencyName,
                    displayName: config.displayName,
                    imageUrl: config.icon,
                    type: normalizedPublishedScriptId(version) ? ExtensionType.ShareScript : undefined,
                    description: config.description
                }));
            }
        });

        return result;
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
        let trgConfig = await data.getAsync<pxt.TargetConfig>("target-config:")
        const packagesConfig = await pxt.packagesConfigAsync();
        const repos = installedExtensions(packagesConfig);
        bundled.forEach(e => repos.push(e));

        const toBeFetched: string[] = [];
        if (trgConfig?.packages?.approvedRepoLib) {
            Object.keys(trgConfig.packages.approvedRepoLib).forEach(repoSlug => {
                const repoData = trgConfig.packages.approvedRepoLib[repoSlug];
                if (!repoData.preferred || repoData.hidden)
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
        const uniqueRepos = mergeUniqueExtensions(repos);
        setPreferredExts(prioritizeInstalledExtensions([...uniqueRepos, ...loadingCards]))

        const exts = await fetchGithubDataAndAddAsync(toBeFetched);
        setPreferredExts(prioritizeInstalledExtensions(mergeUniqueExtensions(repos, exts)))
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
        const extensionInfo = withInstalledFlag(props.extensionInfo);
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
            installed={extensionInfo.installed}
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
            rightHeader={
                <>
                    <Button
                        className="menu-button"
                        title={lf("Import extension from file")}
                        label={lf("Import File")}
                        labelClassName="mobile-hidden"
                        onClick={importExtension}
                        leftIcon="fas fa-upload"
                    />
                    <div className="common-modal-help">
                        <Link
                            className="common-button menu-button"
                            title={lf("Help on {0} dialog", lf("Extensions"))}
                            href="/extensions"
                            target="_blank"
                        >
                            <span className="common-button-flex">
                                <i className="fas fa-question" aria-hidden={true}/>
                            </span>
                        </Link>
                    </div>
                </>
            }
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
                                extensionsInDevelopment.map((p, index) => {
                                    const installed = isLocalExtensionInstalled(p);
                                    return <ExtensionCard
                                        key={`local:${index}`}
                                        title={p.name}
                                        description={lf("Local copy of {0} hosted on github.com", p.githubId)}
                                        imageUrl={p.icon}
                                        extension={p}
                                        onClick={installed
                                            ? () => showInstalledExtensionDialog({
                                                name: p.name,
                                                dependencyName: Object.keys(currentProjectDependencies())
                                                    .find(name => currentProjectDependencies()[name] === `workspace:${p.id}`)
                                            }).catch(core.handleNetworkError)
                                            : addLocal}
                                        installed={installed}
                                    />;
                                })
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
