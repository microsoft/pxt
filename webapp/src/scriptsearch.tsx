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

    fetchUrlData(): Cloud.JsonScript[] {
        if (!this.state.searchFor) return [];
        let scriptid = pxt.Cloud.parseScriptId(this.state.searchFor)
        if (scriptid) {
            let res = this.getData(`cloud-search:${scriptid}`)
            if (res) {
                if (res.statusCode !== 404)
                    this.prevUrlData = [res];
                else this.prevUrlData = [];
            }
        } else {
            this.prevUrlData = [];
        }
        return this.prevUrlData;
    }

    fetchGhData(): pxt.github.GitRepo[] {
        const cloud = pxt.appTarget.cloud || {};
        if (!cloud.packages) return [];
        const searchFor = cloud.githubPackages ? this.state.searchFor : undefined;
        let preferredPackages: string[] = undefined;
        if (!searchFor) {
            const packageConfig = this.getData("target-config:") as pxt.TargetConfig;
            preferredPackages = packageConfig && packageConfig.packages
                ? packageConfig.packages.preferredRepos
                : undefined;
        }

        const res: pxt.github.GitRepo[] =
            searchFor || preferredPackages
                ? this.getData(`gh-search:${searchFor || preferredPackages.join('|')}`)
                : null
        if (res) this.prevGhData = res
        return this.prevGhData || []
    }

    fetchBundled(): pxt.PackageConfig[] {
        const query = this.state.searchFor;
        const bundled = pxt.appTarget.bundledpkgs;
        return Object.keys(bundled).filter(k => !/prj$/.test(k))
            .map(k => JSON.parse(bundled[k]["pxt.json"]) as pxt.PackageConfig)
            .filter(pk => !query || pk.name.toLowerCase().indexOf(query.toLowerCase()) > -1) // search filter
            .filter(pk => !pkg.mainPkg.deps[pk.name]); // don't show package already referenced
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ScriptSearchState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.searchFor != nextState.searchFor;
    }

    renderCore() {
        if (!this.state.visible) return <div></div>;

        const targetTheme = pxt.appTarget.appTheme;
        const bundles = this.fetchBundled();
        const ghdata = this.fetchGhData();
        const urldata = this.fetchUrlData();

        const addUrl = (scr: pxt.Cloud.JsonScript) => {
            this.hide();
            let p = pkg.mainEditorPkg();
            return p.addDepAsync(scr.name, "pub:" + scr.id)
                .then(() => this.props.parent.reloadHeaderAsync());
        }
        const addBundle = (scr: pxt.PackageConfig) => {
            pxt.tickEvent("packages.bundled", { name: scr.name });
            this.hide();
            addDepIfNoConflict(scr, "*")
                .done();
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
                            // Single conflict: "Package A is..."
                            lf("Package {0} is incompatible with {1}. Remove {0} and add {1}?", conflicts[0].pkg0.id, config.name) :
                            // 2 conflicts: "Packages A and B are..."; 3+ conflicts: "Packages A, B, C and D are..."
                            lf("Packages {0} and {1} are incompatible with {2}. Remove them and add {2}?", conflicts.slice(0, -1).map((c) => c.pkg0.id).join(", "), conflicts.slice(-1)[0].pkg0.id, config.name);

                        addDependencyPromise = addDependencyPromise
                            .then(() => core.confirmAsync({
                                header: lf("Some packages will be removed"),
                                agreeLbl: lf("Remove package(s) and add {0}", config.name),
                                agreeClass: "pink focused",
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
                if (bundles.length || ghdata.length || urldata.length)
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
                helpUrl="/packages"
                closeOnDimmerClick
                description={lf("Add a package to the project") }>
                <div className="ui vertical segment">
                    <div className="ui search">
                        <div className="ui fluid action input" role="search">
                            <input ref="searchInput" className="focused" type="text" placeholder={lf("Search or enter project URL...") } onKeyUp={kupd} />
                            <button title={lf("Search") } className="ui right icon button" onClick={upd}>
                                <i className="search icon"></i>
                            </button>
                            <div aria-live="polite" className="accessible-hidden">{lf("{0} results matching '{1}'", bundles.length + ghdata.length + urldata.length, this.state.searchFor)}</div>
                        </div>
                    </div>
                    <div className="ui cards" role="listbox">
                        {urldata.map(scr =>
                            <codecard.CodeCardView
                                key={'url' + scr.id}
                                name={scr.name}
                                description={scr.description}
                                url={"/" + scr.id}
                                onClick={() => addUrl(scr) }
                                color="red"
                                role="option"
                                />
                        ) }
                        {bundles.map(scr =>
                            <codecard.CodeCardView
                                key={'bundled' + scr.name}
                                name={scr.name}
                                description={scr.description}
                                url={"/" + scr.installedVersion}
                                imageUrl={scr.icon}
                                onClick={() => addBundle(scr) }
                                role="option"
                                />
                        ) }
                        {ghdata.filter(repo => repo.status == pxt.github.GitRepoStatus.Approved).map(scr =>
                            <codecard.CodeCardView
                                name={scr.name.replace(/^pxt-/, "") }
                                description={scr.description}
                                key={'gha' + scr.fullName}
                                onClick={() => installGh(scr) }
                                url={'github:' + scr.fullName}
                                color="blue"
                                imageUrl={pxt.github.repoIconUrl(scr) }
                                label={/\bbeta\b/i.test(scr.description) ? lf("Beta") : undefined}
                                role="option"
                                />
                        ) }
                        {ghdata.filter(repo => repo.status != pxt.github.GitRepoStatus.Approved).map(scr =>
                            <codecard.CodeCardView
                                name={scr.name.replace(/^pxt-/, "") }
                                description={lf("User provided package, not endorsed by Microsoft.") + (scr.description || "") }
                                key={'ghd' + scr.fullName}
                                onClick={() => installGh(scr) }
                                url={'github:' + scr.fullName}
                                color="red"
                                role="option"
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
