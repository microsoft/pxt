/// <reference path="../../built/yelmlib.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as sui from "./sui";
import * as simulator from "./simulator";
import * as srceditor from "./srceditor"
import * as compiler from "./compiler"
import * as blocklyloader from "./blocklyloader"
import {LoginBox} from "./login"

import * as ace from "./ace"
import * as yelmjson from "./yelmjson"
import * as blocks from "./blocks"
import * as codecard from "./codecard"
import * as logview from "./logview"

import Cloud = yelm.Cloud;
import Util = yelm.Util;
var lf = Util.lf

export interface FileHistoryEntry {
    id: string;
    name: string;
    pos: srceditor.ViewState;
}

export interface EditorSettings {
    theme: srceditor.Theme;
    showFiles?: boolean;
    fileHistory: FileHistoryEntry[];
}

interface IAppProps { }
interface IAppState {
    header?: workspace.Header;
    currFile?: pkg.File;
    theme?: srceditor.Theme;
    fileState?: string;
    showFiles?: boolean;
    helpCard?: codecard.CodeCardProps;
    running?: boolean;
}


var theEditor: ProjectView;

interface ISettingsProps {
    parent: ProjectView;
    visible?: boolean;
}

class Settings extends data.Component<ISettingsProps, {}> {
    renderCore() {
        let par = this.props.parent
        let sizes: Util.StringMap<string> = {
            '14px': lf("Small"),
            '20px': lf("Medium"),
            '24px': lf("Large"),
        }
        let fontSize = (v: string) => {
            par.state.theme.fontSize = v;
            par.forceUpdate()
        }
        return (
            <sui.Popup icon='settings'>
                <div className='ui form'>
                    <sui.Field>
                        <div className="ui toggle checkbox ">
                            <input type="checkbox" name="public" checked={par.state.theme.inverted} onChange={() => par.swapTheme() } />
                            <label>{lf("Dark theme") }</label>
                        </div>
                    </sui.Field>
                    <sui.Field label="Font size">
                        <sui.DropdownList class="selection" value={par.state.theme.fontSize} onChange={fontSize}>
                            {Object.keys(sizes).map(k => <sui.Item key={k} value={k}>{sizes[k]}</sui.Item>) }
                        </sui.DropdownList>
                    </sui.Field>
                </div>
            </sui.Popup>
        );
    }
}

class SlotSelector extends data.Component<ISettingsProps, {}> {

    componentDidMount() {
        let headers: workspace.Header[] = this.getData("header:*")
        if (!headers.length)
            this.props.parent.newProject(true);
    }

    renderCore() {
        let par = this.props.parent
        let headers: workspace.Header[] = this.getData("header:*")
        let chgHeader = (id: string) => {
            par.loadHeader(workspace.getHeader(id))
        }
        let hd = par.state.header
        let hdId = hd ? hd.id : ""
        let btnClass = !hd || this.getData("pkg-status:" + hdId) == "saving" ? " disabled" : ""
        let save = () => {
            par.saveFileAsync()
                .then(() => par.state.currFile.epkg.savePkgAsync())
                .then(() => {
                    data.setOnline(true)
                    return workspace.syncAsync()
                })
                .done()
        }
        if (!hd && headers[0]) {
            setTimeout(() => {
                if (!par.state.header && headers[0]) {
                    par.loadHeader(headers[0])
                }
            }, 1000)
        }
        let needsUpload = hd && !hd.blobCurrent
        return (
            <div id='slotselector'>
                <sui.DropdownList class='selection search' value={hdId}
                    onChange={chgHeader}>
                    {headers.map(h => <sui.Item key={h.id} value={h.id} text={h.name || lf("no name") } />) }
                </sui.DropdownList>

                <sui.Button class={btnClass} onClick={save}
                    icon={"cloud " + (needsUpload ? "upload" : "") }
                    popup={btnClass ? lf("Uploading...") : needsUpload ? lf("Will upload. Click to sync.") : lf("Stored in the cloud. Click to sync.") }
                    />
            </div>
        );
    }
}

