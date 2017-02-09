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
    Makes
}

interface ProjectsState {
    searchFor?: string;
    visible?: boolean;
    tab?: ProjectsTab;
}

export class Projects extends data.Component<ISettingsProps, ProjectsState> {
    private prevGhData: pxt.github.GitRepo[] = [];
    private prevUrlData: Cloud.JsonScript[] = [];
    private prevGalleries: pxt.CodeCard[] = [];

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

    fetchGalleries(): pxt.CodeCard[] {
        if (this.state.tab != ProjectsTab.Makes) return [];

        let res = this.getData(`gallery:${encodeURIComponent(pxt.appTarget.appTheme.projectGallery)}`) as gallery.Gallery[];
        if (res) this.prevGalleries = Util.concat(res.map(g => g.cards));
        return this.prevGalleries;
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

    fetchLocalData(): Header[] {
        if (this.state.tab != ProjectsTab.MyStuff) return [];

        let headers: Header[] = this.getData("header:*")
        if (this.state.searchFor)
            headers = headers.filter(hdr => hdr.name.toLowerCase().indexOf(this.state.searchFor.toLowerCase()) > -1);
        return headers;
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: ProjectsState, nextContext: any): boolean {
        return this.state.visible != nextState.visible
            || this.state.tab != nextState.tab
            || this.state.searchFor != nextState.searchFor;
    }

    renderCore() {
        if (!this.state.visible) return null;

        const tab = this.state.tab;
        const tabNames = [
            lf("My Stuff"),
            lf("Makes")
        ];
        const headers = this.fetchLocalData();
        const urldata = this.fetchUrlData();
        const galleries = this.fetchGalleries();

        const chgHeader = (hdr: Header) => {
            pxt.tickEvent("projects.header");
            this.hide();
            this.props.parent.loadHeaderAsync(hdr)
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

        const tabs = [ProjectsTab.MyStuff];
        if (pxt.appTarget.appTheme.projectGallery) tabs.push(ProjectsTab.Makes);

        const headerText = lf("Projects");
        return (
            <sui.Modal visible={this.state.visible} header={headerText} addClass="large searchdialog"
                onHide={() => this.setState({ visible: false }) }>
                <div className="ui pointing secondary menu">
                    {tabs.map(t =>
                        <sui.Item key={`tab${t}`} class={`item ${tab == t ? "active" : ""}`} text={tabNames[t]} onClick={() => this.setState({ tab: t }) } />) }
                </div>
                {tab == ProjectsTab.MyStuff ? <div className="ui bottom attached tab segment active">
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
                    <div className="ui cards">
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
                    </div>
                </div> : undefined }
                {tab == ProjectsTab.Makes ? <div className="ui bottom attached tab segment active">
                    <div className="ui cards">
                        {galleries.map(scr => <codecard.CodeCardView
                            key={'gal' + scr.name}
                            name={scr.name}
                            url={scr.url}
                            imageUrl={scr.imageUrl}
                            onClick={() => chgGallery(scr) }
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
