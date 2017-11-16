/// <reference path="../../localtypings/pxtpackage.d.ts"/>
/// <reference path="../../built/pxtlib.d.ts"/>
/// <reference path="../../built/pxtblocks.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts"/>
/// <reference path="../../built/pxtwinrt.d.ts"/>

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
import * as screenshot from "./screenshot";
import * as hidbridge from "./hidbridge";
import * as share from "./share";
import * as lang from "./lang";
import * as accessibility from "./accessibility";
import * as tutorial from "./tutorial";
import * as editortoolbar from "./editortoolbar";
import * as simtoolbar from "./simtoolbar";
import * as filelist from "./filelist";
import * as container from "./container";
import * as scriptsearch from "./scriptsearch";
import * as projects from "./projects";
import * as extensions from "./extensions";
import * as sounds from "./sounds";
import * as make from "./make";
import * as baseToolbox from "./toolbox";
import * as monacoToolbox from "./monacoSnippets"

import * as monaco from "./monaco"
import * as pxtjson from "./pxtjson"
import * as serial from "./serial"
import * as blocks from "./blocks"
import * as codecard from "./codecard"
import * as serialindicator from "./serialindicator"
import * as draganddrop from "./draganddrop";
import * as electron from "./electron";
import * as notification from "./notification";

type ISettingsProps = pxt.editor.ISettingsProps;
type IAppProps = pxt.editor.IAppProps;
type IAppState = pxt.editor.IAppState;
type IProjectView = pxt.editor.IProjectView;
type FileHistoryEntry = pxt.editor.FileHistoryEntry;
type EditorSettings = pxt.editor.EditorSettings;
type ProjectCreationOptions = pxt.editor.ProjectCreationOptions;

import Cloud = pxt.Cloud;
import Util = pxt.Util;
import CategoryMode = pxt.blocks.CategoryMode;
const lf = Util.lf

pxsim.util.injectPolyphils();

let theEditor: ProjectView;

/*
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
}*/