class ScriptSearch extends data.Component<ISettingsProps, { searchFor: string; }> {
    prevData: Cloud.JsonScript[] = [];
    modal: sui.Modal;

    renderCore() {
        let res = this.state.searchFor ?
            this.getData("cloud:scripts?q=" + encodeURIComponent(this.state.searchFor)) : null
        if (res)
            this.prevData = res.items
        let data = this.prevData
        let upd = (v: any) => {
            this.setState({ searchFor: (v.target as any).value })
        };
        let install = (scr: Cloud.JsonScript) => {
            if (this.modal) this.modal.hide();
            workspace.installByIdAsync(scr.id)
                .then(r => {
                    this.props.parent.loadHeader(r)
                })
                .done()
        }
        return (
            <sui.Modal ref={v => this.modal = v} header={lf("Search for scripts...") } addClass="large searchdialog" >

                <div className="ui content form">
                    <div className="ui fluid icon input">
                        <input type="text" placeholder="Search..." onChange={upd} />
                        <i className="search icon"/>
                    </div>
                    <div className="ui three stackable cards">
                        {data.map(scr =>
                            <div className="card" key={scr.id} onClick={() => install(scr) }>
                                <div className="content">
                                    <div className="header">{scr.name}</div>
                                    <div className="meta">
                                        <span className="date">by {scr.username} {Util.timeSince(scr.time) }</span>
                                    </div>
                                </div>
                                <div className="extra content">
                                    <span className="right floated">/{scr.id}</span>
                                    <a>
                                        {Util.timeSince(scr.time) }
                                    </a>
                                </div>
                            </div>
                        ) }
                    </div>
                </div>
            </sui.Modal>
        );
    }
}

class FileList extends data.Component<ISettingsProps, {}> {
    renderCore() {
        let parent = this.props.parent
        if (!parent.state.showFiles)
            return null;

        let filesOf = (pkg: pkg.EditorPackage) =>
            pkg.sortedFiles().map(file => {
                let meta: pkg.FileMeta = this.getData("open-meta:" + file.getName())
                return (
                    <a
                        key={file.getName() }
                        onClick={() => parent.setFile(file) }
                        className={(parent.state.currFile == file ? "active " : "") + (pkg.isTopLevel() ? "" : "nested ") + "item"}
                        >
                        {file.name} {meta.isSaved ? "" : "*"}
                        {meta.isReadonly ? <i className="lock icon"></i> : null}
                        {!meta.numErrors ? null : <span className='ui label red'>{meta.numErrors}</span>}
                    </a>);
            })

        let filesWithHeader = (pkg: pkg.EditorPackage) =>
            pkg.isTopLevel() ? filesOf(pkg) : [
                <div key={"hd-" + pkg.getPkgId() } className="header item">
                    <i className="folder icon"></i>
                    {pkg.getPkgId() }
                </div>
            ].concat(filesOf(pkg))

        let inv = parent.state.theme.inverted ? " inverted " : " "

        return (
            <div className={"ui vertical menu filemenu landscape only " + inv}>
                {Util.concat(pkg.allEditorPkgs().map(filesWithHeader)) }
            </div>
        )
    }
}


export class ProjectView extends data.Component<IAppProps, IAppState> {
    editor: srceditor.Editor;
    editorFile: pkg.File;
    aceEditor: ace.Editor;
    yelmjsonEditor: yelmjson.Editor;
    blocksEditor: blocks.Editor;
    allEditors: srceditor.Editor[] = [];
    settings: EditorSettings;
    scriptSearch: ScriptSearch;
    appTarget: yelm.AppTarget;

    constructor(props: IAppProps) {
        super(props);

        let target = '';
        let m = /target=([a-z0-9]+)/i.exec(window.document.location.href);
        if (m) target = m[1];
        this.appTarget = yelm.appTargets[target] || yelm.appTargets['microbit'];

        this.settings = JSON.parse(window.localStorage["editorSettings"] || "{}")
        if (!this.settings.theme)
            this.settings.theme = {}
        this.state = {
            showFiles: !!this.settings.showFiles,
            theme: {
                inverted: !!this.settings.theme.inverted,
                fontSize: this.settings.theme.fontSize || "20px"
            }
        };
        if (!this.settings.fileHistory) this.settings.fileHistory = []
    }

