/// <reference path="../../built/pxtlib.d.ts"/>
/// <reference path="../../built/pxtblocks.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts"/>

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
import * as tdlegacy from "./tdlegacy"
import * as db from "./db"
import * as cmds from "./cmds"
import * as appcache from "./appcache";
import {LoginBox} from "./login"

import * as ace from "./ace"
import * as pxtjson from "./pxtjson"
import * as blocks from "./blocks"
import * as codecard from "./codecard"
import * as logview from "./logview"
import * as draganddrop from "./draganddrop";
import * as hwdbg from "./hwdbg"

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type InstallHeader = pxt.workspace.InstallHeader;

import Cloud = pxt.Cloud;
import Util = pxt.Util;
let lf = Util.lf

export interface FileHistoryEntry {
    id: string;
    name: string;
    pos: srceditor.ViewState;
}

export interface EditorSettings {
    showFiles?: boolean;
    fileHistory: FileHistoryEntry[];
}

interface IAppProps { }
interface IAppState {
    active?: boolean; // is this tab visible at all
    header?: Header;
    projectName?: string; // project name value while being edited
    currFile?: pkg.File;
    fileState?: string;
    showFiles?: boolean;
    errorCard?: pxt.CodeCard;
    errorCardClick?: (e: React.MouseEvent) => boolean;
    helpCard?: pxt.CodeCard;
    helpCardClick?: (e: React.MouseEvent) => boolean;
    sideDocsCollapsed?: boolean;

    running?: boolean;
    publishing?: boolean;
    hideEditorFloats?: boolean;

    simulatorCompilation?: {
        name: string;
        content: string;
        contentType: string;
    }
}


let theEditor: ProjectView;

interface ISettingsProps {
    parent: ProjectView;
    visible?: boolean;
}

class CloudSyncButton extends data.Component<ISettingsProps, {}> {
    renderCore() {
        Util.assert(pxt.appTarget.cloud && pxt.appTarget.cloud.workspaces);

        let par = this.props.parent
        let hd = par.state.header
        let hdId = hd ? hd.id : ""
        let btnClass = !hd || this.getData("pkg-status:" + hdId) == "saving" ? " disabled" : ""
        let save = () => {
            par.saveFileAsync()
                .then(() => par.state.currFile.epkg.savePkgAsync())
                .then(() => {
                    return workspace.syncAsync()
                })
                .done()
        }
        let needsUpload = hd && !hd.blobCurrent
        return <sui.Button class={btnClass} onClick={save}
            icon={"cloud " + (needsUpload ? "upload" : "") }
            popup={btnClass ? lf("Uploading...") : needsUpload ? lf("Will upload. Click to sync.") : lf("Stored in the cloud. Click to sync.") }
            />
    }
}

interface ScriptSearchState {
    searchFor?: string;
    packages?: boolean;
}

class ScriptSearch extends data.Component<ISettingsProps, ScriptSearchState> {
    prevData: Cloud.JsonPointer[] = [];
    modal: sui.Modal;

    constructor(props: ISettingsProps) {
        super(props)
        this.state = {
            searchFor: ''
        }
    }

    fetchCloudData(): Cloud.JsonPointer[] {
        let cloud = pxt.appTarget.cloud || {};
        if (!cloud.workspaces && !cloud.packages) return [];
        let kind = cloud.packages ? 'ptr-pkg' : 'ptr-samples';
        let res = this.state.searchFor
            ? this.getData(`cloud:pointers?q=${encodeURIComponent(this.state.searchFor)}+feature:@${kind}+feature:@target-${pxt.appTarget.id}`)
            : null
        if (res) this.prevData = res.items
        let data = this.prevData
        return data;
    }

    fetchBundled(): pxt.PackageConfig[] {
        if (!this.state.packages || !!this.state.searchFor) return [];

        const bundled = pxt.appTarget.bundledpkgs;
        return Util.values(bundled)
            .map(bundle => JSON.parse(bundle["pxt.json"]) as pxt.PackageConfig)
    }

    fetchLocalData(): Header[] {
        if (this.state.packages) return [];

        let headers: Header[] = this.getData("header:*")
        if (this.state.searchFor)
            headers = headers.filter(hdr => hdr.name.toLowerCase().indexOf(this.state.searchFor.toLowerCase()) > -1);
        return headers;
    }

    renderCore() {
        const headers = this.fetchLocalData();
        const data = this.fetchCloudData();
        const bundles = this.fetchBundled();

        let chgHeader = (hdr: Header) => {
            if (this.modal) this.modal.hide();
            this.props.parent.loadHeaderAsync(hdr)
        }
        let chgBundle = (scr: pxt.PackageConfig) => {
            if (this.modal) this.modal.hide();
            let p = pkg.mainEditorPkg();
            p.addDepAsync(scr.name, "*")
                .then(r => this.props.parent.reloadHeaderAsync())
                .done();
        }
        let upd = (v: any) => {
            this.setState({ searchFor: (v.target as any).value })
        };
        let install = (scr: Cloud.JsonPointer) => {
            if (this.modal) this.modal.hide();
            if (this.state.packages) {
                let p = pkg.mainEditorPkg();
                p.addDepAsync(scr.scriptname, "*")
                    .then(r => this.props.parent.reloadHeaderAsync())
                    .done();
            } else {
                workspace.installByIdAsync(scr.scriptid)
                    .then(r => this.props.parent.loadHeaderAsync(r))
                    .done()
            }
        }
        let importHex = () => {
            if (this.modal) this.modal.hide();
            this.props.parent.importHexFileDialog();
        }

        return (
            <sui.Modal ref={v => this.modal = v} header={this.state.packages ? lf("Add Package...") : lf("Open Project...") } addClass="large searchdialog" >
                <div className="ui search">
                    <div className="ui fluid icon input">
                        <input type="text" placeholder={lf("Search...") } onChange={upd} />
                        <i className="search icon"></i>
                    </div>
                </div>
                <div className="ui cards">
                    {pxt.appTarget.compile && pxt.appTarget.compile.hasHex && !this.state.packages ?
                        <codecard.CodeCardView
                            key="importhex"
                            name={lf("import...") }
                            description={lf("Import project from a .hex file") }
                            onClick={() => importHex() }
                            /> : undefined}
                    {bundles.map(scr =>
                        <codecard.CodeCardView
                            key={'bundled' + scr.name}
                            name={scr.name}
                            description={scr.description}
                            url={"/" + scr.installedVersion}
                            onClick={() => chgBundle(scr) }
                            />
                    ) }
                    {headers.map(scr =>
                        <codecard.CodeCardView
                            key={'local' + scr.id}
                            name={scr.name}
                            time={scr.recentUse}
                            description={scr.meta ? scr.meta.description || "" : ""}
                            url={scr.pubId && scr.pubCurrent ? "/" + scr.pubId : ""}
                            onClick={() => chgHeader(scr) }
                            />
                    ) }
                    {data.map(scr =>
                        <codecard.CodeCardView
                            name={scr.scriptname}
                            time={scr.time}
                            header={scr.username}
                            description={scr.description}
                            key={'cloud' + scr.id}
                            onClick={() => install(scr) }
                            url={'/' + scr.scriptid}
                            color="blue"
                            />
                    ) }
                </div>
            </sui.Modal >
        );
    }
}

