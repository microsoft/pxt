/// <reference path="../../built/kindlib.d.ts"/>
/// <reference path="../../built/kindblocks.d.ts"/>

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
import {LoginBox} from "./login"

import * as ace from "./ace"
import * as kindjson from "./kindjson"
import * as blocks from "./blocks"
import * as codecard from "./codecard"
import * as logview from "./logview"
import * as draganddrop from "./draganddrop";

import Cloud = ks.Cloud;
import Util = ks.Util;
var lf = Util.lf

declare module Raygun {
    function init(apiKey: string, options: any): {
        attach: () => void;
    }
    function send(err: any, data: any): void;
    function setVersion(v: string): void;
    function saveIfOffline(b: boolean): void;
}

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
    helpCard?: ks.CodeCard;
    helpCardClick?: (e: React.MouseEvent) => boolean;
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

class CloudSyncButton extends data.Component<ISettingsProps, {}> {
    renderCore() {
        Util.assert(this.props.parent.appTarget.cloud);

        let par = this.props.parent
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
        let needsUpload = hd && !hd.blobCurrent
        return <sui.Button class={btnClass} onClick={save}
            icon={"cloud " + (needsUpload ? "upload" : "") }
            popup={btnClass ? lf("Uploading...") : needsUpload ? lf("Will upload. Click to sync.") : lf("Stored in the cloud. Click to sync.") }
            />
    }
}

class ScriptSearch extends data.Component<ISettingsProps, { searchFor: string; }> {
    prevData: Cloud.JsonScript[] = [];
    modal: sui.Modal;
    
    fetchCloudData() : Cloud.JsonScript[] {
        if(!this.props.parent.appTarget.cloud) return [];
        
        let res = this.state.searchFor ?
            this.getData("cloud:scripts?q=" + encodeURIComponent(this.state.searchFor)) 
            : null
        if (res)
            this.prevData = res.items
        let data = this.prevData
        return data;
    }
    
    fetchLocalData() : workspace.Header[] {
        let headers: workspace.Header[] = this.getData("header:*")                
        if (this.state.searchFor)
            headers = headers.filter(hdr => hdr.name.toLowerCase().indexOf(this.state.searchFor.toLowerCase()) > -1);
        return headers;
    }

    renderCore() { 
        let headers = this.fetchLocalData();              
        let data = this.fetchCloudData();

        let chgHeader = (hdr: workspace.Header) => {
            if (this.modal) this.modal.hide();
            this.props.parent.loadHeader(hdr)
        }        
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
        /*
    interface CodeCard {
        name: string;
        color?: string;
        description?: string;
        promoUrl?: string;
        blocksXml?: string;
        header?: string;
        time?: number;
        card?: ks.PackageCard;
        url?: string;
        responsive?: boolean;
        target?: string;
    }        
        */
        return (
            <sui.Modal ref={v => this.modal = v} header={lf("Open script...") } addClass="large searchdialog" >

                <div className="ui segment items">
                    <div className="ui item fluid icon input">
                        <input type="text" placeholder="Search..." onChange={upd} />
                        <i className="search icon"/>
                    </div>
                    <div className="ui item cards">
                        {headers.map(scr => 
                            <codecard.CodeCardView 
                                    key={'local' + scr.id}
                                    name={scr.name} 
                                    time={scr.recentUse}
                                    description={lf("local script")}
                                    onClick={() => chgHeader(scr)}
                            />
                         )}
                        {data.map(scr =>
                            <codecard.CodeCardView                            
                                name={scr.name}
                                time={scr.time}
                                description={scr.username}
                                key={'cloud' + scr.id} 
                                onClick={() => install(scr) }
                                url={'/' + scr.id} />
                        ) }
                    </div>
                </div>
            </sui.Modal>
        );
    }
}