    swapTheme() {
        this.state.theme.inverted = !this.state.theme.inverted
        this.forceUpdate()
    }

    saveSettings() {
        let sett = this.settings
        sett.theme = this.state.theme
        sett.showFiles = !!this.state.showFiles

        let f = this.editorFile
        if (f && f.epkg.getTopHeader()) {
            let n: FileHistoryEntry = {
                id: f.epkg.getTopHeader().id,
                name: f.getName(),
                pos: this.editor.getViewState()
            }
            sett.fileHistory = sett.fileHistory.filter(e => e.id != n.id || e.name != n.name)
            while (sett.fileHistory.length > 100)
                sett.fileHistory.pop()
            sett.fileHistory.unshift(n)
        }

        window.localStorage["editorSettings"] = JSON.stringify(this.settings)
    }

    componentDidUpdate() {
        this.saveSettings()
        this.editor.domUpdate();
    }

    private setTheme() {
        if (!this.editor) return
        this.editor.setTheme(this.state.theme)
    }

    saveFile() {
        this.saveFileAsync().done()
    }

    saveFileAsync() {
        if (!this.editorFile)
            return Promise.resolve()
        this.saveTypeScript()
        return this.editorFile.setContentAsync(this.editor.getCurrentSource())
    }

    public typecheckNow() {
        this.saveFile();
        this.typecheck()
    }

    private typecheck() {
        let state = this.editor.snapshotState()
        compiler.typecheckAsync()
            .then(resp => {
                this.editor.setDiagnostics(this.editorFile, state)
            })
            .done()
    }

    private initEditors() {
        this.aceEditor = new ace.Editor(this);
        this.yelmjsonEditor = new yelmjson.Editor(this);
        this.blocksEditor = new blocks.Editor(this);

        let hasChangeTimer = false
        let changeHandler = () => {
            if (this.editorFile) this.editorFile.markDirty();
            if (!hasChangeTimer) {
                hasChangeTimer = true
                setTimeout(() => {
                    hasChangeTimer = false;
                    this.saveFile();
                    if (!this.editor.isIncomplete())
                        this.typecheck();
                }, 1000);
            }
        }

        this.allEditors = [this.yelmjsonEditor, this.blocksEditor, this.aceEditor]
        this.allEditors.forEach(e => e.changeCallback = changeHandler)
        this.editor = this.allEditors[this.allEditors.length - 1]
    }

    public componentWillMount() {
        this.initEditors()
    }

    public componentDidMount() {
        this.allEditors.forEach(e => e.prepare())
        this.forceUpdate(); // we now have editors prepared
    }

    private pickEditorFor(f: pkg.File): srceditor.Editor {
        return this.allEditors.filter(e => e.acceptsFile(f))[0]
    }

    private updateEditorFile(editorOverride: srceditor.Editor = null) {
        if (this.state.currFile == this.editorFile && !editorOverride)
            return;
        this.saveSettings();

        this.saveFile(); // before change

        this.editorFile = this.state.currFile;
        this.editor = editorOverride || this.pickEditorFor(this.editorFile)
        this.editor.loadFile(this.editorFile)
        this.allEditors.forEach(e => e.setVisible(e == this.editor))

        this.saveFile(); // make sure state is up to date
        this.typecheck();

        let e = this.settings.fileHistory.filter(e => e.id == this.state.header.id && e.name == this.editorFile.getName())[0]
        if (e)
            this.editor.setViewState(e.pos)
    }

    setFile(fn: pkg.File) {
        this.setState({
            currFile: fn,
            helpCard: undefined
        })
    }

    loadHeader(h: workspace.Header) {
        if (!h)
            return

        this.stopSimulator();
        pkg.loadPkgAsync(h.id)
            .then(() => {
                compiler.newProject();
                let e = this.settings.fileHistory.filter(e => e.id == h.id)[0]
                let main = pkg.getEditorPkg(pkg.mainPkg)
                let file = main.getMainFile()
                if (e)
                    file = main.lookupFile(e.name) || file
                this.setState({
                    header: h,
                    currFile: file
                })
                core.infoNotification(lf("Project loaded: {0}", h.name))
                pkg.getEditorPkg(pkg.mainPkg).onupdate = () => {
                    this.loadHeader(h)
                }
            })
    }

