/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as sui from "./sui";
import * as pkg from "./package";
import * as core from "./core";

import * as codecard from "./codecard"
import * as gallery from "./gallery";

type ISettingsProps = pxt.editor.ISettingsProps;

import Cloud = pxt.Cloud;

enum ScriptSearchMode {
    Packages,
    Projects
}

interface ScriptSearchState {
    searchFor?: string;
    mode?: ScriptSearchMode;
    visible?: boolean;
    search?: boolean;
}

export class ScriptSearch extends data.Component<ISettingsProps, ScriptSearchState> {
    private prevGhData: pxt.github.GitRepo[] = [];
    private prevUrlData: Cloud.JsonScript[] = [];
    private prevGalleries: pxt.CodeCard[] = [];

    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            searchFor: '',
            mode: ScriptSearchMode.Packages,
            visible: false
        }
    }

    hide() {
        this.setState({ visible: false });
    }

    showAddPackages() {
        this.setState({ visible: true, mode: ScriptSearchMode.Packages, searchFor: '', search: true })
    }

    showOpenProject() {
        this.setState({ visible: true, mode: ScriptSearchMode.Projects, searchFor: '', search: true })
    }

    fetchGhData(): pxt.github.GitRepo[] {
        const cloud = pxt.appTarget.cloud || {};
        if (!cloud.packages || this.state.mode != ScriptSearchMode.Packages) return [];
        let searchFor = cloud.githubPackages ? this.state.searchFor : undefined;
        let res: pxt.github.GitRepo[] =
            searchFor || cloud.preferredPackages
                ? this.getData(`gh-search:${searchFor || cloud.preferredPackages.join('|')}`)
                : null
        if (res) this.prevGhData = res
        return this.prevGhData || []
    }

    fetchGalleries(): pxt.CodeCard[] {
        if (this.state.mode != ScriptSearchMode.Projects
            || this.props.parent.getSandboxMode()
            || this.state.searchFor
            || pxt.options.light
            || !pxt.appTarget.appTheme.projectGallery) return [];
        let res = this.getData(`gallery:${encodeURIComponent(pxt.appTarget.appTheme.projectGallery)}`) as gallery.Gallery[];
        if (res) this.prevGalleries = Util.concat(res.map(g => g.cards));
        return this.prevGalleries;
    }

    fetchUrlData(): Cloud.JsonScript[] {
        if (this.state.mode != ScriptSearchMode.Projects) return []

        let scriptid = pxt.Cloud.parseScriptId(this.state.searchFor)
        if (scriptid) {
            let res = this.getData(`cloud-search:${scriptid}`)
            if (res) {
                if (res.statusCode !== 404) {
                    if (!this.prevUrlData) this.prevUrlData = [res]
                    else this.prevUrlData.push(res)
                }
            }
        }
        return this.prevUrlData;
    }

    fetchBundled(): pxt.PackageConfig[] {
        if (this.state.mode != ScriptSearchMode.Packages || !!this.state.searchFor) return [];

        const bundled = pxt.appTarget.bundledpkgs;
        return Object.keys(bundled).filter(k => !/prj$/.test(k))
            .map(k => JSON.parse(bundled[k]["pxt.json"]) as pxt.PackageConfig);
    }

    fetchLocalData(): Header[] {
        if (this.state.mode != ScriptSearchMode.Projects) return [];

        let headers: Header[] = this.getData("header:*")
        if (this.state.searchFor)
            headers = headers.filter(hdr => hdr.name.toLowerCase().indexOf(this.state.searchFor.toLowerCase()) > -1);
        return headers;
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ScriptSearchState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.searchFor != nextState.searchFor
            || this.state.mode != nextState.mode;
    }

    renderCore() {
        if (!this.state.visible) return null;

        const headers = this.fetchLocalData();
        const bundles = this.fetchBundled();
        const ghdata = this.fetchGhData();
        const urldata = this.fetchUrlData();
        const galleries = this.fetchGalleries();

        const chgHeader = (hdr: Header) => {
            pxt.tickEvent("projects.header");
            this.hide();
            this.props.parent.loadHeaderAsync(hdr)
        }
        const chgBundle = (scr: pxt.PackageConfig) => {
            pxt.tickEvent("packages.bundled", { name: scr.name });
            this.hide();
            addDepIfNoConflict(scr, "*")
                .done();
        }
        const chgGallery = (scr: pxt.CodeCard) => {
            pxt.tickEvent("projects.gallery", { name: scr.name });
            this.hide();
            this.props.parent.newEmptyProject(scr.name.toLowerCase(), scr.url);
        }
        const upd = (v: any) => {
            let str = (ReactDOM.findDOMNode(this.refs["searchInput"]) as HTMLInputElement).value
            this.setState({ searchFor: str })
        };
        const kupd = (ev: __React.KeyboardEvent) => {
            if (ev.keyCode == 13) upd(ev);
        }
        const installScript = (scr: Cloud.JsonScript) => {
            this.hide();
            if (this.state.mode == ScriptSearchMode.Projects) {
                core.showLoading(lf("loading project..."));
                workspace.installByIdAsync(scr.id)
                    .then(r => this.props.parent.loadHeaderAsync(r))
                    .done(() => core.hideLoading())
            }
        }
        const installGh = (scr: pxt.github.GitRepo) => {
            pxt.tickEvent("packages.github");
            this.hide();
            if (this.state.mode == ScriptSearchMode.Packages) {
                let p = pkg.mainEditorPkg();
                core.showLoading(lf("downloading package..."));
                pxt.packagesConfigAsync()
                    .then(config => pxt.github.latestVersionAsync(scr.fullName, config))
                    .then(tag => pxt.github.pkgConfigAsync(scr.fullName, tag)
                        .then(cfg => addDepIfNoConflict(cfg, "github:" + scr.fullName + "#" + tag)))
                    .catch(core.handleNetworkError)
                    .finally(() => core.hideLoading());
            } else {
                Util.oops()
            }
        }
        const addDepIfNoConflict = (config: pxt.PackageConfig, version: string) => {
            return pkg.mainPkg.findConflictsAsync(config, version)
                .then((conflicts) => {
                    let inUse = conflicts.filter((c) => pkg.mainPkg.isPackageInUse(c.pkg0.id));
                    let addDependencyPromise = Promise.resolve(true);

                    if (inUse.length) {
                        addDependencyPromise = addDependencyPromise
                            .then(() => core.confirmAsync({
                                header: lf("Cannot add {0} package", config.name),
                                hideCancel: true,
                                agreeLbl: lf("Ok"),
                                body: lf("Remove all the blocks from the {0} package and try again.", inUse[0].pkg0.id)
                            }))
                            .then(() => {
                                return false;
                            });
                    } else if (conflicts.length) {
                        const body = conflicts.length === 1 ?
                            // Single conflict: "Package a is..."
                            lf("Package {0} is incompatible with {1}. Remove {0} and add {1}?", conflicts[0].pkg0.id, config.name) :
                            // 2 conflicts: "Packages A and B are..."; 3+ conflicts: "Packages A, B, C and D are..."
                            lf("Packages {0} and {1} are incompatible with {2}. Remove them and add {2}?", conflicts.slice(0, -1).map((c) => c.pkg0.id).join(","), conflicts.slice(-1)[0].pkg0.id, config.name);

                        addDependencyPromise = addDependencyPromise
                            .then(() => core.confirmAsync({
                                header: lf("Some packages will be removed"),
                                agreeLbl: lf("Remove package(s) and add {0}", config.name),
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
        const importHex = () => {
            pxt.tickEvent("projects.import");
            this.hide();
            this.props.parent.importFileDialog();
        }
        const newProject = () => {
            pxt.tickEvent("projects.new");
            this.hide();
            this.props.parent.newProject();
        }
        const saveProject = () => {
            pxt.tickEvent("projects.save");
            this.hide();
            this.props.parent.saveAndCompile();
        }
        const renameProject = () => {
            pxt.tickEvent("projects.rename");
            this.hide();
            this.props.parent.setFile(pkg.mainEditorPkg().files[pxt.CONFIG_NAME])
        }
        const isEmpty = () => {
            if (this.state.searchFor) {
                if (headers.length > 0
                    || bundles.length > 0
                    || ghdata.length > 0
                    || urldata.length > 0)
                    return false;
                return true;
            }
            return false;
        }

        const headerText = this.state.mode == ScriptSearchMode.Packages ? lf("Add Package...")
            : lf("Projects");
        return (
            <sui.Modal visible={this.state.visible} header={headerText} addClass="large searchdialog"
                onHide={() => this.setState({ visible: false }) }>
                {!this.state.searchFor && this.state.mode == ScriptSearchMode.Projects ?
                    <div className="ui vertical segment">
                        <sui.Button
                            class="primary"
                            icon="file outline"
                            text={lf("New Project...") }
                            title={lf("Creates a new empty project") }
                            onClick={() => newProject() } />
                        {pxt.appTarget.compile ?
                            <sui.Button
                                icon="upload"
                                text={lf("Import File...") }
                                title={lf("Open files from your computer") }
                                onClick={() => importHex() } /> : undefined}
                    </div> : undefined}
                <div className="ui vertical segment">
                    {this.state.search ? <div className="ui search">
                        <div className="ui fluid action input" role="search">
                            <input ref="searchInput" type="text" placeholder={lf("Search...") } onKeyUp={kupd} />
                            <button title={lf("Search") } className="ui right icon button" onClick={upd}>
                                <i className="search icon"></i>
                            </button>
                        </div>
                    </div> : undefined }
                    <div className="ui cards">
                        {bundles.map(scr =>
                            <codecard.CodeCardView
                                key={'bundled' + scr.name}
                                name={scr.name}
                                description={scr.description}
                                url={"/" + scr.installedVersion}
                                onClick={() => chgBundle(scr) }
                                />
                        ) }
                        {headers.map(scr =>
                            <codecard.CodeCardView
                                key={'local' + scr.id}
                                name={scr.name}
                                time={scr.recentUse}
                                imageUrl={scr.icon}
                                url={scr.pubId && scr.pubCurrent ? "/" + scr.pubId : ""}
                                onClick={() => chgHeader(scr) }
                                />
                        ) }
                        {galleries.map(scr => <codecard.CodeCardView
                            key={'gal' + scr.name}
                            className="widedesktop only"
                            name={scr.name}
                            url={scr.url}
                            imageUrl={scr.imageUrl}
                            onClick={() => chgGallery(scr) }
                            />
                        ) }
                        {ghdata.filter(repo => repo.status == pxt.github.GitRepoStatus.Approved).map(scr =>
                            <codecard.CodeCardView
                                name={scr.name.replace(/^pxt-/, "") }
                                header={scr.fullName}
                                description={scr.description}
                                key={'gh' + scr.fullName}
                                onClick={() => installGh(scr) }
                                url={'github:' + scr.fullName}
                                color="blue"
                                />
                        ) }
                        {ghdata.filter(repo => repo.status != pxt.github.GitRepoStatus.Approved).map(scr =>
                            <codecard.CodeCardView
                                name={scr.name.replace(/^pxt-/, "") }
                                header={scr.fullName}
                                description={scr.description}
                                key={'gh' + scr.fullName}
                                onClick={() => installGh(scr) }
                                url={'github:' + scr.fullName}
                                color="red"
                                />
                        ) }
                        {urldata.map(scr =>
                            <codecard.CodeCardView
                                name={scr.name}
                                time={scr.time}
                                header={'/' + scr.id}
                                description={scr.description}
                                key={'cloud' + scr.id}
                                onClick={() => installScript(scr) }
                                url={'/' + scr.id}
                                color="blue"
                                />
                        ) }
                    </div>
                    { isEmpty() ?
                        <div className="ui items">
                            <div className="ui item">
                                {this.state.mode == ScriptSearchMode.Packages ?
                                    lf("We couldn't find any packages matching '{0}'", this.state.searchFor) :
                                    lf("We couldn't find any projects matching '{0}'", this.state.searchFor) }
                            </div>
                        </div>
                        : undefined }
                </div>
            </sui.Modal >
        );
    }
}
