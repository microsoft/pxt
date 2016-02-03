import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as apicache from "./apicache";
import * as pkg from "./package";
import * as core from "./core";
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
}


var theEditor: Editor;

interface ISettingsState {
    dropped?: boolean;
}

interface ISettingsProps {
    parent: Editor;
}

class Settings extends React.Component<ISettingsProps, ISettingsState> {
    state: ISettingsState;
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
        };
    }

    componentDidMount() {
        $('#settings > .button').popup({
            position: "bottom right",
            hoverable: true,
            delay: {
                show: 50,
                hide: 1000
            }
        });
        $('#settings .ui.dropdown').dropdown();
    }

    componentDidUpdate() {
        $('#settings > .button').popup('refresh');
        $('#settings .ui.dropdown').dropdown('refresh');
    }


    public render() {
        let par = this.props.parent
        let sizes: Util.StringMap<string> = {
            '14px': "Small",
            '20px': "Medium",
            '24px': "Large",
        }
        let fontSize = (ev: React.FormEvent) => par.setState({ fontSize: (ev.target as HTMLInputElement).value })
        return (
            <div id='settings'>
                <div className="ui orange icon button">
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
                        <select className="ui selection dropdown " value={par.state.fontSize}
                            onChange={fontSize}>
                            {Object.keys(sizes).map(k => <option key={k} value={k}>{sizes[k]}</option>) }
                        </select>
                    </div>
                </div>
            </div>
        );
    }
}

class Editor extends React.Component<IAppProps, IAppState> {
    editor: AceAjax.Editor;

    constructor(props: IAppProps) {
        super(props);

        let settings = JSON.parse(window.localStorage["editorSettings"] || "{}")
        this.state = {
            inverted: settings.inverted ? " inverted " : "",
            fontSize: settings.fontSize || "20px"
        };
    }

    swapTheme() {
        this.setState({
            inverted: this.state.inverted ? "" : " inverted "
        })
    }

    componentDidUpdate() {
        let settings = {
            inverted: !!this.state.inverted,
            fontSize: this.state.fontSize
        }
        window.localStorage["editorSettings"] = JSON.stringify(settings)
    }

    setTheme() {
        require('brace/theme/sqlserver');
        require('brace/theme/tomorrow_night_bright');

        if (!this.editor) return
        let th = this.state.inverted ? 'ace/theme/tomorrow_night_bright' : 'ace/theme/sqlserver'
        if (this.editor.getTheme() != th) {
            this.editor.setTheme(th)
        }
        this.editor.setFontSize(this.state.fontSize)
    }

    public componentDidMount() {
        this.editor = ace.edit('maineditor');

        let sess = this.editor.getSession()
        sess.setNewLineMode("unix");
        sess.setTabSize(4);
        sess.setUseSoftTabs(true);
        sess.setMode('ace/mode/typescript');
        this.editor.$blockScrolling = Infinity;

        this.setTheme();
    }

    setFile(fn: pkg.File) {
        if (this.state.currFile == fn)
            return;
        let ext = fn.getExtension()
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

        this.editor.setValue(fn.content, -1)
        this.setState({ currFile: fn })
    }

    loadHeader(h: workspace.Header) {
        if (!h) return
        pkg.loadPkgAsync(h.id)
            .then(() => {
                this.setState({
                    header: h,
                    currFile: null
                })
                this.setFile(pkg.getEditorPkg(pkg.mainPkg).getMainFile())
            })
    }

    compile() {
        pkg.mainPkg.buildAsync()
            .then(resp => {
                console.log(resp)
            })
            .done()
    }

    public render() {
        theEditor = this;

        this.setTheme()

        let filesOf = (pkg: pkg.EditorPackage) =>
            pkg.sortedFiles().map(file =>
                <a
                    key={file.getName() }
                    onClick={() => this.setFile(file) }
                    className={(this.state.currFile == file ? "active " : "") + (pkg.yelmPkg.level == 0 ? "" : "nested ") + "item"}
                    >
                    {file.name}
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
                        <div className="item right">
                            <LoginBox />
                        </div>
                        <div className="item">
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
    require
}
Object.keys(myexports).forEach(k => (window as any)[k] = myexports[k])


$(document).ready(() => {
    $("#loading").remove();
    workspace.initAsync()
        .then(() => {
            render()
        })
        .then(() => {
            theEditor.loadHeader(workspace.allHeaders[0])
        })
})