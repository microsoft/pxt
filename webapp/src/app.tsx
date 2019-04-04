/// <reference path="../../localtypings/pxtpackage.d.ts"/>
/// <reference path="../../built/pxtlib.d.ts"/>
/// <reference path="../../built/pxtblocks.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts"/>
/// <reference path="../../built/pxtwinrt.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as cloudsync from "./cloudsync";
import * as data from "./data";
import * as pkg from "./package";
import * as core from "./core";
import * as sui from "./sui";
import * as simulator from "./simulator";
import * as srceditor from "./srceditor"
import * as compiler from "./compiler"
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
import * as dialogs from "./dialogs";
import * as filelist from "./filelist";
import * as container from "./container";
import * as scriptsearch from "./scriptsearch";
import * as projects from "./projects";
import * as scriptmanager from "./scriptmanager";
import * as extensions from "./extensions";
import * as sounds from "./sounds";
import * as make from "./make";
import * as blocklyToolbox from "./blocksSnippets";
import * as monacoToolbox from "./monacoSnippets";
import * as greenscreen from "./greenscreen";
import * as socketbridge from "./socketbridge";
import * as webusb from "./webusb";

import * as monaco from "./monaco"
import * as pxtjson from "./pxtjson"
import * as serial from "./serial"
import * as blocks from "./blocks"
import * as serialindicator from "./serialindicator"
import * as draganddrop from "./draganddrop";
import * as notification from "./notification";
import * as electron from "./electron";

type IAppProps = pxt.editor.IAppProps;
type IAppState = pxt.editor.IAppState;
type IProjectView = pxt.editor.IProjectView;
type FileHistoryEntry = pxt.editor.FileHistoryEntry;
type EditorSettings = pxt.editor.EditorSettings;
type ProjectCreationOptions = pxt.editor.ProjectCreationOptions;

import Cloud = pxt.Cloud;
import Util = pxt.Util;

pxsim.util.injectPolyphils();

let theEditor: ProjectView;
let pendingEditorRequests: ((p: ProjectView) => void)[];

function getEditorAsync() {
    if (theEditor) return Promise.resolve(theEditor);
    if (!pendingEditorRequests) pendingEditorRequests = [];
    return new Promise<ProjectView>(resolve => {
        pendingEditorRequests.push(resolve);
    });
}

