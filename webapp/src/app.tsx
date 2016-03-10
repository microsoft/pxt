/// <reference path="../../built/kindlib.d.ts"/>

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
                {this.props.parent.appTarget.cloud ?
                    <sui.Button class={btnClass} onClick={save}
                        icon={"cloud " + (needsUpload ? "upload" : "") }
                        popup={btnClass ? lf("Uploading...") : needsUpload ? lf("Will upload. Click to sync.") : lf("Stored in the cloud. Click to sync.") }
                        />
                    : ""}
            </div>
        );
    }
}

class ScriptSearch extends data.Component<ISettingsProps, { searchFor: string; }> {
    prevData: Cloud.JsonScript[] = [];
    modal: sui.Modal;

    renderCore() {
        Util.assert(this.props.parent.appTarget.cloud);

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
        
        this.appTarget = pkg.appTarget;

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

        this.stopSimulator(true);
        blocklyloader.cleanBlocks();
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

    stopSimulator(unload = false) {
        simulator.Simulator.stop(unload)

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
                                    {this.appTarget.cloud ? <sui.Item icon="share alternate" text={lf("Publish/share") } onClick={() => this.publish() } /> : ""}
                                    {this.appTarget.cloud ? <sui.Item icon="search" text={lf("Search for scripts") } onClick={() => this.scriptSearch.modal.show() } /> : ""}
                                    <div className="divider"></div>
                                    <sui.Item icon='trash' text={lf("Delete project") } onClick={() => this.removeProject() } />
                                </sui.DropdownMenu>
                            </div>
                        </div>
                        <div className="ui item landscape only">
                            <SlotSelector parent={this} />
                        </div>
                        <div id="actionbar" className="ui item">
                            <sui.Button key='runbtn' class='icon primary portrait only' icon={this.state.running ? "stop" : "play"} text={this.state.running ? lf("Stop") : lf("Run") } onClick={() => this.state.running ? this.stopSimulator() : this.runSimulator() } />
                            {this.appTarget.compile ? <sui.Button class='icon primary portrait only' icon='download' onClick={() => this.compile() } /> : "" }
                            {this.editor.menu() }
                        </div>
                        { this.appTarget.cloud ?
                            <div className="ui item right">
                                <LoginBox />
                            </div> : "" }
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
                        <sui.Button key='runbtn' class='primary' icon={this.state.running ? "stop" : "play"} text={this.state.running ? lf("Stop") : lf("Run") } onClick={() => this.state.running ? this.stopSimulator() : this.runSimulator() } />
                        {this.appTarget.compile ? <sui.Button class='primary' icon='download' text={lf("Compile") } onClick={() => this.compile() } /> : ""}
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
                {this.appTarget.cloud ? <ScriptSearch parent={this} ref={v => this.scriptSearch = v} /> : ""}
                <div id="footer">
                    <div>
                        <a href="https://github.com/Microsoft/kindscript">KindScript</a> - (c) Microsoft Corporation - 2016 - <span>{currentReleaseId}</span>
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
        <path fill="#ff7d00" d="M 48.7156,57.6831C 48.7156,59.6258 48.0158,61.2801 46.6154,62.6473C 45.2156,64.0145 43.5373,64.6974 41.5809,64.6974C 39.6251,64.6974 37.9663,64.0145 36.6069,62.6473C 35.2469,61.2801 34.5665,59.6258 34.5665,57.6831C 34.5665,55.7 35.2469,54.0151 36.6069,52.6291C 37.9663,51.2417 39.6251,50.5483 41.5809,50.5483C 43.5373,50.5483 45.2156,51.2417 46.6154,52.6291C 48.0158,54.0151 48.7156,55.7 48.7156,57.6831 Z M 93.4324,57.6831C 93.4324,59.6258 92.7326,61.2801 91.3322,62.6473C 89.9324,64.0145 88.2541,64.6975 86.2977,64.6975C 84.342,64.6975 82.6831,64.0145 81.3237,62.6473C 79.9637,61.2801 79.2834,59.6258 79.2834,57.6831C 79.2834,55.7001 79.9637,54.0152 81.3237,52.6291C 82.6831,51.2417 84.342,50.5484 86.2977,50.5484C 88.2541,50.5484 89.9324,51.2417 91.3322,52.6291C 92.7326,54.0152 93.4324,55.7001 93.4324,57.6831 Z M 27.2559,102.439C 24.5091,102.43 21.9146,101.831 19.5905,100.725C 13.1421,98.316 9.91797,92.9285 9.91797,84.562L 9.91797,67.4895C 9.91797,59.8329 6.61214,55.8157 4.19718e-006,55.4384L 4.19718e-006,48.4268C 6.61214,48.0494 9.91797,43.9532 9.91797,36.1383L 9.91797,19.5404C 9.91797,9.37168 14.5536,3.54519 23.8242,2.06057C 25.3494,1.70022 26.9508,1.53021 28.5964,1.57473L 38.7526,1.57473L 47.0408,1.64846L 52.7508,1.7383L 54.6969,1.81211L 55.3929,1.81211L 55.883,1.90171L 56.5788,2.13894L 56.9267,2.37624L 57.403,2.77688L 58.1769,3.74197L 58.589,5.74579L 58.589,6.31L 58.4471,6.94785C 58.188,7.86151 57.9905,8.03802 57.687,8.78802L 56.6429,11.4297L 54.4909,16.4758L 54.4128,16.7292L 54.3489,16.8766C 54.36,16.854 54.0537,18.3801 54.619,20.0087C 55.1951,21.6374 56.3283,23.2884 58.1769,24.2535C 60.2427,25.3177 60.3514,25.6929 63.9512,25.4557L 64.0151,25.4557C 66.0281,25.3562 66.8883,24.9043 67.3672,24.5804C 67.7793,24.292 67.7679,24.0291 68.7593,23.2147C 69.7475,22.2752 70.2041,18.9958 69.7252,17.6782L 69.7252,17.6045L 65.9752,6.62079L 65.6912,5.90912L 65.6912,5.18142L 65.9752,3.74197L 66.4512,2.77688L 66.9412,2.21259L 67.3672,1.90171L 68.1912,1.501L 68.7593,1.33743L 69.3773,1.24766L 70.7694,1.24766L 74.8034,1.24766L 78.7736,1.33743L 80.1655,1.33743L 80.6556,1.33743L 100.492,1.33743C 101.943,1.33743 103.352,1.50173 104.702,1.81854C 113.622,3.41709 118.082,9.13641 118.082,18.9767L 118.082,36.0492C 118.082,43.706 121.388,47.7231 128,48.1004L 128,55.112C 121.388,55.4893 118.082,59.5855 118.082,67.4005L 118.082,83.9982C 118.082,93.4771 114.054,99.183 105.998,101.116C 104.675,101.597 103.276,101.928 101.826,102.199L 75.3507,102.125L 77.3747,107.899L 77.3747,107.973C 79.0924,112.808 78.2656,118.729 74.3846,122.4L 74.3066,122.474L 74.1647,122.637C 75.0472,121.961 73.6971,123.301 72.2186,124.33C 70.7625,125.33 68.6632,126.17 65.7485,126.333C 61.3774,126.596 58.8441,125.468 56.9062,124.477L 56.8421,124.403C 53.3397,122.55 51.0347,119.37 49.8822,116.062C 48.7599,112.869 48.543,109.55 49.946,106.534L 50.0241,106.207L 51.48,102.6L 27.2559,102.439 Z M 46.8426,94.8082L 54.2,94.9127L 56.1462,94.9865L 56.8423,94.9865L 57.3322,95.0761L 58.028,95.3133L 58.376,95.5507L 58.8522,95.9513L 59.6261,96.9164L 60.0382,98.9202L 60.0382,99.4844L 59.8963,100.122C 59.6372,101.036 59.4398,101.212 59.1364,101.962L 58.0921,104.604L 55.9401,109.65L 55.862,109.904L 55.7982,110.051C 55.8094,110.028 55.5031,111.554 56.0682,113.183C 56.6445,114.812 57.7775,116.463 59.6261,117.428C 61.6919,118.492 61.8006,118.867 65.4004,118.63L 65.4645,118.63C 67.4774,118.531 68.3377,118.079 68.8164,117.755C 69.2285,117.466 69.2171,117.203 70.2085,116.389C 71.1968,115.45 71.6535,112.17 71.1745,110.853L 71.1745,110.779L 67.4245,99.7952L 67.1405,99.0835L 67.1405,98.3558L 67.4245,96.9164L 67.9004,95.9513L 68.3906,95.3871L 68.8164,95.0761L 69.6405,94.6755L 70.2085,94.5118L 70.8267,94.422L 72.2187,94.422L 76.2528,94.422L 100.335,94.5118C 102.24,94.4408 103.923,93.9845 105.343,93.2599C 108.05,91.4841 109.404,88.2204 109.404,83.4688L 109.404,66.6154C 109.404,58.5692 112.465,53.6271 118.586,51.7889L 118.586,51.5515C 112.465,49.8352 109.404,44.9416 109.404,36.871L 109.404,20.2915C 109.404,16.0553 108.665,13.0273 107.186,11.2074L 106.733,10.7103C 105.016,9.67338 102.865,9.02502 100.493,9.02502L 74.7397,8.95121L 73.9017,8.95121L 75.9258,14.7251L 75.9258,14.799C 77.6435,19.6335 76.8167,25.5547 72.9357,29.2255L 72.8577,29.2994L 72.7157,29.4629C 73.5983,28.7863 72.248,30.1265 70.7695,31.1554C 69.3136,32.1558 67.2143,32.9957 64.2995,33.1591C 59.9284,33.4221 57.395,32.2936 55.4572,31.3029L 55.3932,31.2292C 51.8909,29.376 49.5858,26.196 48.4331,22.8873C 47.3112,19.6944 47.0942,16.3762 48.4971,13.3594L 48.575,13.0324L 50.0311,9.42582L 46.9632,9.35209L 38.7531,9.26225L 28.4548,9.26225C 25.8991,9.18282 23.7018,9.77942 21.954,10.7993C 19.7158,12.6595 18.5967,15.7498 18.5967,20.0701L 18.5967,36.9235C 18.5967,44.9698 15.536,49.912 9.41457,51.7501L 9.41457,51.9876C 15.536,53.7039 18.5967,58.5974 18.5967,66.6678L 18.5967,83.2474C 18.5967,87.4836 19.336,90.5116 20.8146,92.3315C 21.3,92.9286 21.9022,93.4317 22.6216,93.8408C 24.0205,94.4158 25.6138,94.7517 27.3215,94.7517L 46.8426,94.8082 Z "/>

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

export var baseUrl: string;
export var currentReleaseId: string;

$(document).ready(() => {
    let ms = document.getElementById("mainscript");
    if (ms && (ms as HTMLScriptElement).src) {
        let mainJsName = (ms as HTMLScriptElement).src;
        baseUrl = mainJsName.replace(/[^\/]*$/, "");
        let mm = /\/([0-9]{18}[^\/]*)/.exec(mainJsName);
        if (mm) {
            currentReleaseId = mm[1];
            console.log(`releaseid: ${currentReleaseId}`)
        }
    }
    baseUrl = baseUrl || './';

    let lang = /lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
    let ws = /ws=(\w+)/.exec(window.location.href)
    if (ws) workspace.setupWorkspace(ws[1])

    Util.updateLocalizationAsync(baseUrl, lang ? lang[1] : (navigator.userLanguage || navigator.language))
        .then(() => Util.httpGetJsonAsync("/target.json"))
        .then((trgbundle:yelm.TargetBundle) => {
            let cfg:yelm.PackageConfig = JSON.parse(trgbundle.bundledpkgs[trgbundle.corepkg][yelm.configName])
            pkg.appTarget = cfg.target
            pkg.appTarget.bundledpkgs = trgbundle.bundledpkgs
            if (!pkg.appTarget.cloud) Cloud.apiRoot = undefined;
        })
        .then(() => {
            blocklyloader.init();
            return compiler.init();
        })
        .then(() => workspace.initAsync())
        .then(() => {
            $("#loading").remove();
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