export class ProjectView
    extends data.Component<IAppProps, IAppState>
    implements IProjectView {
    editor: srceditor.Editor;
    editorFile: pkg.File;
    textEditor: monaco.Editor;
    pxtJsonEditor: pxtjson.Editor;
    serialEditor: serial.Editor;
    blocksEditor: blocks.Editor;
    allEditors: srceditor.Editor[] = [];
    settings: EditorSettings;
    scriptSearch: scriptsearch.ScriptSearch;
    home: projects.Projects;
    extensions: extensions.Extensions;
    shareEditor: share.ShareEditor;
    languagePicker: lang.LanguagePicker;
    importDialog: projects.ImportDialog;
    exitAndSaveDialog: projects.ExitAndSaveDialog;
    prevEditorId: string;

    private lastChangeTime: number;
    private reload: boolean;
    private shouldTryDecompile: boolean;

    constructor(props: IAppProps) {
        super(props);
        document.title = pxt.appTarget.title || pxt.appTarget.name;
        this.reload = false; //set to true in case of reset of the project where we are going to reload the page.
        this.settings = JSON.parse(pxt.storage.getLocal("editorSettings") || "{}")
        const shouldShowHomeScreen = this.shouldShowHomeScreen();

        this.state = {
            showFiles: false,
            home: shouldShowHomeScreen,
            active: document.visibilityState == 'visible',
            collapseEditorTools: pxt.appTarget.simulator.headless || pxt.BrowserUtils.isMobile()
        };
        if (!this.settings.editorFontSize) this.settings.editorFontSize = /mobile/i.test(navigator.userAgent) ? 15 : 19;
        if (!this.settings.fileHistory) this.settings.fileHistory = [];
        if (shouldShowHomeScreen) this.homeLoaded();
    }

    shouldShowHomeScreen() {
        const hash = parseHash();
        const isSandbox = pxt.shell.isSandboxMode() || pxt.shell.isReadOnly();
        // Only show the start screen if there are no initial projects requested
        // (e.g. from the URL hash or from WinRT activation arguments)
        const skipStartScreen = pxt.appTarget.appTheme.allowParentController
            || window.location.hash == "#editor";
        return !isSandbox && !skipStartScreen && !isProjectRelatedHash(hash);
    }

    updateVisibility() {
        let active = document.visibilityState == 'visible';
        pxt.debug(`page visibility: ${active}`)
        this.setState({ active: active })
        if (!active) {
            if (this.state.running) {
                this.stopSimulator();
                this.setState({ resumeOnVisibility: true });
            }
            this.saveFileAsync().done();
        } else {
            if (workspace.isSessionOutdated()) {
                pxt.debug('workspace changed, reloading...')
                let id = this.state.header ? this.state.header.id : '';
                workspace.initAsync()
                    .done(() => !this.state.home && id ? this.loadHeaderAsync(workspace.getHeader(id)) : Promise.resolve());
            } else if (this.state.resumeOnVisibility && !this.state.running) {
                this.setState({ resumeOnVisibility: false });
                this.runSimulator();
            }
        }
    }

    saveSettings() {
        let sett = this.settings

        if (this.reload) {
            return;
        }

        let f = this.editorFile
        if (f && f.epkg.getTopHeader() && this.editor.hasHistory()) {
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
        simulator.setState(this.state.header ? this.state.header.editor : '', this.state.tutorialOptions && !!this.state.tutorialOptions.tutorial)
        this.editor.resize();
    }

    fireResize() {
        if (document.createEvent) { // W3C
            let event = document.createEvent('Event');
            event.initEvent('resize', true, true);
            window.dispatchEvent(event);
        } else { // IE
            (document as any).fireEvent('onresize');
        }
    }

    updateEditorLogo(left: number, rgba?: string) {
        if (pxt.appTarget.appTheme.hideMenuBar) {
            const editorLogo = document.getElementById('editorlogo');
            if (editorLogo) {
                editorLogo.style.left = `${left}px`;
                editorLogo.style.display = 'block';
                editorLogo.style.background = rgba || '';
            }
        }
    }

    saveFileAsync(): Promise<void> {
        if (!this.editorFile)
            return Promise.resolve()
        return this.saveTypeScriptAsync()
            .then(() => {
                let txt = this.editor.getCurrentSource()
                if (txt != this.editorFile.content)
                    simulator.makeDirty();
                if (this.editor.isIncomplete()) return Promise.resolve();
                return this.editorFile.setContentAsync(txt);
            });
    }

    isEmbedSimActive(): boolean {
        return this.state.embedSimView;
    }

    isBlocksActive(): boolean {
        return !this.state.embedSimView && this.editor == this.blocksEditor
            && this.editorFile && this.editorFile.name == "main.blocks";
    }

    isJavaScriptActive(): boolean {
        return !this.state.embedSimView && this.editor == this.textEditor
            && this.editorFile && this.editorFile.name == "main.ts";
    }

    private isAnyEditeableJavaScriptOrPackageActive(): boolean {
        return this.editor == this.textEditor
            && this.editorFile && !this.editorFile.isReadonly() && /(\.ts|pxt.json)$/.test(this.editorFile.name);
    }

    openJavaScript(giveFocusOnLoading = true) {
        if (this.isJavaScriptActive()) {
            if (this.state.embedSimView) {
                this.setState({ embedSimView: false });
            }
            if (giveFocusOnLoading) {
                this.textEditor.editor.focus();
            }
            return;
        }
        if (this.textEditor) {
            this.textEditor.giveFocusOnLoading = giveFocusOnLoading;
        }
        if (this.isBlocksActive()) {
            this.blocksEditor.openTypeScript();
        }
        else this.setFile(pkg.mainEditorPkg().files["main.ts"])
    }

    openBlocks() {
        if (this.isBlocksActive()) {
            if (this.state.embedSimView) this.setState({ embedSimView: false });
            return;
        }
        if (this.isJavaScriptActive() || (this.shouldTryDecompile && !this.state.embedSimView)) this.textEditor.openBlocks();
        // any other editeable .ts or pxt.json
        else if (this.isAnyEditeableJavaScriptOrPackageActive()) {
            this.saveFileAsync()
                .then(() => {
                    compiler.newProject();
                    return compiler.getBlocksAsync()
                })
                .done((bi: pxtc.BlocksInfo) => {
                    pxt.blocks.initBlocks(bi);
                    this.blocksEditor.updateBlocksInfo(bi);
                    this.setFile(pkg.mainEditorPkg().files["main.blocks"])
                });
        } else this.setFile(pkg.mainEditorPkg().files["main.blocks"]);

        this.shouldTryDecompile = false;
    }

    openSettings() {
        this.setFile(pkg.mainEditorPkg().lookupFile("this/pxt.json"));
    }

    openSerial(isSim: boolean) {
        if (!pxt.appTarget.serial || !pxt.appTarget.serial.useEditor)
            return; // not supported in this editor
        if (this.editor == this.serialEditor && this.serialEditor.isSim == isSim)
            return; // already showing

        const mainEditorPkg = pkg.mainEditorPkg()
        if (!mainEditorPkg) return; // no project loaded

        if (!mainEditorPkg.lookupFile("this/" + pxt.SERIAL_EDITOR_FILE)) {
            mainEditorPkg.setFile(pxt.SERIAL_EDITOR_FILE, "serial\n")
        }
        this.serialEditor.setSim(isSim)
        let event = "serial." + (isSim ? "simulator" : "device") + "EditorOpened"
        pxt.tickEvent(event)
        this.setFile(mainEditorPkg.lookupFile("this/" + pxt.SERIAL_EDITOR_FILE))
    }

    openPreviousEditor() {
        if (this.prevEditorId == "monacoEditor") {
            this.openJavaScript(false);
        } else {
            this.openBlocks();
        }
    }

    openTypeScriptAsync(): Promise<void> {
        return this.saveTypeScriptAsync(true)
            .then(() => {
                const header = this.state.header;
                if (header) {
                    header.editor = pxt.JAVASCRIPT_PROJECT_NAME;
                    header.pubCurrent = false
                }
            });
    }

    openSimView() {
        if (this.state.embedSimView) {
            this.startStopSimulator();
        } else {
            this.setState({ embedSimView: true });
            this.startSimulator();
        }
    }

    public typecheckNow() {
        this.saveFileAsync().done(); // don't wait for saving to backend store to finish before typechecking
        this.typecheck()
    }

    private autoRunBlocksSimulator = pxtc.Util.debounce(
        () => {
            if (Util.now() - this.lastChangeTime < 1000) return;
            if (!this.state.active)
                return;
            this.runSimulator({ background: true });
        },
        1000, true);

    private autoRunSimulator = pxtc.Util.debounce(
        () => {
            if (Util.now() - this.lastChangeTime < 1000) return;
            if (!this.state.active)
                return;
            this.runSimulator({ background: true });
        },
        2000, true);

    private typecheck = pxtc.Util.debounce(
        () => {
            if (this.editor.isIncomplete()) return;
            let state = this.editor.snapshotState()
            compiler.typecheckAsync()
                .done(resp => {
                    this.editor.setDiagnostics(this.editorFile, state)
                    if (pxt.appTarget.simulator && pxt.appTarget.simulator.autoRun) {
                        let output = pkg.mainEditorPkg().outputPkg.files["output.txt"];
                        if (output && !output.numDiagnosticsOverride
                            && !simulator.driver.runOptions.debug
                            && (simulator.driver.state == pxsim.SimulatorState.Running
                                || simulator.driver.state == pxsim.SimulatorState.Unloaded)) {
                            if (this.editor == this.blocksEditor) this.autoRunBlocksSimulator();
                            else this.autoRunSimulator();
                        }
                    }
                });
        }, 1000, false);

    private markdownChangeHandler = Util.debounce(() => {
        if (this.state.currFile && /\.md$/i.test(this.state.currFile.name))
            this.setSideMarkdown(this.editor.getCurrentSource());
    }, 4000, false);
    private editorChangeHandler = Util.debounce(() => {
        if (!this.editor.isIncomplete()) {
            this.saveFileAsync().done(); // don't wait till save is done
            this.typecheck();
        }
        this.markdownChangeHandler();
    }, 500, false);
    private initEditors() {
        this.textEditor = new monaco.Editor(this);
        this.pxtJsonEditor = new pxtjson.Editor(this);
        this.serialEditor = new serial.Editor(this);
        this.blocksEditor = new blocks.Editor(this);

        let changeHandler = () => {
            if (this.editorFile) {
                if (this.editorFile.inSyncWithEditor)
                    pxt.tickActivity("edit", "edit." + this.editor.getId().replace(/Editor$/, ''))
                this.editorFile.markDirty();
            }
            this.lastChangeTime = Util.now();
            if (this.state.running
                && pxt.appTarget.simulator && pxt.appTarget.simulator.stopOnChange)
                this.stopSimulator();
            this.editorChangeHandler();
        }
        this.allEditors = [this.pxtJsonEditor, this.blocksEditor, this.serialEditor, this.textEditor]
        this.allEditors.forEach(e => e.changeCallback = changeHandler)
        this.editor = this.allEditors[this.allEditors.length - 1]
    }

    public componentWillMount() {
        this.initEditors()
        this.initDragAndDrop();
    }

    public componentDidMount() {
        this.allEditors.forEach(e => e.prepare())
        simulator.init($("#boardview")[0], {
            highlightStatement: stmt => {
                if (this.editor) this.editor.highlightStatement(stmt)
            },
            restartSimulator: () => {
                core.hideDialog();
                this.runSimulator();
            },
            editor: this.state.header ? this.state.header.editor : ''
        })
        if (pxt.appTarget.appTheme.allowParentController || pxt.appTarget.appTheme.allowPackageExtensions || pxt.appTarget.appTheme.allowSimulatorTelemetry)
            pxt.editor.bindEditorMessages(this);
        this.forceUpdate(); // we now have editors prepared
    }

    private pickEditorFor(f: pkg.File): srceditor.Editor {
        return this.allEditors.filter(e => e.acceptsFile(f))[0]
    }

    private updatingEditorFile = false;
    private updateEditorFile(editorOverride: srceditor.Editor = null) {
        if (!this.state.active)
            return;
        if (this.state.currFile == this.editorFile && !editorOverride)
            return;
        if (this.updatingEditorFile)
            return;
        this.updatingEditorFile = true;
        this.saveSettings();

        const hc = this.state.highContrast;
        // save file before change
        return this.saveFileAsync()
            .then(() => {
                this.editorFile = this.state.currFile as pkg.File; // TODO
                let previousEditor = this.editor;
                this.prevEditorId = previousEditor.getId();
                this.editor = editorOverride || this.pickEditorFor(this.editorFile)
                this.allEditors.forEach(e => e.setVisible(e == this.editor))
                return previousEditor ? previousEditor.unloadFileAsync() : Promise.resolve();
            })
            .then(() => { return this.editor.loadFileAsync(this.editorFile, hc); })
            .then(() => {
                this.saveFileAsync().done(); // make sure state is up to date
                if (this.editor == this.textEditor || this.editor == this.blocksEditor)
                    this.typecheck();

                let e = this.settings.fileHistory.filter(e => e.id == this.state.header.id && e.name == this.editorFile.getName())[0]
                if (e)
                    this.editor.setViewState(e.pos)

                container.SideDocs.notify({
                    type: "fileloaded",
                    name: this.editorFile.getName(),
                    locale: pxt.Util.localeInfo()
                } as pxsim.SimulatorFileLoadedMessage)

                if (this.state.showBlocks && this.editor == this.textEditor) this.textEditor.openBlocks();
            }).finally(() => {
                this.forceUpdate();
                this.updatingEditorFile = false;
            })
    }

    setFile(fn: pkg.File) {
        if (!fn) return;

        if (fn.name === "main.ts") {
            this.shouldTryDecompile = true;
        }

        this.setState({
            currFile: fn,
            showBlocks: false,
            embedSimView: false
        })
        //this.fireResize();
    }

    setSideFile(fn: pkg.File) {
        const header = this.state.header;
        if (header) {
            header.editor = this.getPreferredEditor();
            header.pubCurrent = false
        }
        let fileName = fn.name;
        let currFile = this.state.currFile.name;
        if (fileName != currFile && pkg.File.blocksFileNameRx.test(fileName)) {
            // Going from ts -> blocks
            pxt.tickEvent("sidebar.showBlocks");
            let tsFileName = fn.getVirtualFileName();
            let tsFile = pkg.mainEditorPkg().lookupFile("this/" + tsFileName)
            if (currFile == tsFileName) {
                // current file is the ts file, so just switch
                this.textEditor.openBlocks();
            } else if (tsFile) {
                this.textEditor.decompileAsync(tsFile.name).then(resp => {
                    if (!resp.success) {
                        this.setFile(tsFile)
                        let tooLarge = false;
                        resp.diagnostics.forEach(d => tooLarge = (tooLarge || d.code === 9266 /* error code when script is too large */));
                        this.textEditor.showConversionFailedDialog(fn.name, tooLarge)
                    } else {
                        this.setFile(fn)
                    }
                });
            }
        } else {
            if (this.isTextEditor() || this.isPxtJsonEditor()) {
                this.textEditor.giveFocusOnLoading = false
            }

            this.setFile(fn)
        }
    }

    removeFile(fn: pkg.File, skipConfirm = false) {
        const removeIt = () => {
            pkg.mainEditorPkg().removeFileAsync(fn.name)
                .then(() => pkg.mainEditorPkg().saveFilesAsync(true))
                .then(() => this.reloadHeaderAsync())
                .done();
        }

        if (skipConfirm) {
            removeIt();
            return;
        }

        core.confirmAsync({
            header: lf("Remove {0}", fn.name),
            body: lf("You are about to remove a file from your project. You can't undo this. Are you sure?"),
            agreeClass: "red",
            agreeIcon: "trash",
            agreeLbl: lf("Remove it"),
        }).done(res => {
            if (res) removeIt();
        })
    }

    updateFileAsync(name: string, content: string, open?: boolean): Promise<void> {
        const p = pkg.mainEditorPkg();
        p.setFile(name, content);
        return p.updateConfigAsync(cfg => cfg.files.indexOf(name) < 0 ? cfg.files.push(name) : 0)
            .then(() => {
                if (open) this.setFile(p.lookupFile("this/" + name));
                return p.savePkgAsync();
            })
            .then(() => this.reloadHeaderAsync())
    }

    setSideMarkdown(md: string) {
        let sd = this.refs["sidedoc"] as container.SideDocs;
        if (!sd) return;
        sd.setMarkdown(md);
    }

    setSideDoc(path: string, blocksEditor = true) {
        let sd = this.refs["sidedoc"] as container.SideDocs;
        if (!sd) return;
        if (path) sd.setPath(path, blocksEditor);
        else sd.collapse();
    }

    setTutorialStep(step: number) {
        // save and typecheck
        this.typecheckNow();
        // Notify tutorial content pane
        let tc = this.refs["tutorialcard"] as tutorial.TutorialCard;
        if (!tc) return;
        if (step > -1) {
            tc.focusInitialized = false;
            let tutorialOptions = this.state.tutorialOptions;
            tutorialOptions.tutorialStep = step;
            this.setState({ tutorialOptions: tutorialOptions });
            const fullscreen = tutorialOptions.tutorialStepInfo[step].fullscreen;
            if (fullscreen) this.showTutorialHint();
            else tutorial.TutorialContent.refresh();
        }
    }

    handleMessage(msg: pxsim.SimulatorMessage) {
        switch (msg.type) {
            case "popoutcomplete":
                this.setState({ sideDocsCollapsed: true, sideDocsLoadUrl: '' })
                break;
            case "tutorial":
                let t = msg as pxsim.TutorialMessage;
                switch (t.subtype) {
                    case 'loaded':
                        let tt = msg as pxsim.TutorialLoadedMessage;
                        if (tt.toolboxSubset && Object.keys(tt.toolboxSubset).length > 0)
                            this.editor.filterToolbox({ blocks: tt.toolboxSubset, defaultState: pxt.editor.FilterState.Hidden }, CategoryMode.Basic);
                        let tutorialOptions = this.state.tutorialOptions;
                        tutorialOptions.tutorialReady = true;
                        tutorialOptions.tutorialStepInfo = tt.stepInfo;
                        this.setState({ tutorialOptions: tutorialOptions });
                        const fullscreen = tutorialOptions.tutorialStepInfo[0].fullscreen;
                        if (fullscreen) this.showTutorialHint();
                        else tutorial.TutorialContent.refresh();
                        core.hideLoading("tutorial");
                        break;
                    case 'error':
                        let te = msg as pxsim.TutorialFailedMessage;
                        pxt.reportException(te.message);
                        core.errorNotification(lf("We're having trouble loading this tutorial, please try again later."));
                        this.setState({ tutorialOptions: undefined });
                        // Delete the project created for this tutorial
                        let curr = pkg.mainEditorPkg().header
                        curr.isDeleted = true
                        workspace.saveAsync(curr, {})
                            .then(() => {
                                this.openHome();
                            }).finally(() => {
                                core.hideLoading("tutorial")
                            });
                        break;
                }
                break;
        }
    }

    reloadHeaderAsync() {
        return this.loadHeaderAsync(this.state.header, this.state.editorState)
    }

    loadHeaderAsync(h: pxt.workspace.Header, editorState?: pxt.editor.EditorState, inTutorial?: boolean): Promise<void> {
        if (!h)
            return Promise.resolve()

        this.stopSimulator(true);
        pxt.blocks.cleanBlocks();
        this.clearSerial()
        Util.jsonMergeFrom(editorState || {}, this.state.editorState || {});
        return pkg.loadPkgAsync(h.id)
            .then(() => {
                simulator.makeDirty();
                compiler.newProject();
                let e = this.settings.fileHistory.filter(e => e.id == h.id)[0]
                let main = pkg.getEditorPkg(pkg.mainPkg)
                let file = main.getMainFile()
                if (e)
                    file = main.lookupFile(e.name) || file
                if (!e && h.editor == pxt.JAVASCRIPT_PROJECT_NAME && !pkg.File.tsFileNameRx.test(file.getName()) && file.getVirtualFileName())
                    file = main.lookupFile("this/" + file.getVirtualFileName()) || file;
                if (pkg.File.blocksFileNameRx.test(file.getName()) && file.getVirtualFileName()) {
                    if (!file.content) // empty blocks file, open javascript editor
                        file = main.lookupFile("this/" + file.getVirtualFileName()) || file
                }
                this.setState({
                    home: false,
                    showFiles: false,
                    editorState: editorState,
                    tutorialOptions: inTutorial ? this.state.tutorialOptions : undefined,
                    header: h,
                    projectName: h.name,
                    currFile: file,
                    sideDocsLoadUrl: ''
                })

                if (file.name === "main.ts") {
                    this.shouldTryDecompile = true;
                }

                pkg.getEditorPkg(pkg.mainPkg).onupdate = () => {
                    this.loadHeaderAsync(h, this.state.editorState).done()
                }

                pkg.mainPkg.getCompileOptionsAsync()
                    .catch(e => {
                        if (e instanceof pxt.cpp.PkgConflictError) {
                            const confl = e as pxt.cpp.PkgConflictError
                            const remove = (lib: pxt.Package) => ({
                                label: lf("Remove {0}", lib.id),
                                class: "pink", // don't make them red and scary
                                icon: "trash",
                                onclick: () => {
                                    core.showLoading("removedep", lf("Removing {0}...", lib.id))
                                    pkg.mainEditorPkg().removeDepAsync(lib.id)
                                        .then(() => this.reloadHeaderAsync())
                                        .done(() => core.hideLoading("removedep"));
                                }
                            })
                            core.dialogAsync({
                                hideCancel: true,
                                buttons: [
                                    remove(confl.pkg1), // show later first in dialog
                                    remove(confl.pkg0)
                                ],
                                header: lf("Packages cannot be used together"),
                                body: lf("Packages '{0}' and '{1}' cannot be used together, because they use incompatible settings ({2}).",
                                    confl.pkg1.id, confl.pkg0.id, confl.settingName)
                            })
                        }
                    })
                    .done()

                const preferredEditor = this.pickEditorFor(file);
                const readme = main.lookupFile("this/README.md");
                if (readme && readme.content && readme.content.trim())
                    this.setSideMarkdown(readme.content);
                else if (pkg.mainPkg && pkg.mainPkg.config && pkg.mainPkg.config.documentation)
                    this.setSideDoc(pkg.mainPkg.config.documentation, preferredEditor == this.blocksEditor);
            }).finally(() => {
                // Editor is loaded
                pxt.BrowserUtils.changeHash("#editor", true);
                document.getElementById("root").focus(); // Clear the focus.
                this.editorLoaded();
            })
    }

    removeProject() {
        if (!pkg.mainEditorPkg().header) return;

        core.confirmDelete(pkg.mainEditorPkg().header.name, () => {
            let curr = pkg.mainEditorPkg().header
            curr.isDeleted = true
            return workspace.saveAsync(curr, {})
                .then(() => {
                    if (workspace.getHeaders().length > 0) {
                        this.openHome();
                    } else {
                        this.newProject();
                    }
                })
        })
    }

    importHexFile(file: File) {
        if (!file) return;
        pxt.cpp.unpackSourceFromHexFileAsync(file)
            .done(data => this.importHex(data));
    }

    importBlocksFiles(file: File) {
        if (!file) return;
        ts.pxtc.Util.fileReadAsTextAsync(file)
            .done(contents => {
                this.newProject({
                    filesOverride: { "main.blocks": contents, "main.ts": "  " },
                    name: file.name.replace(/\.blocks$/i, '') || lf("Untitled")
                })
            })
    }

    importTypescriptFile(file: File) {
        if (!file) return;
        ts.pxtc.Util.fileReadAsTextAsync(file)
            .done(contents => {
                this.newProject({
                    filesOverride: { "main.blocks": '', "main.ts": contents || "  " },
                    name: file.name.replace(/\.ts$/i, '') || lf("Untitled")
                })
            })
    }

    convertTouchDevelopToTypeScriptAsync(td: string): Promise<string> {
        return tdlegacy.td2tsAsync(td);
    }

    hexFileImporters: pxt.editor.IHexFileImporter[] = [{
        id: "default",
        canImport: data => data.meta.cloudId == "ks/" + pxt.appTarget.id || data.meta.cloudId == pxt.CLOUD_ID + pxt.appTarget.id // match on targetid
            || (Util.startsWith(data.meta.cloudId, pxt.CLOUD_ID + pxt.appTarget.id)) // trying to load white-label file into main target
        ,
        importAsync: (project, data) => {
            let h: pxt.workspace.InstallHeader = {
                target: pxt.appTarget.id,
                editor: data.meta.editor,
                name: data.meta.name,
                meta: {},
                pubId: "",
                pubCurrent: false
            };
            const files = JSON.parse(data.source) as pxt.Map<string>;
            // we cannot load the workspace until we've loaded the project
            return workspace.installAsync(h, files)
                .then(hd => this.loadHeaderAsync(hd, null));
        }
    }];

    resourceImporters: pxt.editor.IResourceImporter[] = [];

    importHex(data: pxt.cpp.HexFile, createNewIfFailed: boolean = false) {
        const targetId = pxt.appTarget.id;
        if (!data || !data.meta) {
            core.warningNotification(lf("Sorry, we could not recognize this file."))
            if (createNewIfFailed) this.openHome();
            return;
        }

        const importer = this.hexFileImporters.filter(fi => fi.canImport(data))[0];
        if (importer) {
            pxt.tickEvent("import." + importer.id);
            core.showLoading("importhex", lf("loading project..."))
            importer.importAsync(this, data)
                .done(() => core.hideLoading("importhex"), e => {
                    pxt.reportException(e, { importer: importer.id });
                    core.hideLoading("importhex");
                    core.errorNotification(lf("Oops, something went wrong when importing your project"));
                    if (createNewIfFailed) this.openHome();
                });
        }
        else {
            core.warningNotification(lf("Sorry, we could not import this project."))
            pxt.tickEvent("warning.importfailed");
            if (createNewIfFailed) this.openHome();
        }
    }

    importProjectFile(file: File) {
        if (!file) return;

        ts.pxtc.Util.fileReadAsBufferAsync(file)
            .then(buf => pxt.lzmaDecompressAsync(buf))
            .then(contents => {
                let data = JSON.parse(contents) as pxt.cpp.HexFile;
                this.importHex(data);
            }).catch(e => {
                core.warningNotification(lf("Sorry, we could not import this project."))
                this.openHome();
            });
    }

    importFile(file: File) {
        if (!file || pxt.shell.isReadOnly()) return;
        if (isHexFile(file.name)) {
            this.importHexFile(file)
        } else if (isBlocksFile(file.name)) {
            this.importBlocksFiles(file)
        } else if (isTypescriptFile(file.name)) {
            this.importTypescriptFile(file);
        } else if (isProjectFile(file.name)) {
            this.importProjectFile(file);
        } else {
            const importer = this.resourceImporters.filter(fi => fi.canImport(file))[0];
            if (importer) {
                importer.importAsync(this, file).done();
            } else {
                core.warningNotification(lf("Oops, don't know how to load this file!"));
            }
        }
    }

    importProjectAsync(project: pxt.workspace.Project, editorState?: pxt.editor.EditorState): Promise<void> {
        let h: pxt.workspace.InstallHeader = project.header;
        if (!h) {
            h = {
                target: pxt.appTarget.id,
                editor: pxt.BLOCKS_PROJECT_NAME,
                name: lf("Untitled"),
                meta: {},
                pubId: "",
                pubCurrent: false
            }
        }
        return workspace.installAsync(h, project.text)
            .then(hd => this.loadHeaderAsync(hd, editorState));
    }

    initDragAndDrop() {
        draganddrop.setupDragAndDrop(document.body,
            file => file.size < 1000000 && isHexFile(file.name) || isBlocksFile(file.name),
            files => {
                if (files) {
                    pxt.tickEvent("dragandrop.open")
                    this.importFile(files[0]);
                }
            }
        );
    }

    openHome() {
        this.stopSimulator();
        // clear the hash
        pxt.BrowserUtils.changeHash("", true);
        this.setState({ home: true });
        this.homeLoaded();
    }

    private homeLoaded() {
        pxt.tickEvent('app.home');
    }

    private editorLoaded() {
        pxt.tickEvent('app.editor');
    }

    exitAndSave() {
        if (this.state.projectName !== lf("Untitled")) {
            this.openHome();
        }
        else {
            this.exitAndSaveDialog.show();
        }
    }

    exportProjectToFileAsync(): Promise<Uint8Array> {
        const mpkg = pkg.mainPkg;
        return mpkg.compressToFileAsync(this.getPreferredEditor())
    }

    getPreferredEditor(): string {
        return this.editor == this.blocksEditor ? pxt.BLOCKS_PROJECT_NAME : pxt.JAVASCRIPT_PROJECT_NAME;
    }

    exportAsync(): Promise<string> {
        pxt.debug("exporting project");
        return this.exportProjectToFileAsync()
            .then((buf) => {
                return window.btoa(Util.uint8ArrayToString(buf));
            });
    }

    importProjectFromFileAsync(buf: Uint8Array): Promise<void> {
        return pxt.lzmaDecompressAsync(buf)
            .then((project) => {
                let hexFile = JSON.parse(project) as pxt.cpp.HexFile;
                return this.importHex(hexFile);
            }).catch(() => {
                return this.newProject();
            })
    }

    saveProjectToFileAsync(): Promise<void> {
        const mpkg = pkg.mainPkg
        return this.exportProjectToFileAsync()
            .then((buf: Uint8Array) => {
                const fn = pkg.genFileName(".mkcd");
                pxt.BrowserUtils.browserDownloadUInt8Array(buf, fn, 'application/octet-stream');
            })
    }

    addPackage() {
        this.scriptSearch.showAddPackages();
    }

    openExtension(extension: string, url: string, consentRequired?: boolean) {
        pxt.tickEvent("app.openextension", { extension: extension });
        this.extensions.showExtension(extension, url, consentRequired);
    }

    handleExtensionRequest(request: pxt.editor.ExtensionRequest): void {
        this.extensions.handleExtensionRequest(request);
    }

    newEmptyProject(name?: string, documentation?: string) {
        this.newProject({
            filesOverride: { "main.blocks": `<xml xmlns="http://www.w3.org/1999/xhtml"></xml>` },
            name, documentation
        })
    }

    newProject(options: ProjectCreationOptions = {}) {
        pxt.tickEvent("app.newproject");
        core.showLoading("newproject", lf("creating new project..."));
        this.createProjectAsync(options)
            .then(() => Promise.delay(500))
            .done(() => core.hideLoading("newproject"));
    }

    createProjectAsync(options: ProjectCreationOptions): Promise<void> {
        this.setSideDoc(undefined);
        if (!options.prj) options.prj = pxt.appTarget.blocksprj;
        let cfg = pxt.U.clone(options.prj.config);
        cfg.name = options.name || lf("Untitled");
        cfg.documentation = options.documentation;
        let files: pxt.workspace.ScriptText = Util.clone(options.prj.files)
        if (options.filesOverride)
            Util.jsonCopyFrom(files, options.filesOverride)
        files["pxt.json"] = JSON.stringify(cfg, null, 4) + "\n"
        return workspace.installAsync({
            name: cfg.name,
            meta: {},
            editor: options.prj.id,
            pubId: "",
            pubCurrent: false,
            target: pxt.appTarget.id,
            temporary: options.temporary
        }, files).then(hd => this.loadHeaderAsync(hd, { filters: options.filters }, options.inTutorial))
    }

    switchTypeScript() {
        const mainPkg = pkg.mainEditorPkg();
        const tsName = this.editorFile.getVirtualFileName();
        const f = mainPkg.files[tsName];
        this.setFile(f);
    }

    saveBlocksToTypeScriptAsync(): Promise<string> {
        return this.blocksEditor.saveToTypeScript();
    }

    saveTypeScriptAsync(open = false): Promise<void> {
        if (!this.editor || !this.state.currFile || this.editorFile.epkg != pkg.mainEditorPkg() || this.reload)
            return Promise.resolve();

        let promise = Promise.resolve().then(() => {
            return open ? this.textEditor.loadMonacoAsync() : Promise.resolve();
        }).then(() => {
            return this.editor.saveToTypeScript().then((src) => {
                if (!src) return Promise.resolve();
                // format before saving
                // if (open) src = pxtc.format(src, 0).formatted;

                let mainPkg = pkg.mainEditorPkg();
                let tsName = this.editorFile.getVirtualFileName();
                Util.assert(tsName != this.editorFile.name);
                return mainPkg.setContentAsync(tsName, src).then(() => {
                    if (open) {
                        let f = mainPkg.files[tsName];
                        this.setFile(f);
                    }
                });
            });
        });

        if (open) {
            return core.showLoadingAsync("switchtojs", lf("switching to JavaScript..."), promise, 0);
        } else {
            return promise;
        }
    }

    resetWorkspace() {
        this.reload = true;
        return workspace.resetAsync()
            .done(
            () => window.location.reload(),
            () => window.location.reload()
            );
    }

    reset() {
        core.confirmAsync({
            header: lf("Reset"),
            body: lf("You are about to clear all projects. Are you sure? This operation cannot be undone."),
            agreeLbl: lf("Reset"),
            agreeClass: "red focused",
            agreeIcon: "sign out",
            disagreeLbl: lf("Cancel")
        }).then(r => {
            if (!r) return Promise.resolve();
            if (hf2Connection) {
                return hf2Connection.disconnectAsync()
                    .then(() => this.resetWorkspace())
            } else {
                return this.resetWorkspace()
            }
        });
    }

    promptRenameProjectAsync(): Promise<boolean> {
        if (!this.state.header) return Promise.resolve(false);

        const opts: core.ConfirmOptions = {
            header: lf("Rename your project"),
            agreeLbl: lf("Save"),
            agreeClass: "green",
            input: lf("Enter your project name here")
        };
        return core.confirmAsync(opts).then(res => {
            if (!res || !opts.inputValue) return Promise.resolve(false); // cancelled

            return new Promise<void>((resolve, reject) => {
                this.setState({ projectName: opts.inputValue }, () => resolve());
            }).then(() => this.saveProjectNameAsync())
                .then(() => true);
        });
    }

    saveAndCompile() {
        if (!this.state.header) return;
        this.setState({ isSaving: true });

        return (this.state.projectName !== lf("Untitled")
            ? Promise.resolve(true) : this.promptRenameProjectAsync())
            .then(() => this.saveProjectNameAsync())
            .then(() => this.saveFileAsync())
            .then(() => {
                if (!pxt.appTarget.compile.hasHex || pxt.appTarget.compile.useMkcd) {
                    this.saveProjectToFileAsync()
                        .finally(() => {
                            this.setState({ isSaving: false });
                        })
                        .done();
                }
                else {
                    this.compile(true);
                }
            });
    }

    beforeCompile() { }

    compile(saveOnly = false) {
        // the USB init has to be called from an event handler
        if (/webusb=1/i.test(window.location.href)) {
            pxt.usb.initAsync().catch(e => { })
        }
        this.beforeCompile();
        let userContextWindow: Window = undefined;
        if (!pxt.appTarget.compile.useModulator && pxt.BrowserUtils.isBrowserDownloadInSameWindow())
            userContextWindow = window.open("");

        pxt.tickEvent("compile");
        pxt.debug('compiling...');
        if (this.state.compiling) {
            pxt.tickEvent("compile.double");
            return;
        }
        const simRestart = this.state.running;
        this.setState({ compiling: true });
        this.clearSerial();
        this.editor.beforeCompile();
        if (simRestart) this.stopSimulator();
        let state = this.editor.snapshotState()
        compiler.compileAsync({ native: true, forceEmit: true, preferredEditor: this.getPreferredEditor() })
            .then(resp => {
                this.editor.setDiagnostics(this.editorFile, state)
                let fn = pxt.outputName()
                if (!resp.outfiles[fn]) {
                    pxt.tickEvent("compile.noemit")
                    core.warningNotification(lf("Compilation failed, please check your code for errors."));
                    return Promise.resolve()
                }
                resp.saveOnly = saveOnly
                resp.userContextWindow = userContextWindow;
                resp.downloadFileBaseName = pkg.genFileName("");
                resp.confirmAsync = core.confirmAsync;
                if (saveOnly) {
                    return pxt.commands.saveOnlyAsync(resp);
                }
                return pxt.commands.deployCoreAsync(resp)
                    .catch(e => {
                        if (e.notifyUser) {
                            core.warningNotification(e.message);
                        } else {
                            const errorText = pxt.appTarget.appTheme.useUploadMessage ? lf("Upload failed, please try again.") : lf("Download failed, please try again.");
                            core.warningNotification(errorText);
                        }
                        pxt.reportException(e);
                        if (userContextWindow)
                            try { userContextWindow.close() } catch (e) { }
                    })
            }).catch((e: Error) => {
                pxt.reportException(e);
                core.errorNotification(lf("Compilation failed, please contact support."));
                if (userContextWindow)
                    try { userContextWindow.close() } catch (e) { }
            }).finally(() => {
                this.setState({ compiling: false, isSaving: false });
                if (simRestart) this.runSimulator();
            })
            .done();
    }

    overrideTypescriptFile(text: string) {
        if (this.textEditor) this.textEditor.overrideFile(text);
    }

    overrideBlocksFile(text: string) {
        if (this.blocksEditor) this.blocksEditor.overrideFile(text);
    }

    startStopSimulator() {
        if (this.state.running) {
            this.stopSimulator()
        } else {
            this.startSimulator();
        }
    }

    restartSimulator() {
        this.stopSimulator();
        this.startSimulator();
    }

    toggleTrace(intervalSpeed?: number) {
        if (this.state.tracing) {
            this.editor.clearHighlightedStatements();
            simulator.setTraceInterval(0);
        }
        else {
            simulator.setTraceInterval(intervalSpeed != undefined ? intervalSpeed : simulator.SLOW_TRACE_INTERVAL);
        }
        this.setState({ tracing: !this.state.tracing })
        this.restartSimulator();
    }

    startSimulator() {
        pxt.tickEvent('simulator.start')
        this.saveFileAsync()
            .then(() => this.runSimulator());
    }

    stopSimulator(unload?: boolean) {
        pxt.tickEvent('simulator.stop')
        simulator.stop(unload)
        this.setState({ running: false })
    }

    proxySimulatorMessage(content: string) {
        simulator.proxy({
            type: "custom",
            content: content
        } as pxsim.SimulatorCustomMessage);
    }

    toggleSimulatorCollapse() {
        const state = this.state;
        if (!state.running && state.collapseEditorTools)
            this.startStopSimulator();

        if (state.collapseEditorTools) {
            this.expandSimulator();
        }
        else {
            this.collapseSimulator();
        }
    }

    expandSimulator() {
        if (pxt.appTarget.simulator.headless) {
            simulator.unhide();
        }
        else {
            this.startSimulator();
        }
        this.setState({ collapseEditorTools: false });
    }

    collapseSimulator() {
        simulator.hide(() => {
            this.setState({ collapseEditorTools: true });
        })
    }

    // Close on escape
    closeOnEscape = (e: KeyboardEvent) => {
        if (e.keyCode !== 27) return
        e.preventDefault()
        this.toggleSimulatorFullscreen();
    }

    toggleSimulatorFullscreen() {
        if (!this.state.fullscreen) {
            document.addEventListener('keydown', this.closeOnEscape);
        } else {
            document.removeEventListener('keydown', this.closeOnEscape);
        }
        this.closeFlyout();

        this.setState({ fullscreen: !this.state.fullscreen });
    }

    closeFlyout() {
        this.editor.closeFlyout();
    }

    toggleMute() {
        simulator.mute(!this.state.mute);
        this.setState({ mute: !this.state.mute });
    }

    openInstructions() {
        const running = this.state.running;
        if (running) this.stopSimulator();
        make.makeAsync()
            .finally(() => {
                if (running) this.startSimulator()
            })
    }

    clearSerial() {
        this.serialEditor.clear()
        const simIndicator = this.refs["simIndicator"] as serialindicator.SerialIndicator
        const devIndicator = this.refs["devIndicator"] as serialindicator.SerialIndicator
        if (simIndicator) simIndicator.clear()
        if (devIndicator) devIndicator.clear()
    }

    hwDebug() {
        let start = Promise.resolve()
        if (!this.state.running || !simulator.driver.runOptions.debug)
            start = this.runSimulator({ debug: true })
        return start.then(() => {
            simulator.driver.setHwDebugger({
                postMessage: (msg) => {
                    pxt.HWDBG.handleMessage(msg as pxsim.DebuggerMessage)
                }
            })
            pxt.HWDBG.postMessage = (msg) => simulator.driver.handleHwDebuggerMsg(msg)
            return Promise.join<any>(
                compiler.compileAsync({ debug: true, native: true }),
                hidbridge.initAsync()
            ).then(vals => pxt.HWDBG.startDebugAsync(vals[0], vals[1]))
        })
    }

    runSimulator(opts: compiler.CompileOptions = {}) {
        const editorId = this.editor ? this.editor.getId().replace(/Editor$/, '') : "unknown";
        if (opts.background) pxt.tickActivity("autorun", "autorun." + editorId);
        else pxt.tickEvent(opts.debug ? "debug" : "run", { editor: editorId });

        if (!opts.background)
            this.editor.beforeCompile();
        if (this.state.tracing)
            opts.trace = true;

        this.stopSimulator();

        const state = this.editor.snapshotState()
        return compiler.compileAsync(opts)
            .then(resp => {
                this.clearSerial();
                this.editor.setDiagnostics(this.editorFile, state)
                if (resp.outfiles[pxtc.BINARY_JS]) {
                    simulator.run(pkg.mainPkg, opts.debug, resp, this.state.mute, this.state.highContrast)
                    this.setState({ running: true, showParts: simulator.driver.runOptions.parts.length > 0 })
                } else if (!opts.background) {
                    core.warningNotification(lf("Oops, we could not run this project. Please check your code for errors."))
                }
            })
    }

    editText() {
        if (this.editor != this.textEditor) {
            this.updateEditorFile(this.textEditor).then(() => {
                this.textEditor.editor.focus();
            });
            this.forceUpdate();
        }
    }

    importFileDialog() {
        let input: HTMLInputElement;
        let ext = ".mkcd";
        if (pxt.appTarget.compile && pxt.appTarget.compile.hasHex) {
            ext = ".hex";
        }
        if (pxt.appTarget.compile && pxt.appTarget.compile.useUF2) {
            ext = ".uf2";
        }
        core.confirmAsync({
            header: lf("Open {0} file", ext),
            onLoaded: ($el) => {
                input = $el.find('input')[0] as HTMLInputElement;
            },
            htmlBody: `<div class="ui form">
  <div class="ui field">
    <label id="selectFileToOpenLabel">${lf("Select a {0} file to open.", ext)}</label>
    <input type="file" tabindex="0" autofocus aria-describedby="selectFileToOpenLabel" class="ui blue fluid focused"></input>
  </div>
</div>`,
        }).done(res => {
            if (res) {
                pxt.tickEvent("app.open.file");
                this.importFile(input.files[0]);
            }
        })
    }

    importProjectDialog() {
        this.importDialog.show();
    }

    showReportAbuse() {
        let urlInput: JQuery;
        let reasonInput: JQuery;
        const shareUrl = pxt.appTarget.appTheme.shareUrl || "https://makecode.com/";
        core.confirmAsync({
            header: lf("Report Abuse"),
            onLoaded: ($el) => {
                urlInput = $el.find('input');
                reasonInput = $el.find('textarea');
                if (this.state.header && this.state.header.pubCurrent && this.state.header.pubId)
                    urlInput.val(shareUrl + this.state.header.pubId);
            },
            agreeLbl: lf("Submit"),
            htmlBody: `<div class="ui form">
  <div class="ui field">
    <label>${lf("What is the URL of the offensive project?")}</label>
    <input type="url" class="focused" tabindex="0" autofocus placeholder="Enter project URL here..."></input>
  </div>
  <div class="ui field">
    <label>${lf("Why do you find it offensive?")}</label>
    <textarea></textarea>
  </div>
</div>`,
        }).done(res => {
            if (res) {
                pxt.tickEvent("app.reportabuse.send");
                const id = pxt.Cloud.parseScriptId(urlInput.val());
                if (!id) {
                    core.errorNotification(lf("Sorry, the project url looks invalid."));
                } else {
                    core.infoNotification(lf("Sending abuse report..."));
                    Cloud.privatePostAsync(`${id}/abusereports`, {
                        text: reasonInput.val()
                    })
                        .then(res => {
                            core.infoNotification(lf("Report sent. Thank you!"))
                        })
                        .catch(e => {
                            if (e.statusCode == 404)
                                core.warningNotification(lf("Oops, we could not find this script."))
                            else
                                core.handleNetworkError(e)
                        });
                }
            }
        })
    }

    importUrlDialog() {
        let input: HTMLInputElement;
        const shareUrl = pxt.appTarget.appTheme.shareUrl || "https://makecode.com/";
        core.confirmAsync({
            header: lf("Open project URL"),
            onLoaded: ($el) => {
                input = $el.find('input')[0] as HTMLInputElement;
            },
            htmlBody: `<div class="ui form">
<div class="ui icon violet message">
    <i class="user icon"></i>
    <div class="content">
        <h3 class="header">
            ${lf("User-provided content")}
        </h3>
        <p>
            ${lf("The content below is provided by a user, and is not endorsed by Microsoft.")}
            ${lf("If you think it's not appropriate, please report abuse through Settings -> Report Abuse.")}
        </p>
    </div>
</div>
  <div class="ui field">
    <label id="selectUrlToOpenLabel">${lf("Copy the URL of the project.")}</label>
    <input type="url" tabindex="0" autofocus aria-describedby="selectUrlToOpenLabel" placeholder="${shareUrl}..." class="ui blue fluid"></input>
  </div>
</div>`,
        }).done(res => {
            if (res) {
                pxt.tickEvent("app.open.url");
                const id = pxt.Cloud.parseScriptId(input.value);
                if (!id) {
                    core.errorNotification(lf("Sorry, the project url looks invalid."));
                } else {
                    loadHeaderBySharedId(id);
                }
            }
        })
    }

    launchFullEditor() {
        Util.assert(pxt.shell.isSandboxMode());

        let editUrl = pxt.appTarget.appTheme.embedUrl;
        if (!/\/$/.test(editUrl)) editUrl += '/';

        const mpkg = pkg.mainPkg
        const epkg = pkg.getEditorPkg(mpkg)
        if (pxt.shell.isReadOnly()) {
            if (epkg.header.pubId) { }
            editUrl += `#pub:${epkg.header.pubId}`;
            window.open(editUrl, '_blank');
        }
        else this.exportAsync()
            .done(fileContent => {
                pxt.tickEvent("sandbox.openfulleditor");
                editUrl += `#project:${fileContent}`;
                window.open(editUrl, '_blank')
            });
    }

    anonymousPublishAsync(): Promise<string> {
        pxt.tickEvent("publish");
        this.setState({ publishing: true })
        const mpkg = pkg.mainPkg
        const epkg = pkg.getEditorPkg(mpkg)
        return this.saveProjectNameAsync()
            .then(() => this.saveFileAsync())
            .then(() => mpkg.filesToBePublishedAsync(true))
            .then(files => {
                if (epkg.header.pubCurrent)
                    return Promise.resolve(epkg.header.pubId)
                const meta: workspace.ScriptMeta = {
                    description: mpkg.config.description,
                };
                const blocksSize = this.blocksEditor.contentSize();
                if (blocksSize) {
                    meta.blocksHeight = blocksSize.height;
                    meta.blocksWidth = blocksSize.width;
                }
                return workspace.anonymousPublishAsync(epkg.header, files, meta)
                    .then(inf => inf.id)
            }).finally(() => {
                this.setState({ publishing: false })
            })
            .catch(e => {
                core.errorNotification(e.message)
                throw e;
            })
    }

    private debouncedSaveProjectName = Util.debounce(() => {
        this.saveProjectNameAsync().done();
    }, 2000, false);

    updateHeaderName(name: string) {
        this.setState({
            projectName: name
        })
        this.debouncedSaveProjectName();
    }

    saveProjectNameAsync(): Promise<void> {
        if (!this.state.projectName || !this.state.header) return Promise.resolve();

        try {
            return this.updateHeaderNameAsync(this.state.projectName);
        }
        catch (e) {
            pxt.reportException(e);
            return Promise.resolve();
        }
    }

    updateHeaderNameAsync(name: string): Promise<void> {
        // nothing to do?
        if (pkg.mainPkg.config.name == name)
            return Promise.resolve();

        //Save the name in the target MainPackage as well
        pkg.mainPkg.config.name = name;

        pxt.debug('saving project name to ' + name);
        let f = pkg.mainEditorPkg().lookupFile("this/" + pxt.CONFIG_NAME);
        let config = JSON.parse(f.content) as pxt.PackageConfig;
        config.name = name;
        return f.setContentAsync(JSON.stringify(config, null, 4) + "\n")
            .then(() => {
                if (this.state.header)
                    this.setState({
                        projectName: name
                    })
            });
    }

    isTextEditor(): boolean {
        return this.editor == this.textEditor;
    }

    isPxtJsonEditor(): boolean {
        return this.editor == this.pxtJsonEditor;
    }

    isBlocksEditor(): boolean {
        return this.editor == this.blocksEditor;
    }

    about() {
        const compileService = pxt.appTarget.compileService;
        const description = pxt.appTarget.description || pxt.appTarget.title;
        const githubUrl = pxt.appTarget.appTheme.githubUrl;
        core.confirmAsync({
            header: lf("About {0}", pxt.appTarget.name),
            hideCancel: true,
            agreeLbl: lf("Ok"),
            agreeClass: "positive focused",
            htmlBody: `
${description ? `<p>${Util.htmlEscape(description)}</p>` : ``}
${githubUrl ? `<p>${lf("{0} version:", Util.htmlEscape(pxt.appTarget.name))} <a class="focused" href="${Util.htmlEscape(githubUrl)}/releases/tag/v${Util.htmlEscape(pxt.appTarget.versions.target)}" aria-label="${lf("{0} version : {1}", Util.htmlEscape(pxt.appTarget.name), Util.htmlEscape(pxt.appTarget.versions.target))}" target="_blank">${Util.htmlEscape(pxt.appTarget.versions.target)}</a></p>` : ``}
<p>${lf("{0} version:", "Microsoft MakeCode")} <a href="https://github.com/Microsoft/pxt/releases/tag/v${Util.htmlEscape(pxt.appTarget.versions.pxt)}" aria-label="${lf("{0} version: {1}", "Microsoft MakeCode", Util.htmlEscape(pxt.appTarget.versions.pxt))}" target="_blank">${Util.htmlEscape(pxt.appTarget.versions.pxt)}</a></p>
${compileService && compileService.githubCorePackage && compileService.gittag ? `<p>${lf("{0} version:", "C++ runtime")} <a href="${Util.htmlEscape("https://github.com/" + compileService.githubCorePackage + '/releases/tag/' + compileService.gittag)}" aria-label="${lf("{0} version: {1}", "C++ runtime", Util.htmlEscape(compileService.gittag))}" target="_blank">${Util.htmlEscape(compileService.gittag)}</a></p>` : ""}
`
        }).done();
    }

    share() {
        const header = this.state.header;
        this.shareEditor.show(header);
    }

    selectLang() {
        this.languagePicker.show();
    }

    renderBlocksAsync(req: pxt.editor.EditorMessageRenderBlocksRequest): Promise<string> {
        return compiler.getBlocksAsync()
            .then(blocksInfo => compiler.decompileSnippetAsync(req.ts, blocksInfo))
            .then(resp => {
                const svg = pxt.blocks.render(resp, { snippetMode: true });
                const viewBox = svg.getAttribute("viewBox").split(/\s+/).map(d => parseInt(d));
                return pxt.blocks.layout.blocklyToSvgAsync(svg, viewBox[0], viewBox[1], viewBox[2], viewBox[3]);
            }).then(re => re.xml);
    }

    startTutorial(tutorialId: string, tutorialTitle?: string) {
        pxt.tickEvent("tutorial.start");
        // Check for Internet access
        if (!pxt.Cloud.isNavigatorOnline()) {
            core.errorNotification(lf("No Internet access, please connect and try again."));
        } else {
            core.showLoading("tutorial", lf("starting tutorial..."));
            this.startTutorialAsync(tutorialId, tutorialTitle);
        }
    }

    startTutorialAsync(tutorialId: string, tutorialTitle?: string): Promise<void> {
        let title = tutorialTitle || tutorialId.split('/').reverse()[0].replace('-', ' '); // drop any kind of sub-paths
        let result: string[] = [];

        sounds.initTutorial(); // pre load sounds
        return Promise.resolve()
            .then(() => {
                let tutorialOptions: pxt.editor.TutorialOptions = {
                    tutorial: tutorialId,
                    tutorialName: title,
                    tutorialStep: 0
                };
                this.setState({ tutorialOptions: tutorialOptions, editorState: { searchBar: false }, tracing: undefined })
                let tc = this.refs["tutorialcontent"] as tutorial.TutorialContent;
                tc.setPath(tutorialId);
            }).then(() => {
                return this.createProjectAsync({
                    name: title,
                    inTutorial: true
                });
            }).catch((e) => {
                core.hideLoading("tutorial");
                core.handleNetworkError(e);
            });
    }

    completeTutorial() {
        pxt.tickEvent("tutorial.complete");
        core.showLoading("leavingtutorial", lf("leaving tutorial..."));
        this.exitTutorialAsync()
            .then(() => {
                let curr = pkg.mainEditorPkg().header;
                return this.loadHeaderAsync(curr);
            }).done(() => {
                core.hideLoading("leavingtutorial");
            })
    }

    exitTutorial() {
        pxt.tickEvent("tutorial.exit");
        core.showLoading("leavingtutorial", lf("leaving tutorial..."));
        this.exitTutorialAsync()
            .done(() => {
                core.hideLoading("leavingtutorial");
                this.openHome();
            })
    }

    exitTutorialAsync() {
        let curr = pkg.mainEditorPkg().header;
        let files = pkg.mainEditorPkg().getAllFiles();
        return workspace.saveAsync(curr, files)
            .then(() => Promise.delay(500))
            .finally(() => {
                this.setState({ tutorialOptions: undefined, tracing: undefined, editorState: undefined });
                core.resetFocus();
            });
    }

    toggleHighContrast() {
        const highContrastOn = !this.state.highContrast;
        pxt.tickEvent("app.highcontrast", { on: highContrastOn ? 1 : 0 });
        this.setState({ highContrast: highContrastOn }, () => this.restartSimulator());
        core.highContrast = highContrastOn;
        if (this.editor && this.editor.isReady) {
            this.editor.setHighContrast(highContrastOn);
        }
    }

    showTutorialHint() {
        let th = this.refs["tutorialhint"] as tutorial.TutorialHint;
        th.showHint();
        const options = this.state.tutorialOptions;
        pxt.tickEvent(`tutorial.showhint`, { tutorial: options.tutorial, step: options.tutorialStep });
    }

    setBanner(b: boolean) {
        this.setState({ bannerVisible: b });
    }

    renderCore() {
        theEditor = this;

        if (this.editor && this.editor.isReady) {
            this.updateEditorFile();
        }

        //  ${targetTheme.accentColor ? "inverted accent " : ''}
        const settings: Cloud.UserSettings = (Cloud.isLoggedIn() ? this.getData("cloud:me/settings?format=nonsensitive") : {}) || {}
        const targetTheme = pxt.appTarget.appTheme;
        const sharingEnabled = pxt.appTarget.cloud && pxt.appTarget.cloud.sharing;
        const sandbox = pxt.shell.isSandboxMode();
        const isBlocks = !this.editor.isVisible || this.getPreferredEditor() == pxt.BLOCKS_PROJECT_NAME;
        const sideDocs = !(sandbox || targetTheme.hideSideDocs);
        const tutorialOptions = this.state.tutorialOptions;
        const inTutorial = !!tutorialOptions && !!tutorialOptions.tutorial;
        const inHome = this.state.home && !sandbox;
        const inEditor = !!this.state.header;

        const { hideMenuBar, hideEditorToolbar } = targetTheme;
        const isHeadless = pxt.appTarget.simulator.headless;
        const selectLanguage = targetTheme.selectLanguage;
        const showEditorToolbar = !hideEditorToolbar && this.editor.hasEditorToolbar();
        const useSerialEditor = pxt.appTarget.serial && !!pxt.appTarget.serial.useEditor;

        const showSideDoc = sideDocs && this.state.sideDocsLoadUrl && !this.state.sideDocsCollapsed;
        const shouldHideEditorFloats = (this.state.hideEditorFloats || this.state.collapseEditorTools) && (!inTutorial || isHeadless);
        const shouldCollapseEditorTools = this.state.collapseEditorTools && (!inTutorial || isHeadless);

        const isApp = electron.isElectron || pxt.winrt.isWinRT();

        // cookie consent
        const cookieKey = "cookieconsent"
        const cookieConsented = targetTheme.hideCookieNotice || isApp || !!pxt.storage.getLocal(cookieKey)
            || sandbox;

        // update window title
        document.title = this.state.header ? `${this.state.header.name} - ${pxt.appTarget.name}` : pxt.appTarget.name;

        const rootClasses = sui.cx([
            shouldHideEditorFloats ? " hideEditorFloats" : '',
            shouldCollapseEditorTools ? " collapsedEditorTools" : '',
            this.state.fullscreen ? 'fullscreensim' : '',
            this.state.highContrast ? 'hc' : '',
            showSideDoc ? 'sideDocs' : '',
            pxt.shell.layoutTypeClass(),
            inHome ? 'inHome' : '',
            inTutorial ? 'tutorial' : '',
            pxt.options.light ? 'light' : '',
            pxt.BrowserUtils.isTouchEnabled() ? 'has-touch' : '',
            hideMenuBar ? 'hideMenuBar' : '',
            !showEditorToolbar ? 'hideEditorToolbar' : '',
            this.state.bannerVisible ? "notificationBannerVisible" : "",
            sandbox && this.isEmbedSimActive() ? 'simView' : '',
            'full-abs',
            'dimmable'
        ]);

        return (
            <div id='root' className={rootClasses}>
                {hideMenuBar ? undefined :
                    <header className="menubar" role="banner">
                        {inEditor ? <accessibility.EditorAccessibilityMenu parent={this} highContrast={this.state.highContrast}/> : undefined }
                        <notification.NotificationBanner parent={this} />
                        <container.MainMenu parent={this} />
                    </header>}
                {inTutorial ? <div id="maineditor" className={sandbox ? "sandbox" : ""} role="main">
                    <tutorial.TutorialCard ref="tutorialcard" parent={this} />
                </div> : undefined}
                <div id="simulator">
                    <aside id="filelist" className="ui items">
                        <label htmlFor="boardview" id="boardviewLabel" className="accessible-hidden" aria-hidden="true">{lf("Simulator") }</label>
                        <div id="boardview" className={`ui vertical editorFloat`} role="region" aria-labelledby="boardviewLabel">
                        </div>
                        <simtoolbar.SimulatorToolbar parent={this} />
                        <div className="ui item portrait hide">
                            {pxt.options.debug && !this.state.running ? <sui.Button key='debugbtn' class='teal' icon="xicon bug" text={"Sim Debug"} onClick={() => this.runSimulator({ debug: true }) } /> : ''}
                            {pxt.options.debug ? <sui.Button key='hwdebugbtn' class='teal' icon="xicon chip" text={"Dev Debug"} onClick={() => this.hwDebug() } /> : ''}
                        </div>
                        {useSerialEditor ?
                            <div id="serialPreview" className="ui editorFloat portrait hide">
                                <serialindicator.SerialIndicator ref="simIndicator" isSim={true} onClick={() => this.openSerial(true) } />
                                <serialindicator.SerialIndicator ref="devIndicator" isSim={false} onClick={() => this.openSerial(false) } />
                            </div> : undefined}
                        {sandbox || isBlocks || this.editor == this.serialEditor ? undefined : <filelist.FileList parent={this} />}
                    </aside>
                </div>
                <div id="maineditor" className={sandbox ? "sandbox" : ""} role="main">
                    {this.allEditors.map(e => e.displayOuter()) }
                </div>
                {inHome ? <div id="homescreen" className="full-abs" role="main">
                    <div className="ui home projectsdialog">
                        <div className="menubar" role="banner">
                            <accessibility.HomeAccessibilityMenu parent={this} highContrast={this.state.highContrast}/> }
                            <projects.ProjectsMenu parent={this} />
                        </div>
                        <projects.Projects parent={this} ref={v => this.home = v} />
                    </div>
                </div> : undefined }
                {inTutorial ? <tutorial.TutorialHint ref="tutorialhint" parent={this} /> : undefined}
                {inTutorial ? <tutorial.TutorialContent ref="tutorialcontent" parent={this} /> : undefined}
                {showEditorToolbar ? <div id="editortools" role="complementary" aria-label={lf("Editor toolbar") }>
                    <editortoolbar.EditorToolbar ref="editortools" parent={this} />
                </div> : undefined}
                {sideDocs ? <container.SideDocs ref="sidedoc" parent={this} sideDocsCollapsed={this.state.sideDocsCollapsed} docsUrl={this.state.sideDocsLoadUrl}/> : undefined}
                {sandbox ? undefined : <scriptsearch.ScriptSearch parent={this} ref={v => this.scriptSearch = v} />}
                {sandbox ? undefined : <extensions.Extensions parent={this} ref={v => this.extensions = v} />}
                {inHome ? <projects.ImportDialog parent={this} ref={v => this.importDialog = v} /> : undefined}
                {sandbox ? undefined : <projects.ExitAndSaveDialog parent={this} ref={v => this.exitAndSaveDialog = v} />}
                {sandbox || !sharingEnabled ? undefined : <share.ShareEditor parent={this} ref={v => this.shareEditor = v} />}
                {selectLanguage ? <lang.LanguagePicker parent={this} ref={v => this.languagePicker = v} /> : undefined}
                {sandbox ? <container.SandboxFooter parent={this} /> : undefined}
                {cookieConsented ? undefined : <container.CookieMessage parent={this} cookieConsented={cookieConsented} cookieKey={cookieKey} /> }
                {hideMenuBar ? <div id="editorlogo"><a className="poweredbylogo"></a></div> : undefined}
            </div>
        );
    }
}


function render() {
    ReactDOM.render(<ProjectView />, $('#content')[0])
}

function getEditor() {
    return theEditor
}

function isHexFile(filename: string): boolean {
    return /\.(hex|uf2)$/i.test(filename)
}

function isBlocksFile(filename: string): boolean {
    return /\.blocks$/i.test(filename)
}

function isTypescriptFile(filename: string): boolean {
    return /\.ts$/i.test(filename);
}

function isProjectFile(filename: string): boolean {
    return /\.(pxt|mkcd)$/i.test(filename)
}

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

let serialConnectionPoller: number;
let hidPingInterval: number;
let hf2Connection: pxt.HF2.Wrapper;

function startSerialConnectionPoller() {
    if (serialConnectionPoller == null)
        serialConnectionPoller = window.setInterval(initSerial, 5000);
}

function stopSerialConnectionPoller() {
    clearInterval(serialConnectionPoller);
    serialConnectionPoller = null;
}

function initSerial() {
    if (!pxt.appTarget.serial || !pxt.winrt.isWinRT() && (!Cloud.isLocalHost() || !Cloud.localToken))
        return;

    if (hidbridge.shouldUse()) {
        hidbridge.initAsync(true)
            .then(dev => {
                hf2Connection = dev;
                // disable poller when connected; otherwise the forceful reconnecting interferes with
                // flashing; it may also lead to data loss on serial stream
                stopSerialConnectionPoller()
                if (hidPingInterval == null)
                    hidPingInterval = window.setInterval(() => {
                        if (serialConnectionPoller == null)
                            dev.pingAsync()
                                .then(() => {
                                }, e => {
                                    pxt.debug("re-starting connection poller")
                                    startSerialConnectionPoller()
                                })
                    }, 4900)
                dev.onSerial = (buf, isErr) => {
                    let data = Util.fromUTF8(Util.uint8ArrayToString(buf))
                    //pxt.debug('serial: ' + data)
                    window.postMessage({
                        type: 'serial',
                        id: 'n/a', // TODO
                        data
                    }, "*")
                }
            })
            .catch(e => {
                pxt.log(`hidbridge failed to load, ${e}`);
                startSerialConnectionPoller();
            })
        return
    }

    pxt.debug('initializing serial pipe');
    let ws = new WebSocket(`ws://localhost:${pxt.options.wsPort}/${Cloud.localToken}/serial`);
    let serialBuffers: pxt.Map<string> = {};
    ws.onopen = (ev) => {
        pxt.debug('serial: socket opened');
        stopSerialConnectionPoller()
    }
    ws.onclose = (ev) => {
        pxt.debug('serial: socket closed')
        startSerialConnectionPoller()
    }
    ws.onerror = (ev) => {
        pxt.debug('serial: error')
        startSerialConnectionPoller()
    }
    ws.onmessage = (ev) => {
        try {
            let msg = JSON.parse(ev.data) as pxsim.SimulatorSerialMessage;
            if (msg && msg.type == "serial") {
                //pxt.debug('serial: ' + msg.data)
                pxt.Util.bufferSerial(serialBuffers, msg.data, msg.id);
            }
        }
        catch (e) {
            pxt.debug('unknown message: ' + ev.data);
        }
    }
}

function getsrc() {
    pxt.log(theEditor.editor.getCurrentSource())
}

function initScreenshots() {
    window.addEventListener('message', (ev: MessageEvent) => {
        let msg = ev.data as pxsim.SimulatorMessage;
        if (msg && msg.type == "screenshot") {
            pxt.tickEvent("sim.screenshot");
            const scmsg = msg as pxsim.SimulatorScreenshotMessage;
            pxt.debug('received screenshot');
            screenshot.saveAsync(theEditor.state.header, scmsg.data)
                .done(() => { pxt.debug('screenshot saved') })
        };
    }, false);
}

function enableAnalytics() {
    pxt.analytics.enable();
    pxt.editor.enableControllerAnalytics();

    const stats: pxt.Map<string | number> = {}
    if (typeof window !== "undefined") {
        const screen = window.screen;
        stats["screen.width"] = screen.width;
        stats["screen.height"] = screen.height;
        stats["screen.availwidth"] = screen.availWidth;
        stats["screen.availheight"] = screen.availHeight;
        stats["screen.innerWidth"] = window.innerWidth;
        stats["screen.innerHeight"] = window.innerHeight;
        stats["screen.devicepixelratio"] = pxt.BrowserUtils.devicePixelRatio();
    }
    pxt.tickEvent("editor.loaded", stats);
}

function showIcons() {
    let usedIcons = [
        "cancel", "certificate", "checkmark", "cloud", "cloud upload", "copy", "disk outline", "download",
        "dropdown", "edit", "file outline", "find", "folder", "folder open", "help circle",
        "keyboard", "lock", "play", "puzzle", "search", "setting", "settings",
        "share alternate", "sign in", "sign out", "square", "stop", "translate", "trash", "undo", "upload",
        "user", "wizard", "configure", "align left"
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

function log(v: any) {
    console.log(v)
}

// This is for usage from JS console
let myexports: any = {
    workspace,
    require,
    core,
    getEditor,
    monaco,
    blocks,
    compiler,
    pkg,
    getsrc,
    sim: simulator,
    apiAsync: core.apiAsync,
    showIcons,
    assembleCurrent,
    log
};
(window as any).E = myexports;

export var ksVersion: string;

function parseHash(): { cmd: string; arg: string } {
    let hashCmd = ""
    let hashArg = ""
    let hashM = /^#(\w+)(:([\/\-\+\=\w]+))?$/.exec(window.location.hash)
    if (hashM) {
        return { cmd: hashM[1], arg: hashM[3] || '' };
    }
    return { cmd: '', arg: '' };
}

function handleHash(hash: { cmd: string; arg: string }, loading: boolean): boolean {
    if (!hash) return false;
    let editor = theEditor;
    if (!editor) return false;

    if (isProjectRelatedHash(hash)) editor.setState({ home: false });

    switch (hash.cmd) {
        case "doc":
            pxt.tickEvent("hash.doc")
            editor.setSideDoc(hash.arg, editor == this.blockEditor);
            break;
        case "follow":
            pxt.tickEvent("hash.follow")
            editor.newEmptyProject(undefined, hash.arg);
            return true;
        case "newproject": // shortcut to create a new blocks proj
            pxt.tickEvent("hash.newproject")
            editor.newProject();
            pxt.BrowserUtils.changeHash("");
            return true;
        case "newjavascript": // shortcut to create a new JS proj
            pxt.tickEvent("hash.newjavascript");
            editor.newProject({
                prj: pxt.appTarget.blocksprj,
                filesOverride: {
                    "main.blocks": ""
                }
            });
            pxt.BrowserUtils.changeHash("");
            return true;
        case "gettingstarted":
            pxt.tickEvent("hash.gettingstarted");
            editor.newProject();
            pxt.BrowserUtils.changeHash("");
            return true;
        case "tutorial": // shortcut to a tutorial. eg: #tutorial:tutorials/getting-started
            pxt.tickEvent("hash.tutorial")
            editor.startTutorial(hash.arg);
            pxt.BrowserUtils.changeHash("");
            return true;
        case "home": // shortcut to home
            pxt.tickEvent("hash.home");
            editor.openHome();
            pxt.BrowserUtils.changeHash("");
            return true;
        case "sandbox":
        case "pub":
        case "edit": // load a published proj, eg: #pub:27750-32291-62442-22749
            pxt.tickEvent("hash." + hash.cmd);
            pxt.BrowserUtils.changeHash("");
            loadHeaderBySharedId(hash.arg);
            return true;
        case "sandboxproject":
        case "project":
            pxt.tickEvent("hash." + hash.cmd);
            const fileContents = Util.stringToUint8Array(atob(hash.arg));
            pxt.BrowserUtils.changeHash("");
            core.showLoading("loadingproject", lf("loading project..."));
            theEditor.importProjectFromFileAsync(fileContents)
                .done(() => core.hideLoading("loadingproject"));
            return true;
        case "reload": // need to reload last project - handled later in the load process
            if (loading) pxt.BrowserUtils.changeHash("");
            return false;
    }

    return false;
}

// Determines whether the hash argument affects the starting project
function isProjectRelatedHash(hash: { cmd: string; arg: string }): boolean {
    if (!hash) {
        return false;
    }
    switch (hash.cmd) {
        case "follow":
        case "newproject":
        case "newjavascript":
        // case "gettingstarted": // This should be true, #gettingstarted hash handling is not yet implemented
        case "tutorial":
        case "projects":
        case "sandbox":
        case "pub":
        case "edit":
        case "sandboxproject":
        case "project":
        case "reload":
            return true;
        default:
            return false;
    }
}

function loadHeaderBySharedId(id: string) {
    const existing = workspace.getHeaders()
        .filter(h => h.pubCurrent && h.pubId == id)[0]
    core.showLoading("loadingheader", lf("loading project..."));
    (existing
        ? theEditor.loadHeaderAsync(existing, null)
        : workspace.installByIdAsync(id)
            .then(hd => theEditor.loadHeaderAsync(hd, null)))
        .catch(core.handleNetworkError)
        .finally(() => core.hideLoading("loadingheader"));
}

function initHashchange() {
    window.addEventListener("hashchange", e => {
        handleHash(parseHash(), false);
    });
}

function initExtensionsAsync(): Promise<void> {
    if (!pxt.appTarget.appTheme || !pxt.appTarget.appTheme.extendEditor) return Promise.resolve();

    pxt.debug('loading editor extensions...');
    const opts: pxt.editor.ExtensionOptions = {};
    return pxt.BrowserUtils.loadScriptAsync(pxt.webConfig.commitCdnUrl + "editor.js")
        .then(() => pxt.editor.initExtensionsAsync(opts))
        .then(res => {
            if (res.hexFileImporters) {
                res.hexFileImporters.forEach(fi => {
                    pxt.debug(`\tadded hex importer ${fi.id}`);
                    theEditor.hexFileImporters.push(fi);
                });
            }
            if (res.resourceImporters) {
                res.resourceImporters.forEach(fi => {
                    pxt.debug(`\tadded resource importer ${fi.id}`);
                    theEditor.resourceImporters.push(fi);
                });
            }
            if (res.deployCoreAsync) {
                pxt.debug(`\tadded custom deploy core async`);
                pxt.commands.deployCoreAsync = res.deployCoreAsync;
            }
            if (res.showUploadInstructionsAsync) {
                pxt.debug(`\tadded custom upload instructions async`);
                pxt.commands.showUploadInstructionsAsync = res.showUploadInstructionsAsync;
            }
            if (res.beforeCompile) {
                theEditor.beforeCompile = res.beforeCompile;
            }
            if (res.fieldEditors) {
                res.fieldEditors.forEach(fi => {
                    pxt.blocks.registerFieldEditor(fi.selector, fi.editor, fi.validator);
                })
            }
            if (res.toolboxOptions) {
                if (res.toolboxOptions.blocklyXml) {
                    baseToolbox.overrideBaseToolbox(res.toolboxOptions.blocklyXml);
                }
                if (res.toolboxOptions.monacoToolbox) {
                    monacoToolbox.overrideToolbox(res.toolboxOptions.monacoToolbox);
                }
            }
        });
}

pxt.winrt.captureInitialActivation();
$(document).ready(() => {
    pxt.setupWebConfig((window as any).pxtConfig);
    const config = pxt.webConfig
    pxt.options.debug = /dbg=1/i.test(window.location.href);
    pxt.options.light = /light=1/i.test(window.location.href) || pxt.BrowserUtils.isARM() || pxt.BrowserUtils.isIE();
    const wsPortMatch = /wsport=(\d+)/i.exec(window.location.href);
    if (wsPortMatch) {
        pxt.options.wsPort = parseInt(wsPortMatch[1]) || 3233;
        pxt.BrowserUtils.changeHash(window.location.hash.replace(wsPortMatch[0], ""));
    } else {
        pxt.options.wsPort = 3233;
    }
    pkg.setupAppTarget((window as any).pxtTargetBundle)

    enableAnalytics()

    if (!pxt.BrowserUtils.isBrowserSupported() && !/skipbrowsercheck=1/i.exec(window.location.href)) {
        pxt.tickEvent("unsupported");
        window.location.href = "/browsers";
        core.showLoading("browsernotsupported", lf("Sorry, this browser is not supported."));
        return;
    }

    initLogin();
    const hash = parseHash();
    const appCacheUpdated = () => {
        try {
            // On embedded pages, preserve the loaded project
            if (pxt.BrowserUtils.isIFrame() && hash.cmd === "pub") {
                location.hash = `#pub:${hash.arg}`;
            }
            // if in editor, reload project
            else if (theEditor
                && !theEditor.home.state.visible
                && theEditor.state && theEditor.state.header && !theEditor.state.header.isDeleted) {
                location.hash = "#reload"
            }
            location.reload();
        } catch (e) {
            pxt.reportException(e);
            location.reload();
        }
    };
    appcache.init(appCacheUpdated);

    pxt.docs.requireMarked = () => require("marked");
    const importHex = (hex: pxt.cpp.HexFile, createNewIfFailed = false) => theEditor.importHex(hex, createNewIfFailed);

    const hm = /^(https:\/\/[^/]+)/.exec(window.location.href)
    if (hm) Cloud.apiRoot = hm[1] + "/api/"

    const ws = /ws=(\w+)/.exec(window.location.href)
    const isSandbox = pxt.shell.isSandboxMode() || pxt.shell.isReadOnly();
    if (ws) workspace.setupWorkspace(ws[1]);
    else if (pxt.appTarget.appTheme.allowParentController) workspace.setupWorkspace("iframe");
    else if (isSandbox) workspace.setupWorkspace("mem");
    else if (pxt.winrt.isWinRT()) workspace.setupWorkspace("uwp");
    else if (Cloud.isLocalHost()) workspace.setupWorkspace("fs");
    Promise.resolve()
        .then(() => {
            const mlang = /(live)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
            if (mlang && window.location.hash.indexOf(mlang[0]) >= 0) {
                lang.setCookieLang(mlang[2]);
                pxt.BrowserUtils.changeHash(window.location.hash.replace(mlang[0], ""));
            }
            const useLang = mlang ? mlang[2] : (lang.getCookieLang() || pxt.appTarget.appTheme.defaultLocale || navigator.userLanguage || navigator.language);
            const live = !pxt.appTarget.appTheme.disableLiveTranslations || (mlang && !!mlang[1]);
            if (useLang) pxt.tickEvent("locale." + useLang + (live ? ".live" : ""));
            lang.initialLang = useLang;
            return Util.updateLocalizationAsync(
                pxt.appTarget.id,
                false,
                config.commitCdnUrl,
                useLang,
                pxt.appTarget.versions.pxtCrowdinBranch,
                pxt.appTarget.versions.targetCrowdinBranch,
                live)
                // Download sim translations and save them in the sim
                .then(() => Util.downloadSimulatorLocalizationAsync(
                    pxt.appTarget.id,
                    config.commitCdnUrl,
                    useLang,
                    pxt.appTarget.versions.pxtCrowdinBranch,
                    pxt.appTarget.versions.targetCrowdinBranch,
                    live
                )).then((simStrings) => {
                    if (simStrings)
                        simulator.simTranslations = simStrings;
                });
        })
        .then(() => pxt.BrowserUtils.initTheme())
        .then(() => cmds.initCommandsAsync())
        .then(() => {
            return workspace.initAsync();
        })
        .then(() => {
            render();
            return workspace.syncAsync();
        })
        .then((state) => {
            if (state) {
                theEditor.setState({ editorState: state });
            }
            initSerial();
            startSerialConnectionPoller();
            initScreenshots();
            initHashchange();
            electron.init();
            return initExtensionsAsync();
        })
        .then(() => pxt.winrt.initAsync(importHex))
        .then(() => pxt.winrt.hasActivationProjectAsync())
        .then((hasWinRTProject) => {
            const ent = theEditor.settings.fileHistory.filter(e => !!workspace.getHeader(e.id))[0];
            let hd = workspace.getHeaders()[0];
            if (ent) hd = workspace.getHeader(ent.id);

            if (theEditor.shouldShowHomeScreen() && !hasWinRTProject) {
                return Promise.resolve();
            } else {
                // Hide the home screen
                theEditor.setState({ home: false });
            }
            if (hash.cmd && handleHash(hash, true)) {
                return Promise.resolve();
            }
            if (hasWinRTProject) {
                return pxt.winrt.loadActivationProject();
            }

            // default handlers
            if (hd) return theEditor.loadHeaderAsync(hd, theEditor.state.editorState)
            else theEditor.newProject();
            return Promise.resolve();
        })
        .then(() => workspace.importLegacyScriptsAsync())
        .done(() => {
            $("#loading").remove();
        });

    document.addEventListener("visibilitychange", ev => {
        if (theEditor)
            theEditor.updateVisibility();
    });

    window.addEventListener("unload", ev => {
        if (theEditor)
            theEditor.saveSettings()
    });
    window.addEventListener("resize", ev => {
        if (theEditor && theEditor.editor)
            theEditor.editor.resize(ev)
    }, false);

    const ipcRenderer = (window as any).ipcRenderer;
    if (ipcRenderer)
        ipcRenderer.on('responseFromApp', (event: any, message: any) => {
            // IPC renderer sends a string, we need to convert to an object to send to the simulator iframe
            try {
                simulator.driver.postMessage(JSON.parse(message));
            } catch (e) {

            }
        });
    window.addEventListener("message", ev => {
        let m = ev.data as pxsim.SimulatorMessage;
        if (!m) {
            return;
        }

        if (ev.data.__proxy == "parent") {
            pxt.debug("received parent proxy message" + ev.data);
            delete ev.data.__proxy;
            const ipcRenderer = (window as any).ipcRenderer;
            if (ipcRenderer)
                ipcRenderer.sendToHost("sendToApp", ev.data);
            else if (window.parent && window != window.parent)
                window.parent.postMessage(ev.data, "*");
        }

        if (m.type == "tutorial" || m.type == "popoutcomplete") {
            if (theEditor && theEditor.editor)
                theEditor.handleMessage(m);
        }
        if (m.type === "sidedocready" && Cloud.isLocalHost() && Cloud.localToken) {
            container.SideDocs.notify({
                type: "localtoken",
                localToken: Cloud.localToken
            } as pxsim.SimulatorDocMessage);
            tutorial.TutorialContent.notify({
                type: "localtoken",
                localToken: Cloud.localToken
            } as pxsim.SimulatorDocMessage);
        }
    }, false);
})
