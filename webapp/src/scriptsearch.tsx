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

interface ScriptSearchState {
    searchFor?: string;
    visible?: boolean;
}

export class ScriptSearch extends data.Component<ISettingsProps, ScriptSearchState> {
    private prevGhData: pxt.github.GitRepo[] = [];
    private prevUrlData: Cloud.JsonScript[] = [];
    private prevGalleries: pxt.CodeCard[] = [];

    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            searchFor: '',
            visible: false
        }
    }

    hide() {
        this.setState({ visible: false });
    }

    showAddPackages() {
        this.setState({ visible: true, searchFor: '' })
    }

    fetchGhData(): pxt.github.GitRepo[] {
        const cloud = pxt.appTarget.cloud || {};
        if (!cloud.packages) return [];
        let searchFor = cloud.githubPackages ? this.state.searchFor : undefined;
        let res: pxt.github.GitRepo[] =
            searchFor || cloud.preferredPackages
                ? this.getData(`gh-search:${searchFor || cloud.preferredPackages.join('|')}`)
                : null
        if (res) this.prevGhData = res
        return this.prevGhData || []
    }

    fetchBundled(): pxt.PackageConfig[] {
        if (!!this.state.searchFor) return [];

        const bundled = pxt.appTarget.bundledpkgs;
        return Object.keys(bundled).filter(k => !/prj$/.test(k))
            .map(k => JSON.parse(bundled[k]["pxt.json"]) as pxt.PackageConfig);
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ScriptSearchState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.searchFor != nextState.searchFor;
    }

    renderCore() {
        const bundles = this.fetchBundled();
        const ghdata = this.fetchGhData();

        const chgHeader = (hdr: pxt.workspace.Header) => {
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
        const installGh = (scr: pxt.github.GitRepo) => {
            pxt.tickEvent("packages.github");
            this.hide();
            let p = pkg.mainEditorPkg();
            core.showLoading(lf("downloading package..."));
            pxt.packagesConfigAsync()
                .then(config => pxt.github.latestVersionAsync(scr.fullName, config))
                .then(tag => pxt.github.pkgConfigAsync(scr.fullName, tag)
                    .then(cfg => addDepIfNoConflict(cfg, "github:" + scr.fullName + "#" + tag)))
                .catch(core.handleNetworkError)
                .finally(() => core.hideLoading());
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
        const isEmpty = () => {
            if (this.state.searchFor) {
                if (bundles.length > 0
                    || ghdata.length > 0)
                    return false;
                return true;
            }
            return false;
        }

        const headerText = lf("Add Package...");
        return (
            <sui.Modal open={this.state.visible} dimmer={true} header={headerText} className="searchdialog" size="large"
                onClose={() => this.setState({ visible: false }) }
                closeIcon={true}
                closeOnDimmerClick>
                <div className="ui vertical segment">
                    <div className="ui search">
                        <div className="ui fluid action input" role="search">
                            <input ref="searchInput" type="text" placeholder={lf("Search...") } onKeyUp={kupd} />
                            <button title={lf("Search") } className="ui right icon button" onClick={upd}>
                                <i className="search icon"></i>
                            </button>
                        </div>
                    </div>
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
                    </div>
                    { isEmpty() ?
                        <div className="ui items">
                            <div className="ui item">
                                {lf("We couldn't find any packages matching '{0}'", this.state.searchFor) }
                            </div>
                        </div>
                        : undefined }
                </div>
            </sui.Modal >
        );
    }
}