    removeProject() {
        core.confirmDelete(pkg.mainEditorPkg().header.name, () => {
            let curr = pkg.mainEditorPkg().header
            curr.isDeleted = true
            return workspace.saveAsync(curr, {})
                .then(() => {
                    this.loadHeader(workspace.getHeaders()[0])
                })
        })
    }

    newProject(hideCancel = false) {
        let cdn = (window as any).appCdnRoot
        let images = cdn + "images"
        core.confirmAsync({
            header: lf("Create new {0} project", this.appTarget.name),
            hideCancel: hideCancel,
            hideAgree: true,
            onLoaded: (_) => {
                _.find('#newblockproject').click(() => { _.modal('hide'); this.newBlocksProject() })
                _.find('#newtypescript').click(() => { _.modal('hide'); this.newTypeScriptProject() })
                _.find('#newkodu').click(() => { window.location.href = 'https://www.kodugamelab.com/bbc-microbit/' })
                _.find('#newvisualstudiocode').click(() => { _.modal('hide'); this.newVisualStudioProject() })
            },
            htmlBody: `
<div class="ui two column grid">
  <div class="column">
    <div id="newblockproject" class="ui fluid card link">
        <div class="ui image">
            <img src="${images}/newblock.png">
        </div>
        <div class="content">
        <div class="header">Block Editor</div>
        <div class="description">
            ${lf("Drag and Drop Coding")}
        </div>
        </div>
    </div>
  </div>
  <div class="column">
    <div id="newtypescript" class="ui fluid card link">
        <div class="ui image">
            <img class="visible content" src="${images}/newtypescript.png">
        </div>
        <div class="content">
        <div class="header">JavaScript</div>
        <div class="description">
            ${lf("Text based Coding")}
        </div>
        </div>
    </div>
  </div>
</div>`
            + (this.appTarget.koduvscode ? `<div class="ui two column grid">
  <div class="column">
    <div id="newkodu" class="ui fluid card link">
        <div class="image">
        <img src="${images}/newkodu.png">
        </div>
        <div class="content">
        <div class="header">Kodu</div>
        <div class="description">
            ${lf("Tile based Coding")}
        </div>
        </div>
    </div>
  </div>
  <div class="column">
    <div id="newvisualstudiocode" class="ui fluid card link">
        <div class="image">
        <img src="${images}/newvisualstudiocode.png">
        </div>
        <div class="content">
        <div class="header">Visual Studio Code</div>
        <div class="description">
            ${lf("For Professional Developers")}
        </div>
        </div>
    </div>
  </div>
</div>
` : "")
        }).done();
    }

    newVisualStudioProject() {
        core.confirmAsync({
            header: lf("New Visual Studio Code project"),
            htmlBody:
            `<p>${lf("<b>yelm</b> comes with command line tools to integrate into existing editors.")}
${lf("To create an new yelm project, <a href='{0}' target='_blank'>install Node.js</a>, open a console and run:", "https://nodejs.org/en/download/")}</p>
<pre>
[sudo] npm install -g yelm-cli
mkdir myproject && cd myproject
yelm init myproject
</pre>
<p>${lf("<b>Looking for a slick cross-platform editor?</b>")} <a href="https://code.visualstudio.com/" target="_blank">${lf("Try Visual Studio Code!")}</a> ${lf("Run this from your project folder:")}</p>
<pre>
code .
Ctrl+Shift+B
</pre>
`,
            agreeLbl: lf("Got it!"),
            hideCancel: true
        }).done();
    }

    newTypeScriptProject() {
        this.newProjectFromId(this.appTarget.tsprj);
    }

    newBlocksProject() {
        this.newProjectFromId(this.appTarget.blocksprj);
    }