class ShareEditor extends data.Component<ISettingsProps, {}> {
    modal: sui.Modal;

    renderCore() {
        const header = this.props.parent.state.header;
        if (!header) return <div></div>

        let rootUrl = pxt.appTarget.appTheme.embedUrl
        if (!/\/$/.test(rootUrl)) rootUrl += '/';
        const ready = !!header.pubId && header.pubCurrent;
        let url: string;
        let embed: string;
        let docembed: string;
        if (ready) {
            let runurl = `${rootUrl}--run?id=${header.pubId}`;
            let docurl = `${rootUrl}--docs?id=${header.pubId}`;
            url = `${rootUrl}${header.pubId}`
            embed = `<div style="position:relative;height:0;padding-bottom:83%;overflow:hidden;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="${runurl}" allowfullscreen="allowfullscreen" frameborder="0"></iframe></div>`
            docembed = `<div style="position:relative;height:0;padding-bottom:83%;overflow:hidden;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="${docurl}" allowfullscreen="allowfullscreen" frameborder="0"></iframe></div>`
        }

        let publish = () => {
            this.props.parent.publishAsync().done();
        }
        let formState = !ready ? 'warning' : this.props.parent.state.publishing ? 'loading' : 'success';

        return <sui.Modal ref={v => this.modal = v} addClass="small searchdialog" header={lf("Embed Project") }>
            <div className={`ui ${formState} form`}>
                <div className="ui warning message">
                    <div className="header">{lf("Almost there!") }</div>
                    <p>{lf("You need to publish your project to share it or embed it in other web pages.") +
                        lf("You acknowledge having consent to publish this content.") }</p>
                    <sui.Button class={"green " + (this.props.parent.state.publishing ? "loading" : "") } text={lf("Publish project") } onClick={publish} />
                </div>
                <div className="ui success message">
                    <div className="header">{lf("Your project is ready!") }</div>
                    <p>{lf("Share this URL or copy the HTML to embed your project in web pages.") }</p>
                </div>
                { url ?
                    <sui.Field label={lf("URL") }>
                        <p>{lf("Share this link to access your project.") }</p>
                        <sui.Input class="mini" readOnly={true} value={url} copy={ready} disabled={!ready} />
                    </sui.Field> : null }
                { pxt.debugMode() && docembed ?
                    <sui.Field label={lf("Embed The Code") }>
                        <p>{lf("Embed the code of this project in your website or blog by pasting this code into your web page.") }</p>
                        <sui.Input class="mini" readOnly={true} lines={3} value={docembed} copy={ready} disabled={!ready} />
                    </sui.Field> : null }
                { embed ?
                    <sui.Field label={lf("Embed This Project") }>
                        <p>{lf("Embed this project in your website or blog by pasting this code into your web page.") }</p>
                        <sui.Input class="mini" readOnly={true} lines={3} value={embed} copy={ready} disabled={!ready} />
                    </sui.Field> : null }
            </div>
        </sui.Modal>
    }
}

class DocsMenu extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    openDoc(path: string) {
        this.props.parent.setSideDoc(path);
    }

    render() {
        const targetTheme = pxt.appTarget.appTheme;
        return <div id="docsmenu" className="ui buttons">
            <sui.DropdownMenu class="floating icon button" icon="help">
                {targetTheme.docMenu.map(m => <a href={m.path} target="docs" key={"docsmenu" + m.path} className="ui item widedesktop hidden">{m.name}</a>) }
                {targetTheme.docMenu.map(m => <sui.Item key={"docsmenuwide" + m.path} class="widedesktop only" onClick={() => this.openDoc(m.path) }>{m.name}</sui.Item>) }
            </sui.DropdownMenu>
        </div>
    }
}

class SideDocs extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    setPath(path: string) {
        const docsUrl = pxt.webConfig.docsUrl || '/--docs';
        let el = document.getElementById("sidedocs") as HTMLIFrameElement;
        if (el)
            el.src = `${docsUrl}#doc:${path}`;
    }

    toggleVisibility() {
        const state = this.props.parent.state;
        this.props.parent.setState({ sideDocsCollapsed: !state.sideDocsCollapsed });
    }

    componentDidUpdate() {
        Blockly.fireUiEvent(window, 'resize');
    }

    renderCore() {
        const docsUrl = pxt.webConfig.docsUrl || '/--docs';
        const state = this.props.parent.state;
        const icon = state.sideDocsCollapsed ? "expand" : "compress";
        return <div>
            <iframe id="sidedocs" src={docsUrl} role="complementary" />
            <button id="sidedocsbutton" className="circular ui icon button" onClick={() => this.toggleVisibility() }>
                <i className={`${icon} icon`}></i>
            </button>
        </div>
    }
}

interface FileListState {
    expands: Util.Map<boolean>;
}

class FileList extends data.Component<ISettingsProps, FileListState> {

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            expands: {}
        }
    }

    renderCore() {
        let parent = this.props.parent
        if (!parent.state.showFiles)
            return null;

        let expands = this.state.expands;
        let removePkg = (p: pkg.EditorPackage) => {
            core.confirmAsync({
                header: lf("Remove {0} package", p.getPkgId()),
                body: lf("You are about to remove a package from your project. Are you sure?", p.getPkgId()),
                agreeClass: "red",
                agreeIcon: "trash",
                agreeLbl: lf("Remove it"),
            }).done(res => {
                if (res) {
                    pkg.mainEditorPkg().removeDepAsync(p.getPkgId())
                        .done(() => this.props.parent.reloadHeaderAsync());
                }
            })
        }

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
                        {/\.ts$/.test(file.name) ? <i className="keyboard icon"></i> : /\.blocks$/.test(file.name) ? <i className="puzzle icon"></i> : undefined }
                        {meta.isReadonly ? <i className="lock icon"></i> : null}
                        {!meta.numErrors ? null : <span className='ui label red'>{meta.numErrors}</span>}
                    </a>);
            })

        let togglePkg = (p: pkg.EditorPackage) => {
            expands[p.getPkgId()] = !expands[p.getPkgId()];
            this.forceUpdate();
        }

        let filesWithHeader = (p: pkg.EditorPackage) =>
            p.isTopLevel() ? filesOf(p) : [
                <div key={"hd-" + p.getPkgId() } className="header link item" onClick={() => togglePkg(p) }>
                    {p.getPkgId() != pxt.appTarget.id && p.getPkgId() != "built" ? <sui.Button class="primary label" icon="trash" onClick={() => removePkg(p) } /> : ''}
                    {p.getPkgId() }
                </div>
            ].concat(expands[p.getPkgId()] ? filesOf(p) : [])

        return (
            <div className={"ui vertical menu filemenu landscape only"}>
                {Util.concat(pkg.allEditorPkgs().map(filesWithHeader)) }
            </div>
        )
    }
}

