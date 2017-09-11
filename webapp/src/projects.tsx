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

interface ProjectsProps extends ISettingsProps {
    hasGettingStarted: boolean;
}

interface ProjectsState {
    searchFor?: string;
    visible?: boolean;
    tab?: string;
    isInitialStartPage?: boolean;
    resumeProject?: pxt.workspace.Header;
    welcomeDescription?: string;
}

const WELCOME = "__welcome";
const MYSTUFF = "__mystuff";

export class Projects extends data.Component<ProjectsProps, ProjectsState> {
    private prevGhData: pxt.github.GitRepo[] = [];
    private prevUrlData: Cloud.JsonScript[] = [];
    private prevGalleries: pxt.Map<pxt.CodeCard[]> = {};
    private galleryFetchErrors: { [tab: string]: boolean } = {};

    constructor(props: ProjectsProps) {
        super(props)
        this.state = {
            visible: false,
            tab: MYSTUFF
        }
    }

    hide(closeOnly: boolean = false) {
        if (this.state.isInitialStartPage && closeOnly) {
            // If this was the initial start page and the dialog was close without a selection being made, load the
            // previous project if available or create a new one
            pxt.tickEvent("projects.welcome.hide");
            if (this.state.resumeProject) {
                this.props.parent.loadHeaderAsync(this.state.resumeProject);
            } else {
                this.props.parent.newProject();
            }
        }
        this.setState({ visible: false, isInitialStartPage: false });
    }

    showInitialStartPage(resumeProject?: pxt.workspace.Header) {
        this.setState({
            visible: true,
            tab: WELCOME,
            isInitialStartPage: true,
            resumeProject
        });
    }

    showOpenProject(tab?: string) {
        const gals = pxt.appTarget.appTheme.galleries || {};
        tab = (!tab || !gals[tab]) ? MYSTUFF : tab;
        this.setState({ visible: true, tab: tab || MYSTUFF });
    }

    showOpenTutorials() {
        const gals = Object.keys(pxt.appTarget.appTheme.galleries || {});
        this.setState({ visible: true, tab: gals[0] || MYSTUFF });
    }

    fetchGallery(tab: string, path: string): pxt.CodeCard[] {
        if (this.state.tab != tab) return [];

        let res = this.getData(`gallery:${encodeURIComponent(path)}`) as gallery.Gallery[];
        if (res) {
            if (res instanceof Error) {
                this.galleryFetchErrors[tab] = true;
            } else {
                this.prevGalleries[path] = Util.concat(res.map(g => g.cards));
            }
        }
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
            || this.state.searchFor != nextState.searchFor
            || this.state.welcomeDescription != nextState.welcomeDescription;
    }

    private numDaysOld(d1: number) {
        let diff = Math.abs((Date.now() / 1000) - d1);
        return Math.floor(diff / (60 * 60 * 24));
    }

    renderCore() {
        const {visible, tab} = this.state;

        const theme = pxt.appTarget.appTheme;
        const galleries = theme.galleries || {};
        const galleryNames = Object.keys(galleries);
        const tabs = (pxt.appTarget.appTheme.useStartPage ? [WELCOME, MYSTUFF] : [MYSTUFF]).concat(Object.keys(galleries));

        // lf("Make")
        // lf("Code")
        // lf("Projects")
        // lf("Examples")
        // lf("Tutorials")

        const headers = this.fetchLocalData();
        const urldata = this.fetchUrlData();
        this.galleryFetchErrors = {};
        const gals = Util.mapMap(galleries, k => this.fetchGallery(k, galleries[k]));

        const chgHeader = (hdr: pxt.workspace.Header) => {
            pxt.tickEvent(tab == WELCOME ? "projects.welcome.resume" : "projects.header");
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
                    else {
                        if (scr.youTubeId && !scr.url)
                            window.open('https://youtu.be/' + scr.youTubeId, 'yt');
                        else this.props.parent.newEmptyProject(scr.name.toLowerCase(), scr.url);
                    }
            }
        }