    newProjectFromId(prj: yelm.ProjectTemplate) {
        let cfg = yelm.U.clone(prj.config);
        cfg.name = yelm.U.fmt(cfg.name, Util.getAwesomeAdj());
        let files: workspace.ScriptText = {
            "yelm.json": JSON.stringify(cfg, null, 4) + "\n",
        }
        for (let f in prj.files)
            files[f] = prj.files[f];
        workspace.installAsync({
            name: cfg.name,
            meta: {},
            editor: prj.id,
            pubId: "",
            pubCurrent: false,
        }, files)
            .then(hd => {
                this.loadHeader(hd)
            })
            .done()
    }

    saveTypeScript(open?: boolean) {
        if (!this.editor) return
        if (this.editorFile.epkg != pkg.mainEditorPkg())
            return;
        let ts = this.editor.saveToTypeScript()
        if (ts != null) {
            let f = pkg.mainEditorPkg().setFile(this.editorFile.name + ".ts", ts)
            f.isVirtual = true
            if (open) this.setFile(f);
        }
    }

    openBlocks(file: pkg.File) {
        if (file.isVirtual) {
            var bfname = file.getName().substr(0, file.getName().length - ".ts".length);
            var bfile = pkg.mainEditorPkg().lookupFile(bfname);
            if (bfile) this.setFile(bfile);
        }
    }

    compile() {
        console.log('compiling...')
        let state = this.editor.snapshotState()
        compiler.compileAsync(true)
            .then(resp => {
                console.log('done')
                this.editor.setDiagnostics(this.editorFile, state)
                let hex = resp.outfiles["microbit.hex"]
                if (hex) {
                    let fn = "microbit-" + pkg.mainEditorPkg().header.name.replace(/[^a-zA-Z0-9]+/, "-") + ".hex"
                    console.log('saving ' + fn)
                    core.browserDownloadText(hex, fn, "application/x-microbit-hex")
                } else {
                    console.log('no .hex file produced')
                }
            })
            .done()
    }

    stopSimulator() {
        simulator.Simulator.stop()

        this.setState({ running: false })
    }

    runSimulator() {
        let logs = this.refs["logs"] as logview.LogView;
        logs.clear();
        let state = this.editor.snapshotState()
        compiler.compileAsync()
            .then(resp => {
                this.editor.setDiagnostics(this.editorFile, state)
                let js = resp.outfiles["microbit.js"]
                if (js) {
                    simulator.Simulator.run(
                        pkg.mainPkg.getTarget(),
                        js,
                        resp.enums)
                    this.setState({ running: true })
                }
            })
            .done()

    }

    editText() {
        if (this.editor != this.aceEditor) {
            this.updateEditorFile(this.aceEditor)
            this.forceUpdate();
        }
    }

    publish() {
        let mpkg = pkg.mainPkg
        let epkg = pkg.getEditorPkg(mpkg)
        core.infoNotification(lf("Publishing..."))
        core.showLoading(lf("Publishing..."))
        this.saveFileAsync()
            .then(() => mpkg.filesToBePublishedAsync(true))
            .then(files => {
                if (epkg.header.pubCurrent)
                    return Promise.resolve(epkg.header.pubId)
                let meta = {
                    description: mpkg.config.description,
                    islibrary: false
                }
                return workspace.publishAsync(epkg.header, files, meta)
                    .then(inf => inf.id)
            })
            .finally(core.hideLoading)
            .then(inf => core.shareLinkAsync({
                header: lf("Link to your project"),
                link: "/" + inf
            }))
            .catch(e => {
                core.errorNotification(e.message)
            })
            .done()
    }

    setHelp(helpCard: codecard.CodeCardProps) {
        this.setState({ helpCard: helpCard })
    }