export class ProjectView extends data.Component<IAppProps, IAppState> {
    editor: srceditor.Editor;
    editorFile: pkg.File;
    aceEditor: ace.Editor;
    pxtJsonEditor: pxtjson.Editor;
    blocksEditor: blocks.Editor;
    allEditors: srceditor.Editor[] = [];
    settings: EditorSettings;
    scriptSearch: ScriptSearch;
    shareEditor: ShareEditor;

    constructor(props: IAppProps) {
        super(props);
        document.title = pxt.appTarget.title || pxt.appTarget.name;
        this.settings = JSON.parse(pxt.storage.getLocal("editorSettings") || "{}")
        this.state = {
            showFiles: !!this.settings.showFiles,
            active: document.visibilityState == 'visible'
        };
        if (!this.settings.fileHistory) this.settings.fileHistory = [];
    }

    updateVisibility() {
        let active = document.visibilityState == 'visible';
        pxt.debug(`page visibility: ${active}`)
        this.setState({ active: active })
        if (!active) {
            this.stopSimulator();
            this.saveFileAsync().done();
        } else {
            if (workspace.isSessionOutdated()) {
                pxt.debug('workspace changed, reloading...')
                let id = this.state.header ? this.state.header.id : '';
                workspace.initAsync()
                    .done(() => id ? this.loadHeaderAsync(workspace.getHeader(id)) : Promise.resolve());
            } else if (pxt.appTarget.simulator.autoRun && !this.state.running)
                this.runSimulator();
        }
    }

    saveSettings() {
        let sett = this.settings
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

        pxt.storage.setLocal("editorSettings", JSON.stringify(this.settings))
    }

    componentDidUpdate() {
        this.saveSettings()
        this.editor.domUpdate();
        simulator.setState(this.state.header ? this.state.header.editor : '')
    }

    saveFile() {
        this.saveFileAsync().done()
    }

    saveFileAsync() {
        if (!this.editorFile)
            return Promise.resolve()
        return this.saveTypeScriptAsync()
            .then(() => {
                let txt = this.editor.getCurrentSource()
                return this.editorFile.setContentAsync(txt);
            });
    }

    public typecheckNow() {
        this.saveFile(); // don't wait for saving to backend store to finish before typechecking
        this.typecheck()
    }

    private autoRunSimulator = ts.pxt.Util.debounce(
        () => {
            if (!this.state.active)
                return;
            this.runSimulator({ background: true });
        },
        3000, false);
    private typecheck() {
        let state = this.editor.snapshotState()
        compiler.typecheckAsync()
            .done(resp => {
                this.editor.setDiagnostics(this.editorFile, state)
                if (pxt.appTarget.simulator && pxt.appTarget.simulator.autoRun) {
                    let output = pkg.mainEditorPkg().outputPkg.files["output.txt"];
                    if (output && !output.numDiagnosticsOverride
                        && !simulator.driver.debug
                        && (simulator.driver.state == pxsim.SimulatorState.Running || simulator.driver.state == pxsim.SimulatorState.Unloaded))
                        this.autoRunSimulator();
                }
            });
    }

    private initEditors() {
        this.aceEditor = new ace.Editor(this);
        this.pxtJsonEditor = new pxtjson.Editor(this);
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

        this.allEditors = [this.pxtJsonEditor, this.blocksEditor, this.aceEditor]
        this.allEditors.forEach(e => e.changeCallback = changeHandler)
        this.editor = this.allEditors[this.allEditors.length - 1]
    }

    public componentWillMount() {
        this.initEditors()
        this.initDragAndDrop();
    }

    public componentDidMount() {
        this.setSideDoc(pxt.appTarget.appTheme.sideDoc);
        this.allEditors.forEach(e => e.prepare())
        simulator.init($("#boardview")[0], {
            highlightStatement: stmt => {
                if (this.editor) this.editor.highlightStatement(stmt)
            },
            onCompile: (name, content, contentType) => {
                this.setState({
                    simulatorCompilation: { name: name, content: content, contentType: contentType }
                })
            },
            editor: this.state.header ? this.state.header.editor : ''
        })
        this.forceUpdate(); // we now have editors prepared
    }

    private pickEditorFor(f: pkg.File): srceditor.Editor {
        return this.allEditors.filter(e => e.acceptsFile(f))[0]
    }

    private updateEditorFile(editorOverride: srceditor.Editor = null) {
        if (!this.state.active)
            return;
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

        this.notifySideDocs({
            type: "fileloaded",
            name: this.editorFile.getName()
        } as pxsim.SimulatorFileLoadedMessage)
    }

    notifySideDocs(message: pxsim.SimulatorMessage) {
        let sd = document.getElementById("sidedocs") as HTMLIFrameElement;
        if (sd && sd.contentWindow) sd.contentWindow.postMessage(message, "*");
    }

    setFile(fn: pkg.File) {
        this.setState({
            currFile: fn,
            helpCard: undefined,
            errorCard: undefined
        })
    }

    setSideDoc(path: string) {
        let sd = this.refs["sidedoc"] as SideDocs;
        if (!sd) return;
        sd.setPath(path);
        this.setState({ sideDocsCollapsed: false });
    }

    reloadHeaderAsync() {
        return this.loadHeaderAsync(this.state.header)
    }

    loadHeaderAsync(h: Header): Promise<void> {
        if (!h)
            return Promise.resolve()

        this.stopSimulator(true);
        pxt.blocks.cleanBlocks();
        let logs = this.refs["logs"] as logview.LogView;
        logs.clear();
        this.setState({
            helpCard: undefined,
            errorCard: undefined,
            showFiles: h.editor == pxt.javaScriptProjectName
        })
        return pkg.loadPkgAsync(h.id)
            .then(() => {
                compiler.newProject();
                let e = this.settings.fileHistory.filter(e => e.id == h.id)[0]
                let main = pkg.getEditorPkg(pkg.mainPkg)
                let file = main.getMainFile()
                if (e && main.header.editor != "blocksprj")
                    file = main.lookupFile(e.name) || file
                this.setState({
                    header: h,
                    projectName: h.name,
                    currFile: file
                })
                core.infoNotification(lf("Project loaded: {0}", h.name))
                pkg.getEditorPkg(pkg.mainPkg).onupdate = () => {
                    this.loadHeaderAsync(h).done()
                }

                pkg.mainPkg.getCompileOptionsAsync()
                    .catch(e => {
                        if (e instanceof pxt.cpp.PkgConflictError) {
                            let confl = e as pxt.cpp.PkgConflictError
                            let remove = (lib: pxt.Package) => ({
                                label: lf("Remove {0}", lib.id),
                                class: "pink", // don't make them red and scary
                                icon: "trash",
                                onclick: () => {
                                    pkg.mainEditorPkg().removeDepAsync(lib.id)
                                        .then(() => this.reloadHeaderAsync())
                                        .done()
                                }
                            })
                            core.dialogAsync({
                                disagreeLbl: lf("Do nothing"),
                                buttons: [
                                    remove(confl.pkg0),
                                    remove(confl.pkg1),
                                ],
                                header: lf("Packages cannot be used together"),
                                body: lf("Packages '{0}' and '{1}' cannot be used together, because they use a differnet value for setting '{2}'.",
                                    confl.pkg0.id, confl.pkg0.id, confl.settingName)
                            })
                        }
                    })
                    .done()
            })
    }

