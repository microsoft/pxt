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
import * as dialogs from "./dialogs";
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
    }

    private hide() {
        this.setState({ visible: false });
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

    showExtensions() {
        this.setState({
            visible: true,
            searchFor: '',
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
            visible: true, searchFor: '',
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

            if (trgConfigFetch.status === data.FetchStatus.Complete && trgConfig && trgConfig.packages && trgConfig.packages.preferredRepos) {
                searchFor = trgConfig.packages.preferredRepos.join("|");
            }
        }

        if (!searchFor) return emptyResult; // No search result and no preferred packages = no results for GH packages

        const res = this.getDataWithStatus(`gh-search:${searchFor}`);

        if (!res.data || (res.data as any).statusCode === 404) {
            res.data = [];
        }

        return res;
    }

    fetchLocal(): pxt.workspace.Header[] {
        if (this.state.mode != ScriptSearchMode.Extensions) return [];
        return workspace.getHeaders()
            .filter(h => !!h.githubId)
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
        // Hidden navigation, used to test /beta or other versions inside released UWP apps
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
                pxt.winrt.releaseAllDevicesAsync()
                    .then(() => {
                        window.location.href = homeUrl + urlPath;
                    })
                    .done();
            }
        }
        else {
            this.setState({ searchFor: str });
        }
    }

    addUrl(scr: pxt.Cloud.JsonScript) {
        this.hide();
        let p = pkg.mainEditorPkg();
        return p.addDepAsync(scr.name, "pub:" + scr.id)
            .then(() => this.props.parent.reloadHeaderAsync())
            .finally(() => this.afterHide());
    }

    addBundle(scr: pxt.PackageConfig) {
        pxt.tickEvent("packages.bundled", { name: scr.name });
        this.hide();
        this.addDepIfNoConflict(scr, "*")
            .finally(() => this.afterHide());
    }

    addLocal(hd: pxt.workspace.Header) {
        pxt.tickEvent("packages.local");
        this.hide();
        workspace.getTextAsync(hd.id)
            .then(files => {
                let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
                return this.addDepIfNoConflict(cfg, "workspace:" + hd.id)
            })
            .finally(() => this.afterHide());
    }

    installGh(scr: pxt.github.GitRepo) {
        pxt.tickEvent("packages.github", { name: scr.fullName });
        this.hide();
        core.showLoading("downloadingpackage", lf("downloading extension..."));
        pxt.packagesConfigAsync()
            .then(config => pxt.github.latestVersionAsync(scr.fullName, config))
            .then(tag => pxt.github.pkgConfigAsync(scr.fullName, tag)
                .then(cfg => {
                    core.hideLoading("downloadingpackage");
                    return cfg;
                })
                .then(cfg => this.addDepIfNoConflict(cfg, "github:" + scr.fullName + "#" + tag)))
            .catch(core.handleNetworkError)
            .finally(() => {
                this.afterHide();
                core.hideLoading("downloadingpackage")
            });
    }

    addDepIfNoConflict(config: pxt.PackageConfig, version: string) {
        return pkg.mainPkg.findConflictsAsync(config, version)
            .then((conflicts) => {
                let inUse = config.core ? [] // skip conflict checking for a new core package
                    : conflicts.filter((c) => pkg.mainPkg.isPackageInUse(c.pkg0.id));
                let addDependencyPromise = Promise.resolve(true);

                if (inUse.length) {
                    addDependencyPromise = addDependencyPromise
                        .then(() => core.confirmAsync({
                            header: lf("Cannot add {0} extension", config.name),
                            hideCancel: true,
                            agreeLbl: lf("Ok"),
                            body: lf("Remove all the blocks from the {0} extension and try again.", inUse[0].pkg0.id)
                        }))
                        .then(() => {
                            return false;
                        });
                } else if (conflicts.length) {
                    const body = conflicts.length === 1 ?
                        // Single conflict: "Extension A is..."
                        lf("Extension {0} is incompatible with {1}. Remove {0} and add {1}?", conflicts[0].pkg0.id, config.name) :
                        // 2 conflicts: "Extensions A and B are..."; 3+ conflicts: "Extensions A, B, C and D are..."
                        lf("Extensions {0} and {1} are incompatible with {2}. Remove them and add {2}?", conflicts.slice(0, -1).map((c) => c.pkg0.id).join(", "), conflicts.slice(-1)[0].pkg0.id, config.name);

                    addDependencyPromise = addDependencyPromise
                        .then(() => this.state.mode == ScriptSearchMode.Boards
                            ? Promise.resolve(1)
                            : core.confirmAsync({
                                header: lf("Some extensions will be removed"),
                                agreeLbl: lf("Remove extension(s) and add {0}", config.name),
                                agreeClass: "pink",
                                body
                            }))
                        .then((buttonPressed) => {
                            if (buttonPressed !== 0) {
                                let p = pkg.mainEditorPkg();
                                return Promise.all(conflicts.map((c) => {
                                    return p.removeDepAsync(c.pkg0.id);
                                }))
                                    .then(() => true);
                            }
                            return Promise.resolve(false);
                        });
                }

                return addDependencyPromise
                    .then((shouldAdd) => {
                        if (shouldAdd) {
                            let p = pkg.mainEditorPkg();
                            return p.addDepAsync(config.name, version)
                                .then(() => this.props.parent.reloadHeaderAsync());
                        }
                        return Promise.resolve();
                    });
            });
    }

    toggleExperiment(experiment: pxt.editor.experiments.Experiment) {
        pxt.editor.experiments.toggle(experiment);
        pxt.tickEvent(`experiments.toggle`, { "experiment": experiment.id, "enabled": pxt.editor.experiments.isEnabled(experiment) ? 1 : 0 }, { interactiveConsent: true })
        this.forceUpdate();
    }

    renderCore() {
        const { mode, closeIcon, visible, searchFor, experimentsState } = this.state;

        if (!visible) return <div></div>;
        const bundles = this.fetchBundled();
        const ghdata = this.fetchGhData();
        const urldata = this.fetchUrlData();
        const local = this.fetchLocal();
        const experiments = this.fetchExperiments();
        const isSearching = searchFor && (ghdata.status === data.FetchStatus.Pending || urldata.status === data.FetchStatus.Pending);

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
            if (a.core && b.core && a.weight != b.weight)
                return -(a.weight || 0) + (b.weight || 0);

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

        return (
            <sui.Modal isOpen={visible} dimmer={true}
                className="searchdialog" size="fullscreen"
                onClose={this.hide}
                closeIcon={closeIcon}
                header={headerText}
                helpUrl={helpPath}
                closeOnDimmerClick closeOnEscape
                description={description}>
                <div className="ui">
                    {mode == ScriptSearchMode.Experiments ?
                        <div className="ui message">
                            <div className="header">{lf("WARNING: EXPERIMENTAL FEATURES AHEAD!")}</div>
                            {lf("Try out these features and tell us what you think!")}
                        </div> : undefined}
                    {mode == ScriptSearchMode.Extensions ?
                        <SearchInput key="search"
                            ariaMessage={lf("{0} result matching '{1}'", bundles.length + ghdata.data.length + urldata.data.length, searchFor)}
                            placeholder={lf("Search or enter project URL...")}
                            searchHandler={this.handleSearch} inputClassName="fluid" autoFocus={true}
                            disabled={isSearching} /> : undefined}
                    {isSearching ?
                        <div className="ui medium active centered inline loader"></div>
                        :
                        <div className="ui cards centered" role="listbox">
                            {urldata.data.map(scr =>
                                <ScriptSearchCodeCard
                                    key={'url' + scr.id}
                                    name={scr.name}
                                    description={scr.description}
                                    url={"/" + scr.id}
                                    scr={scr}
                                    onCardClick={this.addUrl}
                                    role="link"
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
                                    role="link"
                                />
                            )}
                            {bundles.map(scr =>
                                <ScriptSearchCodeCard
                                    key={'bundled' + scr.name}
                                    name={scr.name}
                                    description={scr.description}
                                    url={"/" + scr.installedVersion}
                                    imageUrl={scr.icon}
                                    scr={scr}
                                    onCardClick={this.addBundle}
                                    label={pxt.isPkgBeta(scr) ? lf("Beta") : undefined}
                                    role="link"
                                />
                            )}
                            {ghdata.data.filter(repo => repo.status == pxt.github.GitRepoStatus.Approved).map(scr =>
                                <ScriptSearchCodeCard
                                    name={scr.name.replace(/^pxt-/, "")}
                                    description={scr.description}
                                    key={'gha' + scr.fullName}
                                    scr={scr}
                                    onCardClick={this.installGh}
                                    url={'github:' + scr.fullName}
                                    imageUrl={pxt.github.repoIconUrl(scr)}
                                    label={pxt.isPkgBeta(scr) ? lf("Beta") : undefined}
                                    role="link"
                                    learnMoreUrl={`/pkg/${scr.fullName}`}
                                />
                            )}
                            {ghdata.data.filter(repo => repo.status != pxt.github.GitRepoStatus.Approved).map(scr =>
                                <ScriptSearchCodeCard
                                    name={scr.name.replace(/^pxt-/, "")}
                                    description={(scr.description || "")}
                                    extracontent={lf("User-provided extension, not endorsed by Microsoft.")}
                                    key={'ghd' + scr.fullName}
                                    scr={scr}
                                    onCardClick={this.installGh}
                                    imageUrl={pxt.github.repoIconUrl(scr)}
                                    label={pxt.isPkgBeta(scr) ? lf("Beta") : undefined}
                                    url={'github:' + scr.fullName}
                                    role="link"
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
                                    role="link"
                                    label={pxt.editor.experiments.isEnabled(experiment) ? lf("Enabled") : lf("Disabled")}
                                    labelClass={pxt.editor.experiments.isEnabled(experiment) ? "green right ribbon" : "grey right ribbon"}
                                    onCardClick={this.toggleExperiment}
                                    feedbackUrl={experiment.feedbackUrl}
                                />
                            )}
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
                {mode == ScriptSearchMode.Extensions ? dialogs.githubFooter(lf("Want to create your own extension?"), this.hide) : undefined}
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