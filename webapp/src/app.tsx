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
import * as tutorial from "./tutorial";
import * as editortoolbar from "./editortoolbar";
import * as filelist from "./filelist";
import * as container from "./container";
import * as scriptsearch from "./scriptsearch";
import * as projects from "./projects";

import * as monaco from "./monaco"
import * as pxtjson from "./pxtjson"
import * as blocks from "./blocks"
import * as codecard from "./codecard"
import * as logview from "./logview"
import * as draganddrop from "./draganddrop";
import * as hwdbg from "./hwdbg"
import * as electron from "./electron";

type ISettingsProps = pxt.editor.ISettingsProps;
type IAppProps = pxt.editor.IAppProps;
type IAppState = pxt.editor.IAppState;
type IProjectView = pxt.editor.IProjectView;
type FileHistoryEntry = pxt.editor.FileHistoryEntry;
type EditorSettings = pxt.editor.EditorSettings;
type ProjectCreationOptions = pxt.editor.ProjectCreationOptions;

import Cloud = pxt.Cloud;
import Util = pxt.Util;
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
    blocksEditor: blocks.Editor;
    allEditors: srceditor.Editor[] = [];
    settings: EditorSettings;
    scriptSearch: scriptsearch.ScriptSearch;
    projects: projects.Projects;
    shareEditor: share.ShareEditor;

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
            collapseEditorTools: pxt.appTarget.simulator.headless
        };
        if (!this.settings.editorFontSize) this.settings.editorFontSize = /mobile/i.test(navigator.userAgent) ? 15 : 20;
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

        if (this.reload) {
            return;
        }

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

    saveFile() {
        this.saveFileAsync().done()
    }

    saveFileAsync() {
        if (!this.editorFile)
            return Promise.resolve()
        return this.saveTypeScriptAsync()
            .then(() => {
                let txt = this.editor.getCurrentSource()
                if (txt != this.editorFile.content)
                    simulator.makeDirty();
                return this.editorFile.setContentAsync(txt);
            });
    }

    private isBlocksActive(): boolean {
        return this.editor == this.blocksEditor
            && this.editorFile && this.editorFile.name == "main.blocks";
    }

    private isJavaScriptActive(): boolean {
        return this.editor == this.textEditor
            && this.editorFile && this.editorFile.name == "main.ts";
    }

    openJavaScript() {
        pxt.tickEvent("menu.javascript");
        if (this.isJavaScriptActive()) return;
        if (this.isBlocksActive()) this.blocksEditor.openTypeScript();
        else this.setFile(pkg.mainEditorPkg().files["main.ts"])
    }

    openBlocks() {
        pxt.tickEvent("menu.blocks");
        if (this.isBlocksActive()) return;
        if (this.isJavaScriptActive()) this.textEditor.openBlocks();
        else this.setFile(pkg.mainEditorPkg().files["main.blocks"])
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

    public typecheckNow() {
        this.saveFile(); // don't wait for saving to backend store to finish before typechecking
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
            this.saveFile(); // don't wait till save is done
            this.typecheck();
        }
        this.markdownChangeHandler();
    }, 500, false);
    private initEditors() {
        this.textEditor = new monaco.Editor(this);
        this.pxtJsonEditor = new pxtjson.Editor(this);
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
        this.allEditors = [this.pxtJsonEditor, this.blocksEditor, this.textEditor]
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

        // save file before change
        this.saveFileAsync()
            .then(() => {
                this.editorFile = this.state.currFile as pkg.File; // TODO
                let previousEditor = this.editor;
                this.editor = editorOverride || this.pickEditorFor(this.editorFile)
                this.allEditors.forEach(e => e.setVisible(e == this.editor))
                return previousEditor ? previousEditor.unloadFileAsync() : Promise.resolve();
            })
            .then(() => { return this.editor.loadFileAsync(this.editorFile); })
            .then(() => {
                this.saveFile(); // make sure state is up to date
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
            })
    }

    setFile(fn: pkg.File) {
        if (!fn) return;

        this.setState({
            currFile: fn,
            showBlocks: false
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

    setSideMarkdown(md: string) {
        let sd = this.refs["sidedoc"] as container.SideDocs;
        if (!sd) return;
        sd.setMarkdown(md);
    }

    setSideDoc(path: string) {
        let sd = this.refs["sidedoc"] as container.SideDocs;
        if (!sd) return;
        if (path) sd.setPath(path);
        else sd.collapse();
    }

    setTutorialStep(step: number) {
        // save and typecheck
        this.typecheckNow();
        // Notify tutorial content pane
        let tc = this.refs["tutorialcard"] as tutorial.TutorialCard;
        if (!tc) return;
        if (step > -1) {
            tutorial.TutorialContent.notify({
                type: "tutorial",
                tutorial: this.state.tutorial,
                subtype: "stepchange",
                step: step
            } as pxsim.TutorialStepChangeMessage)
        }
    }

    handleMessage(msg: pxsim.SimulatorMessage) {
        switch (msg.type) {
            case "tutorial":
                let t = msg as pxsim.TutorialMessage;
                switch (t.subtype) {
                    case 'steploaded':
                        let tt = msg as pxsim.TutorialStepLoadedMessage;
                        let showCategories = tt.showCategories ? tt.showCategories : Object.keys(tt.data).length > 7;
                        this.editor.filterToolbox(tt.data, showCategories, false);
                        this.setState({ tutorialReady: true, tutorialCardLocation: tt.location });
                        tutorial.TutorialContent.refresh();
                        core.hideLoading();
                        break;
                }
                break;
        }
    }

    reloadHeaderAsync() {
        return this.loadHeaderAsync(this.state.header)
    }

    loadHeaderAsync(h: pxt.workspace.Header): Promise<void> {
        if (!h)
            return Promise.resolve()

        this.stopSimulator(true);
        pxt.blocks.cleanBlocks();
        let logs = this.refs["logs"] as logview.LogView;
        logs.clear();
        this.setState({
            showFiles: false
        })
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
                    else this.textEditor.decompileAsync(file.getVirtualFileName()).then((success) => {
                        if (!success)
                            file = main.lookupFile("this/" + file.getVirtualFileName()) || file
                    });
                }
                this.setState({
                    header: h,
                    projectName: h.name,
                    currFile: file
                })
                pkg.getEditorPkg(pkg.mainPkg).onupdate = () => {
                    this.loadHeaderAsync(h).done()
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

                let readme = main.lookupFile("this/README.md");
                if (readme && readme.content && readme.content.trim())
                    this.setSideMarkdown(readme.content);
                else if (pkg.mainPkg.config.documentation)
                    this.setSideDoc(pkg.mainPkg.config.documentation);
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

    importHex(data: pxt.cpp.HexFile) {
        const targetId = pxt.appTarget.id;
        const forkid = pxt.appTarget.forkof;
        if (!data || !data.meta) {
            core.warningNotification(lf("Sorry, we could not recognize this file."))
            return;
        }
        if (data.meta.cloudId == "microbit.co.uk" && data.meta.editor == "blockly") {
            pxt.tickEvent("import.blocks")
            pxt.debug('importing microbit.co.uk blocks project')
            core.showLoading(lf("loading project..."))
            this.createProjectAsync({
                filesOverride: {
                    "main.blocks": data.source
                }, name: data.meta.name
            }).done(() => core.hideLoading());
            return;
        } else if (data.meta.cloudId == "microbit.co.uk" && data.meta.editor == "touchdevelop") {
            pxt.tickEvent("import.td")
            pxt.debug('importing microbit.co.uk TD project')
            core.showLoading("loading project...")
            this.createProjectAsync({
                filesOverride: { "main.blocks": "", "main.ts": "  " },
                name: data.meta.name
            })
                .then(() => tdlegacy.td2tsAsync(data.source))
                .then(text => this.textEditor.overrideFile(text))
                .done(() => core.hideLoading());
            return;
        } else if (data.meta.cloudId == "ks/" + targetId || data.meta.cloudId == pxt.CLOUD_ID + targetId // match on targetid
            || (!forkid && Util.startsWith(data.meta.cloudId, pxt.CLOUD_ID + targetId)) // trying to load white-label file into main target
            || (forkid && data.meta.cloudId == pxt.CLOUD_ID + forkid) // trying to load main target file into white-label
        ) {
            pxt.tickEvent("import.pxt")
            pxt.debug("importing project")
            let h: pxt.workspace.InstallHeader = {
                target: targetId,
                editor: data.meta.editor,
                name: data.meta.name,
                meta: {},
                pubId: "",
                pubCurrent: false
            };
            const files = JSON.parse(data.source) as pxt.Map<string>;
            // we cannot load the workspace until we've loaded the project
            workspace.installAsync(h, files)
                .done(hd => this.loadHeaderAsync(hd));
            return;
        }

        core.warningNotification(lf("Sorry, we could not import this project."))
        pxt.tickEvent("warning.importfailed");
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

    openProject() {
        pxt.tickEvent("menu.open");
        this.projects.showOpenProject();
    }

    exportProjectToFileAsync(): Promise<Uint8Array> {
        const mpkg = pkg.mainPkg;
        return this.saveFileAsync()
            .then(() => mpkg.filesToBePublishedAsync(true))
            .then(files => {
                const project: pxt.cpp.HexFile = {
                    meta: {
                        cloudId: pxt.CLOUD_ID + pxt.appTarget.id,
                        targetVersions: pxt.appTarget.versions,
                        editor: this.getPreferredEditor(),
                        name: mpkg.config.name
                    },
                    source: JSON.stringify(files, null, 2)
                }
                return pxt.lzmaCompressAsync(JSON.stringify(project, null, 2));
            });
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

    saveProjectToFile() {
        const mpkg = pkg.mainPkg
        this.exportProjectToFileAsync()
            .done((buf: Uint8Array) => {
                const fn = pkg.genFileName(".pxt");
                pxt.BrowserUtils.browserDownloadUInt8Array(buf, fn, 'application/octet-stream');
            })
    }

    addPackage() {
        pxt.tickEvent("menu.addpackage");
        this.scriptSearch.showAddPackages();
    }

    newEmptyProject(name?: string, documentation?: string) {
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
        cfg.name = options.name || lf("Untitled") // pxt.U.fmt(cfg.name, Util.getAwesomeAdj());
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
        }, files).then(hd => this.loadHeaderAsync(hd))
    }

    switchTypeScript() {
        const mainPkg = pkg.mainEditorPkg();
        const tsName = this.editorFile.getVirtualFileName();
        const f = mainPkg.files[tsName];
        this.setFile(f);
    }

    saveBlocksToTypeScript(): string {
        return this.blocksEditor.saveToTypeScript();
    }

    saveTypeScriptAsync(open = false): Promise<void> {
        if (!this.editor || !this.state.currFile || this.editorFile.epkg != pkg.mainEditorPkg() || this.reload)
            return Promise.resolve();

        let promise = Promise.resolve().then(() => {
            return open ? this.textEditor.loadMonacoAsync() : Promise.resolve();
        }).then(() => {
            let src = this.editor.saveToTypeScript();

            if (!src) return Promise.resolve();
            // format before saving
            //src = pxtc.format(src, 0).formatted;

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

        if (open) {
            return core.showLoadingAsync(lf("switching to JavaScript..."), promise, 0);
        } else {
            return promise;
        }
    }

    reset() {
        pxt.tickEvent("reset");
        core.confirmAsync({
            header: lf("Reset"),
            body: lf("You are about to clear all projects. Are you sure? This operation cannot be undone."),
            agreeLbl: lf("Reset"),
            agreeClass: "red",
            agreeIcon: "sign out",
            disagreeLbl: lf("Cancel")
        }).then(r => {
            if (!r) return;
            this.reload = true; //Indicate we are goint to reload next.
            workspace.resetAsync()
                .done(() => window.location.reload(),
                () => window.location.reload())
        });
    }

    saveAndCompile() {
        this.saveFile();
        this.compile(true);
    }

    compile(saveOnly = false) {
        // the USB init has to be called from an event handler
        if (/webusb=1/i.test(window.location.href)) {
            pxt.usb.initAsync().catch(e => { })
        }

        pxt.tickEvent("compile");
        pxt.debug('compiling...');
        if (this.state.compiling) {
            pxt.tickEvent("compile.double");
            return;
        }
        const simRestart = this.state.running;
        this.setState({ compiling: true });
        this.clearLog();
        this.editor.beforeCompile();
        if (simRestart) this.stopSimulator();
        let state = this.editor.snapshotState()
        compiler.compileAsync({ native: true, forceEmit: true, preferredEditor: this.getPreferredEditor() })
            .then(resp => {
                this.editor.setDiagnostics(this.editorFile, state)
                let fn = pxt.appTarget.compile.useUF2 ? pxtc.BINARY_UF2 : pxtc.BINARY_HEX;
                if (!resp.outfiles[fn]) {
                    pxt.tickEvent("compile.noemit")
                    core.warningNotification(lf("Compilation failed, please check your code for errors."));
                    return Promise.resolve()
                }
                resp.saveOnly = saveOnly
                return pxt.commands.deployCoreAsync(resp)
                    .catch(e => {
                        core.warningNotification(lf(".hex file upload failed, please try again."));
                        pxt.reportException(e);
                    })
            }).catch((e: Error) => {
                pxt.reportException(e);
                core.errorNotification(lf("Compilation failed, please contact support."));
            }).finally(() => {
                this.setState({ compiling: false });
                if (simRestart) this.runSimulator();
            })
            .done();
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

    toggleSimulatorFullscreen() {
        pxt.tickEvent("simulator.fullscreen", { view: 'computer', fullScreenTo: '' + !this.state.fullscreen });
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

    clearLog() {
        let logs = this.refs["logs"] as logview.LogView;
        logs.clear();
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

        this.stopSimulator();
        this.clearLog();

        let state = this.editor.snapshotState()
        return compiler.compileAsync(opts)
            .then(resp => {
                this.editor.setDiagnostics(this.editorFile, state)
                if (resp.outfiles[pxtc.BINARY_JS]) {
                    simulator.run(pkg.mainPkg, opts.debug, resp, this.state.mute)
                    this.setState({ running: true, showParts: simulator.driver.runOptions.parts.length > 0 })
                } else if (!opts.background) {
                    core.warningNotification(lf("Oops, we could not run this project. Please check your code for errors."))
                }
            })
    }

    editText() {
        if (this.editor != this.textEditor) {
            this.updateEditorFile(this.textEditor)
            this.forceUpdate();
        }
    }

    importFileDialog() {
        let input: HTMLInputElement;
        core.confirmAsync({
            header: lf("Open .hex file"),
            onLoaded: ($el) => {
                input = $el.find('input')[0] as HTMLInputElement;
            },
            htmlBody: `<div class="ui form">
  <div class="ui field">
    <label>${lf("Select a .hex file to open.")}</label>
    <input type="file" class="ui button blue fluid"></input>
  </div>
</div>`,
        }).done(res => {
            if (res) {
                pxt.tickEvent("menu.open.file");
                this.importFile(input.files[0]);
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
        return this.saveFileAsync()
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
        this.saveProjectName();
    }, 2000, false);

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
            //Save the name in the target MainPackage as well
            pkg.mainPkg.config.name = this.state.projectName;

            let f = pkg.mainEditorPkg().lookupFile("this/" + pxt.CONFIG_NAME);
            let config = JSON.parse(f.content) as pxt.PackageConfig;
            config.name = this.state.projectName;
            f.setContentAsync(JSON.stringify(config, null, 4) + "\n").done(() => {
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

    isTextEditor(): boolean {
        return this.editor == this.textEditor;
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
            htmlBody: `
<p>${Util.htmlEscape(pxt.appTarget.description)}</p>
<p>${lf("{0} version:", Util.htmlEscape(pxt.appTarget.name))} <a href="${Util.htmlEscape(pxt.appTarget.appTheme.githubUrl)}/releases/tag/v${Util.htmlEscape(pxt.appTarget.versions.target)}" target="_blank">${Util.htmlEscape(pxt.appTarget.versions.target)}</a></p>
<p>${lf("{0} version:", "PXT")} <a href="https://github.com/Microsoft/pxt/releases/tag/v${Util.htmlEscape(pxt.appTarget.versions.pxt)}" target="_blank">${Util.htmlEscape(pxt.appTarget.versions.pxt)}</a></p>
${compileService ? `<p>${lf("{0} version:", "C++ runtime")} <a href="${Util.htmlEscape("https://github.com/" + compileService.githubCorePackage + '/releases/tag/' + compileService.gittag)}" target="_blank">${Util.htmlEscape(compileService.gittag)}</a></p>` : ""}
`
        }).done();
    }

    embed() {
        pxt.tickEvent("menu.embed");
        const header = this.state.header;
        this.shareEditor.show(header);
    }

    gettingStarted() {
        pxt.tickEvent("btn.gettingstarted");
        const targetTheme = pxt.appTarget.appTheme;
        Util.assert(!this.state.sideDocsLoadUrl && targetTheme && !!targetTheme.sideDoc);
        this.startTutorial(targetTheme.sideDoc);
    }

    startTutorial(tutorialId: string) {
        pxt.tickEvent("tutorial.start");
        core.showLoading(lf("starting tutorial..."));
        this.startTutorialAsync(tutorialId)
            .then(() => Promise.delay(500));
    }

    startTutorialAsync(tutorialId: string): Promise<void> {
        let title = tutorialId;
        let result: string[] = [];

        return pxt.Cloud.downloadMarkdownAsync(tutorialId)
            .then(md => {
                let titleRegex = /^#(.*)/g.exec(md);
                if (!titleRegex || titleRegex.length < 1) return;
                title = titleRegex[1];

                let steps = md.split('###');
                for (let step = 1; step < steps.length; step++) {
                    let stepmd = `###${steps[step]}`;
                    result.push(stepmd);
                }
                //TODO: parse for tutorial options, mainly initial blocks
            }).then(() => {
                this.setState({ tutorial: tutorialId, tutorialName: title, tutorialStep: 0, tutorialSteps: result })
                let tc = this.refs["tutorialcard"] as tutorial.TutorialCard;
                tc.setPath(tutorialId);
            }).then(() => {
                return this.createProjectAsync({
                    filesOverride: {
                        "main.blocks": `<xml xmlns="http://www.w3.org/1999/xhtml"><block type="${ts.pxtc.ON_START_TYPE}"></block></xml>`,
                        "main.ts": "  "
                    },
                    name: tutorialId,
                    temporary: true
                });
            });
    }

    exitTutorial() {
        pxt.tickEvent("tutorial.exit");
        core.showLoading(lf("exiting tutorial..."));
        this.exitTutorialAsync()
            .then(() => Promise.delay(500))
            .done(() => core.hideLoading());
    }

    exitTutorialAsync() {
        // tutorial project is temporary, no need to delete
        let curr = pkg.mainEditorPkg().header
        curr.isDeleted = true
        this.setState({ active: false });
        return workspace.saveAsync(curr, {})
            .then(() => {
                if (workspace.getHeaders().length > 0) {
                    this.loadHeaderAsync(workspace.getHeaders()[0]);
                } else {
                    this.newProject();
                }
            }).finally(() => {
                this.setState({ active: true, tutorial: null, tutorialName: null, tutorialSteps: null, tutorialStep: -1 });
            });
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
        const sideDocs = !(sandbox || pxt.options.light || targetTheme.hideSideDocs);
        const inTutorial = !!this.state.tutorial;
        const tutorialName = this.state.tutorialName;
        const docMenu = targetTheme.docMenu && targetTheme.docMenu.length && !sandbox && !inTutorial;
        const gettingStarted = !sandbox && !inTutorial && !this.state.sideDocsLoadUrl && targetTheme && targetTheme.sideDoc && isBlocks;
        const gettingStartedTooltip = lf("Open beginner tutorial");
        const run = true; // !compileBtn || !pxt.appTarget.simulator.autoRun || !isBlocks;
        const restart = run && !simOpts.hideRestart;
        const fullscreen = run && !simOpts.hideFullscreen;
        const showMenuBar = !targetTheme.layoutOptions || !targetTheme.layoutOptions.hideMenuBar;
        const cookieKey = "cookieconsent"
        const cookieConsent = !!pxt.storage.getLocal(cookieKey);
        const blockActive = this.isBlocksActive();
        const javascriptActive = this.isJavaScriptActive();

        const consentCookie = () => {
            pxt.storage.setLocal(cookieKey, "1");
            this.forceUpdate();
        }

        // update window title
        document.title = this.state.header ? `${this.state.header.name} - ${pxt.appTarget.name}` : pxt.appTarget.name;

        const rootClasses = sui.cx([
                this.state.hideEditorFloats || this.state.collapseEditorTools ? " hideEditorFloats" : '',
                this.state.collapseEditorTools ? " collapsedEditorTools" : '',
                this.state.fullscreen ? 'fullscreen' : '',
                !sideDocs || !this.state.sideDocsLoadUrl || this.state.sideDocsCollapsed ? '' : 'sideDocs',
                pxt.shell.layoutTypeClass(),
                inTutorial ? 'tutorial' : '',
                pxt.options.light ? 'light' : '',
                pxt.BrowserUtils.isTouchEnabled() ? 'has-touch' : '',
                showMenuBar ? '' : 'hideMenuBar',
                'full-abs'
            ]);

        return (
            <div id='root' className={rootClasses}>
                {showMenuBar ?
                    <div id="menubar" role="banner">
                        <div className={`ui borderless fixed ${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menubar">
                            {!sandbox ? <div className="left menu">
                                <span id="logo" className="ui item logo">
                                    {targetTheme.logo || targetTheme.portraitLogo
                                        ? <a className="ui image" target="_blank" href={targetTheme.logoUrl}><img className={`ui logo ${targetTheme.portraitLogo ? " portrait hide" : ''}`} src={Util.toDataUri(targetTheme.logo || targetTheme.portraitLogo) } /></a>
                                        : <span className="name">{targetTheme.name}</span>}
                                    {targetTheme.portraitLogo ? (<a className="ui" target="_blank" href={targetTheme.logoUrl}><img className='ui mini image portrait only' src={Util.toDataUri(targetTheme.portraitLogo) } /></a>) : null}
                                </span>
                                {!inTutorial ? <sui.Item class="openproject" role="menuitem" textClass="landscape only" icon="folder open large" text={lf("Projects") } onClick={() => this.openProject() } /> : null}
                                {!inTutorial && this.state.header && sharingEnabled ? <sui.Item class="shareproject" role="menuitem" textClass="widedesktop only" text={lf("Share") } icon="share alternate large" onClick={() => this.embed() } /> : null}
                                {inTutorial ? <sui.Item class="tutorialname" role="menuitem" textClass="landscape only" text={tutorialName} /> : null}
                            </div> : undefined }
                            {!inTutorial ? <sui.Item class="editor-menuitem">
                                <sui.Item class="blocks-menuitem" textClass="landscape only" text={lf("Blocks") } icon="puzzle" active={blockActive} onClick={() => this.openBlocks() } title={lf("Convert code to Blocks") } />
                                <sui.Item class="javascript-menuitem" textClass="landscape only" text={lf("JavaScript") } icon="align left" active={javascriptActive} onClick={() => this.openJavaScript() } title={lf("Convert code to JavaScript") } />
                            </sui.Item> : undefined}
                            {inTutorial ? <tutorial.TutorialMenuItem parent={this} /> : undefined}
                            <div className="right menu">
                                {docMenu ? <container.DocsMenuItem parent={this} /> : undefined}
                                {sandbox || inTutorial ? undefined :
                                    <sui.DropdownMenuItem icon='setting large' title={lf("More...") } class="more-dropdown-menuitem">
                                        {this.state.header ? <sui.Item role="menuitem" icon="options" text={lf("Project Settings") } onClick={() => this.setFile(pkg.mainEditorPkg().lookupFile("this/pxt.json")) } /> : undefined}
                                        {this.state.header && packages ? <sui.Item role="menuitem" icon="disk outline" text={lf("Add Package...") } onClick={() => this.addPackage() } /> : undefined}
                                        {this.state.header ? <sui.Item role="menuitem" icon="trash" text={lf("Delete Project") } onClick={() => this.removeProject() } /> : undefined}
                                        <div className="ui divider"></div>
                                        <a className="ui item thin only" href="/docs" role="menuitem" target="_blank">
                                            <i className="help icon"></i>
                                            {lf("Help") }
                                        </a>
                                        {
                                            // we always need a way to clear local storage, regardless if signed in or not
                                        }
                                        <sui.Item role="menuitem" icon='sign out' text={lf("Reset") } onClick={() => this.reset() } />
                                        <div className="ui divider"></div>
                                        {targetTheme.privacyUrl ? <a className="ui item" href={targetTheme.privacyUrl} role="menuitem" title={lf("Privacy & Cookies") } target="_blank">{lf("Privacy & Cookies") }</a> : undefined}
                                        {targetTheme.termsOfUseUrl ? <a className="ui item" href={targetTheme.termsOfUseUrl} role="menuitem" title={lf("Terms Of Use") } target="_blank">{lf("Terms Of Use") }</a> : undefined}
                                        <sui.Item role="menuitem" text={lf("About...") } onClick={() => this.about() } />
                                        {electron.isElectron ? <sui.Item role="menuitem" text={lf("Check for updates...") } onClick={() => electron.checkForUpdate() } /> : undefined}
                                    </sui.DropdownMenuItem> }

                                {sandbox ? <sui.Item role="menuitem" icon="external" text={lf("Edit") } onClick={() => this.launchFullEditor() } /> : undefined}
                                {sandbox ? <span className="ui item logo"><img className="ui mini image" src={Util.toDataUri(rightLogo) } /></span> : undefined}
                                {!sandbox && gettingStarted ? <span className="ui item tablet only"><sui.Button class="small getting-started-btn" title={gettingStartedTooltip} text={lf("Getting Started") } onClick={() => this.gettingStarted() } /></span> : undefined}

                                {inTutorial ? <sui.Item role="menuitem" icon="external" text={lf("Exit tutorial") } textClass="landscape only" onClick={() => this.exitTutorial() } /> : undefined}

                                {!sandbox ? <span id="organization" className="ui item logo">
                                    {targetTheme.organizationWideLogo || targetTheme.organizationLogo
                                        ? <img className={`ui logo ${targetTheme.portraitLogo ? " portrait hide" : ''}`} src={Util.toDataUri(targetTheme.organizationWideLogo || targetTheme.organizationLogo) } />
                                        : <span className="name">{targetTheme.organization}</span>}
                                    {targetTheme.organizationLogo ? (<img className='ui mini image portrait only' src={Util.toDataUri(targetTheme.organizationLogo) } />) : null}
                                </span> : undefined }
                            </div>
                        </div>
                    </div> : undefined}
                {gettingStarted ?
                    <div id="getting-started-btn">
                        <sui.Button class="portrait hide bottom attached small getting-started-btn" title={gettingStartedTooltip} text={lf("Getting Started") } onClick={() => this.gettingStarted() } />
                    </div>
                    : undefined}
                <div id="simulator">
                    <div id="filelist" className="ui items" role="complementary">
                        <div id="boardview" className={`ui vertical editorFloat`}>
                        </div>
                        <div className="ui item grid centered portrait hide simtoolbar">
                            <div className={`ui icon buttons ${this.state.fullscreen ? 'massive' : ''}`} style={{ padding: "0" }}>
                                {make ? <sui.Button icon='configure' class="fluid sixty secondary" text={lf("Make") } title={makeTooltip} onClick={() => this.openInstructions() } /> : undefined}
                                {run ? <sui.Button key='runbtn' class={`play-button`} icon={this.state.running ? "stop" : "play"} title={runTooltip} onClick={() => this.startStopSimulator() } /> : undefined}
                                {restart ? <sui.Button key='restartbtn' class={`restart-button`} icon="refresh" title={restartTooltip} onClick={() => this.restartSimulator() } /> : undefined}
                            </div>
                            <div className={`ui icon buttons ${this.state.fullscreen ? 'massive' : ''}`} style={{ padding: "0" }}>
                                {run && targetTheme.hasAudio ? <sui.Button key='mutebtn' class={`mute-button`} icon={`${this.state.mute ? 'volume off' : 'volume up'}`} title={muteTooltip} onClick={() => this.toggleMute() } /> : undefined}
                                {fullscreen ? <sui.Button key='fullscreenbtn' class={`fullscreen-button`} icon={`${this.state.fullscreen ? 'compress' : 'maximize'}`} title={fullscreenTooltip} onClick={() => this.toggleSimulatorFullscreen() } /> : undefined}
                            </div>
                        </div>
                        <div className="ui item portrait hide">
                            {pxt.options.debug && !this.state.running ? <sui.Button key='debugbtn' class='teal' icon="xicon bug" text={"Sim Debug"} onClick={() => this.runSimulator({ debug: true }) } /> : ''}
                            {pxt.options.debug ? <sui.Button key='hwdebugbtn' class='teal' icon="xicon chip" text={"Dev Debug"} onClick={() => this.hwDebug() } /> : ''}
                        </div>
                        <div className="ui editorFloat portrait hide">
                            <logview.LogView ref="logs" />
                        </div>
                        {sandbox || isBlocks ? undefined : <filelist.FileList parent={this} />}
                    </div>
                </div>
                <div id="maineditor" className={sandbox ? "sandbox" : ""} role="main">
                    {inTutorial ? <tutorial.TutorialCard ref="tutorialcard" parent={this} /> : undefined}
                    {this.allEditors.map(e => e.displayOuter()) }
                </div>
                <div id="editortools" role="complementary">
                    <editortoolbar.EditorToolbar ref="editortools" parent={this} />
                </div>
                {sideDocs ? <container.SideDocs ref="sidedoc" parent={this} /> : undefined}
                {sandbox ? undefined : <scriptsearch.ScriptSearch parent={this} ref={v => this.scriptSearch = v} />}
                {sandbox ? undefined : <projects.Projects parent={this} ref={v => this.projects = v} />}
                {sandbox || !sharingEnabled ? undefined : <share.ShareEditor parent={this} ref={v => this.shareEditor = v} />}
                {sandbox ? <div className="ui horizontal small divided link list sandboxfooter">
                    {targetTheme.organizationUrl && targetTheme.organization ? <a className="item" target="_blank" href={targetTheme.organizationUrl}>{lf("Powered by {0}", targetTheme.organization) }</a> : undefined}
                    <a target="_blank" className="item" href={targetTheme.termsOfUseUrl}>{lf("Terms of Use") }</a>
                    <a target="_blank" className="item" href={targetTheme.privacyUrl}>{lf("Privacy") }</a>
                </div> : undefined}
                {cookieConsent ? undefined : <div id='cookiemsg' className="ui teal inverted black segment">
                    <button arial-label={lf("Ok") } className="ui right floated icon button" onClick={consentCookie}>
                        <i className="remove icon"></i>
                    </button>
                    {lf("By using this site you agree to the use of cookies for analytics.") }
                    <a target="_blank" className="ui link" href={pxt.appTarget.appTheme.privacyUrl}>{lf("Learn more") }</a>
                </div>}
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
    return /\.pxt$/i.test(filename)
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
        hidbridge.initAsync()
            .then(dev => {
                dev.onSerial = (buf, isErr) => {
                    window.postMessage({
                        type: 'serial',
                        id: 'n/a', // TODO
                        data: Util.fromUTF8(Util.uint8ArrayToString(buf))
                    }, "*")
                }
            })
            .catch(e => {
                pxt.log(`hidbridge failed to load, ${e}`);
            })
        return
    }

    pxt.debug('initializing serial pipe');
    let ws = new WebSocket(`ws://localhost:${pxt.options.wsPort}/${Cloud.localToken}/serial`);
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

function initScreenshots() {
    window.addEventListener('message', (ev: MessageEvent) => {
        let msg = ev.data as pxsim.SimulatorMessage;
        if (msg && msg.type == "screenshot") {
            pxt.tickEvent("sim.screenshot");
            const scmsg = msg as pxsim.SimulatorScreenshotMessage;
            console.log('received screenshot');
            screenshot.saveAsync(theEditor.state.header, scmsg.data)
                .done(() => { pxt.debug('screenshot saved') })
        };
    }, false);
}

function enableAnalytics() {
    pxt.analytics.enable();
    const stats: pxt.Map<string | number> = {}
    if (typeof window !== "undefined") {
        const screen = window.screen;
        stats["screen.width"] = screen.width;
        stats["screen.height"] = screen.height;
        stats["screen.availwidth"] = screen.availWidth;
        stats["screen.availheight"] = screen.availHeight;
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

function initTheme() {
    const theme = pxt.appTarget.appTheme;
    if (theme.accentColor) {
        let style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = `.ui.accent { color: ${theme.accentColor}; }
        .ui.inverted.menu .accent.active.item, .ui.inverted.accent.menu  { background-color: ${theme.accentColor}; }`;
        document.getElementsByTagName('head')[0].appendChild(style);
    }
    // RTL languages
    if (/^ar/i.test(Util.userLanguage())) {
        pxt.debug("rtl layout");
        pxsim.U.addClass(document.body, "rtl");
        document.body.style.direction = "rtl";
    }

    function patchCdn(url: string): string {
        if (!url) return url;
        return url.replace("@pxtCdnUrl@", pxt.getOnlineCdnUrl())
            .replace("@cdnUrl@", pxt.getOnlineCdnUrl());
    }

    theme.appLogo = patchCdn(theme.appLogo)
    theme.cardLogo = patchCdn(theme.cardLogo)
}

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
            editor.setSideDoc(hash.arg);
            break;
        case "follow":
            pxt.tickEvent("hash.follow")
            editor.newEmptyProject(undefined, hash.arg);
            return true;
        case "newproject":
            pxt.tickEvent("hash.newproject")
            editor.newProject();
            return true;
        case "gettingstarted":
            pxt.tickEvent("hash.gettingstarted")
            editor.newProject();
            return true;
        case "tutorial":
            pxt.tickEvent("hash.tutorial")
            editor.startTutorial(hash.arg);
            return true;
        case "sandbox":
        case "pub":
        case "edit":
            pxt.tickEvent("hash." + hash.cmd);
            const existing = workspace.getHeaders()
                .filter(h => h.pubCurrent && h.pubId == hash.arg)[0]
            core.showLoading(lf("loading project..."));
            (existing
                ? theEditor.loadHeaderAsync(existing)
                : workspace.installByIdAsync(hash.arg)
                    .then(hd => theEditor.loadHeaderAsync(hd)))
                .done(() => core.hideLoading())
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
    }

    return false;
}

function initHashchange() {
    window.addEventListener("hashchange", e => {
        handleHash(parseHash());
    });
}

$(document).ready(() => {
    pxt.setupWebConfig((window as any).pxtConfig);
    const config = pxt.webConfig
    pxt.options.debug = /dbg=1/i.test(window.location.href);
    pxt.options.light = /light=1/i.test(window.location.href) || pxt.BrowserUtils.isARM() || pxt.BrowserUtils.isIE();

    const wsPortMatch = /ws=(\d+)/i.exec(window.location.href);

    if (wsPortMatch) {
        pxt.options.wsPort = parseInt(wsPortMatch[1]) || 3233;
        window.location.hash = window.location.hash.replace(wsPortMatch[0], "");
    } else {
        pxt.options.wsPort = 3233;
    }

    enableAnalytics()
    appcache.init();
    initLogin();

    const hash = parseHash();

    const hm = /^(https:\/\/[^/]+)/.exec(window.location.href)
    if (hm) Cloud.apiRoot = hm[1] + "/api/"

    const ws = /ws=(\w+)/.exec(window.location.href)
    if (ws) workspace.setupWorkspace(ws[1]);
    else if (pxt.shell.isSandboxMode() || pxt.shell.isReadOnly()) workspace.setupWorkspace("mem");
    else if (Cloud.isLocalHost()) workspace.setupWorkspace("fs");

    pxt.docs.requireMarked = () => require("marked");

    const ih = (hex: pxt.cpp.HexFile) => theEditor.importHex(hex);
    const cfg = pxt.webConfig;

    pkg.setupAppTarget((window as any).pxtTargetBundle)

    if (!pxt.BrowserUtils.isBrowserSupported()) {
        pxt.tickEvent("unsupported");
        let redirect = pxt.BrowserUtils.suggestedBrowserPath();
        if (redirect) {
            window.location.href = redirect;
        }
    }

    Promise.resolve()
        .then(() => {
            const mlang = /(live)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
            const lang = mlang ? mlang[2] : (pxt.appTarget.appTheme.defaultLocale || navigator.userLanguage || navigator.language);
            const live = mlang && !!mlang[1];
            if (lang) pxt.tickEvent("locale." + lang + (live ? ".live" : ""));
            return Util.updateLocalizationAsync(cfg.pxtCdnUrl, lang, live);
        })
        .then(() => initTheme())
        .then(() => cmds.initCommandsAsync())
        .then(() => compiler.init())
        .then(() => workspace.initAsync())
        .then(() => {
            $("#loading").remove();
            render()
            return workspace.syncAsync();
        })
        .then(() => {
            initSerial();
            initScreenshots();
            initHashchange();
        }).then(() => pxt.winrt.initAsync(ih))
        .then(() => {
            electron.init();
            if (hash.cmd && handleHash(hash))
                return Promise.resolve();

            // default handlers
            let ent = theEditor.settings.fileHistory.filter(e => !!workspace.getHeader(e.id))[0]
            let hd = workspace.getHeaders()[0]
            if (ent) hd = workspace.getHeader(ent.id)
            if (hd) return theEditor.loadHeaderAsync(hd)
            else theEditor.newProject();
            return Promise.resolve();
        }).done(() => { });

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

        if (m.type == "tutorial") {
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