    removeProject() {
        if (!pkg.mainEditorPkg().header) return;

        core.confirmDelete(pkg.mainEditorPkg().header.name, () => {
            let curr = pkg.mainEditorPkg().header
            curr.isDeleted = true
            return workspace.saveAsync(curr, {})
                .then(() => {
                    if (workspace.getHeaders().length > 0)
                        this.scriptSearch.modal.show();
                    else this.newProject();
                })
        })
    }

    importHexFile(file: File) {
        if (!file) return;
        pxt.cpp.unpackSourceFromHexFileAsync(file)
            .done(data => this.importHex(data));
    }

    importHex(data: pxt.cpp.HexFile) {
        let targetId = pxt.appTarget.id;
        if (!data || !data.meta) {
            core.warningNotification(lf("Sorry, we could not recognize this file."))
            return;
        }
        if (data.meta.cloudId == "microbit.co.uk" && data.meta.editor == "blockly") {
            pxt.debug('importing microbit.co.uk blocks project')
            compiler.getBlocksAsync()
                .then(info => this.newBlocksProjectAsync({
                    "main.blocks": pxt.blocks.importXml(info, data.source)
                }, data.meta.name)).done();
            return;
        } else if (data.meta.cloudId == "microbit.co.uk" && data.meta.editor == "touchdevelop") {
            pxt.debug('importing microbit.co.uk TD project')
            this.newBlocksProjectAsync({ "main.blocks": "<xml xmlns=\"http://www.w3.org/1999/xhtml\">", "main.ts": "  " }, data.meta.name)
                .then(() => tdlegacy.td2tsAsync(data.source))
                .then(text => {
                    // this is somewhat hacky...
                    this.aceEditor.overrideFile(text)
                    this.aceEditor.formatCode()
                })
            return;
        } else if (data.meta.cloudId == "ks/" + targetId || data.meta.cloudId == "pxt/" + targetId) {
            pxt.debug("importing project")
            let h: InstallHeader = {
                target: targetId,
                editor: data.meta.editor,
                name: data.meta.name,
                meta: {},
                pubId: "",
                pubCurrent: false
            };
            let files = JSON.parse(data.source);
            workspace.installAsync(h, files)
                .done(hd => this.loadHeaderAsync(hd));
            return;
        }

        core.warningNotification(lf("Sorry, we could not import this project."))
    }

    initDragAndDrop() {
        draganddrop.setupDragAndDrop(document.body,
            file => file.size < 1000000 && /^\.hex$/i.test(file.name),
            files => this.importHexFile(files[0])
        );
    }
    openProject() {
        pxt.tickEvent("menu.openproject");
        this.scriptSearch.setState({ packages: false, searchFor: '' })
        this.scriptSearch.modal.show()
    }

    addPackage() {
        pxt.tickEvent("menu.addpackage");
        this.scriptSearch.setState({ packages: true, searchFor: '' })
        this.scriptSearch.modal.show()
    }

    newEmptyProject() {
        this.newProject({
            "main.blocks": "<xml xmlns=\"http://www.w3.org/1999/xhtml\"></xml>"
        })
    }

    newProject(filesOverride?: Util.Map<string>) {
        pxt.tickEvent("menu.newproject");
        core.showLoading(lf("creating new project..."));
        this.newBlocksProjectAsync(filesOverride)
            .then(() => Promise.delay(1500))
            .done(() => core.hideLoading());
    }

    newBlocksProjectAsync(fileOverrides?: Util.Map<string>, nameOverride?: string) {
        return this.newProjectFromIdAsync(pxt.appTarget.blocksprj, fileOverrides, nameOverride);
    }

    newProjectFromIdAsync(prj: pxt.ProjectTemplate, fileOverrides?: Util.Map<string>, nameOverride?: string): Promise<void> {
        let cfg = pxt.U.clone(prj.config);
        cfg.name = nameOverride || lf("Untitled") // pxt.U.fmt(cfg.name, Util.getAwesomeAdj());
        let files: ScriptText = Util.clone(prj.files)
        if (fileOverrides)
            Util.jsonCopyFrom(files, fileOverrides)
        // remove markdown files
        cfg.files = cfg.files.filter(f => !/\.md$/i.test(f));
        for (let fk in files)
            if (/\.md$/i.test(fk)) delete files[fk];
        files["pxt.json"] = JSON.stringify(cfg, null, 4) + "\n"
        return workspace.installAsync({
            name: cfg.name,
            meta: {},
            editor: prj.id,
            pubId: "",
            pubCurrent: false,
            target: pxt.appTarget.id
        }, files)
            .then(hd => this.loadHeaderAsync(hd))
    }

    saveTypeScriptAsync(open = false): Promise<void> {
        if (!this.editor || !this.state.currFile || this.editorFile.epkg != pkg.mainEditorPkg())
            return Promise.resolve();
        let src = this.editor.saveToTypeScript()

        if (!src) return Promise.resolve();
        // format before saving
        src = ts.pxt.format(src, 0).formatted;

        let mainPkg = pkg.mainEditorPkg();
        let tsName = this.editorFile.getVirtualFileName();
        Util.assert(tsName != this.editorFile.name);
        return mainPkg.setContentAsync(tsName, src).then(() => {
            if (open) {
                let f = mainPkg.files[tsName];
                this.setFile(f);
            }
        })
    }

    compile() {
        pxt.tickEvent("compile");

        if (pxt.appTarget.compile.simulatorPostMessage) {
            let cmp = this.state.simulatorCompilation;
            if (cmp)
                pxt.BrowserUtils.browserDownloadText(cmp.content, cmp.name, cmp.contentType);
            return;
        }

        pxt.debug('compiling...')
        this.clearLog();
        this.editor.beforeCompile();
        let state = this.editor.snapshotState()
        compiler.compileAsync({ native: true })
            .then(resp => {
                this.editor.setDiagnostics(this.editorFile, state)
                if (!resp.outfiles[ts.pxt.BINARY_HEX]) {
                    core.warningNotification(lf("Compilation failed, please check your code for errors."));
                    return Promise.resolve()
                }
                return pxt.commands.deployCoreAsync(resp)
                    .catch(e => {
                        core.warningNotification(lf(".hex file upload, please try again."));
                        pxt.reportException(e, resp);
                    })
            }).done();
    }

    stopSimulator(unload = false) {
        simulator.stop(unload)
        this.setState({ running: false })
    }

    clearLog() {
        let logs = this.refs["logs"] as logview.LogView;
        logs.clear();
    }

