import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as sui from "./sui";
import {LoginBox} from "./login";

declare var require: any;
var ace: AceAjax.Ace = require("brace");

require('brace/mode/typescript');
require('brace/mode/json');
require('brace/mode/c_cpp');
require('brace/mode/text');
require('brace/mode/markdown');

interface IAppProps { }
interface IAppState {
    header?: workspace.Header;
    currFile?: pkg.File;
    inverted?: string;
    fontSize?: string;
    fileState?: string;
}


var theEditor: Editor;

interface ISettingsState {
}

interface ISettingsProps {
    parent: Editor;
}

class Settings extends data.Component<ISettingsProps, ISettingsState> {
    state: ISettingsState;
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
        };
    }

    componentDidMount() {
        this.child(".popup-button").popup({
            position: "bottom right",
            on: "click",
            hoverable: true,
            delay: {
                show: 50,
                hide: 1000
            }
        });
        this.child(".ui.dropdown").dropdown();
    }

    componentDidUpdate() {
        this.child(".popup-button").popup('refresh');
        this.child(".ui.dropdown").dropdown('refresh');
    }


    renderCore() {
        let par = this.props.parent
        let sizes: Util.StringMap<string> = {
            '14px': "Small",
            '20px': "Medium",
            '24px': "Large",
        }
        let fontSize = (v:string) => par.setState({ fontSize: v })
        return (
            <div id='settings'>
                <div className="ui icon button popup-button">
                    <i className="settings icon"></i>
                </div>
                <div className="ui popup transition hidden form">
                    <div className="field">
                        <div className="ui toggle checkbox ">
                            <input type="checkbox" name="public" checked={!!par.state.inverted} onChange={() => par.swapTheme() } />
                            <label>Dark theme</label>
                        </div>
                    </div>

                    <div className="field">
                        <label>Font size</label>
                        <sui.Dropdown class="selection" value={par.state.fontSize} onChange={fontSize}>
                            {Object.keys(sizes).map(k => <sui.Item value={k}>{sizes[k]}</sui.Item>) }
                        </sui.Dropdown>
                    </div>
                </div>
            </div>
        );
    }
}


class DropdownMenu extends data.Component<{}, {}> {
    componentDidMount() {
        this.child(".ui.dropdown").dropdown({
            action: "hide"
        });
    }

    componentDidUpdate() {
        this.child(".ui.dropdown").dropdown('refresh');
    }

    renderCore() {
        let item = (icon: string, msg: string, cb: () => void) => (
            <div className="item" onClick={cb}>
                {icon ? <i className={icon + " icon"}></i> : null}
                {msg}
            </div>
        )
        return (
            <div>
                <div className="ui dropdown icon button floating">
                    <i className="wrench icon"></i>
                    <div className="menu">
                        {item("file", "New project", () => { }) }
                        {item("trash", "Remove project", () => { }) }
                        <div className="divider"></div>
                        {item("cloud download", "Sync", () => workspace.syncAsync().done()) }
                    </div>
                </div>
            </div>
        );
    }
}

class SlotSelector extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
        };
    }

    componentDidMount() {
        this.child(".ui.dropdown").dropdown();
        this.child(".ui.button").popup();
    }

    componentDidUpdate() {
        this.child(".ui.dropdown").dropdown('set selected', this.child("select").val())
        this.child(".ui.dropdown").dropdown('refresh');
    }


    renderCore() {
        let par = this.props.parent
        let headers: workspace.Header[] = this.getData("header:*")
        headers.sort((a, b) => b.recentUse - a.recentUse)
        let chgHeader = (ev: React.FormEvent) => {
            let id = (ev.target as HTMLInputElement).value
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
            Util.nextTick(() => par.loadHeader(headers[0]))
        }
        let needsUpload = hd && !hd.blobCurrent
        return (
            <div id='slotselector'>
                <select className="ui selection search dropdown" value={hdId}
                    onChange={chgHeader}>
                    {headers.map(h =>
                        <option key={h.id} value={h.id}>
                            {h.name || "no name"}
                        </option>
                    ) }
                </select>

                <button className={"ui icon button " + btnClass} onClick={save}
                    data-content={btnClass ? "Uploading..." : needsUpload ? "Will upload. Click to force." : "Stored in the cloud." }>
                    <i className={"cloud icon " + (needsUpload ? "upload" : "") }></i>
                </button>

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
        if (f && f.epkg.header) {
            let n: FileHistoryEntry = {
                id: f.epkg.header.id,
                name: f.getName(),
                pos: this.editor.getCursorPosition()
            }
            sett.fileHistory = sett.fileHistory.filter(e => e.id != n.id || e.name != n.name)
            if (this.settings.fileHistory.length > 100)
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
            "ts": "typescript"
        }
        let mode = "text"
        if (modeMap.hasOwnProperty(ext)) mode = modeMap[ext]
        let sess = this.editor.getSession()
        sess.setMode('ace/mode/' + mode);

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
                core.infoNotification("Project loaded: " + h.name)
                pkg.getEditorPkg(pkg.mainPkg).onupdate = () => {
                    this.loadHeader(h)
                }
            })
    }

    compile() {
        pkg.mainPkg.buildAsync()
            .then(resp => {
                console.log(resp)
            })
            .done()
    }

    renderCore() {
        theEditor = this;

        this.setTheme()
        this.updateEditorFile();

        let filesOf = (pkg: pkg.EditorPackage) =>
            pkg.sortedFiles().map(file =>
                <a
                    key={file.getName() }
                    onClick={() => this.setFile(file) }
                    className={(this.state.currFile == file ? "active " : "") + (pkg.yelmPkg.level == 0 ? "" : "nested ") + "item"}
                    >
                    {file.name} {this.getData("open-status:" + file.getName()) == "saved" ? "" : "*"}
                </a>
            )

        let filesWithHeader = (pkg: pkg.EditorPackage) =>
            pkg.yelmPkg.level == 0 ? filesOf(pkg) : [
                <div key={"hd-" + pkg.yelmPkg.id} className="header item">
                    <i className="folder icon"></i>
                    {pkg.yelmPkg.id}
                </div>
            ].concat(filesOf(pkg))

        let files = Util.concat(pkg.allEditorPkgs().map(filesWithHeader))

        return (
            <div id='root' className={this.state.inverted || ""}>
                <div id="menubar">
                    <div className={"ui menu" + this.state.inverted}>
                        <div className="item">
                            <button className="ui primary button"
                                onClick={() => this.compile() }>
                                Compile
                            </button>
                        </div>
                        <div className="item">
                            <SlotSelector parent={this} />
                        </div>
                        <div className="item">
                            <DropdownMenu />
                        </div>
                        <div className="item right">
                            <LoginBox />
                            <Settings parent={this} />
                        </div>
                    </div>
                </div>
                <div id="filelist">
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
    core
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
            let hd = workspace.allHeaders[0]
            if (ent)
                hd = workspace.getHeader(ent.id)
            theEditor.loadHeader(hd)
        })
})


window.addEventListener("unload", ev => {
    if (theEditor && !LoginBox.signingOut)
        theEditor.saveSettings()
})