    renderCore() {
        theEditor = this;

        if (this.editor && this.editor.isReady) {
            this.setTheme()
            this.updateEditorFile();
        }

        let inv = this.state.theme.inverted ? " inverted " : " "

        return (
            <div id='root' className={"full-abs " + inv}>
                <div id="menubar">
                    <div className={"ui small menu" + inv}>
                        <span id="logo" className="item">
                            {logoSvg}
                            <span className='name landscape only'>KindScript</span>
                        </span>
                        <div className="ui item">
                            <div className="ui buttons">
                                <sui.Button text={lf("New Project") } onClick={() => this.newProject() } />
                                <sui.DropdownMenu class='floating icon button' icon='dropdown'>
                                    <sui.Item icon="share alternate" text={lf("Publish/share") } onClick={() => this.publish() } />
                                    <sui.Item icon="search" text={lf("Search for scripts") } onClick={() => this.scriptSearch.modal.show() } />
                                    <div className="divider"></div>
                                    <sui.Item icon='trash' text={lf("Delete project") } onClick={() => this.removeProject() } />
                                </sui.DropdownMenu>
                            </div>
                        </div>
                        <div className="ui item landscape only">
                            <SlotSelector parent={this} />
                        </div>
                        <div id="actionbar" className="ui item">
                            <sui.Button key='runbtn' class='icon orange portrait only' icon={this.state.running ? "stop" : "play"} text={this.state.running ? lf("Stop") : lf("Run") } onClick={() => this.state.running ? this.stopSimulator() : this.runSimulator() } />
                            {this.appTarget.compile ? <sui.Button class='icon orange portrait only' icon='download' onClick={() => this.compile() } /> : "" }
                            {this.editor.menu() }
                        </div>
                        <div className="ui item right">
                            <LoginBox />
                        </div>
                    </div>
                </div>
                <div id="filelist" className="ui items">
                    <div id="mbitboardview" className="ui vertical">
                        <simulator.Simulator ref="simulator" />
                    </div>
                    <div className="ui landscape only">
                        <logview.LogView ref="logs" />
                    </div>
                    <div className="ui item landscape only">
                        <sui.Button key='runbtn' class='orange' icon={this.state.running ? "stop" : "play"} text={this.state.running ? lf("Stop") : lf("Run") } onClick={() => this.state.running ? this.stopSimulator() : this.runSimulator() } />
                        {this.appTarget.compile ? <sui.Button class='orange' icon='download' text={lf("Compile") } onClick={() => this.compile() } /> : ""}
                        <sui.Button icon='folder' onClick={() => {
                            this.setState({ showFiles: !this.state.showFiles });
                            this.saveSettings();
                        } } />
                    </div>
                    <FileList parent={this} />
                </div>
                <div id="maineditor">
                    {this.allEditors.map(e => e.displayOuter()) }
                    {this.state.helpCard ? <div id="helpcard"><codecard.CodeCard responsive={true} {...this.state.helpCard} /></div> : null }
                </div>
                <ScriptSearch parent={this} ref={v => this.scriptSearch = v} />
                <div id="footer">
                    <div>
                        <a href="https://github.com/Microsoft/yelm">yelm</a> - (c) Microsoft Corporation - 2016 - EXPERIMENTAL
                        | <a href="https://www.microsoft.com/en-us/legal/intellectualproperty/copyright/default.aspx">terms of use</a>
                        | <a href="https://privacy.microsoft.com/en-us/privacystatement">privacy</a>
                    </div>
                </div>
            </div>
        );
    }
}


function render() {
    ReactDOM.render(<ProjectView/>, $('#content')[0])
}

function getEditor() {
    return theEditor
}