    runSimulator(opts: compiler.CompileOptions = {}) {
        pxt.tickEvent(opts.background ? "autorun" :
            opts.debug ? "debug" : "run");

        if (!opts.background)
            this.editor.beforeCompile();

        this.stopSimulator();
        this.clearLog();
        this.setState({ simulatorCompilation: undefined })

        let state = this.editor.snapshotState()
        compiler.compileAsync(opts)
            .then(resp => {
                this.editor.setDiagnostics(this.editorFile, state)
                if (resp.outfiles[ts.pxt.BINARY_JS]) {
                    simulator.run(opts.debug, resp)
                    this.setState({ running: true })
                } else if (!opts.background) {
                    core.warningNotification(lf("Oops, we could not run this project. Please check your code for errors."))
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

    importHexFileDialog() {
        let input: HTMLInputElement;
        core.confirmAsync({
            header: lf("Import .hex file"),
            onLoaded: ($el) => {
                input = $el.find('input')[0] as HTMLInputElement;
            },
            htmlBody: `<div class="ui form">
  <div class="ui field">
    <label>${lf("Select an .hex file to import.")}</label>
    <input type="file"></input>
  </div>
</div>`,
        }).done(res => {
            if (res) {
                this.importHexFile(input.files[0]);
            }
        })
    }

    publishAsync(): Promise<string> {
        pxt.tickEvent("publish");
        this.setState({ publishing: true })
        let mpkg = pkg.mainPkg
        let epkg = pkg.getEditorPkg(mpkg)
        return this.saveFileAsync()
            .then(() => mpkg.filesToBePublishedAsync(true))
            .then(files => {
                if (epkg.header.pubCurrent)
                    return Promise.resolve(epkg.header.pubId)
                let meta = {
                    description: mpkg.config.description,
                    islibrary: false
                }
                // TODO pass blocks workspace size here
                return workspace.publishAsync(epkg.header, files, meta)
                    .then(inf => inf.id)
            }).finally(() => {
                this.setState({ publishing: false })
            })
            .catch(e => {
                core.errorNotification(e.message)
                return undefined;
            })
    }

    setErrorCard(card: pxt.CodeCard, onClick?: (e: React.MouseEvent) => boolean) {
        this.setState({
            errorCard: card,
            errorCardClick: onClick
        })
    }

    setHelpCard(card: pxt.CodeCard, onClick?: (e: React.MouseEvent) => boolean) {
        this.setState({
            helpCard: card,
            helpCardClick: onClick
        })
    }

    private debouncedSaveProjectName = Util.debounce(() => this.saveProjectName(), 2000, false);

    updateHeaderName(name: string) {
        this.setState({
            projectName: name
        })
        this.debouncedSaveProjectName();
    }

    saveProjectName() {
        if (!this.state.projectName || !this.state.header) return;

        pxt.debug('saving project name to ' + this.state.projectName);
        try {
            let f = pkg.mainEditorPkg().lookupFile("this/" + pxt.configName);
            let config = JSON.parse(f.content) as pxt.PackageConfig;
            config.name = this.state.projectName;
            f.setContentAsync(JSON.stringify(config, null, 2)).done(() => {
                if (this.state.header)
                    this.setState({
                        projectName: this.state.header.name
                    })
            });
        }
        catch (e) {
            console.error('failed to read pxt.json')
        }
    }

    about() {
        pxt.tickEvent("menu.about");
        core.confirmAsync({
            header: lf("About {0}", pxt.appTarget.name),
            htmlBody: `
<p>${Util.htmlEscape(pxt.appTarget.name)} version: ${targetVersion}</p>
<p>${lf("PXT version: {0}", ksVersion)}</p>                        
`
        }).done();
    }

    embed() {
        pxt.tickEvent("menu.embed");
        this.shareEditor.modal.show();
    }

    renderCore() {
        theEditor = this;

        if (this.editor && this.editor.isReady) {
            this.updateEditorFile();
        }

        //  ${targetTheme.accentColor ? "inverted accent " : ''}
        const settings: Cloud.UserSettings = (Cloud.isLoggedIn() ? this.getData("cloud:me/settings?format=nonsensitive") : {}) || {}
        const targetTheme = pxt.appTarget.appTheme;
        const workspaces = pxt.appTarget.cloud && pxt.appTarget.cloud.workspaces;
        const packages = pxt.appTarget.cloud && pxt.appTarget.cloud.packages;
        const compile = pxt.appTarget.compile;
        const compileDisabled = !compile || (compile.simulatorPostMessage && !this.state.simulatorCompilation);
        const devSignin = !pxtwinrt.isWinRT();

        return (
            <div id='root' className={`full-abs ${this.state.hideEditorFloats ? " hideEditorFloats" : ""} ${this.state.sideDocsCollapsed ? "" : "sideDocs"}` }>
                <div id="menubar" role="banner">
                    <div className={`ui borderless small menu`} role="menubar">
                        <span id="logo" className="ui item">
                            {targetTheme.logo || targetTheme.portraitLogo
                                ? <a className="ui image" target="_blank" href={targetTheme.logoUrl}><img className={`ui logo ${targetTheme.portraitLogo ? " landscape only" : ''}`} src={Util.toDataUri(targetTheme.logo || targetTheme.portraitLogo) } /></a>
                                : <span>{targetTheme.name}</span>}
                            {targetTheme.portraitLogo ? (<a className="ui image" target="_blank" href={targetTheme.logoUrl}><img className='ui logo portrait only' src={Util.toDataUri(targetTheme.portraitLogo) } /></a>) : null }
                        </span>
                        <div className="ui item">
                            <div className="ui">
                                {pxt.appTarget.compile ? <sui.Button role="menuitem" class='icon blue portrait only' icon='icon download' onClick={() => this.compile() } /> : "" }
                                <sui.Button role="menuitem" key='runmenubtn' class={(this.state.running ? "teal" : "orange") + " portrait only"} icon={this.state.running ? "stop" : "play"} onClick={() => this.state.running ? this.stopSimulator() : this.runSimulator() } />
                                <sui.Button role="menuitem" class="ui wide portrait only" icon="undo" onClick={() => this.editor.undo() } />
                                <sui.Button role="menuitem" class="ui wide landscape only" text={lf("Undo") } icon="undo" onClick={() => this.editor.undo() } />
                                {this.editor.menu() }
                                { this.state.header && packages ? <sui.Button role="menuitem" class="landscape only" text={lf("Embed") } icon="share alternate" onClick={() => this.embed() } /> : null}
                                { workspaces ? <CloudSyncButton parent={this} /> : null }
                            </div>
                            <div className="ui buttons">
                                <sui.DropdownMenu class='floating icon button' text={lf("More...") } textClass="ui landscape only" icon='sidebar'>
                                    <sui.Item role="menuitem" icon="file outline" text={lf("New Project...") } onClick={() => this.newEmptyProject() } />
                                    <sui.Item role="menuitem" icon="folder open" text={lf("Open Project...") } onClick={() => this.openProject() } />
                                    {this.state.header ? <div className="ui divider"></div> : undefined }
                                    {this.state.header ? <sui.Item role="menuitem" icon='folder' text={this.state.showFiles ? lf("Hide Files") : lf("Show Files") } onClick={() => {
                                        pxt.tickEvent("menu.showfiles");
                                        this.setState({ showFiles: !this.state.showFiles });
                                        this.saveSettings();
                                    } } /> : undefined}
                                    {this.state.header ? <sui.Item role="menuitem" icon="disk outline" text={lf("Add Package...") } onClick={() => this.addPackage() } /> : undefined }
                                    {this.state.header ? <sui.Item role="menuitem" icon="setting" text={lf("Project Settings...") } onClick={() => this.setFile(pkg.mainEditorPkg().lookupFile("this/pxt.json")) } /> : undefined}
                                    <div className="ui divider"></div>
                                    <a className="ui item thin only" href="/docs" role="menuitem" target="_blank">
                                        <i className="help icon"></i>
                                        {lf("Help") }
                                    </a>
                                    { devSignin ? <LoginBox /> : undefined }
                                    {
                                        // we always need a way to clear local storage, regardless if signed in or not 
                                    }
                                    <sui.Item role="menuitem" icon='sign out' text={devSignin ? lf("Sign out / Reset") : lf("Reset") } onClick={() => LoginBox.signout() } />
                                    <div className="ui divider"></div>
                                    { targetTheme.privacyUrl ? <a className="ui item" href={targetTheme.privacyUrl} role="menuitem" target="_blank">{lf("Privacy & Cookies") }</a> : undefined }
                                    { targetTheme.termsOfUseUrl ? <a className="ui item" href={targetTheme.termsOfUseUrl} role="menuitem" target="_blank">{lf("Terms Of Use") }</a> : undefined }
                                    <sui.Item role="menuitem" text={lf("About...") } onClick={() => this.about() } />
                                </sui.DropdownMenu>
                            </div>
                            <div className="ui">
                                {Cloud.isLoggedIn() ? <sui.Button class="wide only" role="menuitem" icon='user' onClick={() => LoginBox.showUserPropertiesAsync(settings).done() } /> : undefined}
                            </div>
                            <DocsMenu parent={this} />
                        </div>
                        <div className="ui item wide only">
                            <div className="ui massive transparent input">
                                <input
                                    type="text"
                                    placeholder={lf("Pick a name...") }
                                    value={this.state.projectName || ''}
                                    onChange={(e) => this.updateHeaderName((e.target as any).value) }>
                                </input>
                                <i className={"write icon " + ((this.state.header && this.state.projectName == this.state.header.name) ? "grey" : "back") }></i>
                            </div>
                        </div>
                        {targetTheme.rightLogo ?
                            <div className="ui item right wide only">
                                <a target="_blank" id="rightlogo" href={targetTheme.logoUrl}><img src={Util.toDataUri(targetTheme.rightLogo) } /></a>
                            </div> : null }
                    </div>
                </div>
                <div id="filelist" className="ui items" role="complementary">
                    {this.state.errorCard ? <div id="errorcard" className="ui item">
                        <codecard.CodeCardView className="fluid top-margin" responsive={true} onClick={this.state.errorCardClick} {...this.state.errorCard} target={pxt.appTarget.id} />
                    </div> : null }
                    <div id="boardview" className={`ui vertical editorFloat ${this.state.helpCard ? "landscape only " : ""} ${this.state.errorCard ? "errored " : ""}`}>
                    </div>
                    <div className="ui item landscape only">
                        {compile ? <sui.Button icon='icon download' class="blue" text={lf("Compile") } disabled={compileDisabled} onClick={() => this.compile() } /> : ""}
                        <sui.Button key='runbtn' class={this.state.running ? "teal" : "orange"} icon={this.state.running ? "stop" : "play"} text={this.state.running ? lf("Stop") : lf("Play") } onClick={() => this.state.running ? this.stopSimulator() : this.runSimulator() } />
                        {pxt.debugMode() && !this.state.running ? <sui.Button key='debugbtn' class='teal' icon="play" text={lf("Debug") } onClick={() => this.runSimulator({ debug: true }) } /> : ''}
                    </div>
                    <div className="ui editorFloat landscape only">
                        <logview.LogView ref="logs" />
                    </div>
                    <FileList parent={this} />
                </div>
                <div id="maineditor" role="main">
                    {this.allEditors.map(e => e.displayOuter()) }
                    {this.state.helpCard ? <div id="helpcard" className="ui editorFloat wide only"><codecard.CodeCardView responsive={true} onClick={this.state.helpCardClick} {...this.state.helpCard} target={pxt.appTarget.id} /></div> : null }
                </div>
                <SideDocs ref="sidedoc" parent={this} />
                {targetTheme.organizationLogo ? <img className="organization" src={Util.toDataUri(targetTheme.organizationLogo) } /> : undefined }
                <ScriptSearch parent={this} ref={v => this.scriptSearch = v} />
                <ShareEditor parent={this} ref={v => this.shareEditor = v} />
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

let logoSvgXml = `<svg xmlns='http://www.w3.org/2000/svg' viewBox="0 0 128 128" preserveAspectRatio="xMinYMin"><title>Programming Experience Toolkit logo</title><path fill="#ff7d00" d="M 48.7156,57.6831C 48.7156,59.6258 48.0158,61.2801 46.6154,62.6473C 45.2156,64.0145 43.5373,64.6974 41.5809,64.6974C 39.6251,64.6974 37.9663,64.0145 36.6069,62.6473C 35.2469,61.2801 34.5665,59.6258 34.5665,57.6831C 34.5665,55.7 35.2469,54.0151 36.6069,52.6291C 37.9663,51.2417 39.6251,50.5483 41.5809,50.5483C 43.5373,50.5483 45.2156,51.2417 46.6154,52.6291C 48.0158,54.0151 48.7156,55.7 48.7156,57.6831 Z M 93.4324,57.6831C 93.4324,59.6258 92.7326,61.2801 91.3322,62.6473C 89.9324,64.0145 88.2541,64.6975 86.2977,64.6975C 84.342,64.6975 82.6831,64.0145 81.3237,62.6473C 79.9637,61.2801 79.2834,59.6258 79.2834,57.6831C 79.2834,55.7001 79.9637,54.0152 81.3237,52.6291C 82.6831,51.2417 84.342,50.5484 86.2977,50.5484C 88.2541,50.5484 89.9324,51.2417 91.3322,52.6291C 92.7326,54.0152 93.4324,55.7001 93.4324,57.6831 Z M 27.2559,102.439C 24.5091,102.43 21.9146,101.831 19.5905,100.725C 13.1421,98.316 9.91797,92.9285 9.91797,84.562L 9.91797,67.4895C 9.91797,59.8329 6.61214,55.8157 4.19718e-006,55.4384L 4.19718e-006,48.4268C 6.61214,48.0494 9.91797,43.9532 9.91797,36.1383L 9.91797,19.5404C 9.91797,9.37168 14.5536,3.54519 23.8242,2.06057C 25.3494,1.70022 26.9508,1.53021 28.5964,1.57473L 38.7526,1.57473L 47.0408,1.64846L 52.7508,1.7383L 54.6969,1.81211L 55.3929,1.81211L 55.883,1.90171L 56.5788,2.13894L 56.9267,2.37624L 57.403,2.77688L 58.1769,3.74197L 58.589,5.74579L 58.589,6.31L 58.4471,6.94785C 58.188,7.86151 57.9905,8.03802 57.687,8.78802L 56.6429,11.4297L 54.4909,16.4758L 54.4128,16.7292L 54.3489,16.8766C 54.36,16.854 54.0537,18.3801 54.619,20.0087C 55.1951,21.6374 56.3283,23.2884 58.1769,24.2535C 60.2427,25.3177 60.3514,25.6929 63.9512,25.4557L 64.0151,25.4557C 66.0281,25.3562 66.8883,24.9043 67.3672,24.5804C 67.7793,24.292 67.7679,24.0291 68.7593,23.2147C 69.7475,22.2752 70.2041,18.9958 69.7252,17.6782L 69.7252,17.6045L 65.9752,6.62079L 65.6912,5.90912L 65.6912,5.18142L 65.9752,3.74197L 66.4512,2.77688L 66.9412,2.21259L 67.3672,1.90171L 68.1912,1.501L 68.7593,1.33743L 69.3773,1.24766L 70.7694,1.24766L 74.8034,1.24766L 78.7736,1.33743L 80.1655,1.33743L 80.6556,1.33743L 100.492,1.33743C 101.943,1.33743 103.352,1.50173 104.702,1.81854C 113.622,3.41709 118.082,9.13641 118.082,18.9767L 118.082,36.0492C 118.082,43.706 121.388,47.7231 128,48.1004L 128,55.112C 121.388,55.4893 118.082,59.5855 118.082,67.4005L 118.082,83.9982C 118.082,93.4771 114.054,99.183 105.998,101.116C 104.675,101.597 103.276,101.928 101.826,102.199L 75.3507,102.125L 77.3747,107.899L 77.3747,107.973C 79.0924,112.808 78.2656,118.729 74.3846,122.4L 74.3066,122.474L 74.1647,122.637C 75.0472,121.961 73.6971,123.301 72.2186,124.33C 70.7625,125.33 68.6632,126.17 65.7485,126.333C 61.3774,126.596 58.8441,125.468 56.9062,124.477L 56.8421,124.403C 53.3397,122.55 51.0347,119.37 49.8822,116.062C 48.7599,112.869 48.543,109.55 49.946,106.534L 50.0241,106.207L 51.48,102.6L 27.2559,102.439 Z M 46.8426,94.8082L 54.2,94.9127L 56.1462,94.9865L 56.8423,94.9865L 57.3322,95.0761L 58.028,95.3133L 58.376,95.5507L 58.8522,95.9513L 59.6261,96.9164L 60.0382,98.9202L 60.0382,99.4844L 59.8963,100.122C 59.6372,101.036 59.4398,101.212 59.1364,101.962L 58.0921,104.604L 55.9401,109.65L 55.862,109.904L 55.7982,110.051C 55.8094,110.028 55.5031,111.554 56.0682,113.183C 56.6445,114.812 57.7775,116.463 59.6261,117.428C 61.6919,118.492 61.8006,118.867 65.4004,118.63L 65.4645,118.63C 67.4774,118.531 68.3377,118.079 68.8164,117.755C 69.2285,117.466 69.2171,117.203 70.2085,116.389C 71.1968,115.45 71.6535,112.17 71.1745,110.853L 71.1745,110.779L 67.4245,99.7952L 67.1405,99.0835L 67.1405,98.3558L 67.4245,96.9164L 67.9004,95.9513L 68.3906,95.3871L 68.8164,95.0761L 69.6405,94.6755L 70.2085,94.5118L 70.8267,94.422L 72.2187,94.422L 76.2528,94.422L 100.335,94.5118C 102.24,94.4408 103.923,93.9845 105.343,93.2599C 108.05,91.4841 109.404,88.2204 109.404,83.4688L 109.404,66.6154C 109.404,58.5692 112.465,53.6271 118.586,51.7889L 118.586,51.5515C 112.465,49.8352 109.404,44.9416 109.404,36.871L 109.404,20.2915C 109.404,16.0553 108.665,13.0273 107.186,11.2074L 106.733,10.7103C 105.016,9.67338 102.865,9.02502 100.493,9.02502L 74.7397,8.95121L 73.9017,8.95121L 75.9258,14.7251L 75.9258,14.799C 77.6435,19.6335 76.8167,25.5547 72.9357,29.2255L 72.8577,29.2994L 72.7157,29.4629C 73.5983,28.7863 72.248,30.1265 70.7695,31.1554C 69.3136,32.1558 67.2143,32.9957 64.2995,33.1591C 59.9284,33.4221 57.395,32.2936 55.4572,31.3029L 55.3932,31.2292C 51.8909,29.376 49.5858,26.196 48.4331,22.8873C 47.3112,19.6944 47.0942,16.3762 48.4971,13.3594L 48.575,13.0324L 50.0311,9.42582L 46.9632,9.35209L 38.7531,9.26225L 28.4548,9.26225C 25.8991,9.18282 23.7018,9.77942 21.954,10.7993C 19.7158,12.6595 18.5967,15.7498 18.5967,20.0701L 18.5967,36.9235C 18.5967,44.9698 15.536,49.912 9.41457,51.7501L 9.41457,51.9876C 15.536,53.7039 18.5967,58.5974 18.5967,66.6678L 18.5967,83.2474C 18.5967,87.4836 19.336,90.5116 20.8146,92.3315C 21.3,92.9286 21.9022,93.4317 22.6216,93.8408C 24.0205,94.4158 25.6138,94.7517 27.3215,94.7517L 46.8426,94.8082 Z "/></svg>`;

function initLogin() {
    {
        let qs = core.parseQueryString((location.hash || "#").slice(1).replace(/%23access_token/, "access_token"))
        if (qs["access_token"]) {
            let ex = pxt.storage.getLocal("oauthState")
            if (ex && ex == qs["state"]) {
                pxt.storage.setLocal("access_token", qs["access_token"])
                pxt.storage.removeLocal("oauthState")
            }
            location.hash = location.hash.replace(/(%23)?[\#\&\?]*access_token.*/, "")
        }
        Cloud.accessToken = pxt.storage.getLocal("access_token") || "";
    }

    {
        let qs = core.parseQueryString((location.hash || "#").slice(1).replace(/%local_token/, "local_token"))
        if (qs["local_token"]) {
            pxt.storage.setLocal("local_token", qs["local_token"])
            location.hash = location.hash.replace(/(%23)?[\#\&\?]*local_token.*/, "")
        }
        Cloud.localToken = pxt.storage.getLocal("local_token") || "";
    }
}

function initSerial() {
    if (!pxt.appTarget.serial || !/^http:\/\/localhost/i.test(window.location.href) || !Cloud.localToken)
        return;

    pxt.debug('initializing serial pipe');
    let ws = new WebSocket('ws://localhost:3233/' + Cloud.localToken + '/serial');
    ws.onopen = (ev) => {
        pxt.debug('serial: socket opened');
    }
    ws.onclose = (ev) => {
        pxt.debug('serial: socket closed')
    }
    ws.onmessage = (ev) => {
        try {
            let msg = JSON.parse(ev.data) as pxsim.SimulatorMessage;
            if (msg && msg.type == 'serial')
                window.postMessage(msg, "*")
        }
        catch (e) {
            pxt.debug('unknown message: ' + ev.data);
        }
    }
}

function getsrc() {
    pxt.log(theEditor.editor.getCurrentSource())
}

function enableAnalytics(version: string) {
    enableAppInsights(version);
    enableMixPanel(version);
}

function enableAppInsights(version: string) {
    // TODO: use json configuration
    let ai = (window as any).appInsights;
    if (!ai) return;

    ai.trackPageView();
    let rexp = pxt.reportException;
    pxt.reportException = function (err: any, data: any): void {
        if (rexp) rexp(err, data);
        let props: pxt.U.Map<string> = {};
        if (data)
            for (let k in data)
                props[k] = typeof data[k] === "string" ? data[k] : JSON.stringify(data[k]);
        ai.trackException(err, 'exception', props)
    }
    let re = pxt.reportError;
    pxt.reportError = function (msg: string, data: any): void {
        if (re) re(msg, data);
        try {
            throw msg
        }
        catch (err) {
            let props: pxt.U.Map<string> = {};
            if (data)
                for (let k in data)
                    props[k] = typeof data[k] === "string" ? data[k] : JSON.stringify(data[k]);
            ai.trackException(err, 'error', props)
        }
    }
}

function enableMixPanel(version: string) {
    let mp = (window as any).mixpanel;
    if (!mp) return;

    let report = pxt.reportError;
    pxt.reportError = function (msg: string, data: any): void {
        mp.track("error:" + msg);
        report(msg, data);
    }
    pxt.tickEvent = function (id: string): void {
        if (!id) return;
        try {
            mp.track(id.toLowerCase());
        } catch (e) {
            pxt.log(e);
        }
    }
}

function showIcons() {
    let usedIcons = [
        "cancel", "certificate", "checkmark", "cloud", "cloud upload", "copy", "disk outline", "download",
        "dropdown", "edit", "file outline", "find", "folder", "folder open", "help circle",
        "keyboard", "lock", "play", "puzzle", "search", "setting", "settings",
        "share alternate", "sign in", "sign out", "square", "stop", "translate", "trash", "undo", "upload",
        "user", "wizard",
    ]
    core.confirmAsync({
        header: "Icons",
        htmlBody:
        usedIcons.map(s => `<i style='font-size:2em' class="ui icon ${s}"></i>&nbsp;${s}&nbsp; `).join("\n")
    })
}

function assembleCurrent() {
    compiler.compileAsync({ native: true })
        .then(() => compiler.assembleAsync(getEditor().editorFile.content))
        .then(v => {
            let nums = v.words
            pxt.debug("[" + nums.map(n => "0x" + n.toString(16)).join(",") + "]")
        })
}


// This is for usage from JS console
let myexports: any = {
    workspace,
    require,
    core,
    getEditor,
    ace,
    compiler,
    pkg,
    getsrc,
    sim: simulator,
    apiAsync: core.apiAsync,
    showIcons,
    hwdbg,
    assembleCurrent
};
(window as any).E = myexports;

export var ksVersion: string;
export var targetVersion: string;

function initTheme() {
    if (pxt.appTarget.appTheme.accentColor) {
        let style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = `.ui.accent { color: ${pxt.appTarget.appTheme.accentColor}; }
        .ui.inverted.menu .accent.active.item, .ui.inverted.accent.menu  { background-color: ${pxt.appTarget.appTheme.accentColor}; }`;
        document.getElementsByTagName('head')[0].appendChild(style);
    }
    // RTL languages
    if (/^ar/i.test(Util.userLanguage())) {
        pxt.debug("rtl layout");
        document.body.classList.add("rtl");
        document.body.style.direction = "rtl";
    }
}

function parseHash(): { cmd: string; arg: string } {
    let hashCmd = ""
    let hashArg = ""
    let hashM = /^#(\w+)(:([\/\-\w]+))?$/.exec(window.location.hash)
    if (hashM) {
        window.location.hash = ""
        return { cmd: hashM[1], arg: hashM[3] || '' };
    }
    return { cmd: '', arg: '' };
}

function handleHash(hash: { cmd: string; arg: string }) {
    if (!hash) return;
    let editor = theEditor;
    if (!editor) return;
    switch (hash.cmd) {
        case "doc":
            pxt.tickEvent("hash.doc")
            editor.setSideDoc(hash.arg);
            break;
        case "follow":
            pxt.tickEvent("hash.follow")
            editor.setSideDoc(hash.arg);
            editor.newEmptyProject();
            break;
        case "newproject":
            pxt.tickEvent("hash.newproject")
            editor.newEmptyProject();
            break;
        case "gettingstarted":
            pxt.tickEvent("hash.gettingstarted")
            editor.newProject();
            break;
    }
}

function initHashchange() {
    window.addEventListener("hashchange", e => {
        handleHash(parseHash());
    });
}

$(document).ready(() => {
    pxt.setupWebConfig((window as any).pxtConfig);
    let config = pxt.webConfig
    ksVersion = config.pxtVersion;
    targetVersion = config.targetVersion;
    let lang = /lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
    pxt.setDebugMode(/dbg=1/i.test(window.location.href));

    enableAnalytics(ksVersion)
    appcache.init();
    initLogin();

    let hash = parseHash();

    let hm = /^(https:\/\/[^/]+)/.exec(window.location.href)
    if (hm) Cloud.apiRoot = hm[1] + "/api/"

    let ws = /ws=(\w+)/.exec(window.location.href)
    if (ws) workspace.setupWorkspace(ws[1])
    else if (Cloud.isLocalHost()) workspace.setupWorkspace("fs");

    pxt.docs.requireMarked = () => require("marked");

    const ih = (hex: pxt.cpp.HexFile) => theEditor.importHex(hex);
    const cfg = pxt.webConfig;
    Util.httpGetJsonAsync(config.targetCdnUrl + "target.json")
        .then(pkg.setupAppTarget)
        .then(() => Util.updateLocalizationAsync(cfg.pxtCdnUrl, lang ? lang[1] : (navigator.userLanguage || navigator.language)))
        .then(() => initTheme())
        .then(() => cmds.initCommandsAsync())
        .then(() => {
            return compiler.init();
        })
        .then(() => workspace.initAsync())
        .then(() => {
            $("#loading").remove();
            render()
            workspace.syncAsync().done()
        })
        .then(() => {
            initSerial()
            initHashchange();
            return pxtwinrt.initAsync(ih);
        }).then(() => {
            switch (hash.cmd) {
                case "pub":
                case "edit":
                    let existing = workspace.getHeaders().filter(h => h.pubCurrent && h.pubId == hash.arg)[0]
                    if (existing)
                        return theEditor.loadHeaderAsync(existing)
                    else return workspace.installByIdAsync(hash.arg)
                        .then(hd => theEditor.loadHeaderAsync(hd))
                default:
                    handleHash(hash); break;
            }

            let ent = theEditor.settings.fileHistory.filter(e => !!workspace.getHeader(e.id))[0]
            let hd = workspace.getHeaders()[0]
            if (ent)
                hd = workspace.getHeader(ent.id)
            if (hd) return theEditor.loadHeaderAsync(hd)
            else theEditor.newProject();
            return Promise.resolve();
        }).done();

    document.addEventListener("visibilitychange", ev => {
        theEditor.updateVisibility();
    });

    window.addEventListener("unload", ev => {
        if (theEditor && !LoginBox.signingOut)
            theEditor.saveSettings()
    })

})
