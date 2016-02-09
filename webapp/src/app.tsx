import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as sui from "./sui";
import * as mbitview from "./mbitview";
import {LoginBox} from "./login";

declare var require: any;
var ace: AceAjax.Ace = require("brace");

var lf = Util.lf

require('brace/mode/typescript');
require('brace/mode/javascript');
require('brace/mode/json');
require('brace/mode/c_cpp');
require('brace/mode/text');
require('brace/mode/markdown');
require('brace/mode/assembly_armthumb');

interface IAppProps { }
interface IAppState {
    header?: workspace.Header;
    currFile?: pkg.File;
    inverted?: string;
    fontSize?: string;
    fileState?: string;
}


var theEditor: Editor;

interface ISettingsProps {
    parent: Editor;
}

class Settings extends data.Component<ISettingsProps, {}> {
    renderCore() {
        let par = this.props.parent
        let sizes: Util.StringMap<string> = {
            '14px': lf("Small"),
            '20px': lf("Medium"),
            '24px': lf("Large"),
        }
        let fontSize = (v: string) => par.setState({ fontSize: v })
        return (
            <sui.Popup icon='settings'>
                <div className='ui form'>
                    <sui.Field>
                        <div className="ui toggle checkbox ">
                            <input type="checkbox" name="public" checked={!!par.state.inverted} onChange={() => par.swapTheme() } />
                            <label>{lf("Dark theme") }</label>
                        </div>
                    </sui.Field>
                    <sui.Field label="Font size">
                        <sui.Dropdown class="selection" value={par.state.fontSize} onChange={fontSize}>
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
        headers.sort((a, b) => b.recentUse - a.recentUse)
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

interface FileHistoryEntry {
    id: string;
    name: string;
    pos: AceAjax.Position;
}

interface EditorSettings {
    inverted: boolean;
    fontSize: string;
    fileHistory: FileHistoryEntry[];
}

class Editor extends data.Component<IAppProps, IAppState> {
    editor: AceAjax.Editor;
    editorFile: pkg.File;
    settings: EditorSettings;

    constructor(props: IAppProps) {
        super(props);

        this.settings = JSON.parse(window.localStorage["editorSettings"] || "{}")
        this.state = {
            inverted: this.settings.inverted ? " inverted " : "",
            fontSize: this.settings.fontSize || "20px"
        };
        if (!this.settings.fileHistory) this.settings.fileHistory = []
    }

    swapTheme() {
        this.setState({
            inverted: this.state.inverted ? "" : " inverted "
        })
    }

    saveSettings() {
        let sett = this.settings
        sett.inverted = !!this.state.inverted
        sett.fontSize = this.state.fontSize

        let f = this.editorFile
        if (f && f.epkg.getTopHeader()) {
            let n: FileHistoryEntry = {
                id: f.epkg.getTopHeader().id,
                name: f.getName(),
                pos: this.editor.getCursorPosition()
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
    }

    private setTheme() {
        require('brace/theme/sqlserver');
        require('brace/theme/tomorrow_night_bright');

        if (!this.editor) return
        let th = this.state.inverted ? 'ace/theme/tomorrow_night_bright' : 'ace/theme/sqlserver'
        if (this.editor.getTheme() != th) {
            this.editor.setTheme(th)
        }
        this.editor.setFontSize(this.state.fontSize)
    }

    saveFileAsync() {
        if (!this.editorFile)
            return Promise.resolve()
        return this.editorFile.setContentAsync(this.editor.getValue())
    }

    public componentDidMount() {
        this.editor = ace.edit('maineditor');

        let sess = this.editor.getSession()
        sess.setNewLineMode("unix");
        sess.setTabSize(4);
        sess.setUseSoftTabs(true);
        this.editor.$blockScrolling = Infinity;

        let hasChangeTimer = false
        sess.on("change", () => {
            if (this.editorFile) this.editorFile.markDirty();
            if (!hasChangeTimer) {
                hasChangeTimer = true
                setTimeout(() => {
                    hasChangeTimer = false;
                    this.saveFileAsync().done();
                }, 1000);
            }
        })

        this.setTheme();
    }

    private updateEditorFile() {
        if (this.state.currFile == this.editorFile)
            return;
        this.saveSettings();

        let file = this.state.currFile

        let ext = file.getExtension()
        let modeMap: any = {
            "cpp": "c_cpp",
            "json": "json",
            "md": "markdown",
            "ts": "typescript",
            "js": "javascript",
            "asm": "assembly_armthumb"
        }
        let mode = "text"
        if (modeMap.hasOwnProperty(ext)) mode = modeMap[ext]
        let sess = this.editor.getSession()
        sess.setMode('ace/mode/' + mode);
        sess.clearAnnotations();

        this.editor.setReadOnly(file.isReadonly())
        this.saveFileAsync().done(); // before change
        this.editorFile = file;
        this.editor.setValue(file.content, -1)
        this.saveFileAsync().done(); // cancel the change event generated by setValue() above

        let e = this.settings.fileHistory.filter(e => e.id == this.state.header.id && e.name == file.getName())[0]
        if (e) {
            this.editor.moveCursorToPosition(e.pos)
            this.editor.scrollToLine(e.pos.row - 1, true, false, () => { })
        }
    }

    setFile(fn: pkg.File) {
        this.setState({ currFile: fn })
    }

    loadHeader(h: workspace.Header) {
        if (!h)
            return
        pkg.loadPkgAsync(h.id)
            .then(() => {
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

    newProject() {
        let cfg: yelm.PackageConfig = {
            name: lf("{0} bit", Util.getAwesomeAdj()),
            dependencies: { mbit: "*" },
            description: "",
            files: ["main.ts"]
        }
        let files:workspace.ScriptText = {
            "yelm.json": JSON.stringify(cfg, null, 4) + "\n",
            "main.ts": `basic.showString("Hi!")\n`
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

    compile() {
        pkg.mainPkg.buildAsync()
            .then(resp => {
                let hex = resp.outfiles["microbit.hex"]
                if (hex) {
                    let fn = "microbit-" + this.state.header.name.replace(/[^a-zA-Z0-9]+/, "-") + ".hex"
                    core.browserDownloadText(hex, fn, "application/x-microbit-hex")
                }
                let outp = pkg.getEditorPkg(pkg.mainPkg).outputPkg
                outp.setFiles(resp.outfiles)
            })
            .done()
    }

    renderCore() {
        theEditor = this;

        this.setTheme()
        this.updateEditorFile();

        let filesOf = (pkg: pkg.EditorPackage) =>
            pkg.sortedFiles().map(file => {
                let status = this.getData("open-status:" + file.getName())
                let isSaved = status == "saved" || status == "readonly"
                return (
                    <a
                        key={file.getName() }
                        onClick={() => this.setFile(file) }
                        className={(this.state.currFile == file ? "active " : "") + (pkg.isTopLevel() ? "" : "nested ") + "item"}
                        >
                        {file.name} {isSaved ? "" : "*"}
                        {status == "readonly" ? <i className="lock icon"></i> : null}
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

        return (
            <div id='root' className={this.state.inverted || ""}>
                <div id="menubar">
                    <div className={"ui menu" + this.state.inverted}>
                        <div className="item">
                            <sui.Button class='primary' text={lf("Compile") } onClick={() => this.compile() } />
                        </div>
                        <div className="item">
                            <SlotSelector parent={this} />
                        </div>
                        <div className="item">
                            <sui.Dropdown class="button floating" icon="wrench" menu={true}>
                                <sui.Item icon="file" text={lf("New project") } onClick={() => this.newProject() } />
                                <sui.Item icon="trash" text={lf("Remove project") } onClick={() => { } } />
                                <div className="divider"></div>
                                <sui.Item icon="cloud download" text={lf("Sync") } onClick={() => workspace.syncAsync().done() } />
                            </sui.Dropdown>
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
                        <mbitview.MbitBoard />
                    </div>
                    <div className={"ui vertical menu filemenu " + this.state.inverted}>
                        {files}
                    </div>
                </div>
                <div id="maineditor">
                </div>
            </div>
        );
    }
}

function render() {
    ReactDOM.render(<Editor/>, $('#content')[0])
}

let myexports: any = {
    workspace,
    require,
    core,
    theEditor
}
Object.keys(myexports).forEach(k => (window as any)[k] = myexports[k])


$(document).ready(() => {
    $("#loading").remove();
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


