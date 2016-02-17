import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as sui from "./sui";
import * as simview from "./simview";
import * as simsvg from "./simsvg"
import * as srceditor from "./srceditor"
import * as compiler from "./compiler"
import {LoginBox} from "./login"

import * as ace from "./ace"
import * as yelmjson from "./yelmjson"
import * as blocks from "./blocks"

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
                        <sui.Dropdown class="selection" value={par.state.theme.fontSize} onChange={fontSize}>
                            {Object.keys(sizes).map(k => <sui.Item key={k} value={k}>{sizes[k]}</sui.Item>) }
                        </sui.Dropdown>
                    </sui.Field>
                </div>
            </sui.Popup>
        );
    }
}

class SlotSelector extends data.Component<ISettingsProps, {}> {
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
                <sui.Dropdown class='selection search' value={hdId}
                    onChange={chgHeader}>
                    {headers.map(h => <sui.Item key={h.id} value={h.id} text={h.name || lf("no name") } />) }
                </sui.Dropdown>

                <sui.Button class={btnClass} onClick={save}
                    icon={"cloud " + (needsUpload ? "upload" : "") }
                    popup={btnClass ? lf("Uploading...") : needsUpload ? lf("Will upload. Click to force.") : lf("Stored in the cloud.") }
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
            <sui.Modal ref={v => this.modal = v} header={lf("Search for scripts...") } addClass="small searchdialog" >
                <div className="ui content form">
                    <div className="ui fluid icon input">
                        <input type="text" placeholder="Search..." onChange={upd} />
                        <i className="search icon"/>
                    </div>
                    <div className="ui relaxed divided list">
                        {data.map(scr =>
                            <div className="item" onClick={() => install(scr) }>
                                <i className="large file middle aligned icon"></i>
                                <div className="content">
                                    <a className="header">{scr.name} /{scr.id}</a>
                                    <div className="description">{Util.timeSince(scr.time) } by {scr.username}</div>
                                </div>
                            </div>
                        ) }
                    </div>
                </div>
            </sui.Modal>
        );
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

    constructor(props: IAppProps) {
        super(props);

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

    private typecheck() {
        compiler.typecheckAsync()
            .then(resp => {
                this.editor.setDiagnostics(this.editorFile)
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
        this.setState({ currFile: fn })
    }

    loadHeader(h: workspace.Header) {
        if (!h)
            return
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

    newProject() {
        let cfg: yelm.PackageConfig = {
            name: lf("{0} bit", Util.getAwesomeAdj()),
            dependencies: { mbit: "*" },
            description: "",
            files: ["main.ts", "README.md"]
        }
        let files: workspace.ScriptText = {
            "yelm.json": JSON.stringify(cfg, null, 4) + "\n",
            "main.ts": `basic.showString("Hi!")\n`,
            "README.md": lf("Describe your project here!")
        }
        workspace.installAsync({
            name: cfg.name,
            meta: {},
            editor: "tsprj",
            pubId: "",
            pubCurrent: false,
        }, files)
            .then(hd => {
                this.loadHeader(hd)
            })
            .done()
    }

    newBlocksProject() {
        let cfg: yelm.PackageConfig = {
            name: lf("{0} block", Util.getAwesomeAdj()),
            dependencies: { mbit: "*" },
            description: "",
            files: ["main.blocks", "main.blocks.ts", "README.md"]
        }
        let files: workspace.ScriptText = {
            "yelm.json": JSON.stringify(cfg, null, 4) + "\n",
            "main.blocks": `<xml xmlns="http://www.w3.org/1999/xhtml">\n</xml>\n`,
            "main.blocks.ts": "\n",
            "README.md": lf("Describe your project here!")
        }
        workspace.installAsync({
            name: cfg.name,
            meta: {},
            editor: "blocksprj",
            pubId: "",
            pubCurrent: false,
        }, files)
            .then(hd => {
                this.loadHeader(hd)
            })
            .done()
    }

    saveTypeScript() {
        if (!this.editor) return
        if (this.editorFile.epkg != pkg.mainEditorPkg())
            return;
        let ts = this.editor.saveToTypeScript()
        if (ts != null) {
            let f = pkg.mainEditorPkg().setFile(this.editorFile.name + ".ts", ts)
            f.isVirtual = true
        }
    }

    compile() {
        compiler.compileAsync()
            .then(resp => {
                this.editor.setDiagnostics(this.editorFile)
                let hex = resp.outfiles["microbit.hex"]
                if (hex) {
                    let fn = "microbit-" + pkg.mainEditorPkg().header.name.replace(/[^a-zA-Z0-9]+/, "-") + ".hex"
                    core.browserDownloadText(hex, fn, "application/x-microbit-hex")
                }
            })
            .done()
    }

    simRuntime: simview.MbitRuntime;

    run() {
        compiler.compileAsync()
            .then(resp => {
                this.editor.setDiagnostics(this.editorFile)
                let js = resp.outfiles["microbit.js"]
                if (js) {
                    if (this.simRuntime)
                        this.simRuntime.kill();
                    let r = new simview.MbitRuntime(js)
                    this.simRuntime = r
                    r.errorHandler = (e: any) => {
                        core.errorNotification(e.message)
                        console.error("Simulator error", e.stack)
                    }
                    r.run(() => {
                        console.log("DONE")
                        rt.dumpLivePointers();
                        core.infoNotification("Done, check console")
                    })
                }
            })
            .done()

    }

    editText() {
        if (this.editor != this.aceEditor)
            this.updateEditorFile(this.aceEditor)
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

    renderCore() {
        theEditor = this;

        if (this.editor && this.editor.isReady) {
            this.setTheme()
            this.updateEditorFile();
        }

        let filesOf = (pkg: pkg.EditorPackage) =>
            pkg.sortedFiles().map(file => {
                let meta: pkg.FileMeta = this.getData("open-meta:" + file.getName())
                return (
                    <a
                        key={file.getName() }
                        onClick={() => this.setFile(file) }
                        className={(this.state.currFile == file ? "active " : "") + (pkg.isTopLevel() ? "" : "nested ") + "item"}
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

        let files = Util.concat(pkg.allEditorPkgs().map(filesWithHeader))

        let isOffline = !this.getData("cloud-online:api")
        let goOnline = () => {
            data.setOnline(true)
            workspace.syncAsync().done();
        }

        let inv = this.state.theme.inverted ? " inverted " : " "
        let filelist: JSX.Element = undefined;
        if (this.state.showFiles)
            filelist = <div className={"ui vertical menu filemenu " + inv}>
                {files}
            </div>
        
        return (
            <div id='root' className={"full-abs " + inv}>
                <div id="menubar">
                    <div className={"ui menu" + inv}>
                        <div className="item">
                            <SlotSelector parent={this} />
                        </div>
                        <div className="item">
                            <sui.Dropdown class="button floating" icon="wrench" menu={true} popup={lf("Project operations")}>
                                <sui.Item icon="terminal" text={lf("New TypeScript project") } onClick={() => this.newProject() } />
                                <sui.Item icon="puzzle" text={lf("New Blocks project") } onClick={() => this.newBlocksProject() } />
                                {this.editor == this.aceEditor ? null :
                                    <sui.Item icon="write" text={lf("Edit text") } onClick={() => this.editText() } />
                                }
                                <div className="divider"></div>
                                <sui.Item icon="share alternate" text={lf("Publish/share") } onClick={() => this.publish() } />
                                <sui.Item icon="cloud download" text={lf("Sync") } onClick={() => workspace.syncAsync().done() } />
                                <sui.Item icon="search" text={lf("Search for scripts") } onClick={() => this.scriptSearch.modal.show() } />
                            </sui.Dropdown>
                            {this.editor.menu()}                            
                            <sui.Button class='red' icon='trash' popup={lf("Delete project")} onClick={() => this.removeProject() } />
                        </div>
                        <div className="item right">
                            {isOffline ?
                                <sui.Button
                                    text={lf("Go online") }
                                    class="green"
                                    onClick={goOnline}
                                    popup={lf("You're offline now.") } />
                                : null}
                            <LoginBox />
                            <Settings parent={this} />
                        </div>
                    </div>
                </div>
                <div id="filelist">
                    <div id="mbitboardview" className="ui vertical">
                        <simview.MbitBoardView ref="simulator" theme={simsvg.randomTheme() } />
                    </div>
                    <div className="item">
                        <sui.Button class='primary' icon='play' text={lf("Run") } onClick={() => this.run() } />
                        <sui.Button class='primary' icon='download' text={lf("Compile") } onClick={() => this.compile() } />
                        <sui.Button icon='folder' onClick={() => {
                            this.setState({ showFiles: !this.state.showFiles });
                            this.saveSettings();
                        } } />
                    </div>
                    {filelist}
                </div>
                <div id="maineditor">
                    {this.allEditors.map(e => e.displayOuter()) }
                </div>
                <ScriptSearch parent={this} ref={v => this.scriptSearch = v} />
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

let myexports: any = {
    workspace,
    require,
    core,
    getEditor,
    ace,
    compiler,
    pkg
};
(window as any).E = myexports;


$(document).ready(() => {
    $("#loading").remove();
    compiler.init()
    workspace.initAsync()
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
