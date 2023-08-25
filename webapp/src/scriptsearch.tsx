/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";
import * as pkg from "./package";
import * as core from "./core";
import * as codecard from "./codecard";
import * as electron from "./electron";
import * as workspace from "./workspace";
import { SearchInput } from "./components/searchInput";

type ISettingsProps = pxt.editor.ISettingsProps;

import Cloud = pxt.Cloud;

export enum ScriptSearchMode {
    Extensions,
    Boards,
    Experiments
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
interface ScriptSearchState {
    defaultSearch?: string;
    searchFor?: string;
    visible?: boolean;
    mode?: ScriptSearchMode;
    experimentsState?: string;
    features?: string[];
    closeIcon?: boolean;
    resolve?: () => void;
}

export class ScriptSearch extends data.Component<ISettingsProps, ScriptSearchState> {
    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            searchFor: '',
            visible: false,
            mode: ScriptSearchMode.Extensions,
            closeIcon: true
        }

        this.hide = this.hide.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.addUrl = this.addUrl.bind(this);
        this.addBundle = this.addBundle.bind(this);
        this.installGh = this.installGh.bind(this);
        this.addLocal = this.addLocal.bind(this);
        this.toggleExperiment = this.toggleExperiment.bind(this);
        this.importExtensionFile = this.importExtensionFile.bind(this);
        this.backOnHide = this.backOnHide.bind(this);
    }

    private hide(evt?: any, back?: boolean) {
        this.setState({ visible: false });
        if (back === true) this.props.parent.openPreviousEditor();
        // something changed?
        if (this.state.mode == ScriptSearchMode.Experiments &&
            this.state.experimentsState !== pxt.editor.experiments.state())
            this.props.parent.reloadEditor();
    }

    private afterHide() {
        const r = this.state.resolve;
        if (r) {
            this.setState({ resolve: undefined })
            r();
        }
    }

    showExtensions(query?: string) {
        this.setState({
            visible: true,
            defaultSearch: query || '',
            searchFor: query || '',
            mode: ScriptSearchMode.Extensions,
            closeIcon: true,
            features: undefined,
            resolve: undefined
        })
    }

    showBoardsAsync(features?: string[], closeIcon?: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            this.setState({
                visible: true,
                defaultSearch: undefined,
                searchFor: '',
                mode: ScriptSearchMode.Boards,
                closeIcon: !!closeIcon,
                features,
                resolve
            })
        });
    }

    showExperiments() {
        this.setState({
            visible: true,
            defaultSearch: undefined,
            searchFor: '',
            mode: ScriptSearchMode.Experiments,
            closeIcon: true,
            experimentsState: pxt.editor.experiments.state(),
            features: undefined,
            resolve: undefined
        });
    }

    fetchUrlData(): data.DataFetchResult<Cloud.JsonScript[]> {
        const emptyResult: data.DataFetchResult<Cloud.JsonScript[]> = {
            data: [],
            status: data.FetchStatus.Complete
        };
        if (!this.state.searchFor || this.state.mode != ScriptSearchMode.Extensions)
            return emptyResult;

        const scriptid = pxt.Cloud.parseScriptId(this.state.searchFor)
        if (!scriptid) {
            return emptyResult;
        }

        const res = this.getDataWithStatus(`cloud-search:${scriptid}`);
        if (!res.data || (res.data && res.data.statusCode === 404))
            res.data = []; // No shared project with that URL exists
        // cloud may return single result, wrapping in array
        if (!Array.isArray(res.data))
            res.data = [res.data];
        return res;
    }

    fetchGhData(): data.DataFetchResult<pxt.github.GitRepo[]> {
        const emptyResult: data.DataFetchResult<pxt.github.GitRepo[]> = {
            data: [],
            status: data.FetchStatus.Complete
        };

        if (this.state.mode != ScriptSearchMode.Extensions) return emptyResult;

        const cloud = pxt.appTarget.cloud || {};
        if (!cloud.packages) return emptyResult;

        let searchFor = cloud.githubPackages ? this.state.searchFor : undefined;
        if (!searchFor) {
            const trgConfigFetch = this.getDataWithStatus("target-config:");
            const trgConfig = trgConfigFetch.data as pxt.TargetConfig;

            if (trgConfigFetch.status === data.FetchStatus.Complete && trgConfig?.packages?.approvedRepoLib) {
                const approvedRepoLib = trgConfig?.packages?.approvedRepoLib;
                const preferredRepos = approvedRepoLib && Object.keys(approvedRepoLib).filter(el => !!approvedRepoLib[el].preferred);
                if (preferredRepos)
                    searchFor = preferredRepos.join("|");
            }
        }

        if (!searchFor) return emptyResult; // No search result and no preferred packages = no results for GH packages

        const res = this.getDataWithStatus(`gh-search:${searchFor}`);

        if (!res.data || (res.data as any).statusCode === 404) {
            res.data = [];
        }

        return res;
    }

    fetchLocalRepositories(): pxt.workspace.Header[] {
        if (this.state.mode != ScriptSearchMode.Extensions) return [];
        let query = this.state.searchFor;
        const { header } = this.props.parent.state;

        let r = workspace.getHeaders()
        if (!/localdependencies=1/i.test(window.location.href))
            r = r.filter(h => !!h.githubId);
        if (header)
            r = r.filter(h => h.id != header.id) // don't self-reference
        if (query) {
            query = query.toLocaleLowerCase();
            r = r.filter(h => h.name.toLocaleLowerCase().indexOf(query) > -1) // search filter
        }
        return r;
    }

    fetchBundled(): pxt.PackageConfig[] {
        if (this.state.mode != ScriptSearchMode.Boards &&
            this.state.mode != ScriptSearchMode.Extensions) return [];
        const query = this.state.searchFor;
        const bundled = pxt.appTarget.bundledpkgs;
        const boards = this.state.mode == ScriptSearchMode.Boards;
        const features = this.state.features;
        return Object.keys(bundled).filter(k => !/prj$/.test(k))
            .map(k => JSON.parse(bundled[k]["pxt.json"]) as pxt.PackageConfig)
            .filter(pk => !pk.hidden)
            .filter(pk => !(!query && pk.searchOnly)) // Hide these unless user has started search
            .filter(pk => !query || pk.name.toLowerCase().indexOf(query.toLowerCase()) > -1) // search filter
            .filter(pk => boards || !pkg.mainPkg.deps[pk.name] || pkg.mainPkg.deps[pk.name].cppOnly) // don't show package already referenced in extensions
            .filter(pk => !/---/.test(pk.name)) //filter any package with ---, these are part of common-packages such as core---linux or music---pwm
            .filter(pk => boards == !!pk.core) // show core in "boards" mode
            .filter(pk => !features || features.every(f => pk.features && pk.features.indexOf(f) > -1)); // ensure features are supported

    }

    fetchExperiments(): pxt.editor.experiments.Experiment[] {
        if (this.state.mode != ScriptSearchMode.Experiments) return [];
        return pxt.editor.experiments.all();
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ScriptSearchState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.searchFor != nextState.searchFor
            || this.state.mode != nextState.mode;
    }

    componentDidUpdate() {
        let searchInput = ReactDOM.findDOMNode(this.refs["searchInput"]) as HTMLInputElement;
        if (searchInput) {
            searchInput.focus();
        }
    }

    handleSearch(str: string) {
        // Hidden navigation, used to test /beta or other versions inside released apps
        // Secret prefix is /@, e.g.: /@beta
        const urlPathExec = /^\/@(.*)$/.exec(str);
        let urlPath = urlPathExec && urlPathExec[1];
        if (urlPath) {
            if (urlPath === "devtools" && pxt.BrowserUtils.isPxtElectron()) {
                electron.openDevTools();
                this.hide();
                this.afterHide();
            } else {
                let homeUrl = pxt.appTarget.appTheme.homeUrl;
                if (!/\/$/.test(homeUrl)) {
                    homeUrl += "/";
                }
                urlPath = urlPath.replace(/^\//, "");
                window.location.href = homeUrl + urlPath;
            }
        }
        else {
            this.setState({ searchFor: str });
        }
    }

    addUrl(scr: pxt.Cloud.JsonScript) {
        this.hide(null, this.backOnHide());
        let p = pkg.mainEditorPkg();
        return p.setDependencyAsync(scr.name, "pub:" + scr.id)
            .then(() => this.props.parent.reloadHeaderAsync())
            .finally(() => this.afterHide());
    }

    addBundle(scr: pxt.PackageConfig) {
        pxt.tickEvent("packages.bundled", { name: scr.name });
        this.hide(null, this.backOnHide());
        this.addDepIfNoConflict(scr, "*")
            .finally(() => this.afterHide());
    }

    addLocal(hd: pxt.workspace.Header) {
        pxt.tickEvent("packages.local");
        this.hide(null, this.backOnHide());
        workspace.getTextAsync(hd.id)
            .then(files => {
                let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
                return this.addDepIfNoConflict(cfg, "workspace:" + hd.id)
            })
            .finally(() => this.afterHide());
    }

    async installGh(scr: pxt.github.GitRepo) {
        const parsed = pxt.github.parseRepoId(scr.fullName);
        pxt.tickEvent("packages.github", {
            name: scr.fullName,
            slug: scr.slug.toLowerCase(),
            tag: scr.tag,
            fileName: parsed.fileName
        });
        this.hide(null, this.backOnHide());
        let r: { version: string, config: pxt.PackageConfig };
        try {
            core.showLoading("downloadingpackage", lf("downloading extension..."));
            r = await pxt.github.downloadLatestPackageAsync(scr, true /* use proxy */);
        }
        catch (e) {
            core.handleNetworkError(e);
        } finally {
            core.hideLoading("downloadingpackage");
        }
        return await this.addDepIfNoConflict(r.config, r.version)
    }

    async addDepIfNoConflict(config: pxt.PackageConfig, version: string) {
        try {
            this.hide(null, this.backOnHide());
            core.showLoading("installingextension", lf("Adding extension..."))
            const added = await pkg.mainEditorPkg()
                .addDependencyAsync(config, version, this.state.mode == ScriptSearchMode.Boards)
            if (added)  //async
                this.props.parent.reloadHeaderAsync();
        }
        finally {
            core.hideLoading("installingextension")
            this.afterHide();
        }
    }

    toggleExperiment(experiment: pxt.editor.experiments.Experiment) {
        pxt.editor.experiments.toggle(experiment);
        pxt.tickEvent(`experiments.toggle`, { "experiment": experiment.id, "enabled": pxt.editor.experiments.isEnabled(experiment) ? 1 : 0 }, { interactiveConsent: true })
        this.forceUpdate();
    }

    importExtensionFile() {
        pxt.tickEvent("extensions.import", undefined, { interactiveConsent: true });
        this.hide(null, this.backOnHide());
        this.props.parent.showImportFileDialog({ extension: true });
    }

    // should return to previous editor when modal is hidden if we are editing pxt.json
    backOnHide() {
        return this.props.parent.isPxtJsonEditor();
    }

    renderCore() {
        const { mode, closeIcon, visible, searchFor, experimentsState, defaultSearch } = this.state;

        if (!visible) return <div></div>;
        const bundles = this.fetchBundled();
        const ghdata = this.fetchGhData();
        const urldata = this.fetchUrlData();
        const local = this.fetchLocalRepositories();
        const experiments = this.fetchExperiments();
        const isSearching = searchFor && (ghdata.status === data.FetchStatus.Pending || urldata.status === data.FetchStatus.Pending);
        const disableFileAccessinMaciOs = pxt.appTarget.appTheme.disableFileAccessinMaciOs && (pxt.BrowserUtils.isIOS() || pxt.BrowserUtils.isMac());
        const disableFileAccessinAndroid = pxt.appTarget.appTheme.disableFileAccessinAndroid && pxt.BrowserUtils.isAndroid();
        const showImportFile = mode == ScriptSearchMode.Extensions
            && pxt.appTarget.appTheme.importExtensionFiles
            && !disableFileAccessinMaciOs
            && !disableFileAccessinAndroid
            && !searchFor;
        // inject beta at end of / or /#
        // also excludes http://localhost:port/index.html
        const betaUrl = window.location.href.replace(/\/(#|$|\?)/, "/beta$1")
        const showOpenBeta = mode == ScriptSearchMode.Experiments
            && betaUrl != window.location.href; // don't show beta button in beta

        const compareConfig = (a: pxt.PackageConfig, b: pxt.PackageConfig) => {
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
        }

        bundles.sort(compareConfig)
        const isEmpty = () => {
            if (!searchFor || isSearching) {
                return false;
            }
            return bundles.length + ghdata.data.length + urldata.data.length === 0;
        }

        const headerText = mode == ScriptSearchMode.Boards ? lf("Boards")
            : mode == ScriptSearchMode.Experiments ? lf("Experiments")
                : lf("Extensions");
        const description = mode == ScriptSearchMode.Boards ? lf("Change development board")
            : mode == ScriptSearchMode.Experiments ? lf("Turn on and off experimental features")
                : lf("Add an extension to the project");
        const helpPath = mode == ScriptSearchMode.Boards ? "/boards"
            : mode == ScriptSearchMode.Experiments ? "/experiments"
                : "/extensions";

        const experimentsChanged = mode == ScriptSearchMode.Experiments
            && experimentsState != pxt.editor.experiments.state();

        const classes = this.props.parent.createModalClasses("searchdialog");

        const ghName = (scr: pxt.github.GitRepo) => {
            let n = scr.name.replace(/^pxt-/, "");
            // always pickup name from the pxt.json file
            // if (scr.fileName)
            //     n = lf("{0} / {1}", n, scr.fileName)
            return n;
        }

        const searchPlaceholder = lf("Search or enter project URL...");

        return (
            <sui.Modal isOpen={visible} dimmer={true}
                className={classes} size="fullscreen"
                onClose={this.hide}
                closeIcon={closeIcon}
                header={headerText}
                helpUrl={helpPath}
                closeOnDimmerClick closeOnEscape
                description={description}>
                <div className="ui">
                    {mode == ScriptSearchMode.Experiments ?
                        <div className="ui message info">
                            <div className="header">{lf("WARNING: EXPERIMENTAL FEATURES AHEAD!")}</div>
                            {lf("Try out these features and tell us what you think!")}
                        </div> : undefined}
                    {mode == ScriptSearchMode.Extensions ?
                        <SearchInput key="search"
                            defaultValue={defaultSearch}
                            ariaMessage={lf("{0} result matching '{1}'", bundles.length + ghdata.data.length + urldata.data.length, searchFor)}
                            placeholder={searchPlaceholder}
                            aria-label={searchPlaceholder}
                            searchHandler={this.handleSearch} inputClassName="fluid" autoFocus={true}
                            disabled={isSearching} /> : undefined}
                    {isSearching ?
                        <div className="ui medium active centered inline loader"></div>
                        :
                        <div className="ui cards centered" aria-label={lf("Extension search results")}>
                            {urldata.data.map(scr =>
                                <ScriptSearchCodeCard
                                    key={'url' + scr.id}
                                    name={scr.name}
                                    description={scr.description}
                                    url={"/" + scr.id}
                                    scr={scr}
                                    onCardClick={this.addUrl}
                                    role="button"
                                />
                            )}
                            {local.map(scr =>
                                <ScriptSearchCodeCard
                                    key={'local' + scr.id}
                                    name={scr.name}
                                    description={lf("Local copy of {0} hosted on github.com", scr.githubId)}
                                    url={"https://github.com/" + scr.githubId}
                                    imageUrl={scr.icon}
                                    scr={scr}
                                    onCardClick={this.addLocal}
                                    label={lf("Local")}
                                    title={lf("Local GitHub extension")}
                                    labelClass="blue right ribbon"
                                    role="button"
                                />
                            )}
                            {bundles.map(scr =>
                                <ScriptSearchCodeCard
                                    key={'bundled' + scr.name}
                                    name={scr.name}
                                    description={scr.description}
                                    imageUrl={scr.icon}
                                    scr={scr}
                                    onCardClick={this.addBundle}
                                    label={pxt.isPkgBeta(scr) ? lf("Beta") : undefined}
                                    role="button"
                                />
                            )}
                            {ghdata.data.filter(repo => repo.status == pxt.github.GitRepoStatus.Approved).map(scr =>
                                <ScriptSearchCodeCard
                                    name={ghName(scr)}
                                    description={scr.description}
                                    key={'gha' + scr.fullName}
                                    scr={scr}
                                    onCardClick={this.installGh}
                                    url={'github:' + scr.fullName}
                                    imageUrl={pxt.github.repoIconUrl(scr)}
                                    label={pxt.isPkgBeta(scr) ? lf("Beta") : undefined}
                                    role="button"
                                    learnMoreUrl={`/pkg/${scr.fullName}`}
                                />
                            )}
                            {ghdata.data.filter(repo => repo.status != pxt.github.GitRepoStatus.Approved).map(scr =>
                                <ScriptSearchCodeCard
                                    name={ghName(scr)}
                                    description={(scr.description || "")}
                                    extracontent={lf("User-provided extension, not endorsed by Microsoft.")}
                                    key={'ghd' + scr.fullName}
                                    scr={scr}
                                    onCardClick={this.installGh}
                                    imageUrl={pxt.github.repoIconUrl(scr)}
                                    label={pxt.isPkgBeta(scr) ? lf("Beta") : undefined}
                                    url={'github:' + scr.fullName}
                                    role="button"
                                    learnMoreUrl={`/pkg/${scr.fullName}`}
                                />
                            )}
                            {experiments.map(experiment =>
                                <ScriptSearchCodeCard
                                    name={experiment.name}
                                    scr={experiment}
                                    imageUrl={`/static/experiments/${experiment.id.toLowerCase()}.png`}
                                    description={experiment.description}
                                    key={'exp' + experiment.id}
                                    role="button"
                                    label={pxt.editor.experiments.isEnabled(experiment) ? lf("Enabled") : lf("Disabled")}
                                    labelClass={pxt.editor.experiments.isEnabled(experiment) ? "green right ribbon" : "grey right ribbon"}
                                    onCardClick={this.toggleExperiment}
                                    feedbackUrl={experiment.feedbackUrl}
                                />
                            )}
                            {showImportFile && <codecard.CodeCardView
                                ariaLabel={lf("Open files from your computer")}
                                role="button"
                                key={'import'}
                                icon="upload ui cardimage"
                                iconColor="secondary"
                                name={lf("Import File...")}
                                description={lf("Open files from your computer")}
                                onClick={this.importExtensionFile}
                            />}
                            {showOpenBeta && <codecard.CodeCardView
                                ariaLabel={lf("Open the next version of the editor")}
                                role="button"
                                key={'beta'}
                                className="beta"
                                icon="lab ui cardimage"
                                iconColor="secondary"
                                name={lf("Beta Editor")}
                                label={lf("Beta")}
                                labelClass="red right ribbon"
                                description={lf("Open the next version of the editor")}
                                url={betaUrl}
                            />}
                        </div>
                    }
                    {isEmpty() ?
                        <div className="ui items">
                            <div className="ui item">
                                {lf("We couldn't find any extensions matching '{0}'", searchFor)}
                            </div>
                        </div>
                        : undefined}
                </div>
                {experimentsChanged ?
                    <div className="ui warning message">
                        <div className="header">{lf("Experiments changed")}</div>
                        {lf("The editor will reload when leaving this page.")}
                    </div> : undefined}
            </sui.Modal>
        );
    }
}

interface ScriptSearchCodeCardProps extends pxt.CodeCard {
    scr: any;
    onCardClick: (scr: any) => void;
}

class ScriptSearchCodeCard extends sui.StatelessUIElement<ScriptSearchCodeCardProps> {

    constructor(props: ScriptSearchCodeCardProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        const { scr, onCardClick } = this.props;
        onCardClick(scr);
    }

    renderCore() {
        const { onCardClick, onClick, scr, ...rest } = this.props;
        return <codecard.CodeCardView {...rest} onClick={this.handleClick} />
    }
}