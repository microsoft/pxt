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
import * as notification from "./notification";
import * as notificationbanner from "./notificationbanner";
import * as tutorial from "./tutorial";
import * as editortoolbar from "./editortoolbar";
import * as filelist from "./filelist";
import * as container from "./container";
import * as scriptsearch from "./scriptsearch";
import * as projects from "./projects";
import * as sounds from "./sounds";

import * as monaco from "./monaco"
import * as pxtjson from "./pxtjson"
import * as serial from "./serial"
import * as blocks from "./blocks"
import * as codecard from "./codecard"
import * as serialindicator from "./serialindicator"
import * as draganddrop from "./draganddrop";
import * as hwdbg from "./hwdbg"

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
    projects: projects.Projects;
    shareEditor: share.ShareEditor;
    languagePicker: lang.LanguagePicker;
    notificationDialog: notification.NotificationDialog;
    tutorialComplete: tutorial.TutorialComplete;
    prevEditorId: string;

    private lastChangeTime: number;
    private reload: boolean;

    constructor(props: IAppProps) {
        super(props);
        document.title = pxt.appTarget.title || pxt.appTarget.name;
        this.reload = false; //set to true in case of reset of the project where we are going to reload the page.
        this.settings = JSON.parse(pxt.storage.getLocal("editorSettings") || "{}")
        this.state = {
            showFiles: false,
            active: document.visibilityState == 'visible',
            collapseEditorTools: pxt.appTarget.simulator.headless || pxt.BrowserUtils.isMobile()
        };
        if (!this.settings.editorFontSize) this.settings.editorFontSize = /mobile/i.test(navigator.userAgent) ? 15 : 20;
        if (!this.settings.fileHistory) this.settings.fileHistory = [];
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
                    .done(() => id ? this.loadHeaderAsync(workspace.getHeader(id)) : Promise.resolve());
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

    private isBlocksActive(): boolean {
        return !this.state.embedSimView && this.editor == this.blocksEditor
            && this.editorFile && this.editorFile.name == "main.blocks";
    }

    private isJavaScriptActive(): boolean {
        return !this.state.embedSimView && this.editor == this.textEditor
            && this.editorFile && this.editorFile.name == "main.ts";
    }

    private isAnyEditeableJavaScriptOrPackageActive(): boolean {
        return this.editor == this.textEditor
            && this.editorFile && !this.editorFile.isReadonly() && /(\.ts|pxt.json)$/.test(this.editorFile.name);
    }

    openJavaScript(giveFocusOnLoading = true) {
        pxt.tickEvent("menu.javascript");
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
        pxt.tickEvent("menu.blocks");
        if (this.isBlocksActive()) {
            if (this.state.embedSimView) this.setState({ embedSimView: false });
            return;
        }
        if (this.isJavaScriptActive()) this.textEditor.openBlocks();
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
        pxt.tickActivity("menu.simView");
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
                    this.editor.setDiagnostics(this.editorFile, state);
                    data.invalidate("open-pkg-meta:" + pkg.mainEditorPkg().getPkgId());
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
        if (pxt.appTarget.appTheme.allowParentController)
            pxt.editor.bindEditorMessages(this);
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
                if (this.editor == this.textEditor || this.editor == this.blocksEditor) {
                    this.typecheck();
                }
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
            })
    }

    setFile(fn: pkg.File) {
        if (!fn) return;

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
                this.textEditor.decompileAsync(tsFile.name).then((success) => {
                    if (!success) {
                        this.setFile(tsFile)
                        this.textEditor.showConversionFailedDialog(fn.name)
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
                        this.editor.filterToolbox({ blocks: tt.toolboxSubset, defaultState: pxt.editor.FilterState.Hidden }, CategoryMode.Basic);
                        let tutorialOptions = this.state.tutorialOptions;
                        tutorialOptions.tutorialReady = true;
                        tutorialOptions.tutorialStepInfo = tt.stepInfo;
                        this.setState({ tutorialOptions: tutorialOptions });
                        const fullscreen = tutorialOptions.tutorialStepInfo[0].fullscreen;
                        if (fullscreen) this.showTutorialHint();
                        else tutorial.TutorialContent.refresh();
                        core.hideLoading();
                        break;
                }
                break;
        }
    }

    reloadHeaderAsync() {
        return this.loadHeaderAsync(this.state.header, this.state.filters)
    }

    loadHeaderAsync(h: pxt.workspace.Header, filters?: pxt.editor.ProjectFilters): Promise<void> {
        if (!h)
            return Promise.resolve()

        const htv = h.targetVersion || "0.0.0";
        // version check, you should not load a script from 1 major version above.
        if (pxt.semver.majorCmp(htv, pxt.appTarget.versions.target) > 0) {
            // the script is a major version ahead, need to redirect
            pxt.tickEvent(`patch.load.future`, { targetVersion: htv })
            return core.dialogAsync({
                header: lf("Oops, this project is too new!"),
                body: lf("This project was created in a newer version of this editor. Please try again in that editor."),
                disagreeLbl: lf("Ok")
            }).then(() => {
                this.newProject();
            })
        }

        this.stopSimulator(true);
        pxt.blocks.cleanBlocks();
        this.clearSerial();
        this.setState({
            showFiles: false,
            filters: filters,
            tutorialOptions: undefined
        })
        return pkg.loadPkgAsync(h.id)
            .catch((e: any) => {
                // for some reason, the package failed to load
                // show error pop up and create a new project
                pxt.reportException(e);
                core.errorNotification(e.message || lf("Ooops, something wrong happened."))
                this.newProject();
            })
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
                    else this.textEditor.decompileAsync(file.getVirtualFileName()).then((success) => {
                        if (!success)
                            file = main.lookupFile("this/" + file.getVirtualFileName()) || file
                    });
                }
                this.setState({
                    header: h,
                    projectName: h.name,
                    currFile: file,
                    sideDocsLoadUrl: ''
                })
                pkg.getEditorPkg(pkg.mainPkg).onupdate = () => {
                    this.loadHeaderAsync(h, this.state.filters).done()
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
                                    core.showLoading(lf("Removing {0}...", lib.id))
                                    pkg.mainEditorPkg().removeDepAsync(lib.id)
                                        .then(() => this.reloadHeaderAsync())
                                        .done(() => core.hideLoading());
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
                        this.projects.showOpenProject();
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
        fileReadAsTextAsync(file)
            .done(contents => {
                this.newProject({
                    filesOverride: { "main.blocks": contents, "main.ts": "  " },
                    name: file.name.replace(/\.blocks$/i, '') || lf("Untitled")
                })
            })
    }

    importTypescriptFile(file: File) {
        if (!file) return;
        fileReadAsTextAsync(file)
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
        canImport: data => pxt.cpp.matchTargetId(data, pxt.appTarget.id)
            || (pxt.appTarget.aliases && pxt.appTarget.aliases.some(alias => pxt.cpp.matchTargetId(data, alias)))
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

    importHex(data: pxt.cpp.HexFile, createNewIfFailed: boolean = false) {
        const targetId = pxt.appTarget.id;
        if (!data || !data.meta) {
            core.warningNotification(lf("Sorry, we could not recognize this file."))
            if (createNewIfFailed) this.newProject();
            return;
        }

        const importer = this.hexFileImporters.filter(fi => fi.canImport(data))[0];
        if (importer) {
            pxt.tickEvent("import." + importer.id);
            core.showLoading(lf("loading project..."))
            importer.importAsync(this, data)
                .done(
                    () => core.hideLoading(),
                    e => {
                        pxt.reportException(e, { importer: importer.id });
                        core.hideLoading();
                        core.errorNotification(lf("Oops, something went wrong when importing your project"));
                        if (createNewIfFailed) this.newProject();
                    });
        }
        else {
            core.warningNotification(lf("Sorry, we could not import this project."))
            pxt.tickEvent("warning.importfailed");
            if (createNewIfFailed) this.newProject();
        }
    }

    importProjectFile(file: File) {
        if (!file) return;

        fileReadAsBufferAsync(file)
            .then(buf => pxt.lzmaDecompressAsync(buf))
            .done(contents => {
                let data = JSON.parse(contents) as pxt.cpp.HexFile;
                this.importHex(data);
            }, e => {
                core.warningNotification(lf("Sorry, we could not import this project."))
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
        } else core.warningNotification(lf("Oops, don't know how to load this file!"));
    }

    importProjectAsync(project: pxt.workspace.Project, filters?: pxt.editor.ProjectFilters): Promise<void> {
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
            .then(hd => this.loadHeaderAsync(hd, filters));
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

    openProject(tab?: string) {
        pxt.tickEvent("menu.open");
        this.projects.showOpenProject(tab);
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
                return ts.pxtc.encodeBase64(Util.uint8ArrayToString(buf));
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
        pxt.tickEvent("menu.addpackage");
        this.scriptSearch.showAddPackages();
    }

    newEmptyProject(name?: string, documentation?: string) {
        this.setState({ tutorialOptions: {} });
        this.newProject({
            filesOverride: { "main.blocks": `<xml xmlns="http://www.w3.org/1999/xhtml"></xml>` },
            name, documentation
        })
    }

    newProject(options: ProjectCreationOptions = {}) {
        pxt.tickEvent("menu.newproject");
        core.showLoading(lf("creating new project..."));
        this.createProjectAsync(options)
            .then(() => Promise.delay(500))
            .done(() => core.hideLoading());
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
        files["pxt.json"] = JSON.stringify(cfg, null, 4) + "\n";
        return workspace.installAsync({
            name: cfg.name,
            meta: {},
            editor: options.prj.id,
            pubId: "",
            pubCurrent: false,
            target: pxt.appTarget.id,
            temporary: options.temporary
        }, files).then(hd => this.loadHeaderAsync(hd, options.filters))
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
            return core.showLoadingAsync(lf("switching to JavaScript..."), promise, 0);
        } else {
            return promise;
        }
    }

    resetWorkspace() {
        this.reload = true;
        workspace.resetAsync()
            .done(
                () => window.location.reload(),
                () => window.location.reload()
            );
    }

    reset() {
        pxt.tickEvent("reset");
        core.confirmAsync({
            header: lf("Reset"),
            body: lf("You are about to clear all projects. Are you sure? This operation cannot be undone."),
            agreeLbl: lf("Reset"),
            agreeClass: "red focused",
            agreeIcon: "sign out",
            disagreeLbl: lf("Cancel")
        }).then(r => {
            if (!r) return Promise.resolve();
            return Promise.resolve()
                .then(() => {
                    return pxt.winrt.releaseAllDevicesAsync();
                })
                .then(() => {
                    return this.resetWorkspace();
                });
        })
            .done();
    }

    pair() {
        pxt.usb.pairAsync()
            .then(() => {
                core.infoNotification(lf("Device paired! Try downloading now."))
            }, (err: Error) => {
                core.errorNotification(lf("Failed to pair the device: {0}", err.message))
            })
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
                if (!pxt.appTarget.compile.hasHex) {
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

    compile(saveOnly = false) {
        let userContextWindow: Window = undefined;
        if (pxt.BrowserUtils.isBrowserDownloadInSameWindow() && !pxt.BrowserUtils.isBrowserDownloadWithinUserContext())
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
                if (saveOnly) {
                    return pxt.commands.saveOnlyAsync(resp);
                }
                return pxt.commands.deployCoreAsync(resp, {
                    reportDeviceNotFoundAsync: (docPath, compileResult) => this.showDeviceNotFoundDialogAsync(docPath, compileResult),
                    reportError: (e) => core.errorNotification(e)
                })
                    .catch(e => {
                        core.warningNotification(lf(".hex file upload failed, please try again."));
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
                    class: "focused",
                    icon: "help",
                    url: docPath,
                    onclick: () => {
                        pxt.tickEvent(`compile.devicenotfound.troubleshoot`);
                    }
                },
                resp ? {
                    label: fn,
                    icon: "download",
                    class: "lightgrey",
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

    startStopSimulator() {
        if (this.state.running) {
            pxt.tickEvent('simulator.stop')
            this.stopSimulator()
        } else {
            pxt.tickEvent('simulator.start')
            this.startSimulator();
        }
    }

    restartSimulator() {
        pxt.tickEvent('simulator.restart')
        this.stopSimulator();
        this.startSimulator();
    }

    toggleTrace() {
        if (this.state.tracing) {
            this.editor.clearHighlightedStatements();
            simulator.setTraceInterval(0);
        }
        else {
            simulator.setTraceInterval(simulator.SLOW_TRACE_INTERVAL);
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
        pxt.tickEvent("simulator.fullscreen", { view: 'computer', fullScreenTo: '' + !this.state.fullscreen });
        if (!this.state.fullscreen) {
            document.addEventListener('keydown', this.closeOnEscape);
        } else {
            document.removeEventListener('keydown', this.closeOnEscape);
        }

        this.setState({ fullscreen: !this.state.fullscreen });
    }

    toggleMute() {
        pxt.tickEvent("simulator.mute", { view: 'computer', muteTo: '' + !this.state.mute });
        simulator.mute(!this.state.mute);
        this.setState({ mute: !this.state.mute });
    }

    openInstructions() {
        pxt.tickEvent("simulator.make");
        compiler.compileAsync({ native: true })
            .done(resp => {
                let p = pkg.mainEditorPkg();
                let code = p.files["main.ts"];
                let data: any = {
                    name: p.header.name || lf("Untitled"),
                    code: code ? code.content : `basic.showString("Hi!");`,
                    board: JSON.stringify(pxt.appTarget.simulator.boardDefinition)
                };
                let parts = ts.pxtc.computeUsedParts(resp);
                if (parts.length) {
                    data.parts = parts.join(" ");
                    data.partdefs = JSON.stringify(pkg.mainPkg.computePartDefinitions(parts));
                }
                let fnArgs = resp.usedArguments;
                if (fnArgs)
                    data.fnArgs = JSON.stringify(fnArgs);
                data.package = Util.values(pkg.mainPkg.deps).filter(p => p.id != "this").map(p => `${p.id}=${p._verspec}`).join('\n')
                let urlData = Object.keys(data).map(k => `${k}=${encodeURIComponent(data[k])}`).join('&');
                let url = `${pxt.webConfig.partsUrl}?${urlData}`
                window.open(url, '_blank')
            });
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
                    hwdbg.handleMessage(msg as pxsim.DebuggerMessage)
                }
            })
            hwdbg.postMessage = (msg) => simulator.driver.handleHwDebuggerMsg(msg)
            return hwdbg.startDebugAsync()
        })
    }

    runSimulator(opts: compiler.CompileOptions = {}) {
        const editorId = this.editor ? this.editor.getId().replace(/Editor$/, '') : "unknown";
        if (opts.background) pxt.tickActivity("autorun", "autorun." + editorId);
        else pxt.tickEvent(opts.debug ? "debug" : "run", { editor: editorId });

        if (!opts.background)
            this.editor.beforeCompile();

        if (this.state.tracing) {
            opts.trace = true;
        }

        this.stopSimulator();
        this.clearSerial();

        const state = this.editor.snapshotState()
        return compiler.compileAsync(opts)
            .then(resp => {
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
        const ext = pxt.appTarget.compile && pxt.appTarget.compile.hasHex ? ".hex" : ".mkcd";
        core.confirmAsync({
            header: lf("Open {0} file", ext),
            onLoaded: ($el) => {
                input = $el.find('input')[0] as HTMLInputElement;
            },
            htmlBody: `<div class="ui form">
  <div class="ui field">
    <label id="selectFileToOpenLabel">${lf("Select a {0} file to open.", ext)}</label>
    <input type="file" tabindex="0" autofocus aria-describedby="selectFileToOpenLabel" class="ui button blue fluid focused"></input>
  </div>
</div>`,
        }).done(res => {
            if (res) {
                pxt.tickEvent("menu.open.file");
                this.importFile(input.files[0]);
            }
        })
    }

    showReportAbuse() {
        pxt.tickEvent("menu.reportabuse");
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
                pxt.tickEvent("menu.reportabuse.send");
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
                        .catch(core.handleNetworkError);
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
    <input type="url" tabindex="0" autofocus aria-describedby="selectUrlToOpenLabel" placeholder="${shareUrl}..." class="ui button blue fluid"></input>
  </div>
</div>`,
        }).done(res => {
            if (res) {
                pxt.tickEvent("menu.open.url");
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
        pxt.tickEvent("sandbox.openfulleditor");
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
                return undefined;
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
            // nothing to do?
            if (pkg.mainPkg.config.name == this.state.projectName)
                return Promise.resolve();

            //Save the name in the target MainPackage as well
            pkg.mainPkg.config.name = this.state.projectName;

            pxt.debug('saving project name to ' + this.state.projectName);
            let f = pkg.mainEditorPkg().lookupFile("this/" + pxt.CONFIG_NAME);
            let config = JSON.parse(f.content) as pxt.PackageConfig;
            config.name = this.state.projectName;
            return f.setContentAsync(JSON.stringify(config, null, 4) + "\n")
                .then(() => {
                    if (this.state.header)
                        this.setState({
                            projectName: this.state.header.name
                        })
                });
        }
        catch (e) {
            pxt.reportException(e);
            return Promise.resolve();
        }
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
        pxt.tickEvent("menu.about");
        const compileService = pxt.appTarget.compileService;
        core.confirmAsync({
            header: lf("About {0}", pxt.appTarget.name),
            hideCancel: true,
            agreeLbl: lf("Ok"),
            agreeClass: "positive focused",
            hasCloseIcon: true,
            htmlBody: `
<p>${Util.htmlEscape(pxt.appTarget.description)}</p>
<p>${lf("{0} version:", Util.htmlEscape(pxt.appTarget.name))} <a class="focused" href="${Util.htmlEscape(pxt.appTarget.appTheme.githubUrl)}/releases/tag/v${Util.htmlEscape(pxt.appTarget.versions.target)}" aria-label="${lf("{0} version : {1}", Util.htmlEscape(pxt.appTarget.name), Util.htmlEscape(pxt.appTarget.versions.target))}" target="_blank">${Util.htmlEscape(pxt.appTarget.versions.target)}</a></p>
<p>${lf("{0} version:", "Microsoft MakeCode")} <a href="https://github.com/Microsoft/pxt/releases/tag/v${Util.htmlEscape(pxt.appTarget.versions.pxt)}" aria-label="${lf("{0} version: {1}", "Microsoft MakeCode", Util.htmlEscape(pxt.appTarget.versions.pxt))}" target="_blank">${Util.htmlEscape(pxt.appTarget.versions.pxt)}</a></p>
${compileService ? `<p>${lf("{0} version:", "C++ runtime")} <a href="${Util.htmlEscape("https://github.com/" + compileService.githubCorePackage + '/releases/tag/' + compileService.gittag)}" aria-label="${lf("{0} version: {1}", "C++ runtime", Util.htmlEscape(compileService.gittag))}" target="_blank">${Util.htmlEscape(compileService.gittag)}</a></p>` : ""}
`
        }).done();
    }

    embed() {
        pxt.tickEvent("menu.embed");
        const header = this.state.header;
        this.shareEditor.show(header);
    }

    selectLang() {
        this.languagePicker.show();
    }

    loadNotificationsAsync() {
        return pxt.targetConfigAsync().then(targetConfig => {
            if (targetConfig) {
                const notifications: pxt.Map<pxt.Notification> = targetConfig && targetConfig.notifications
                    ? targetConfig.notifications
                    : {};
                const thisNotification = notifications[window.location.hostname];
                if (thisNotification) {
                    pxt.tickEvent("notifications.showDialog");
                    this.setState({ notification: thisNotification });
                }
            }
        });
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

    gettingStarted() {
        pxt.tickEvent("btn.gettingstarted");
        const targetTheme = pxt.appTarget.appTheme;
        Util.assert(!this.state.sideDocsLoadUrl && targetTheme && !!targetTheme.sideDoc);
        this.startTutorial(targetTheme.sideDoc);
    }

    openTutorials() {
        pxt.tickEvent("menu.openTutorials");
        this.projects.showOpenTutorials();
    }

    startTutorial(tutorialId: string, tutorialTitle?: string) {
        pxt.tickEvent("tutorial.start");
        core.showLoading(lf("starting tutorial..."));
        this.startTutorialAsync(tutorialId, tutorialTitle)
            .then(() => Promise.delay(500));
    }

    startTutorialAsync(tutorialId: string, tutorialTitle?: string): Promise<void> {
        let title = tutorialTitle || tutorialId.split('/').reverse()[0].replace('-', ' '); // drop any kind of sub-paths
        let result: string[] = [];

        sounds.initTutorial(); // pre load sounds
        return Promise.resolve().then(() => {
            return this.createProjectAsync({
                name: title
            });
        }).then(() => {
            let tutorialOptions: pxt.editor.TutorialOptions = {
                tutorial: tutorialId,
                tutorialName: title,
                tutorialStep: 0
            };
            this.setState({ tutorialOptions: tutorialOptions, tracing: undefined })

            let tc = this.refs["tutorialcontent"] as tutorial.TutorialContent;
            tc.setPath(tutorialId);
        });
    }

    exitTutorial() {
        pxt.tickEvent("tutorial.exit");
        core.showLoading(lf("leaving tutorial..."));
        this.exitTutorialAsync()
            .then(() => Promise.delay(500))
            .done(() => core.hideLoading());
    }

    exitTutorialAsync() {
        let curr = pkg.mainEditorPkg().header;
        let files = pkg.mainEditorPkg().getAllFiles();

        this.setState({ active: false, filters: undefined });
        return workspace.saveAsync(curr, files)
            .then(() => {
                if (workspace.getHeaders().length > 0) {
                    return this.loadHeaderAsync(workspace.getHeaders()[0], null);
                } else {
                    return this.newProject();
                }
            })
            .finally(() => {
                core.hideLoading()
                this.setState({ active: true, tutorialOptions: undefined, tracing: undefined });
                core.resetFocus();
            });
    }

    toggleHighContrast() {
        const highContrastOn = !this.state.highContrast;
        pxt.tickEvent("menu.highcontrast", { on: highContrastOn ? 1 : 0 });
        this.setState({ highContrast: highContrastOn }, () => this.restartSimulator());
        core.highContrast = highContrastOn;
        if (this.editor && this.editor.isReady) {
            this.editor.setHighContrast(highContrastOn);
        }
    }

    completeTutorial() {
        pxt.tickEvent("tutorial.complete");
        this.tutorialComplete.show();
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
        const workspaces = pxt.appTarget.cloud && pxt.appTarget.cloud.workspaces;
        const packages = pxt.appTarget.cloud && pxt.appTarget.cloud.packages;
        const sharingEnabled = pxt.appTarget.cloud && pxt.appTarget.cloud.sharing;
        const reportAbuse = pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.publishing && pxt.appTarget.cloud.importing;
        const compile = pxt.appTarget.compile;
        const compileBtn = compile.hasHex;
        const simOpts = pxt.appTarget.simulator;
        const sandbox = pxt.shell.isSandboxMode();
        const make = !sandbox && this.state.showParts && simOpts && (simOpts.instructions || (simOpts.parts && pxt.options.debug));
        const rightLogo = sandbox ? targetTheme.portraitLogo : targetTheme.rightLogo;
        const compileTooltip = lf("Download your code to the {0}", targetTheme.boardName);
        const compileLoading = !!this.state.compiling;
        const runTooltip = this.state.running ? lf("Stop the simulator") : lf("Start the simulator");
        const makeTooltip = lf("Open assembly instructions");
        const restartTooltip = lf("Restart the simulator");
        const fullscreenTooltip = this.state.fullscreen ? lf("Exit fullscreen mode") : lf("Launch in fullscreen");
        const muteTooltip = this.state.mute ? lf("Unmute audio") : lf("Mute audio");
        const isBlocks = !this.editor.isVisible || this.getPreferredEditor() == pxt.BLOCKS_PROJECT_NAME;
        const sideDocs = !(sandbox || targetTheme.hideSideDocs);
        const tutorialOptions = this.state.tutorialOptions;
        const inTutorial = !!tutorialOptions && !!tutorialOptions.tutorial;
        const docMenu = targetTheme.docMenu && targetTheme.docMenu.length && !sandbox && !inTutorial;
        const gettingStarted = !sandbox && !inTutorial && !this.state.sideDocsLoadUrl && targetTheme && targetTheme.sideDoc && isBlocks;
        const gettingStartedTooltip = lf("Open beginner tutorial");
        const run = true; // !compileBtn || !pxt.appTarget.simulator.autoRun || !isBlocks;
        const restart = run && !simOpts.hideRestart;
        const trace = run && simOpts.enableTrace;
        const fullscreen = run && !inTutorial && !simOpts.hideFullscreen
        const audio = run && !inTutorial && targetTheme.hasAudio;
        const { hideMenuBar, hideEditorToolbar } = targetTheme;
        const isHeadless = simOpts.headless;
        const simActive = this.state.embedSimView;
        const blockActive = this.isBlocksActive();
        const javascriptActive = this.isJavaScriptActive();
        const traceTooltip = this.state.tracing ? lf("Disable Slow-Mo") : lf("Slow-Mo");
        const selectLanguage = targetTheme.selectLanguage;
        const showEditorToolbar = !hideEditorToolbar && this.editor.hasEditorToolbar();
        const useSerialEditor = pxt.appTarget.serial && !!pxt.appTarget.serial.useEditor;

        const showSideDoc = sideDocs && this.state.sideDocsLoadUrl && !this.state.sideDocsCollapsed;
        const isApp = cmds.isNativeHost() || pxt.winrt.isWinRT();

        let rootClassList = [
            "ui",
            (this.state.hideEditorFloats || this.state.collapseEditorTools) && !inTutorial ? " hideEditorFloats" : '',
            this.state.collapseEditorTools && !inTutorial ? " collapsedEditorTools" : '',
            this.state.fullscreen ? 'fullscreensim' : '',
            this.state.highContrast ? 'hc' : '',
            showSideDoc ? 'sideDocs' : '',
            pxt.shell.layoutTypeClass(),
            inTutorial ? 'tutorial' : '',
            pxt.options.light ? 'light' : '',
            pxt.BrowserUtils.isTouchEnabled() ? 'has-touch' : '',
            hideMenuBar ? 'hideMenuBar' : '',
            !showEditorToolbar ? 'hideEditorToolbar' : '',
            this.state.bannerVisible ? "notificationBannerVisible" : "",
            sandbox && simActive ? 'simView' : '',
            isApp ? "app" : "",
            'full-abs'
        ];
        let jQueryClasses = ["dimmable", "dimmed"];
        let prevRoot = document.getElementById("root");
        if (prevRoot) {
            jQueryClasses.filter(c => prevRoot.classList.contains(c)).forEach(c => rootClassList.push(c));
        }
        const rootClasses = sui.cx(rootClassList);

        const uiHandler = pxt.analytics.consentWrapper(this);

        return (
            <div id='root' className={rootClasses}>
                {hideMenuBar ? undefined :
                    <header id="menubar" role="banner" className={"ui menu"}>
                        <div id="accessibleMenu" className="ui accessibleMenu borderless fixed menu" role="menubar">
                            <sui.Item class={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" icon="xicon js" text={lf("Skip to JavaScript editor")} onClick={uiHandler(this.openJavaScript)} />
                            {selectLanguage ? <sui.Item class={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" icon="xicon globe" text={lf("Select Language")} onClick={uiHandler(this.selectLang)} /> : undefined}
                            {targetTheme.highContrast ? <sui.Item class={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" text={this.state.highContrast ? lf("High Contrast Off") : lf("High Contrast On")} onClick={uiHandler(this.toggleHighContrast)} /> : undefined}
                        </div>
                        <notificationbanner.NotificationBanner parent={this} />
                        <div id="mainmenu" className={`ui borderless fixed ${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menubar" aria-label={lf("Main menu")}>
                            {!sandbox ? <div className="left menu">
                                <a id="logo" className="ui item logo" target="_blank" rel="noopener" href={targetTheme.logoUrl} aria-label={lf("{0} website", targetTheme.boardName)} role="menuitem">
                                    {targetTheme.logo || targetTheme.portraitLogo
                                        ? <span className={`ui image ${targetTheme.portraitLogo ? " portrait hide" : ''}`}><img className="ui logo" src={Util.toDataUri(targetTheme.logo || targetTheme.portraitLogo)} alt={`${targetTheme.boardName} Logo`} /></span>
                                        : <span className="name">{targetTheme.name}</span>}
                                    {targetTheme.portraitLogo ? (<span className="ui portrait only"><img className='ui mini image portrait only' src={Util.toDataUri(targetTheme.portraitLogo)} alt={`${targetTheme.boardName} Logo`} /></span>) : null}
                                </a>
                                {!inTutorial ? <sui.Item class="icon openproject" role="menuitem" textClass="landscape only" icon="folder open large" ariaLabel={lf("Create or open recent project")} text={lf("Projects")} onClick={uiHandler(this.openProject)} /> : null}
                                {!inTutorial && this.state.header && sharingEnabled ? <sui.Item class="icon shareproject" role="menuitem" textClass="widedesktop only" ariaLabel={lf("Share Project")} text={lf("Share")} icon="share alternate large" onClick={uiHandler(this.embed)} /> : null}
                                {inTutorial ? <sui.Item class="tutorialname" tabIndex={-1} textClass="landscape only" text={tutorialOptions.tutorialName} /> : null}
                            </div> : <div className="left menu">
                                    <span id="logo" className="ui item logo">
                                        <img className="ui mini image" src={Util.toDataUri(rightLogo)} tabIndex={0} onClick={uiHandler(this.launchFullEditor)} onKeyDown={sui.fireClickOnEnter} alt={`${targetTheme.boardName} Logo`} />
                                    </span>
                                </div>}
                            {!inTutorial && !targetTheme.blocksOnly ? <div className="ui item link editor-menuitem">
                                {sandbox ? <sui.Item class="sim-menuitem thin portrait only" role="menuitem" textClass="landscape only" text={lf("Simulator")} icon={simActive && this.state.running ? "stop" : "play"} active={simActive} onClick={() => this.openSimView()} title={!simActive ? lf("Show Simulator") : runTooltip} /> : undefined}
                                <sui.Item class="blocks-menuitem" role="menuitem" textClass="landscape only" text={lf("Blocks")} icon="xicon blocks" active={blockActive} onClick={uiHandler(this.openBlocks)} title={lf("Convert code to Blocks")} />
                                <sui.Item class="javascript-menuitem" role="menuitem" textClass="landscape only" text={lf("JavaScript")} icon="xicon js" active={javascriptActive} onClick={uiHandler(() => this.openJavaScript(false))} title={lf("Convert code to JavaScript")} />
                            </div> : undefined}
                            {inTutorial ? <tutorial.TutorialMenuItem parent={this} /> : undefined}
                            <div className="right menu">
                                {docMenu ? <container.DocsMenuItem parent={this} /> : undefined}
                                {sandbox || inTutorial ? undefined :
                                    <sui.DropdownMenuItem icon='setting large' title={lf("More...")} class="more-dropdown-menuitem">
                                        {this.state.header ? <sui.Item role="menuitem" icon="options" text={lf("Project Settings")} onClick={uiHandler(() => this.setFile(pkg.mainEditorPkg().lookupFile("this/pxt.json")))} tabIndex={-1} /> : undefined}
                                        {this.state.header && packages ? <sui.Item role="menuitem" icon="disk outline" text={lf("Add Package...")} onClick={uiHandler(this.addPackage)} tabIndex={-1} /> : undefined}
                                        {this.state.header ? <sui.Item role="menuitem" icon="trash" text={lf("Delete Project")} onClick={uiHandler(this.removeProject)} tabIndex={-1} /> : undefined}
                                        {reportAbuse ? <sui.Item role="menuitem" icon="warning circle" text={lf("Report Abuse...")} onClick={uiHandler(this.showReportAbuse)} tabIndex={-1} /> : undefined}
                                        <div className="ui divider"></div>
                                        {selectLanguage ? <sui.Item icon="xicon globe" role="menuitem" text={lf("Language")} onClick={() => this.selectLang()} tabIndex={-1} /> : undefined}
                                        {targetTheme.highContrast ? <sui.Item role="menuitem" text={this.state.highContrast ? lf("High Contrast Off") : lf("High Contrast On")} onClick={uiHandler(this.toggleHighContrast)} tabIndex={-1} /> : undefined}
                                        {
                                            // we always need a way to clear local storage, regardless if signed in or not
                                        }
                                        <sui.Item role="menuitem" icon='sign out' text={lf("Reset")} onClick={uiHandler(this.reset)} tabIndex={-1} />
                                        {!pxt.usb.isEnabled ? undefined :
                                            <sui.Item role="menuitem" icon='usb' text={lf("Pair device")} onClick={uiHandler(this.pair)} tabIndex={-1} />}
                                        {docMenu ? <div className="ui divider mobile only"></div> : undefined}
                                        {docMenu ? container.renderDocItems(this, "mobile only") : undefined}
                                        <div className="ui divider"></div>
                                        {targetTheme.privacyUrl ? <a className="ui item" href={targetTheme.privacyUrl} role="menuitem" title={lf("Privacy & Cookies")} target="_blank" tabIndex={-1}>{lf("Privacy & Cookies")}</a> : undefined}
                                        {targetTheme.termsOfUseUrl ? <a className="ui item" href={targetTheme.termsOfUseUrl} role="menuitem" title={lf("Terms Of Use")} target="_blank" tabIndex={-1}>{lf("Terms Of Use")}</a> : undefined}
                                        <sui.Item role="menuitem" text={lf("About...")} onClick={uiHandler(this.about)} tabIndex={-1} />
                                        {targetTheme.feedbackUrl ? <div className="ui divider"></div> : undefined}
                                        {targetTheme.feedbackUrl ? <a className="ui item" href={targetTheme.feedbackUrl} role="menuitem" title={lf("Give Feedback")} target="_blank" rel="noopener" tabIndex={-1} >{lf("Give Feedback")}</a> : undefined}

                                    </sui.DropdownMenuItem>}

                                {sandbox && !targetTheme.hideEmbedEdit ? <sui.Item role="menuitem" icon="external" textClass="mobile hide" text={lf("Edit")} onClick={uiHandler(this.launchFullEditor)} /> : undefined}
                                {inTutorial ? <sui.ButtonMenuItem class="exit-tutorial-btn" role="menuitem" icon="external" text={lf("Exit tutorial")} textClass="landscape only" onClick={uiHandler(this.exitTutorial)} /> : undefined}
                                {!sandbox ? <a id="organization" href={targetTheme.organizationUrl} aria-label={lf("{0} Logo", targetTheme.organization)} role="menuitem" target="blank" rel="noopener" className="ui item logo" onClick={uiHandler(() => pxt.tickEvent("menu.org"))}>
                                    {targetTheme.organizationWideLogo || targetTheme.organizationLogo
                                        ? <img className={`ui logo ${targetTheme.organizationWideLogo ? " portrait hide" : ''}`} src={Util.toDataUri(targetTheme.organizationWideLogo || targetTheme.organizationLogo)} alt={lf("{0} Logo", targetTheme.organization)} />
                                        : <span className="name">{targetTheme.organization}</span>}
                                    {targetTheme.organizationLogo ? (<img className='ui mini image portrait only' src={Util.toDataUri(targetTheme.organizationLogo)} alt={lf("{0} Logo", targetTheme.organization)} />) : null}
                                </a> : undefined}
                            </div>
                        </div>
                    </header>}
                {gettingStarted ?
                    <div id="getting-started-btn">
                        <sui.Button class="portrait hide bottom attached small getting-started-btn" title={gettingStartedTooltip} text={lf("Getting Started")} onClick={uiHandler(this.gettingStarted)} />
                    </div>
                    : undefined}
                <div id="maineditor" className={sandbox ? "sandbox" : ""} role="main">
                    {inTutorial ? <tutorial.TutorialCard ref="tutorialcard" parent={this} /> : undefined}
                </div>
                <div id="simulator">
                    <aside id="filelist" className="ui items">
                        <label htmlFor="boardview" id="boardviewLabel" className="accessible-hidden" aria-hidden="true">{lf("Simulator")}</label>
                        <div id="boardview" className={`ui vertical editorFloat`} role="region" aria-labelledby="boardviewLabel">
                        </div>
                        {!isHeadless ? <aside className="ui item grid centered portrait hide simtoolbar" role="complementary" aria-label={lf("Simulator toolbar")}>
                            <div className={`ui icon buttons ${this.state.fullscreen ? 'massive' : ''}`} style={{ padding: "0" }}>
                                {make ? <sui.Button icon='configure' class="fluid sixty secondary" text={lf("Make")} title={makeTooltip} onClick={uiHandler(this.openInstructions)} /> : undefined}
                                {run ? <sui.Button key='runbtn' class={`play-button ${this.state.running ? "stop" : "play"}`} icon={this.state.running ? "stop" : "play"} title={runTooltip} onClick={uiHandler(this.startStopSimulator)} /> : undefined}
                                {restart ? <sui.Button key='restartbtn' class={`restart-button`} icon="refresh" title={restartTooltip} onClick={uiHandler(this.restartSimulator)} /> : undefined}
                                {trace ? <sui.Button key='debug' class={`trace-button ${this.state.tracing ? 'orange' : ''}`} icon="xicon turtle" title={traceTooltip} onClick={uiHandler(this.toggleTrace)} /> : undefined}
                            </div>
                            <div className={`ui icon buttons ${this.state.fullscreen ? 'massive' : ''}`} style={{ padding: "0" }}>
                                {audio ? <sui.Button key='mutebtn' class={`mute-button ${this.state.mute ? 'red' : ''}`} icon={`${this.state.mute ? 'volume off' : 'volume up'}`} title={muteTooltip} onClick={uiHandler(this.toggleMute)} /> : undefined}
                                {fullscreen ? <sui.Button key='fullscreenbtn' class={`fullscreen-button`} icon={`${this.state.fullscreen ? 'compress' : 'maximize'}`} title={fullscreenTooltip} onClick={uiHandler(this.toggleSimulatorFullscreen)} /> : undefined}
                            </div>
                        </aside> : undefined}
                        <div className="ui item portrait hide">
                            {pxt.options.debug && !this.state.running ? <sui.Button key='debugbtn' class='teal' icon="xicon bug" text={"Sim Debug"} onClick={uiHandler(() => this.runSimulator({ debug: true }))} /> : ''}
                            {pxt.options.debug ? <sui.Button key='hwdebugbtn' class='teal' icon="xicon chip" text={"Dev Debug"} onClick={uiHandler(this.hwDebug)} /> : ''}
                        </div>
                        {useSerialEditor ?
                            <div id="serialPreview" className="ui editorFloat portrait hide">
                                <serialindicator.SerialIndicator ref="simIndicator" isSim={true} onClick={uiHandler(() => this.openSerial(true))} />
                                <serialindicator.SerialIndicator ref="devIndicator" isSim={false} onClick={uiHandler(() => this.openSerial(false))} />
                            </div> : undefined}
                        {sandbox || isBlocks || this.editor == this.serialEditor ? undefined : <filelist.FileList parent={this} />}
                    </aside>
                </div>
                <div id="maineditor" className={sandbox ? "sandbox" : ""} role="main">
                    {this.allEditors.map(e => e.displayOuter())}
                </div>
                {inTutorial ? <tutorial.TutorialHint ref="tutorialhint" parent={this} /> : undefined}
                {inTutorial ? <tutorial.TutorialContent ref="tutorialcontent" parent={this} /> : undefined}
                {showEditorToolbar ? <div id="editortools" role="complementary" aria-label={lf("Editor toolbar")}>
                    <editortoolbar.EditorToolbar ref="editortools" parent={this} />
                </div> : undefined}
                {sideDocs ? <container.SideDocs ref="sidedoc" parent={this} /> : undefined}
                {sandbox ? undefined : <scriptsearch.ScriptSearch parent={this} ref={v => this.scriptSearch = v} />}
                {sandbox ? undefined : <projects.Projects parent={this} ref={v => this.projects = v} />}
                {sandbox || !sharingEnabled ? undefined : <share.ShareEditor parent={this} ref={v => this.shareEditor = v} />}
                {selectLanguage ? <lang.LanguagePicker parent={this} ref={v => this.languagePicker = v} /> : undefined}
                {inTutorial ? <tutorial.TutorialComplete parent={this} ref={v => this.tutorialComplete = v} /> : undefined}
                <notification.NotificationDialog parent={this} ref={v => this.notificationDialog = v} />
                {sandbox ? <div className="ui horizontal small divided link list sandboxfooter">
                    {targetTheme.organizationUrl && targetTheme.organization ? <a className="item" target="_blank" rel="noopener" href={targetTheme.organizationUrl}>{targetTheme.organization}</a> : undefined}
                    <a target="_blank" className="item" href={targetTheme.termsOfUseUrl} rel="noopener">{lf("Terms of Use")}</a>
                    <a target="_blank" className="item" href={targetTheme.privacyUrl} rel="noopener">{lf("Privacy")}</a>
                    <span className="item"><a className="ui thin portrait only" title={compileTooltip} onClick={uiHandler(this.compile)}><i className="icon download" />{lf("Download")}</a></span>
                </div> : undefined}
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

function fileReadAsBufferAsync(f: File): Promise<Uint8Array> { // ArrayBuffer
    if (!f)
        return Promise.resolve<Uint8Array>(null);
    else {
        return new Promise<Uint8Array>((resolve, reject) => {
            let reader = new FileReader();
            reader.onerror = (ev) => resolve(null);
            reader.onload = (ev) => resolve(new Uint8Array(reader.result as ArrayBuffer));
            reader.readAsArrayBuffer(f);
        });
    }
}

function fileReadAsTextAsync(f: File): Promise<string> { // ArrayBuffer
    if (!f)
        return Promise.resolve<string>(null);
    else {
        return new Promise<string>((resolve, reject) => {
            let reader = new FileReader();
            reader.onerror = (ev) => resolve(null);
            reader.onload = (ev) => resolve(reader.result);
            reader.readAsText(f);
        });
    }
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

function initSerial() {
    if (!pxt.appTarget.serial || !Cloud.isLocalHost() || !Cloud.localToken)
        return;

    if (hidbridge.shouldUse()) {
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
    ws.onmessage = (ev) => {
        try {
            let msg = JSON.parse(ev.data) as pxsim.SimulatorSerialMessage;
            if (msg && msg.type == 'serial') {
                pxt.Util.bufferSerial(serialBuffers, msg.data, msg.id)
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
    hwdbg,
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

function handleHash(hash: { cmd: string; arg: string }): boolean {
    if (!hash) return false;
    let editor = theEditor;
    if (!editor) return false;

    switch (hash.cmd) {
        case "doc":
            pxt.tickEvent("hash.doc")
            editor.setSideDoc(hash.arg, editor == this.blockEditor);
            break;
        case "follow":
            pxt.tickEvent("hash.follow")
            editor.newEmptyProject(undefined, hash.arg);
            return true;
        case "newproject":
            pxt.tickEvent("hash.newproject")
            editor.newProject();
            window.location.hash = "";
            return true;
        case "newjavascript":
            pxt.tickEvent("hash.newjavascript");
            editor.newProject({
                prj: pxt.appTarget.blocksprj,
                filesOverride: {
                    "main.blocks": ""
                }
            });
            window.location.hash = "";
            return true;
        case "gettingstarted":
            pxt.tickEvent("hash.gettingstarted")
            editor.newProject();
            window.location.hash = "";
            return true;
        case "tutorial":
            pxt.tickEvent("hash.tutorial")
            editor.startTutorial(hash.arg);
            window.location.hash = "";
            return true;
        case "projects":
            pxt.tickEvent("hash.projects");
            editor.openProject(hash.arg);
            window.location.hash = "";
            return true;
        case "sandbox":
        case "pub":
        case "edit":
            pxt.tickEvent("hash." + hash.cmd);
            window.location.hash = "";
            loadHeaderBySharedId(hash.arg);
            return true;
        case "sandboxproject":
        case "project":
            pxt.tickEvent("hash." + hash.cmd);
            const fileContents = Util.stringToUint8Array(atob(hash.arg));
            window.location.hash = "";
            core.showLoading(lf("loading project..."));
            theEditor.importProjectFromFileAsync(fileContents)
                .done(() => core.hideLoading());
            return true;
        case "transfer":
            pxt.tickEvent("hash." + hash.cmd);
            const resp: { header: pxt.workspace.Header, text: pxt.workspace.ScriptText } =
                JSON.parse(window.atob(hash.arg));
            window.location.hash = "";
            core.showLoading(lf("loading project..."));
            workspace.installAsync(resp.header, resp.text)
                .done(hd => theEditor.loadHeaderAsync(hd));
            return true;
    }

    return false;
}

function loadHeaderBySharedId(id: string) {
    const existing = workspace.getHeaders()
        .filter(h => h.pubCurrent && h.pubId == id)[0]
    core.showLoading(lf("loading project..."));
    (existing
        ? theEditor.loadHeaderAsync(existing, null)
        : workspace.installByIdAsync(id)
            .then(hd => theEditor.loadHeaderAsync(hd, null)))
        .catch(core.handleNetworkError)
        .finally(() => core.hideLoading());
}

function initHashchange() {
    window.addEventListener("hashchange", e => {
        handleHash(parseHash());
    });
}

function initExtensionsAsync(): Promise<void> {
    if (!pxt.appTarget.appTheme || !pxt.appTarget.appTheme.extendEditor) return Promise.resolve();

    pxt.debug('loading editor extensions...');
    const opts: pxt.editor.ExtensionOptions = {};
    return pxt.BrowserUtils.loadScriptAsync(pxt.webConfig.commitCdnUrl + "editor.js")
        .then(() => pxt.editor.initExtensionsAsync(opts))
        .then(res => {
            if (res.hexFileImporters)
                res.hexFileImporters.forEach(fi => {
                    pxt.debug(`\tadded hex importer ${fi.id}`);
                    theEditor.hexFileImporters.push(fi);
                });
            if (res.fieldEditors)
                res.fieldEditors.forEach(fi => {
                    pxt.blocks.registerFieldEditor(fi.selector, fi.editor, fi.validator);
                })
        });
}

pxt.winrt.captureInitialActivation();
$(() => {
    pxt.setupWebConfig((window as any).pxtConfig);
    const config = pxt.webConfig
    pxt.options.debug = /dbg=1/i.test(window.location.href);
    pxt.options.light = /light=1/i.test(window.location.href) || pxt.BrowserUtils.isARM() || pxt.BrowserUtils.isIE();
    const wsPortMatch = /wsport=(\d+)/i.exec(window.location.href);
    if (wsPortMatch) {
        pxt.options.wsPort = parseInt(wsPortMatch[1]) || 3233;
        window.location.hash = window.location.hash.replace(wsPortMatch[0], "");
    } else {
        pxt.options.wsPort = 3233;
    }
    pkg.setupAppTarget((window as any).pxtTargetBundle)

    enableAnalytics()

    if (!pxt.BrowserUtils.isBrowserSupported() && !/skipbrowsercheck=1/i.exec(window.location.href)) {
        pxt.tickEvent("unsupported");
        window.location.href = "/browsers";
        core.showLoading(lf("Sorry, this browser is not supported."));
        return;
    }

    initLogin();
    const hash = parseHash();
    appcache.init(hash);

    pxt.docs.requireMarked = () => require("marked");
    const importHex = (hex: pxt.cpp.HexFile, createNewIfFailed = false) => theEditor.importHex(hex, createNewIfFailed);

    const hm = /^(https:\/\/[^/]+)/.exec(window.location.href)
    if (hm) Cloud.apiRoot = hm[1] + "/api/"

    const ws = /ws=(\w+)/.exec(window.location.href)
    if (ws) workspace.setupWorkspace(ws[1]);
    else if (pxt.appTarget.appTheme.allowParentController) workspace.setupWorkspace("iframe");
    else if (pxt.shell.isSandboxMode() || pxt.shell.isReadOnly()) workspace.setupWorkspace("mem");
    else if (pxt.winrt.isWinRT()) workspace.setupWorkspace("uwp");
    else if (Cloud.isLocalHost()) workspace.setupWorkspace("fs");

    Promise.resolve()
        .then(() => {
            const mlang = /(live)?(force)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
            if (mlang && window.location.hash.indexOf(mlang[0]) >= 0) {
                window.location.hash = window.location.hash.replace(mlang[0], "");
            }
            const useLang = mlang ? mlang[3] : (lang.getCookieLang() || pxt.appTarget.appTheme.defaultLocale || (navigator as any).userLanguage || navigator.language);
            const live = !pxt.appTarget.appTheme.disableLiveTranslations || (mlang && !!mlang[1]);
            const force = !!mlang && !!mlang[2];
            return Util.updateLocalizationAsync(
                pxt.appTarget.id,
                false,
                config.commitCdnUrl,
                useLang,
                pxt.appTarget.versions.pxtCrowdinBranch,
                pxt.appTarget.versions.targetCrowdinBranch,
                live,
                force)
                .then(() => {
                    if (pxt.Util.isLocaleEnabled(useLang)) {
                        lang.setCookieLang(useLang);
                    } else {
                        pxt.tickEvent("unavailablelocale." + useLang + (force ? ".force" : ""));
                    }
                    pxt.tickEvent("locale." + pxt.Util.userLanguage() + (live ? ".live" : ""))
                });
        })
        .then(() => pxt.BrowserUtils.initTheme())
        .then(() => cmds.initCommandsAsync())
        .then(() => {
            compiler.init();
            return workspace.initAsync();
        })
        .then(() => {
            $("#loading").remove();
            render();
            return workspace.syncAsync();
        })
        .then((state) => {
            if (state) {
                theEditor.setState(state);
            }
            initScreenshots();
            initHashchange();
            return initExtensionsAsync();
        })
        .then(() => pxt.winrt.initAsync(importHex))
        .then(() => pxt.winrt.hasActivationProjectAsync())
        .then((hasWinRTProject) => {
            if (hash.cmd && handleHash(hash)) {
                return Promise.resolve();
            }
            if (hasWinRTProject) {
                return pxt.winrt.loadActivationProject();
            }

            // default handlers
            const ent = theEditor.settings.fileHistory.filter(e => !!workspace.getHeader(e.id))[0];
            let hd = workspace.getHeaders()[0];
            if (ent) hd = workspace.getHeader(ent.id);
            if (hd) return theEditor.loadHeaderAsync(hd, null);
            else theEditor.newProject();
            return Promise.resolve();
        })
        .then(() => workspace.importLegacyScriptsAsync())
        .then(() => theEditor.loadNotificationsAsync())
        .done(() => { });

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
            return;
        }

        if (m.type == "tutorial" || m.type == "popoutcomplete") {
            if (theEditor && theEditor.editor)
                theEditor.handleMessage(m);
            return;
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
