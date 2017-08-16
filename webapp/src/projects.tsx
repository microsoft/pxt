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
import * as compiler from "./compiler";

import * as codecard from "./codecard"
import * as gallery from "./gallery";

type ISettingsProps = pxt.editor.ISettingsProps;

import Cloud = pxt.Cloud;

interface ProjectsState {
    searchFor?: string;
    visible?: boolean;
    tab?: string;
}

const MYSTUFF = "__mystuff";

export class Projects extends data.Component<ISettingsProps, ProjectsState> {
    private prevGhData: pxt.github.GitRepo[] = [];
    private prevUrlData: Cloud.JsonScript[] = [];
    private prevGalleries: pxt.Map<pxt.CodeCard[]> = {};

    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            visible: false,
            tab: MYSTUFF
        }
    }

    hide() {
        this.setState({ visible: false });
    }

    showOpenProject(tab?: string) {
        const gals = pxt.appTarget.appTheme.galleries || {};
        tab = (!tab || !gals[tab]) ? MYSTUFF : tab;
        this.setState({ visible: true, tab: tab || MYSTUFF })
    }

    showOpenTutorials() {
        const gals = Object.keys(pxt.appTarget.appTheme.galleries || {});
        this.setState({ visible: true, tab: gals[0] || MYSTUFF })
    }

    fetchGallery(tab: string, path: string): pxt.CodeCard[] {
        if (this.state.tab != tab) return [];

        let res = this.getData(`gallery:${encodeURIComponent(path)}`) as gallery.Gallery[];
        if (res) this.prevGalleries[path] = Util.concat(res.map(g => g.cards));
        return this.prevGalleries[path] || [];
    }

    fetchUrlData(): Cloud.JsonScript[] {
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

    fetchLocalData(): pxt.workspace.Header[] {
        if (this.state.tab != MYSTUFF) return [];

        let headers: pxt.workspace.Header[] = this.getData("header:*")
        if (this.state.searchFor)
            headers = headers.filter(hdr => hdr.name.toLowerCase().indexOf(this.state.searchFor.toLowerCase()) > -1);
        return headers;
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ProjectsState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.tab != nextState.tab
            || this.state.searchFor != nextState.searchFor;
    }

    private numDaysOld(d1: number) {
        let diff = Math.abs((Date.now() / 1000) - d1);
        return Math.floor(diff / (60 * 60 * 24));
    }

    renderCore() {
        const {visible, tab} = this.state;

        const theme = pxt.appTarget.appTheme;
        const galleries = theme.galleries || {};
        const tabs = [MYSTUFF].concat(Object.keys(galleries));

        // lf("Make")
        // lf("Code")
        // lf("Projects")
        // lf("Examples")
        // lf("Tutorials")

        const headers = this.fetchLocalData();
        const urldata = this.fetchUrlData();
        const gals = Util.mapMap(galleries, k => this.fetchGallery(k, galleries[k]));
        const legacyUrl = workspace.legacyScriptsUrl();

        const chgHeader = (hdr: pxt.workspace.Header) => {
            pxt.tickEvent("projects.header");
            this.hide();
            this.props.parent.loadHeaderAsync(hdr)
        }
        const chgGallery = (scr: pxt.CodeCard) => {
            pxt.tickEvent("projects.gallery", { name: scr.name });
            this.hide();
            switch (scr.cardType) {
                case "example": chgCode(scr, true); break;
                case "codeExample": chgCode(scr, false); break;
                case "tutorial": this.props.parent.startTutorial(scr.url); break;
                default:
                    const m = /^\/#tutorial:([a-z0A-Z0-9\-\/]+)$/.exec(scr.url);
                    if (m) this.props.parent.startTutorial(m[1]);
                    else this.props.parent.newEmptyProject(scr.name.toLowerCase(), scr.url);
            }
        }

        const chgCode = (scr: pxt.CodeCard, loadBlocks?: boolean) => {
            core.showLoading(lf("Loading..."));
            gallery.loadExampleAsync(scr.name.toLowerCase(), scr.url)
                .done(opts => {
                    core.hideLoading();
                    if (opts) {
                        if (loadBlocks) {
                            const ts = opts.filesOverride["main.ts"]
                            compiler.getBlocksAsync()
                                .then(blocksInfo => compiler.decompileSnippetAsync(ts, blocksInfo))
                                .then(resp => {
                                    opts.filesOverride["main.blocks"] = resp
                                    this.props.parent.newProject(opts);
                                })
                        } else {
                            this.props.parent.newProject(opts);
                        }
                    }
                });
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
            core.showLoading(lf("loading project..."));
            workspace.installByIdAsync(scr.id)
                .then(r => this.props.parent.loadHeaderAsync(r))
                .done(() => core.hideLoading())
        }
        const importHex = () => {
            pxt.tickEvent("projects.import");
            this.hide();
            this.props.parent.importFileDialog();
        }
        const importUrl = () => {
            pxt.tickEvent("projects.importurl");
            this.hide();
            this.props.parent.importUrlDialog();
        }
        const importLegacy = () => {
            pxt.tickEvent("projects.importlegacy");
            this.hide();
            window.location.href = legacyUrl;
        }
        const newProject = () => {
            pxt.tickEvent("projects.new");
            this.hide();
            this.props.parent.newProject();
        }
        const renameProject = () => {
            pxt.tickEvent("projects.rename");
            this.hide();
            this.props.parent.setFile(pkg.mainEditorPkg().files[pxt.CONFIG_NAME])
        }
        const isEmpty = () => {
            if (this.state.searchFor) {
                if (headers.length > 0
                    || urldata.length > 0)
                    return false;
                return true;
            }
            return false;
        }

        const targetTheme = pxt.appTarget.appTheme;

        const headersToday = headers.filter(
            (h) => { let days = this.numDaysOld(h.modificationTime); return days == 0; });
        const headersYesterday = headers.filter(
            (h) => { let days = this.numDaysOld(h.modificationTime); return days == 1; });
        const headersThisWeek = headers.filter(
            (h) => { let days = this.numDaysOld(h.modificationTime); return days > 1 && days <= 7; });
        const headersLastWeek = headers.filter(
            (h) => { let days = this.numDaysOld(h.modificationTime); return days > 7 && days <= 14; });
        const headersThisMonth = headers.filter(
            (h) => { let days = this.numDaysOld(h.modificationTime); return days > 14 && days <= 30; });
        const headersOlder = headers.filter(
            (h) => { let days = this.numDaysOld(h.modificationTime); return days > 30; });
        const headersGrouped: { name: string, headers: pxt.workspace.Header[] }[] = [
            { name: lf("Today"), headers: headersToday },
            { name: lf("Yesterday"), headers: headersYesterday },
            { name: lf("This Week"), headers: headersThisWeek },
            { name: lf("Last Week"), headers: headersLastWeek },
            { name: lf("This Month"), headers: headersThisMonth },
            { name: lf("Older"), headers: headersOlder },
        ];

        const isLoading = tab != MYSTUFF && !gals[tab].length;

        const tabClasses = sui.cx([
            isLoading ? 'loading' : '',
            'ui segment bottom attached tab active tabsegment'
        ]);

        return (
            <sui.Modal open={visible} className="projectsdialog" size="fullscreen" closeIcon={false}
                onClose={() => this.setState({ visible: false }) } dimmer={true}
                closeOnDimmerClick closeOnDocumentClick>
                <sui.Segment inverted={targetTheme.invertedMenu} attached="top">
                    <sui.Menu inverted={targetTheme.invertedMenu} secondary>
                        {tabs.map(t =>
                            <sui.MenuItem key={`tab${t}`} id={`${t}tab`} ariaControls={tab == t ? `tab${t}` : undefined} className={tab == t ? "focused" : undefined} active={tab == t} name={t == MYSTUFF ? lf("My Stuff") : Util.rlf(t) } onClick={() => this.setState({ tab: t }) } />) }
                    </sui.Menu>
                </sui.Segment>
                {tab == MYSTUFF ? <div className={tabClasses} id={`tab${tab}`} role="tabpanel" aria-labelledby={`${tab}tab`} aria-hidden="false">
                    <div className="group">
                        <div className="ui cards">
                            <codecard.CodeCardView
                                ariaLabel={lf("Creates a new empty project")}
                                role="button"
                                key={'newproject'}
                                icon="file outline"
                                iconColor="primary"
                                name={lf("New Project...") }
                                description={lf("Creates a new empty project") }
                                onClick={() => newProject() }
                                />
                            {pxt.appTarget.compile ?
                                <codecard.CodeCardView
                                    ariaLabel={lf("Open files from your computer")}
                                    role="button"
                                    key={'import'}
                                    icon="upload"
                                    iconColor="secondary"
                                    name={lf("Import File...") }
                                    description={lf("Open files from your computer") }
                                    onClick={() => importHex() }
                                    /> : undefined }
                            {pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.publishing && pxt.appTarget.cloud.importing ?
                                <codecard.CodeCardView
                                    ariaLabel={lf("Open a shared project URL")}
                                    role="button"
                                    key={'importurl'}
                                    icon="cloud download"
                                    iconColor="secondary"
                                    name={lf("Import URL...") }
                                    description={lf("Open a shared project URL") }
                                    onClick={() => importUrl() }
                                    /> : undefined }
                            { legacyUrl ?
                                <codecard.CodeCardView
                                    ariaLabel={lf("Import old programs")}
                                    role="button"
                                    key={'importlegacy'}
                                    icon="archive"
                                    iconColor="secondary"
                                    name={lf("Import old programs") }
                                    description={lf("from {0}", theme.legacyDomain) }
                                    onClick={() => importLegacy()}
                                    /> : undefined }
                        </div>
                    </div>
                    {headersGrouped.filter(g => g.headers.length != 0).map(headerGroup =>
                        <div key={'localgroup' + headerGroup.name} className="group">
                            <h3 className="ui dividing header disabled">
                                {headerGroup.name}
                            </h3>
                            <div className="ui cards" role={headerGroup.headers.length ? "listbox" : undefined}>
                                {headerGroup.headers.map(scr =>
                                    <codecard.CodeCardView
                                        ariaLabel={scr.name}
                                        role="option"
                                        key={'local' + scr.id}
                                        name={scr.name}
                                        time={scr.recentUse}
                                        imageUrl={scr.icon}
                                        url={scr.pubId && scr.pubCurrent ? "/" + scr.pubId : ""}
                                        onClick={() => chgHeader(scr) }
                                        />
                                ) }
                            </div>
                        </div>
                    ) }
                    <div className="group">
                        <div className="ui cards" role={urldata.length ? "listbox" : undefined}>
                            {urldata.map(scr =>
                                <codecard.CodeCardView
                                    ariaLabel={scr.name}
                                    role="option"
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
                    </div>
                </div> : undefined }
                {tab != MYSTUFF ? <div id={`tab${tab}`} role="tabpanel" aria-labelledby={`${tab}tab`} aria-hidden="false" className={tabClasses}>
                    <div className="ui cards centered" role={gals[tab].length ? "listbox" : undefined}>
                        {gals[tab].map(scr => <codecard.CodeCardView
                            ariaLabel={scr.name}
                            role="option"
                            key={tab + scr.name}
                            name={scr.name}
                            description={scr.description}
                            url={scr.url}
                            imageUrl={scr.imageUrl}
                            onClick={() => chgGallery(scr) }
                            />
                        ) }
                    </div>
                </div> : undefined }
                { isEmpty() ?
                    <div className="ui items">
                        <div className="ui item">
                            {lf("We couldn't find any projects matching '{0}'", this.state.searchFor) }
                        </div>
                    </div>
                    : undefined }
                <sui.Button
                    icon='close'
                    class={`closeIcon huge clear ${targetTheme.invertedMenu ? 'inverted' : ''} focused`}
                    onClick={() => this.setState({ visible: false }) }
                    tabIndex={0}
                    ariaLabel={lf("Close dialog")} />
            </sui.Modal >
        );
    }
}