class EmbedDesigner extends data.Component<ISettingsProps, {}> {
    renderCore() {
        let header = this.props.parent.state.header;
        if (!header) return <div></div>;
        
        let url = `https://${window.location.host}/--run?`;
        if (header.pubId) url += `id=${header.pubId}`;
        else {
            // read main file
            let code = pkg.mainPkg.readFile(header.editor == 'tsprj' ? 'main.ts': 'main.blocks.ts');
            url += `code=${encodeURIComponent(code)}`; 
        }
        
        let embed = `<iframe width="100%" height="300" src="${url}" allowfullscreen="allowfullscreen" frameborder="0"></iframe>`
        
        return (
<sui.Popup text={lf("Embed")} icon='share alternate'>
    <div className='ui form'>
        <h4 className="ui dividing header">Copy the url and embed the simulator in your pages!</h4>
        <sui.Field><sui.Input lines={2} value={embed} /></sui.Field>
    </div>
</sui.Popup>)
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
    kindJsonEditor: kindjson.Editor;
    blocksEditor: blocks.Editor;
    allEditors: srceditor.Editor[] = [];
    settings: EditorSettings;
    scriptSearch: ScriptSearch;
    appTarget: ks.AppTarget;

    constructor(props: IAppProps) {
        super(props);

        this.appTarget = pkg.appTarget;

        document.title = lf("{0} powered by KindScript", this.appTarget.title || this.appTarget.name)

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
        if (!this.settings.fileHistory) this.settings.fileHistory = [];
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
        simulator.setState(this.state.header ? this.state.header.editor : '')
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
        let txt = this.editor.getCurrentSource()
        return this.editorFile.setContentAsync(txt)
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
        this.kindJsonEditor = new kindjson.Editor(this);
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

        this.allEditors = [this.kindJsonEditor, this.blocksEditor, this.aceEditor]
        this.allEditors.forEach(e => e.changeCallback = changeHandler)
        this.editor = this.allEditors[this.allEditors.length - 1]
    }

    public componentWillMount() {
        this.initEditors()
    }

    public componentDidMount() {
        this.allEditors.forEach(e => e.prepare())
        simulator.init($("#mbitboardview")[0], {
            highlightStatement: stmt => {
                if (this.editor) this.editor.highlightStatement(stmt)
            },
            editor: this.state.header ? this.state.header.editor : ''
        })
        this.forceUpdate(); // we now have editors prepared
        
        // load first header or popup new project
        setTimeout(() => {
            let header = this.getData("header:*")[0];
                if (!this.state.header && header) {
                    this.loadHeader(header)
                }
        }, 1000)        
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
        ks.blocks.cleanBlocks();
        let logs = this.refs["logs"] as logview.LogView;
        logs.clear();

        pkg.loadPkgAsync(h.id)
            .then(() => {
                compiler.newProject();
                let e = this.settings.fileHistory.filter(e => e.id == h.id)[0]
                let main = pkg.getEditorPkg(pkg.mainPkg)
                let file = main.getMainFile()
                if (e && main.header.editor != "blocksprj")
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
        let targetTheme = this.appTarget.theme || {};
        core.confirmAsync({
            logos: [targetTheme.logo, logoSvgXml],
            header: this.appTarget.title + ' - ' + lf("Create Code"),
            hideCancel: hideCancel,
            hideAgree: true,
            onLoaded: (_) => {
                _.find('#newblockproject').click(() => { _.modal('hide'); this.newBlocksProjectAsync().done() })
                _.find('#newtypescript').click(() => { _.modal('hide'); this.newTypeScriptProjectAsync().done() })
                if (this.appTarget.koduUrl)
                    _.find('#newkodu').click(() => { window.location.href = this.appTarget.koduUrl })
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
        <div class="header">${lf("Block Editor for {0}", this.appTarget.name)}</div>
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
        <div class="header">${lf("JavaScript for {0}", this.appTarget.name)}</div>
        <div class="description">
            ${lf("Text based Coding")}
        </div>
        </div>
    </div>
  </div>
</div>`
            + (this.appTarget.koduUrl || this.appTarget.visualStudioCode ? `<div class="ui two column grid">
  <div class="column">
    ${this.appTarget.koduUrl ? `
    <div id="newkodu" class="ui fluid card link">
        <div class="image">
        <img src="${images}/newkodu.png">
        </div>
        <div class="content">
        <div class="header">${lf("Kodu for {0}", this.appTarget.name)}</div>
        <div class="description">
            ${lf("Tile based Coding")}
        </div>
        </div>
    </div>` : ''}
  </div>
  <div class="column">
    ${this.appTarget.visualStudioCode ? `
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
    </div>` : ''}
  </div>
</div>
` : "")
        }).done();
    }

    newVisualStudioProject() {
        core.confirmAsync({
            header: lf("New Visual Studio Code project"),
            htmlBody:
            `<p>${lf("<b>KindScript</b> comes with command line tools to integrate into existing editors.")}
${lf("To create an new KindScript project, <a href='{0}' target='_blank'>install Node.js</a>, open a console and run:", "https://nodejs.org/en/download/")}</p>
<pre>
[sudo] npm install -g kindscript-cli
mkdir myproject && cd myproject
kind init ${this.appTarget.id} myproject
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

    newTypeScriptProjectAsync(fileOverrides?: Util.Map<string>) {
        return this.newProjectFromIdAsync(this.appTarget.tsprj, fileOverrides);
    }

    newBlocksProjectAsync(fileOverrides?: Util.Map<string>) {
        return this.newProjectFromIdAsync(this.appTarget.blocksprj, fileOverrides);
    }

    newProjectFromIdAsync(prj: ks.ProjectTemplate, fileOverrides?: Util.Map<string>): Promise<void> {
        let cfg = ks.U.clone(prj.config);
        cfg.name = ks.U.fmt(cfg.name, Util.getAwesomeAdj());
        let files: workspace.ScriptText = {
            "kind.json": JSON.stringify(cfg, null, 4) + "\n",
        }
        for (let f in prj.files)
            files[f] = prj.files[f];
        if (fileOverrides)
            for (let f in fileOverrides)
                files[f] = fileOverrides[f];

        return workspace.installAsync({
            name: cfg.name,
            meta: {},
            editor: prj.id,
            pubId: "",
            pubCurrent: false,
            target: workspace.getCurrentTarget()
        }, files)
            .then(hd => {
                this.loadHeader(hd)
            })
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
        compiler.compileAsync({ native: true })
            .then(resp => {
                console.log('done')
                this.editor.setDiagnostics(this.editorFile, state)
                let hex = resp.outfiles["microbit.hex"]
                if (hex) {
                    let fn = "microbit-" + pkg.mainEditorPkg().header.name.replace(/[^a-zA-Z0-9]+/, "-") + ".hex"
                    console.log('saving ' + fn)
                    if (/http:\/\/localhost:3232/i.test(window.location.href)) {
                        console.log('local deployment...');
                        core.infoNotification("Uploading .hex file...");
                        Util.httpPostJsonAsync('http://localhost:3232/api/deploy', resp)
                            .done(() => {
                                core.infoNotification(lf(".hex file uploaded..."));   
                            });
                    } else {
                        core.browserDownloadText(hex, fn, "application/x-microbit-hex")                        
                    }
                } else {
                    console.log('no .hex file produced')
                }
            })
            .done()
    }

    stopSimulator(unload = false) {
        simulator.stop(unload)

        this.setState({ running: false })
    }

    runSimulator(opts: compiler.CompileOptions = {}) {
        this.stopSimulator();

        let logs = this.refs["logs"] as logview.LogView;
        logs.clear();
        let state = this.editor.snapshotState()
        compiler.compileAsync(opts)
            .then(resp => {
                this.editor.setDiagnostics(this.editorFile, state)
                if (resp.outfiles["microbit.js"]) {
                    this.setHelp(null);
                    simulator.run(opts.debug, resp)
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

    setHelp(helpCard: ks.CodeCard, onClick?: (e: React.MouseEvent) => boolean) {
        this.setState({ helpCard: helpCard, helpCardClick: onClick })
    }
    
    updateHeaderName(name: string) {
        try {            
            let f = pkg.mainEditorPkg().lookupFile("this/" + ks.configName);
            let config = JSON.parse(f.content) as ks.PackageConfig;
            config.name = name;
            f.setContentAsync(JSON.stringify(config, null, 2)).done(() => {
                this.forceUpdate();
            });
        }
        catch(e) {
            console.error('failed to read kind.json')   
        }
    }

    renderCore() {
        theEditor = this;

        if (this.editor && this.editor.isReady) {
            this.setTheme()
            this.updateEditorFile();
        }

        let targetTheme = this.appTarget.theme || {};
        let inv = this.state.theme.inverted ? " inverted " : " "

        return (
            <div id='root' className={"full-abs " + inv}>
                <div id="menubar">
                    <div className={"ui small menu" + inv}>
                        <span id="logo" className="item">
                            {targetTheme.logo ? (<a href={targetTheme.logoUrl}><img className='ui logo' src={Util.toDataUri(targetTheme.logo) } /></a>) : ""}
                            {logoSvg}
                        </span>
                        <div className="ui item">
                            <div className="ui buttons">
                                <sui.Button icon="file outline" textClass="ui landscape only" text={lf("Create Code") } onClick={() => this.newProject() } />
                                <sui.DropdownMenu class='floating icon button' icon='dropdown'>
                                    {this.appTarget.cloud ? <sui.Item icon="folder open" text={lf("Open script...") } onClick={() => this.scriptSearch.modal.show() } /> : ""}
                                    <div className="divider"></div>
                                    {this.appTarget.cloud ? <sui.Item icon="share alternate" text={lf("Publish/share") } onClick={() => this.publish() } /> : ""}
                                    <sui.Item icon='folder' text={lf("Show/Hide files")} onClick={() => {
                                        this.setState({ showFiles: !this.state.showFiles });
                                        this.saveSettings();
                                    } } />
                                    <sui.Item icon='trash' text={lf("Delete project") } onClick={() => this.removeProject() } />
                                </sui.DropdownMenu>
                            </div>
                            <sui.Button key='runbtn' class='primary portrait only' icon={this.state.running ? "stop" : "play"} text={this.state.running ? lf("Stop") : lf("Run") } onClick={() => this.state.running ? this.stopSimulator() : this.runSimulator() } />
                            {this.appTarget.compile ? <sui.Button class='icon primary portrait only' icon='download' onClick={() => this.compile() } /> : "" }
                            <sui.Button class="portrait only" icon="undo" onClick={() => this.editor.undo() } />
                            <sui.Button class="landscape only" text={lf("Undo") } icon="undo" onClick={() => this.editor.undo() } />
                            {this.editor.menu() }
                            <EmbedDesigner parent={this} />
                        </div>
                        <div className="ui item">
                            <div className="ui massive transparent input">
                                <input 
                                    type="text" 
                                    placeholder={lf("Pick a name...")} 
                                    value={this.state.header ? this.state.header.name : ''} 
                                    onChange={(e) => this.updateHeaderName((e.target as any).value)}></input>
                            </div>
                        </div>
                        { this.appTarget.cloud || targetTheme.rightLogo ?
                            <div className="ui item right">
                                <div>
                                    { this.appTarget.cloud ? <CloudSyncButton parent={this} /> : '' }
                                    { this.appTarget.cloud ? <LoginBox /> : "" }
                                    { targetTheme.rightLogo ? <a id="rightlogo" href={targetTheme.logoUrl}><img src={Util.toDataUri(targetTheme.rightLogo) } /></a> : "" }
                                </div>
                            </div> : "" }
                    </div>
                </div>
                <div id="filelist" className="ui items">
                    <div id="mbitboardview" className={"ui vertical " + (this.state.helpCard ? "landscape only" : "") }>
                    </div>
                    <div className="ui landscape only">
                        <logview.LogView ref="logs" />
                    </div>
                    <div className="ui item landscape only">
                        <sui.Button key='runbtn' class={"green"} icon={this.state.running ? "stop" : "play"} text={this.state.running ? lf("Stop") : lf("Run") } onClick={() => this.state.running ? this.stopSimulator() : this.runSimulator() } />
                        {!this.state.running ? <sui.Button key='debugbtn' class='teal' icon="play" text={lf("Debug")} onClick={() => this.runSimulator({debug:true}) } /> : ''}
                        {this.appTarget.compile ? <sui.Button icon='download' text={lf("Compile") } onClick={() => this.compile() } /> : ""}                        
                    </div>
                    <FileList parent={this} />
                </div>
                <div id="maineditor">
                    {this.allEditors.map(e => e.displayOuter()) }
                    {this.state.helpCard ? <div id="helpcard" onClick={this.state.helpCardClick}><codecard.CodeCardView responsive={true} {...this.state.helpCard} target={this.appTarget.id} /></div> : null }
                </div>
                {this.appTarget.cloud ? <ScriptSearch parent={this} ref={v => this.scriptSearch = v} /> : ""}
                <div id="footer">
                    <div>
                        { targetTheme.footerLogo ? <a id="footerlogo" href={targetTheme.logoUrl}><img src={Util.toDataUri(targetTheme.footerLogo) } /></a> : (this.appTarget.title || this.appTarget.name) }
                        <span>&nbsp; {lf("powered by") }</span>
                        &nbsp; <a href="https://github.com/Microsoft/kindscript">KindScript</a> - <span>{version}</span> - (c) Microsoft Corporation - 2016
                        - <a href="https://www.microsoft.com/en-us/legal/intellectualproperty/copyright/default.aspx">{lf("Terms of Use") }</a>
                        - <a href="https://privacy.microsoft.com/en-us/privacystatement">{lf("Privacy") }</a>
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
        <title>${lf("KindScript logo") }</title>
        <path fill="#ff7d00" d="M 48.7156,57.6831C 48.7156,59.6258 48.0158,61.2801 46.6154,62.6473C 45.2156,64.0145 43.5373,64.6974 41.5809,64.6974C 39.6251,64.6974 37.9663,64.0145 36.6069,62.6473C 35.2469,61.2801 34.5665,59.6258 34.5665,57.6831C 34.5665,55.7 35.2469,54.0151 36.6069,52.6291C 37.9663,51.2417 39.6251,50.5483 41.5809,50.5483C 43.5373,50.5483 45.2156,51.2417 46.6154,52.6291C 48.0158,54.0151 48.7156,55.7 48.7156,57.6831 Z M 93.4324,57.6831C 93.4324,59.6258 92.7326,61.2801 91.3322,62.6473C 89.9324,64.0145 88.2541,64.6975 86.2977,64.6975C 84.342,64.6975 82.6831,64.0145 81.3237,62.6473C 79.9637,61.2801 79.2834,59.6258 79.2834,57.6831C 79.2834,55.7001 79.9637,54.0152 81.3237,52.6291C 82.6831,51.2417 84.342,50.5484 86.2977,50.5484C 88.2541,50.5484 89.9324,51.2417 91.3322,52.6291C 92.7326,54.0152 93.4324,55.7001 93.4324,57.6831 Z M 27.2559,102.439C 24.5091,102.43 21.9146,101.831 19.5905,100.725C 13.1421,98.316 9.91797,92.9285 9.91797,84.562L 9.91797,67.4895C 9.91797,59.8329 6.61214,55.8157 4.19718e-006,55.4384L 4.19718e-006,48.4268C 6.61214,48.0494 9.91797,43.9532 9.91797,36.1383L 9.91797,19.5404C 9.91797,9.37168 14.5536,3.54519 23.8242,2.06057C 25.3494,1.70022 26.9508,1.53021 28.5964,1.57473L 38.7526,1.57473L 47.0408,1.64846L 52.7508,1.7383L 54.6969,1.81211L 55.3929,1.81211L 55.883,1.90171L 56.5788,2.13894L 56.9267,2.37624L 57.403,2.77688L 58.1769,3.74197L 58.589,5.74579L 58.589,6.31L 58.4471,6.94785C 58.188,7.86151 57.9905,8.03802 57.687,8.78802L 56.6429,11.4297L 54.4909,16.4758L 54.4128,16.7292L 54.3489,16.8766C 54.36,16.854 54.0537,18.3801 54.619,20.0087C 55.1951,21.6374 56.3283,23.2884 58.1769,24.2535C 60.2427,25.3177 60.3514,25.6929 63.9512,25.4557L 64.0151,25.4557C 66.0281,25.3562 66.8883,24.9043 67.3672,24.5804C 67.7793,24.292 67.7679,24.0291 68.7593,23.2147C 69.7475,22.2752 70.2041,18.9958 69.7252,17.6782L 69.7252,17.6045L 65.9752,6.62079L 65.6912,5.90912L 65.6912,5.18142L 65.9752,3.74197L 66.4512,2.77688L 66.9412,2.21259L 67.3672,1.90171L 68.1912,1.501L 68.7593,1.33743L 69.3773,1.24766L 70.7694,1.24766L 74.8034,1.24766L 78.7736,1.33743L 80.1655,1.33743L 80.6556,1.33743L 100.492,1.33743C 101.943,1.33743 103.352,1.50173 104.702,1.81854C 113.622,3.41709 118.082,9.13641 118.082,18.9767L 118.082,36.0492C 118.082,43.706 121.388,47.7231 128,48.1004L 128,55.112C 121.388,55.4893 118.082,59.5855 118.082,67.4005L 118.082,83.9982C 118.082,93.4771 114.054,99.183 105.998,101.116C 104.675,101.597 103.276,101.928 101.826,102.199L 75.3507,102.125L 77.3747,107.899L 77.3747,107.973C 79.0924,112.808 78.2656,118.729 74.3846,122.4L 74.3066,122.474L 74.1647,122.637C 75.0472,121.961 73.6971,123.301 72.2186,124.33C 70.7625,125.33 68.6632,126.17 65.7485,126.333C 61.3774,126.596 58.8441,125.468 56.9062,124.477L 56.8421,124.403C 53.3397,122.55 51.0347,119.37 49.8822,116.062C 48.7599,112.869 48.543,109.55 49.946,106.534L 50.0241,106.207L 51.48,102.6L 27.2559,102.439 Z M 46.8426,94.8082L 54.2,94.9127L 56.1462,94.9865L 56.8423,94.9865L 57.3322,95.0761L 58.028,95.3133L 58.376,95.5507L 58.8522,95.9513L 59.6261,96.9164L 60.0382,98.9202L 60.0382,99.4844L 59.8963,100.122C 59.6372,101.036 59.4398,101.212 59.1364,101.962L 58.0921,104.604L 55.9401,109.65L 55.862,109.904L 55.7982,110.051C 55.8094,110.028 55.5031,111.554 56.0682,113.183C 56.6445,114.812 57.7775,116.463 59.6261,117.428C 61.6919,118.492 61.8006,118.867 65.4004,118.63L 65.4645,118.63C 67.4774,118.531 68.3377,118.079 68.8164,117.755C 69.2285,117.466 69.2171,117.203 70.2085,116.389C 71.1968,115.45 71.6535,112.17 71.1745,110.853L 71.1745,110.779L 67.4245,99.7952L 67.1405,99.0835L 67.1405,98.3558L 67.4245,96.9164L 67.9004,95.9513L 68.3906,95.3871L 68.8164,95.0761L 69.6405,94.6755L 70.2085,94.5118L 70.8267,94.422L 72.2187,94.422L 76.2528,94.422L 100.335,94.5118C 102.24,94.4408 103.923,93.9845 105.343,93.2599C 108.05,91.4841 109.404,88.2204 109.404,83.4688L 109.404,66.6154C 109.404,58.5692 112.465,53.6271 118.586,51.7889L 118.586,51.5515C 112.465,49.8352 109.404,44.9416 109.404,36.871L 109.404,20.2915C 109.404,16.0553 108.665,13.0273 107.186,11.2074L 106.733,10.7103C 105.016,9.67338 102.865,9.02502 100.493,9.02502L 74.7397,8.95121L 73.9017,8.95121L 75.9258,14.7251L 75.9258,14.799C 77.6435,19.6335 76.8167,25.5547 72.9357,29.2255L 72.8577,29.2994L 72.7157,29.4629C 73.5983,28.7863 72.248,30.1265 70.7695,31.1554C 69.3136,32.1558 67.2143,32.9957 64.2995,33.1591C 59.9284,33.4221 57.395,32.2936 55.4572,31.3029L 55.3932,31.2292C 51.8909,29.376 49.5858,26.196 48.4331,22.8873C 47.3112,19.6944 47.0942,16.3762 48.4971,13.3594L 48.575,13.0324L 50.0311,9.42582L 46.9632,9.35209L 38.7531,9.26225L 28.4548,9.26225C 25.8991,9.18282 23.7018,9.77942 21.954,10.7993C 19.7158,12.6595 18.5967,15.7498 18.5967,20.0701L 18.5967,36.9235C 18.5967,44.9698 15.536,49.912 9.41457,51.7501L 9.41457,51.9876C 15.536,53.7039 18.5967,58.5974 18.5967,66.6678L 18.5967,83.2474C 18.5967,87.4836 19.336,90.5116 20.8146,92.3315C 21.3,92.9286 21.9022,93.4317 22.6216,93.8408C 24.0205,94.4158 25.6138,94.7517 27.3215,94.7517L 46.8426,94.8082 Z "/>
    </svg>)
var logoSvgXml = `<svg xmlns='http://www.w3.org/2000/svg' viewBox="0 0 128 128" preserveAspectRatio="xMinYMin"><path fill="#ff7d00" d="M 48.7156,57.6831C 48.7156,59.6258 48.0158,61.2801 46.6154,62.6473C 45.2156,64.0145 43.5373,64.6974 41.5809,64.6974C 39.6251,64.6974 37.9663,64.0145 36.6069,62.6473C 35.2469,61.2801 34.5665,59.6258 34.5665,57.6831C 34.5665,55.7 35.2469,54.0151 36.6069,52.6291C 37.9663,51.2417 39.6251,50.5483 41.5809,50.5483C 43.5373,50.5483 45.2156,51.2417 46.6154,52.6291C 48.0158,54.0151 48.7156,55.7 48.7156,57.6831 Z M 93.4324,57.6831C 93.4324,59.6258 92.7326,61.2801 91.3322,62.6473C 89.9324,64.0145 88.2541,64.6975 86.2977,64.6975C 84.342,64.6975 82.6831,64.0145 81.3237,62.6473C 79.9637,61.2801 79.2834,59.6258 79.2834,57.6831C 79.2834,55.7001 79.9637,54.0152 81.3237,52.6291C 82.6831,51.2417 84.342,50.5484 86.2977,50.5484C 88.2541,50.5484 89.9324,51.2417 91.3322,52.6291C 92.7326,54.0152 93.4324,55.7001 93.4324,57.6831 Z M 27.2559,102.439C 24.5091,102.43 21.9146,101.831 19.5905,100.725C 13.1421,98.316 9.91797,92.9285 9.91797,84.562L 9.91797,67.4895C 9.91797,59.8329 6.61214,55.8157 4.19718e-006,55.4384L 4.19718e-006,48.4268C 6.61214,48.0494 9.91797,43.9532 9.91797,36.1383L 9.91797,19.5404C 9.91797,9.37168 14.5536,3.54519 23.8242,2.06057C 25.3494,1.70022 26.9508,1.53021 28.5964,1.57473L 38.7526,1.57473L 47.0408,1.64846L 52.7508,1.7383L 54.6969,1.81211L 55.3929,1.81211L 55.883,1.90171L 56.5788,2.13894L 56.9267,2.37624L 57.403,2.77688L 58.1769,3.74197L 58.589,5.74579L 58.589,6.31L 58.4471,6.94785C 58.188,7.86151 57.9905,8.03802 57.687,8.78802L 56.6429,11.4297L 54.4909,16.4758L 54.4128,16.7292L 54.3489,16.8766C 54.36,16.854 54.0537,18.3801 54.619,20.0087C 55.1951,21.6374 56.3283,23.2884 58.1769,24.2535C 60.2427,25.3177 60.3514,25.6929 63.9512,25.4557L 64.0151,25.4557C 66.0281,25.3562 66.8883,24.9043 67.3672,24.5804C 67.7793,24.292 67.7679,24.0291 68.7593,23.2147C 69.7475,22.2752 70.2041,18.9958 69.7252,17.6782L 69.7252,17.6045L 65.9752,6.62079L 65.6912,5.90912L 65.6912,5.18142L 65.9752,3.74197L 66.4512,2.77688L 66.9412,2.21259L 67.3672,1.90171L 68.1912,1.501L 68.7593,1.33743L 69.3773,1.24766L 70.7694,1.24766L 74.8034,1.24766L 78.7736,1.33743L 80.1655,1.33743L 80.6556,1.33743L 100.492,1.33743C 101.943,1.33743 103.352,1.50173 104.702,1.81854C 113.622,3.41709 118.082,9.13641 118.082,18.9767L 118.082,36.0492C 118.082,43.706 121.388,47.7231 128,48.1004L 128,55.112C 121.388,55.4893 118.082,59.5855 118.082,67.4005L 118.082,83.9982C 118.082,93.4771 114.054,99.183 105.998,101.116C 104.675,101.597 103.276,101.928 101.826,102.199L 75.3507,102.125L 77.3747,107.899L 77.3747,107.973C 79.0924,112.808 78.2656,118.729 74.3846,122.4L 74.3066,122.474L 74.1647,122.637C 75.0472,121.961 73.6971,123.301 72.2186,124.33C 70.7625,125.33 68.6632,126.17 65.7485,126.333C 61.3774,126.596 58.8441,125.468 56.9062,124.477L 56.8421,124.403C 53.3397,122.55 51.0347,119.37 49.8822,116.062C 48.7599,112.869 48.543,109.55 49.946,106.534L 50.0241,106.207L 51.48,102.6L 27.2559,102.439 Z M 46.8426,94.8082L 54.2,94.9127L 56.1462,94.9865L 56.8423,94.9865L 57.3322,95.0761L 58.028,95.3133L 58.376,95.5507L 58.8522,95.9513L 59.6261,96.9164L 60.0382,98.9202L 60.0382,99.4844L 59.8963,100.122C 59.6372,101.036 59.4398,101.212 59.1364,101.962L 58.0921,104.604L 55.9401,109.65L 55.862,109.904L 55.7982,110.051C 55.8094,110.028 55.5031,111.554 56.0682,113.183C 56.6445,114.812 57.7775,116.463 59.6261,117.428C 61.6919,118.492 61.8006,118.867 65.4004,118.63L 65.4645,118.63C 67.4774,118.531 68.3377,118.079 68.8164,117.755C 69.2285,117.466 69.2171,117.203 70.2085,116.389C 71.1968,115.45 71.6535,112.17 71.1745,110.853L 71.1745,110.779L 67.4245,99.7952L 67.1405,99.0835L 67.1405,98.3558L 67.4245,96.9164L 67.9004,95.9513L 68.3906,95.3871L 68.8164,95.0761L 69.6405,94.6755L 70.2085,94.5118L 70.8267,94.422L 72.2187,94.422L 76.2528,94.422L 100.335,94.5118C 102.24,94.4408 103.923,93.9845 105.343,93.2599C 108.05,91.4841 109.404,88.2204 109.404,83.4688L 109.404,66.6154C 109.404,58.5692 112.465,53.6271 118.586,51.7889L 118.586,51.5515C 112.465,49.8352 109.404,44.9416 109.404,36.871L 109.404,20.2915C 109.404,16.0553 108.665,13.0273 107.186,11.2074L 106.733,10.7103C 105.016,9.67338 102.865,9.02502 100.493,9.02502L 74.7397,8.95121L 73.9017,8.95121L 75.9258,14.7251L 75.9258,14.799C 77.6435,19.6335 76.8167,25.5547 72.9357,29.2255L 72.8577,29.2994L 72.7157,29.4629C 73.5983,28.7863 72.248,30.1265 70.7695,31.1554C 69.3136,32.1558 67.2143,32.9957 64.2995,33.1591C 59.9284,33.4221 57.395,32.2936 55.4572,31.3029L 55.3932,31.2292C 51.8909,29.376 49.5858,26.196 48.4331,22.8873C 47.3112,19.6944 47.0942,16.3762 48.4971,13.3594L 48.575,13.0324L 50.0311,9.42582L 46.9632,9.35209L 38.7531,9.26225L 28.4548,9.26225C 25.8991,9.18282 23.7018,9.77942 21.954,10.7993C 19.7158,12.6595 18.5967,15.7498 18.5967,20.0701L 18.5967,36.9235C 18.5967,44.9698 15.536,49.912 9.41457,51.7501L 9.41457,51.9876C 15.536,53.7039 18.5967,58.5974 18.5967,66.6678L 18.5967,83.2474C 18.5967,87.4836 19.336,90.5116 20.8146,92.3315C 21.3,92.9286 21.9022,93.4317 22.6216,93.8408C 24.0205,94.4158 25.6138,94.7517 27.3215,94.7517L 46.8426,94.8082 Z "/></svg>`;

var logoFull = (
    <svg id='logosvg' viewBox="0 0 128 128" preserveAspectRatio="xMinYMin">
        <title>${lf("KindScript logo") }</title>
        <path fill="#ff7d00" d="M 32.8626,98.5667L 32.7266,98.5667C 25.5436,98.55 20.3146,97.1956 17.0388,94.5036C 13.7419,91.7945 12.0937,86.9678 12.0937,80.022L 12.0937,67.8242C 12.0937,61.593 9.78557,58.4781 5.16988,58.4781L 5.16988,48.983C 9.78557,48.983 12.0937,45.6532 12.0937,38.9936L 12.0937,27.339C 12.0937,20.1633 13.7238,15.119 16.9844,12.2069C 20.2245,9.31287 25.472,7.85641 32.7266,7.83835L 32.8217,7.8389L 32.8626,7.8389L 55.6439,7.8389C 55.6591,7.9941 55.6371,8.1823 55.5777,8.41409C 55.3175,9.42136 54.3427,11.2407 53.5312,13.4173C 52.7188,15.5939 52.0688,18.1279 52.1989,20.63C 52.3285,23.1312 53.2386,25.5998 55.0254,27.3218C 56.8122,29.0439 59.4768,30.0189 62.4326,30.3113C 65.3893,30.6034 68.638,30.2137 70.9114,28.6865C 73.1866,27.1603 74.486,24.4958 74.8429,22.2215C 75.2003,19.9476 74.6151,18.0636 73.9981,16.2114L 72.1793,11.0458C 71.6748,9.68112 71.252,8.58735 71.1575,7.8389L 95.1704,7.8389L 95.3895,7.83835C 102.22,7.86985 107.179,9.3259 110.268,12.2069C 113.39,15.119 114.95,20.0917 114.95,27.1252L 114.95,39.1093C 114.95,45.6919 117.258,48.983 121.874,48.983L 121.874,58.4781C 117.258,58.4781 114.95,61.6426 114.95,67.9726L 114.95,79.7092C 114.95,86.8634 113.398,91.7945 110.292,94.5036C 107.218,97.1843 102.251,98.5387 95.3895,98.5667L 95.1704,98.5671L 72.3098,98.5671C 72.4709,99.4172 72.921,100.587 73.4485,102.014L 75.5486,107.976C 76.2603,110.113 76.9358,112.288 76.523,114.913C 76.1108,117.537 74.6112,120.612 71.9857,122.375C 69.3612,124.137 65.6112,124.587 62.1995,124.25C 58.7873,123.913 55.7122,122.787 53.65,120.8C 51.5877,118.813 50.5376,115.963 50.3881,113.076C 50.2378,110.188 50.9876,107.264 51.9252,104.751C 52.8623,102.239 53.987,100.139 54.2873,98.9766L 54.3629,98.5667L 32.8626,98.5667 Z M 79.538,53.0464C 79.538,55.4568 80.2782,57.4146 81.7586,58.9199C 83.2389,60.4251 85.1592,61.1778 87.5195,61.1778C 89.8075,61.1778 91.6993,60.439 93.1953,58.9615C 94.6911,57.4838 95.439,55.5861 95.439,53.268C 95.439,50.9686 94.6988,49.0524 93.2186,47.5193C 91.7381,45.9861 89.8385,45.2197 87.5195,45.2197C 85.2628,45.2197 83.3682,45.9655 81.8361,47.4569C 80.304,48.9485 79.538,50.8116 79.538,53.0464 Z M 31.6055,53.047C 31.6055,55.4572 32.3536,57.4151 33.8495,58.9205C 35.3454,60.4257 37.2632,61.1783 39.6027,61.1783C 41.8801,61.1783 43.7671,60.4395 45.2629,58.962C 46.7587,57.4844 47.5066,55.5866 47.5066,53.2686C 47.5066,50.969 46.769,49.0528 45.294,47.5199C 43.8188,45.9867 41.9217,45.2203 39.6027,45.2203C 37.3562,45.2203 35.4619,45.966 33.9192,47.4574C 32.3768,48.9489 31.6055,50.812 31.6055,53.047 Z"/>
    </svg>
)

var logoOrange = (
    <svg id='logosvg' viewBox="0 0 128 128" preserveAspectRatio="xMinYMin">
        <title>${lf("KindScript logo") }</title>
        <path fill="#ff7d00" d="M 0,0L 128,0L 128,128L 0,128L 0,0 Z"/>
        <path fill="#ffffff" d="M 51.985,58.1691C 51.985,59.6357 51.4567,60.8842 50.3998,61.9164C 49.3429,62.9477 48.0762,63.4634 46.5998,63.4634C 45.1232,63.4634 43.8713,62.9477 42.8447,61.9164C 41.8185,60.8842 41.305,59.6357 41.305,58.1691C 41.305,56.6723 41.8185,55.4001 42.8447,54.3539C 43.8713,53.307 45.1232,52.784 46.5998,52.784C 48.0762,52.784 49.3429,53.307 50.3998,54.3539C 51.4567,55.4001 51.985,56.6723 51.985,58.1691 Z M 85.7388,58.1693C 85.7388,59.6359 85.2105,60.8852 84.1536,61.9166C 83.0969,62.9487 81.8301,63.4636 80.3536,63.4636C 78.8771,63.4636 77.6252,62.9487 76.5986,61.9166C 75.5724,60.8852 75.0589,59.6359 75.0589,58.1693C 75.0589,56.6732 75.5724,55.401 76.5986,54.3549C 77.6252,53.308 78.8771,52.7841 80.3536,52.7841C 81.8301,52.7841 83.0969,53.308 84.1536,54.3549C 85.2105,55.401 85.7388,56.6732 85.7388,58.1693 Z M 35.7868,96.2088C 33.7134,96.2018 31.755,95.75 30.0008,94.9148C 25.1335,93.0967 22.6999,89.0302 22.6999,82.715L 22.6999,69.8285C 22.6999,64.0491 20.2045,61.0169 15.2137,60.7321L 15.2137,55.4396C 20.2045,55.1548 22.6999,52.0629 22.6999,46.1641L 22.6999,33.6357C 22.6999,25.9603 26.1988,21.5623 33.1965,20.4417C 34.3478,20.1696 35.5564,20.0414 36.7986,20.0749L 44.4647,20.0749L 50.7208,20.1307L 55.0306,20.1985L 56.4995,20.2541L 57.025,20.2541L 57.3948,20.3219L 57.9201,20.5008L 58.1827,20.68L 58.5421,20.9824L 59.1264,21.7108L 59.4374,23.2233L 59.4374,23.6493L 59.3302,24.1307L 58.7566,25.5198L 57.9685,27.5136L 56.3441,31.3225L 56.2851,31.5137L 56.2369,31.6251C 56.2453,31.6081 56.0141,32.7599 56.4407,33.9893C 56.8758,35.2186 57.7309,36.4649 59.1264,37.1932C 60.6856,37.9966 60.7676,38.2798 63.4848,38.1007L 63.5333,38.1007C 65.0525,38.0256 65.702,37.6845 66.0632,37.4401L 67.1141,36.4091C 67.86,35.7 68.2046,33.2246 67.8433,32.2302L 67.8433,32.1745L 65.0127,23.8838L 64.7982,23.3465L 64.7982,22.7974L 65.0127,21.7108L 65.3719,20.9824L 65.7419,20.5564L 66.0632,20.3219L 66.6854,20.0193L 67.1141,19.8959L 67.5805,19.8281L 68.6314,19.8281L 71.6764,19.8281L 74.6729,19.8959L 75.7238,19.8959L 76.0936,19.8959L 91.0665,19.8959L 94.2441,20.259C 100.977,21.4657 104.344,25.7827 104.344,33.2102L 104.344,46.0969C 104.344,51.8763 106.839,54.9084 111.83,55.1932L 111.83,60.4857C 106.839,60.7705 104.344,63.8624 104.344,69.7612L 104.344,82.2894C 104.344,89.4443 101.303,93.7511 95.2228,95.2102L 92.0735,96.0279L 72.0893,95.9722L 73.617,100.33L 73.617,100.386C 74.9137,104.035 74.2896,108.505 71.3601,111.276L 71.3012,111.331L 71.1941,111.455C 71.8604,110.944 70.8411,111.956 69.7252,112.732C 68.6262,113.487 67.0416,114.121 64.8415,114.245C 61.5421,114.443 59.6299,113.591 58.1672,112.843L 58.1188,112.788C 55.4751,111.389 53.7352,108.989 52.8653,106.491C 52.0183,104.081 51.8545,101.577 52.9135,99.2995L 52.9725,99.0528L 54.0714,96.3303L 35.7868,96.2088 Z M 50.5712,90.4492L 56.1247,90.528L 57.5936,90.5837L 58.1191,90.5837L 58.4888,90.6513L 59.0142,90.8304L 59.2769,91.0096L 59.6363,91.3119L 60.2205,92.0403L 60.5316,93.5529L 60.5316,93.9788L 60.4244,94.4603L 59.8507,95.8493L 59.0626,97.8432L 57.4381,101.652L 57.3792,101.843L 57.331,101.955C 57.3395,101.938 57.1082,103.089 57.5349,104.319C 57.9698,105.548 58.8251,106.794 60.2205,107.523C 61.7798,108.326 61.8618,108.609 64.5788,108.43L 64.6273,108.43C 66.1467,108.355 66.796,108.014 67.1574,107.77L 68.2081,106.739C 68.9542,106.03 69.2988,103.554 68.9373,102.56L 68.9373,102.504L 66.1067,94.2134L 65.8923,93.6762L 65.8923,93.1269L 66.1067,92.0403L 66.466,91.3119L 66.8359,90.886L 67.1574,90.6513L 67.7794,90.3488L 68.2081,90.2254L 68.6747,90.1577L 69.7254,90.1577L 72.7704,90.1577L 90.9482,90.2254C 92.3861,90.1718 93.6567,89.8274 94.7279,89.2805C 96.7717,87.94 97.7934,85.4766 97.7934,81.8899L 97.7934,69.1688C 97.7934,63.0954 100.103,59.365 104.724,57.9775L 104.724,57.7983C 100.103,56.5028 97.7934,52.809 97.7934,46.7172L 97.7934,34.2027C 97.7934,31.0053 97.2352,28.7197 96.1193,27.346L 95.7772,26.9707C 94.4815,26.1881 92.8576,25.6986 91.067,25.6986L 71.6284,25.643L 70.9958,25.643L 72.5236,30.0012L 72.5236,30.057C 73.8201,33.706 73.196,38.1755 70.2666,40.9464L 70.2076,41.002L 70.1006,41.1255C 70.7668,40.6149 69.7476,41.6263 68.6316,42.403C 67.5327,43.1581 65.9481,43.7921 63.7479,43.9155C 60.4486,44.1139 58.5363,43.2621 57.0737,42.5144L 57.0253,42.4587C 54.3817,41.0599 52.6418,38.6596 51.7718,36.1622C 50.9249,33.752 50.761,31.2474 51.82,28.9703L 51.8789,28.7235L 52.9779,26.0012L 50.6623,25.9456L 44.4651,25.8778L 36.6917,25.8778C 34.7627,25.8178 33.1042,26.2681 31.7849,27.0379C 30.0955,28.4421 29.2508,30.7746 29.2508,34.0356L 29.2508,46.7569C 29.2508,52.8304 26.9405,56.5608 22.32,57.9482L 22.32,58.1275C 26.9405,59.423 29.2508,63.1166 29.2508,69.2083L 29.2508,81.7229C 29.2508,84.9205 29.8088,87.2059 30.9249,88.5796L 32.2888,89.719C 33.3447,90.1529 34.5474,90.4065 35.8363,90.4065L 50.5712,90.4492 Z"/>
    </svg>
)

function getsrc() {
    console.log(theEditor.editor.getCurrentSource())
}

function enableCrashReporting(releaseid: string) {
    if (typeof Raygun === "undefined") return; // don't report local crashes    
    try {
        Raygun.init('/wIRcLktINPpixxiUnyjPQ==', {
            ignoreAjaxAbort: true,
            ignoreAjaxError: true,
            ignore3rdPartyErrors: true
            //    excludedHostnames: ['localhost'],
        }).attach();
        Raygun.setVersion(releaseid);
        Raygun.saveIfOffline(true);

        let rexp = ks.reportException;
        ks.reportException = function(err: any, data: any): void {
            if (rexp) rexp(err, data);
            Raygun.send(err, data)
        }
        let re = ks.reportError;
        ks.reportError = function(msg: string, data: any): void {
            if (re) re(msg, data);
            try {
                throw msg
            }
            catch (err) {
                Raygun.send(err, data)
            }
        }
        console.log('raygun initialized...');
    }
    catch (e) {
        console.error('raygun loader failed')
    }
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
    apiAsync: core.apiAsync
};
(window as any).E = myexports;

export var baseUrl: string;
export var currentReleaseId: string;
export var version: string;

$(document).ready(() => {
    // TODO use one of these instead: 
    // var appCdnRoot = "https://az851932.vo.msecnd.net/app/pydrb/c/";
    // var simCdnRoot = "https://az851932.vo.msecnd.net/app/xkvnp/c/";
    // can also use window.tdConfig.releaseid
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
    let config = (window as any).tdConfig || {};
    version = config.tdVersion || "";
    let lang = /lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);

    enableCrashReporting(version)

    let hm = /^(https:\/\/[^/]+)/.exec(window.location.href)
    if (hm)
        Cloud.apiRoot = hm[1] + "/api/"

    let ws = /ws=(\w+)/.exec(window.location.href)
    if (ws) workspace.setupWorkspace(ws[1])

    Util.updateLocalizationAsync(baseUrl, lang ? lang[1] : (navigator.userLanguage || navigator.language))
        .then(() => Util.httpGetJsonAsync((window as any).simCdnRoot + "target.json"))
        .then((trgbundle: ks.TargetBundle) => {
            let cfg: ks.PackageConfig = JSON.parse(trgbundle.bundledpkgs[trgbundle.corepkg][ks.configName])
            pkg.appTarget = cfg.target
            pkg.appTarget.bundledpkgs = trgbundle.bundledpkgs
            if (!pkg.appTarget.cloud) Cloud.apiRoot = undefined;
        })
        .then(() => {
            return compiler.init();
        })
        .then(() => workspace.initAsync(pkg.appTarget.id))
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

            draganddrop.setupDragAndDrop(document.body, file => file.size < 1000000 && /^\.hex$/i.test(file.name), files => {
                ks.cpp.unpackSourceFromHexFileAsync(files[0])
                    .then(data => {
                        console.log('decoded hex file')
                        if (data
                            && data.meta
                            && data.meta.cloudId == "microbit.co.uk"
                            && data.meta.editor == "blockly") {
                            console.log('importing blocks project')
                            theEditor.newBlocksProjectAsync({
                                "main.blocks": data.source
                            }).done();
                        }
                    })
            })
        })

    window.addEventListener("unload", ev => {
        if (theEditor && !LoginBox.signingOut)
            theEditor.saveSettings()
    })

})