        const chgCode = (scr: pxt.CodeCard, loadBlocks?: boolean) => {
            core.showLoading(lf("Loading..."));
            gallery.loadExampleAsync(scr.name.toLowerCase(), scr.url)
                .done(opts => {
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
        const newProject = () => {
            pxt.tickEvent(tab == WELCOME ? "projects.welcome.new" : "projects.new");
            this.hide();
            this.props.parent.newProject();
        }
        const renameProject = () => {
            pxt.tickEvent("projects.rename");
            this.hide();
            this.props.parent.setFile(pkg.mainEditorPkg().files[pxt.CONFIG_NAME])
        }
        const resume = () => {
            if (this.state.isInitialStartPage) {
                chgHeader(this.state.resumeProject);
            } else {
                // The msot recent project is already loaded in the editor, so this is a no-op
                this.hide();
            }
        }
        const gettingStarted = () => {
            pxt.tickEvent("projects.welcome.gettingstarted");
            this.hide();
            this.props.parent.gettingStarted();
        }
        const loadProject = () => {
            pxt.tickEvent("projects.welcome.loadproject");
            this.setState({ tab: MYSTUFF });
        }
        const projectGalleries = () => {
            pxt.tickEvent("projects.welcome.galleries");
            this.setState({ tab: galleryNames[0] })
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

        const hadFetchError = this.galleryFetchErrors[tab];
        const isLoading = tab != WELCOME && tab != MYSTUFF && !hadFetchError && !gals[tab].length;

        const tabClasses = sui.cx([
            isLoading ? 'loading' : '',
            'ui segment bottom attached tab active tabsegment'
        ]);

        return (
            <sui.Modal open={visible} className="projectsdialog" size="fullscreen" closeIcon={false}
                onClose={() => this.hide(/* closeOnly */ true) } dimmer={true}
                closeOnDimmerClick>
                <sui.Segment inverted={targetTheme.invertedMenu} attached="top">
                    <sui.Menu inverted={targetTheme.invertedMenu} secondary>
                        {tabs.map(t => {
                            let name: string;
                            if (t == MYSTUFF) name = lf("My Stuff");
                            else if (t == WELCOME) name = lf("Welcome!");
                            else name = Util.rlf(t);
                            return (<sui.MenuItem key={`tab${t}`} active={tab == t} name={name} onClick={() => this.setState({ tab: t }) } />)
                        }) }
                        <div className="right menu">
                            <sui.Button
                                icon='close'
                                class={`huge clear ${targetTheme.invertedMenu ? 'inverted' : ''}`}
                                onClick={() => this.hide(/* closeOnly */ true) } />
                        </div>
                    </sui.Menu>
                </sui.Segment>
                {tab == WELCOME ? <div className={tabClasses}>
                    <div className="ui stackable two column grid welcomegrid">
                        <div className="six wide column labelsgroup">
                            <h2 className="editorname">{pxt.appTarget.name}</h2>
                            <div className={"large ui loader editoravatar"}></div>
                        </div>
                        <div className="group ten wide column">
                            <div className="ui cards centered">
                                {this.state.resumeProject ? <codecard.CodeCardView
                                    key={'resume'}
                                    iconColor="teal"
                                    iconContent={lf("Resume") }
                                    description={lf("Load the last project you worked on") }
                                    onClick={() => resume() }
                                    /> : undefined}
                                {pxt.appTarget.appTheme.sideDoc ? <codecard.CodeCardView
                                    key={'gettingstarted'}
                                    iconColor="green"
                                    iconContent={lf("Getting started") }
                                    description={lf("Create a fun, beginner project in a guided tutorial") }
                                    onClick={() => gettingStarted() }
                                    /> : undefined}
                                <codecard.CodeCardView
                                    key={'newproject'}
                                    iconColor="brown"
                                    iconContent={lf("New project") }
                                    description={lf("Start a new, empty project") }
                                    onClick={() => newProject() }
                                    />
                                <codecard.CodeCardView
                                    key={'loadproject'}
                                    iconColor="grey"
                                    iconContent={lf("Load project") }
                                    description={lf("Load a previous project") }
                                    onClick={() => loadProject() }
                                    />
                                {galleryNames.length > 0 ? <codecard.CodeCardView
                                    key={'projectgalleries'}
                                    iconColor="orange"
                                    iconContent={lf("Project galleries") }
                                    description={lf("Browse guided tutorials, project samples and awesome activities") }
                                    onClick={() => projectGalleries() }
                                    /> : undefined}
                            </div>
                        </div>
                    </div>
                </div> : undefined }
                {tab == MYSTUFF ? <div className={tabClasses}>
                    <div className="group">
                        <div className="ui cards">
                            <codecard.CodeCardView
                                key={'newproject'}
                                icon="file outline"
                                iconColor="primary"
                                name={lf("New Project...") }
                                description={lf("Creates a new empty project") }
                                onClick={() => newProject() }
                                />
                            {pxt.appTarget.compile ?
                                <codecard.CodeCardView
                                    key={'import'}
                                    icon="upload"
                                    iconColor="secondary"
                                    name={lf("Import File...") }
                                    description={lf("Open files from your computer") }
                                    onClick={() => importHex() }
                                    /> : undefined }
                            {pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.publishing && pxt.appTarget.cloud.importing ?
                                <codecard.CodeCardView
                                    key={'importurl'}
                                    icon="cloud download"
                                    iconColor="secondary"
                                    name={lf("Import URL...") }
                                    description={lf("Open a shared project URL") }
                                    onClick={() => importUrl() }
                                    /> : undefined }
                        </div>
                    </div>
                    {headersGrouped.filter(g => g.headers.length != 0).map(headerGroup =>
                        <div key={'localgroup' + headerGroup.name} className="group">
                            <h3 className="ui dividing header disabled">
                                {headerGroup.name}
                            </h3>
                            <div className="ui cards">
                                {headerGroup.headers.map(scr =>
                                    <codecard.CodeCardView
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
                        <div className="ui cards">
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
                    </div>
                </div> : undefined }
                {tab != MYSTUFF && tab != WELCOME ? <div className={tabClasses}>
                    {hadFetchError ?
                        <p className="ui red inverted segment">{lf("Oops! There was an error. Please ensure you are connected to the Internet and try again.") }</p>
                        : <div className="ui cards centered">
                            {gals[tab].map(scr => <codecard.CodeCardView
                                key={tab + scr.name}
                                name={scr.name}
                                description={scr.description}
                                url={scr.url}
                                imageUrl={scr.imageUrl}
                                youTubeId={scr.youTubeId}
                                onClick={() => chgGallery(scr) }
                                />
                            ) }
                        </div>}
                </div> : undefined }
                { isEmpty() ?
                    <div className="ui items">
                        <div className="ui item">
                            {lf("We couldn't find any projects matching '{0}'", this.state.searchFor) }
                        </div>
                    </div>
                    : undefined }
            </sui.Modal >
        );
    }
}