function setEditor(editor: ProjectView) {
    theEditor = editor;
    if (pendingEditorRequests) {
        while (pendingEditorRequests.length) {
            const resolve = pendingEditorRequests.shift();
            resolve(editor);
        }
        pendingEditorRequests = undefined;
    }
}

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
    scriptManagerDialog: scriptmanager.ScriptManagerDialog;
    importDialog: projects.ImportDialog;
    exitAndSaveDialog: projects.ExitAndSaveDialog;
    chooseHwDialog: projects.ChooseHwDialog;
    prevEditorId: string;
    screenshotHandlers: ((msg: pxt.editor.ScreenshotData) => void)[] = [];

    private lastChangeTime: number;
    private reload: boolean;
    private shouldTryDecompile: boolean;
    private firstRun: boolean;

    private runToken: pxt.Util.CancellationToken;

    constructor(props: IAppProps) {
        super(props);
        document.title = pxt.appTarget.title || pxt.appTarget.name;
        this.reload = false; //set to true in case of reset of the project where we are going to reload the page.
        this.settings = JSON.parse(pxt.storage.getLocal("editorSettings") || "{}")
        const shouldShowHomeScreen = this.shouldShowHomeScreen();
        const isSandbox = pxt.shell.isSandboxMode() || pxt.shell.isReadOnly();
        const isHighContrast = /hc=(\w+)/.test(window.location.href);
        if (isHighContrast) core.setHighContrast(true);

        const simcfg = pxt.appTarget.simulator;
        this.state = {
            showFiles: false,
            home: shouldShowHomeScreen,
            active: document.visibilityState == 'visible' || pxt.BrowserUtils.isElectron() || pxt.winrt.isWinRT() || pxt.appTarget.appTheme.dontSuspendOnVisibility,
            // don't start collapsed in mobile since we can go fullscreen now
            collapseEditorTools: simcfg.headless,
            highContrast: isHighContrast,
            simState: pxt.editor.SimState.Stopped,
            autoRun: this.autoRunOnStart()
        };
        if (!this.settings.editorFontSize) this.settings.editorFontSize = /mobile/i.test(navigator.userAgent) ? 15 : 19;
        if (!this.settings.fileHistory) this.settings.fileHistory = [];
        if (shouldShowHomeScreen) this.homeLoaded();

        this.hwDebug = this.hwDebug.bind(this);
        this.hideLightbox = this.hideLightbox.bind(this);
        this.openSimSerial = this.openSimSerial.bind(this);
        this.openDeviceSerial = this.openDeviceSerial.bind(this);
        this.toggleGreenScreen = this.toggleGreenScreen.bind(this);
        this.toggleSimulatorFullscreen = this.toggleSimulatorFullscreen.bind(this);
        this.initScreenshots();
    }

    private autoRunOnStart() {
        return pxt.appTarget.simulator && (pxt.appTarget.simulator.autoRun || !!pxt.appTarget.simulator.emptyRunCode)
    }

    private initScreenshots() {
        window.addEventListener('message', (ev: MessageEvent) => {
            let msg = ev.data as pxsim.SimulatorMessage;
            if (!msg || !this.state.header) return;

            if (msg.type == "screenshot") {
                const scmsg = msg as pxsim.SimulatorScreenshotMessage;
                if (!scmsg.data) return;
                const handler = this.screenshotHandlers[this.screenshotHandlers.length - 1];
                if (handler)
                    handler(scmsg)
                else {
                    const pngString = pxt.BrowserUtils.imageDataToPNG(scmsg.data);
                    if (pxt.appTarget.compile.saveAsPNG)
                        this.encodeProjectAsPNGAsync(pngString, false).done();
                    screenshot.saveAsync(this.state.header, pngString)
                        .done(() => { pxt.debug('screenshot saved') })
                }
            } else if (msg.type == "recorder") {
                const scmsg = msg as pxsim.SimulatorRecorderMessage;
                const handler = this.screenshotHandlers[this.screenshotHandlers.length - 1];
                if (handler)
                    handler({
                        event: scmsg.action
                    } as pxt.editor.ScreenshotData)
            }
        }, false);
    }

    shouldShowHomeScreen() {
        const hash = parseHash();
        const isSandbox = pxt.shell.isSandboxMode() || pxt.shell.isReadOnly();
        // Only show the start screen if there are no initial projects requested
        // (e.g. from the URL hash or from WinRT activation arguments)
        const skipStartScreen = pxt.appTarget.appTheme.allowParentController
            || pxt.shell.isControllerMode()
            || /^#editor/.test(window.location.hash);
        return !isSandbox && !skipStartScreen && !isProjectRelatedHash(hash);
    }

    updateVisibility() {
        if (pxt.BrowserUtils.isElectron() || pxt.winrt.isWinRT() || pxt.appTarget.appTheme.dontSuspendOnVisibility) {
            // Don't suspend when inside apps
            return;
        }
        let active = document.visibilityState == 'visible';
        pxt.debug(`page visibility: ${active}`)
        this.setState({ active: active });

        if (!active && this.state.autoRun) {
            if (simulator.driver.state == pxsim.SimulatorState.Running) {
                this.suspendSimulator();
                this.setState({ resumeOnVisibility: true });
            }
            this.saveFileAsync().done();
        } else {
            if (workspace.isSessionOutdated()) {
                pxt.debug('workspace changed, reloading...')
                let id = this.state.header ? this.state.header.id : '';
                workspace.initAsync()
                    .done(() => !this.state.home && id ? this.loadHeaderAsync(workspace.getHeader(id), this.state.editorState) : Promise.resolve());
            } else if (this.state.resumeOnVisibility) {
                this.setState({ resumeOnVisibility: false });
                // We did a save when the page was hidden, no need to save again.
                this.runSimulator();
            }
        }
    }

    saveSettings() {
        if (this.reload) {
            return;
        }

        let f = this.editorFile
        if (f && f.epkg.getTopHeader() && this.editor.hasHistory()) {
            this.pushFileHistory(f.epkg.getTopHeader().id, f.getName(), this.editor.getViewState());
        }

        pxt.storage.setLocal("editorSettings", JSON.stringify(this.settings))
    }

    private pushFileHistory(id: string, name: string, pos: any) {
        const sett = this.settings
        let n: FileHistoryEntry = {
            id: id,
            name: name,
            pos: pos
        }
        sett.fileHistory = sett.fileHistory.filter(e => e.id != n.id || e.name != n.name)
        while (sett.fileHistory.length > 100)
            sett.fileHistory.pop()
        sett.fileHistory.unshift(n)
    }

    openProjectInLegacyEditor(majorVersion: number) {
        if (!this.editorFile || !this.editorFile.epkg || !this.editorFile.epkg.getTopHeader()) return Promise.resolve();

        const header = this.editorFile.epkg.getTopHeader();
        pxt.tickEvent("update.openLegacyEditor", { version: header.targetVersion });

        return workspace.copyProjectToLegacyEditor(header, majorVersion)
            .then(newHeader => {
                // Push an entry to the history so that the project loads when we change the URL. The editor
                // will ignore non-existent entries so this shouldn't affect any versions except the one
                // we choose
                this.pushFileHistory(newHeader.id, this.editorFile.getName(), this.editor.getViewState());
                pxt.storage.setLocal("editorSettings", JSON.stringify(this.settings))

                const appTheme = pxt.appTarget.appTheme;
                if (appTheme && appTheme.editorVersionPaths && appTheme.editorVersionPaths[majorVersion]) {
                    const newPath = appTheme.editorVersionPaths[majorVersion];
                    window.location.href = pxt.Util.pathJoin(window.location.origin, newPath + "#editor");
                }
                else {
                    window.location.href = pxt.Util.pathJoin(window.location.origin, "v" + header.targetVersion + "#editor");
                }
            })
            .catch(e => {
                core.warningNotification(lf("Importing to older editor version only supported in web browsers"));
            });
    }

    componentDidUpdate() {
        this.saveSettings()
        this.editor.domUpdate();
        simulator.setState(this.state.header ? this.state.header.editor : '', this.state.tutorialOptions && !!this.state.tutorialOptions.tutorial)
        this.editor.resize();

        let p = Promise.resolve();
        if (this.editor && this.editor.isReady) {
            p = p.then(() => this.updateEditorFileAsync());
        }
        if (this.editor) {
            p = p.then(() => {
                this.editor.updateBreakpoints();
                this.editor.updateToolbox()
            });
        }
        p.done();
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

    updateEditorLogo(left: number, rgba?: string): number {
        if (pxt.appTarget.appTheme.hideMenuBar) {
            const editorLogo = document.getElementById('editorlogo');
            if (editorLogo) {
                editorLogo.style.left = `${left}px`;
                editorLogo.style.display = 'block';
                editorLogo.style.background = rgba || '';
                return editorLogo.offsetHeight;
            }
        }
        return 0;
    }

    saveFileAsync(): Promise<void> {
        if (!this.editorFile)
            return Promise.resolve()
        return this.saveTypeScriptAsync()
            .then(() => {
                let txt = this.editor.getCurrentSource()
                if (txt != this.editorFile.content)
                    simulator.setDirty();
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

    isPythonActive(): boolean {
        return !this.state.embedSimView && this.editor == this.textEditor
            && this.editorFile && this.editorFile.name == "main.py";
    }

    private isAnyEditeableJavaScriptOrPackageActive(): boolean {
        return this.editor == this.textEditor
            && this.editorFile && !this.editorFile.isReadonly() && /(\.ts|pxt.json)$/.test(this.editorFile.name);
    }

    openPython(giveFocusOnLoading = true) {
        if (this.state.updatingEditorFile) return; // already transitioning

        if (this.isPythonActive()) {
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

        // switch
        if (this.isBlocksActive()) {
            this.blocksEditor.openPython();
        } else if (this.isJavaScriptActive()) {
            this.openPythonAsync().done();
        } else {
            // make sure there's .py file
            const mpkg = pkg.mainEditorPkg();
            const mainpy = mpkg.files["main.py"];
            if (!mainpy)
                mpkg.setFile("main.py", "# ...");
            this.setFile(pkg.mainEditorPkg().files["main.py"])
        }
    }

    openJavaScript(giveFocusOnLoading = true) {
        if (this.state.updatingEditorFile) return; // already transitioning

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
        } else if (this.isPythonActive()) {
            this.openTypeScriptAsync().done()
        } else this.setFile(pkg.mainEditorPkg().files["main.ts"])
    }

    openBlocks() {
        if (this.state.updatingEditorFile) return; // already transitioning

        if (this.isBlocksActive()) {
            if (this.state.embedSimView) this.setState({ embedSimView: false });
            return;
        }
        if (this.isJavaScriptActive() || (this.shouldTryDecompile && !this.state.embedSimView)) this.textEditor.openBlocks();
        // any other editeable .ts or pxt.json
        else if (this.isAnyEditeableJavaScriptOrPackageActive()) {
            this.saveFileAsync().then(() => this.textEditor.openBlocks());
        } else {
            const header = this.state.header;

            // Check to see if the last edit happened in monaco
            if (header && header.editor !== pxt.BLOCKS_PROJECT_NAME) {
                this.textEditor.openBlocks();
            }
            else {
                this.setFile(pkg.mainEditorPkg().files["main.blocks"])
            }
        }

        this.shouldTryDecompile = false;
    }

    openSettings() {
        this.setFile(pkg.mainEditorPkg().lookupFile("this/pxt.json"));
    }

    openSimSerial() {
        this.openSerial(true);
    }

    openDeviceSerial() {
        this.openSerial(false);
    }

    openSerial(isSim: boolean) {
        if (!pxt.appTarget.serial || !pxt.appTarget.serial.useEditor)
            return; // not supported in this editor
        if (this.editor == this.serialEditor && this.serialEditor.isSim == isSim)
            return; // already showing

        const mainEditorPkg = pkg.mainEditorPkg()
        if (!mainEditorPkg) return; // no project loaded

        if (!mainEditorPkg.lookupFile("this/" + pxt.SERIAL_EDITOR_FILE)) {
            mainEditorPkg.setFile(pxt.SERIAL_EDITOR_FILE, "serial\n", true)
        }
        this.serialEditor.setSim(isSim)
        let event = "serial." + (isSim ? "simulator" : "device") + "EditorOpened"
        pxt.tickEvent(event)
        this.setFile(mainEditorPkg.lookupFile("this/" + pxt.SERIAL_EDITOR_FILE))
    }

    openPreviousEditor() {
        const hasBlocks = !!pkg.mainEditorPkg().files["main.blocks"];
        if (this.prevEditorId == "monacoEditor" || !hasBlocks) {
            this.openJavaScript(false);
        } else {
            this.openBlocks();
        }
    }

    openTypeScriptAsync(): Promise<void> {
        return this.saveTypeScriptAsync(true);
    }

    openPythonAsync(): Promise<void> {
        // convert python to typescript, if same as current source, skip decompilation
        const tssrc = pkg.mainEditorPkg().files["main.ts"].content;
        return this.textEditor.convertPythonToTypeScriptAsync()
            .then(pysrc => {
                if (pysrc == tssrc) {
                    // decompiled python is same current typescript, go back to python without ts->py conversion
                    pxt.debug(`ts -> py shortcut`)
                    this.setFile(pkg.mainEditorPkg().files["main.py"]);
                    return Promise.resolve();
                }
                else return this.convertTypeScriptToPythonAsync();
            });
    }

    private convertTypeScriptToPythonAsync() {
        let p = this.saveTypeScriptAsync(false)
            .then(() => compiler.pyDecompileAsync("main.ts"))
            .then(cres => {
                if (cres && cres.success) {
                    const mainpy = cres.outfiles["main.py"];
                    return this.saveVirtualFileAsync(pxt.PYTHON_PROJECT_NAME, mainpy, true);
                } else {
                    // TODO python
                    return Promise.resolve();
                }
            })
            .catch(e => {
                pxt.reportException(e);
                core.errorNotification(lf("Oops, something went wrong trying to convert your code."));
            })
        if (open)
            p = core.showLoadingAsync("switchtopython", lf("switching to Python..."), p);

        return p;
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

    private showPackageErrorsOnNextTypecheck() {
        this.setState({ suppressPackageWarning: false });
    }

    private maybeShowPackageErrors(force = false) {
        // Only show in blocks or main.ts
        if (this.state.currFile) {
            const fn = this.state.currFile;
            if (!pxt.editor.isBlocks(fn) && fn.name !== "main.ts") return false;
        }

        if (!this.state.suppressPackageWarning || force) {
            this.setState({ suppressPackageWarning: true });
            const badPackages = compiler.getPackagesWithErrors();
            if (badPackages.length) {

                const h = this.state.header;
                const currentVersion = pxt.semver.parse(pxt.appTarget.versions.target);
                const headerVersion = pxt.semver.parse(h.targetVersion);

                let openHandler: () => void;
                if (workspace.isBrowserWorkspace() && currentVersion.major !== headerVersion.major) {
                    openHandler = () => {
                        this.openProjectInLegacyEditor(headerVersion.major);
                    };
                }

                dialogs.showPackageErrorDialogAsync(badPackages, compiler.updatePackagesAsync, openHandler)
                    .then(projectOpen => {
                        if (projectOpen) {
                            this.reloadHeaderAsync()
                        }
                        else if (!force) {
                            this.openHome();
                        }
                    });
                return true;
            }
        }
        return false;
    }

    private autoRunBlocksSimulator = pxtc.Util.debounce(
        () => {
            if (Util.now() - this.lastChangeTime < 1000) return;
            if (!this.state.active)
                return;
            this.runSimulator({ debug: !!this.state.debugging, background: true });
        },
        1000, true);

    private autoRunSimulator = pxtc.Util.debounce(
        () => {
            if (Util.now() - this.lastChangeTime < 1000) return;
            if (!this.state.active)
                return;
            this.runSimulator({ debug: !!this.state.debugging, background: true });
        },
        2000, true);

    _slowTypeCheck = 0;
    private typecheck = pxtc.Util.debounce(
        () => {
            if (this.editor.isIncomplete()) return;
            let start = Util.now();
            let state = this.editor.snapshotState()
            compiler.typecheckAsync()
                .done(resp => {
                    let end = Util.now();
                    // if typecheck is slow (>10s)
                    // and it happened more than 2 times,
                    // it's a slow machine, go into light mode
                    if (!pxt.options.light && end - start > 10000 && this._slowTypeCheck++ > 1) {
                        pxt.tickEvent("light.typecheck")
                        pxt.options.light = true;
                    }
                    this.editor.setDiagnostics(this.editorFile, state);
                    data.invalidate("open-pkg-meta:" + pkg.mainEditorPkg().getPkgId());
                    if (this.state.autoRun) {
                        const output = pkg.mainEditorPkg().outputPkg.files["output.txt"];
                        if (output && !output.numDiagnosticsOverride
                            && this.state.autoRun) {
                            if (this.editor == this.blocksEditor) this.autoRunBlocksSimulator();
                            else this.autoRunSimulator();
                        }
                    }

                    this.maybeShowPackageErrors();
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
            if (this.state.simState != pxt.editor.SimState.Stopped
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
        simulator.init(document.getElementById("boardview"), {
            orphanException: brk => {
                // TODO: start debugging session
                // TODO: user friendly error message
                core.warningNotification(lf("Program Error: {0}", brk.exceptionMessage));
            },
            highlightStatement: (stmt, brk) => {
                if (this.editor) return this.editor.highlightStatement(stmt, brk);
                return false;
            },
            restartSimulator: () => this.restartSimulator(),
            onStateChanged: (state) => {
                switch (state) {
                    case pxsim.SimulatorState.Paused:
                    case pxsim.SimulatorState.Unloaded:
                    case pxsim.SimulatorState.Suspended:
                    case pxsim.SimulatorState.Pending:
                    case pxsim.SimulatorState.Stopped:
                        this.setState({ simState: pxt.editor.SimState.Stopped });
                        break;
                    case pxsim.SimulatorState.Running:
                        this.setState({ simState: pxt.editor.SimState.Running });
                        break;
                }
            },
            editor: this.state.header ? this.state.header.editor : ''
        })
        this.forceUpdate(); // we now have editors prepared
    }

    // Add an error guard for the entire application
    componentDidCatch(error: any, info: any) {
        try {
            core.killLoadingQueue();
            pxsim.U.remove(document.getElementById('loading'));
            this.setState({ hasError: true });
            // Log critical error
            pxt.tickEvent('pxt.criticalerror', { error, info });
            // Reload the page in 2 seconds
            const lastCriticalError = pxt.storage.getLocal("lastcriticalerror") ?
                Date.parse(pxt.storage.getLocal("lastcriticalerror")) : Date.now();
            // don't refresh if we refreshed in the last minute
            if (!lastCriticalError || (!isNaN(lastCriticalError) && Date.now() - lastCriticalError > 60 * 1000)) {
                pxt.storage.setLocal("lastcriticalerror", new Date().toISOString());
                setTimeout(() => {
                    location.reload();
                }, 2000)
            }
        } catch (e) {
        }
    }

    private pickEditorFor(f: pkg.File): srceditor.Editor {
        return this.allEditors.filter(e => e.acceptsFile(f))[0]
    }

    private updateEditorFileAsync(editorOverride: srceditor.Editor = null) {
        if (!this.state.active
            || this.state.updatingEditorFile
            || this.state.currFile == this.editorFile && !editorOverride)
            return undefined;

        let simRunning = false;
        return core.showLoadingAsync("updateeditorfile", lf("loading editor..."), this.setStateAsync({ updatingEditorFile: true })
            .then(() => {
                simRunning = this.state.simState != pxt.editor.SimState.Stopped;
                if (!this.state.currFile.virtual) { // switching to serial should not reset the sim
                    this.stopSimulator();
                    if (simRunning || this.state.autoRun) {
                        simulator.setPending();
                        this.setState({ simState: pxt.editor.SimState.Pending });
                    }
                }
                this.saveSettings();
                // save file before change
                return this.saveFileAsync();
            }).then(() => {
                this.editorFile = this.state.currFile as pkg.File; // TODO
                let previousEditor = this.editor;
                this.prevEditorId = previousEditor.getId();
                this.editor = editorOverride || this.pickEditorFor(this.editorFile)
                this.allEditors.forEach(e => e.setVisible(e == this.editor))
                return previousEditor ? previousEditor.unloadFileAsync() : Promise.resolve();
            })
            .then(() => { return this.editor.loadFileAsync(this.editorFile, this.state.highContrast); })
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
            })
            .finally(() => this.setStateAsync({ updatingEditorFile: false }))
            .then(() => {
                // if auto-run is not enable, restart the sim
                // otherwise, autorun will launch it again
                if (!this.state.currFile.virtual && simRunning && !this.state.autoRun)
                    this.startSimulator();
            }));
    }

    /**
     * Sets the file that is currently being edited. Warning: Do not call
     * setFile() on any `.blocks` file directly. Instead, use openBlocks()
     * which will decompile if necessary.
     * @param fn
     */
    setFile(fn: pkg.File) {
        if (!fn) return;

        if (fn.name === "main.ts") {
            this.shouldTryDecompile = true;
        }

        const header = this.state.header;
        if (header) {
            const pkgId = fn.epkg && fn.epkg.getPkgId();

            if (pkgId === "this") {
                // Update the last-used editor if opening a user file
                if (this.isBlocksFile(fn.name)) {
                    header.editor = pxt.BLOCKS_PROJECT_NAME;
                    header.pubCurrent = false
                }
                else if (this.isTypescriptFile(fn.name)) {
                    header.editor = pxt.JAVASCRIPT_PROJECT_NAME
                    header.pubCurrent = false
                }
                else if (this.isPythonFile(fn.name)) {
                    header.editor = pxt.PYTHON_PROJECT_NAME
                    header.pubCurrent = false
                }
                pkg.mainPkg.setPreferredEditor(header.editor)
            }
        }

        this.setState({
            currFile: fn,
            showBlocks: false,
            embedSimView: false
        })
        //this.fireResize();
    }

    setSideFile(fn: pkg.File) {
        let fileName = fn.name;
        let currFile = this.state.currFile.name;
        if (fileName != currFile && pxt.editor.isBlocks(fn)) {
            // Going from ts -> blocks
            pxt.tickEvent("sidebar.showBlocks");
            this.openBlocks();
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
        return p.setContentAsync(name, content)
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
        if (path) {
            sd.setPath(path, blocksEditor);
        }
        else sd.collapse();
    }

    setTutorialStep(step: number) {
        // save and typecheck
        this.typecheckNow();
        // Notify tutorial content pane
        let tc = this.refs["tutorialcard"] as tutorial.TutorialCard;
        if (!tc) return;
        if (step > -1) {
            tc.setPopout();
            let tutorialOptions = this.state.tutorialOptions;
            tutorialOptions.tutorialStep = step;
            this.setState({ tutorialOptions: tutorialOptions });
            const fullscreen = tutorialOptions.tutorialStepInfo[step].fullscreen;
            if (fullscreen) this.showTutorialHint();
            else this.showLightbox();
            // Hide flyouts and popouts
            this.editor.closeFlyout();
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
                        if (tt.toolboxSubset && Object.keys(tt.toolboxSubset).length > 0) {
                            this.setState({
                                editorState: {
                                    searchBar: false,
                                    filters: { blocks: tt.toolboxSubset, defaultState: pxt.editor.FilterState.Hidden }
                                }
                            });
                            this.editor.filterToolbox(tt.toolboxSubset, tt.showCategories);
                        }
                        let tutorialOptions = this.state.tutorialOptions;
                        tutorialOptions.tutorialReady = true;
                        tutorialOptions.tutorialStepInfo = tt.stepInfo;
                        this.setState({ tutorialOptions: tutorialOptions });
                        const fullscreen = tutorialOptions.tutorialStepInfo[0].fullscreen;
                        if (fullscreen) this.showTutorialHint();
                        else {
                            this.showLightbox();
                        }
                        core.hideLoading("tutorial");
                        break;
                    case 'error':
                        let te = msg as pxsim.TutorialFailedMessage;
                        pxt.reportException(te.message);
                        core.errorNotification(lf("We're having trouble loading this tutorial, please try again later."));
                        this.setState({ tutorialOptions: undefined });
                        // Delete the project created for this tutorial
                        let curr = pkg.mainEditorPkg().header
                        curr.isDeleted = true;
                        curr.tutorial = undefined;
                        workspace.saveAsync(curr, {})
                            .then(() => {
                                this.openHome();
                            }).finally(() => core.hideLoading("tutorial"));
                        break;
                }
                break;
        }
    }

    ///////////////////////////////////////////////////////////
    ////////////           Load header            /////////////
    ///////////////////////////////////////////////////////////

    reloadHeaderAsync() {
        return this.loadHeaderAsync(this.state.header, this.state.editorState)
    }

    tryCheckTargetVersionAsync(targetVersion: string): Promise<void> {
        const htv = targetVersion || "0.0.0";
        // a legacy script does not have a version -- or has a major version less
        // than the current version
        const legacyProject = pxt.semver.majorCmp(htv, pxt.appTarget.versions.target) < 0;
        if (legacyProject)
            pxt.tickEvent(`patch.load.legacy`, { targetVersion: htv })
        // version check, you should not load a script from 1 major version above.
        if (pxt.semver.majorCmp(htv, pxt.appTarget.versions.target) > 0) {
            // the script is a major version ahead, need to redirect
            pxt.tickEvent(`patch.load.future`, { targetVersion: htv })
            const buttons: sui.ModalButton[] = [];
            if (pxt.appTarget && pxt.appTarget.appTheme && pxt.appTarget.appTheme.homeUrl)
                buttons.push({
                    label: lf("Get latest"),
                    icon: "external alternate",
                    url: pxt.appTarget.appTheme.homeUrl
                })
            return core.dialogAsync({
                header: lf("Oops, this project is too new!"),
                body: lf("This project was created in a newer version of this editor. Please try again in that editor."),
                disagreeLbl: lf("Ok"),
                buttons
            })
                // TODO: find a better recovery for this.
                .then(() => this.openHome());
        }
        return undefined;
    }

    loadHeaderAsync(h: pxt.workspace.Header, editorState?: pxt.editor.EditorState): Promise<void> {
        if (!h)
            return Promise.resolve()

        const checkAsync = this.tryCheckTargetVersionAsync(h.targetVersion);
        if (checkAsync)
            return checkAsync.then(() => this.openHome());

        pxt.debug(`loading ${h.id} (pxt v${h.targetVersion})`);
        this.stopSimulator(true);
        if (pxt.appTarget.simulator && pxt.appTarget.simulator.aspectRatio)
            simulator.driver.preload(pxt.appTarget.simulator.aspectRatio);
        this.clearSerial()
        this.firstRun = true
        // always start simulator once at least if autoRun is enabled
        // always disable tracing
        this.setState({ autoRun: this.autoRunOnStart(), tracing: undefined });

        // Merge current and new state but only if the new state members are undefined
        const oldEditorState = this.state.editorState;
        if (oldEditorState && editorState) {
            if (editorState.filters === undefined) editorState.filters = oldEditorState.filters;
            if (editorState.hasCategories === undefined) editorState.hasCategories = oldEditorState.hasCategories;
            if (editorState.searchBar === undefined) editorState.searchBar = oldEditorState.searchBar;
        }

        return (h.backupRef ? workspace.restoreFromBackupAsync(h) : Promise.resolve())
            .then(() => pkg.loadPkgAsync(h.id))
            .then(() => {
                if (!this.state || this.state.header != h) {
                    this.showPackageErrorsOnNextTypecheck();
                }
                simulator.setDirty();
                return compiler.newProjectAsync();
            }).then(() => compiler.applyUpgradesAsync())
            .then(() => {
                let e = this.settings.fileHistory.filter(e => e.id == h.id)[0]
                let main = pkg.getEditorPkg(pkg.mainPkg)
                let file = main.getMainFile();
                if (e)
                    file = main.lookupFile(e.name) || file

                // no history entry, and there is a virtual file for the current file in the language recorded in the header
                if ((!e && file.getVirtualFileName(h.editor)))
                    file = main.lookupFile("this/" + file.getVirtualFileName(h.editor)) || file;

                if (pxt.editor.isBlocks(file) && !file.content) {
                    if (!file.content) // empty blocks file, open javascript editor
                        file = main.lookupFile("this/" + file.getVirtualFileName(pxt.JAVASCRIPT_PROJECT_NAME)) || file
                }
                if (file.name === "main.ts") {
                    this.shouldTryDecompile = true;
                }
                if (pkg.mainPkg.config.preferredEditor)
                    h.editor = pkg.mainPkg.config.preferredEditor
                this.setState({
                    home: false,
                    showFiles: h.githubId ? true : false,
                    editorState: editorState,
                    tutorialOptions: h.tutorial,
                    header: h,
                    projectName: h.name,
                    currFile: file,
                    sideDocsLoadUrl: '',
                    debugging: false
                })

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
                                        .finally(() => core.hideLoading("removedep"));
                                }
                            })
                            core.dialogAsync({
                                hideCancel: true,
                                buttons: [
                                    remove(confl.pkg1), // show later first in dialog
                                    remove(confl.pkg0)
                                ],
                                header: lf("Extensions cannot be used together"),
                                body: lf("Extensions '{0}' and '{1}' cannot be used together, because they use incompatible settings ({2}).",
                                    confl.pkg1.id, confl.pkg0.id, confl.settingName)
                            })
                        }
                    })
                    .done()

                const editorForFile = this.pickEditorFor(file);
                const readme = main.lookupFile("this/README.md");
                // no auto-popup when editing packages locally
                if (!h.githubId && readme && readme.content && readme.content.trim())
                    this.setSideMarkdown(readme.content);
                else if (pkg.mainPkg && pkg.mainPkg.config && pkg.mainPkg.config.documentation)
                    this.setSideDoc(pkg.mainPkg.config.documentation, editorForFile == this.blocksEditor);

                // update recentUse on the header
                return workspace.saveAsync(h)
            }).then(() => this.loadTutorialFiltersAsync())
            .finally(() => {
                // Editor is loaded
                pxt.BrowserUtils.changeHash("#editor", true);
                document.getElementById("root").focus(); // Clear the focus.
                this.editorLoaded();
            })
    }

    private loadTutorialFiltersAsync(): Promise<void> {
        const header = pkg.mainEditorPkg().header;
        if (!header || !header.tutorial || !header.tutorial.tutorialMd) return Promise.resolve();

        const t = header.tutorial;
        return tutorial.getUsedBlocksAsync(t.tutorial, t.tutorialMd)
            .then((usedBlocks) => {
                let editorState: pxt.editor.EditorState = {
                    searchBar: false
                }
                if (usedBlocks && Object.keys(usedBlocks).length > 0) {
                    editorState.filters = {
                        blocks: usedBlocks,
                        defaultState: pxt.editor.FilterState.Hidden
                    }
                }
                this.setState({ editorState: editorState });
                this.editor.filterToolbox(usedBlocks, true);
                const stepInfo = t.tutorialStepInfo;
                const fullscreen = stepInfo[0].fullscreen;
                if (fullscreen) this.showTutorialHint();
                else this.showLightbox();
            })
            .catch(e => {
                // Failed to decompile
                pxt.tickEvent('tutorial.faileddecompile', { tutorialId: t.tutorial });
                core.errorNotification(lf("Oops, an error occured as we were loading the tutorial."));
                // Reset state (delete the current project and exit the tutorial)
                this.exitTutorial(true);
            });
    }

    removeProject() {
        if (!pkg.mainEditorPkg().header) return;

        core.confirmDelete(pkg.mainEditorPkg().header.name, () => {
            let curr = pkg.mainEditorPkg().header
            curr.isDeleted = true
            return workspace.saveAsync(curr, {})
                .then(() => this.openHome());
        })
    }

    ///////////////////////////////////////////////////////////
    ////////////             Import               /////////////
    ///////////////////////////////////////////////////////////

    hexFileImporters: pxt.editor.IHexFileImporter[] = [{
        id: "default",
        canImport: data => data.meta.cloudId == "ks/" + pxt.appTarget.id || data.meta.cloudId == pxt.CLOUD_ID + pxt.appTarget.id // match on targetid
            || (Util.startsWith(data.meta.cloudId, pxt.CLOUD_ID + pxt.appTarget.id)) // trying to load white-label file into main target
        ,
        importAsync: (project, data) => {
            let h: pxt.workspace.InstallHeader = {
                target: pxt.appTarget.id,
                targetVersion: data.meta.targetVersions ? data.meta.targetVersions.target : undefined,
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

    resourceImporters: pxt.editor.IResourceImporter[] = [
        new serial.ResourceImporter()
    ];


    isHexFile(filename: string): boolean {
        return /\.(hex|uf2)$/i.test(filename)
    }

    isBlocksFile(filename: string): boolean {
        return /\.blocks$/i.test(filename)
    }

    isTypescriptFile(filename: string): boolean {
        return /\.ts$/i.test(filename);
    }

    isPythonFile(filename: string): boolean {
        return /\.py$/i.test(filename);
    }

    isProjectFile(filename: string): boolean {
        return /\.(pxt|mkcd|mkcd-\w+)$/i.test(filename)
    }

    isPNGFile(filename: string): boolean {
        return pxt.appTarget.compile.saveAsPNG && /\.png$/i.test(filename);
    }

    isAssetFile(filename: string): boolean {
        let exts = pxt.appTarget.runtime ? pxt.appTarget.runtime.assetExtensions : null
        if (exts) {
            let ext = filename.replace(/.*\./, "").toLowerCase()
            return exts.indexOf(ext) >= 0
        }
        return false
    }

    importProjectCoreAsync(buf: Uint8Array) {
        return (buf[0] == '{'.charCodeAt(0) ?
            Promise.resolve(pxt.U.uint8ArrayToString(buf)) :
            pxt.lzmaDecompressAsync(buf))
            .then(contents => {
                let data = JSON.parse(contents) as pxt.cpp.HexFile;
                this.importHex(data);
            }).catch(e => {
                core.warningNotification(lf("Sorry, we could not import this project."))
                this.openHome();
            });
    }

    importHexFile(file: File) {
        if (!file) return;
        pxt.cpp.unpackSourceFromHexFileAsync(file)
            .then(data => this.importHex(data))
            .catch(e => {
                pxt.reportException(e);
                core.warningNotification(lf("Sorry, we could not recognize this file."))
            });
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

    importProjectFile(file: File) {
        if (!file) return;
        ts.pxtc.Util.fileReadAsBufferAsync(file)
            .then(buf => this.importProjectCoreAsync(buf))
    }

    importPNGFile(file: File) {
        if (!file) return;
        ts.pxtc.Util.fileReadAsBufferAsync(file)
            .then(buf => screenshot.decodeBlobAsync("data:image/png;base64," +
                btoa(pxt.Util.uint8ArrayToString(buf))))
            .then(buf => this.importProjectCoreAsync(buf))
    }

    importAssetFile(file: File) {
        ts.pxtc.Util.fileReadAsBufferAsync(file)
            .then(buf => {
                let basename = file.name.replace(/.*[\/\\]/, "")
                return pkg.mainEditorPkg().saveAssetAsync(basename, buf)
            })
            .done()
    }

    importHex(data: pxt.cpp.HexFile, createNewIfFailed: boolean = false) {
        const targetId = pxt.appTarget.id;
        if (!data || !data.meta) {
            if (data && (data as any)[pxt.CONFIG_NAME]) {
                data = cloudsync.reconstructMeta(data as any)
            } else {
                core.warningNotification(lf("Sorry, we could not recognize this file."))
                if (createNewIfFailed) this.openHome();
                return;
            }
        }

        if (typeof data.source == "object") {
            (data as any).source = JSON.stringify(data.source)
        }

        // intercept newer files early
        if (this.hexFileImporters.some(fi => fi.id == "default" && fi.canImport(data))) {
            const checkAsync = this.tryCheckTargetVersionAsync(data.meta.targetVersions && data.meta.targetVersions.target);
            if (checkAsync) {
                checkAsync.done(() => {
                    if (createNewIfFailed) this.newProject();
                });
                return;
            }
        }

        const importer = this.hexFileImporters.filter(fi => fi.canImport(data))[0];
        if (importer) {
            pxt.tickEvent("import." + importer.id);
            core.hideDialog();
            core.showLoading("importhex", lf("loading project..."))
            pxt.editor.initEditorExtensionsAsync()
                .then(() => importer.importAsync(this, data)
                    .done(() => core.hideLoading("importhex"), e => {
                        pxt.reportException(e, { importer: importer.id });
                        core.hideLoading("importhex");
                        core.errorNotification(lf("Oops, something went wrong when importing your project"));
                        if (createNewIfFailed) this.openHome();
                    }));
        }
        else {
            core.warningNotification(lf("Sorry, we could not import this project."))
            pxt.tickEvent("warning.importfailed");
            if (createNewIfFailed) this.openHome();
        }
    }

    importProjectAsync(project: pxt.workspace.Project, editorState?: pxt.editor.EditorState): Promise<void> {
        let h: pxt.workspace.InstallHeader = project.header;
        if (!h) {
            h = {
                target: pxt.appTarget.id,
                targetVersion: undefined, // unknown version
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
            file => file.size < 1000000 && this.isHexFile(file.name) || this.isBlocksFile(file.name),
            files => {
                if (files) {
                    pxt.tickEvent("dragandrop.open")
                    this.importFile(files[0]);
                }
            }
        );
    }

    importFile(file: File) {
        if (!file || pxt.shell.isReadOnly()) return;
        if (this.isHexFile(file.name)) {
            this.importHexFile(file)
        } else if (this.isBlocksFile(file.name)) {
            this.importBlocksFiles(file)
        } else if (this.isTypescriptFile(file.name)) {
            this.importTypescriptFile(file);
        } else if (this.isProjectFile(file.name)) {
            this.importProjectFile(file);
        } else if (this.isAssetFile(file.name)) {
            // assets need to go before PNG source import below, since target might want PNG assets
            this.importAssetFile(file)
        } else if (this.isPNGFile(file.name)) {
            this.importPNGFile(file);
        } else {
            const importer = this.resourceImporters.filter(fi => fi.canImport(file))[0];
            if (importer) {
                importer.importAsync(this, file).done();
            } else {
                core.warningNotification(lf("Oops, don't know how to load this file!"));
            }
        }
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

    ///////////////////////////////////////////////////////////
    ////////////           Export                 /////////////
    ///////////////////////////////////////////////////////////

    syncPreferredEditor() {
        pkg.mainPkg.setPreferredEditor(this.getPreferredEditor())
    }

    exportProjectToFileAsync(): Promise<Uint8Array> {
        this.syncPreferredEditor()
        const mpkg = pkg.mainPkg;
        return mpkg.compressToFileAsync()
    }

    exportAsync(): Promise<string> {
        pxt.debug("exporting project");
        return this.exportProjectToFileAsync()
            .then((buf) => {
                return ts.pxtc.encodeBase64(Util.uint8ArrayToString(buf));
            });
    }

    downloadScreenshotAsync(): Promise<void> {
        if (pxt.appTarget.compile.saveAsPNG)
            return this.saveProjectAsPNGAsync(false);
        else
            return this.requestScreenshotAsync()
                .then(img => pxt.BrowserUtils.browserDownloadDataUri(img, pkg.genFileName(".png")))
    }

    pushScreenshotHandler(handler: (msg: pxt.editor.ScreenshotData) => void): void {
        this.screenshotHandlers.push(handler);
    }
    popScreenshotHandler(): void {
        this.screenshotHandlers.pop();
    }

    requestScreenshotPromise: Promise<string>;
    requestScreenshotAsync(): Promise<string> {
        if (this.requestScreenshotPromise)
            return this.requestScreenshotPromise;

        // make sure simulator is ready
        this.setState({ screenshoting: true });
        simulator.driver.postMessage({ type: "screenshot" } as pxsim.SimulatorScreenshotMessage);
        return this.requestScreenshotPromise = new Promise<string>((resolve, reject) => {
            this.pushScreenshotHandler(msg => resolve(pxt.BrowserUtils.imageDataToPNG(msg.data)));
        }).timeout(1000) // simulator might be stopped or in bad shape
            .catch(e => {
                pxt.tickEvent('screenshot.timeout');
                return undefined;
            })
            .finally(() => {
                this.popScreenshotHandler();
                this.requestScreenshotPromise = undefined;
                this.setState({ screenshoting: false });
            });
    }

    private encodeProjectAsPNGAsync(sc: string, showDialog: boolean): Promise<void> {
        return this.exportProjectToFileAsync()
            .then(blob => screenshot.encodeBlobAsync(this.state.header.name, sc, blob))
            .then(img => {
                const fn = pkg.genFileName(".png");
                pxt.BrowserUtils.browserDownloadDataUri(img, fn);
                if (!showDialog) return Promise.resolve();
                return core.dialogAsync({
                    header: lf("Project Saved!"),
                    disagreeLbl: lf("Got it!"),
                    disagreeClass: "green",
                    hasCloseIcon: false,
                    jsx: <div className="ui items">
                        <div className="item">
                            <div className="ui small image">
                                <a download={fn} className="ui link" href={img}>
                                    <img src={img} alt={lf("Project cartridge")} title={lf("Click to download again")} />
                                </a>
                            </div>
                            <div className="content">
                                <div className="description">
                                    <p>
                                        {lf("Your project is saved in this image.")}
                                        {lf("Import or drag it into the editor to reload it.")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                });
            });
    }

    private saveProjectAsPNGAsync(showDialog: boolean): Promise<void> {
        return this.requestScreenshotAsync()
            .then(img => this.encodeProjectAsPNGAsync(img, showDialog));
    }

    saveProjectToFileAsync(): Promise<void> {
        const mpkg = pkg.mainPkg;
        if (saveAsBlocks()) {
            pxt.BrowserUtils.browserDownloadText(mpkg.readFile("main.blocks"), pkg.genFileName(".blocks"), 'application/xml');
            return Promise.resolve();;
        }
        if (pxt.commands.saveProjectAsync) {
            core.infoNotification(lf("Saving..."))
            this.syncPreferredEditor()
            return mpkg.saveToJsonAsync()
                .then(project => pxt.commands.saveProjectAsync(project));
        }
        if (pxt.appTarget.compile.saveAsPNG) return this.saveProjectAsPNGAsync(true);
        else return this.exportProjectToFileAsync()
            .then((buf: Uint8Array) => {
                const fn = pkg.genFileName(".mkcd");
                pxt.BrowserUtils.browserDownloadUInt8Array(buf, fn, 'application/octet-stream');
            })
    }

    async commitAsync() {
        try {
            let repo = this.state.header.githubId
            let info = await dialogs.showCommitDialogAsync(repo)
            if (!info)
                return

            let commitId = await workspace.commitAsync(this.state.header, info.msg)
            if (commitId) {
                // merge failure; do a PR
                // we could ask the user, but it's unlikely they can do anything else to fix it
                let prURL = await workspace.prAsync(this.state.header, commitId, info.msg)
                await dialogs.showPRDialogAsync(repo, prURL)
                // when the dialog finishes, we pull again - it's possible the user
                // has resolved the conflict in the meantime
                await workspace.pullAsync(this.state.header)
                // skip bump in this case - we don't know if it was merged
            } else {
                if (info.bump)
                    await workspace.bumpAsync(this.state.header)
            }
            await this.reloadHeaderAsync()
        } finally {
            core.hideLoading("loadingheader")
        }
    }

    async pushPullAsync() {
        core.showLoading("loadingheader", lf("syncing with github..."));
        let needsHide = true
        try {
            let status = await workspace.pullAsync(this.state.header)
                .catch(core.handleNetworkError)

            switch (status) {
                case workspace.PullStatus.NoSourceControl:
                case workspace.PullStatus.UpToDate:
                    break

                case workspace.PullStatus.NeedsCommit:
                    needsHide = false
                    await this.commitAsync()
                    break

                case workspace.PullStatus.GotChanges:
                    await this.reloadHeaderAsync()
                    break
            }
        } finally {
            if (needsHide)
                core.hideLoading("loadingheader")
        }
    }

    ///////////////////////////////////////////////////////////
    ////////////             Home                 /////////////
    ///////////////////////////////////////////////////////////

    openHome() {
        const hasHome = !pxt.shell.isControllerMode();
        if (!hasHome) return;

        this.stopSimulator(true); // don't keep simulator around
        if (this.editor) this.editor.unloadFileAsync();
        // clear the hash
        pxt.BrowserUtils.changeHash("", true);
        this.setState({
            home: true,
            tracing: undefined,
            fullscreen: undefined,
            tutorialOptions: undefined,
            editorState: undefined,
            debugging: undefined
        });
        this.allEditors.forEach(e => e.setVisible(false));
        this.homeLoaded();
        this.showPackageErrorsOnNextTypecheck();
        workspace.syncAsync().done();
    }

    private homeLoaded() {
        pxt.tickEvent('app.home');
    }

    private editorLoaded() {
        pxt.tickEvent('app.editor');
    }

    reloadEditor() {
        if (this.state.home) location.hash = `#reload`;
        location.reload();
    }

    getPreferredEditor(): string {
        if (this.editor == this.blocksEditor)
            return pxt.BLOCKS_PROJECT_NAME

        if (this.editor == this.textEditor)
            switch (this.textEditor.fileType) {
                case pxt.editor.FileType.Python:
                    return pxt.PYTHON_PROJECT_NAME;
                default:
                    return pxt.JAVASCRIPT_PROJECT_NAME;
            }
        else
            return pxt.JAVASCRIPT_PROJECT_NAME;
    }

    ///////////////////////////////////////////////////////////
    ////////////           Extentions             /////////////
    ///////////////////////////////////////////////////////////

    openExtension(extension: string, url: string, consentRequired?: boolean) {
        pxt.tickEvent("app.openextension", { extension: extension });
        this.extensions.showExtension(extension, url, consentRequired);
    }

    handleExtensionRequest(request: pxt.editor.ExtensionRequest): void {
        this.extensions.handleExtensionRequest(request);
    }

    ///////////////////////////////////////////////////////////
    ////////////           Workspace              /////////////
    ///////////////////////////////////////////////////////////

    newEmptyProject(name?: string, documentation?: string) {
        this.newProject({
            filesOverride: { "main.blocks": `<xml xmlns="http://www.w3.org/1999/xhtml"></xml>` },
            name,
            documentation
        })
    }

    newProject(options: ProjectCreationOptions = {}) {
        pxt.tickEvent("app.newproject");
        core.showLoading("newproject", lf("creating new project..."));
        this.createProjectAsync(options)
            .then(() => this.autoChooseBoardAsync())
            .then(() => Promise.delay(500))
            .finally(() => core.hideLoading("newproject"));
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
        if (options.dependencies)
            Util.jsonMergeFrom(cfg.dependencies, options.dependencies)
        if (options.tsOnly) {
            cfg.files = cfg.files.filter(f => f != "main.blocks")
            delete files["main.blocks"]
        }
        files["pxt.json"] = JSON.stringify(cfg, null, 4) + "\n";
        return workspace.installAsync({
            name: cfg.name,
            meta: {},
            editor: options.prj.id,
            pubId: "",
            pubCurrent: false,
            target: pxt.appTarget.id,
            targetVersion: pxt.appTarget.versions.target,
            temporary: options.temporary,
            tutorial: options.tutorial
        }, files)
            .then(hd => this.loadHeaderAsync(hd, { filters: options.filters }));
    }

    // in multiboard targets, allow use to pick a different board
    // after the project is loaded
    // this could be done prior to the project creation too
    private autoChooseBoardAsync(features?: string[]): Promise<void> {
        if (pxt.appTarget.appTheme.chooseBoardOnNewProject
            && pxt.appTarget.simulator
            && !!pxt.appTarget.simulator.dynamicBoardDefinition)
            return this.showBoardDialogAsync(features, false);
        return Promise.resolve();
    }

    importExampleAsync(options: pxt.editor.ExampleImportOptions): Promise<void> {
        const { name, path, loadBlocks, prj } = options;
        core.showLoading("changingcode", lf("loading..."));
        let features: string[];
        return pxt.gallery.loadExampleAsync(name.toLowerCase(), path)
            .then(example => {
                if (!example) return Promise.resolve();
                const opts: pxt.editor.ProjectCreationOptions = example;
                if (prj) opts.prj = prj;
                features = example.features;
                if (loadBlocks) {
                    return this.createProjectAsync(opts)
                        .then(() => {
                            return compiler.getBlocksAsync()
                                .then(blocksInfo => compiler.decompileAsync("main.ts", blocksInfo))
                                .then(resp => {
                                    pxt.debug(`example decompilation: ${resp.success}`)
                                    if (resp.success) {
                                        this.overrideBlocksFile(resp.outfiles["main.blocks"])
                                    }
                                })
                        });
                } else {
                    opts.tsOnly = true
                    return this.createProjectAsync(opts)
                        .then(() => Promise.delay(500));
                }
            })
            .then(() => this.autoChooseBoardAsync(features))
            .finally(() => core.hideLoading("changingcode"))
    }

    switchTypeScript() {
        const mainPkg = pkg.mainEditorPkg();
        const tsName = this.editorFile.getVirtualFileName(pxt.JAVASCRIPT_PROJECT_NAME);
        const f = mainPkg.files[tsName];
        this.setFile(f);
    }

    saveBlocksToTypeScriptAsync(): Promise<string> {
        return this.blocksEditor.saveToTypeScriptAsync();
    }

    private saveVirtualFileAsync(prj: string, src: string, open: boolean): Promise<void> {
        // language service does not like empty file
        src = src || "\n";
        const mainPkg = pkg.mainEditorPkg();
        const fileName = this.editorFile.getVirtualFileName(prj);
        Util.assert(fileName != this.editorFile.name);
        return mainPkg.setContentAsync(fileName, src).then(() => {
            if (open) {
                let f = mainPkg.files[fileName];
                this.setFile(f);
            }
        });
    }

    saveTypeScriptAsync(open = false): Promise<void> {
        if (!this.editor || !this.state.currFile || this.editorFile.epkg != pkg.mainEditorPkg() || this.reload)
            return Promise.resolve();

        let promise = open ? this.textEditor.loadMonacoAsync() : Promise.resolve();
        promise = promise
            .then(() => this.editor.saveToTypeScriptAsync())
            .then((src) => {
                if (src === undefined && open) { // failed to convert
                    return core.confirmAsync({
                        header: lf("Oops, there is a problem converting your code."),
                        body: lf("We are unable to convert your code back to JavaScript."),
                        agreeLbl: lf("Done"),
                        agreeClass: "cancel",
                        agreeIcon: "cancel",
                    }).then(b => { })
                }
                if (src === undefined
                    || this.editorFile.name == this.editorFile.getVirtualFileName(pxt.JAVASCRIPT_PROJECT_NAME))
                    return Promise.resolve();
                return this.saveVirtualFileAsync(pxt.JAVASCRIPT_PROJECT_NAME, src, open);
            });

        if (open) {
            return core.showLoadingAsync("switchtojs", lf("switching to JavaScript..."), promise, 0);
        } else {
            return promise;
        }
    }

    resetWorkspace() {
        this.reload = true;
        window.location.hash = "#reload";
        return workspace.resetAsync()
            .done(
                () => this.reloadEditor(),
                () => this.reloadEditor()
            );
    }

    pair() {
        const prePairAsync = pxt.commands.webUsbPairDialogAsync
            ? pxt.commands.webUsbPairDialogAsync(core.confirmAsync)
            : Promise.resolve(1);
        return prePairAsync.then((res) => {
            if (res) {
                return pxt.usb.pairAsync()
                    .then(() => {
                        core.infoNotification(lf("Device paired! Try downloading now."))
                    }, (err: Error) => {
                        core.errorNotification(lf("Failed to pair the device: {0}", err.message))
                    });
            }
            return Promise.resolve();
        });
    }

    ///////////////////////////////////////////////////////////
    ////////////             Compile              /////////////
    ///////////////////////////////////////////////////////////

    saveAndCompile() {
        if (!this.state.header) return undefined;
        this.setState({ isSaving: true });

        return (this.state.projectName !== lf("Untitled")
            ? Promise.resolve(true) : this.showRenameProjectDialogAsync())
            .then((success) => {
                if (!success) {
                    // User cancelled
                    this.setState({ isSaving: false });
                    return Promise.resolve();
                }
                return this.saveProjectNameAsync()
                    .then(() => this.saveFileAsync())
                    .then(() => {
                        if (!pxt.appTarget.compile.hasHex || pxt.appTarget.compile.useMkcd || pxt.appTarget.compile.saveAsPNG || saveAsBlocks()) {
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
            });
    }

    private checkWebUSBVariant = true
    checkForHwVariant() {
        if (pxt.hwVariant || !pxt.hasHwVariants())
            return false // already set
        const variants = pxt.getHwVariants()
        if (variants.length == 0)
            return false
        let pairAsync = () => webusb.showWebUSBPairingInstructionsAsync(null)
            .then(() => {
                this.checkForHwVariant()
            }, err => {
                this.checkWebUSBVariant = false
                this.checkForHwVariant()
            })
        if (pxt.usb.isEnabled && this.checkWebUSBVariant) {
            hidbridge.initAsync(true)
                .then(wr => {
                    if (wr.familyID) {
                        for (let v of variants) {
                            let compile = pxt.U.clone(pxt.appTarget.compile)
                            if (v.compileServiceVariant) {
                                let c2 = pxt.appTarget.variants[v.compileServiceVariant]
                                if (c2.compile)
                                    pxt.U.jsonCopyFrom(compile, c2.compile)
                            }
                            if (parseInt(compile.uf2Family) === wr.familyID) {
                                pxt.setHwVariant(v.name)
                                this.reloadHeaderAsync()
                                    .then(() => this.compile())
                                return
                            }
                        }
                    }
                    this.checkWebUSBVariant = false
                    this.checkForHwVariant()
                }, pairAsync)
            return true
        }
        this.showChooseHwDialog()
        return true
    }

    beforeCompile() { }

    compile(saveOnly = false) {
        pxt.tickEvent("compile");
        pxt.debug('compiling...');

        if (this.checkForHwVariant())
            return;

        if (pxt.appTarget.compile.saveAsPNG && pxt.hasHwVariants() && !pxt.hwVariant) {
            this.saveAndCompile();
            return;
        }

        this.beforeCompile();
        let userContextWindow: Window = undefined;
        if (!pxt.appTarget.compile.useModulator && pxt.BrowserUtils.isBrowserDownloadInSameWindow() && !pxt.BrowserUtils.isBrowserDownloadWithinUserContext())
            userContextWindow = window.open("");

        if (this.state.compiling) {
            pxt.tickEvent("compile.double");
            return;
        }

        const simRestart = this.state.simState != pxt.editor.SimState.Stopped;
        this.setState({ compiling: true });
        this.clearSerial();
        this.editor.beforeCompile();
        if (simRestart) this.stopSimulator();
        let state = this.editor.snapshotState()
        this.syncPreferredEditor()
        compiler.compileAsync({ native: true, forceEmit: true })
            .then<pxtc.CompileResult>(resp => {
                this.editor.setDiagnostics(this.editorFile, state)

                let fn = pxt.outputName()
                if (!resp.outfiles[fn]) {
                    pxt.tickEvent("compile.noemit")
                    core.warningNotification(lf("Compilation failed, please check your code for errors."));
                    return Promise.resolve(null)
                }
                resp.saveOnly = saveOnly
                resp.userContextWindow = userContextWindow;
                resp.downloadFileBaseName = pkg.genFileName("");
                resp.confirmAsync = core.confirmAsync;
                let h = this.state.header
                if (h)
                    resp.headerId = h.id
                if (pxt.commands.patchCompileResultAsync)
                    return pxt.commands.patchCompileResultAsync(resp).then(() => resp)
                else
                    return resp
            }).then(resp => {
                if (!resp) return Promise.resolve();
                if (saveOnly) {
                    return pxt.commands.saveOnlyAsync(resp);
                }
                if (!resp.success) {
                    if (!this.maybeShowPackageErrors(true)) {
                        core.confirmAsync({
                            header: lf("Compilation failed"),
                            body: lf("Ooops, looks like there are errors in your program."),
                            hideAgree: true,
                            disagreeLbl: lf("Close")
                        });
                    }
                }
                return pxt.commands.deployCoreAsync(resp, {
                    reportDeviceNotFoundAsync: (docPath, compileResult) => this.showDeviceNotFoundDialogAsync(docPath, compileResult),
                    reportError: (e) => core.errorNotification(e),
                    showNotification: (msg) => core.infoNotification(msg)
                })
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

    showDeviceNotFoundDialogAsync(docPath: string, resp?: pxtc.CompileResult): Promise<void> {
        pxt.tickEvent(`compile.devicenotfound`);
        const ext = pxt.outputName().replace(/[^.]*/, "");
        const fn = pkg.genFileName(ext);
        return core.dialogAsync({
            header: lf("Oops, we couldn't find your {0}", pxt.appTarget.appTheme.boardName),
            body: lf("Please make sure your {0} is connected and try again.", pxt.appTarget.appTheme.boardName),
            buttons: [
                {
                    label: lf("Troubleshoot"),
                    className: "focused",
                    icon: "help",
                    url: docPath,
                    onclick: () => {
                        pxt.tickEvent(`compile.devicenotfound.troubleshoot`);
                    }
                },
                resp ? {
                    label: fn,
                    icon: "download",
                    className: "lightgrey",
                    onclick: () => {
                        pxt.tickEvent(`compile.devicenotfound.download`);
                        return pxt.commands.saveOnlyAsync(resp);
                    }
                } : undefined
            ],
            hideCancel: true,
            hasCloseIcon: true
        });
    }

    overrideTypescriptFile(text: string) {
        if (this.textEditor) this.textEditor.overrideFile(text);
    }

    overrideBlocksFile(text: string) {
        if (this.blocksEditor) this.blocksEditor.overrideFile(text);
    }

    ///////////////////////////////////////////////////////////
    ////////////             Simulator            /////////////
    ///////////////////////////////////////////////////////////

    startStopSimulator(opts?: pxt.editor.SimulatorStartOptions) {
        switch (this.state.simState) {
            case pxt.editor.SimState.Starting:
            case pxt.editor.SimState.Pending:
                // button smashing, do nothing
                break;
            case pxt.editor.SimState.Running:
                this.stopSimulator(false, opts);
                break;
            default:
                this.maybeShowPackageErrors(true);
                this.startSimulator(opts);
                break;
        }
    }

    toggleTrace(intervalSpeed?: number) {
        const tracing = !!this.state.tracing;
        const debugging = !!this.state.debugging;
        if (tracing) {
            this.editor.clearHighlightedStatements();
            simulator.setTraceInterval(0);
        } else {
            simulator.setTraceInterval(intervalSpeed || simulator.SLOW_TRACE_INTERVAL);
        }
        this.setState({ tracing: !tracing, debugging: debugging && !tracing },
            () => this.restartSimulator())
    }

    setTrace(enabled: boolean, intervalSpeed?: number) {
        if (!!this.state.tracing != enabled) {
            this.toggleTrace(intervalSpeed);
        }
        else if (this.state.tracing) {
            simulator.setTraceInterval(intervalSpeed || simulator.SLOW_TRACE_INTERVAL);
            this.startSimulator();
        }
    }

    proxySimulatorMessage(content: string) {
        simulator.proxy({
            type: "custom",
            content: content
        } as pxsim.SimulatorCustomMessage);
    }

    toggleSimulatorCollapse() {
        const state = this.state;
        if (state.simState == pxt.editor.SimState.Stopped && state.collapseEditorTools)
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
        const charCode = core.keyCodeFromEvent(e);
        if (charCode !== core.ESC_KEY) return
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
        const running = this.state.simState != pxt.editor.SimState.Stopped;
        if (running) this.stopSimulator();
        make.makeAsync()
            .finally(() => {
                if (running) this.startSimulator()
            })
    }

    printCode() {
        const p = pkg.mainEditorPkg();
        const files = p.getAllFiles();
        // render in sidedocs
        const docsUrl = pxt.webConfig.docsUrl || '/--docs';
        const mode = theEditor.isBlocksActive() ? "blocks" : "typescript";
        window.localStorage["printjob"] = JSON.stringify(files);
        const url = `${docsUrl}#print:job:${mode}:${pxt.Util.localeInfo()}`;

        core.dialogAsync({
            header: lf("Print Code"),
            hasCloseIcon: true,
            hideCancel: true,
            size: "large",
            jsx:
                /* tslint:disable:react-iframe-missing-sandbox */
                <div className="ui container">
                    <div id="printcontainer" style={{ 'position': 'relative', 'height': 0, 'paddingBottom': '40%', 'overflow': 'hidden' }}>
                        <iframe frameBorder="0"
                            sandbox="allow-popups allow-forms allow-scripts allow-same-origin allow-modals"
                            style={{ 'position': 'absolute', 'top': 0, 'left': 0, 'width': '100%', 'height': '100%' }}
                            src={url} />
                    </div>
                </div>
            /* tslint:enable:react-iframe-missing-sandbox */
        }).done(r => {
        })
    }

    clearSerial() {
        this.serialEditor.clear()
        const simIndicator = this.refs["simIndicator"] as serialindicator.SerialIndicator
        const devIndicator = this.refs["devIndicator"] as serialindicator.SerialIndicator
        if (simIndicator) simIndicator.clear()
        if (devIndicator) devIndicator.clear()
    }

    shouldStartSimulator(): boolean {
        switch (this.state.simState) {
            case pxt.editor.SimState.Starting:
            case pxt.editor.SimState.Running:
                return false; // already reunning
        }
        const hasHome = !pxt.shell.isControllerMode();
        if (!hasHome) return true;
        return !this.state.home;
    }

    isSimulatorRunning(): boolean {
        return this.state.simState == pxt.editor.SimState.Running;
    }

    restartSimulator() {
        const isDebug = this.state.tracing || this.state.debugging;
        if (this.state.simState == pxt.editor.SimState.Stopped
            || simulator.driver.isDebug() != !!isDebug)
            this.startSimulator();
        else {
            simulator.driver.restart(); // fast restart
        }
        // TODO: typescript breakpoints
        if (isDebug)
            this.blocksEditor.setBreakpointsFromBlocks();
        else
            this.blocksEditor.clearBreakpoints();
    }

    startSimulator(opts?: pxt.editor.SimulatorStartOptions) {
        pxt.tickEvent('simulator.start');
        const isDebug = this.state.debugging || this.state.tracing;
        const isDebugMatch = simulator.driver.isDebug() == isDebug;
        const clickTrigger = opts && opts.clickTrigger;
        pxt.debug(`start sim (autorun ${this.state.autoRun})`)
        if (!this.shouldStartSimulator() && isDebugMatch) {
            pxt.log("Ignoring call to start simulator, either already running or we shouldn't start.");
            return Promise.resolve();
        }
        return this.saveFileAsync()
            .then(() => this.runSimulator({ debug: isDebug, clickTrigger }))
    }

    stopSimulator(unload?: boolean, opts?: pxt.editor.SimulatorStartOptions) {
        pxt.tickEvent('simulator.stop')
        const clickTrigger = opts && opts.clickTrigger;
        pxt.debug(`stop sim (autorun ${this.state.autoRun})`)
        if (this.runToken) {
            this.runToken.cancel()
            this.runToken = null
        }
        simulator.stop(unload);
        const autoRun = this.state.autoRun && !clickTrigger; // if user pressed stop, don't restart
        this.setState({ simState: pxt.editor.SimState.Stopped, autoRun: autoRun });
    }

    suspendSimulator() {
        pxt.tickEvent('simulator.suspend')
        if (this.runToken) {
            this.runToken.cancel()
            this.runToken = null
        }
        simulator.suspend()
    }

    runSimulator(opts: compiler.CompileOptions = {}): Promise<void> {
        const emptyRun = this.firstRun && opts.background && pxt.appTarget.simulator && !!pxt.appTarget.simulator.emptyRunCode
        this.firstRun = false

        pxt.debug(`run sim (autorun ${this.state.autoRun})`)

        if (this.runToken) this.runToken.cancel()
        let cancellationToken = new pxt.Util.CancellationToken();
        this.runToken = cancellationToken;
        cancellationToken.startOperation();
        return (() => {
            const editorId = this.editor ? this.editor.getId().replace(/Editor$/, '') : "unknown";
            if (opts.background) {
                pxt.tickActivity("autorun", "autorun." + editorId);
                if (localStorage.getItem("noAutoRun"))
                    return Promise.resolve()
            } else pxt.tickEvent(opts.debug ? "debug" : "run", { editor: editorId });

            if (!opts.background)
                this.editor.beforeCompile();
            if (this.state.tracing)
                opts.trace = true;

            this.syncPreferredEditor()

            simulator.stop(false, true);
            const simAutoRun = pxt.appTarget.simulator && (pxt.options.light
                ? !!pxt.appTarget.simulator.autoRunLight
                : !!pxt.appTarget.simulator.autoRun);
            const autoRun = (this.state.autoRun || !!opts.clickTrigger) && simAutoRun;
            this.setState({ simState: pxt.editor.SimState.Starting, autoRun: autoRun });

            const state = this.editor.snapshotState()
            return (emptyRun ? Promise.resolve(compiler.emptyCompileResult()) : compiler.compileAsync(opts))
                .then(resp => {
                    if (cancellationToken.isCancelled()) return;
                    this.clearSerial();
                    this.editor.setDiagnostics(this.editorFile, state)

                    if (resp.outfiles[pxtc.BINARY_JS]) {
                        if (!cancellationToken.isCancelled()) {
                            simulator.run(pkg.mainPkg, opts.debug, resp, this.state.mute, this.state.highContrast, pxt.options.light, opts.clickTrigger)
                            this.blocksEditor.setBreakpointsMap(resp.breakpoints);
                            this.blocksEditor.setBreakpointsFromBlocks();
                            if (!cancellationToken.isCancelled()) {
                                // running state is set by the simulator once the iframe is loaded
                                this.setState({ showParts: simulator.driver.runOptions.parts.length > 0 })
                            } else {
                                simulator.stop();
                                this.setState({ simState: pxt.editor.SimState.Stopped });
                            }
                        }
                    } else if (!opts.background) {
                        core.warningNotification(lf("Oops, we could not run this project. Please check your code for errors."))
                    }
                })
                .finally(() => {
                    if (!cancellationToken.isCancelled()) cancellationToken.resolveCancel()
                    cancellationToken = null;
                });
        })();
    }

    ///////////////////////////////////////////////////////////
    ////////////             Debugging            /////////////
    ///////////////////////////////////////////////////////////

    simDebug() {
        pxt.tickEvent("menu.debug.sim")
        this.stopSimulator();
        this.runSimulator({ debug: true });
    }

    hwDebug() {
        pxt.tickEvent("menu.debug.hw")
        let start = Promise.resolve()
        if (this.state.simState != pxt.editor.SimState.Running || !simulator.driver.runOptions.debug)
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

    toggleDebugging() {
        const state = !this.state.debugging;
        pxt.log("turning debugging mode to " + state);
        this.setState({ debugging: state, tracing: false }, () => {
            this.renderCore()
            if (this.editor) {
                this.editor.updateBreakpoints();
                this.editor.updateToolbox();
            }
            this.restartSimulator();
        });
    }

    dbgPauseResume() {
        simulator.dbgPauseResume();
    }

    dbgStepOver() {
        simulator.dbgStepOver();
    }

    dbgStepInto() {
        simulator.dbgStepInto();
    }

    dbgInsertBreakpoint() {
        this.editor.insertBreakpoint();
    }

    editText() {
        if (this.editor != this.textEditor) {
            this.updateEditorFileAsync(this.textEditor).then(() => {
                this.textEditor.editor.focus();
            });
            this.forceUpdate();
        }
    }

    showScriptManager() {
        this.scriptManagerDialog.show();
    }

    importProjectDialog() {
        this.importDialog.show();
    }

    renderBlocksAsync(req: pxt.editor.EditorMessageRenderBlocksRequest): Promise<any> {
        return compiler.getBlocksAsync()
            .then(blocksInfo => compiler.decompileSnippetAsync(req.ts, blocksInfo))
            .then(resp => {
                const svg = pxt.blocks.render(resp, {
                    snippetMode: true,
                    layout: pxt.blocks.BlockLayout.Align,
                    splitSvg: false
                }) as SVGSVGElement;
                // TODO: what if svg is undefined? handle that scenario
                const viewBox = svg.getAttribute("viewBox").split(/\s+/).map(d => parseInt(d));
                return {
                    svg: svg,
                    xml: pxt.blocks.layout.blocklyToSvgAsync(svg, viewBox[0], viewBox[1], viewBox[2], viewBox[3])
                }
            });
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

    anonymousPublishAsync(screenshotUri?: string): Promise<string> {
        pxt.tickEvent("publish");
        this.setState({ publishing: true })
        const mpkg = pkg.mainPkg
        const epkg = pkg.getEditorPkg(mpkg)
        return this.saveProjectNameAsync()
            .then(() => this.saveFileAsync())
            .then(() => mpkg.filesToBePublishedAsync(true))
            .then(files => {
                if (epkg.header.pubCurrent && !screenshotUri)
                    return Promise.resolve(epkg.header.pubId)
                const meta: workspace.ScriptMeta = {
                    description: mpkg.config.description,
                };
                const blocksSize = this.blocksEditor.contentSize();
                if (blocksSize) {
                    meta.blocksHeight = blocksSize.height;
                    meta.blocksWidth = blocksSize.width;
                }
                return workspace.anonymousPublishAsync(epkg.header, files, meta, screenshotUri)
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

    loadBlocklyAsync(): Promise<void> {
        return this.blocksEditor.loadBlocklyAsync();
    }

    ///////////////////////////////////////////////////////////
    ////////////             Dialogs              /////////////
    ///////////////////////////////////////////////////////////

    showReportAbuse() {
        const pubId = (this.state.tutorialOptions && this.state.tutorialOptions.tutorialReportId)
            || (this.state.header && this.state.header.pubCurrent && this.state.header.pubId);
        dialogs.showReportAbuseAsync(pubId);
    }

    showAboutDialog() {
        dialogs.showAboutDialogAsync(this);
    }

    showShareDialog() {
        const header = this.state.header;
        if (header)
            this.shareEditor.show(header);
    }

    showLanguagePicker() {
        this.languagePicker.show();
    }

    showImportUrlDialog() {
        dialogs.showImportUrlDialogAsync()
            .then((id) => {
                if (id) {
                    if (pxt.github.isGithubId(id))
                        importGithubProject(id);
                    else
                        loadHeaderBySharedId(id);
                }
            }, (e) => {
                core.errorNotification(lf("Sorry, the project url looks invalid."));
            })
            .done();
    }

    showImportGithubDialog() {
        dialogs.showImportGithubDialogAsync().done(url => {
            if (url === "NEW") {
                dialogs.showCreateGithubRepoDialogAsync()
                    .then(url => {
                        if (url)
                            importGithubProject(url)
                    })
            } else if (!pxt.github.isGithubId(url)) {
                core.errorNotification(lf("Sorry, the project url looks invalid."));
            } else {
                importGithubProject(url);
            }
        });
    }

    showImportFileDialog() {
        dialogs.showImportFileDialogAsync().done(res => {
            if (res) {
                pxt.tickEvent("app.open.file");
                this.importFile(res);
            }
        });
    }

    showResetDialog() {
        dialogs.showResetDialogAsync().done(r => {
            if (!r) return Promise.resolve();
            return Promise.resolve()
                .then(() => {
                    return pxt.winrt.releaseAllDevicesAsync();
                })
                .then(() => {
                    return this.resetWorkspace();
                });
        });
    }

    showExitAndSaveDialog() {
        this.setState({ debugging: false })
        if (this.state.projectName !== lf("Untitled")) {
            this.openHome();
        }
        else {
            this.exitAndSaveDialog.show();
        }
    }

    showPackageDialog() {
        this.scriptSearch.showExtensions();
    }

    showBoardDialogAsync(features?: string[], closeIcon?: boolean): Promise<void> {
        return this.scriptSearch.showBoardsAsync(features, closeIcon);
    }

    showModalDialogAsync(options: pxt.editor.ModalDialogOptions) {
        return core.dialogAsync({
            header: options.header,
            body: options.body,
            hideCancel: true,
            hasCloseIcon: true,
            buttons: options.buttons
        })
    }

    showExperimentsDialog() {
        this.scriptSearch.showExperiments();
    }

    showChooseHwDialog() {
        if (this.chooseHwDialog)
            this.chooseHwDialog.show()
    }

    showRenameProjectDialogAsync(): Promise<boolean> {
        if (!this.state.header) return Promise.resolve(false);

        const opts: core.PromptOptions = {
            header: lf("Rename your project"),
            agreeLbl: lf("Save"),
            agreeClass: "green",
            placeholder: lf("Enter your project name here")
        };
        return core.promptAsync(opts).then(res => {
            if (res === null) return Promise.resolve(false); // null means cancelled, empty string means ok (but no value entered)

            return new Promise<void>((resolve, reject) => {
                this.setState({ projectName: res }, () => resolve());
            }).then(() => this.saveProjectNameAsync())
                .then(() => true);
        });
    }

    ///////////////////////////////////////////////////////////
    ////////////             Tutorials            /////////////
    ///////////////////////////////////////////////////////////

    startTutorial(tutorialId: string, tutorialTitle?: string) {
        pxt.tickEvent("tutorial.start");
        // Check for Internet access
        if (!pxt.Cloud.isNavigatorOnline()) {
            core.errorNotification(lf("No Internet access, please connect and try again."));
        } else {
            this.startTutorialAsync(tutorialId, tutorialTitle);
        }
    }

    startTutorialAsync(tutorialId: string, tutorialTitle?: string): Promise<void> {
        core.hideDialog();
        core.showLoading("tutorial", lf("starting tutorial..."));
        sounds.initTutorial(); // pre load sounds
        const scriptId = pxt.Cloud.parseScriptId(tutorialId);
        const ghid = pxt.github.parseRepoId(tutorialId);
        let reportId: string = undefined;
        let tutorialmd: string;
        let title: string;
        let autoChooseBoard: boolean = true;
        let dependencies: pxt.Map<string> = {};
        let features: string[] = undefined;
        let p: Promise<string>;
        if (/^\//.test(tutorialId)) {
            title = tutorialTitle || tutorialId.split('/').reverse()[0].replace('-', ' '); // drop any kind of sub-paths
            p = pxt.Cloud.markdownAsync(tutorialId)
                .then(md => {
                    if (md) {
                        dependencies = pxt.gallery.parsePackagesFromMarkdown(md);
                        features = pxt.gallery.parseFeaturesFromMarkdown(md);
                        autoChooseBoard = true;
                    }
                    return md;
                })
        } else if (scriptId) {
            pxt.tickEvent("tutorial.shared");
            p = workspace.downloadFilesByIdAsync(scriptId)
                .then(files => {
                    const pxtJson = JSON.parse(files["pxt.json"]) as pxt.PackageConfig;
                    dependencies = pxtJson.dependencies || {};
                    title = pxtJson.name || lf("Untitled");
                    autoChooseBoard = false;
                    reportId = scriptId;
                    return files["README.md"];
                });
        } else if (!!ghid) {
            p = pxt.packagesConfigAsync()
                .then(config => {
                    const status = pxt.github.repoStatus(ghid, config);
                    switch (status) {
                        case pxt.github.GitRepoStatus.Banned:
                            throw lf("This tutorial has been banned.");
                        //case pxt.github.GitRepoStatus.Approved:
                        default:
                            reportId = "https://github.com/" + ghid.fullName;
                            break;
                    }
                    return pxt.github.downloadPackageAsync(ghid.fullName, config);
                })
                .then(gh => {
                    const pxtJson = JSON.parse(gh.files["pxt.json"]) as pxt.PackageConfig;
                    dependencies = pxtJson.dependencies || {};
                    title = pxtJson.name || lf("Untitled");
                    autoChooseBoard = false;
                    return gh.files["README.md"];
                });
        } else {
            p = Promise.resolve(undefined);
        }

        return p.then(md => {
            if (!md)
                throw new Error("tutorial not found");
            const tutorialOptions = {
                tutorial: tutorialId,
                tutorialName: title,
                tutorialReportId: reportId,
                tutorialStep: 0,
                tutorialReady: true,
                tutorialStepInfo: pxt.tutorial.parseTutorialSteps(tutorialId, md),
                tutorialMd: md
            };
            return this.createProjectAsync({
                name: title,
                tutorial: tutorialOptions,
                dependencies
            }).then(() => autoChooseBoard ? this.autoChooseBoardAsync(features) : Promise.resolve());
        })
            .then(() => this.loadTutorialFiltersAsync())
            .catch((e) => {
                core.handleNetworkError(e);
            }).finally(() => core.hideLoading("tutorial"));
    }

    completeTutorial() {
        pxt.tickEvent("tutorial.complete");
        core.showLoading("leavingtutorial", lf("leaving tutorial..."));

        // clear tutorial field
        const tutorial = this.state.header.tutorial;
        this.state.header.tutorialCompleted = {
            id: tutorial.tutorial,
            steps: tutorial.tutorialStepInfo.length
        }
        this.state.header.tutorial = undefined;

        if (pxt.BrowserUtils.isIE()) {
            // For some reason, going from a tutorial straight to the editor in
            // IE causes the JavaScript runtime to go bad. In order to work around
            // the issue we go to the homescreen instead of the to the editor. See
            // https://github.com/Microsoft/pxt-microbit/issues/1249 for more info.
            this.exitTutorial();
        }
        else {
            this.exitTutorialAsync()
                .then(() => {
                    let curr = pkg.mainEditorPkg().header;
                    return this.loadHeaderAsync(curr);
                }).finally(() => core.hideLoading("leavingtutorial"));
        }
    }

    exitTutorial(removeProject?: boolean) {
        pxt.tickEvent("tutorial.exit");
        core.showLoading("leavingtutorial", lf("leaving tutorial..."));
        this.exitTutorialAsync(removeProject)
            .finally(() => {
                core.hideLoading("leavingtutorial");
                this.openHome();
            })
    }

    exitTutorialAsync(removeProject?: boolean) {
        let curr = pkg.mainEditorPkg().header;
        curr.isDeleted = removeProject;
        let files = pkg.mainEditorPkg().getAllFiles();
        return workspace.saveAsync(curr, files)
            .then(() => Promise.delay(500))
            .finally(() => {
                this.setState({
                    tutorialOptions: undefined,
                    tracing: undefined,
                    editorState: undefined
                });
                core.resetFocus();
            });
    }

    showTutorialHint() {
        let th = this.refs["tutorialhint"] as tutorial.TutorialHint;
        th.showHint();
        const options = this.state.tutorialOptions;
        pxt.tickEvent(`tutorial.showhint`, { tutorial: options.tutorial, step: options.tutorialStep });
    }

    ///////////////////////////////////////////////////////////
    ////////////         High contrast            /////////////
    ///////////////////////////////////////////////////////////

    toggleHighContrast() {
        const highContrastOn = !this.state.highContrast;
        pxt.tickEvent("app.highcontrast", { on: highContrastOn ? 1 : 0 });
        this.setState({ highContrast: highContrastOn }, () => {
            if (!!this.state.header) { // in editor
                this.restartSimulator()
            }
        });
        core.setHighContrast(highContrastOn);
        if (this.editor && this.editor.isReady) {
            this.editor.setHighContrast(highContrastOn);
        }
    }

    toggleGreenScreen() {
        const greenScreenOn = !this.state.greenScreen;
        pxt.tickEvent("app.greenscreen", { on: greenScreenOn ? 1 : 0 });
        this.setState({ greenScreen: greenScreenOn });
    }

    setBannerVisible(b: boolean) {
        this.setState({ bannerVisible: b });
    }

    ///////////////////////////////////////////////////////////
    ////////////             Light Box            /////////////
    ///////////////////////////////////////////////////////////

    hideLightbox() {
        this.setState({ lightbox: false });
    }

    showLightbox() {
        this.setState({ lightbox: true });
    }

    ///////////////////////////////////////////////////////////
    ////////////         Script Manager           /////////////
    ///////////////////////////////////////////////////////////

    private handleScriptManagerDialogClose = () => {
        // When the script manager dialog closes, we want to refresh our projects list in case anything has changed
        this.home.forceUpdate();
    }

    ///////////////////////////////////////////////////////////
    ////////////             REFS                 /////////////
    ///////////////////////////////////////////////////////////

    private handleHomeRef = (c: projects.Projects) => {
        this.home = c;
    }

    private handleScriptSearchRef = (c: scriptsearch.ScriptSearch) => {
        this.scriptSearch = c;
    }

    private handleExtensionRef = (c: extensions.Extensions) => {
        this.extensions = c;
    }

    private handleScriptManagerDialogRef = (c: scriptmanager.ScriptManagerDialog) => {
        this.scriptManagerDialog = c;
    }

    private handleImportDialogRef = (c: projects.ImportDialog) => {
        this.importDialog = c;
    }

    private handleExitAndSaveDialogRef = (c: projects.ExitAndSaveDialog) => {
        this.exitAndSaveDialog = c;
    }

    private handleShareEditorRef = (c: share.ShareEditor) => {
        this.shareEditor = c;
    }

    private handleLanguagePickerRef = (c: lang.LanguagePicker) => {
        this.languagePicker = c;
    }

    private handleChooseHwDialogRef = (c: projects.ChooseHwDialog) => {
        this.chooseHwDialog = c;
    }

    ///////////////////////////////////////////////////////////
    ////////////             RENDER               /////////////
    ///////////////////////////////////////////////////////////

    renderCore() {
        setEditor(this);

        //  ${targetTheme.accentColor ? "inverted accent " : ''}
        const targetTheme = pxt.appTarget.appTheme;
        const simOpts = pxt.appTarget.simulator;
        const sharingEnabled = pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && !pxt.shell.isControllerMode();
        const sandbox = pxt.shell.isSandboxMode();
        const isBlocks = !this.editor.isVisible || this.getPreferredEditor() == pxt.BLOCKS_PROJECT_NAME;
        const sideDocs = !(sandbox || targetTheme.hideSideDocs);
        const tutorialOptions = this.state.tutorialOptions;
        const inTutorial = !!tutorialOptions && !!tutorialOptions.tutorial;
        const inDebugMode = this.state.debugging;
        const inHome = this.state.home && !sandbox;
        const inEditor = !!this.state.header && !inHome;
        const { lightbox, greenScreen } = this.state;
        const simDebug = !!targetTheme.debugger || inDebugMode;

        const { hideMenuBar, hideEditorToolbar, transparentEditorToolbar } = targetTheme;
        const isHeadless = simOpts && simOpts.headless;
        const selectLanguage = targetTheme.selectLanguage;
        const showEditorToolbar = inEditor && !hideEditorToolbar && this.editor.hasEditorToolbar();
        const useSerialEditor = pxt.appTarget.serial && !!pxt.appTarget.serial.useEditor;

        const showSideDoc = sideDocs && this.state.sideDocsLoadUrl && !this.state.sideDocsCollapsed;
        const shouldHideEditorFloats = (this.state.hideEditorFloats || this.state.collapseEditorTools) && (!inTutorial || isHeadless);
        const shouldCollapseEditorTools = this.state.collapseEditorTools && (!inTutorial || isHeadless);
        const logoWide = !!targetTheme.logoWide;
        const hwDialog = !sandbox && pxt.hasHwVariants();

        const isApp = cmds.isNativeHost() || pxt.winrt.isWinRT() || pxt.BrowserUtils.isElectron();

        let rootClassList = [
            "ui",
            lightbox ? 'dimmable dimmed' : 'dimmable',
            shouldHideEditorFloats ? " hideEditorFloats" : '',
            shouldCollapseEditorTools ? " collapsedEditorTools" : '',
            transparentEditorToolbar ? " transparentEditorTools" : '',
            this.state.fullscreen ? 'fullscreensim' : '',
            this.state.highContrast ? 'hc' : '',
            showSideDoc ? 'sideDocs' : '',
            pxt.shell.layoutTypeClass(),
            inHome ? 'inHome' : '',
            inTutorial ? 'tutorial' : '',
            inDebugMode ? 'debugger' : '',
            pxt.options.light ? 'light' : '',
            pxt.BrowserUtils.isTouchEnabled() ? 'has-touch' : '',
            hideMenuBar ? 'hideMenuBar' : '',
            !showEditorToolbar || transparentEditorToolbar ? 'hideEditorToolbar' : '',
            this.state.bannerVisible ? "notificationBannerVisible" : "",
            this.state.debugging ? "debugging" : "",
            sandbox && this.isEmbedSimActive() ? 'simView' : '',
            isApp ? "app" : "",
            greenScreen ? "greenscreen" : "",
            logoWide ? "logo-wide" : "",
            'full-abs'
        ];
        const rootClasses = sui.cx(rootClassList);

        if (this.state.hasError) {
            return <div id="root" className="ui middle aligned center aligned grid" style={{ height: '100%', alignItems: 'center' }}>
                <div className="ui raised segment inverted purple">
                    <h2>{lf("Oops")}</h2>
                    {lf("We detected a problem and we will reload the editor in a few seconds..")}
                </div>
            </div>
        }
        return (
            <div id='root' className={rootClasses}>
                {greenScreen ? <greenscreen.WebCam close={this.toggleGreenScreen} /> : undefined}
                {hideMenuBar || inHome ? undefined :
                    <header className="menubar" role="banner">
                        {inEditor ? <accessibility.EditorAccessibilityMenu parent={this} highContrast={this.state.highContrast} /> : undefined}
                        <notification.NotificationBanner parent={this} />
                        <container.MainMenu parent={this} />
                    </header>}
                {inTutorial ? <div id="maineditor" className={sandbox ? "sandbox" : ""} role="main">
                    <tutorial.TutorialCard ref="tutorialcard" parent={this} />
                </div> : undefined}
                <div id="simulator">
                    <div id="filelist" className="ui items">
                        <div id="boardview" className={`ui vertical editorFloat`} role="region" aria-label={lf("Simulator")}>
                        </div>
                        <simtoolbar.SimulatorToolbar parent={this} />
                        <div className="ui item portrait hide hidefullscreen">
                            {pxt.options.debug ? <sui.Button key='hwdebugbtn' className='teal' icon="xicon chip" text={"Dev Debug"} onClick={this.hwDebug} /> : ''}
                        </div>
                        {useSerialEditor ?
                            <div id="serialPreview" className="ui editorFloat portrait hide hidefullscreen">
                                <serialindicator.SerialIndicator ref="simIndicator" isSim={true} onClick={this.openSimSerial} />
                                <serialindicator.SerialIndicator ref="devIndicator" isSim={false} onClick={this.openDeviceSerial} />
                            </div> : undefined}
                        {sandbox || isBlocks || this.editor == this.serialEditor ? undefined : <filelist.FileList parent={this} />}
                        <div id="filelistOverlay" role="button" title={lf("Open in fullscreen")} onClick={this.toggleSimulatorFullscreen}></div>
                    </div>
                </div>
                <div id="maineditor" className={(sandbox ? "sandbox" : "") + (inDebugMode ? "debugging" : "")} role="main" aria-hidden={inHome}>
                    {this.allEditors.map(e => e.displayOuter())}
                </div>
                {inHome ? <div id="homescreen" className="full-abs">
                    <div className="ui home projectsdialog">
                        <header className="menubar" role="banner">
                            <accessibility.HomeAccessibilityMenu parent={this} highContrast={this.state.highContrast} />
                            <projects.ProjectsMenu parent={this} />
                        </header>
                        <projects.Projects parent={this} ref={this.handleHomeRef} />
                    </div>
                </div> : undefined}
                {inTutorial ? <tutorial.TutorialHint ref="tutorialhint" parent={this} /> : undefined}
                {showEditorToolbar ? <div id="editortools" role="complementary" aria-label={lf("Editor toolbar")}>
                    <editortoolbar.EditorToolbar ref="editortools" parent={this} />
                </div> : undefined}
                {sideDocs ? <container.SideDocs ref="sidedoc" parent={this} sideDocsCollapsed={this.state.sideDocsCollapsed} docsUrl={this.state.sideDocsLoadUrl} /> : undefined}
                {sandbox ? undefined : <scriptsearch.ScriptSearch parent={this} ref={this.handleScriptSearchRef} />}
                {sandbox ? undefined : <extensions.Extensions parent={this} ref={this.handleExtensionRef} />}
                {inHome ? <projects.ImportDialog parent={this} ref={this.handleImportDialogRef} /> : undefined}
                {inHome && targetTheme.scriptManager ? <scriptmanager.ScriptManagerDialog parent={this} ref={this.handleScriptManagerDialogRef} onClose={this.handleScriptManagerDialogClose} /> : undefined}
                {sandbox ? undefined : <projects.ExitAndSaveDialog parent={this} ref={this.handleExitAndSaveDialogRef} />}
                {hwDialog ? <projects.ChooseHwDialog parent={this} ref={this.handleChooseHwDialogRef} /> : undefined}
                {sandbox || !sharingEnabled ? undefined : <share.ShareEditor parent={this} ref={this.handleShareEditorRef} loading={this.state.publishing} />}
                {selectLanguage ? <lang.LanguagePicker parent={this} ref={this.handleLanguagePickerRef} /> : undefined}
                {sandbox ? <container.SandboxFooter parent={this} /> : undefined}
                {hideMenuBar ? <div id="editorlogo"><a className="poweredbylogo"></a></div> : undefined}
                {lightbox ? <sui.Dimmer isOpen={true} active={lightbox} portalClassName={'tutorial'} className={'ui modal'}
                    shouldFocusAfterRender={false} closable={true} onClose={this.hideLightbox} /> : undefined}
            </div>
        );
    }
}

function render() {
    ReactDOM.render(<ProjectView />, sui.appElement);
}

function getEditor() {
    return theEditor
}

function initLogin() {
    cloudsync.loginCheck()

    {
        let qs = core.parseQueryString((location.hash || "#").slice(1).replace(/%23access_token/, "access_token"))
        if (qs["access_token"]) {
            let ex = pxt.storage.getLocal("oauthState")
            let tp = pxt.storage.getLocal("oauthType")
            if (ex && ex == qs["state"]) {
                pxt.storage.removeLocal("oauthState")
                pxt.storage.removeLocal("oauthType")
                if (tp == "github")
                    pxt.storage.setLocal("githubtoken", qs["access_token"])
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
    const isHF2WinRTSerial = pxt.appTarget.serial && pxt.appTarget.serial.useHF2 && pxt.winrt.isWinRT();
    const isValidLocalhostSerial = pxt.appTarget.serial && pxt.BrowserUtils.isLocalHost() && !!Cloud.localToken;

    if (!isHF2WinRTSerial && !isValidLocalhostSerial && !pxt.usb.isEnabled)
        return;

    if (hidbridge.shouldUse() || pxt.usb.isEnabled) {
        hidbridge.configureHidSerial((buf, isErr) => {
            let data = Util.fromUTF8(Util.uint8ArrayToString(buf))
            //pxt.debug('serial: ' + data)
            window.postMessage({
                type: 'serial',
                id: 'n/a', // TODO
                data
            }, "*")
        });
        return;
    }

    pxt.debug('initializing serial pipe');
    let ws = new WebSocket(`ws://localhost:${pxt.options.wsPort}/${Cloud.localToken}/serial`);
    let serialBuffers: pxt.Map<string> = {};
    ws.onopen = (ev) => {
        pxt.debug('serial: socket opened');
    }
    ws.onclose = (ev) => {
        pxt.debug('serial: socket closed')
    }
    ws.onerror = (ev) => {
        pxt.debug('serial: error')
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
    assembleCurrent,
    log,
    cloudsync
};
(window as any).E = myexports;

export let ksVersion: string;

function parseHash(): { cmd: string; arg: string } {
    let hashM = /^#(\w+)(:([:\.\/\-\+\=\w]+))?/.exec(window.location.hash)
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
            editor.setSideDoc(hash.arg, editor.editor === editor.blocksEditor);
            break;
        case "follow":
            pxt.tickEvent("hash.follow")
            editor.newEmptyProject(undefined, hash.arg);
            return true;
        case "newproject": // shortcut to create a new blocks proj
            pxt.tickEvent("hash.newproject")
            editor.newEmptyProject();
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
            editor.importProjectFromFileAsync(fileContents)
                .finally(() => core.hideLoading("loadingproject"));
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
            return true;
        default:
            return false;
    }
}

async function importGithubProject(id: string) {
    core.showLoading("loadingheader", lf("importing github project..."));
    try {
        let hd = await workspace.importGithubAsync(id)
        let text = await workspace.getTextAsync(hd.id)
        if ((text[pxt.CONFIG_NAME] || "{}").length < 20) {
            let ok = await core.confirmAsync({
                header: lf("Initialize MakeCode extension?"),
                body: lf("We didn't find a valid pxt.json file in the repository. Would you like to create it and supporting files?"),
                agreeLbl: lf("Initialize!")
            })
            if (!ok) {
                hd.isDeleted = true
                await workspace.saveAsync(hd)
                return
            }
            await workspace.initializeGithubRepoAsync(hd, id)
        }
        await theEditor.loadHeaderAsync(hd, null)
    } catch (e) {
        core.handleNetworkError(e)
    } finally {
        core.hideLoading("loadingheader")
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

const handleHashChange = (e: HashChangeEvent) => {
    handleHash(parseHash(), false);
}

function initHashchange() {
    window.addEventListener("hashchange", handleHashChange);
}

function clearHashChange() {
    window.removeEventListener("hashchange", handleHashChange)
}

function saveAsBlocks(): boolean {
    try {
        return /saveblocks=1/.test(window.location.href) && !!pkg.mainPkg.readFile("main.blocks")
    } catch (e) { return false; }
}

function initExtensionsAsync(): Promise<void> {
    if (!pxt.appTarget.appTheme || !pxt.appTarget.appTheme.extendEditor) return Promise.resolve();

    pxt.debug('loading editor extensions...');
    const opts: pxt.editor.ExtensionOptions = {
        blocklyToolbox: blocklyToolbox.getToolboxDefinition(),
        monacoToolbox: monacoToolbox.getToolboxDefinition(),
        projectView: theEditor
    };
    return pxt.BrowserUtils.loadScriptAsync("editor.js")
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
            if (res.saveOnlyAsync) {
                pxt.debug(`\tadded custom save only async`);
                pxt.commands.saveOnlyAsync = res.saveOnlyAsync;
            }
            if (res.saveProjectAsync) {
                pxt.debug(`\tadded custom save project async`);
                pxt.commands.saveProjectAsync = res.saveProjectAsync;
            }
            if (res.showUploadInstructionsAsync) {
                pxt.debug(`\tadded custom upload instructions async`);
                pxt.commands.showUploadInstructionsAsync = res.showUploadInstructionsAsync;
            }
            if (res.patchCompileResultAsync) {
                pxt.debug(`\tadded build patch`);
                pxt.commands.patchCompileResultAsync = res.patchCompileResultAsync;
            }
            if (res.beforeCompile) {
                theEditor.beforeCompile = res.beforeCompile;
            }
            if (res.toolboxOptions) {
                if (res.toolboxOptions.blocklyToolbox) {
                    blocklyToolbox.overrideToolbox(res.toolboxOptions.blocklyToolbox);
                }
                if (res.toolboxOptions.monacoToolbox) {
                    monacoToolbox.overrideToolbox(res.toolboxOptions.monacoToolbox);
                }
            }
            if (res.blocklyPatch) {
                pxt.blocks.extensionBlocklyPatch = res.blocklyPatch;
            }
            if (res.webUsbPairDialogAsync) {
                pxt.commands.webUsbPairDialogAsync = res.webUsbPairDialogAsync;
            }
        });
}

pxt.winrt.captureInitialActivation();
document.addEventListener("DOMContentLoaded", () => {
    pxt.setupWebConfig((window as any).pxtConfig);
    const config = pxt.webConfig
    pxt.options.debug = /dbg=1/i.test(window.location.href);
    pxt.options.light = /light=1/i.test(window.location.href) || pxt.BrowserUtils.isARM() || pxt.BrowserUtils.isIE();
    if (pxt.options.light) {
        pxsim.U.addClass(document.body, 'light');
    }
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
            // Prevent us from stripping out the hash before the reload is complete
            clearHashChange();
            // On embedded pages, preserve the loaded project
            if (pxt.BrowserUtils.isIFrame() && (hash.cmd === "pub" || hash.cmd === "sandbox")) {
                location.hash = `#${hash.cmd}:${hash.arg}`;
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

    pxt.hex.showLoading = (msg) => core.showLoading("hexcloudcompiler", msg);
    pxt.hex.hideLoading = () => core.hideLoading("hexcloudcompiler");
    pxt.docs.requireMarked = () => require("marked");
    const importHex = (hex: pxt.cpp.HexFile, createNewIfFailed = false) => theEditor.importHex(hex, createNewIfFailed);

    const hm = /^(https:\/\/[^/]+)/.exec(window.location.href)
    if (hm) Cloud.apiRoot = hm[1] + "/api/"

    const query = core.parseQueryString(window.location.href)

    if (query["hw"])
        pxt.setHwVariant(query["hw"])

    pxt.setCompileSwitches(query["compiler"] || query["compile"])

    pxt.github.token = pxt.storage.getLocal("githubtoken");

    const isSandbox = pxt.shell.isSandboxMode() || pxt.shell.isReadOnly();
    const isController = pxt.shell.isControllerMode();
    const theme = pxt.appTarget.appTheme;
    if (query["ws"]) workspace.setupWorkspace(query["ws"]);
    else if ((theme.allowParentController || isController) && pxt.BrowserUtils.isIFrame()) workspace.setupWorkspace("iframe");
    else if (isSandbox) workspace.setupWorkspace("mem");
    else if (pxt.winrt.isWinRT()) workspace.setupWorkspace("uwp");
    else if (pxt.BrowserUtils.isIpcRenderer() && pxt.BrowserUtils.isSafari()) workspace.setupWorkspace("idb");
    else if (pxt.BrowserUtils.isLocalHost() || pxt.BrowserUtils.isPxtElectron()) workspace.setupWorkspace("fs");
    Promise.resolve()
        .then(() => {
            const mlang = /(live)?(force)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
            if (mlang && window.location.hash.indexOf(mlang[0]) >= 0) {
                pxt.BrowserUtils.changeHash(window.location.hash.replace(mlang[0], ""));
            }
            const useLang = mlang ? mlang[3] : (lang.getCookieLang() || theme.defaultLocale || (navigator as any).userLanguage || navigator.language);
            const live = !theme.disableLiveTranslations || (mlang && !!mlang[1]);
            const force = !!mlang && !!mlang[2];
            return Util.updateLocalizationAsync(
                pxt.appTarget.id,
                config.commitCdnUrl,
                useLang,
                pxt.appTarget.versions.pxtCrowdinBranch,
                pxt.appTarget.versions.targetCrowdinBranch,
                live,
                force)
                .then(() => {
                    if (pxt.Util.isLocaleEnabled(useLang)) {
                        lang.setCookieLang(useLang);
                        lang.setInitialLang(useLang);
                    } else {
                        pxt.tickEvent("unavailablelocale." + useLang + (force ? ".force" : ""));
                    }
                    pxt.tickEvent("locale." + pxt.Util.userLanguage() + (live ? ".live" : ""));

                    // Download sim translations and save them in the sim
                    return Util.downloadSimulatorLocalizationAsync(
                        pxt.appTarget.id,
                        config.commitCdnUrl,
                        useLang,
                        pxt.appTarget.versions.pxtCrowdinBranch,
                        pxt.appTarget.versions.targetCrowdinBranch,
                        live,
                        force
                    );
                }).then((simStrings) => {
                    if (simStrings)
                        simulator.setTranslations(simStrings);
                });
        })
        .then(() => {
            pxt.BrowserUtils.initTheme();
            pxt.editor.experiments.syncTheme();
            cmds.init();
            // editor messages need to be enabled early, in case workspace provider is IFrame
            if (theme.allowParentController
                || theme.allowPackageExtensions
                || theme.allowSimulatorTelemetry
                || pxt.shell.isControllerMode())
                pxt.editor.bindEditorMessages(getEditorAsync);
            return workspace.initAsync()
        })
        .then((state) => {
            render(); // this sets theEditor
            if (state)
                theEditor.setState({ editorState: state });
            initSerial();
            initHashchange();
            socketbridge.tryInit();
            return initExtensionsAsync();
        })
        .then(() => {
            electron.initElectron(theEditor);
            return pxt.winrt.initAsync(importHex);
        })
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
        .then(() => {
            pxsim.U.remove(document.getElementById('loading'));
            return workspace.loadedAsync();
        })
        .done()

    document.addEventListener("visibilitychange", ev => {
        if (theEditor)
            theEditor.updateVisibility();
    });

    window.addEventListener("unload", ev => {
        if (theEditor)
            theEditor.saveSettings()
    });
    window.addEventListener("resize", ev => {
        if (theEditor && theEditor.editor) {
            theEditor.editor.resize(ev);

            // The order WKWebView resize events on IOS is weird, resize again to be sure
            if (pxt.BrowserUtils.isIOS()) {
                setTimeout(() => {
                    theEditor.editor.resize(ev);
                }, 1000);
            }
        }
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
            return;
        }

        if (m.type == "tutorial" || m.type == "popoutcomplete") {
            if (theEditor && theEditor.editor)
                theEditor.handleMessage(m);
            return;
        }
        if (m.type === "sidedocready" && pxt.BrowserUtils.isLocalHost() && Cloud.localToken) {
            container.SideDocs.notify({
                type: "localtoken",
                localToken: Cloud.localToken
            } as pxsim.SimulatorDocMessage);
            return;
        }
        if (m.type == "importfile") {
            const msg = m as pxsim.ImportFileMessage;
            if (theEditor)
                theEditor.importFile(new File(msg.parts, msg.filename));
            return;
        }
    }, false);
})