var logoSvg = (
    <svg id='logosvg' viewBox="0 0 128 128" preserveAspectRatio="xMinYMin">
        <path fill="#666666" d="M 27.2559,102.648C 24.5092,102.639 21.9146,102.04 19.5905,100.934C 13.1421,98.5251 9.91798,93.1376 9.91798,84.7711L 9.91798,67.6985C 9.91798,60.0419 6.61209,56.0248 6.72909e-005,55.6474L 6.72909e-005,48.6358C 6.61209,48.2585 9.91798,44.1623 9.91798,36.3473L 9.91798,19.7494C 9.91798,9.58075 14.5536,3.75426 23.8242,2.26965C 25.3495,1.90925 26.9508,1.73926 28.5964,1.78378L 38.7526,1.78378L 47.0408,1.85748L 52.7508,1.9473L 54.6969,2.02112L 55.3929,2.02112L 55.8829,2.11073L 56.5788,2.34796L 56.9268,2.5853L 57.403,2.98595L 58.177,3.95102L 58.589,5.95483L 58.589,6.51902L 58.4471,7.1569C 58.188,8.07053 57.9905,8.24709 57.687,8.99707L 56.643,11.6388L 54.4908,16.6848L 54.4128,16.9382L 54.3489,17.0857C 54.36,17.0631 54.0538,18.5891 54.619,20.2178C 55.1952,21.8464 56.3283,23.4975 58.177,24.4625C 60.2427,25.5268 60.3514,25.9019 63.9511,25.6647L 64.0151,25.6647C 66.0282,25.5653 66.8884,25.1133 67.3671,24.7895C 67.7792,24.5011 67.768,24.2381 68.7592,23.4238C 69.7476,22.4843 70.2041,19.2049 69.7253,17.8872L 69.7253,17.8135L 65.9753,6.82983L 65.6912,6.11814L 65.6912,5.39042L 65.9753,3.95102L 66.4512,2.98595L 66.9412,2.42165L 67.3671,2.11073L 68.1913,1.71008L 68.7592,1.54642L 69.3773,1.4567L 70.7694,1.4567L 74.8034,1.4567L 78.7736,1.54642L 80.1655,1.54642L 80.6555,1.54642L 100.492,1.54642C 101.943,1.54642 103.352,1.71078 104.702,2.02758C 113.622,3.62614 118.082,9.34548 118.082,19.1857L 118.082,36.2583C 118.082,43.915 121.388,47.9321 128,48.3095L 128,55.321C 121.388,55.6984 118.082,59.7946 118.082,67.6095L 118.082,84.2073C 118.082,93.6862 114.054,99.3921 105.998,101.325C 104.675,101.806 103.276,102.137 101.826,102.408L 75.3507,102.335L 77.3746,108.108L 77.3746,108.182C 79.0924,113.017 78.2656,118.938 74.3846,122.609L 74.3066,122.683L 74.1646,122.846C 75.0473,122.17 73.697,123.51 72.2186,124.539C 70.7626,125.539 68.6633,126.379 65.7485,126.542C 61.3774,126.805 58.844,125.677 56.9063,124.686L 56.8421,124.613C 53.3398,122.759 51.0347,119.579 49.8822,116.271C 48.76,113.078 48.5429,109.759 49.946,106.743L 50.0241,106.416L 51.48,102.809L 27.2559,102.648 Z "
            />
        <path fill="#FFE746" d="M 46.8426,95.0172L 54.2,95.1217L 56.1461,95.1955L 56.8423,95.1955L 57.3321,95.2852L 58.0281,95.5224L 58.376,95.7597L 58.8522,96.1604L 59.6262,97.1254L 60.0383,99.1293L 60.0383,99.6934L 59.8964,100.331C 59.6372,101.245 59.4397,101.422 59.1363,102.171L 58.0922,104.813L 55.9401,109.859L 55.862,110.113L 55.7981,110.26C 55.8094,110.238 55.503,111.764 56.0683,113.392C 56.6445,115.021 57.7775,116.672 59.6262,117.637C 61.692,118.701 61.8006,119.076 65.4004,118.839L 65.4645,118.839C 67.4774,118.74 68.3377,118.288 68.8164,117.964C 69.2285,117.675 69.2172,117.413 70.2085,116.598C 71.1968,115.659 71.6534,112.379 71.1745,111.062L 71.1745,110.988L 67.4245,100.004L 67.1404,99.2926L 67.1404,98.5648L 67.4245,97.1254L 67.9005,96.1604L 68.3906,95.5961L 68.8164,95.2852L 69.6405,94.8845L 70.2085,94.7209L 70.8266,94.6311L 72.2187,94.6311L 76.2528,94.6311L 100.335,94.7209C 102.24,94.6499 103.924,94.1935 105.343,93.469C 108.05,91.6931 109.404,88.4294 109.404,83.6778L 109.404,66.8244C 109.404,58.7782 112.465,53.8361 118.586,51.998L 118.586,51.7605C 112.465,50.0442 109.404,45.1506 109.404,37.08L 109.404,20.5005C 109.404,16.2643 108.665,13.2363 107.186,11.4164L 106.733,10.9193C 105.016,9.88245 102.865,9.23407 100.492,9.23407L 74.7398,9.16026L 73.9017,9.16026L 75.9258,14.9342L 75.9258,15.0081C 77.6435,19.8425 76.8167,25.7638 72.9356,29.4345L 72.8577,29.5084L 72.7157,29.6719C 73.5983,28.9954 72.248,30.3355 70.7696,31.3644C 69.3136,32.3648 67.2143,33.2047 64.2995,33.3682C 59.9284,33.6311 57.395,32.5026 55.4573,31.512L 55.3933,31.4383C 51.8909,29.5851 49.5857,26.405 48.4332,23.0964C 47.3112,19.9034 47.0942,16.5852 48.497,13.5684L 48.5751,13.2415L 50.0311,9.63483L 46.9633,9.56113L 38.7531,9.47131L 28.4547,9.47131C 25.899,9.39184 23.7019,9.98843 21.954,11.0083C 19.7157,12.8685 18.5967,15.9588 18.5967,20.2791L 18.5967,37.1326C 18.5967,45.1789 15.536,50.121 9.41463,51.9591L 9.41463,52.1966C 15.536,53.9129 18.5967,58.8065 18.5967,66.8769L 18.5967,83.4565C 18.5967,87.6927 19.336,90.7206 20.8147,92.5405C 21.2999,93.1377 21.9021,93.6408 22.6215,94.0499C 24.0205,94.6248 25.6137,94.9607 27.3215,94.9607L 46.8426,95.0172 Z "
            />
        <path fill="#666666" d="M 48.7155,57.8918C 48.7155,59.8345 48.0155,61.4893 46.6154,62.8562C 45.2153,64.2231 43.537,64.9061 41.5809,64.9061C 39.6247,64.9061 37.9664,64.2231 36.6065,62.8562C 35.2466,61.4893 34.5666,59.8345 34.5666,57.8918C 34.5666,55.9091 35.2466,54.2238 36.6065,52.8376C 37.9664,51.4507 39.6247,50.7572 41.5809,50.7572C 43.537,50.7572 45.2153,51.4507 46.6154,52.8376C 48.0155,54.2238 48.7155,55.9091 48.7155,57.8918 Z M 93.4323,57.8918C 93.4323,59.8345 92.7323,61.4893 91.3322,62.8562C 89.9322,64.2231 88.2538,64.9061 86.2977,64.9061C 84.3415,64.9061 82.6832,64.2231 81.3233,62.8562C 79.9634,61.4893 79.2834,59.8345 79.2834,57.8918C 79.2834,55.9091 79.9634,54.2238 81.3233,52.8376C 82.6832,51.4507 84.3415,50.7572 86.2977,50.7572C 88.2538,50.7572 89.9322,51.4507 91.3322,52.8376C 92.7323,54.2238 93.4323,55.9091 93.4323,57.8918 Z"
            />
    </svg>
)

// This is for usage from JS console
let myexports: any = {
    workspace,
    require,
    core,
    getEditor,
    ace,
    compiler,
    pkg,
    apiAsync: core.apiAsync
};
(window as any).E = myexports;


$(document).ready(() => {
    $("#loading").remove();
    $("#logosvg")
    var lang = /lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
    var ws = /ws=(\w+)/.exec(window.location.href)
    if (ws) workspace.setupWorkspace(ws[1])

    Util.updateLocalizationAsync(lang ? lang[1] : (navigator.userLanguage || navigator.language))
        .then(() => {
            blocklyloader.init();
            return compiler.init();
        })
        .then(() => workspace.initAsync())
        .then(() => {
            render()
            workspace.syncAsync().done()
        })
        .then(() => {
            let ent = theEditor.settings.fileHistory.filter(e => !!workspace.getHeader(e.id))[0]
            let hd = workspace.getHeaders()[0]
            if (ent)
                hd = workspace.getHeader(ent.id)
            theEditor.loadHeader(hd)
        })

    window.addEventListener("unload", ev => {
        if (theEditor && !LoginBox.signingOut)
            theEditor.saveSettings()
    })
})
