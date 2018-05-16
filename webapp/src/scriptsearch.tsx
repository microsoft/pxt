/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";
import * as pkg from "./package";
import * as core from "./core";
import * as codecard from "./codecard";
import * as electron from "./electron";

type ISettingsProps = pxt.editor.ISettingsProps;

import Cloud = pxt.Cloud;

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
interface ScriptSearchState {
    searchFor?: string;
    visible?: boolean;
}

export class ScriptSearch extends data.Component<ISettingsProps, ScriptSearchState> {
    private prevGhData: pxt.github.GitRepo[] = [];
    private prevUrlData: Cloud.JsonScript[] = [];

    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            searchFor: '',
            visible: false
        }

        this.hide = this.hide.bind(this);
        this.handleSearchKeyUpdate = this.handleSearchKeyUpdate.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.addUrl = this.addUrl.bind(this);
        this.addBundle = this.addBundle.bind(this);
        this.installGh = this.installGh.bind(this);
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

    installGh(scr: pxt.github.GitRepo) {
        pxt.tickEvent("packages.github", { name: scr.fullName });
        this.hide();
        core.showLoading("downloadingpackage", lf("downloading package..."));
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
                        lf("Packages {0} and {1} are incompatible with {2}. Remove them and add {2}?", conflicts.slice(0, -1).map((c) => c.pkg0.id).join(", "), conflicts.slice(-1)[0].pkg0.id, config.name);

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

    renderCore() {
        if (!this.state.visible) return <div></div>;

        const bundles = this.fetchBundled();
        const ghdata = this.fetchGhData();
        const urldata = this.fetchUrlData();

        const coresFirst = (a: pxt.PackageConfig, b: pxt.PackageConfig) => {
            if (a.core != b.core)
                return a.core ? -1 : 1;
            return pxt.Util.strcmp(a.name, b.name)
        }

        bundles.sort(coresFirst)
        const isEmpty = () => {
            if (this.state.searchFor) {
                if (bundles.length || ghdata.length || urldata.length)
                    return false;
                return true;
            }
            return false;
        }

        const headerText = lf("Extensions");
        return (
            <sui.Modal isOpen={this.state.visible} dimmer={true}
                className="searchdialog" size="fullscreen"
                onClose={this.hide}
                closeIcon={true} header={headerText}
                helpUrl="/packages"
                closeOnDimmerClick closeOnEscape
                description={lf("Add a package to the project")}>
                <div className="ui vertical segment">
                    <div className="ui search">
                        <div className="ui fluid action input" role="search">
                            <div aria-live="polite" className="accessible-hidden">{lf("{0} result matching '{1}'", bundles.length + ghdata.length + urldata.length, this.state.searchFor)}</div>
                            <input autoFocus ref="searchInput" type="text" placeholder={lf("Search or enter project URL...")} onKeyUp={this.handleSearchKeyUpdate} />
                            <button title={lf("Search")} className="ui right icon button" onClick={this.handleSearch}>
                                <sui.Icon icon="search" />
                            </button>
                        </div>
                    </div>
                    <div className="ui cards" role="listbox">
                        {urldata.map(scr =>
                            <ScriptSearchCodeCard
                                key={'url' + scr.id}
                                name={scr.name}
                                description={scr.description}
                                url={"/" + scr.id}
                                scr={scr}
                                onCardClick={this.addUrl}
                                color="red"
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
                        {ghdata.filter(repo => repo.status == pxt.github.GitRepoStatus.Approved).map(scr =>
                            <ScriptSearchCodeCard
                                name={scr.name.replace(/^pxt-/, "")}
                                description={scr.description}
                                key={'gha' + scr.fullName}
                                scr={scr}
                                onCardClick={this.installGh}
                                url={'github:' + scr.fullName}
                                color="blue"
                                imageUrl={pxt.github.repoIconUrl(scr)}
                                label={/\bbeta\b/i.test(scr.description) ? lf("Beta") : undefined}
                                role="link"
                            />
                        )}
                        {ghdata.filter(repo => repo.status != pxt.github.GitRepoStatus.Approved).map(scr =>
                            <ScriptSearchCodeCard
                                name={scr.name.replace(/^pxt-/, "")}
                                description={(scr.description || "")}
                                extracontent={lf("User provided package, not endorsed by Microsoft.")}
                                key={'ghd' + scr.fullName}
                                scr={scr}
                                onCardClick={this.installGh}
                                imageUrl={pxt.github.repoIconUrl(scr)}
                                url={'github:' + scr.fullName}
                                color="red"
                                role="link"
                            />
                        )}
                    </div>
                    {isEmpty() ?
                        <div className="ui items">
                            <div className="ui item">
                                {lf("We couldn't find any packages matching '{0}'", this.state.searchFor)}
                            </div>
                        </div>
                        : undefined}
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