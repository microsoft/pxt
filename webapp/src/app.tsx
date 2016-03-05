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

interface IProjectTemplate {
    id:string;
    config: yelm.PackageConfig;
    files: workspace.ScriptText;
}

interface IAppTarget {
    id: string;
    name: string;
    blocksprj: IProjectTemplate;
    tsprj: IProjectTemplate;
    compile?: boolean;
    koduvscode?: boolean;
}

var appTargets: yelm.U.Map<IAppTarget> = {
    microbit: {
        id: "microbit",
        name: lf("BBC micro:bit"),
        blocksprj: {
            id:"blocksprj",
            config: {
                name: lf("{0} block"),
                dependencies: {
                    "microbit": "*",
                    "microbit-led": "*",
                    "microbit-music": "*",
                    "microbit-radio": "*",
                    "microbit-game": "*",
                    "microbit-pins": "*",
                    "microbit-serial": "*"
                },
                description: "",
                files: ["main.blocks", "main.blocks.ts", "README.md"]
            },
            files: {
                "main.blocks": `<xml xmlns="http://www.w3.org/1999/xhtml">\n</xml>\n`,
                "main.blocks.ts": "\n",
                "README.md": lf("Describe your project here!")
            }
        },
        tsprj: {
            id:"tsprj",
            config: {
                name: lf("{0} bit"),
                dependencies: {
                    "microbit": "*",
                    "microbit-led": "*",
                    "microbit-music": "*",
                    "microbit-radio": "*",
                    "microbit-game": "*",
                    "microbit-pins": "*",
                    "microbit-serial": "*"
                },
                description: "",
                files: ["main.ts", "README.md"]
            }, files: {
                "main.ts": `basic.showString("Hi!")\n`,
                "README.md": lf("Describe your project here!")
            }
        },
        koduvscode: true,
        compile: true
    },

    minecraft: {
        id: "minecraft",
        name: lf("Minecraft"),
        blocksprj: {
            id:"blocksprj",
            config: {
                name: lf("{0} craft"),
                dependencies: {
                    "minecraft": "*",
                },
                description: "",
                files: ["main.blocks", "main.blocks.ts", "README.md"]
            },
            files: {
                "main.blocks": `<xml xmlns="http://www.w3.org/1999/xhtml">\n</xml>\n`,
                "main.blocks.ts": "\n",
                "README.md": lf("Describe your project here!")
            }
        },
        tsprj: {
            id:"tsprj",
            config: {
                name: lf("{0} craft"),
                dependencies: {
                    "minecraft": "*",
                },
                description: "",
                files: ["main.ts", "README.md"]
            }, files: {
                "main.ts": `\n`,
                "README.md": lf("Describe your project here!")
            }
        },
        koduvscode: false,
        compile: false
    }    
};

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
    appTarget: IAppTarget;

    constructor(props: IAppProps) {
        super(props);

        let target = '';
        let m = /target=([a-z0-9]+)/i.exec(window.document.location.href);
        if (m) target = m[1];
        this.appTarget = appTargets[target] || appTargets['microbit'];

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
        <div class="ui slide masked reveal image">
            <img class="visible content" src="${images}/newblock.png">
            <img class="hidden content" src="${images}/newblock2.png">
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
        <div class="ui slide masked reveal image">
            <img class="visible content" src="${images}/newtypescript.png">
            <img class="hidden content" src="${images}/newtypescript2.png">
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

    newProjectFromId(prj: IProjectTemplate) {
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
        compiler.compileAsync(ts.yelm.CompileTarget.Thumb)
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
        
        this.setState({ running: false})
    }

    runSimulator() {
        let logs = this.refs["logs"] as logview.LogView;
        logs.clear();   
        let state = this.editor.snapshotState()
        compiler.compileAsync(ts.yelm.CompileTarget.JavaScript)
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
                        <span id="logo" className="item">yelm</span>
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
                            <sui.Button key='runbtn' class='icon primary portrait only' icon={this.state.running ? "stop" : "play"} text={this.state.running ? lf("Stop") : lf("Run") } onClick={() => this.state.running ? this.stopSimulator() : this.runSimulator() } />
                            {this.appTarget.compile ? <sui.Button class='icon primary portrait only' icon='download' onClick={() => this.compile() } /> : "" }
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
    var lang = /lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
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
