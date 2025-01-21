/// <reference path="../../localtypings/pxtpackage.d.ts"/>
/// <reference path="../../localtypings/pxteditor.d.ts"/>
/// <reference path="../../built/pxtlib.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts"/>

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Blockly from "blockly";
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
import * as sidebarTutorial from "./sidebarTutorial";
import * as editortoolbar from "./editortoolbar";
import * as dialogs from "./dialogs";
import * as identity from "./identity";
import * as container from "./container";
import * as scriptsearch from "./scriptsearch";
import * as extensionsBrowser from "./extensionsBrowser";
import * as projects from "./projects";
import * as scriptmanager from "./scriptmanager";
import * as extensions from "./extensions";
import * as sounds from "./sounds";
import * as make from "./make";
import * as blocklyToolbox from "./blocksSnippets";
import * as monacoToolbox from "./monacoSnippets";
import * as greenscreen from "./greenscreen";
import * as accessibleblocks from "./accessibleblocks";
import * as socketbridge from "./socketbridge";
import * as webusb from "./webusb";
import * as auth from "./auth";
import * as cloud from "./cloud";
import * as user from "./user";
import * as headerbar from "./headerbar";
import * as sidepanel from "./sidepanel";
import * as qr from "./qr";

import * as monaco from "./monaco"
import * as toolboxHelpers from "./toolboxHelpers"
import * as pxtjson from "./pxtjson"
import * as serial from "./serial"
import * as blocks from "./blocks"
import * as gitjson from "./gitjson"
import * as serialindicator from "./serialindicator"
import * as assetEditor from "./components/assetEditor/editor";
import * as draganddrop from "./draganddrop";
import * as notification from "./notification";
import * as electron from "./electron";
import * as blocklyFieldView from "./blocklyFieldView";
import * as pxtblockly from "../../pxtblocks";
import * as pxteditor from "../../pxteditor";

import IAppProps = pxt.editor.IAppProps;
import IAppState = pxt.editor.IAppState;
import IProjectView = pxt.editor.IProjectView;
import FileHistoryEntry = pxt.editor.FileHistoryEntry;
import EditorSettings = pxt.editor.EditorSettings;
import ProjectCreationOptions = pxt.editor.ProjectCreationOptions;
import SimState = pxt.editor.SimState;


declare const zip: any;

import Cloud = pxt.Cloud;
import Util = pxt.Util;
import { HintManager } from "./hinttooltip";
import { mergeProjectCode, appendTemporaryAssets } from "./mergeProjects";
import { Tour } from "./components/onboarding/Tour";
import { parseTourStepsAsync } from "./onboarding";
import { initGitHubDb } from "./idbworkspace";
import { BlockDefinition, CategoryNameID } from "./toolbox";

pxt.blocks.requirePxtBlockly = () => pxtblockly as any;
pxt.blocks.requireBlockly = () => Blockly;
pxt.blocks.registerFieldEditor = (selector, proto, validator) => pxtblockly.registerFieldEditor(selector, proto, validator);

pxsim.util.injectPolyphils();

let theEditor: ProjectView;
let hash: { cmd: string, arg: string };
let pendingEditorRequests: ((p: ProjectView) => void)[];

export function hasEditor() {
    return !!theEditor;
}

export function getEditorAsync() {
    if (theEditor) return Promise.resolve(theEditor);
    if (!pendingEditorRequests) pendingEditorRequests = [];
    return new Promise<ProjectView>(resolve => {
        pendingEditorRequests.push(resolve);
    });
}

