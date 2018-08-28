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

type ISettingsProps = pxt.editor.ISettingsProps;

import Cloud = pxt.Cloud;

export enum ScriptSearchMode {
    Extensions,
    Boards
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
interface ScriptSearchState {
    searchFor?: string;
    visible?: boolean;
    mode?: ScriptSearchMode;
}

export class ScriptSearch extends data.Component<ISettingsProps, ScriptSearchState> {
    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            searchFor: '',
            visible: false,
            mode: ScriptSearchMode.Extensions
        }

        this.hide = this.hide.bind(this);
        this.handleSearchKeyUpdate = this.handleSearchKeyUpdate.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.addUrl = this.addUrl.bind(this);
        this.addBundle = this.addBundle.bind(this);
        this.installGh = this.installGh.bind(this);
        this.addLocal = this.addLocal.bind(this);
    }

    hide() {
        this.setState({ visible: false });
    }

    showExtensions() {
        this.setState({ visible: true, searchFor: '', mode: ScriptSearchMode.Extensions })
    }

    showBoards() {
        this.setState({ visible: true, searchFor: '', mode: ScriptSearchMode.Boards })
    }

    fetchUrlData(): data.DataFetchResult<Cloud.JsonScript[]> {
        const emptyResult: data.DataFetchResult<Cloud.JsonScript[]> = {
            data: [],
            status: data.FetchStatus.Complete
        };
        if (!this.state.searchFor || this.state.mode != ScriptSearchMode.Extensions) return emptyResult;

        let scriptid = pxt.Cloud.parseScriptId(this.state.searchFor)

        if (!scriptid) {
            return emptyResult;
        }

        const res = this.getDataWithStatus(`cloud-search:${scriptid}`);

        if (res.data && res.data.statusCode === 404)
            res.data = []; // No shared project with that URL exists

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

    fetchLocal() {
        return workspace.getHeaders()
            .filter(h => !!h.githubId)
    }

    fetchBundled(): pxt.PackageConfig[] {
        const query = this.state.searchFor;
        const bundled = pxt.appTarget.bundledpkgs;
        const showCore = this.state.mode == ScriptSearchMode.Boards;
        return Object.keys(bundled).filter(k => !/prj$/.test(k))
            .map(k => JSON.parse(bundled[k]["pxt.json"]) as pxt.PackageConfig)
            .filter(pk => !query || pk.name.toLowerCase().indexOf(query.toLowerCase()) > -1) // search filter
            .filter(pk => !pkg.mainPkg.deps[pk.name]) // don't show package already referenced
            .filter(pk => showCore == !!pk.core); // show core in "boards" mode
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

    handleSearchKeyUpdate(ev: React.KeyboardEvent<HTMLElement>) {
        if (ev.keyCode == 13) this.handleSearch();

    }

    handleSearch() {
        let str = (ReactDOM.findDOMNode(this.refs["searchInput"]) as HTMLInputElement).value

        // Hidden navigation, used to test /beta or other versions inside released UWP apps
        // Secret prefix is /@, e.g.: /@beta
        const urlPathExec = /^\/@(.*)$/.exec(str);
        let urlPath = urlPathExec && urlPathExec[1];
        if (urlPath) {
            if (urlPath === "devtools" && electron.isPxtElectron) {
                electron.openDevTools();
                this.hide();
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
            .then(() => this.props.parent.reloadHeaderAsync());
    }

    addBundle(scr: pxt.PackageConfig) {
        pxt.tickEvent("packages.bundled", { name: scr.name });
        this.hide();
        this.addDepIfNoConflict(scr, "*")
            .done();
    }

    addLocal(hd: pxt.workspace.Header) {
        pxt.tickEvent("packages.local");
        this.hide();
        workspace.getTextAsync(hd.id)
            .then(files => {
                let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
                this.addDepIfNoConflict(cfg, "workspace:" + hd.id)
            })
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
            .finally(() => core.hideLoading("downloadingpackage"));
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

    renderCore() {
        if (!this.state.visible) return <div></div>;

        const boards = this.state.mode == ScriptSearchMode.Boards;
        const bundles = this.fetchBundled();
        const ghdata = this.fetchGhData();
        const urldata = this.fetchUrlData();
        const local = this.fetchLocal()
        const isSearching = this.state.searchFor && (ghdata.status === data.FetchStatus.Pending || urldata.status === data.FetchStatus.Pending);

        const coresFirst = (a: pxt.PackageConfig, b: pxt.PackageConfig) => {
            if (a.core != b.core)
                return a.core ? -1 : 1;
            return pxt.Util.strcmp(a.name, b.name)
        }

        bundles.sort(coresFirst)
        const isEmpty = () => {
            if (!this.state.searchFor || isSearching) {
                return false;
            }
            return bundles.length + ghdata.data.length + urldata.data.length === 0;
        }

        const headerText = boards ? lf("Boards") : lf("Extensions");
        const description = boards ? lf("Change development board") : lf("Add an extension to the project");
        const helpPath = boards ? "/boards" : "/packages";
        return (
            <sui.Modal isOpen={this.state.visible} dimmer={true}
                className="searchdialog" size="fullscreen"
                onClose={this.hide}
                closeIcon={true} header={headerText}
                helpUrl={helpPath}
                closeOnDimmerClick closeOnEscape
                description={description}>
                <div className="ui">
                    {!boards ?
                        <div className="ui search">
                            <div className="ui fluid action input" role="search">
                                <div aria-live="polite" className="accessible-hidden">{lf("{0} result matching '{1}'", bundles.length + ghdata.data.length + urldata.data.length, this.state.searchFor)}</div>
                                <input autoFocus ref="searchInput" type="text" placeholder={lf("Search or enter project URL...")} onKeyUp={this.handleSearchKeyUpdate} disabled={isSearching} />
                                <button title={lf("Search")} disabled={isSearching} className="ui right icon button" onClick={this.handleSearch}>
                                    <sui.Icon icon="search" />
                                </button>
                            </div>
                        </div> : undefined}
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
                                    label={/\bbeta\b/i.test(scr.description) ? lf("Beta") : undefined}
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
                                    label={/\bbeta\b/i.test(scr.description) ? lf("Beta") : undefined}
                                    role="link"
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
                                    url={'github:' + scr.fullName}
                                    role="link"
                                />
                            )}
                        </div>
                    }
                    {isEmpty() ?
                        <div className="ui items">
                            <div className="ui item">
                                {lf("We couldn't find any extensions matching '{0}'", this.state.searchFor)}
                            </div>
                        </div>
                        : undefined}
                    {dialogs.githubFooter(lf("Want to create your own extension?"), this.hide)}
                </div>
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