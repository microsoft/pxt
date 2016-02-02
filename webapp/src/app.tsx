import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";

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
    text?: workspace.ScriptText;
    currFile?: string;
}

class Host
    implements yelm.Host {

    readFileAsync(module: string, filename: string): Promise<string> {
        if (module != "this")
            return Promise.resolve(null as string)
        if (theEditor.state.text) {
            return Promise.resolve(theEditor.state.text.files[filename] || null)
        } else return Promise.resolve(null as string)
    }

    writeFileAsync(module: string, filename: string, contents: string): Promise<void> {
        throw Util.oops("trying to write " + module + " / " + filename)
    }

    getHexInfoAsync() {
        return Promise.resolve(require("../../../generated/hexinfo.js"))
    }

    hasLocalPackage(name: string) {
        return false;
    }
}

let theEditor: Editor;
let theHost = new Host();
let mainPkg = new yelm.MainPackage(theHost);

class Editor extends React.Component<IAppProps, IAppState> {

    state: IAppState;
    editor: AceAjax.Editor;

    constructor(props: IAppProps) {
        super(props);
        this.state = {
        };
    }

    public componentDidMount() {
        this.editor = ace.edit('maineditor');

        let sess = this.editor.getSession()
        sess.setNewLineMode("unix");
        sess.setTabSize(4);
        sess.setUseSoftTabs(true);
        sess.setMode('ace/mode/typescript');
        this.editor.setFontSize("18px")
        this.editor.$blockScrolling = Infinity;

        require('brace/theme/tomorrow_night_bright');
        this.editor.setTheme('ace/theme/tomorrow_night_bright');
    }

    setFile(fn: string) {
        if (this.state.currFile == fn)
            return;
        let ext = fn.replace(/.*\./, "")
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
        this.editor.setValue(this.state.text.files[fn], -1)
        this.setState({ currFile: fn })
    }

    getFiles(): string[] {
        if (this.state.text)
            return Object.keys(this.state.text.files)
        return []
    }

    loadHeader(h: workspace.Header) {
        if (!h) return
        workspace.getTextAsync(h.id)
            .then(text => {
                this.setState({
                    header: h,
                    text: text,
                    currFile: null
                })
                this.setFile(this.getFiles()[0])
            })
    }

    compile() {
        mainPkg.buildAsync()
            .then(resp => {
                console.log(resp)
            })
            .done()
    }

    public render() {
        theEditor = this;
        let files = this.getFiles().map(fn =>
            <a
                key={fn}
                className={this.state.currFile == fn ? "active item" : "item"}
                onClick={() => this.setFile(fn) }>
                {fn}
            </a>
        )

        return (
            <div id='root'>
                <div id="menubar">
                    <div className="ui menu">
                        <div className="item">
                            <button className="ui primary button"
                                onClick={() => this.compile() }>
                                Compile
                            </button>
                        </div>
                    </div>
                </div>
                <div id="filelist">
                    <div className="ui secondary vertical pointing menu">
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