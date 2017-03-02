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

enum ProjectsTab {
    MyStuff,
    Make,
    Code
}

interface ProjectsState {
    searchFor?: string;
    visible?: boolean;
    tab?: ProjectsTab;
}

export class Projects extends data.Component<ISettingsProps, ProjectsState> {
    private prevGhData: pxt.github.GitRepo[] = [];
    private prevUrlData: Cloud.JsonScript[] = [];
    private prevMakes: pxt.CodeCard[] = [];
    private prevCodes: pxt.CodeCard[] = [];

    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            visible: false,
            tab: ProjectsTab.MyStuff
        }
    }

    hide() {
        this.setState({ visible: false });
    }

    showOpenProject() {
        this.setState({ visible: true, tab: ProjectsTab.MyStuff })
    }

    fetchMakes(): pxt.CodeCard[] {
        if (this.state.tab != ProjectsTab.Make) return [];

        let res = this.getData(`gallery:${encodeURIComponent(pxt.appTarget.appTheme.projectGallery)}`) as gallery.Gallery[];
        if (res) this.prevMakes = Util.concat(res.map(g => g.cards));
        return this.prevMakes;
    }

    fetchCodes(): pxt.CodeCard[] {
        if (this.state.tab != ProjectsTab.Code) return [];

        let res = this.getData(`gallery:${encodeURIComponent(pxt.appTarget.appTheme.exampleGallery)}`) as gallery.Gallery[];
        if (res) this.prevCodes = Util.concat(res.map(g => g.cards));
        return this.prevCodes;
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
        if (this.state.tab != ProjectsTab.MyStuff) return [];

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

        const tabNames = [
            lf("My Stuff"),
            lf("Make"),
            lf("Code")
        ];
        const headers = this.fetchLocalData();
        const urldata = this.fetchUrlData();
        const makes = this.fetchMakes();
        const codes = this.fetchCodes();

        const chgHeader = (hdr: pxt.workspace.Header) => {
            pxt.tickEvent("projects.header");
            this.hide();
            this.props.parent.loadHeaderAsync(hdr)
        }
        const chgMake = (scr: pxt.CodeCard) => {
            pxt.tickEvent("projects.gallery", { name: scr.name });
            this.hide();
            this.props.parent.newEmptyProject(scr.name.toLowerCase(), scr.url);
        }
        const chgCode = (scr: pxt.CodeCard) => {
            pxt.tickEvent("projects.example", { name: scr.name });
            this.hide();
            core.showLoading(lf("Loading..."));
            gallery.loadExampleAsync(scr.name.toLowerCase(), scr.url)
                .done(opts => {
                    core.hideLoading();
                    if (opts)
                        this.props.parent.newProject(opts);
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
                    || urldata.length > 0)
                    return false;
                return true;
            }
            return false;
        }

        const targetTheme = pxt.appTarget.appTheme;

        const tabs = [ProjectsTab.MyStuff];
        if (pxt.appTarget.appTheme.projectGallery) tabs.push(ProjectsTab.Make);
        if (pxt.appTarget.appTheme.exampleGallery) tabs.push(ProjectsTab.Code);

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
        const headersGrouped: {name: string, headers: pxt.workspace.Header[] }[] = [
            {name: lf("Today"), headers: headersToday},
            {name: lf("Yesterday"), headers: headersYesterday},
            {name: lf("This Week"), headers: headersThisWeek},
            {name: lf("Last Week"), headers: headersLastWeek},
            {name: lf("This Month"), headers: headersThisMonth},
            {name: lf("Older"), headers: headersOlder},
        ];

        const isLoading =
            (tab == ProjectsTab.Make && makes.length == 0) ||
            (tab == ProjectsTab.Code && codes.length == 0);

        const tabClasses = sui.cx([
                isLoading ? 'loading' : '',
                'ui segment bottom attached tab active tabsegment'
            ]);

        return (
            <sui.Modal open={visible} className="projectsdialog" size="fullscreen" closeIcon={true}
                onClose={() => this.setState({ visible: false })} dimmer={true}
                closeOnDimmerClick closeOnDocumentClick>
                <sui.Segment inverted={targetTheme.invertedMenu} attached="top">
                    <sui.Menu inverted={targetTheme.invertedMenu} secondary>
                        {tabs.map(t =>
                        <sui.MenuItem key={`tab${t}`} active={tab == t} name={tabNames[t]} onClick={() => this.setState({ tab: t }) } />) }
                        <div className="right menu">
                            <sui.Button
                                icon='close'
                                class={`clear ${targetTheme.invertedMenu ? 'inverted' : ''}`}
                                onClick={() => this.setState({ visible: false })} />
                        </div>
                    </sui.Menu>
                </sui.Segment>
                {tab == ProjectsTab.MyStuff ? <div className={tabClasses}>
                    <div className="group">
                        <div className="ui cards">
                            <codecard.CodeCardView
                                key={'newproject'}
                                icon="file outline"
                                iconColor="primary"
                                name={lf("New Project...")}
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
                    )}
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
                {tab == ProjectsTab.Make ? <div className={tabClasses}>
                    <div className="ui cards">
                        {makes.map(scr => <codecard.CodeCardView
                            key={'make' + scr.name}
                            name={scr.name}
                            description={scr.description}
                            url={scr.url}
                            imageUrl={scr.imageUrl}
                            onClick={() => chgMake(scr) }
                            />
                        ) }
                    </div>
                </div> : undefined }
                {tab == ProjectsTab.Code ? <div className={tabClasses}>
                    <div className="ui cards">
                        {codes.map(scr => <codecard.CodeCardView
                            key={'code' + scr.name}
                            name={scr.name}
                            description={scr.description}
                            url={scr.url}
                            imageUrl={scr.imageUrl}
                            onClick={() => chgCode(scr) }
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
            </sui.Modal >
        );
    }
}
