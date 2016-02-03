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
    currFile?: File;
}

class File {
    constructor(public epkg: EditorPackage, public name: string, public content: string)
    { }

    getName() {
        return this.epkg.yelmPkg.id + "/" + this.name
    }
    getExtension() {
        let m = /\.([^\.]+)$/.exec(this.name)
        if (m) return m[1]
        return ""
    }
}

class EditorPackage {
    files: Util.StringMap<File> = {};
    constructor(public yelmPkg: yelm.Package) {
    }

    setFiles(files: Util.StringMap<string>) {
        this.files = Util.mapStringMap(files, (k, v) => new File(this, k, v))
    }

    sortedFiles() {
        return Util.values(this.files)
    }

    getMainFile() {
        return this.sortedFiles().filter(f => f.getExtension() == "ts")[0] || this.sortedFiles()[0]
    }
}

class Host
    implements yelm.Host {

    readFileAsync(module: yelm.Package, filename: string): Promise<string> {
        let epkg = getEditorPkg(module)
        let file = epkg.files[filename]
        return Promise.resolve(file ? file.content : null)
    }

    writeFileAsync(module: yelm.Package, filename: string, contents: string): Promise<void> {
        if (filename == yelm.configName)
            return Promise.resolve(); // ignore config writes
        throw Util.oops("trying to write " + module + " / " + filename)
    }

    getHexInfoAsync() {
        return Promise.resolve(require("../../../generated/hexinfo.js"))
    }

    downloadPackageAsync(pkg: yelm.Package) {
        let proto = pkg.verProtocol()
        let epkg = getEditorPkg(pkg)

        if (proto == "pub")
            // make sure it sits in cache
            return workspace.getScriptFilesAsync(pkg.verArgument())
                .then(files => epkg.setFiles(files))
        else if (proto == "workspace") {
            return workspace.getTextAsync(pkg.verArgument())
                .then(scr => epkg.setFiles(scr.files))
        } else {
            return Promise.reject(`Cannot download ${pkg.version()}; unknown protocol`)
        }
    }

    resolveVersionAsync(pkg: yelm.Package) {
        return Cloud.privateGetAsync(yelm.pkgPrefix + pkg.id).then(r => {
            let id = r["scriptid"]
            if (!id)
                Util.userError("scriptid no set on ptr for pkg " + pkg.id)
            return id
        })
    }

}

var theEditor: Editor;
var theHost = new Host();
var mainPkg = new yelm.MainPackage(theHost);

function getEditorPkg(p: yelm.Package) {
    let r: EditorPackage = (p as any)._editorPkg
    if (r) return r
    return ((p as any)._editorPkg = new EditorPackage(p))
}

function allEditorPkgs() {
    return Util.values(mainPkg.deps).map(getEditorPkg)
}

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
        
        require('brace/theme/sqlserver');
        this.editor.setTheme('ace/theme/sqlserver');
    }

    setFile(fn: File) {
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
        mainPkg = new yelm.MainPackage(theHost)
        mainPkg._verspec = "workspace:" + h.id
        mainPkg.installAllAsync()
            .then(() => {
                this.setState({
                    header: h,
                    currFile: null
                })
                this.setFile(getEditorPkg(mainPkg).getMainFile())
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

        let filesOf = (pkg: EditorPackage) =>
            pkg.sortedFiles().map(file =>
                <a
                    key={file.getName() }
                    onClick={() => this.setFile(file) }
                    className={(this.state.currFile == file ? "active " : "") + (pkg.yelmPkg.level == 0 ? "" : "nested ") + "item"}
                    >                    
                    {file.name}
                </a>
            )

        let filesWithHeader = (pkg: EditorPackage) =>
            pkg.yelmPkg.level == 0 ? filesOf(pkg) : [
                <div className="header item">
                    <i className="folder icon"></i>
                    {pkg.yelmPkg.id}
                </div>
            ].concat(filesOf(pkg))

        let files = Util.concat(allEditorPkgs().map(filesWithHeader))

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
                    <div className="ui vertical menu filemenu">
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