export function getBlocksEditor() {
    if (!theEditor) return null;
    return theEditor.blocksEditor;
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
    extends auth.Component<IAppProps, IAppState>
    implements IProjectView {
    editor: srceditor.Editor;
    editorFile: pkg.File;
    textEditor: monaco.Editor;
    pxtJsonEditor: pxtjson.Editor;
    serialEditor: serial.Editor;
    blocksEditor: blocks.Editor;
    gitjsonEditor: gitjson.Editor;
    assetEditor: assetEditor.AssetEditor;
    allEditors: srceditor.Editor[] = [];
    settings: EditorSettings;
    scriptSearch: scriptsearch.ScriptSearch;
    home: projects.Projects;
    extensions: extensions.Extensions;
    shareEditor: share.ShareEditor;
    languagePicker: lang.LanguagePicker;
    scriptManagerDialog: scriptmanager.ScriptManagerDialog;
    importDialog: projects.ImportDialog;
    loginDialog: identity.LoginDialog;
    profileDialog: user.ProfileDialog;
    exitAndSaveDialog: projects.ExitAndSaveDialog;
    newProjectDialog: projects.NewProjectDialog;
    chooseHwDialog: projects.ChooseHwDialog;
    prevEditorId: string;
    screenshotHandlers: ((msg: pxt.editor.ScreenshotData) => void)[] = [];

    private lastChangeTime: number;
    private reload: boolean;
    private shouldTryDecompile: boolean;
    private firstRun: boolean;

    private runToken: pxt.Util.CancellationToken;
    private updatingEditorFile: boolean;
    private loadingExample: boolean;
    private openingTypeScript: boolean;
    private preserveUndoStack: boolean;
    private rootClasses: string[];
    private pendingImport: pxt.Util.DeferredPromise<void>;
    private shouldFocusToolbox: boolean;

    private highContrastSubscriber: data.DataSubscriber = {
        subscriptions: [],
        onDataChanged: () => {
            this.onHighContrastChanged();
        }
    };

    private cloudStatusSubscriber: data.DataSubscriber = {
        subscriptions: [],
        onDataChanged: (path) => this.onCloudStatusChanged(path)
    }

    // component ID strings
    static readonly tutorialCardId = "tutorialcard";

    constructor(props: IAppProps) {
        super(props);
        document.title = pxt.appTarget.title || pxt.appTarget.name;
        this.reload = false; //set to true in case of reset of the project where we are going to reload the page.
        this.settings = JSON.parse(pxt.storage.getLocal("editorSettings") || "{}")
        const shouldShowHomeScreen = this.shouldShowHomeScreen();
        const isHighContrast = /hc=(\w+)/.test(window.location.href) || (window.matchMedia?.('(forced-colors: active)')?.matches);
        if (isHighContrast) core.setHighContrast(true);

        const simcfg = pxt.appTarget.simulator;
        this.state = {
            showFiles: false,
            home: shouldShowHomeScreen,
            active: document.visibilityState == 'visible' || pxt.BrowserUtils.isElectron() || pxt.appTarget.appTheme.dontSuspendOnVisibility,
            // don't start collapsed in mobile since we can go fullscreen now
            collapseEditorTools: simcfg.headless,
            simState: SimState.Stopped,
            autoRun: this.autoRunOnStart(),
            isMultiplayerGame: false,
            onboarding: undefined,
            mute: pxt.editor.MuteState.Unmuted,
        };
        if (!this.settings.editorFontSize) this.settings.editorFontSize = /mobile/i.test(navigator.userAgent) ? 15 : 19;
        if (!this.settings.fileHistory) this.settings.fileHistory = [];
        if (shouldShowHomeScreen) this.homeLoaded();

        this.hidePackageDialog = this.hidePackageDialog.bind(this);
        this.hwDebug = this.hwDebug.bind(this);
        this.hideLightbox = this.hideLightbox.bind(this);
        this.hideOnboarding = this.hideOnboarding.bind(this);
        this.openSimSerial = this.openSimSerial.bind(this);
        this.openDeviceSerial = this.openDeviceSerial.bind(this);
        this.openSerial = this.openSerial.bind(this);
        this.toggleGreenScreen = this.toggleGreenScreen.bind(this);
        this.toggleSimulatorFullscreen = this.toggleSimulatorFullscreen.bind(this);
        this.toggleSimulatorCollapse = this.toggleSimulatorCollapse.bind(this);
        this.showKeymap = this.showKeymap.bind(this);
        this.toggleKeymap = this.toggleKeymap.bind(this);
        this.showMiniSim = this.showMiniSim.bind(this);
        this.setTutorialStep = this.setTutorialStep.bind(this);
        this.completeTutorialAsync = this.completeTutorialAsync.bind(this);
        this.exitTutorial = this.exitTutorial.bind(this);
        this.setEditorOffset = this.setEditorOffset.bind(this);
        this.resetTutorialTemplateCode = this.resetTutorialTemplateCode.bind(this);
        this.initSimulatorMessageHandlers();

        // add user hint IDs and callback to hint manager
        if (pxt.BrowserUtils.useOldTutorialLayout()) this.hintManager.addHint(ProjectView.tutorialCardId, this.tutorialCardHintCallback.bind(this));
    }

    private autoRunOnStart(): boolean {
        return pxt.appTarget.simulator
            && ((pxt.options.light
                ? !!pxt.appTarget.simulator.autoRunLight
                : !!pxt.appTarget.simulator.autoRun)
                || (this.firstRun && !!pxt.appTarget.simulator.emptyRunCode));
    }

    private initSimulatorMessageHandlers() {
        window.addEventListener('message', (ev: MessageEvent) => {
            let msg = ev.data as pxsim.SimulatorMessage;
            if (!msg || !this.state.header) return;

            if (msg.type === "addextensions") {
                const exmsg = msg as pxsim.SimulatorAddExtensionsMessage;
                const extensions = exmsg.extensions;
                this.addOrUpdateGithubExtensions(extensions);
            } else if (msg.type === "screenshot") {
                const scmsg = msg as pxsim.SimulatorScreenshotMessage;
                if (!scmsg.data) return;
                const handler = this.screenshotHandlers[this.screenshotHandlers.length - 1];
                if (handler)
                    handler(scmsg)
                else {
                    const pngString = pxt.BrowserUtils.imageDataToPNG(scmsg.data);
                    if (pxt.appTarget.compile.saveAsPNG)
                        this.encodeProjectAsPNGAsync(pngString, false);
                    screenshot.saveAsync(this.state.header, pngString)
                        .then(() => { pxt.debug('screenshot saved') })
                }
            } else if (msg.type === "recorder") {
                const scmsg = msg as pxsim.SimulatorRecorderMessage;
                const handler = this.screenshotHandlers[this.screenshotHandlers.length - 1];
                if (handler)
                    handler({
                        event: scmsg.action
                    } as pxt.editor.ScreenshotData)
            }
            else if (msg.type === "thumbnail") {
                if (this.shareEditor) this.shareEditor.setThumbnailFrames((msg as pxsim.SimulatorAutomaticThumbnailMessage).frames);
            } else if (msg.type === "multiplayer") {
                const multiplayerMessage = msg as pxsim.multiplayer.Message;
                if (multiplayerMessage.content === "Icon"
                    && multiplayerMessage.iconType === pxsim.multiplayer.IconType.Player
                ) {
                    const { palette, icon, slot } = multiplayerMessage;
                    this.handleSetPresenceIcon(slot, palette, icon?.data);
                }
            } else if (msg.type === "toplevelcodefinished") {
                if (pxt.appTarget?.appTheme?.multiplayer) {
                    const playerOneConnectedMsg: pxsim.multiplayer.ConnectionMessage = {
                        type: "multiplayer",
                        content: "Connection",
                        slot: 1,
                        connected: true,
                    };
                    simulator.driver.postMessage(playerOneConnectedMsg);
                }
            }
        }, false);
    }

    /**
     * Add Github extensions **without** conflict resolution
     */
    private async addOrUpdateGithubExtensions(extensions: string[]) {
        pxt.tickEvent('package.addextensions')
        const p = pkg.mainEditorPkg();
        const packageConfig = await pxt.packagesConfigAsync();
        const ghids = extensions?.map(ext => pxt.github.parseRepoId(ext))
            // make sure parsing succeeded
            .filter(ghid => !!ghid)
            // remove anything banned
            .filter(ghid => pxt.github.repoStatus(ghid, packageConfig) !== pxt.github.GitRepoStatus.Banned)

        // anything to add?
        if (!p || !ghids?.length)
            return;

        // need approval
        const ghidToBeApproved = ghids.filter(ghid =>
            pxt.github.repoStatus(ghid, packageConfig) !== pxt.github.GitRepoStatus.Approved);

        // let the user approve adding the packages...
        if (ghidToBeApproved.length) {
            const ok = await core.confirmAsync({
                header: lf("Add extensions?"),
                jsx: <>
                    <p>
                        {lf("Add or update these user-provided extensions to your project?")}
                    </p>
                    <ul>
                        {ghidToBeApproved.map(scr => <li key={scr.fullName}>
                            <a href={`/pkg/${scr.fullName}`}>{scr.fullName}</a>
                        </li>)}
                    </ul>
                    <hr />
                    <p>
                        {lf("User-provided extension are not endorsed by Microsoft.")}
                    </p>
                </>
            })
            if (!ok)
                return;
        }

        pxt.debug(`adding extensions ${extensions}`)
        try {
            core.showLoading("addextensions", lf("adding extensions..."))
            // it's a go, let's add
            for (const ghid of ghids) {
                pxt.debug(`adding ${ghid.fullName}`)
                const { config, version } = await pxt.github.downloadLatestPackageAsync(ghid);
                await p.setDependencyAsync(config.name, version);
            }
            this.reloadHeaderAsync();
        }
        catch (e) {
            core.handleNetworkError(e);
        } finally {
            core.hideLoading("addextensions")
        }
    }

    handleSetPresenceIcon = (slot: number, palette?: Uint8Array, icon?: Uint8Array) => {
        slot = slot | 0;
        if (slot < 1 || slot > 4)
            return;

        const root = document.getElementById("root");

        const slotCssVarName = `--multiplayer-presence-icon-${slot}`;

        if (!palette || !icon) {
            root.style.removeProperty(slotCssVarName);
            return;
        } else {
            const iconPngDataUri = pxt.convertUint8BufferToPngUri(
                palette,
                icon,
            );
            if (!iconPngDataUri) {
                // failed to parse icon, bail out
                return;
            }
            const asUrl = `url("${iconPngDataUri}")`;
            root.style.setProperty(
                slotCssVarName,
                asUrl
            );
        }
    }

    shouldShowHomeScreen() {
        const hash = parseHash();
        const isSandbox = pxt.shell.isSandboxMode() || pxt.shell.isReadOnly();
        // Only show the start screen if there are no initial projects requested
        // (e.g. from the URL hash or from controller mode)
        const skipStartScreen = pxt.appTarget.appTheme.allowParentController
            || pxt.shell.isControllerMode()
            || /^#editor/.test(window.location.hash);
        return !isSandbox && !skipStartScreen && !isProjectRelatedHash(hash);
    }

    async updateVisibilityAsync() {
        if (pxt.BrowserUtils.isElectron() || pxt.appTarget.appTheme.dontSuspendOnVisibility) {
            // Don't suspend when inside apps
            return;
        }
        const active = pxt.BrowserUtils.isDocumentVisible()
        pxt.debug(`page visibility: ${active}`)
        this.setState({ active: active });
        data.invalidate('pkg-git-pull-status');
        data.invalidate('pkg-git-pr');
        data.invalidate('pkg-git-pages')

        // disconnect devices to avoid locking between tabs
        if (!active && !navigator?.serviceWorker?.controller) {
            if (this._deploying) {
                pxt.debug(`visibility: disconnect cancelled because deploy in progress`)
            } else
                cmds.disconnectAsync(); // turn off any kind of logging
        }

        if (!active && this.state.autoRun) {
            if (!this.state.debugging) {
                if (simulator.driver.state == pxsim.SimulatorState.Running) {
                    this.suspendSimulator();
                    this.setState({ resumeOnVisibility: true });
                }
                this.saveFileAsync();
            }
        } else if (active) {
            data.invalidate("header:*")
            let hdrId = this.state.header ? this.state.header.id : '';
            const inEditor = !this.state.home && hdrId
            if ((!inEditor && workspace.isHeadersSessionOutdated())
                || workspace.isHeaderSessionOutdated(this.state.header)) {
                pxt.debug('workspace: changed, reloading...')
                await workspace.syncAsync();
                if (inEditor) { await this.loadHeaderAsync(workspace.getHeader(hdrId), this.state.editorState); }
                // device scanning restarts in loadheader
            } else if (this.state.resumeOnVisibility) {
                this.setState({ resumeOnVisibility: false });
                // We did a save when the page was hidden, no need to save again.
                this.runSimulator();
                cmds.maybeReconnectAsync(false, true);
            } else if (!this.state.home) {
                cmds.maybeReconnectAsync(false, true);
            }
        }

        if (this.editor) this.editor.onPageVisibilityChanged(active);
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

    private popFileHistory() {
        this.settings.fileHistory.shift();
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

    async componentDidUpdate(prevProps: Readonly<IAppProps>, prevState: Readonly<IAppState>) {
        this.saveSettings()
        this.editor.domUpdate();
        simulator.setState(this.state.header ? this.state.header.editor : '', this.state.tutorialOptions && !!this.state.tutorialOptions.tutorial)
        if (!this.state.fullscreen) {
            this.editor.resize();
        }

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
        if (!this.editorFile || this.loadingExample)
            return Promise.resolve()
        return this.saveTypeScriptAsync()
            .then(() => this.saveCurrentSourceAsync());
    }

    saveProjectAsync(): Promise<void> {
        return this.saveFileAsync()
            .then(() => pkg.mainEditorPkg().buildAssetsAsync())
            .then(() => this.state.header && workspace.saveAsync(this.state.header))
    }

    saveCurrentSourceAsync(): Promise<void> {
        let txt = this.editor.getCurrentSource()
        if (txt != this.editorFile.content)
            simulator.setDirty();
        if (this.editor.isIncomplete()) return Promise.resolve();
        return this.editorFile.setContentAsync(txt);
    }

    isEmbedSimActive(): boolean {
        return this.state.embedSimView;
    }

    isBlocksActive(): boolean {
        return !this.state.embedSimView && this.editor == this.blocksEditor
            && this.editorFile && this.editorFile.name == pxt.MAIN_BLOCKS;
    }

    isJavaScriptActive(): boolean {
        return !this.state.embedSimView && this.editor == this.textEditor
            && this.editorFile && this.editorFile.name == pxt.MAIN_TS;
    }

    isPythonActive(): boolean {
        return !this.state.embedSimView && this.editor == this.textEditor
            && this.editorFile && this.editorFile.name == pxt.MAIN_PY;
    }

    isAssetsActive(): boolean {
        return !this.state.embedSimView && this.editor == this.assetEditor
            && this.editorFile && this.editorFile.name == pxt.ASSETS_FILE;
    }

    private isAnyEditeableJavaScriptOrPackageActive(): boolean {
        return this.editor == this.textEditor
            && this.editorFile && !this.editorFile.isReadonly() && /(\.ts|pxt.json)$/.test(this.editorFile.name);
    }

    openPython(giveFocusOnLoading = true) {
        if (this.updatingEditorFile) return; // already transitioning

        this.setState({ tracing: false });

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
        const header = this.state.header;
        if (this.isBlocksActive() || header.editor == pxt.BLOCKS_PROJECT_NAME) {
            this.blocksEditor.openPython();
        } else if (this.isJavaScriptActive() || header.editor == pxt.JAVASCRIPT_PROJECT_NAME) {
            this.openPythonAsync();
        } else {
            // make sure there's .py file
            const mpkg = pkg.mainEditorPkg();
            const mainpy = mpkg.files[pxt.MAIN_PY];
            if (!mainpy)
                this.updateFileAsync(pxt.MAIN_PY, "# ...", false);
            else
                this.setFile(mainpy);
        }
    }

    openJavaScript(giveFocusOnLoading = true) {
        if (this.updatingEditorFile) return; // already transitioning

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
            this.openTypeScriptAsync();
        } else {
            const files = pkg.mainEditorPkg().files;
            let f = files[pxt.MAIN_TS];
            if (!f) // find first .ts file
                f = files[Object.keys(files).find(fn => /\.ts$/.test(fn))];
            this.setFile(f)
        }

        pxt.shell.setEditorLanguagePref("js");
    }

    openBlocks() {
        if (this.updatingEditorFile) return; // already transitioning

        if (this.isBlocksActive()) {
            if (this.state.embedSimView) this.setState({ embedSimView: false });
            return;
        }

        if (pxt.appTarget.simulator?.headless && !this.state.collapseEditorTools) {
            this.toggleSimulatorCollapse();
        }

        const mainBlocks = pkg.mainEditorPkg().files[pxt.MAIN_BLOCKS];
        if (this.isJavaScriptActive() || (this.shouldTryDecompile && !this.state.embedSimView))
            this.textEditor.openBlocks();
        // any other editeable .ts or pxt.json; or empty mainblocks
        else if (this.isAnyEditeableJavaScriptOrPackageActive() || !mainBlocks.content) {
            this.saveFileAsync().then(() => this.textEditor.openBlocks());
        } else {
            const header = this.state.header;

            // Check to see if the last edit happened in monaco
            if (header && header.editor !== pxt.BLOCKS_PROJECT_NAME) {
                this.textEditor.openBlocks();
            }
            else {
                this.setFile(mainBlocks)
            }
        }

        this.shouldTryDecompile = false;
    }

    /**
     * Same as openBlocks but waits for the return and ensures that main.blocks exist
     * @returns
     */
    async openBlocksAsync() {
        if (this.updatingEditorFile) return; // already transitioning

        if (this.isBlocksActive()) {
            if (this.state.embedSimView) this.setState({ embedSimView: false });
            return;
        }

        const epkg = pkg.mainEditorPkg();

        if (!epkg.files[pxt.MAIN_BLOCKS]) {
            epkg.setContentAsync(pxt.MAIN_BLOCKS, "");
        }

        const mainBlocks = epkg.files[pxt.MAIN_BLOCKS];
        if (this.isJavaScriptActive() || (this.shouldTryDecompile && !this.state.embedSimView))
            await this.textEditor.openBlocksAsync();
        // any other editeable .ts or pxt.json; or empty mainblocks
        else if (this.isAnyEditeableJavaScriptOrPackageActive() || !mainBlocks.content) {
            await this.saveFileAsync();
            await this.textEditor.openBlocksAsync();
        } else {
            const header = this.state.header;

            // Check to see if the last edit happened in monaco
            if (header && header.editor !== pxt.BLOCKS_PROJECT_NAME) {
                await this.textEditor.openBlocksAsync();
            }
            else {
                this.setFile(mainBlocks)
            }
        }

        this.shouldTryDecompile = false;
    }

    openAssets() {
        const mainEditorPkg = pkg.mainEditorPkg()
        if (!mainEditorPkg) return;

        // create assets.json if it does not exist
        if (!mainEditorPkg.lookupFile("this/" + pxt.ASSETS_FILE)) {
            mainEditorPkg.setFile(pxt.ASSETS_FILE, "\n", true);
        }
        this.saveFileAsync().then(() => this.setFile(pkg.mainEditorPkg().lookupFile(`this/${pxt.ASSETS_FILE}`)));
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
        this.preserveUndoStack = true;
        const id = this.state.header.id;
        // pop any entry matching this editor
        const e = this.settings.fileHistory[0];
        if (this.editorFile && e.id == id && e.name == this.editorFile.getName()) {
            this.popFileHistory();
        }

        // try to find a history entry within this header
        const hist = this.settings.fileHistory.find(f => f.id == id)
        if (hist) {
            const f = pkg.mainEditorPkg().lookupFile(hist.name);
            if (f) {
                this.setSideFile(f);
                return;
            }
        }

        // default logic
        const hasBlocks = !!pkg.mainEditorPkg().files[pxt.MAIN_BLOCKS];
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
        const pySrcFile = pkg.mainEditorPkg().files[pxt.MAIN_PY];
        if (pySrcFile) { // do we have any python yet?
            // convert python to typescript, if same as current source, skip decompilation
            const tsSrc = pkg.mainEditorPkg().files[pxt.MAIN_TS].content;
            return this.textEditor.convertPythonToTypeScriptAsync()
                .then(pyAsTsSrc => {
                    if (pyAsTsSrc == tsSrc) {
                        // decompiled python is same current typescript, go back to python without ts->py conversion
                        pxt.debug(`ts -> py shortcut`)
                        this.setFile(pySrcFile);
                        return Promise.resolve();
                    }
                    else return this.convertTypeScriptToPythonAsync();
                });
        } else {
            return this.convertTypeScriptToPythonAsync();
        }
    }

    private convertTypeScriptToPythonAsync() {
        const snap = this.editor.snapshotState();
        const fromLanguage = this.isBlocksActive() ? "blocks" : "ts";
        const mainFileName = this.isBlocksActive() ? pxt.MAIN_BLOCKS : pxt.MAIN_TS;
        const mainPkg = pkg.mainEditorPkg();
        const fromText = mainPkg.files[mainFileName]?.content ?? "";

        let convertPromise: Promise<void>;

        const cached = mainPkg.getCachedTranspile(fromLanguage, fromText, "py");
        if (cached) {
            convertPromise = this.saveVirtualMainFileAsync(pxt.PYTHON_PROJECT_NAME, cached, true);
        }
        else {
            convertPromise = this.saveTypeScriptAsync(false)
                .then(() => compiler.pyDecompileAsync(pxt.MAIN_TS))
                .then(cres => {
                    if (cres && cres.success) {
                        const mainpy = cres.outfiles[pxt.MAIN_PY];
                        mainPkg.cacheTranspile(fromLanguage, fromText, "py", mainpy);
                        return this.saveVirtualMainFileAsync(pxt.PYTHON_PROJECT_NAME, mainpy, true);
                    } else {
                        const e = new Error("Failed to convert to Python.")
                        pxt.reportException(e);
                        return Promise.reject(e);
                    }
                })
                .then(() => {
                    // on success, update editor pref
                    pxt.shell.setEditorLanguagePref("py");
                    return Promise.resolve();
                });
        }

        const convertPromiseOrErrorDialog = convertPromise.then(() => { }, e => {
            // on failure, show a dialog indicating such
            return core.confirmAsync({
                header: lf("Oops, there is a problem converting your code."),
                body: lf("We are unable to convert your code to Python."),
                agreeLbl: lf("Done"),
                agreeClass: "cancel",
                agreeIcon: "cancel",
                hasCloseIcon: true,
            }).then(() => { })
        })

        core.showLoadingAsync("switchtopython", lf("switching to Python..."), convertPromise);
        return convertPromiseOrErrorDialog
    }

    openSimView() {
        if (this.state.embedSimView) {
            this.startStopSimulator();
        } else {
            this.setState({ embedSimView: true });
            this.startSimulator();
        }
    }

    public shouldPreserveUndoStack() {
        return this.preserveUndoStack;
    }

    public typecheckNow() {
        this.saveFileAsync(); // don't wait for saving to backend store to finish before typechecking
        this.typecheck()
    }

    private showPackageErrorsOnNextTypecheck() {
        this.setState({ suppressPackageWarning: false });
    }

    private maybeShowPackageErrors(force = false) {
        pxt.perf.measureStart("maybeShowPackageErrors")
        // Only show in blocks or main.ts
        if (this.state.currFile) {
            const fn = this.state.currFile;
            if (!pxteditor.isBlocks(fn) && fn.name !== pxt.MAIN_TS) return false;
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
                pxt.perf.measureEnd("maybeShowPackageErrors")
                return true;
            }
        }
        pxt.perf.measureEnd("maybeShowPackageErrors")
        return false;
    }

    private autoRunSimulatorDebounced = pxtc.Util.debounce(
        () => {
            if (Util.now() - this.lastChangeTime < 1000) {
                pxt.debug(`sim: skip auto, debounced`)
                return;
            }
            if (!this.state.active) {
                pxt.debug(`sim: skip blocks auto, !active`)
                return;
            }
            if (this.blocksEditor && this.blocksEditor.isDropdownDivVisible()) {
                pxt.debug(`sim: skip blocks auto, field editor is open`);
                return;
            }
            if (this.editor === this.serialEditor) {
                pxt.debug(`sim: don't restart when entering console view`)
                return;
            }
            if (this.state.debugging || this.state.tracing) {
                pxt.debug(`sim: don't restart when debugging or tracing`)
                return;
            }
            if (this.state.collapseEditorTools) {
                pxt.debug(`sim: don't restart when simulator collapsed`);
                return;
            }
            if (pxt.BrowserUtils.isSkillmapEditor() && !this.state.header) {
                pxt.debug(`sim: don't restart when no project is open`);
                return;
            }
            this.runSimulator({ debug: !!this.state.debugging, background: true });
        },
        1000, true);

    _slowTypeCheck = 0;

    private typecheckDebouncer = new pxtc.Util.AdaptiveDebouncer(() => {
        if (this.editor.isIncomplete()) return;
        const start = Util.now();
        this.saveFileAsync(); // don't wait for saving to backend store to finish before typechecking
        const state = this.editor.snapshotState()
        compiler.typecheckAsync()
            .then(resp => {
                const end = Util.now();
                // if typecheck is slow (>10s)
                // and it happened more than 2 times,
                // it's a slow machine, go into light mode
                if (!pxt.options.light && end - start > 10000 && this._slowTypeCheck++ > 1) {
                    pxt.tickEvent("light.typecheck")
                    pxt.options.light = true;
                }
                pxt.tickEvent("typecheck.complete", { editor: this.getPreferredEditor() });
                this.editor.setDiagnostics(this.editorFile, state);
                data.invalidate("open-pkg-meta:" + pkg.mainEditorPkg().getPkgId());
                if (this.state.autoRun) {
                    const output = pkg.mainEditorPkg().outputPkg.files["output.txt"];
                    if (output && !output.numDiagnosticsOverride
                        && this.state.autoRun) {
                        this.autoRunSimulatorDebounced();
                    }
                }

                this.maybeShowPackageErrors();
            });
    })

    private typecheck() {
        this.typecheckDebouncer.trigger()
    }

    private markdownChangeHandler = Util.debounce(() => {
        if (this.state.currFile && /\.md$/i.test(this.state.currFile.name))
            this.setSideMarkdown(this.editor.getCurrentSource());
    }, 3000, false);
    private editorChangeHandler = Util.debounce(() => {
        if (!this.editor.isIncomplete()) {
            this.saveFileAsync(); // don't wait till save is done
            this.typecheck();
        }
        this.markdownChangeHandler();
    }, 500, false);
    private initEditors() {
        this.textEditor = new monaco.Editor(this);
        this.pxtJsonEditor = new pxtjson.Editor(this);
        this.serialEditor = new serial.Editor(this);
        this.blocksEditor = new blocks.Editor(this);
        this.gitjsonEditor = new gitjson.Editor(this);
        this.assetEditor = new assetEditor.AssetEditor(this);

        let changeHandler = () => {
            if (this.editorFile) {
                if (this.editorFile.inSyncWithEditor)
                    pxt.tickEvent("activity.edit", { editor: this.editor.getId().replace(/Editor$/, '') }, { interactiveConsent: true });
                this.editorFile.markDirty();
            }
            this.lastChangeTime = Util.now();
            if (this.state.simState != SimState.Stopped
                && pxt.appTarget.simulator && pxt.appTarget.simulator.stopOnChange)
                this.stopSimulator();

            if (!this.editor.isIncomplete()) {
                if (this.editor == this.textEditor)
                    this.typecheckDebouncer.poke()
                this.editorChangeHandler();
            }
        }
        this.allEditors = [this.pxtJsonEditor, this.gitjsonEditor, this.blocksEditor, this.serialEditor, this.assetEditor, this.textEditor]
        this.allEditors.forEach(e => e.changeCallback = changeHandler)
        this.editor = this.allEditors[this.allEditors.length - 1]
    }

    public UNSAFE_componentWillMount() {
        this.initEditors()
        this.initDragAndDrop();
    }

    public async componentDidMount() {
        this.allEditors.forEach(e => e.prepare())
        await simulator.initAsync(document.getElementById("boardview"), {
            orphanException: brk => {
                // TODO: start debugging session
                // TODO: user friendly error message
                this.editor?.onExceptionDetected(brk)
            },
            highlightStatement: (stmt, brk) => {
                if (this.state.debugging && !simulator.driver.areBreakpointsSet() && brk && !brk.exceptionMessage) {
                    // The simulator has paused on the first statement, so we need to send the breakpoints
                    // and then step to get to the actual first breakpoint
                    let breakpoints: number[];
                    if (this.isAnyEditeableJavaScriptOrPackageActive() || this.isPythonActive()) {
                        breakpoints = this.textEditor.getBreakpoints();
                    }
                    else if (this.isBlocksActive()) {
                        breakpoints = this.blocksEditor.getBreakpoints();
                    }

                    breakpoints = breakpoints || [];
                    simulator.driver.setBreakpoints(breakpoints);

                    if (breakpoints.indexOf(brk.breakpointId) === -1) {
                        if (!this.state.debugFirstRun) {
                            this.dbgPauseResume();
                        }
                        else {
                            this.dbgStepInto();
                            this.setState({
                                debugFirstRun: false
                            });
                        }
                        return true;
                    }
                }
                if (this.editor) return this.editor.highlightStatement(stmt, brk);
                return false;
            },
            restartSimulator: () => this.restartSimulator(),
            singleSimulator: () => this.singleSimulator(),
            onStateChanged: (state) => {
                const simStateChanged = () => this.allEditors.forEach((editor) => editor.simStateChanged());
                switch (state) {
                    case pxsim.SimulatorState.Paused:
                    case pxsim.SimulatorState.Unloaded:
                    case pxsim.SimulatorState.Suspended:
                    case pxsim.SimulatorState.Pending:
                    case pxsim.SimulatorState.Stopped:
                        this.setState({ simState: SimState.Stopped }, simStateChanged);
                        break;
                    case pxsim.SimulatorState.Running:
                        this.setState({ simState: SimState.Running }, simStateChanged);
                        break;
                }
            },
            onSimulatorReady: () => {
                if (this.autoRunOnStart()) {
                    pxt.analytics.trackPerformanceReport();
                }
            },
            onMuteButtonStateChange: state => this.setMute(state),
            setState: (k, v) => {
                pkg.mainEditorPkg().setSimState(k, v)
            },
            editor: this.state.header ? this.state.header.editor : ''
        });

        // we now have editors prepared
        this.forceUpdate();
        // start blockly load
        this.loadBlocklyAsync();

        // subscribe to user preference changes (for simulator or non-render subscriptions)
        data.subscribe(this.highContrastSubscriber, auth.HIGHCONTRAST);
        data.subscribe(this.cloudStatusSubscriber, `${cloud.HEADER_CLOUDSTATE}:*`);
    }

    public componentWillUnmount() {
        data.unsubscribe(this.highContrastSubscriber);
        data.unsubscribe(this.cloudStatusSubscriber);
    }

    // Add an error guard for the entire application
    componentDidCatch(error: any, info: any) {
        this.handleCriticalError(error, info);
    }

    handleCriticalError(error: any, info?: any) {
        try {
            core.killLoadingQueue();
            pxsim.U.remove(document.getElementById('loading'));
            this.setState({ hasError: true });
            // Log critical error
            pxt.tickEvent('pxt.criticalerror', { error: error || '', info: info || '' });
            // Reload the page in 2 seconds
            const lastCriticalError = pxt.storage.getLocal("lastcriticalerror") &&
                Date.parse(pxt.storage.getLocal("lastcriticalerror"));
            // don't refresh if we refreshed in the last minute
            if (!lastCriticalError || isNaN(lastCriticalError) || Date.now() - lastCriticalError > 60 * 1000) {
                pxt.storage.setLocal("lastcriticalerror", new Date().toISOString());
                setTimeout(() => {
                    this.reloadEditor();
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
            || this.updatingEditorFile
            || this.state.currFile == this.editorFile && !editorOverride) {
            if (this.state.editorPosition && this.editorFile == this.state.editorPosition.file) {
                this.editor.setViewState(this.state.editorPosition)
                this.setState({ editorPosition: undefined });
            }
            return undefined;
        }

        let simRunning = false;
        this.updatingEditorFile = true;
        return core.showLoadingAsync("updateeditorfile", lf("loading editor..."), Promise.resolve())
            .then(() => {
                simRunning = this.state.simState != SimState.Stopped;
                if (!this.state.currFile.virtual && !this.state.debugging) { // switching to serial should not reset the sim
                    this.stopSimulator();
                    if (simRunning || this.state.autoRun) {
                        simulator.setPending();
                        this.setState({ simState: SimState.Pending });
                    }
                }
                this.saveSettings();
                if (this.openingTypeScript) {
                    // File saved in saveTypeScriptAsync
                    return Promise.resolve();
                }
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
            .then(() => {
                let hc = this.getData<boolean>(auth.HIGHCONTRAST)
                return this.editor.loadFileAsync(this.editorFile, hc)
            })
            .then(() => {
                this.saveFileAsync(); // make sure state is up to date
                if (this.editor == this.textEditor || this.editor == this.blocksEditor)
                    this.typecheck();

                if (this.state.editorPosition) {
                    this.editor.setViewState(this.state.editorPosition);
                    this.setState({ editorPosition: undefined })
                } else {
                    const e = this.settings.fileHistory.find(e => e.id == this.state.header.id && e.name == this.editorFile.getName())
                    if (e)
                        this.editor.setViewState(e.pos)
                }

                container.SideDocs.notify({
                    type: "fileloaded",
                    name: this.editorFile.getName(),
                    locale: pxt.Util.localeInfo()
                } as pxsim.SimulatorFileLoadedMessage)

                if (this.state.showBlocks && this.editor == this.textEditor) this.textEditor.openBlocks();
            })
            .finally(() => {
                this.updatingEditorFile = false;
                this.preserveUndoStack = false;
                if (this.isJavaScriptActive()) {
                    this.openingTypeScript = false;
                }
                // not all editor views are really "React compliant"
                // so force an update to ensure a proper first rendering
                this.forceUpdate();
            })
            .then(() => {
                // if auto-run is not enable, restart the sim
                // otherwise, autorun will launch it again
                if (!this.state.currFile.virtual && simRunning && !this.state.autoRun)
                    this.startSimulator();
                else
                    this.typecheck(); // trigger at least 1 auto-run in non-code editors
            });
    }

    /**
     * Sets the file that is currently being edited. Warning: Do not call
     * setFile() on any `.blocks` file directly. Instead, use openBlocks()
     * which will decompile if necessary.
     * @param fn
     */
    setFile(fn: pkg.File, line?: number) {
        if (!fn) return;

        if (fn.name === pxt.MAIN_TS) {
            this.shouldTryDecompile = true;
        }

        const header = this.state.header;
        let isCodeFile = false;
        if (header) {
            const pkgId = fn.epkg && fn.epkg.getPkgId();

            if (pkgId === "this") {
                // Update the last-used editor if opening a user file
                if (this.isBlocksFile(fn.name)) {
                    header.editor = pxt.BLOCKS_PROJECT_NAME;
                    header.pubCurrent = false
                    isCodeFile = true;
                }
                else if (this.isTypescriptFile(fn.name)) {
                    header.editor = pxt.JAVASCRIPT_PROJECT_NAME
                    header.pubCurrent = false
                    isCodeFile = true;
                }
                else if (this.isPythonFile(fn.name)) {
                    header.editor = pxt.PYTHON_PROJECT_NAME
                    header.pubCurrent = false
                    isCodeFile = true;
                } else {
                    // some other file type
                }
                if (isCodeFile)
                    pkg.mainPkg.setPreferredEditor(header.editor)
            }
        }

        const state: IAppState = {
            currFile: fn,
            showBlocks: false,
            embedSimView: false,
            autoRun: this.autoRunOnStart() // restart autoRun is needed
        };
        if (line !== undefined)
            state.editorPosition = { lineNumber: line, column: 1, file: fn };
        this.setState(state)
        //this.fireResize();
    }

    setSideFile(fn: pkg.File, line?: number) {
        let fileName = fn.name;
        let currFile = this.state.currFile.name;

        const header = this.state.header;
        if (fileName != currFile && pxteditor.isBlocks(fn)) {
            // Going from ts/py -> blocks
            pxt.tickEvent("sidebar.showBlocks");
            this.openBlocks();
        } else if (header.editor != pxt.PYTHON_PROJECT_NAME && fileName.endsWith(".py")) {
            // Going from non-py -> py
            pxt.tickEvent("sidebar.showPython");
            this.openPython();
        } else if (header.editor != pxt.JAVASCRIPT_PROJECT_NAME && fileName.endsWith(".ts")) {
            // Going from non-ts -> ts
            pxt.tickEvent("sidebar.showTypescript");
            this.openJavaScript();
        } else {
            if (this.isTextEditor() || this.isPxtJsonEditor()) {
                this.textEditor.giveFocusOnLoading = false
            }

            this.setFile(fn, line)
        }
    }

    navigateToError(diag: pxtc.KsDiagnostic) {
        if (!diag) return;
        // find file
        let fn = diag.fileName;
        if (!/^(pxt_modules|built)\//.test(fn))
            fn = "this/" + fn;
        let f = pkg.mainEditorPkg().lookupFile(fn);
        if (!f) return;

        this.setSideFile(f, diag.line + 1);
    }

    removeFile(fn: pkg.File, skipConfirm = false) {
        const removeIt = () => {
            pkg.mainEditorPkg().removeFileAsync(fn.name)
                .then(() => pkg.mainEditorPkg().saveFilesAsync())
                .then(() => this.reloadHeaderAsync());
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
        }).then(res => {
            if (res) removeIt();
        })
    }

    updateFileAsync(name: string, content: string, open?: boolean): Promise<void> {
        const p = pkg.mainEditorPkg();
        return p.setContentAsync(name, content)
            .then(() => {
                if (open) this.setFile(p.lookupFile("this/" + name));
            })
            .then(() => this.reloadHeaderAsync())
    }

    isSideDocExpanded(): boolean {
        const sd = this.refs["sidedoc"] as container.SideDocs;
        return !!sd && !sd.isCollapsed();
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

    setSideDocCollapsed(shouldCollapse: boolean = true) {
        let sd = this.refs["sidedoc"] as container.SideDocs;
        if (!sd) return;
        if (shouldCollapse && this.isSideDocExpanded()) {
            sd.collapse();
        } else if (!shouldCollapse && !this.isSideDocExpanded()) {
            sd.expand();
        }
    }

    setTutorialInstructionsExpanded(value: boolean): void {
        const tutorialOptions = this.state.tutorialOptions;
        tutorialOptions.tutorialStepExpanded = value;
        tutorialOptions.autoexpandStep = value;
        this.setState(
            { tutorialOptions: tutorialOptions },
            () => {
                if (this.editor == this.blocksEditor)
                    this.blocksEditor.hideFlyout()
                else if (this.editor == this.textEditor)
                    this.textEditor.hideFlyout()
                this.setEditorOffset();
            });
    }

    setTutorialStep(step: number) {
        // save and typecheck
        this.typecheckNow();
        // Notify tutorial content pane

        this.stopPokeUserActivity();
        let tc = this.refs[ProjectView.tutorialCardId] as tutorial.TutorialCard;
        if (!this.isTutorial()) return;
        if (step > -1) {
            let tutorialOptions = this.state.tutorialOptions;
            tutorialOptions.tutorialStep = step;
            tutorialOptions.tutorialStepExpanded = false;
            this.setState({ tutorialOptions: tutorialOptions }, () => {
                this.postTutorialProgress();
                workspace.saveAsync(this.state.header);
            });
            const showHint = tutorialOptions.tutorialStepInfo[step].showHint;
            if (showHint && tc) this.showTutorialHint();

            const isCompleted = tutorialOptions.tutorialStepInfo[step].tutorialCompleted;
            if (isCompleted && pxt.commands.onTutorialCompleted) pxt.commands.onTutorialCompleted();
            // Hide flyouts and popouts
            this.editor.closeFlyout();
            if (this.textEditor.giveFocusOnLoading && this.isTextEditor()) {
                this.textEditor.editor?.focus();
            }
        }
    }

    protected postTutorialProgress() {
        const currentStep = this.state.tutorialOptions?.tutorialStep || this.state.header?.tutorialCompleted?.steps || 0;
        const totalSteps = this.state.tutorialOptions?.tutorialStepInfo?.length || this.state.header?.tutorialCompleted?.steps || 0;
        const tutorialId = this.state.tutorialOptions?.tutorial || this.state.header?.tutorialCompleted.id

        pxteditor.postHostMessageAsync({
            type: "pxthost",
            action: "tutorialevent",
            tutorialEvent: "progress",
            currentStep,
            totalSteps,
            tutorialId,
            projectHeaderId: this.state.header?.id,
            isCompleted: !!this.state.header?.tutorialCompleted
        } as pxt.editor.EditorMessageTutorialProgressEventRequest)
    }

    protected postTutorialLoaded() {
        const tutorialId = this.state.tutorialOptions?.tutorial || this.state.header?.tutorialCompleted.id

        pxteditor.postHostMessageAsync({
            type: "pxthost",
            action: "tutorialevent",
            tutorialEvent: "loaded",
            tutorialId,
            projectHeaderId: this.state.header.id
        } as pxt.editor.EditorMessageTutorialLoadedEventRequest)
    }

    protected postTutorialCompleted() {
        const tutorialId = this.state.tutorialOptions?.tutorial || this.state.header?.tutorialCompleted.id

        pxteditor.postHostMessageAsync({
            type: "pxthost",
            action: "tutorialevent",
            tutorialEvent: "completed",
            tutorialId,
            projectHeaderId: this.state.header.id
        } as pxt.editor.EditorMessageTutorialCompletedEventRequest)
    }

    protected postTutorialExit() {
        const tutorialId = this.state.tutorialOptions?.tutorial || this.state.header?.tutorialCompleted.id

        pxteditor.postHostMessageAsync({
            type: "pxthost",
            action: "tutorialevent",
            tutorialEvent: "exit",
            tutorialId,
            projectHeaderId: this.state.header.id
        } as pxt.editor.EditorMessageTutorialExitEventRequest)
    }

    handleMessage(msg: pxsim.SimulatorMessage) {
        switch (msg.type) {
            case "opendoc":
                window.open((msg as pxsim.SimulatorOpenDocMessage).url, "_blank");
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
                                    filters: {
                                        blocks: tt.toolboxSubset,
                                        defaultState: pxt.editor.FilterState.Hidden
                                    }
                                }
                            });
                            this.editor.filterToolbox(tt.showCategories);
                        }
                        let tutorialOptions = this.state.tutorialOptions;
                        tutorialOptions.tutorialReady = true;
                        tutorialOptions.tutorialStepInfo = tt.stepInfo;
                        this.setState({ tutorialOptions: tutorialOptions }, () => workspace.saveAsync(this.state.header));
                        const showHint = tutorialOptions.tutorialStepInfo[0].showHint;
                        if (showHint) this.showTutorialHint();
                        //else {
                        //    this.showLightbox();
                        //}
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
                        workspace.forceSaveAsync(curr, {})
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

    tryCheckTargetVersionAsync(targetVersion: string): Promise<void> | undefined {
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

    async loadHeaderAsync(h: pxt.workspace.Header, editorState?: pxt.editor.EditorState, tryCloudSync = true): Promise<void> {
        if (!h)
            return Promise.resolve()

        if (this.shareEditor) {
            this.shareEditor.setThumbnailFrames(undefined);
        }
        this.setState({ isMultiplayerGame: false });

        const checkAsync = this.tryCheckTargetVersionAsync(h.targetVersion);
        if (checkAsync) {
            await checkAsync;
            this.openHome();
            return;
        }

        // check our multi-tab session
        if (workspace.isHeadersSessionOutdated()) {
            // reload header before loading
            pxt.log(`multi-tab sync before load`)
            await workspace.syncAsync();
        }

        if (tryCloudSync) {
            // Try a quick cloud fetch. If it doesn't complete within X second(s),
            // continue on.
            const TIMEOUT_MS = 15000;
            const timeoutStart = Util.nowSeconds();
            let timedOut = false;
            await Promise.race([
                pxt.U.delay(TIMEOUT_MS)
                    .then(() => {
                        timedOut = true
                    }),
                cloud.syncAsync({ hdrs: [h], direction: "down" })
                    .then(changes => {
                        if (changes.length) {
                            const elapsed = Util.nowSeconds() - timeoutStart;
                            if (timedOut) {
                                // We are too late; the editor has already been loaded.
                                // Call the onChanges handler to update the editor.
                                pxt.tickEvent(`identity.syncOnProjectOpen.timedout`, { 'elapsedSec': elapsed })
                                if (changes.some(header => header.id === h.id)) {
                                    cloud.forceReloadForCloudSync()
                                }
                            } else {
                                // We're not too late, update the local var so that the
                                // first load has the new info.
                                pxt.tickEvent(`identity.syncOnProjectOpen.syncSuccess`, { 'elapsedSec': elapsed })
                                h = workspace.getHeader(h.id)
                            }
                        }
                    })
            ]);
        }

        if (h) {
            workspace.acquireHeaderSession(h);
            await this.internalLoadHeaderAsync(h, editorState);
        }
    }

    private async internalLoadHeaderAsync(h: pxt.workspace.Header, editorState?: pxt.editor.EditorState): Promise<void> {
        pxt.debug(`loading ${h.id} (pxt v${h.targetVersion})`);
        this.stopSimulator(true);
        if (pxt.appTarget.simulator && pxt.appTarget.simulator.aspectRatio) {
            simulator.driver.preload(pxt.appTarget.simulator.aspectRatio);
        }

        this.clearSerial();
        this.firstRun = true;
        // clear caches in all editors -> compiler.newProjectAsync
        this.allEditors.forEach(editor => editor.clearCaches());
        // always start simulator once at least if autoRun is enabled
        // always disable tracing
        this.setState({
            autoRun: this.autoRunOnStart(),
            tracing: undefined
        });

        // Merge current and new state but only if the new state members are undefined
        const oldEditorState = this.state.editorState;
        if (oldEditorState && editorState) {
            if (editorState.filters === undefined) editorState.filters = oldEditorState.filters;
            if (editorState.hasCategories === undefined) editorState.hasCategories = oldEditorState.hasCategories;
            if (editorState.searchBar === undefined) editorState.searchBar = oldEditorState.searchBar;
        }

        // If user is signed in, sync this project to the cloud.
        if (this.hasCloudSync()) {
            h.cloudUserId = this.getUserProfile()?.id;
        }

        try {
            await compiler.newProjectAsync();

            if (h.backupRef) {
                await workspace.restoreFromBackupAsync(h);
            }
            await pkg.loadPkgAsync(h.id);

            if (!this.state || this.state.header != h) {
                this.showPackageErrorsOnNextTypecheck();
            }
            simulator.setDirty();

            await compiler.applyUpgradesAsync();

            await this.loadTutorialJresCodeAsync();
            await this.loadTutorialCustomTsAsync();
            await this.loadTutorialTemplateCodeAsync();
            await this.loadTutorialBlockConfigsAsync();

            const main = pkg.getEditorPkg(pkg.mainPkg);

            // override preferred editor if specified
            if (pkg.mainPkg.config.preferredEditor) {
                h.editor = pkg.mainPkg.config.preferredEditor
            }

            let file = main.getMainFile();

            const e = h.editor != pxt.BLOCKS_PROJECT_NAME && this.settings.fileHistory.filter(e => e.id == h.id)[0];
            if (e) {
                const lastEdited = main.lookupFile(e.name);

                if (lastEdited) {
                    file = lastEdited;
                }
                else if (pkg.getExtensionOfFileName(e.name) === "ts") {
                    file = main.lookupFile("this/" + file.getFileNameWithExtension("ts")) || file;
                }
                else if (pkg.getExtensionOfFileName(e.name) === "py") {
                    file = main.lookupFile("this/" + file.getFileNameWithExtension("py")) || file;
                }
            }

            // keep header name in sync with any changes in pxt.json
            // for example when cloud sync changes update pxt.json
            const name = pkg.mainPkg.config.name;
            h.name = name || lf("Untitled");

            // no history entry, and there is a virtual file for the current file in the language recorded in the header
            if ((!e && h.editor && file.getVirtualFileName(h.editor))) {
                file = main.lookupFile("this/" + file.getVirtualFileName(h.editor)) || file;
            }

            if (pxteditor.isBlocks(file) && !file.content) {
                if (!file.content) {
                    // empty blocks file, open javascript editor
                    file = main.lookupFile("this/" + file.getVirtualFileName(pxt.JAVASCRIPT_PROJECT_NAME)) || file;
                }
            }

            // override inferred editor with tutorial editor if present in markdown
            const tutorialPreferredEditor = h.tutorial?.metadata?.preferredEditor;
            if (tutorialPreferredEditor) {
                let fileName  = "this/" + filenameForEditor(tutorialPreferredEditor);
                file = main.lookupFile(fileName);

                // If the preferred file does not exist, create it.
                if (!file) {
                    file = main.setFile(fileName, '\n');

                    pkg.mainPkg.config.files.push(fileName);
                    pkg.mainPkg.saveConfig();
                }
            }

            if (file.name === pxt.MAIN_TS) {
                this.shouldTryDecompile = true;
            }

            this.setState({
                home: false,
                showFiles: h.githubId ? true : false,
                editorState: editorState,
                tutorialOptions: h.tutorial,
                header: h,
                projectName: h.name,
                currFile: file,
                sideDocsLoadUrl: '',
                debugging: false,
                isMultiplayerGame: false
            });

            pkg.getEditorPkg(pkg.mainPkg).onupdate = () => {
                this.loadHeaderAsync(h, this.state.editorState);
            }

            /* await */ pkg.mainPkg.getCompileOptionsAsync()
                .catch(e => {
                    if (e instanceof pxt.cpp.PkgConflictError) {
                        const confl = e as pxt.cpp.PkgConflictError
                        const remove = (lib: pxt.Package) => ({
                            label: lf("Remove {0}", lib.id),
                            class: "pink", // don't make them red and scary
                            icon: "trash",
                            onclick: async () => {
                                core.showLoading("removedep", lf("Removing {0}...", lib.id))
                                try {
                                    await pkg.mainEditorPkg().removeDepAsync(lib.id);
                                    await this.reloadHeaderAsync();
                                }
                                finally {
                                    core.hideLoading("removedep")
                                }
                            }
                        })
                        /* await */ core.dialogAsync({
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
                });

            // load side docs
            const editorForFile = this.pickEditorFor(file);
            const documentation = pkg?.mainPkg?.config?.documentation;
            if (documentation) {
                this.setSideDoc(documentation, editorForFile == this.blocksEditor);
            }
            else {
                const readme = main.lookupFile("this/README.md");
                const readmeContent = readme?.content?.trim();
                // no auto-popup when editing packages locally
                // ### @autoOpen false
                if (!h.githubId && readmeContent && !/#{2,}\s+@autoOpen\s+false\s*/i.test(readmeContent)) {
                    this.setSideMarkdown(readme.content);
                }
            }

            // update recentUse on the header
            await workspace.saveAsync(h);
            await this.loadTutorialFiltersAsync();
        }
        finally {
            // Editor is loaded
            pxt.BrowserUtils.changeHash("#editor", true);
            // Clear the focus.
            document.getElementById("root").focus();
            /* await */ cmds.maybeReconnectAsync(false, true);
            this.editorLoaded();
        }
    }

    private async loadTutorialFiltersAsync(): Promise<void> {
        const header = pkg.mainEditorPkg().header;
        if (!header || !header.tutorial || !header.tutorial.tutorialMd) {
            return;
        }

        pxt.perf.measureStart("loadTutorial loadBlockly")

        const t = header.tutorial;

        const skipTutorialInfoCache = /notutorialinfocache=1/i.test(window.location.href);

        if (typeof t.tutorialCode === "string") {
            t.tutorialCode = [t.tutorialCode];
        }

        try {
            await this.loadBlocklyAsync();
            const tutorialBlocks = await tutorial.getUsedBlocksAsync(t.tutorialCode, t.tutorial, t.language, skipTutorialInfoCache);
            let editorState: pxt.editor.EditorState = {
            }

            if (tutorialBlocks?.usedBlocks && Object.keys(tutorialBlocks.usedBlocks).length > 0) {
                editorState.filters = {
                    blocks: tutorialBlocks.usedBlocks,
                    defaultState: pxt.editor.FilterState.Hidden
                }
                editorState.hasCategories = !(header.tutorial.metadata && header.tutorial.metadata.flyoutOnly);
            }
            this.setState({ editorState: editorState });
            this.editor.filterToolbox(true);
            const stepInfo = t.tutorialStepInfo;
            const showHint = stepInfo[header.tutorial.tutorialStep].showHint;
            if (showHint) this.showTutorialHint();
            //else this.showLightbox();
        }
        catch (e) {
            // Failed to decompile
            pxt.tickEvent('tutorial.faileddecompile', { tutorial: t.tutorial });
            this.setState({ editorState: { filters: undefined } });
            core.warningNotification(lf("Could not filter tutorial blocks, displaying full toolbox."))
        }
        finally {
            pxt.perf.measureEnd("loadTutorial loadBlockly")
        }
    }

    private async loadTutorialBlockConfigsAsync(): Promise<void> {
        const resolveBlockConfigAsync = async (blockConfig: pxt.tutorial.TutorialBlockConfig): Promise<void> => {
            blockConfig.blocks = [];
            const blocks: Element[] = [];
            try {
                // Decompile block markdown to xml
                const decomp = await compiler.decompileBlocksSnippetAsync(blockConfig.md, undefined, {
                    snippetMode: true,
                    generateSourceMap: false
                });
                const xml = decomp.outfiles[pxt.MAIN_BLOCKS];
                pxt.debug(`decompiled ${blockConfig.md} to ${xml}`);
                // Get all top-level blocks
                (() => {
                    const dom = Blockly.utils.xml.textToDom(xml);
                    const children = Array.from(dom.children);
                    for (const child of children) {
                        if (child.nodeName === "block") {
                            blocks.push(child);
                        }
                    }
                })();
                // Extract child blocks from blocks of type "next", and discard the "next" block
                (() => {
                    for (const block of blocks) {
                        const children = Array.from(block.children);
                        for (const child1 of children) {
                            if (child1.nodeName === "next") {
                                for (const child2 of Array.from(child1.children)) {
                                    // Grab the blocks embedded in the "next" block
                                    blocks.push(child2);
                                }
                                block.removeChild(child1);
                            }
                        }
                    }
                })();
            } catch (e) {
                // Failed to decompile, don't propagate exception
                pxt.error(`Failed to resolve blockconfig for tutorial: ${header.tutorial.tutorialName}, ${e.message}. md:${blockConfig.md}`);
            }

            for (const block of blocks) {
                try {
                    const entry: pxt.tutorial.TutorialBlockConfigEntry = {};
                    const blockType = block.getAttribute("type");
                    switch (blockType) {
                        case "typescript_statement": {
                            // Decompiled to gray block
                            throw new Error("Block config decompiled to gray block: " + Blockly.Xml.domToText(block));
                        }
                        case "variables_set":
                        case "variables_change": {
                            // get block id from within variables_set context
                            const value = Array.from(block.children).find(child => child.tagName === "value");
                            const rhs = Array.from(value.children).find(child => child.tagName === "block");
                            entry.blockId = rhs.getAttribute("type");
                            break;
                        }
                        default: {
                            // Set block id from root type
                            entry.blockId = blockType;
                        }
                    }
                    entry.xml =
                        Blockly.Xml.domToText(block)
                        .replace(/^<xml[^>]*>\n*/i, '')
                        .replace(/\n*<\/xml>\n*$/i, '');
                    blockConfig.blocks.push(entry);
                } catch (e) {
                    // Failed to resolve block, don't propagate exception
                    pxt.error(`Failed to resolve blockconfig for tutorial: ${header.tutorial.tutorialName}. ${e.message}`);
                }
            }
        };
        const header = pkg.mainEditorPkg().header;
        if (!header || !header.tutorial || !header.tutorial.tutorialStepInfo) {
            return;
        }
        // Check for preexisting block configs at global scope
        if (header.tutorial.globalBlockConfig?.blocks?.length) {
            // Global block config already populated (project was loaded from a previous save)
            return;
        }
        const stepInfo = header.tutorial.tutorialStepInfo;
        // Check for preexisting block configs at local scope
        for (const step of stepInfo) {
            if (step.localBlockConfig?.blocks?.length) {
                // Local block config already populated (project was loaded from a previous save)
                return;
            }
        }
        const tasks: Promise<void>[] = [];
        if (header.tutorial.globalBlockConfig?.md) {
            tasks.push(resolveBlockConfigAsync(header.tutorial.globalBlockConfig));
        }
        stepInfo
            .map(step => step.localBlockConfig)
            .filter(blockConfig => blockConfig?.md)
            .forEach(blockConfig => tasks.push(resolveBlockConfigAsync(blockConfig)));
        await Promise.all(tasks);
    }

    private async loadTutorialTemplateCodeAsync(): Promise<void> {
        const header = pkg.mainEditorPkg().header;
        if (!header || !header.tutorial) {
            return;
        }
        else if (!header.tutorial.templateCode || header.tutorial.templateLoaded) {
            if (header.tutorial.mergeCarryoverCode && header.tutorial.mergeHeaderId) {
                pxt.warn(lf("Refusing to carry code between tutorials because the loaded tutorial \"{0}\" does not contain a template code block.", header.tutorial.tutorial));
            }
            return;
        }

        const template = header.tutorial.templateCode;

        // Mark that the template has been loaded so that we don't overwrite the
        // user code if the tutorial is re-opened
        header.tutorial.templateLoaded = true;
        let currentText = await workspace.getTextAsync(header.id);

        // If we're starting in the asset editor, always load into TS
        const preferredEditor = header.tutorial.metadata?.preferredEditor;
        if (preferredEditor && filenameForEditor(preferredEditor) === pxt.ASSETS_FILE) {
            currentText[pxt.MAIN_TS] = template;
        }

        const projectname = projectNameForEditor(preferredEditor || header.editor);

        if (projectname === pxt.PYTHON_PROJECT_NAME && header.tutorial.templateLanguage === "python") {
            currentText[pxt.MAIN_PY] = template;
        }
        else if (projectname === pxt.JAVASCRIPT_PROJECT_NAME) {
            currentText[pxt.MAIN_TS] = template;
        }
        else if (projectname === pxt.PYTHON_PROJECT_NAME) {
            const pyCode = await compiler.decompilePythonSnippetAsync(template)
            if (pyCode) {
                currentText[pxt.MAIN_PY] = pyCode;
            }
        }
        else {
            const resp = await compiler.decompileBlocksSnippetAsync(template)
            const blockXML = resp.outfiles[pxt.MAIN_BLOCKS];
            if (blockXML) {
                currentText[pxt.MAIN_BLOCKS] = blockXML
            }
        }

        let newText = currentText;
        if (header.tutorial.mergeHeaderId) {
            const previousHeader = workspace.getHeader(header.tutorial.mergeHeaderId);
            if (previousHeader) {
                const previousText = await workspace.getTextAsync(previousHeader.id);
                newText = mergeProjectCode(previousText, currentText, !!header.tutorial.mergeCarryoverCode);
            }
        }

        let updateConfig = false;
        for (const file of Object.keys(newText)) {
            if (newText[file] !== undefined) {
                pkg.mainEditorPkg().setFile(file, newText[file]);

                if (pkg.mainPkg.config.files.indexOf(file) < 0) {
                    updateConfig = true;
                    pkg.mainPkg.config.files.push(file);
                }
            }
        }

        if (updateConfig) {
             pkg.mainPkg.saveConfig();
        }

        await workspace.saveAsync(header);

        let parsedTilemap: any;
        let parsedImage: any;

        try {
            parsedTilemap = newText[pxt.TILEMAP_JRES] ? JSON.parse(newText[pxt.TILEMAP_JRES]) : null;
            parsedImage = newText[pxt.IMAGES_JRES] ? JSON.parse(newText[pxt.IMAGES_JRES]) : null;
        }
        catch (e) {
            return Promise.reject(e);
        }

        const project = pxt.react.getTilemapProject();
        if (parsedTilemap) {
            project.loadTilemapJRes(pxt.inflateJRes(parsedTilemap), true);
        }
        if (parsedImage) {
            project.loadAssetsJRes(pxt.inflateJRes(parsedImage));
        }

        await pkg.mainEditorPkg().buildAssetsAsync();
        await pkg.mainEditorPkg().saveFilesAsync();
    }

    private async loadTutorialJresCodeAsync(): Promise<void> {
        const header = pkg.mainEditorPkg().header;
        if (!header || !header.tutorial || !(header.tutorial.jres || header.tutorial.assetFiles)) {
            return;
        }

        const tilemapJRes = header.tutorial.jres || header.tutorial.assetFiles?.[pxt.TILEMAP_JRES];
        const imageJRes = header.tutorial.assetFiles?.[pxt.IMAGES_JRES];

        // Delete from the header so that we don't double-load the tiles into
        // the project if the project gets reloaded
        delete header.tutorial.jres;
        delete header.tutorial.assetFiles;

        let parsedTilemap: any;
        let parsedImage: any;

        try {
            parsedTilemap = tilemapJRes ? JSON.parse(tilemapJRes) : null;
            parsedImage = imageJRes ? JSON.parse(imageJRes) : null;
        }
        catch (e) {
            return Promise.reject(e);
        }

        const project = pxt.react.getTilemapProject();
        if (parsedTilemap) {
            project.loadTilemapJRes(pxt.inflateJRes(parsedTilemap), true);
        }
        if (parsedImage) {
            project.loadAssetsJRes(pxt.inflateJRes(parsedImage));
        }

        await pkg.mainEditorPkg().buildAssetsAsync();
    }

    private async loadTutorialCustomTsAsync(): Promise<void> {
        const mainPkg = pkg.mainEditorPkg();
        const header = mainPkg.header;
        if (!header || !header.tutorial || !header.tutorial.customTs)
            return Promise.resolve();

        const customTs = header.tutorial.customTs;
        await mainPkg.setContentAsync(pxt.TUTORIAL_CUSTOM_TS, customTs);
        await mainPkg.saveFilesAsync();
        return Promise.resolve();
    }

    async resetTutorialTemplateCode(keepAssets: boolean): Promise<void> {
        const mainPkg = pkg.mainEditorPkg();
        const header = mainPkg.header;
        if (!header?.tutorial?.templateCode) return;

        if (keepAssets) {
            // Convert all temporary assets to named assets before we load in the template
            let currentText = await workspace.getTextAsync(header.id);
            const imageJres = appendTemporaryAssets(currentText[pxt.MAIN_BLOCKS], currentText[pxt.IMAGES_JRES]);
            pkg.mainEditorPkg().setFile(pxt.IMAGES_JRES, imageJres);
            await mainPkg.saveFilesAsync();
        }

        header.tutorial.templateLoaded = false;
        delete header.tutorial.mergeHeaderId;
        await this.reloadHeaderAsync();
    }

    removeProject() {
        if (!pkg.mainEditorPkg().header) return;

        core.confirmDelete(pkg.mainEditorPkg().header.name, () => {
            let curr = pkg.mainEditorPkg().header
            curr.isDeleted = true
            return workspace.forceSaveAsync(curr, {})
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

    isZipFile(filename: string): boolean {
        return /\.zip$/i.test(filename)
    }

    importProjectCoreAsync(buf: Uint8Array, options?: pxt.editor.ImportFileOptions) {
        return (buf[0] == '{'.charCodeAt(0) ?
            Promise.resolve(pxt.U.uint8ArrayToString(buf)) :
            pxt.lzmaDecompressAsync(buf))
            .then(contents => {
                let parsedContents = JSON.parse(contents);
                if (parsedContents.target && parsedContents.target == pxt.appTarget.id) {
                    let blockSnippet = parsedContents as pxtblockly.BlockSnippet;
                    blockSnippet.xml.forEach(xml => {
                        let text = pxt.Util.htmlUnescape(xml.replace(/^"|"$/g, ""));
                        pxtblockly.loadBlocksXml(this.blocksEditor.editor, text)
                    })
                } else {
                    let data = parsedContents as pxt.cpp.HexFile;
                    this.importHex(data, options);
                }
            }).catch(e => {
                core.warningNotification(lf("Sorry, we could not import this project or block snippet."))
                this.openHome();
            });
    }

    importHexFile(file: File, options?: pxt.editor.ImportFileOptions) {
        if (!file) return;
        pxt.cpp.unpackSourceFromHexFileAsync(file)
            .then(data => this.importHex(data, options))
            .catch(e => {
                pxt.reportException(e);
                core.warningNotification(lf("Sorry, we could not recognize this file."))
            });
    }

    importBlocksFiles(file: File, options?: pxt.editor.ImportFileOptions) {
        if (!file) return;
        ts.pxtc.Util.fileReadAsTextAsync(file)
            .then(contents => {
                this.newProject({
                    filesOverride: { [pxt.MAIN_BLOCKS]: contents, [pxt.MAIN_TS]: "  " },
                    name: file.name.replace(/\.blocks$/i, '') || lf("Untitled")
                })
            })
    }

    importTypescriptFile(file: File, options?: pxt.editor.ImportFileOptions) {
        if (!file) return;
        ts.pxtc.Util.fileReadAsTextAsync(file)
            .then(contents => {
                this.newProject({
                    filesOverride: { [pxt.MAIN_BLOCKS]: '', [pxt.MAIN_TS]: contents || "  " },
                    name: file.name.replace(/\.ts$/i, '') || lf("Untitled")
                })
            })
    }

    importProjectFile(file: File, options?: pxt.editor.ImportFileOptions) {
        if (!file) return;
        ts.pxtc.Util.fileReadAsBufferAsync(file)
            .then(buf => this.importProjectCoreAsync(buf, options))
    }

    importPNGFile(file: File, options?: pxt.editor.ImportFileOptions) {
        if (!file) return;
        ts.pxtc.Util.fileReadAsBufferAsync(file)
            .then(buf => pxt.Util.decodeBlobAsync("data:image/png;base64," +
                btoa(pxt.Util.uint8ArrayToString(buf))))
            .then(buf => this.importProjectCoreAsync(buf, options))
    }

   async importZipFileAsync(file: File, options?: pxt.editor.ImportFileOptions) {
        if (!file) return;
        pxt.tickEvent("import.zip");

        await scriptmanager.loadZipAsync();
        const reader = new zip.ZipReader(new zip.BlobReader(file));

        const zippedFiles = (await reader.getEntries()).filter((zipped: any) => this.isProjectFile(zipped.filename));
        let progress = {
            done: 0
        }

        if (zippedFiles.length === 0) {
            core.warningNotification(lf("No projects available to import found inside zip file."));
            return;
        }

        const confirmed = await core.confirmAsync({
            header: lf("Import zip file?"),
            body: lf("Do you want to import all projects in this zip file? This will import {0} projects.", zippedFiles.length),
            agreeLbl: lf("Okay"),
            hasCloseIcon: true,
        });

        if (!confirmed) return;

        let cancelled = false;

        core.dialogAsync({
            header: lf("Extracting files..."),
            jsxd: () => <dialogs.ProgressBar percentage={100 * (progress.done / zippedFiles.length)} />,
            onClose: () => cancelled = true
        })

        for (const zipped of zippedFiles) {
            try {
                const buf: Uint8Array = await zipped.getData(new zip.Uint8ArrayWriter());

                const data = JSON.parse(await pxt.lzmaDecompressAsync(buf)) as pxt.cpp.HexFile;

                let h: pxt.workspace.InstallHeader = {
                    target: pxt.appTarget.id,
                    targetVersion: data.meta.targetVersions ? data.meta.targetVersions.target : undefined,
                    editor: data.meta.editor,
                    name: data.meta.name,
                    meta: {},
                    pubId: "",
                    pubCurrent: false
                }

                const files = JSON.parse(data.source) as pxt.Map<string>;
                await workspace.installAsync(h, files);
            }
            catch (e) {

            }

            if (cancelled) break;
            progress.done ++;
            core.forceUpdate();
        }

        core.hideDialog();
    }

    importPNGBuffer(buf: ArrayBuffer) {
        pxt.Util.decodeBlobAsync("data:image/png;base64," +
            btoa(pxt.Util.uint8ArrayToString(new Uint8Array(buf))))
            .then(buf => this.importProjectCoreAsync(buf));
    }

    importAssetFile(file: File) {
        ts.pxtc.Util.fileReadAsBufferAsync(file)
            .then(buf => {
                let basename = file.name.replace(/.*[\/\\]/, "")
                return pkg.mainEditorPkg().saveAssetAsync(basename, buf)
            });
    }

    importHex(data: pxt.cpp.HexFile, options?: pxt.editor.ImportFileOptions) {
        if (!data || !data.meta) {
            if (data && (data as any)[pxt.CONFIG_NAME]) {
                data = cloudsync.reconstructMeta(data as any)
            } else {
                core.warningNotification(lf("Sorry, we could not recognize this file."))
                if (options && options.openHomeIfFailed) this.openHome();
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
                checkAsync.then(() => {
                    if (options && options.openHomeIfFailed) this.newProject();
                });
                return;
            }
        }

        if (options && options.extension) {
            pxt.tickEvent("import.extension");
            const files = ts.pxtc.Util.jsonTryParse(data.source);
            if (files) {
                const n = data.meta.name;
                const fn = `${data.meta.name}.json`;
                // insert file into package
                const mpkg = pkg.mainEditorPkg();
                if (mpkg) {
                    pxt.debug(`adding ${fn} to package`);
                    // save file
                    mpkg.setContentAsync(fn, data.source)
                        .then(() => mpkg.updateConfigAsync(cfg => {
                            if (!cfg.dependencies)
                                cfg.dependencies = {};
                            cfg.dependencies[n] = `pkg:${fn}`;
                        }))
                        .then(() => this.reloadHeaderAsync());
                }
            }
            return;
        }

        const importer = this.hexFileImporters.filter(fi => fi.canImport(data))[0];
        if (importer) {
            pxt.tickEvent("import", { id: importer.id });
            core.hideDialog();
            core.showLoading("importhex", lf("loading project..."))
            pxteditor.initEditorExtensionsAsync()
                .then(() => importer.importAsync(this, data)
                    .then(() => core.hideLoading("importhex"), e => {
                        pxt.reportException(e, { importer: importer.id });
                        core.hideLoading("importhex");
                        core.errorNotification(lf("Oops, something went wrong when importing your project"));
                        if (options && options.openHomeIfFailed) this.openHome();
                    }));
        }
        else {
            core.warningNotification(lf("Sorry, we could not import this project."))
            pxt.tickEvent("warning.importfailed");
            if (options && options.openHomeIfFailed) this.openHome();
        }
    }

    async importProjectAsync(project: pxt.workspace.Project, editorState?: pxt.editor.EditorState): Promise<void> {
        if (this.pendingImport) {
            this.pendingImport.reject("concurrent import requests");
        }

        this.pendingImport = pxt.Util.defer<void>();

        try {
            await Promise.all([
                this.installAndLoadProjectAsync(project, editorState),
                this.pendingImport.promise
            ]);
        }
        finally {
            this.pendingImport = undefined;
        }
    }

    protected async installAndLoadProjectAsync(project: pxt.workspace.Project, editorState?: pxt.editor.EditorState) {
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

        const installed = await workspace.installAsync(h, project.text);
        await this.loadHeaderAsync(installed, editorState);
    }

    importTutorialAsync(md: string) {
        try {
            const { options, editor } = pxt.tutorial.getTutorialOptions(md, "untitled", "untitled", "", false);
            const dependencies = pxt.gallery.parsePackagesFromMarkdown(md);
            this.hintManager.clearViewedHints();

            return this.createProjectAsync({
                name: "untitled",
                tutorial: options,
                preferredEditor: editor,
                dependencies
            });
        }
        catch (e) {
            Util.userError(lf("Could not import tutorial"));
            return Promise.reject(e);
        }
    }

    async importSkillmapProjectAsync(headerId: string) {
        // First check for a legacy project that hasn't been imported yet
        const skillmapWorkspace = new pxt.skillmap.IndexedDBWorkspace();
        await skillmapWorkspace.initAsync();
        const project = await skillmapWorkspace.getProjectAsync(headerId);

        if (project && !project.deleted) {
            if (project.header.tutorial) {
                project.header.tutorialCompleted = {
                    id: project.header.tutorial.tutorial,
                    steps: project.header.tutorial.tutorialStepInfo.length
                };
                delete project.header.tutorial;
            }
            return this.installAndLoadProjectAsync(project);
        }

        // If it's not a legacy project, it should be in the local workspace.
        // Duplicate it into a non-skillmap project
        const header = workspace.getHeader(headerId);

        if (!header) {
            Util.userError(lf("Unable to import skillmap project"));
            return;
        }

        const newHeader = await workspace.duplicateAsync(header);
        if (newHeader.tutorial) {
            newHeader.tutorialCompleted = {
                id: newHeader.tutorial.tutorial,
                steps: newHeader.tutorial.tutorialStepInfo.length
            };
            delete newHeader.tutorial;
        }

        newHeader.isSkillmapProject = false;
        await workspace.saveAsync(newHeader);
        data.invalidate("headers:");
        await this.loadHeaderAsync(newHeader)
    }

    async importEmbedProjectAsync(importId: string) {
        const project = await pxteditor.importDb.removeProjectAsync(importId);

        if (project) {
            return this.installAndLoadProjectAsync(project);
        }
        else {
            Util.userError(lf("Unable to import project"));
        }
    }

    openProjectByHeaderIdAsync(headerId: string) {
        const header = workspace.getHeader(headerId);
        return this.loadHeaderAsync(header);
    }

    initDragAndDrop() {
        draganddrop.setupDragAndDrop(document.body,
            file => file.size < 1000000 && this.isHexFile(file.name) || this.isBlocksFile(file.name) || this.isZipFile(file.name),
            files => {
                if (files) {
                    pxt.tickEvent("dragandrop.open")
                    this.importFile(files[0]);
                }
            },
            url => {
                if (this.isPNGFile(url)) {
                    pxt.Util.httpRequestCoreAsync({
                        url,
                        method: "GET",
                        responseArrayBuffer: true
                    }).then(resp => this.importUri(url, resp.buffer))
                        .catch(e => core.handleNetworkError(e));
                }
            }
        );
    }

    importUri(url: string, buf: ArrayBuffer) {
        if (this.isPNGFile(url)) {
            this.importPNGBuffer(buf);
        } else {
            // ignore
        }
    }

    importFile(file: File, options?: pxt.editor.ImportFileOptions) {
        if (!file || pxt.shell.isReadOnly()) return;
        if (this.isHexFile(file.name)) {
            this.importHexFile(file, options)
        } else if (this.isBlocksFile(file.name)) {
            this.importBlocksFiles(file, options)
        } else if (this.isTypescriptFile(file.name)) {
            this.importTypescriptFile(file, options);
        } else if (this.isProjectFile(file.name)) {
            this.importProjectFile(file, options);
        } else if (this.isAssetFile(file.name)) {
            // assets need to go before PNG source import below, since target might want PNG assets
            this.importAssetFile(file)
        } else if (this.isPNGFile(file.name)) {
            this.importPNGFile(file, options);
        } else if (this.isZipFile(file.name)) {
            this.importZipFileAsync(file, options);
        } else {
            const importer = this.resourceImporters.filter(fi => fi.canImport(file))[0];
            if (importer) {
                importer.importAsync(this, file);
            } else {
                core.warningNotification(lf("Oops, don't know how to load this file!"));
            }
        }
    }

    importProjectFromFileAsync(buf: Uint8Array, options?: pxt.editor.ImportFileOptions): Promise<void> {
        return pxt.lzmaDecompressAsync(buf)
            .then((project) => {
                let hexFile = JSON.parse(project) as pxt.cpp.HexFile;
                return this.importHex(hexFile, options);
            }).catch(() => {
                return this.newProject();
            })
    }

    ///////////////////////////////////////////////////////////
    ////////////           Export                 /////////////
    ///////////////////////////////////////////////////////////

    syncPreferredEditor() {
        const pe = this.getPreferredEditor();
        if (pe)
            pkg.mainPkg.setPreferredEditor(pe);
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

    pushScreenshotHandler = (handler: (msg: pxt.editor.ScreenshotData) => void): void => {
        this.screenshotHandlers.push(handler);
    }
    popScreenshotHandler = (): void => {
        this.screenshotHandlers.pop();
    }

    requestScreenshotPromise: Promise<string>;
    requestScreenshotAsync(): Promise<string> {
        if (this.requestScreenshotPromise)
            return this.requestScreenshotPromise;

        // make sure simulator is ready
        this.setState({ screenshoting: true });
        simulator.driver.postMessage({ type: "screenshot" } as pxsim.SimulatorScreenshotMessage);

        return Util.promiseTimeout(1000, this.requestScreenshotPromise = new Promise<string>((resolve, reject) => {
            this.pushScreenshotHandler(msg => resolve(pxt.BrowserUtils.imageDataToPNG(msg.data, 3)));
        })) // simulator might be stopped or in bad shape
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
                                        <br />
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
            pxt.BrowserUtils.browserDownloadText(mpkg.readFile(pxt.MAIN_BLOCKS), pkg.genFileName(".blocks"), { contentType: 'application/xml' });
            return Promise.resolve();
        }
        if (saveTutorialTemplate()) {
            return this.saveTutorialTemplateAsync();
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
                pxt.BrowserUtils.browserDownloadUInt8Array(buf, fn, { contentType: 'application/octet-stream' });
            })
    }

    ///////////////////////////////////////////////////////////
    ////////////             Home                 /////////////
    ///////////////////////////////////////////////////////////

    openHome() {
        const hasHome = !pxt.shell.isControllerMode()
            && !pxt.appTarget.appTheme.lockedEditor;
        if (!hasHome) return;

        this.unloadProjectAsync(true)
    }

    private homeLoaded() {
        pxt.tickEvent('app.home');
    }

    private editorLoaded() {
        pxt.tickEvent('app.editor');
    }

    unloadProjectAsync(home?: boolean) {
        this.stopSimulator(true); // don't keep simulator around
        this.showKeymap(false); // close keymap if open
        cmds.disconnectAsync(); // turn off any kind of logging
        if (this.editor) this.editor.unloadFileAsync();
        this.extensions.unload();
        this.editorFile = undefined;

        if (home) {
            // clear the hash
            pxt.BrowserUtils.changeHash("", true);
        }
        return this.setStateAsync({
            home: home !== undefined ? home : this.state.home,
            tracing: undefined,
            fullscreen: undefined,
            tutorialOptions: undefined,
            editorState: undefined,
            debugging: undefined,
            header: undefined,
            currFile: undefined,
            fileState: undefined
        }).then(() => {
            this.allEditors.forEach(e => e.setVisible(false));

            if (home) {
                this.homeLoaded();
                this.showPackageErrorsOnNextTypecheck();
            }
            return workspace.syncAsync();
        })
            .then(() => { })
    }

    reloadEditor() {
        try {
            // Prevent us from stripping out the hash before the reload is complete
            clearHashChange();
            // On embedded pages, preserve the loaded project
            if (hash && ((pxt.BrowserUtils.isIFrame() && (hash.cmd === "pub" || hash.cmd === "sandbox")) || hash.cmd == "tutorial")) {
                location.hash = `#${hash.cmd}:${hash.arg}`;
            }
            else if (this.state?.home) {
                location.hash = "#reload";
            }
            // if in editor, reload project
            else if (this.state?.header && !this.state.header.isDeleted) {
                location.hash = "#editor"
            }

            if (pxt.BrowserUtils.isIFrame() && !pxt.BrowserUtils.getCookieLang()) {
                // Include language in the refreshed page to persist refreshes
                // when cookies not allowed
                const lang = pxt.Util.userLanguage();
                const params = new URLSearchParams(location.search);
                params.set("lang", lang);
                const hcParamSet = !!params.get("hc");
                const hc = !!core.getHighContrastOnce();
                if (hc != hcParamSet) {
                    if (hc) params.set("hc", "1");
                    else params.delete("hc");
                }
                location.search = params.toString();
                // .reload refreshes without hitting server so it loses the params,
                // so have to navigate directly
                location.assign(location.toString());
            } else {
                location.reload();
            }
        } catch (e) {
            pxt.reportException(e);
            location.reload();
        }
    }

    getPreferredEditor(): string {
        if (this.editor == this.blocksEditor)
            return pxt.BLOCKS_PROJECT_NAME

        if (this.editor == this.textEditor) {
            switch (this.textEditor.fileType) {
                case pxt.editor.FileType.Python:
                    return pxt.PYTHON_PROJECT_NAME;
                default:
                    return pxt.JAVASCRIPT_PROJECT_NAME;
            }
        }

        // no preferred editor
        return undefined;
    }

    ///////////////////////////////////////////////////////////
    ////////////           Extentions             /////////////
    ///////////////////////////////////////////////////////////

    openExtension(extension: string, url: string) {
        pxt.tickEvent("app.openextension", { extension });
        this.extensions.showExtensionAsync(extension, url);
    }

    handleExtensionRequest(request: pxt.editor.ExtensionRequest): void {
        this.extensions.handleExtensionRequest(request);
    }

    ///////////////////////////////////////////////////////////
    ////////////           Workspace              /////////////
    ///////////////////////////////////////////////////////////

    newEmptyProject(name?: string, documentation?: string, preferredEditor?: string) {
        this.newProject({
            filesOverride: { [pxt.MAIN_BLOCKS]: `<xml xmlns="http://www.w3.org/1999/xhtml"></xml>` },
            name,
            documentation,
            preferredEditor,
            filters: {}
        })
    }

    newProject(options: ProjectCreationOptions = {}) {
        pxt.tickEvent("app.newproject");
        core.showLoading("newproject", lf("creating new project..."));
        return this.createProjectAsync(options)
            .then(() => this.autoChooseBoardAsync())
            .then(() => Util.delay(500))
            .finally(() => {
                core.hideLoading("newproject");
                if (options?.firstProject && pxt.appTarget.appTheme?.tours?.editor) {
                    this.showOnboarding();
                }
            });
    }

    async createProjectAsync(options: ProjectCreationOptions): Promise<void> {
        pxt.perf.measureStart("createProjectAsync")
        this.setSideDoc(undefined);
        if (!options.prj) options.prj = pxt.appTarget.blocksprj;
        let cfg = pxt.U.clone(options.prj.config);
        cfg.name = options.name || lf("Untitled");
        cfg.documentation = options.documentation;
        let files: pxt.workspace.ScriptText = Util.clone(options.prj.files)
        if (options.filesOverride) {
            Util.jsonCopyFrom(files, options.filesOverride);
            Object.keys(options.filesOverride).forEach(name => {
                if (cfg.files.indexOf(name) === -1) {
                    cfg.files.push(name);
                }
            })
        }

        if (options.dependencies) {
            Util.jsonMergeFrom(cfg.dependencies, options.dependencies)
        }
        if (options.extensionUnderTest) {
            const ext = workspace.getHeader(options.extensionUnderTest);
            if (ext) {
                cfg.dependencies[ext.name] = `workspace:${ext.id}`;
            }
        }

        if (options.tsOnly) {
            options.languageRestriction = pxt.editor.LanguageRestriction.NoBlocks;
        }
        if (options.preferredEditor) {
            cfg.preferredEditor = options.preferredEditor;
        }

        if (options.simTheme || options.tutorial?.simTheme) {
            const theming = options.simTheme || options.tutorial?.simTheme;
            if (theming.theme) {
                cfg.theme = theming.theme;
            }
            if (theming.palette) {
                cfg.palette = theming.palette;
            }
        }
        if (options.languageRestriction) {
            let filesToDrop = /\.(blocks)$/;
            if (options.languageRestriction === pxt.editor.LanguageRestriction.JavaScriptOnly) {
                filesToDrop = /\.(py|blocks)$/;
                cfg.preferredEditor = pxt.JAVASCRIPT_PROJECT_NAME;
            } else if (options.languageRestriction === pxt.editor.LanguageRestriction.PythonOnly) {
                cfg.preferredEditor = pxt.PYTHON_PROJECT_NAME;
            }

            cfg.languageRestriction = options.languageRestriction;
            cfg.files = cfg.files.filter(f => !filesToDrop.test(f));
            delete files[pxt.MAIN_BLOCKS];
        }

        // ensure a main.py is ready if this is the desired project
        if (cfg.preferredEditor == pxt.PYTHON_PROJECT_NAME
            && cfg.files.indexOf(pxt.MAIN_PY) < 0) {
            cfg.files.push(pxt.MAIN_PY);
            if (!files[pxt.MAIN_PY]) files[pxt.MAIN_PY] = "\n";
        }
        if (options.tutorial && options.tutorial.metadata) {
            if (options.tutorial.metadata.codeStart) {
                files[pxt.TUTORIAL_CODE_START] = `control._onCodeStart('${pxt.U.htmlEscape(options.tutorial.metadata.codeStart)}')`;
                cfg.files.splice(cfg.files.indexOf(pxt.MAIN_TS), 0, pxt.TUTORIAL_CODE_START);
            }
            if (options.tutorial.metadata.codeStop) {
                files[pxt.TUTORIAL_CODE_STOP] = `control._onCodeStop('${pxt.U.htmlEscape(options.tutorial.metadata.codeStop)}')`;
                cfg.files.push(pxt.TUTORIAL_CODE_STOP);
            }
        }
        files[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(cfg);

        const hd = await workspace.installAsync(
            {
                name: cfg.name,
                meta: {},
                editor: options.preferredEditor || options.prj.id,
                pubId: "",
                pubCurrent: false,
                target: pxt.appTarget.id,
                targetVersion: pxt.appTarget.versions.target,
                cloudUserId: this.getUserProfile()?.id,
                temporary: options.temporary,
                tutorial: options.tutorial,
                extensionUnderTest: options.extensionUnderTest,
                isSkillmapProject: options.skillmapProject
            },
            files
        );

        await this.loadHeaderAsync(hd, { filters: options.filters }, false);
        pxt.perf.measureEnd("createProjectAsync");
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
        const { name, path, loadBlocks, prj, preferredEditor } = options;
        core.showLoading("changingcode", lf("loading..."));
        this.loadingExample = true;
        return this.loadActivityFromMarkdownAsync(path, name.toLowerCase(), preferredEditor)
            .then(r => {
                const { filename, md, features, autoChooseBoard: autoChooseBoardMeta } = (r || {});
                const autoChooseBoard = !prj && autoChooseBoardMeta;
                const example = !!md && pxt.gallery.parseExampleMarkdown(filename, md);
                if (!example)
                    throw new Error(lf("Example not found or invalid format"))
                const opts: pxt.editor.ProjectCreationOptions = example;
                if (prj) opts.prj = prj;
                if (loadBlocks && preferredEditor == pxt.BLOCKS_PROJECT_NAME) {
                    return this.createProjectAsync(opts)
                        .then(() => {
                            return this.loadBlocklyAsync()
                                .then(compiler.getBlocksAsync)
                                .then(blocksInfo => compiler.decompileAsync(pxt.MAIN_TS, blocksInfo))
                                .then(resp => {
                                    pxt.debug(`example decompilation: ${resp.success}`)
                                    if (resp.success) {
                                        this.overrideBlocksFile(resp.outfiles[pxt.MAIN_BLOCKS])
                                    }
                                })
                                .then(() => autoChooseBoard && this.autoChooseBoardAsync(features));
                        });
                } else {
                    if (!loadBlocks) {
                        opts.languageRestriction = pxt.editor.LanguageRestriction.NoBlocks;
                    }
                    opts.preferredEditor = preferredEditor;
                    return this.createProjectAsync(opts)
                        .then(() => {
                            // convert js to py as needed
                            if (preferredEditor == pxt.PYTHON_PROJECT_NAME && example.snippetType !== "python") {
                                return compiler.getApisInfoAsync() // ensure compiled
                                    .then(() => compiler.pyDecompileAsync(pxt.MAIN_TS))
                                    .then(resp => {
                                        pxt.debug(`example decompilation: ${resp.success}`)
                                        if (resp.success) {
                                            this.overrideTypescriptFile(resp.outfiles[pxt.MAIN_PY])
                                        }
                                    })
                                    .then(() => autoChooseBoard && this.autoChooseBoardAsync(features));
                            }
                            return Promise.resolve();
                        })
                }
            })
            .catch(e => {
                core.warningNotification(lf("Please check your internet connection and check the example is valid."));
                pxt.reportException(e);
                return Promise.reject(e);
            })
            .finally(() => {
                this.loadingExample = false;
                core.hideLoading("changingcode")
            })
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
        const fileName = this.editorFile.getVirtualFileName(prj);
        return this.saveVirtualFileAsyncInternal(prj, src, open, fileName);
    }

    private saveVirtualMainFileAsync(prj: string, src: string, open: boolean): Promise<void> {
        const fileName = this.getMainFileName(prj);
        return this.saveVirtualFileAsyncInternal(prj, src, open, fileName);
    }

    private saveVirtualFileAsyncInternal(prj: string, src: string, open: boolean, fileName: string): Promise<void> {
        // language service does not like empty file
        src = src || "\n";
        const mainPkg = pkg.mainEditorPkg();
        Util.assert(fileName && fileName != this.editorFile.name);
        return mainPkg.setContentAsync(fileName, src).then(() => {
            if (open) {
                let f = mainPkg.files[fileName];
                this.setFile(f);
            }
        });
    }

    private getMainFileName(prj: string): string {
        switch (prj) {
            case pxt.PYTHON_PROJECT_NAME: return pxt.MAIN_PY;
            case pxt.JAVASCRIPT_PROJECT_NAME: return pxt.MAIN_TS;
            case pxt.BLOCKS_PROJECT_NAME: return pxt.MAIN_BLOCKS;
            default:
                Util.assert(false, `Unrecognized project type ${prj}`);
                return undefined;
        }
    }

    saveTypeScriptAsync(open = false): Promise<void> {
        const mainPkg = pkg.mainEditorPkg();
        if (!this.editor || !this.state.currFile || this.editorFile.epkg != mainPkg || this.reload)
            return Promise.resolve();

        const fromLanguage = this.editorFile.getExtension() as pxtc.CodeLang;
        const fromText = this.editorFile.content;

        let promise = open ? this.textEditor.loadMonacoAsync() : Promise.resolve();

        // Python uses the virtual file and not the current editor content, so sync content
        if (fromLanguage == "py") {
            promise = promise.then(() => this.saveCurrentSourceAsync());
        }

        promise = promise
            .then(() => {
                if (open) {
                    this.openingTypeScript = true;
                    const cached = mainPkg.getCachedTranspile(fromLanguage, fromText, "ts");
                    if (cached) {
                        return Promise.resolve(cached);
                    }

                    return this.editor.saveToTypeScriptAsync(true)
                        .then(src => {
                            if (src !== undefined) {
                                mainPkg.cacheTranspile(fromLanguage, fromText, "ts", src);
                            }
                            return src;
                        });
                }

                return this.editor.saveToTypeScriptAsync()
            })
            .then((src) => {
                if (src === undefined && open) { // failed to convert
                    return core.confirmAsync({
                        header: lf("Oops, there is a problem converting your code."),
                        body: lf("We are unable to convert your code to JavaScript."),
                        agreeLbl: lf("Done"),
                        agreeClass: "cancel",
                        agreeIcon: "cancel",
                        hasCloseIcon: true,
                    }).then(b => {
                        if (this.isPythonActive()) {
                            pxt.shell.setEditorLanguagePref("py"); // stay in python, else go to blocks
                        }
                    })
                }
                if (src === undefined
                    || (this.editorFile && this.editorFile.name == this.editorFile.getVirtualFileName(pxt.JAVASCRIPT_PROJECT_NAME)))
                    return Promise.resolve();
                if (this.editorFile.getVirtualFileName(pxt.JAVASCRIPT_PROJECT_NAME))
                    return this.saveVirtualFileAsync(pxt.JAVASCRIPT_PROJECT_NAME, src, open);
                return Promise.resolve();
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
            .then(
                () => this.reloadEditor(),
                () => this.reloadEditor()
            );
    }

    pairAsync(): Promise<boolean> {
        return cmds.pairAsync();
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
                        if (!pxt.appTarget.compile.hasHex || pxt.appTarget.compile.useMkcd || pxt.appTarget.compile.saveAsPNG || saveAsBlocks() || saveTutorialTemplate()) {
                            this.saveProjectToFileAsync()
                                .finally(() => {
                                    this.setState({ isSaving: false });
                                });
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
        let pairAsync = () => cmds.pairAsync()
            .then(() => {
                this.checkForHwVariant()
            }, err => {
                this.checkWebUSBVariant = false
                this.checkForHwVariant()
            })
        if (pxt.usb.isEnabled
            && pxt.appTarget.appTheme
            && pxt.appTarget.appTheme.checkForHwVariantWebUSB
            && this.checkWebUSBVariant) {
            pxt.packetio.initAsync(true)
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
                                pxt.tickEvent("projects.choosehwvariant", {
                                    hwid: pxt.hwVariant,
                                    card: "HID-" + pxt.hwVariant
                                });
                                this.reloadHeaderAsync()
                                    .then(() => this.compile())
                                return
                            }
                        }
                    }
                    this.checkWebUSBVariant = false
                    this.checkForHwVariant()
                }, pairAsync)
                .then(() => {
                    pxt.perf.recordMilestone("HID bridge init finished")
                })
            return true
        }
        this.showChooseHwDialog()
        return true
    }

    beforeCompile() { }

    _deploying = false
    async compile(saveOnly = false): Promise<void> {
        pxt.tickEvent("compile", { editor: this.getPreferredEditor() });
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

        let simRestart = this.state.simState != SimState.Stopped;
        // if we're just waiting for empty code to run, don't force restart
        if (simRestart
            && this.state.simState == SimState.Pending
            && pxt.appTarget.simulator.emptyRunCode
            && !this.isBlocksEditor())
            simRestart = false;

        try {
            this.setState({ compiling: true, cancelledDownload: false });
            this.clearSerial();
            this.editor.beforeCompile();
            if (simRestart) this.stopSimulator();
            let state = this.editor.snapshotState()
            this.syncPreferredEditor()
            const attemptedVariants = pxt.appTarget.multiVariants;

            try {
                const resp = await compiler.compileAsync({ native: true, forceEmit: true });
                this.editor.setDiagnostics(this.editorFile, state);
                if (resp.usedParts && resp.usedParts.indexOf("multiplayer") !== -1) {
                    this.setState({ isMultiplayerGame: true });
                }
                else {
                    this.setState({ isMultiplayerGame: false });
                }

                if (!saveOnly) {
                    const shouldContinue = await cmds.showUnsupportedHardwareMessageAsync(resp);
                    if (!shouldContinue) {
                        this.setState({ cancelledDownload: true });
                        return;
                    }
                }

                let fn = pxt.outputName();
                if (!resp.outfiles[fn]) {
                    pxt.tickEvent("compile.noemit")
                    const noHexFileDiagnostic = resp.diagnostics.find(diag => diag.code === 9043)
                        || resp.diagnostics.length == 1 ? resp.diagnostics[0] : undefined;

                    if (noHexFileDiagnostic?.code === 9283 /*program too large*/ && pxt.commands.showProgramTooLargeErrorAsync) {
                        pxt.tickEvent("compile.programTooLargeDialog");
                        const res = await pxt.commands.showProgramTooLargeErrorAsync(attemptedVariants, core.confirmAsync, saveOnly);
                        if (res?.recompile) {
                            pxt.tickEvent("compile.programTooLargeDialog.recompile");
                            const oldVariants = pxt.appTarget.multiVariants;
                            this.setState({ compiling: false, isSaving: false });
                            try {
                                pxt.appTarget.multiVariants = res.useVariants;
                                await this.compile(saveOnly);
                                return;
                            }
                            finally {
                                pxt.appTarget.multiVariants = oldVariants;
                            }
                        }
                        else {
                            pxt.tickEvent("compile.programTooLargeDialog.cancelled");
                        }
                    }

                    if (noHexFileDiagnostic) {
                        core.warningNotification(noHexFileDiagnostic.messageText as string);
                    }
                    else {
                        core.warningNotification(lf("Compilation failed, please check your code for errors."));
                    }
                    return;
                }
                resp.saveOnly = saveOnly;
                resp.userContextWindow = userContextWindow;
                resp.downloadFileBaseName = pkg.genFileName("");
                resp.confirmAsync = core.confirmAsync;
                let h = this.state.header;
                if (h) {
                    resp.headerId = h.id;
                }
                if (pxt.commands.patchCompileResultAsync) {
                    await pxt.commands.patchCompileResultAsync(resp);
                }

                if (saveOnly) {
                    await pxt.commands.saveOnlyAsync(resp);
                    return;
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

                // restart sim early before deployment
                if (simRestart) {
                    this.runSimulator();
                    simRestart = false
                }

                // hardware deployment
                let deployStartTime = Date.now()
                pxt.tickEvent("deploy.start")

                try {
                    this._deploying = true
                    await pxt.commands.deployAsync(resp, {
                        reportError: (e) => {
                            pxt.tickEvent("deploy.reporterror");
                            core.errorNotification(e);
                        },
                        showNotification: (msg) => core.infoNotification(msg)
                    })

                    let elapsed = Date.now() - deployStartTime;
                    pxt.tickEvent("deploy.finished", { "elapsedMs": elapsed });
                }
                catch (e) {
                    if (e.notifyUser) {
                        core.warningNotification(e.message);
                    } else {
                        const errorText = pxt.appTarget.appTheme.useUploadMessage ? lf("Upload failed, please try again.") : lf("Download failed, please try again.");
                        core.warningNotification(errorText);
                    }
                    let elapsed = Date.now() - deployStartTime;
                    pxt.tickEvent("deploy.exception", { "notifyUser": e.notifyUser, "elapsedMs": elapsed });
                    pxt.reportException(e);
                    if (userContextWindow) {
                        try {
                            userContextWindow.close()
                        } catch (e) {
                        }
                    }
                }
                finally {
                    this._deploying = false
                    // the tab may have gone hidden while deploying, in which case
                    // we skipped the disconnect path, checking again here
                    // to disconnect if needed
                    if (!pxt.BrowserUtils.isDocumentVisible()) {
                        pxt.debug(`visibility: updated after deploy`)
                        await this.updateVisibilityAsync()
                    }
                }
            }
            catch (e) {
                pxt.reportException(e);
                core.errorNotification(lf("Compilation failed, please contact support."));
                if (userContextWindow)
                    try { userContextWindow.close() } catch (e) { }
            }
            finally {
                this.setState({ compiling: false, isSaving: false });
                if (simRestart) this.runSimulator();
            }
        } catch (e) {
            this.setState({ compiling: false, isSaving: false });
            pxt.reportException(e);
            core.errorNotification(lf("Compilation failed, please try again."));
        }
    }

    overrideTypescriptFile(text: string) {
        if (this.textEditor) this.textEditor.overrideFile(text);
    }

    overrideBlocksFile(text: string) {
        if (this.blocksEditor) this.blocksEditor.overrideFile(text);
    }

    async setLanguageRestrictionAsync(restriction: pxt.editor.LanguageRestriction) {
        if (this.state.header) {
            const epkg = pkg.mainEditorPkg();
            const pxtJsonFile = epkg.files["pxt.json"];
            const pxtJson = pxt.Package.parseAndValidConfig(pxtJsonFile?.content);
            if (pxtJson) {
                pxtJson.languageRestriction = restriction;
                await pxtJsonFile.setContentAsync(JSON.stringify(pxtJson, null, 4));

                let filesToDrop: string[];

                switch (restriction) {
                    case pxt.editor.LanguageRestriction.BlocksOnly:
                    case pxt.editor.LanguageRestriction.NoJavaScript:
                    case pxt.editor.LanguageRestriction.Standard:
                        filesToDrop = [];
                        break;
                    case pxt.editor.LanguageRestriction.JavaScriptOnly:
                        filesToDrop = [pxt.MAIN_BLOCKS, pxt.MAIN_PY];
                        break;
                    case pxt.editor.LanguageRestriction.PythonOnly:
                    case pxt.editor.LanguageRestriction.NoBlocks:
                        filesToDrop = [pxt.MAIN_BLOCKS];
                        break;
                    case pxt.editor.LanguageRestriction.NoPython:
                        filesToDrop = [pxt.MAIN_PY];
                        break;
                }

                for (const file of filesToDrop) {
                    await epkg.removeFileAsync(file);
                }

                switch (restriction) {
                    case pxt.editor.LanguageRestriction.BlocksOnly:
                    case pxt.editor.LanguageRestriction.NoJavaScript:
                    case pxt.editor.LanguageRestriction.Standard:
                    case pxt.editor.LanguageRestriction.NoPython:
                        if (this.editorFile.name !== pxt.MAIN_BLOCKS) {
                            this.openBlocksAsync();
                            return;
                        }
                        break;
                    case pxt.editor.LanguageRestriction.JavaScriptOnly:
                    case pxt.editor.LanguageRestriction.NoBlocks:
                        if (this.editorFile.name !== pxt.MAIN_TS) {
                            await this.openTypeScriptAsync();
                            return;
                        }
                        break;
                    case pxt.editor.LanguageRestriction.PythonOnly:
                        if (this.editorFile.name !== pxt.MAIN_PY) {
                            await this.openPythonAsync();
                            return;
                        }
                        break;
                }


                await this.reloadHeaderAsync();
            }
        }
    }

    ///////////////////////////////////////////////////////////
    ////////////             Simulator            /////////////
    ///////////////////////////////////////////////////////////

    startStopSimulator(opts?: pxt.editor.SimulatorStartOptions) {
        switch (this.state.simState) {
            case SimState.Starting:
            case SimState.Pending:
                // button smashing, do nothing
                break;
            case SimState.Running:
                this.stopSimulator(false, opts);
                break;
            default:
                this.maybeShowPackageErrors(true);
                this.startSimulator(opts);
                if (opts && opts.clickTrigger) simulator.driver.focus();
                break;
        }
    }

    toggleTrace(intervalSpeed?: number) {
        const tracing = !!this.state.tracing;
        if (tracing) {
            this.editor.clearHighlightedStatements();
            simulator.setTraceInterval(0);
        } else {
            simulator.setTraceInterval(intervalSpeed || simulator.SLOW_TRACE_INTERVAL);
        }
        this.setState({ tracing: !tracing },
            () => {
                if (this.state.debugging) {
                    this.onDebuggingStart();
                }
                else {
                    this.restartSimulator();
                }
            })
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
        pxt.tickEvent("simulator.toggleCollapse", { view: 'computer', collapsedTo: '' + !state.collapseEditorTools }, { interactiveConsent: true });
        if (state.simState == SimState.Stopped && state.collapseEditorTools && !pxt.appTarget.simulator.headless) {
            this.startStopSimulator();
        }

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
        this.fireResize();
    }

    collapseSimulator() {
        simulator.hide(() => {
            this.setState({ collapseEditorTools: true });
            this.fireResize();
        })
    }

    // Close on escape
    closeOnEscape = (e: KeyboardEvent) => {
        const charCode = core.keyCodeFromEvent(e);
        if (charCode !== core.ESC_KEY) return
        e.preventDefault()
        this.toggleSimulatorFullscreen();
    }

    setSimulatorFullScreen(enabled: boolean) {
        if (this.state.collapseEditorTools) {
            this.expandSimulator();
        }
        if (!enabled) {
            document.addEventListener('keydown', this.closeOnEscape);
            simulator.driver.focus();
        } else {
            document.removeEventListener('keydown', this.closeOnEscape);
        }
        this.closeFlyout();
        this.setState({ fullscreen: enabled });
    }

    toggleSimulatorFullscreen() {
        this.setSimulatorFullScreen(!this.state.fullscreen);
    }

    closeFlyout() {
        this.editor.closeFlyout();
    }

    toggleMute() {
        switch (this.state.mute) {
            case pxt.editor.MuteState.Muted:
                this.setMute(pxt.editor.MuteState.Unmuted);
                break;
            case pxt.editor.MuteState.Unmuted:
                this.setMute(pxt.editor.MuteState.Muted);
                break;
        }
    }

    setMute(mute: pxt.editor.MuteState) {
        switch (mute) {
            case pxt.editor.MuteState.Muted:
                simulator.mute(true);
                break;
            case pxt.editor.MuteState.Unmuted:
                simulator.mute(false);
                break;
        }
        this.setState({ mute });
    }

    openInstructions() {
        const running = this.state.simState != SimState.Stopped;
        if (running) this.stopSimulator();
        make.makeAsync()
            .finally(() => {
                if (running) this.startSimulator()
            })
    }

    printCode() {
        if (!this.state.header) return; // no program loaded

        const p = pkg.mainEditorPkg();
        const files = p.getAllFiles();
        // render in sidedocs
        const docsUrl = pxt.webConfig.docsUrl || '/--docs';
        const mode = theEditor.isBlocksActive() ? "blocks" : (theEditor.isPythonActive() ? "python" : "typescript");
        window.localStorage["printjob"] = JSON.stringify(files);
        const url = `${docsUrl}#print:job:${mode}:${pxt.Util.localeInfo()}`;

        core.dialogAsync({
            header: lf("Print Code"),
            hasCloseIcon: true,
            size: "large",
            jsx:
                /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
                <div className="ui container">
                    <div id="printcontainer" style={{ 'position': 'relative', 'height': 0, 'paddingBottom': '40%', 'overflow': 'hidden' }}>
                        <iframe
                            frameBorder="0"
                            aria-label={lf("Print preview")}
                            sandbox="allow-popups allow-forms allow-scripts allow-same-origin allow-modals"
                            style={{ 'position': 'absolute', 'top': 0, 'left': 0, 'width': '100%', 'height': '100%' }}
                            src={url} />
                    </div>
                </div>
            /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
        }).then(r => {
        })
    }

    clearSerial() {
        this.serialEditor.clear()
        this.simulatorSerialIndicator()?.clear();
        this.deviceSerialIndicator()?.clear();
        this.setState({
            simSerialActive: false,
            deviceSerialActive: false,
        })
    }

    simulatorSerialIndicator() {
        return this.refs["simIndicator"] as serialindicator.SerialIndicator;
    }

    deviceSerialIndicator() {
        return this.refs["devIndicator"] as serialindicator.SerialIndicator;
    }

    shouldStartSimulator(): boolean {
        switch (this.state.simState) {
            case SimState.Starting:
            case SimState.Running:
                return false; // already reunning
        }
        const hasHome = !pxt.shell.isControllerMode();
        if (!hasHome) return true;
        return !this.state.home;
    }

    isSimulatorRunning(): boolean {
        return this.state.simState == SimState.Running;
    }

    singleSimulator() {
        simulator.driver.setSingleSimulator();
    }

    restartSimulator() {
        const isDebug = this.state.tracing || this.state.debugging;
        if (this.state.simState == SimState.Stopped
            || this.debugOptionsChanged()) {
            this.startSimulator();
        } else {
            simulator.driver.restart(); // fast restart
        }
        simulator.driver.focus()
        if (!isDebug) {
            this.blocksEditor.clearBreakpoints();
        }
    }

    async startSimulator(opts?: pxt.editor.SimulatorStartOptions) {
        pxt.tickEvent('simulator.start');
        const isDebugMatch = !this.debugOptionsChanged();
        const clickTrigger = opts && opts.clickTrigger;
        pxt.debug(`start sim (autorun ${this.state.autoRun})`)
        if (!this.shouldStartSimulator() && isDebugMatch || this.state.home) {
            pxt.log("Ignoring call to start simulator, either already running or we shouldn't start.");
            return;
        }

        await this.saveFileAsync();
        await this.runSimulator({ debug: this.state.debugging, clickTrigger });
    }

    debugOptionsChanged() {
        const { debugging, tracing } = this.state;

        return (!!debugging != simulator.driver.isDebug()) || (!!tracing != simulator.driver.isTracing())
    }

    stopSimulator(unload?: boolean, opts?: pxt.editor.SimulatorStartOptions) {
        pxt.perf.measureStart("stopSimulator")
        pxt.tickEvent('simulator.stop')
        const clickTrigger = opts && opts.clickTrigger;
        pxt.debug(`sim: stop (autorun ${this.state.autoRun})`)
        if (this.runToken) {
            this.runToken.cancel()
            this.runToken = null
        }

        if (this.isSimulatorRunning() || unload && simulator.driver?.state !== pxsim.SimulatorState.Unloaded) {
            simulator.stop(unload);
        }

        const autoRun = this.state.autoRun && !clickTrigger; // if user pressed stop, don't restart

        // Only fire setState if something changed
        if (this.state.simState !== SimState.Stopped || !!this.state.autoRun !== !!autoRun) {
            this.setState({ simState: SimState.Stopped, autoRun: autoRun });
        }

        pxt.perf.measureEnd("stopSimulator")
    }

    suspendSimulator() {
        pxt.tickEvent('simulator.suspend')
        if (this.runToken) {
            this.runToken.cancel()
            this.runToken = null
        }
        simulator.suspend()
    }

    showMiniSim(visible?: boolean) {
        this.setState({ showMiniSim: visible });
    }

    onHighContrastChanged() {
        this.clearSerial();
        // Not this.restartSimulator; need full restart to consistently update visuals,
        // and don't want to steal focus.
        if (this.isSimulatorRunning()) {
            this.stopSimulator();
            this.startSimulator();
        }

        const highContrast = this.getData<boolean>(auth.HIGHCONTRAST);
        const bodyIsHighContrast = document.body.classList.contains("high-contrast");
        if (highContrast) {
            if (!bodyIsHighContrast) document.body.classList.add("high-contrast");
        }
        else if (bodyIsHighContrast) {
            document.body.classList.remove("high-contrast");
        }
    }

    onCloudStatusChanged(path: string) {
        const cloudMd = this.getData<cloud.CloudTempMetadata>(path);
        const cloudStatus = cloudMd?.cloudStatus();
        if (cloudStatus) {
            const msg: pxt.editor.EditorMessageProjectCloudStatus = {
                type: "pxthost",
                action: "projectcloudstatus",
                headerId: cloudMd.headerId,
                status: cloudStatus.value
            };
            pxteditor.postHostMessageAsync(msg);

            // Deprecated: This was originally fired with the "pxteditor"
            // type, which should only be used for responses, not events.
            // Use the pxthost version above instead
            pxteditor.postHostMessageAsync({
                ...msg,
                type: "pxteditor"
            });
        }
    }

    runSimulator(opts: compiler.CompileOptions = {}): Promise<void> {
        const emptyRun = this.firstRun
            && opts.background
            && pxt.appTarget.simulator
            && !!pxt.appTarget.simulator.emptyRunCode
            && !this.isBlocksEditor();
        if (this.firstRun && pxt.BrowserUtils.isSafari()) this.setMute(pxt.editor.MuteState.Disabled);

        pxt.debug(`sim: start run (autorun ${this.state.autoRun}, first ${this.firstRun})`)
        this.firstRun = false

        if (this.runToken) this.runToken.cancel()
        let cancellationToken = new pxt.Util.CancellationToken();
        this.runToken = cancellationToken;
        cancellationToken.startOperation();
        return (() => {
            const editorId = this.editor ? this.editor.getId().replace(/Editor$/, '') : "unknown";
            if (opts.background) {
                pxt.tickEvent("activity.autorun", { editor: editorId });
                if (pxt.storage.getLocal("noAutoRun"))
                    return Promise.resolve()
            } else pxt.tickEvent(opts.debug ? "debug" : "run", { editor: editorId });

            if (!opts.background)
                this.editor.beforeCompile();
            if (this.state.tracing && this.state.debugging)
                opts.trace = true;

            if (opts.debug) {
                opts.debugExtensionCode = pxt.appTarget.appTheme.debugExtensionCode && !this.isBlocksActive()
            }

            this.syncPreferredEditor()

            simulator.stop(false, true);

            const autoRun = this.autoRunOnStart() && this.isBlocksEditor() && (this.state.autoRun || !!opts.clickTrigger);

            const state = this.editor.snapshotState()
            return this.setStateAsync({ simState: SimState.Starting, autoRun: autoRun })
                .then(() => (emptyRun ? Promise.resolve(compiler.emptyCompileResult()) : compiler.compileAsync(opts)))
                .then(resp => {
                    if (cancellationToken.isCancelled()) {
                        pxt.debug(`sim: cancelled`);
                        return;
                    }
                    this.clearSerial();
                    this.editor.setDiagnostics(this.editorFile, state)

                    if (resp.usedParts && resp.usedParts.indexOf("multiplayer") !== -1) {
                        this.setState({ isMultiplayerGame: true });
                    }
                    else {
                        this.setState({ isMultiplayerGame: false });
                    }

                    if (resp.outfiles[pxtc.BINARY_JS]) {
                        if (!cancellationToken.isCancelled()) {
                            pxt.debug(`sim: run`)

                            const hc = data.getData<boolean>(auth.HIGHCONTRAST)
                            if (!pxt.react.isFieldEditorViewVisible?.()) {
                                simulator.run(pkg.mainPkg, opts.debug, resp, {
                                    mute: this.state.mute === pxt.editor.MuteState.Muted,
                                    highContrast: hc,
                                    light: pxt.options.light,
                                    clickTrigger: opts.clickTrigger,
                                    storedState: pkg.mainEditorPkg().getSimState(),
                                    autoRun: this.state.autoRun
                                }, opts.trace)
                            }
                            this.blocksEditor.setBreakpointsMap(resp.breakpoints, resp.procCallLocations);
                            this.textEditor.setBreakpointsMap(resp.breakpoints, resp.procCallLocations);
                            if (!cancellationToken.isCancelled()) {
                                // running state is set by the simulator once the iframe is loaded
                                this.setState({ showParts: simulator.driver.hasParts() })
                            } else {
                                pxt.debug(`sim: cancelled 2`)
                                simulator.stop();
                                this.setState({ simState: SimState.Stopped });
                            }
                        }
                    } else if (!opts.background) {
                        core.warningNotification(lf("Oops, we could not run this project. Please check your code for errors."))
                        simulator.stop();
                        this.setState({ simState: SimState.Stopped });
                    }
                })
                .finally(() => {
                    if (!cancellationToken.isCancelled()) cancellationToken.resolveCancel()
                    cancellationToken = null;
                });
        })();
    }

    openNewTab(hd: pxt.workspace.Header, dependent: boolean) {
        if (!hd
            || pxt.BrowserUtils.isElectron()
            || pxt.BrowserUtils.isIOS())
            return;
        let url = window.location.href.replace(/#.*$/, '');
        if (dependent)
            url = url + (url.indexOf('?') > -1 ? '&' : '?') + "nestededitorsim=1&lockededitor=1";
        url += "#header:" + hd.id;
        const w = window.open(url, pxt.appTarget.id + hd.id);
        if (w) {
            pxt.log(`dependent editor window registered`)
            simulator.driver.registerDependentEditor(w);
        }
    }

    createGitHubRepositoryAsync(): Promise<void> {
        const { projectName, header } = this.state;
        return cloudsync.githubProvider(true).createRepositoryAsync(projectName, header)
            .then(r => r && this.reloadHeaderAsync());
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
        if (this.state.simState != SimState.Running || !simulator.driver.isDebug())
            start = this.runSimulator({ debug: true })
        return start.then(() => {
            simulator.driver.setHwDebugger({
                postMessage: (msg) => {
                    pxt.HWDBG.handleMessage(msg as pxsim.DebuggerMessage)
                }
            })
            pxt.HWDBG.postMessage = (msg) => simulator.driver.handleHwDebuggerMsg(msg)
            return Promise.all([
                compiler.compileAsync({ debug: true, native: true }),
                pxt.packetio.initAsync()
            ]).then(vals => pxt.HWDBG.startDebugAsync(vals[0], vals[1] as pxt.HF2.Wrapper))
        })
    }

    toggleDebugging() {
        const state = !this.state.debugging;
        this.setState({
            debugging: state,
            debugFirstRun: state
        }, () => {
            this.setSimulatorFullScreen(false); // exit fullscreen if necessary
            this.onDebuggingStart();
        });
    }

    protected onDebuggingStart() {
        this.renderCore()
        if (this.editor) {
            this.editor.updateBreakpoints();
            this.editor.updateToolbox();
        }
        this.restartSimulator();
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

    hasCloudSync() {
        return this.isLoggedIn();
    }

    showScriptManager() {
        this.scriptManagerDialog.show();
    }

    importProjectDialog() {
        this.importDialog.show();
    }

    renderPythonAsync(req: pxt.editor.EditorMessageRenderPythonRequest): Promise<pxt.editor.EditorMessageRenderPythonResponse> {
        return compiler.decompilePythonSnippetAsync(req.ts)
            .then(resp => {
                return { python: resp };
            });
    }

    blocksScreenshotAsync(pixelDensity?: number, encodeBlocks?: boolean): Promise<string> {
        if (pxtblockly.screenshotEnabled()
            && this.blocksEditor && this.blocksEditor.isReady && this.blocksEditor.editor)
            return pxtblockly.screenshotAsync(this.blocksEditor.editor, pixelDensity, encodeBlocks)
        return Promise.resolve(undefined);
    }

    renderBlocksAsync(req: pxt.editor.EditorMessageRenderBlocksRequest): Promise<pxt.editor.EditorMessageRenderBlocksResponse> {
        return compiler.getBlocksAsync()
            .then(blocksInfo => compiler.decompileBlocksSnippetAsync(req.ts, blocksInfo, req))
            .then(resp => {
                const svg = pxtblockly.render(resp.outfiles[pxt.MAIN_BLOCKS], {
                    snippetMode: req.snippetMode || false,
                    layout: req.layout !== undefined ? req.layout : pxt.editor.BlockLayout.Align,
                    splitSvg: false
                }) as SVGSVGElement;
                // TODO: what if svg is undefined? handle that scenario
                const viewBox = svg.getAttribute("viewBox").split(/\s+/).map(d => parseInt(d));
                return {
                    svg: svg,
                    xml: pxtblockly.blocklyToSvgAsync(svg, viewBox[0], viewBox[1], viewBox[2], viewBox[3])
                }
            });
    }

    renderXmlInner(xml: string, snippetMode?: boolean, layout?: pxt.editor.BlockLayout) {
        const wrappedXml = xml.trim().toLocaleLowerCase().startsWith("<xml") ? xml : `<xml xmlns="https://developers.google.com/blockly/xml">${xml}</xml>`;
        const svg = pxtblockly.render(wrappedXml, {
            snippetMode: snippetMode || false,
            layout: layout !== undefined ? layout : pxt.editor.BlockLayout.Align,
            splitSvg: false
        }) as SVGSVGElement;

        const viewBox = svg.getAttribute("viewBox").split(/\s+/).map(d => parseInt(d));
        return {
            svg: svg,
            resultXml: pxtblockly.blocklyToSvgAsync(svg, viewBox[0], viewBox[1], viewBox[2], viewBox[3])
        }
    }

    renderXml(req: pxt.editor.EditorMessageRenderXmlRequest): pxt.editor.EditorMessageRenderXmlResponse {
        return this.renderXmlInner(req.xml, req.snippetMode, req.layout);
    }

    async renderByBlockIdAsync(req: pxt.editor.EditorMessageRenderByBlockIdRequest): Promise<pxt.editor.EditorMessageRenderByBlockIdResponse> {
        const blocksInfo = await compiler.getBlocksAsync();
        const blockInfo = blocksInfo.blocksById[req.blockId];
        const symbolInfo: pxtc.SymbolInfo = blocksInfo.apis.byQName[blockInfo.qName];
        const compileInfo: pxt.blocks.BlockCompileInfo = pxt.blocks.compileInfo(symbolInfo);
        const xml = pxtblockly.createToolboxBlock(blocksInfo, symbolInfo, compileInfo, false, 3);
        return this.renderXmlInner(xml.outerHTML, req.snippetMode, req.layout);
    }

    getBlocks(): Blockly.Block[] {
        if (!this.isBlocksActive()) {
            pxt.error("Trying to get blocks from a non-blocks editor.");
            throw new Error("Trying to get blocks from a non-blocks editor.");
        }

        return this.blocksEditor.editor.getAllBlocks(false);
    }

    getToolboxCategories(advanced?: boolean): pxt.editor.EditorMessageGetToolboxCategoriesResponse {
        if (!this.isBlocksActive()) {
            pxt.error("Trying to get blocks info from a non-blocks editor.");
            throw new Error("Trying to get blocks info from a non-blocks editor.");
        }

        // The toolbox.ToolboxCategory is not exposed, so convert it to the exported ToolboxCategoryDefinition.
        const categoriesInternal = this.blocksEditor.getToolboxCategories(advanced);
        const categories: pxt.editor.ToolboxCategoryDefinition[] = categoriesInternal.map(c => {
            return {
                ...c,
                name: c.name || c.nameid,
                customClick: undefined, // Cannot be serialized.
                blocks: c.blocks.map(b => {
                    return {
                        ...b,
                        group: b.attributes.group,
                        advanved: b.attributes.advanced,
                        weight: b.attributes.weight,
                        jsDoc: b.attributes.jsDoc,
                        blockId: b.attributes.blockId,
                    } as pxt.editor.ToolboxBlockDefinition
                }),
            } as pxt.editor.ToolboxCategoryDefinition;
        });
        return { categories };
    }

    getBlocksWithId(blockId: string): BlockDefinition[] {
        const matches: BlockDefinition[] = [];
        for (const advanced of [false, true]) {
            for (const category of this.blocksEditor.getToolboxCategories(advanced)) {
                for (const match of category.blocks?.filter(b => b.attributes.blockId === blockId) ?? []) {
                    matches.push(match);
                }
            }
        }

        return matches;
    }

    getBlockAsText(blockId: string): pxt.editor.BlockAsText | undefined {
        const blocksWithId = this.getBlocksWithId(blockId);
        let readableName: pxt.editor.BlockAsText = undefined;
        if (blocksWithId.length === 0) {
            return undefined;
        } else if (blocksWithId.length === 1) {
            const block = blocksWithId[0];
            readableName = toolboxHelpers.getBlockAsText(block, block.parameters ? block.parameters.slice() : null, false);
        }

        if (!readableName) {
            // Found multiple blocks matching the id, or we were unable to generate a readable name from block parameters.
            // In this case, use the block snippet names to describe the block.
            const blockSnippets: string[] = [];
            for (const name of blocksWithId.map(b => b.snippetName || b.name)) {
                if (blockSnippets.indexOf(name) === -1) {
                    blockSnippets.push(name);
                }
            }
            readableName = {
                parts: [
                    {
                        kind: "label",
                        content: blockSnippets.join(" | ")
                    }
                ],
            }
        }

        return readableName;
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
            .then(fileContent => {
                pxt.tickEvent("sandbox.openfulleditor");
                editUrl += `#project:${fileContent}`;
                window.open(editUrl, '_blank')
            });
    }

    async anonymousPublishHeaderByIdAsync(headerId: string, projectName?: string): Promise<pxt.editor.ShareData> {
        const header = workspace.getHeader(headerId);
        const text = await workspace.getTextAsync(headerId);
        const stext = JSON.stringify(text, null, 2) + "\n"


        if (projectName && text[pxt.CONFIG_NAME]) {
            try {
                const config = JSON.parse(text[pxt.CONFIG_NAME]) as pxt.PackageConfig
                config.name = projectName;
                text[pxt.CONFIG_NAME] = pxt.Package.stringifyConfig(config);
            }
            catch (e) {
                pxt.debug("Could not update config");
            }
        }

        const scrReq = {
            name: projectName || header.name,
            target: header.target,
            targetVersion: header.targetVersion,
            description: lf("Made with ❤️ in {0}.", pxt.appTarget.title || pxt.appTarget.name),
            editor: header.editor,
            text: text,

            // FIXME: skillmap shares should set the metadata properly
            meta: {
                versions: pxt.appTarget.versions,
                blocksHeight: 0,
                blocksWidth: 0
            }
        }
        pxt.debug(`publishing script; ${stext.length} bytes`)
        const script: pxt.Cloud.JsonScript = await Cloud.privatePostAsync("scripts", scrReq, /* forceLiveEndpoint */ true);

        return this.getShareUrl(script.shortid || script.id, false);
    }

    async publishAsync (name: string, screenshotUri?: string, forceAnonymous?: boolean): Promise<pxt.editor.ShareData> {
        pxt.tickEvent("menu.embed.publish", undefined, { interactiveConsent: true });
        if (name && this.state.projectName != name) {
            await this.updateHeaderNameAsync(name);
        }

        const hasIdentity = auth.hasIdentity() && this.isLoggedIn();

        try {
            const persistentPublish = hasIdentity && !forceAnonymous;
            const id = await this.publishCurrentHeaderAsync(persistentPublish, screenshotUri);
            return await this.getShareUrl(id, persistentPublish);
        } catch (e) {
            pxt.tickEvent("menu.embed.error", { code: (e as any).statusCode })
            return { url: "", embed: {}, error: e } as pxt.editor.ShareData
        }
    }

    protected async getShareUrl(pubId: string, persistent?: boolean) {
        const targetTheme = pxt.appTarget.appTheme;
        let shareData: pxt.editor.ShareData = {
            url: "",
            embed: {}
        };

        let shareUrl = (persistent
            ? targetTheme.homeUrl
            : targetTheme.shareUrl) || "https://makecode.com/";
        if (!/\/$/.test(shareUrl)) shareUrl += '/';
        let rootUrl = targetTheme.embedUrl
        if (!/\/$/.test(rootUrl)) rootUrl += '/';
        const verPrefix = pxt.webConfig.verprefix || '';

        shareData.url = `${shareUrl}${pubId}`;
        shareData.embed.code = pxt.docs.codeEmbedUrl(`${rootUrl}${verPrefix}`, pubId);
        shareData.embed.editor = pxt.docs.embedUrl(`${rootUrl}${verPrefix}`, "pub", pubId);
        shareData.embed.url = `${rootUrl}${verPrefix}#pub:${pubId}`;

        let padding = '81.97%';
        // TODO: parts aspect ratio
        let simulatorRunString = `${verPrefix}---run`;
        if (pxt.webConfig.runUrl) {
            if (pxt.webConfig.isStatic) {
                simulatorRunString = pxt.webConfig.runUrl;
            }
            else {
                // Always use live, not /beta etc.
                simulatorRunString = pxt.webConfig.runUrl.replace(pxt.webConfig.relprefix, "/---")
            }
        }
        if (pxt.appTarget.simulator) padding = (100 / pxt.appTarget.simulator.aspectRatio).toPrecision(4) + '%';
        const runUrl = rootUrl + simulatorRunString.replace(/^\//, '');
        shareData.embed.simulator = pxt.docs.runUrl(runUrl, padding, pubId);

        if (targetTheme.qrCode) {
            shareData.qr = await qr.renderAsync(`${shareUrl}${pubId}`);
        }

        return shareData;
    }

    async publishCurrentHeaderAsync(persistent: boolean, screenshotUri?: string): Promise<string> {
        pxt.tickEvent("publish");
        this.setState({ publishing: true })
        const mpkg = pkg.mainPkg
        const epkg = pkg.getEditorPkg(mpkg)

        try {
            await this.saveProjectNameAsync();
            await this.saveFileAsync();
            const files = await mpkg.filesToBePublishedAsync(true);
            if (epkg.header.pubCurrent && !screenshotUri) {
                return epkg.header.pubId;
            }

            const meta: workspace.ScriptMeta = {
                description: mpkg.config.description,
            };

            const blocksSize = this.blocksEditor.contentSize();
            if (blocksSize) {
                meta.blocksHeight = blocksSize.height;
                meta.blocksWidth = blocksSize.width;
            }
            if (persistent) {
                const header = await workspace.persistentPublishAsync(epkg.header, files, meta, screenshotUri);
                return header.pubId
            }
            else {
                const info = await workspace.anonymousPublishAsync(epkg.header, files, meta, screenshotUri);
                return info.id;
            }
        }
        finally {
            this.setState({ publishing: false })
        }
    }

    hasHeaderBeenPersistentShared() {
        return !!this.state.header?.pubPermalink;
    }

    getSharePreferenceForHeader() {
        return this.state.header?.anonymousSharePreference;
    }

    async saveSharePreferenceForHeaderAsync(anonymousByDefault: boolean) {
        if (!this.state.header) return;
        this.state.header.anonymousSharePreference = anonymousByDefault;
        await workspace.saveAsync(this.state.header);
    }

    async saveLocalProjectsToCloudAsync(headerIds: string[]): Promise<pxt.Map<string> | undefined> {
        return cloud.saveLocalProjectsToCloudAsync(headerIds);
    }

    async requestProjectCloudStatus(headerIds: string[]): Promise<void> {
        await cloud.requestProjectCloudStatus(headerIds);
    }

    convertCloudProjectsToLocal(userId: string): Promise<void> {
        return cloud.convertCloudToLocal(userId);
    }

    private debouncedSaveProjectName: () => void;

    updateHeaderName(name: string) {
        this.setState({
            projectName: name
        })
        if (!this.debouncedSaveProjectName) {
            this.debouncedSaveProjectName = Util.debounce(() => {
                this.saveProjectNameAsync();
            }, pxt.options.light ? 2000 : 500, false);
        }
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
        return f.setContentAsync(pxt.Package.stringifyConfig(config))
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

    // Classes to add to modals
    createModalClasses(classes?: string): string {
        const rootClassList = [
            classes,
            this.rootClasses.indexOf("flyoutOnly") != -1 ? "flyoutOnly" : "",
            this.rootClasses.indexOf("inverted-theme") != -1 ? "inverted-theme" : "",
            this.rootClasses.indexOf("hideIteration") != -1 ? "hideIteration" : ""
        ]
        return sui.cx(rootClassList);
    }

    showReportAbuse() {
        const pubId = (this.state.tutorialOptions && this.state.tutorialOptions.tutorialReportId)
            || (this.state.header && this.state.header.pubCurrent && this.state.header.pubId);
        dialogs.showReportAbuseAsync(pubId);
    }

    showAboutDialog() {
        dialogs.showAboutDialogAsync(this);
    }

    async showTurnBackTimeDialogAsync() {
        let simWasRunning = this.isSimulatorRunning();
        if (simWasRunning) {
            this.stopSimulator();
        }

        await dialogs.showTurnBackTimeDialogAsync(this.state.header, () => {
            this.reloadHeaderAsync();
            simWasRunning = false;
        });

        if (simWasRunning) {
            this.startSimulator();
        }
    }

    showLoginDialog(continuationHash?: string) {
        this.loginDialog.show(continuationHash);
    }

    showProfileDialog(location?: string) {
        this.profileDialog.show(location);
    }

    showShareDialog(title?: string, kind?: "multiplayer" | "vscode" | "share") {
        this.shareEditor.show(title, kind);
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
            });
    }

    showImportGithubDialog() {
        dialogs.showImportGithubDialogAsync()
            .then(url => {
                if (url === "NEW") {
                    dialogs.showCreateGithubRepoDialogAsync()
                        .then(url => {
                            if (url) {
                                importGithubProject(url);
                            }
                        })
                } else if (url) {
                    importGithubProject(url);
                }
            }, e => {
                core.errorNotification(lf("Sorry, that repository looks invalid."));
            });
    }

    showImportFileDialog(options?: pxt.editor.ImportFileOptions) {
        dialogs.showImportFileDialogAsync(options).then(res => {
            if (res) {
                pxt.tickEvent("app.open.file");
                this.importFile(res, options);
            }
        });
    }

    showResetDialog() {
        dialogs.showResetDialogAsync().then(r => {
            if (!r) return Promise.resolve();
            dialogs.clearDontShowDownloadDialogFlag();
            webusb.clearUserPrefersDownloadFlag();
            return this.resetWorkspace();
        });
    }

    showExitAndSaveDialog() {
        this.setState({ debugging: false })
        if (this.isTutorial()) {
            pxt.tickEvent("tutorial.exit.home", { tutorial: this.state.header?.tutorial?.tutorial });
            this.exitTutorialAsync().finally(() => this.openHome());
        } else if (this.state.projectName !== lf("Untitled")) {
            this.openHome();
        } else {
            this.exitAndSaveDialog.show();
        }
    }

    askForProjectCreationOptionsAsync() {
        return this.newProjectDialog.promptUserAsync();
    }

    hidePackageDialog() {
        this.setState({
            ...this.state,
            extensionsVisible: false
        })

        if (this.state.accessibleBlocks) {
            this.editor.focusToolbox(CategoryNameID.Extensions);
        }
    }

    showPackageDialog() {
        this.setState({
            ...this.state,
            extensionsVisible: true
        })
    }

    showBoardDialogAsync(features?: string[], closeIcon?: boolean): Promise<void> {
        return this.scriptSearch.showBoardsAsync(features, closeIcon);
    }

    showModalDialogAsync(options: pxt.editor.ModalDialogOptions) {
        return core.dialogAsync({
            header: options.header,
            body: options.body,
            hasCloseIcon: true,
            buttons: options.buttons
        })
    }

    showExperimentsDialog() {
        this.scriptSearch.showExperiments();
    }

    showChooseHwDialog(skipDownload?: boolean) {
        if (this.chooseHwDialog)
            this.chooseHwDialog.show(skipDownload)
    }

    showRenameProjectDialogAsync(): Promise<boolean> {
        // don't show rename project prompt on github projects
        if (!this.state.header || this.state.header.githubId)
            return Promise.resolve(false);

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

    signOutGithub() {
        const githubProvider = cloudsync.githubProvider();
        if (githubProvider) {
            githubProvider.logout();
            this.forceUpdate();
            core.infoNotification(lf("Signed out from GitHub"))
        }
    }

    ///////////////////////////////////////////////////////////
    ////////////             Tutorials            /////////////
    ///////////////////////////////////////////////////////////

    private hintManager: HintManager = new HintManager();

    private async loadActivityFromMarkdownAsync(path: string, title?: string, editorProjectName?: string): Promise<{
        reportId: string;
        filename: string;
        autoChooseBoard: boolean;
        dependencies: pxt.Map<string>;
        features: string[];
        temporary: boolean;
        md: string;
    }> {
        const header = workspace.getHeader(path.split(':')[0]);
        const scriptId = !header && pxt.Cloud.parseScriptId(path);
        const ghid = !header && !scriptId && pxt.github.parseRepoId(path);

        let reportId: string = undefined;
        let filename: string;
        let autoChooseBoard: boolean = true;
        let dependencies: pxt.Map<string> = {};
        let features: string[] = undefined;
        let temporary = false;

        let markdown: string;

        if (pxt.commands.onMarkdownActivityLoad) {
            await pxt.commands.onMarkdownActivityLoad(path, title, editorProjectName);
        }

        try {
            if (/^\//.test(path)) {
                filename = title || path.split('/').reverse()[0].replace('-', ' '); // drop any kind of sub-paths
                pxt.perf.measureStart("downloadMarkdown");
                const rawMarkdown = await pxt.Cloud.markdownAsync(path, undefined, undefined, true);
                pxt.perf.measureEnd("downloadMarkdown");
                autoChooseBoard = true;
                markdown = processMarkdown(rawMarkdown);
            } else if (scriptId) {
                pxt.tickEvent("tutorial.shared", { tutorial: scriptId });
                const files = await workspace.downloadFilesByIdAsync(scriptId)
                const pxtJson = pxt.Package.parseAndValidConfig(files["pxt.json"]);
                pxt.Util.jsonMergeFrom(dependencies, pxtJson.dependencies);
                filename = pxtJson.name || lf("Untitled");
                autoChooseBoard = false;
                reportId = scriptId;
                const md = files["README.md"];
                markdown = processMarkdown(md);
            } else if (!!ghid && ghid.owner && ghid.project) {
                pxt.tickEvent("tutorial.github");
                pxt.log(`loading tutorial from ${ghid.fullName}`)
                pxt.perf.measureStart("downloadGitHubTutorial");
                const config = await pxt.packagesConfigAsync();

                const status = pxt.github.repoStatus(ghid, config);
                switch (status) {
                    case pxt.github.GitRepoStatus.Banned:
                        throw lf("This GitHub repository has been banned.");
                    case pxt.github.GitRepoStatus.Approved:
                        reportId = undefined;
                        break;
                    default:
                        reportId = "https://github.com/" + ghid.slug;
                        break;
                }

                let gh = await pxt.github.downloadTutorialMarkdownAsync(path, ghid.tag);
                pxt.perf.measureEnd("downloadGitHubTutorial");

                // check for cached tutorial info, save into IndexedDB if found
                if (gh?.files[pxt.TUTORIAL_INFO_FILE]) {
                    await pxt.tutorial.parseCachedTutorialInfo(gh.files[pxt.TUTORIAL_INFO_FILE], path);
                }
                if (gh) {
                    markdown = resolveMarkdown(ghid, gh.files);
                }
            } else if (header) {
                pxt.tickEvent("tutorial.header");
                temporary = true;
                const hghid = pxt.github.parseRepoId(header.githubId);
                const hfileName = path.split(':')[1] || "README";
                const script = await workspace.getTextAsync(header.id);
                markdown = resolveMarkdown(ghid, script, hfileName)
            }

            return {
                reportId,
                filename,
                autoChooseBoard,
                dependencies,
                features,
                temporary,
                md: markdown
            };
        }
        catch (e) {
            core.handleNetworkError(e);
            core.errorNotification(lf("Oops, we could not load this activity."));
            this.openHome(); // don't stay stranded
            return undefined;
        }

        function processMarkdown(md: string) {
            if (!md) return md;

            if (editorProjectName == pxt.JAVASCRIPT_PROJECT_NAME) { // spy => typescript
                md = md.replace(/^```(blocks|block|spy)\b/gm, "```typescript");
            } else if (editorProjectName == pxt.PYTHON_PROJECT_NAME) { // typescript => spy
                md = md.replace(/^```(blocks|block|typescript)\b/gm, "```spy");
            }

            pxt.Util.jsonMergeFrom(dependencies, pxt.gallery.parsePackagesFromMarkdown(md));
            features = pxt.gallery.parseFeaturesFromMarkdown(md);
            return md;
        }

        function resolveMarkdown(ghid: pxt.github.ParsedRepo, files: pxt.Map<string>, fileName?: string): string {
            const pxtJson = pxt.Package.parseAndValidConfig(files["pxt.json"]);
            // if there is any .ts file in the tutorial repo,
            // add as a dependency itself
            if (pxtJson.files.find(f => /\.ts$/.test(f))) {
                dependencies = {}
                dependencies[ghid.project] = pxt.github.toGithubDependencyPath(ghid.slug, ghid.tag);
            }
            else {// just use dependencies from the tutorial
                pxt.Util.jsonMergeFrom(dependencies, pxtJson.dependencies);
            }
            filename = pxtJson.name || lf("Untitled");
            autoChooseBoard = false;
            let md = pxt.tutorial.resolveLocalizedMarkdown(ghid, files, fileName);
            return processMarkdown(md);
        }
    }

    private async startTutorialAsync(tutorialId: string, tutorialTitle?: string, recipe?: boolean, editorProjectName?: string, previousHeaderId?: string, carryoverCode?: boolean): Promise<void> {
        // custom tick for recipe or tutorial "completion". recipes use links in the markdown to
        // progress, so we track when a user "exits" a recipe by loading a new one
        if (this.state.header?.tutorial?.tutorial) {
            pxt.tickEvent("recipe.exit", { tutorial: this.state.header?.tutorial?.tutorial, goto: tutorialId });
            pxt.tickEvent("tutorial.finish", { tutorial: this.state.header?.tutorial?.tutorial });
        }

        core.hideDialog();
        core.showLoading("tutorial", lf("starting tutorial..."));
        sounds.initTutorial(); // pre load sounds
        // make sure we are in the editor
        recipe = recipe && !!this.state.header;

        try {
            const r = await this.loadActivityFromMarkdownAsync(tutorialId, tutorialTitle, editorProjectName)
            const { filename, dependencies, temporary, reportId, autoChooseBoard, features, md } = (r || {});
            if (!md)
                throw new Error(lf("Tutorial {0} not found", tutorialId));

            const { options, editor: parsedEditor } = pxt.tutorial.getTutorialOptions(md, tutorialId, filename, reportId, !!recipe);
            this.hintManager.clearViewedHints();

            options.mergeCarryoverCode = carryoverCode;
            options.mergeHeaderId = previousHeaderId;

            // pick tutorial editor
            const editor = editorProjectName || parsedEditor;

            // start a tutorial within the context of an existing program
            if (recipe) {
                const header = pkg.mainEditorPkg().header;
                header.tutorial = options;
                header.tutorialCompleted = undefined;
                await this.loadHeaderAsync(header);
            }
            else {
                await this.createProjectAsync({
                    name: filename,
                    tutorial: options,
                    preferredEditor: editor,
                    dependencies,
                    temporary: temporary,
                    skillmapProject: pxt.BrowserUtils.isSkillmapEditor()
                });
                if (autoChooseBoard) {
                    await this.autoChooseBoardAsync(features);
                }
                this.postTutorialProgress();
            }
        }
        catch (e) {
            pxt.reportException(e, { tutorialId });
            core.warningNotification(lf("Please check your internet connection and check the tutorial is valid."));
            // go home if possible
            this.openHome();
        }
        finally {
            core.hideLoading("tutorial")
        }
    }

    async startActivity(opts: pxt.editor.StartActivityOptions) {
        const { activity, path, editor, title, focus, importOptions, previousProjectHeaderId, carryoverPreviousCode } = opts;

        pxt.perf.measureStart("startActivity");

        this.textEditor.giveFocusOnLoading = focus;
        switch (activity) {
            case "tutorial":
                pxt.tickEvent("tutorial.start", { tutorial: path, editor: editor });
                await this.startTutorialAsync(path, title, false, editor, opts.previousProjectHeaderId, opts.carryoverPreviousCode);
                break;
            case "recipe":
                pxt.tickEvent("recipe.start", { recipe: path, editor: editor });
                await this.startTutorialAsync(path, title, true, editor);
                break;
            case "example":
                pxt.tickEvent("example.start", { example: path, editor: editor });
                await this.importExampleAsync({ name: title, path, preferredEditor: editor, ...importOptions });
                break;
        }

        pxt.perf.measureEnd("startActivity")
    }

    async completeTutorialAsync(): Promise<void> {
        pxt.tickEvent("tutorial.finish", { tutorial: this.state.header?.tutorial?.tutorial });
        pxt.tickEvent("tutorial.complete", { tutorial: this.state.header?.tutorial?.tutorial });
        core.showLoading("leavingtutorial", lf("leaving tutorial..."));
        this.postTutorialCompleted();

        // clear tutorial field
        const tutorial = this.state.header.tutorial;
        if (tutorial && !this.state.header.isSkillmapProject) {
            // don't keep track of completion for microtutorials
            if (this.state.tutorialOptions && this.state.tutorialOptions.tutorialRecipe)
                this.state.header.tutorialCompleted = undefined;
            else
                this.state.header.tutorialCompleted = {
                    id: tutorial.tutorial,
                    steps: tutorial.tutorialStepInfo.length
                }
            this.state.header.tutorial = undefined;
        }
        const isSkillmap = pxt.BrowserUtils.isSkillmapEditor();

        try {
            await this.exitTutorialAsync();
            if (!isSkillmap) {
                const curr = pkg.mainEditorPkg().header;
                await this.loadHeaderAsync(curr);
            }
        } finally {
            core.hideLoading("leavingtutorial");
        }

        if (isSkillmap) {
            return;
        }

        if (this.state.collapseEditorTools && !pxt.appTarget.simulator.headless) {
            this.expandSimulator();
        }
        this.postTutorialProgress();
        if (pxt.appTarget.cloud?.sharing && pxt.appTarget.appTheme.shareFinishedTutorials) {
            pxt.tickEvent("tutorial.share", undefined, { interactiveConsent: false });
            this.showShareDialog(lf("Well done! Would you like to share your project?"));
        }
        this.showMiniSim(pxt.BrowserUtils.isTabletSize());
    }

    exitTutorial(removeProject?: boolean) {
        pxt.tickEvent("tutorial.exit", { tutorial: this.state.header?.tutorial?.tutorial });
        core.showLoading("leavingtutorial", lf("leaving tutorial..."));
        this.postTutorialExit();

        this.exitTutorialAsync(removeProject)
            .finally(() => {
                core.hideLoading("leavingtutorial");
                this.openHome();
            })
    }

    async exitTutorialAsync(removeProject?: boolean): Promise<void> {
        let curr = pkg.mainEditorPkg().header;
        curr.isDeleted = removeProject;
        let files = pkg.mainEditorPkg().getAllFiles();

        try {
            await workspace.saveAsync(curr, files)
            await Util.delay(500)
        }
        catch (e) { }
        finally {
            core.resetFocus();
            await this.setStateAsync({
                tutorialOptions: undefined,
                tracing: undefined,
                editorState: undefined
            });
            if (this.state.header) await workspace.saveAsync(this.state.header);
        }
    }

    showTutorialHint(showFullText?: boolean) {
        let tc = this.refs[ProjectView.tutorialCardId] as tutorial.TutorialCard;
        if (tc) tc.showHint(true, showFullText);
    }

    isTutorial() {
        return this.state.tutorialOptions != undefined;
    }

    onEditorContentLoaded() {
        if (this.isTutorial()) {
            pxt.tickEvent("tutorial.editorLoaded")
            this.postTutorialLoaded();

            pxt.perf.recordMilestone("editorContentLoaded");
            if (!this.autoRunOnStart()) {
                pxt.analytics.trackPerformanceReport();
            }
        }

        const msg: pxt.editor.EditorContentLoadedRequest = {
            type: "pxthost",
            action: "editorcontentloaded"
        };

        pxteditor.postHostMessageAsync(msg);

        // Deprecated: This was originally fired with the "pxteditor"
        // type, which should only be used for responses, not events.
        // Use the pxthost version above instead
        pxteditor.postHostMessageAsync({
            ...msg,
            type: "pxteditor"
        });

        if (this.pendingImport) {
            this.pendingImport.resolve();
            this.pendingImport = undefined;
        }

        if (this.shouldFocusToolbox) {
            this.shouldFocusToolbox = false;
            if (this.state.currFile && this.editor) {
                this.editor.focusToolbox(CategoryNameID.Extensions);
            }
        }
    }

    setEditorOffset() {
        if (this.isTutorial()) {
            if (!pxt.BrowserUtils.useOldTutorialLayout()) {
                const tutorialElements = document?.getElementsByClassName("tutorialWrapper");
                const tutorialEl = tutorialElements?.length === 1 ? (tutorialElements[0] as HTMLElement) : undefined;
                if (tutorialEl && (pxt.BrowserUtils.isTabletSize() || pxt.appTarget.appTheme.tutorialSimSidebarLayout)) {
                    this.setState({ editorOffset: tutorialEl.offsetHeight + "px" });
                } else {
                    this.setState({ editorOffset: undefined });
                }
            } else {
                const tc = document.getElementById("tutorialcard");
                if (tc) {
                    const flyoutOnly =
                        this.state.editorState?.hasCategories === false
                        || this.state.tutorialOptions?.metadata?.flyoutOnly
                        || this.state.tutorialOptions?.metadata?.hideToolbox;

                    let headerHeight = 0;
                    if (flyoutOnly) {
                        const headers = document.getElementById("headers");
                        headerHeight = headers.offsetHeight;
                    }
                    const offset = tc.offsetHeight + headerHeight;
                    this.setState({ editorOffset: `${offset}px` });
                }
            }
        }
    }

    private saveTutorialTemplateAsync() {
        return pkg.mainEditorPkg().buildAssetsAsync()
            .then(() => pkg.mainPkg.saveToJsonAsync())
            .then(project => {
                pxt.BrowserUtils.browserDownloadText(project.source, pkg.genFileName(".assets.mkcd"))
            })
    }

    ///////////////////////////////////////////////////////////
    ////////////     User alert/notifications     /////////////
    ///////////////////////////////////////////////////////////

    pokeUserActivity() {
        if (!!this.state.tutorialOptions && !!this.state.tutorialOptions.tutorial) {
            // animate tutorial hint after some time of user inactivity
            this.hintManager.pokeUserActivity(ProjectView.tutorialCardId, this.state.tutorialOptions.tutorialStep, this.state.tutorialOptions.tutorialHintCounter);
        }
    }

    stopPokeUserActivity() {
        this.hintManager.stopPokeUserActivity();
    }

    clearUserPoke() {
        this.setState({ pokeUserComponent: null });
    }

    setHintSeen(step: number) {
        this.hintManager.viewedHint(step);
    }

    private tutorialCardHintCallback() {
        let tutorialOptions = this.state.tutorialOptions;
        tutorialOptions.tutorialHintCounter = tutorialOptions.tutorialHintCounter + 1;

        this.setState({
            pokeUserComponent: ProjectView.tutorialCardId,
            tutorialOptions: tutorialOptions
        });

        setTimeout(() => this.clearUserPoke(), 10000);
    }

    ///////////////////////////////////////////////////////////
    ////////////         High contrast            /////////////
    ///////////////////////////////////////////////////////////

    toggleHighContrast() {
        core.toggleHighContrast();
        pxt.tickEvent("app.highcontrast", { on: core.getHighContrastOnce() ? 1 : 0 });
        if (this.isSimulatorRunning()) {  // if running, send updated high contrast state.
            this.startSimulator()
        }
    }

    setHighContrast(on: boolean) {
        return core.setHighContrast(on);
    }

    toggleGreenScreen() {
        const greenScreenOn = !this.state.greenScreen;
        pxt.tickEvent("app.greenscreen", { on: greenScreenOn ? 1 : 0 });
        this.setState({ greenScreen: greenScreenOn });
    }

    toggleAccessibleBlocks() {
        this.setAccessibleBlocks(!this.state.accessibleBlocks);
    }

    setAccessibleBlocks(enabled: boolean) {
        pxt.tickEvent("app.accessibleblocks", { on: enabled ? 1 : 0 });
        this.blocksEditor.enableAccessibleBlocks(enabled);
        this.setState({ accessibleBlocks: enabled })
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
    ////////////             Onboarding           /////////////
    ///////////////////////////////////////////////////////////

    hideOnboarding() {
        this.setState({ onboarding: undefined });
    }

    async showOnboarding() {
        const tourSteps: pxt.tour.BubbleStep[] = await parseTourStepsAsync(pxt.appTarget.appTheme?.tours?.editor)
        this.setState({ onboarding: tourSteps })

    }

    ///////////////////////////////////////////////////////////
    ////////////             Key map              /////////////
    ///////////////////////////////////////////////////////////

    showKeymap(show: boolean) {
        this.setState({ keymap: show });
    }

    toggleKeymap() {
        if (this.state.keymap) {
            this.showKeymap(false);
        } else {
            this.showKeymap(true);
        }
    }

    ///////////////////////////////////////////////////////////
    ////////////         Script Manager           /////////////
    ///////////////////////////////////////////////////////////

    private handleScriptManagerDialogClose = () => {
        // When the script manager dialog closes, we want to refresh our projects list in case anything has changed
        this.home.forceUpdate();
        // Sync the workspace
        workspace.syncAsync();
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

    private handleNewProjectDialogRef = (c: projects.NewProjectDialog) => {
        this.newProjectDialog = c;
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

    private handleLoginDialogRef = (c: identity.LoginDialog) => {
        this.loginDialog = c;
    }

    private handleProfileDialogRef = (c: user.ProfileDialog) => {
        this.profileDialog = c;
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
        const isBlocks = !this.editor.isVisible || this.getPreferredEditor() === pxt.BLOCKS_PROJECT_NAME;
        const sideDocs = !(sandbox || targetTheme.hideSideDocs);
        const tutorialCompleted = !!this.state.header?.tutorialCompleted;
        const tutorialOptions = tutorialCompleted ? undefined : this.state.tutorialOptions;
        const inTutorial = !!tutorialOptions && !!tutorialOptions.tutorial;
        const isSidebarTutorial = pxt.appTarget.appTheme.sidebarTutorial;
        const isTabTutorial = inTutorial && !pxt.BrowserUtils.useOldTutorialLayout();
        const inTutorialExpanded = inTutorial && tutorialOptions.tutorialStepExpanded;
        const tutorialSimSidebar = pxt.appTarget.appTheme.tutorialSimSidebarLayout && !pxt.BrowserUtils.isTabletSize();
        const inDebugMode = this.state.debugging;
        const inHome = this.state.home && !sandbox;
        const inEditor = !!this.state.header && !inHome;
        const { lightbox, greenScreen, accessibleBlocks } = this.state;
        const hideTutorialIteration = inTutorial && tutorialOptions.metadata?.hideIteration;
        const hideToolbox = inTutorial && tutorialOptions.metadata?.hideToolbox;
        // flyoutOnly has become a de facto css class for styling tutorials (especially minecraft HOC), so keep it if hideToolbox is true, even if flyoutOnly is false.
        const flyoutOnly = this.state.editorState?.hasCategories === false || (inTutorial && (tutorialOptions.metadata?.flyoutOnly || hideToolbox));
        const { hideEditorToolbar, transparentEditorToolbar } = targetTheme;
        const hideMenuBar = targetTheme.hideMenuBar || hideTutorialIteration || (isTabTutorial && pxt.appTarget.appTheme.embeddedTutorial) || pxt.shell.isTimeMachineEmbed();
        const isHeadless = simOpts && simOpts.headless;
        const selectLanguage = targetTheme.selectLanguage;
        const showEditorToolbar = inEditor && !hideEditorToolbar && this.editor.hasEditorToolbar();
        const useSerialEditor = pxt.appTarget.serial && !!pxt.appTarget.serial.useEditor;
        const showSideDoc = sideDocs && this.state.sideDocsLoadUrl && !this.state.sideDocsCollapsed;
        const showCollapseButton = showEditorToolbar && !inHome && !sandbox && !targetTheme.simCollapseInMenu && (!isHeadless || inDebugMode) && !isTabTutorial;
        const shouldHideEditorFloats = this.state.hideEditorFloats || this.state.collapseEditorTools;
        const logoWide = !!targetTheme.logoWide;
        const hwDialog = !sandbox && pxt.hasHwVariants();
        const editorOffset = ((inTutorialExpanded || isTabTutorial) && this.state.editorOffset) ? { top: this.state.editorOffset } : undefined;
        const invertedTheme = targetTheme.invertedMenu && targetTheme.invertedMonaco;
        const isMultiplayerSupported = targetTheme.multiplayer;
        const isMultiplayerGame = this.state.isMultiplayerGame;
        const collapseIconTooltip = this.state.collapseEditorTools ? lf("Show the simulator") : lf("Hide the simulator");
        const isApp = cmds.isNativeHost() || pxt.BrowserUtils.isElectron();
        const hc = this.getData<boolean>(auth.HIGHCONTRAST)

        let rootClassList = [
            "ui",
            lightbox ? 'dimmable dimmed' : 'dimmable',
            shouldHideEditorFloats ? "hideEditorFloats" : '',
            this.state.collapseEditorTools ? "collapsedEditorTools" : '',
            transparentEditorToolbar ? "transparentEditorTools" : '',
            invertedTheme ? 'inverted-theme' : '',
            this.state.fullscreen ? 'fullscreensim' : '',
            this.state.showMiniSim ? 'miniSim' : '',
            hc ? 'hc' : '',
            showSideDoc ? 'sideDocs' : '',
            pxt.shell.layoutTypeClass(),
            inHome ? 'inHome' : '',
            inTutorial && !isTabTutorial ? 'tutorial' : '',
            inTutorialExpanded && !isTabTutorial ? 'tutorialExpanded' : '',
            isTabTutorial ? 'tabTutorial' : '',
            isSidebarTutorial ? 'sidebarTutorial' : '',
            tutorialSimSidebar ? 'tutorialSimSidebar' : '',
            inDebugMode ? 'debugger' : '',
            pxt.options.light ? 'light' : '',
            pxt.BrowserUtils.isTouchEnabled() ? 'has-touch' : '',
            hideMenuBar ? 'hideMenuBar' : '',
            !showEditorToolbar || transparentEditorToolbar ? 'hideEditorToolbar' : '',
            this.state.bannerVisible && !inHome ? "notificationBannerVisible" : "",
            this.state.debugging ? "debugging" : "",
            sandbox && this.isEmbedSimActive() ? 'simView' : '',
            isApp ? "app" : "",
            greenScreen ? "greenscreen" : "",
            logoWide ? "logo-wide" : "",
            isHeadless ? "headless" : "",
            flyoutOnly ? "flyoutOnly" : "",
            hideToolbox ? "hideToolbox" : "",
            hideTutorialIteration ? "hideIteration" : "",
            this.editor != this.blocksEditor ? "editorlang-text" : "",
            this.editor == this.textEditor && this.state.errorListState,
            'full-abs',
            pxt.appTarget.appTheme.embeddedTutorial ? "tutorial-embed" : "",
        ];
        this.rootClasses = rootClassList;
        const rootClasses = sui.cx(rootClassList);

        if (this.state.hasError) {
            return <div id="root" className="ui middle aligned center aligned grid" style={{ height: '100%', alignItems: 'center' }}>
                <div className="ui raised segment inverted purple">
                    <h2>{lf("Oops")}</h2>
                    {lf("We detected a problem and we will reload the editor in a few seconds..")}
                </div>
            </div>
        }
        const isRTL = pxt.Util.isUserLanguageRtl();
        const showRightChevron = (this.state.collapseEditorTools || isRTL) && !(this.state.collapseEditorTools && isRTL); // Collapsed XOR RTL
        // don't show in sandbox or is blocks editor or previous editor is blocks or assets editor
        const showFileList = !sandbox && !inTutorial && !this.isAssetsActive()
            && !(isBlocks
                || (pkg.mainPkg && pkg.mainPkg.config && (pkg.mainPkg.config.preferredEditor == pxt.BLOCKS_PROJECT_NAME)));
        const hasIdentity = pxt.auth.hasIdentity();
        return (
            <div id='root' className={rootClasses}>
                {this.state.extensionsVisible &&
                    <extensionsBrowser.ExtensionsBrowser
                        hideExtensions={this.hidePackageDialog}
                        importExtensionCallback={() => this.showImportFileDialog({ extension: true })}
                        header={this.state.header}
                        reloadHeaderAsync={async () => {
                            await this.reloadHeaderAsync()
                            this.shouldFocusToolbox = !!this.state.accessibleBlocks;
                        }}
                    />
                }
                {greenScreen ? <greenscreen.WebCam close={this.toggleGreenScreen} /> : undefined}
                {accessibleBlocks && <accessibleblocks.AccessibleBlocksInfo />}
                {hideMenuBar || inHome ? undefined :
                    <header className="menubar" role="banner">
                        {inEditor ? <accessibility.EditorAccessibilityMenu parent={this} highContrast={hc} /> : undefined}
                        <notification.NotificationBanner parent={this} />
                        <headerbar.HeaderBar parent={this} />
                    </header>}
                {isSidebarTutorial && flyoutOnly && inTutorial && <sidebarTutorial.SidebarTutorialCard ref={ProjectView.tutorialCardId} parent={this} pokeUser={this.state.pokeUserComponent == ProjectView.tutorialCardId} />}
                {inTutorial && !isTabTutorial && <div id="maineditor" className={sandbox ? "sandbox" : ""} role="main">
                    {!(isSidebarTutorial && flyoutOnly) && inTutorial && <tutorial.TutorialCard ref={ProjectView.tutorialCardId} parent={this} pokeUser={this.state.pokeUserComponent == ProjectView.tutorialCardId} />}
                    {flyoutOnly && <tutorial.WorkspaceHeader parent={this} workspaceId={this.editor.getId()} />}
                </div>}
                <sidepanel.Sidepanel parent={this} inHome={inHome}
                    showKeymap={this.state.keymap && simOpts.keymap}
                    showSerialButtons={useSerialEditor}
                    showFileList={showFileList}
                    showFullscreenButton={!isHeadless}
                    showHostMultiplayerGameButton={isMultiplayerSupported && isMultiplayerGame}
                    collapseEditorTools={this.state.collapseEditorTools}
                    simSerialActive={this.state.simSerialActive}
                    devSerialActive={this.state.deviceSerialActive}
                    showMiniSim={this.showMiniSim}
                    openSerial={this.openSerial}
                    handleHardwareDebugClick={this.hwDebug}
                    handleFullscreenButtonClick={this.toggleSimulatorFullscreen}
                    tutorialOptions={isTabTutorial ? tutorialOptions : undefined}
                    tutorialSimSidebar={tutorialSimSidebar}
                    onTutorialStepChange={this.setTutorialStep}
                    onTutorialComplete={this.completeTutorialAsync}
                    setEditorOffset={this.setEditorOffset} />
                <div id="maineditor" className={(sandbox ? "sandbox" : "") + (inDebugMode ? "debugging" : "")} role="main" aria-hidden={inHome}>
                    {showCollapseButton && <sui.Button id='computertogglesim' className={`computer only collapse-button large`} icon={`inverted chevron ${showRightChevron ? 'right' : 'left'}`} title={collapseIconTooltip} onClick={this.toggleSimulatorCollapse} />}
                    {this.allEditors.map(e => e.displayOuter(editorOffset))}
                </div>
                {inHome ? <div id="homescreen" className="full-abs">
                    <div className="ui home projectsdialog">
                        <header className="menubar" role="banner">
                            <accessibility.HomeAccessibilityMenu parent={this} highContrast={hc} />
                            <headerbar.HeaderBar parent={this} />
                        </header>
                        <projects.Projects parent={this} ref={this.handleHomeRef} />
                    </div>
                </div> : undefined}
                {showEditorToolbar && <editortoolbar.EditorToolbar ref="editortools" parent={this} />}
                {sideDocs ? <container.SideDocs ref="sidedoc" parent={this} sideDocsCollapsed={this.state.sideDocsCollapsed} docsUrl={this.state.sideDocsLoadUrl} /> : undefined}
                {sandbox ? undefined : <scriptsearch.ScriptSearch parent={this} ref={this.handleScriptSearchRef} />}
                {sandbox ? undefined : <extensions.Extensions parent={this} ref={this.handleExtensionRef} />}
                {inHome ? <projects.ImportDialog parent={this} ref={this.handleImportDialogRef} /> : undefined}
                {hasIdentity ? <identity.LoginDialog parent={this} ref={this.handleLoginDialogRef} /> : undefined}
                {hasIdentity ? <user.ProfileDialog parent={this} ref={this.handleProfileDialogRef} /> : undefined}
                {inHome && targetTheme.scriptManager ? <scriptmanager.ScriptManagerDialog parent={this} ref={this.handleScriptManagerDialogRef} onClose={this.handleScriptManagerDialogClose} /> : undefined}
                {sandbox ? undefined : <projects.ExitAndSaveDialog parent={this} ref={this.handleExitAndSaveDialogRef} />}
                {sandbox ? undefined : <projects.NewProjectDialog parent={this} ref={this.handleNewProjectDialogRef} />}
                {hwDialog ? <projects.ChooseHwDialog parent={this} ref={this.handleChooseHwDialogRef} /> : undefined}
                {sandbox || !sharingEnabled ? undefined : <share.ShareEditor parent={this} ref={this.handleShareEditorRef} loading={this.state.publishing} />}
                {selectLanguage ? <lang.LanguagePicker parent={this} ref={this.handleLanguagePickerRef} /> : undefined}
                {sandbox ? <container.SandboxFooter parent={this} /> : undefined}
                {hideMenuBar ? <div id="editorlogo"><a className="poweredbylogo"></a></div> : undefined}
                {lightbox ? <sui.Dimmer isOpen={true} active={lightbox} portalClassName={'tutorial'} className={'ui modal'}
                    shouldFocusAfterRender={false} closable={true} onClose={this.hideLightbox} /> : undefined}
                {this.state.onboarding && <Tour tourSteps={this.state.onboarding} onClose={this.hideOnboarding} />}
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

function parseLocalToken() {
    const qs = Util.parseQueryString((location.hash || "#").slice(1).replace(/%local_token/, "local_token"))
    if (qs["local_token"]) {
        pxt.storage.setLocal("local_token", qs["local_token"])
        location.hash = location.hash.replace(/(%23)?[\#\&\?]*local_token.*/, "")
    }
    Cloud.localToken = pxt.storage.getLocal("local_token") || "";
}


function initPacketIO() {
    pxt.debug(`packetio: hook events`)
    pxt.packetio.configureEvents(
        () => data.invalidate("packetio:*"),
        (buf, isErr) => {
            try {
                const data = Util.fromUTF8(Util.uint8ArrayToString(buf))
                //pxt.debug('serial: ' + data)
                window.postMessage({
                    type: 'serial',
                    id: 'n/a', // TODO
                    data
                }, "*")
            } catch (e) {
                // data decoding failed, ignore
                pxt.debug(`invalid utf8 serial data`, { buf, e })
            }
        },
        (type, payload) => {
            const messageSimulators = pxt.appTarget.simulator?.messageSimulators;
            if (messageSimulators?.[type]) {
                window.postMessage({
                    type: "messagepacket",
                    broadcast: false,
                    channel: type,
                    data: payload,
                    sender: "packetio",
                }, "*")
            }
        });

    window.addEventListener('message', (ev: MessageEvent) => {
        const msg = ev.data
        if (msg.type === 'messagepacket'
            && msg.sender !== "packetio"
            && pxt.appTarget.simulator?.messageSimulators?.[msg.channel]
            && msg.channel === pxt.HF2.CUSTOM_EV_JACDAC)
            pxt.packetio.sendCustomEventAsync(msg.channel, msg.data)
                .then(() => { }, err => {
                    core.errorNotification(lf("{0}: {1}", msg.channel, err.message));
                });
    }, false);
}

function initSerial() {
    const isValidLocalhostSerial = pxt.appTarget.serial && pxt.BrowserUtils.isLocalHost() && !!Cloud.localToken;

    if (!isValidLocalhostSerial && !pxt.usb.isEnabled)
        return;

    if (hidbridge.shouldUse() || pxt.usb.isEnabled)
        return;

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
    pxt.analytics.enable(pxt.Util.userLanguage());
    pxteditor.enableControllerAnalytics();

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
        const body = document.firstElementChild; // body
        if (body) {
            stats["screen.clientWidth"] = body.clientWidth;
            stats["screen.clientHeight"] = body.clientHeight;
        }
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
    pxt.log(v)
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

function handleHash(newHash: { cmd: string; arg: string }, loading: boolean): boolean {
    if (!newHash) return false;
    let editor = theEditor;
    if (!editor) return false;

    if (isProjectRelatedHash(newHash)) editor.setState({ home: false });

    switch (newHash.cmd) {
        case "doc":
            pxt.tickEvent("hash.doc")
            editor.setSideDoc(newHash.arg, editor.editor === editor.blocksEditor);
            break;
        case "follow":
            pxt.tickEvent("hash.follow")
            editor.newEmptyProject(undefined, newHash.arg);
            return true;
        case "newproject": // shortcut to create a new blocks proj
            pxt.tickEvent("hash.newproject")
            editor.newProject();
            pxt.BrowserUtils.changeHash("");
            return true;
        case "newjavascript": // shortcut to create a new JS proj
            pxt.tickEvent("hash.newjavascript");
            editor.newProject({
                preferredEditor: pxt.JAVASCRIPT_PROJECT_NAME
            });
            pxt.BrowserUtils.changeHash("");
            return true;
        case "newpython": // shortcut to create a new python proj
            pxt.tickEvent("hash.newpython");
            editor.newProject({
                preferredEditor: pxt.PYTHON_PROJECT_NAME
            });
            pxt.BrowserUtils.changeHash("");
            return true;
        case "testproject": {// create new project that references the given extension
            pxt.tickEvent("hash.testproject");
            const hid = newHash.arg;
            const header = workspace.getHeader(hid);
            if (header) {
                const existing = workspace.getHeaders().filter(hd => hd.extensionUnderTest == header.id)[0];
                if (existing)
                    editor.loadHeaderAsync(existing);
                else {
                    editor.newProject({
                        prj: pxt.appTarget.blocksprj,
                        name: lf("test {0}", header.name),
                        extensionUnderTest: hid
                    });
                }
            }
            pxt.BrowserUtils.changeHash("");
            return true;
        }
        case "gettingstarted": {
            pxt.tickEvent("hash.gettingstarted");
            editor.newProject();
            pxt.BrowserUtils.changeHash("");
            return true;
        }
        // shortcut to a tutorial. eg: #tutorial:tutorials/getting-started
        // or #tutorial:py:tutorials/getting-started
        case "tutorial":
        case "example":
        case "recipe": {
            pxt.tickEvent("hash." + newHash.cmd)
            hash = newHash;
            let tutorialPath = newHash.arg;
            let editorProjectName: string = undefined;
            if (/^([jt]s|py|blocks?):/i.test(tutorialPath)) {
                if (/^py:/i.test(tutorialPath))
                    editorProjectName = pxt.PYTHON_PROJECT_NAME;
                else if (/^[jt]s:/i.test(tutorialPath))
                    editorProjectName = pxt.JAVASCRIPT_PROJECT_NAME;
                else
                    editorProjectName = pxt.BLOCKS_PROJECT_NAME;
                tutorialPath = tutorialPath.substr(tutorialPath.indexOf(':') + 1)
            }
            editor.startActivity({
                activity: newHash.cmd,
                path: tutorialPath,
                editor: editorProjectName,
                focus: false
            });
            pxt.BrowserUtils.changeHash("editor");
            return true;
        }
        case "home": // shortcut to home
            pxt.tickEvent("hash.home");
            editor.openHome();
            pxt.BrowserUtils.changeHash("");
            return true;
        case "sandbox":
        case "pub":
        case "edit": // load a published proj, eg: #pub:27750-32291-62442-22749
            pxt.tickEvent("hash." + newHash.cmd);
            pxt.BrowserUtils.changeHash("");
            if (/^(github:|https:\/\/github\.com\/)/.test(newHash.arg))
                importGithubProject(newHash.arg);
            else
                loadHeaderBySharedId(newHash.arg);
            return true;
        case "header":
            pxt.tickEvent("hash." + newHash.cmd);
            pxt.BrowserUtils.changeHash("");
            editor.loadHeaderAsync(workspace.getHeader(newHash.arg));
            return true;
        case "sandboxproject":
        case "project":
            pxt.tickEvent("hash." + newHash.cmd);
            const fileContents = Util.stringToUint8Array(atob(newHash.arg));
            pxt.BrowserUtils.changeHash("");
            core.showLoading("loadingproject", lf("loading project..."));
            editor.importProjectFromFileAsync(fileContents)
                .finally(() => core.hideLoading("loadingproject"));
            return true;
        case "reload": // need to reload last project - handled later in the load process
            if (loading) pxt.BrowserUtils.changeHash("");
            return false;
        case "skillmapimport":
            const headerId = newHash.arg;
            core.showLoading("skillmapimport", lf("loading project..."));
            editor.importSkillmapProjectAsync(headerId)
                .finally(() => {
                    pxt.BrowserUtils.changeHash("");
                    core.hideLoading("skillmapimport")
                });
            return true;
        case "embedimport":
            const importId = newHash.arg;
            core.showLoading("embedimport", lf("loading project..."));
            editor.importEmbedProjectAsync(importId)
                .finally(() => {
                    pxt.BrowserUtils.changeHash("");
                    core.hideLoading("embedimport")
                });
            return true;
        case "github": {
            const repoid = pxt.github.parseRepoId(newHash.arg);
            const [ghCmd, ghArg] = newHash.arg.split(':', 2);
            pxt.BrowserUtils.changeHash("");
            const provider = cloudsync.githubProvider();
            if (!provider)
                return false;
            // #github:owner/user --> import
            // #github:create-repository:headerid --> create repo
            // #github:import -> import dialog
            if (ghCmd === "create-repository") {
                // #github:create-repository:HEADERID
                const hd = workspace.getHeader(ghArg);
                if (hd) {
                    // ignore if token is not set
                    if (!provider.hasToken())
                        return false;
                    theEditor.loadHeaderAsync(hd)
                        .then(() => provider.createRepositoryAsync(hd.name, hd))
                        .then(r => r && theEditor.reloadHeaderAsync())
                    return true;
                }
            }
            else if (ghCmd === "import") {
                dialogs.showImportGithubDialogAsync();
                return true;
            } else if (repoid) {
                importGithubProject(newHash.arg, true);
                return true;
            }
            break;
        }
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
        case "testproject":
        // case "gettingstarted": // This should be true, #gettingstarted hash handling is not yet implemented
        case "tutorial":
        case "example":
        case "recipe":
        case "projects":
        case "sandbox":
        case "pub":
        case "edit":
        case "sandboxproject":
        case "project":
        case "header":
            return true;
        case "github":
        default:
            return false;
    }
}

async function importGithubProject(repoid: string, requireSignin?: boolean) {
    if (!pxt.appTarget.appTheme.githubEditor || pxt.BrowserUtils.isPxtElectron()) {
        core.warningNotification(lf("Importing GitHub projects not currently supported"));
        theEditor.openHome();
        return;
    }

    core.showLoading("loadingheader", lf("importing GitHub project..."));
    try {
        const config = await pxt.packagesConfigAsync();
        const parsedRepoId = pxt.github.parseRepoId(repoid);
        const repo = await pxt.github.repoAsync(parsedRepoId.slug, config);
        // normalize for precise matching
        repoid = pxt.github.normalizeRepoId(repoid, repo?.defaultBranch);
        // try to find project with same id
        let hd = workspace.getHeaders().find(h => h.githubId &&
            pxt.github.normalizeRepoId(h.githubId) == repoid
        );
        if (!hd) {
            if (requireSignin) {
                const token = await cloudsync.githubProvider(true).routedLoginAsync(repoid);
                if (!token.accessToken) { // did not sign in, give up
                    theEditor.openHome();
                    return;
                }
            }
            hd = await workspace.importGithubAsync(repoid);
        }
        if (hd)
            await theEditor.loadHeaderAsync(hd, null)
        else
            theEditor.openHome();
    } catch (e) {
        core.handleNetworkError(e)
        theEditor.openHome();
    } finally {
        core.hideLoading("loadingheader")
    }
}

function loadHeaderBySharedId(id: string) {
    core.showLoading("loadingheader", lf("loading project..."));

    workspace.installByIdAsync(id)
        .then(hd => theEditor.loadHeaderAsync(hd, null))
        .catch(e => {
            theEditor.openHome();
            core.handleNetworkError(e);
        })
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
        return /save(?:as)?blocks=1/i.test(window.location.href) && !!pkg.mainPkg.readFile(pxt.MAIN_BLOCKS)
    } catch (e) { return false; }
}

function saveTutorialTemplate(): boolean {
    try {
        return /save(?:as)?template=1/i.test(window.location.href)
    } catch (e) { return false; }
}

function initExtensionsAsync(): Promise<void> {
    if (!pxt.appTarget.appTheme || !pxt.appTarget.appTheme.extendEditor) return Promise.resolve();

    pxt.debug('loading editor extensions...');
    const opts: pxt.editor.ExtensionOptions = {
        blocklyToolbox: blocklyToolbox.getToolboxDefinition(),
        monacoToolbox: monacoToolbox.getToolboxDefinition(),
        projectView: theEditor,
        showNotification: (msg) => core.infoNotification(msg)
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
            cmds.setExtensionResult(res);
        });
}

function projectNameForEditor(editor: string): string {
    switch (editor.toLowerCase()) {
        case "javascript":
        case "js":
        case pxt.JAVASCRIPT_PROJECT_NAME:
            return pxt.JAVASCRIPT_PROJECT_NAME;
        case "python":
        case "py":
        case pxt.PYTHON_PROJECT_NAME:
            return pxt.PYTHON_PROJECT_NAME;
        case "blocks":
        case pxt.BLOCKS_PROJECT_NAME:
        default:
            return pxt.BLOCKS_PROJECT_NAME;
    }
}

function filenameForEditor(editor: string): string {
    const file = pkg.getEditorPkg(pkg.mainPkg)?.getMainFile();
    switch (editor.toLowerCase()) {
        case "javascript":
        case "js":
        case pxt.JAVASCRIPT_PROJECT_NAME:
            return file.getVirtualFileName(pxt.JAVASCRIPT_PROJECT_NAME);
        case "python":
        case "py":
        case pxt.PYTHON_PROJECT_NAME:
            return file.getVirtualFileName(pxt.PYTHON_PROJECT_NAME);
        case "assets":
        case "asset":
            return pxt.ASSETS_FILE;
        case "blocks":
        case pxt.BLOCKS_PROJECT_NAME:
        default:
            return file.getVirtualFileName(pxt.BLOCKS_PROJECT_NAME);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    pxt.perf.recordMilestone(`DOM loaded`)

    pxt.setupWebConfig((window as any).pxtConfig);
    const config = pxt.webConfig

    const optsQuery = Util.parseQueryString(window.location.href.toLowerCase());
    if (optsQuery["dbg"] == "1") {
        pxt.setLogLevel(pxt.LogLevel.Debug);
    }
    pxt.options.light = optsQuery["light"] == "1" || pxt.BrowserUtils.isARM() || pxt.BrowserUtils.isIE();
    if (pxt.options.light) {
        pxsim.U.addClass(document.body, 'light');
    }
    if (optsQuery["wsport"]) {
        pxt.options.wsPort = parseInt(optsQuery["wsport"]) || 3233;
        pxt.BrowserUtils.changeHash(window.location.hash.replace(`wsport=${optsQuery["wsport"]}`, ""));
    } else {
        pxt.options.wsPort = 3233;
    }
    if (optsQuery["consoleticks"] == "1" || optsQuery["consoleticks"] == "verbose") {
        pxt.analytics.consoleTicks = pxt.analytics.ConsoleTickOptions.Verbose;
    } else if (optsQuery["consoleticks"] == "2" || optsQuery["consoleticks"] == "short") {
        pxt.analytics.consoleTicks = pxt.analytics.ConsoleTickOptions.Short;
    }
    if (optsQuery["tooltipblockids"] == "1") {
        pxt.blocks.showBlockIdInTooltip = true;
    }


    pxt.perf.measureStart("setAppTarget");
    pkg.setupAppTarget((window as any).pxtTargetBundle);

    initGitHubDb();

    // DO NOT put any async code before this line! The serviceworker must be initialized before
    // the window load event fires
    appcache.init(() => theEditor.reloadEditor());
    pxt.setBundledApiInfo((window as any).pxtTargetBundle.apiInfo);
    pxt.perf.measureEnd("setAppTarget");

    let theme = pxt.appTarget.appTheme;
    const isControllerIFrame = theme.allowParentController || pxt.shell.isControllerMode()
    // disable auth in iframe scenarios
    if (isControllerIFrame)
        pxt.auth.enableAuth(false);
    enableAnalytics()

    if (!pxt.BrowserUtils.isBrowserSupported() && !/skipbrowsercheck=1/i.exec(window.location.href)) {
        pxt.tickEvent("unsupported");
        window.location.href = "/browsers";
        core.showLoading("browsernotsupported", lf("Sorry, this browser is not supported."));
        return;
    } else if (pxt.BrowserUtils.isWinRT()) {
        pxt.tickEvent("redirected.winrt");
        window.location.href = "/v4";
        core.showLoading("micro:bit-winrt-reload", lf("Redirecting to MakeCode micro:bit v4"));
        return;
    }

    const query = Util.parseQueryString(window.location.href);

    // Handle auth callback redirect.
    if (query["authcallback"]) {
        await auth.loginCallbackAsync(query);
    }

    await auth.initAsync();

    // Trigger the login process if autologin is specified. Required for Clever.
    const autoLogin = query["autologin"] as pxt.IdentityProviderId;
    if (autoLogin) {
        await auth.loginAsync(autoLogin, true);
    }

    cloud.init(); // depends on auth.init() and workspace.ts's top level
    cloudsync.loginCheck()
    parseLocalToken();
    hash = parseHash();
    blocklyFieldView.init();

    pxt.react.getTilemapProject = () => {
        const epkg = pkg.mainEditorPkg();

        if (!epkg.tilemapProject) {
            epkg.tilemapProject = new pxt.TilemapProject();
            epkg.tilemapProject.loadPackage(pkg.mainPkg);
        }

        return epkg.tilemapProject;
    }

    let loadCount = 0;
    pxt.hexloader.showLoading = (msg) => {
        loadCount++;
        if (loadCount === 1) {
            core.showLoading("hexcloudcompiler", msg);
        }
    };
    pxt.hexloader.hideLoading = () => {
        loadCount--;
        if (loadCount === 0) {
            core.hideLoading("hexcloudcompiler");
        }
    };
    pxt.docs.requireMarked = () => require("marked");

    // allow static web site to specify custom backend
    if (pxt.appTarget.cloud?.apiRoot)
        Cloud.apiRoot = pxt.appTarget.cloud.apiRoot
    else {
        const hm = /^(https:\/\/[^/]+)/.exec(window.location.href)
        if (hm) Cloud.apiRoot = hm[1] + "/api/"
    }

    if (query["hw"]) {
        pxt.setHwVariant(query["hw"])
        pxt.tickEvent("projects.choosehwvariant", {
            hwid: pxt.hwVariant,
            card: "QUERY-" + pxt.hwVariant
        });
    }

    pxt.setCompileSwitches(query["compiler"] || query["compile"])

    // github token set in cloud provider

    const isSandbox = pxt.shell.isSandboxMode() || pxt.shell.isReadOnly();

    if (query["ws"]) workspace.setupWorkspace(query["ws"]);
    else if (isControllerIFrame) workspace.setupWorkspace("iframe");
    else if (isSandbox) workspace.setupWorkspace("mem");
    else if (pxt.BrowserUtils.isIpcRenderer()) workspace.setupWorkspace("idb");
    else if (pxt.BrowserUtils.isPxtElectron()) workspace.setupWorkspace("fs");
    else workspace.setupWorkspace("browser");

    Promise.resolve()
        .then(async () => {
            const href = window.location.href;
            let force = false;
            const userLang = data.getData<string>(auth.LANGUAGE);
            // kick of a user preferences check; if the language is different we'll request they reload
            auth.initialUserPreferencesAsync().then((pref) => {
                const cookieLang = pxt.BrowserUtils.getCookieLang()
                if (cookieLang && pref && pref.language && pref.language != cookieLang) {
                    pxt.BrowserUtils.setCookieLang(pref.language);
                    core.infoNotification(lf("Reload the page to apply your new language preference."));
                    pxt.tickEvent(`identity.preferences.askingUserToReloadToApplyLang`)
                }
            })
            let useLang: string = undefined;
            if (/[&?]translate=1/.test(href) && !pxt.BrowserUtils.isIE()) {
                pxt.log(`translation mode`);
                force = true;
                pxt.Util.enableLiveLocalizationUpdates();
                useLang = ts.pxtc.Util.TRANSLATION_LOCALE;
            } else {
                const hashLangMatch = /(live)?(force)?lang=([a-z]{2,}(-[A-Z]+)?)/i.exec(window.location.href);
                if (hashLangMatch && window.location.hash.indexOf(hashLangMatch[0]) >= 0) {
                    pxt.BrowserUtils.changeHash(window.location.hash.replace(hashLangMatch[0], ""));
                }
                const requestLive = !!hashLangMatch?.[1];
                const requestedForce = !!hashLangMatch?.[2];
                const hashLang = hashLangMatch?.[3];
                const cookieLang = pxt.BrowserUtils.getCookieLang()
                // chose the user's language using the following ordering:
                useLang = hashLang || userLang || cookieLang || theme.defaultLocale || (navigator as any).userLanguage || navigator.language;

                const locstatic = /staticlang=1/i.test(window.location.href);
                const defLocale = pxt.appTarget.appTheme.defaultLocale;
                const langLowerCase = useLang?.toLocaleLowerCase();
                const localDevServe = pxt.BrowserUtils.isLocalHostDev()
                    && (!langLowerCase || (defLocale
                        ? defLocale.toLocaleLowerCase() === langLowerCase
                        : "en" === langLowerCase || "en-us" === langLowerCase));
                const serveLocal = pxt.BrowserUtils.isPxtElectron() || localDevServe;
                const stringUpdateDisabled = locstatic || serveLocal || theme.disableLiveTranslations;

                if (!stringUpdateDisabled || requestLive) {
                    pxt.Util.enableLiveLocalizationUpdates();
                }
                force = requestedForce;
            }
            const targetId = pxt.appTarget.id;
            const baseUrl = config.commitCdnUrl;
            return Util.updateLocalizationAsync({
                targetId: targetId,
                baseUrl: baseUrl,
                code: useLang,
                force: force,
            }).then(() => {
                if (pxt.Util.isLocaleEnabled(useLang)) {
                    pxt.BrowserUtils.setCookieLang(useLang);
                    lang.setInitialLang(useLang);
                } else {
                    pxt.tickEvent("unavailablelocale", { lang: useLang, force: (force ? "true" : "false") });
                }
                pxt.tickEvent("locale", { lang: pxt.Util.userLanguage(), live: (pxt.Util.liveLocalizationEnabled() ? "true" : "false") });
                // Download sim translations and save them in the sim
                // don't wait!
                Util.downloadTranslationsAsync(
                    targetId, baseUrl, useLang, pxt.Util.liveLocalizationEnabled(), Util.TranslationsKind.Sim)
                    .then(simStrings => simStrings && simulator.setTranslations(simStrings))
            });
        })
        .then(() => {
            pxt.BrowserUtils.initTheme();
            theme = pxteditor.experiments.syncTheme();
            // editor messages need to be enabled early, in case workspace provider is IFrame
            if (theme.allowParentController
                || theme.allowPackageExtensions
                || theme.allowSimulatorTelemetry
                || pxt.shell.isControllerMode())
                pxteditor.bindEditorMessages(getEditorAsync);
            return workspace.initAsync().then(async s => {
                // Poll cloud for changes after workspace is initialized
                await cloud.syncAsync(); return s;
            });
        })
        .then((state) => {
            render(); // this sets theEditor
            if (state)
                theEditor.setState({ editorState: state });
            return initExtensionsAsync(); // need to happen before cmd init
        }).then(() => cmds.initAsync())
        .then(() => {
            initPacketIO();
            initSerial();
            initHashchange();
            socketbridge.tryInit();
            electron.initElectron(theEditor);
        })
        .then(() => {
            const showHome = theEditor.shouldShowHomeScreen();
            if (!showHome) {
                // Hide the home screen
                theEditor.setState({ home: false });
            }

            if (hash.cmd && handleHash(hash, true)) {
                return Promise.resolve();
            }
            if (pxt.shell.isNoProject()) {
                pxteditor.postHostMessageAsync({
                    action: "newproject",
                    options: { preferredEditor: "blocks" }
                } as pxt.editor.EditorMessageNewProjectRequest)
                return Promise.resolve();
            }
            if (showHome) return Promise.resolve();


            // default handlers
            const ent = theEditor.settings.fileHistory.filter(e => !!workspace.getHeader(e.id))[0];
            let hd = workspace.getHeaders()[0];
            if (ent) hd = workspace.getHeader(ent.id);
            if (hd) return theEditor.loadHeaderAsync(hd, theEditor.state.editorState)
            else theEditor.newProject();
            return Promise.resolve();
        })
        .catch(e => {
            theEditor.handleCriticalError(e, "Failure in DOM loaded handler");
            throw e;
        })
        .then(() => {
            pxsim.U.remove(document.getElementById('loading'));
            return workspace.loadedAsync();
        });

    document.addEventListener("visibilitychange", async ev => {
        if (theEditor)
            await theEditor.updateVisibilityAsync();
    });

    window.addEventListener("unload", ev => {
        if (theEditor)
            theEditor.saveSettings()
        // don't lock device while being away from tab
        cmds.disconnectAsync();
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

            // Check to see if we should show the mini simulator (<= tablet size)
            if (!theEditor.isTutorial() || pxt.appTarget.appTheme.tutorialSimSidebarLayout || pxt.BrowserUtils.useOldTutorialLayout()) {
                if (pxt.BrowserUtils.isTabletSize()) {
                    theEditor.showMiniSim(true);
                } else {
                    theEditor.showMiniSim(false);
                }
            }

            if (theEditor.isTutorial() && !pxt.BrowserUtils.useOldTutorialLayout()) {
                // For the tabbed tutorial, set the editor offset
                theEditor.setEditorOffset();
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

        if (m.type == "tutorial" || m.type == "opendoc") {
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

    // Disable right-click in locked editor to prevent "Back". (Blockly context menu still enabled)
    if (pxt.appTarget.appTheme.lockedEditor) {
        window.addEventListener('contextmenu', function (e) {
            e.preventDefault();
        }, false);
    }
})
