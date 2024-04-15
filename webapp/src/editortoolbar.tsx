/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as githubbutton from "./githubbutton";
import * as cmds from "./cmds"
import * as identity from "./identity";
import * as compiler from "./compiler"
import { ProjectView } from "./app";
import { userPrefersDownloadFlagSet } from "./webusb";
import { dialogAsync, hideDialog } from "./core";
import * as AdmZip from "adm-zip";
import { v4 as uuidv4 } from "uuid";

import ISettingsProps = pxt.editor.ISettingsProps;
import SimState = pxt.editor.SimState;

const Logo128 = "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";

// TEMP. TODO: Move these somewhere else
const pxtSimJsContentAsync: Promise<string> = new Promise((resolve, reject) => {
    pxt.Util.httpGetTextAsync("/cdn/pxtsim.js")
        .then((pxtSimJsContent) => {
            resolve(pxtSimJsContent);
        })
        .catch((e) => {
            reject(e);
        });
    });
const simJsContentAsync: Promise<string> = new Promise((resolve, reject) => {
    pxt.Util.httpGetTextAsync("/sim/sim.js")
        .then((simJsContent) => {
            resolve(simJsContent);
        })
        .catch((e) => {
            reject(e);
        });
    });

const MC_SCRIPT_PREAMBLE = () => `
import { system, world } from "@minecraft/server";
`;

const MC_ENTRY_POINT = (script: string) => `
const mc_entrypoint = ${script};
`;

const MC_SCRIPT_POSTAMBLE = () => `
pxsim.timers._runTimeoutFn = function (handler, timeout) {
    return system.runTimeout(handler, timeout);
};
pxsim.timers._runIntervalFn = function (handler, timeout) {
    return system.runInterval(handler, timeout);
};
pxsim.timers._clearTimeoutFn = function (id) {
    system.clearRun(id);
};
pxsim.timers._clearIntervalFn = function (id) {
    system.clearRun(id);
};
const mc_runtime = new pxsim.Runtime({
    type: "run",
    entryPointFn: mc_entrypoint,
});
mc_runtime.errorHandler = function (e) {
    throw e;
};
mc_runtime.run();
`;


type ModuleDependency = {
    module_name: string,
    version: string
};
type ResourceDependency = {
    uuid: string,
    version: [number, number, number]
};
type MCDependency = ModuleDependency | ResourceDependency;

const MinecraftServerModuleDep: ModuleDependency = {
    "module_name": "@minecraft/server",
    "version": "1.8.0"
};

const MC_RESOURCE_PACK = (opts: {
    resourcePackUuid: string,
    dependencies: MCDependency[],
    projectName: string
}) => {
    return JSON.stringify({
        "format_version": 2,
        "header": {
          "name": `${opts.projectName} resource pack`,
          "description": `Resource pack for ${opts.projectName}`,
          "uuid": opts.resourcePackUuid,
          "version": [
            1,
            0,
            0
          ],
          "min_engine_version": [
            1,
            20,
            30
          ]
        },
        "modules": [
          {
            "description": "resources",
            "type": "resources",
            "uuid": uuidv4(),
            "version": [
              1,
              0,
              0
            ]
          }
        ],
        "dependencies": opts.dependencies
      }, null, 2);
}

const MC_BEHAVIOR_PACK = (opts: {
    behaviorPackUuid: string,
    dependencies: MCDependency[],
    projectName: string
}) => {
    return JSON.stringify({
        "format_version": 2,
        "header": {
        "name": `${opts.projectName} behavior pack`,
        "description": `Behavior pack for ${opts.projectName}`,
        "uuid": opts.behaviorPackUuid,
        "version": [
            1,
            0,
            0
        ],
        "min_engine_version": [
            1,
            20,
            30
        ]
        },
        "modules": [
        {
            "description": "Script resources",
            "language": "javascript",
            "type": "script",
            "uuid": uuidv4(),
            "version": [
            1,
            0,
            0
            ],
            "entry": "scripts/main.js"
        }
        ],
        "dependencies": opts.dependencies,
    }, null, 2);
}

const enum View {
    Computer,
    Tablet,
    Mobile,
}

interface EditorToolbarState {
    compileState: "compiling" | "success" | null;
}

export class EditorToolbar extends data.Component<ISettingsProps, EditorToolbarState> {
    protected compileTimeout: ReturnType<typeof setTimeout>;

    constructor(props: ISettingsProps) {
        super(props);

        this.saveProjectName = this.saveProjectName.bind(this);
        this.compile = this.compile.bind(this);
        this.saveFile = this.saveFile.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
        this.zoomIn = this.zoomIn.bind(this);
        this.zoomOut = this.zoomOut.bind(this);
        this.startStopSimulator = this.startStopSimulator.bind(this);
        this.toggleDebugging = this.toggleDebugging.bind(this);
        this.toggleCollapsed = this.toggleCollapsed.bind(this);
        this.cloudButtonClick = this.cloudButtonClick.bind(this);
    }

    saveProjectName(name: string, view?: string) {
        pxt.tickEvent("editortools.projectrename", { view: view }, { interactiveConsent: true });
        this.props.parent.updateHeaderName(name);
    }

    compile(view?: string) {
        this.setState({ compileState: "compiling" });
        pxt.tickEvent("editortools.download", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.compile();
    }

    saveFile(view?: string) {
        pxt.tickEvent("editortools.save", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.saveAndCompile();
    }

    undo(view?: string) {
        pxt.tickEvent("editortools.undo", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.editor.undo();
    }

    redo(view?: string) {
        pxt.tickEvent("editortools.redo", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.editor.redo();
    }

    zoomIn(view?: string) {
        pxt.tickEvent("editortools.zoomIn", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.editor.zoomIn();
        this.props.parent.forceUpdate();
    }

    zoomOut(view?: string) {
        pxt.tickEvent("editortools.zoomOut", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        this.props.parent.editor.zoomOut();
        this.props.parent.forceUpdate();
    }

    startStopSimulator(view?: string) {
        pxt.tickEvent("editortools.startStopSimulator", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() }, { interactiveConsent: true });
        this.props.parent.startStopSimulator({ clickTrigger: true });
    }

    toggleDebugging(view?: string) {
        pxt.tickEvent("editortools.debug", { view: view, collapsed: this.getCollapsedState(), headless: this.getHeadlessState() }, { interactiveConsent: true });
        this.props.parent.toggleDebugging();
    }

    toggleCollapsed() {
        pxt.tickEvent("editortools.portraitToggleCollapse", { collapsed: this.getCollapsedState(), headless: this.getHeadlessState() }, { interactiveConsent: true });
        this.props.parent.toggleSimulatorCollapse();
    }

    cloudButtonClick(view?: string) {
        pxt.tickEvent("editortools.cloud", { view: view, collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        // TODO: do anything?
    }

    componentDidUpdate() {
        if (this.props.parent.state.compiling) {
            if (!this.state?.compileState) {
                this.setState({ compileState: "compiling" });
            }
        }
        else if (this.state?.compileState === "compiling") {
            if (this.props.parent.state.cancelledDownload) {
                this.setState({ compileState: null });
            }
            else {
                this.setState({ compileState: "success" });
                if (this.compileTimeout) clearTimeout(this.compileTimeout);
                this.compileTimeout = setTimeout(() => {
                    if (this.state?.compileState === "success") this.setState({ compileState: null });
                }, 2000)
            }
        }
    }

    componentWillUnmount() {
        if (this.compileTimeout) clearTimeout(this.compileTimeout)
    }

    private getCollapsedState(): string {
        return '' + this.props.parent.state.collapseEditorTools;
    }

    private getHeadlessState(): string {
        return pxt.appTarget.simulator.headless ? "true" : "false";
    }

    private getSaveInput(showSave: boolean, id?: string, projectName?: string, projectNameReadOnly?: boolean): JSX.Element[] {
        let saveButtonClasses = "";
        if (this.props.parent.state.isSaving) {
            saveButtonClasses = "loading disabled";
        } else if (!!this.props.parent.state.compiling) {
            saveButtonClasses = "disabled";
        }

        let saveInput = [];
        saveInput.push(<label htmlFor={id} className="accessible-hidden phone hide" key="label">{lf("Type a name for your project")}</label>);
        saveInput.push(<EditorToolbarSaveInput id={id} view={this.getViewString(View.Computer)} key="input"
            type="text"
            aria-labelledby={id}
            placeholder={lf("Pick a name...")}
            value={projectName || ''}
            onChangeValue={this.saveProjectName}
            disabled={projectNameReadOnly}
            readOnly={projectNameReadOnly}
        />)
        if (showSave) {
            saveInput.push(<EditorToolbarButton icon='save' className={`right attached editortools-btn save-editortools-btn ${saveButtonClasses}`} title={lf("Save")} ariaLabel={lf("Save the project")} onButtonClick={this.saveFile} view={this.getViewString(View.Computer)} key={`save${View.Computer}`} />)
        }

        return saveInput;
    }

    private getZoomControl(view: View): JSX.Element[] {
        return [<EditorToolbarButton icon='minus circle' className="editortools-btn zoomout-editortools-btn" title={lf("Zoom Out")} onButtonClick={this.zoomOut} view={this.getViewString(view)} key="minus" />,
        <EditorToolbarButton icon='plus circle' className="editortools-btn zoomin-editortools-btn" title={lf("Zoom In")} onButtonClick={this.zoomIn} view={this.getViewString(view)} key="plus" />]
    }

    protected getUndoRedo(view: View): JSX.Element[] {
        const hasUndo = this.props.parent.editor.hasUndo();
        const hasRedo = this.props.parent.editor.hasRedo();
        return [
            <EditorToolbarButton icon='xicon undo' className={`editortools-btn undo-editortools-btn ${!hasUndo ? 'disabled' : ''}`} title={lf("Undo")} ariaLabel={lf("{0}, {1}", lf("Undo"), !hasUndo ? lf("Disabled") : "")} onButtonClick={this.undo} view={this.getViewString(view)} key="undo" />,
            <EditorToolbarButton icon='xicon redo' className={`editortools-btn redo-editortools-btn ${!hasRedo ? 'disabled' : ''}`} title={lf("Redo")} ariaLabel={lf("{0}, {1}", lf("Redo"), !hasRedo ? lf("Disabled") : "")} onButtonClick={this.redo} view={this.getViewString(view)} key="redo" />
        ];
    }

    protected getViewString(view: View): string {
        return view.toString().toLowerCase();
    }

    protected onHwItemClick = () => {
        if (pxt.hasHwVariants())
            this.props.parent.showChooseHwDialog(true);
        else
            this.props.parent.showBoardDialogAsync(undefined, true);

    }

    buildAndDownloadMcAddOnAsync = async () => {
        const compileResp = await compiler.compileAsync();
        if (compileResp && compileResp.success && compileResp.outfiles[pxtc.BINARY_JS]) {
            const pxtsimJsContent = await pxtSimJsContentAsync;
            const simJsContent = await simJsContentAsync;
            const entryPoint = MC_ENTRY_POINT(compileResp.outfiles[pxtc.BINARY_JS]);
            const preamble = MC_SCRIPT_PREAMBLE();
            const postamble = MC_SCRIPT_POSTAMBLE();
            // concat: preamble + pxtsim.js + sim.js + binary.js + postamble
            const mainJs = `${preamble}\n${pxtsimJsContent}\n${simJsContent}\n${entryPoint}\n${postamble}`;

            const projectName = this.props.parent.state.projectName || lf("Untitled");
            const baseFilename = pxt.Util.sanitizeFileName(projectName);
            const mcaddonFilename = baseFilename + ".mcaddon";
            const bpFilename = baseFilename + "_bp.mcpack";
            const rpFilename = baseFilename + "_rp.mcpack";

            const resourcePackUuid = pxt.Util.guidGen();
            const behaviorPackUuid = pxt.Util.guidGen();
            const resourcePackDep: ResourceDependency = {
                uuid: resourcePackUuid,
                version: [1, 0, 0]
            };
            const behaviorPackDep: ResourceDependency = {
                uuid: behaviorPackUuid,
                version: [1, 0, 0]
            };
            const resourcePackManifestJson = MC_RESOURCE_PACK({
                resourcePackUuid,
                dependencies: [behaviorPackDep],
                projectName
            });
            const behaviorPackManifestJson = MC_BEHAVIOR_PACK({
                behaviorPackUuid,
                dependencies: [MinecraftServerModuleDep, resourcePackDep],
                projectName
            });

            // Create the resource pack mcpack file
            const rpZip = new AdmZip();
            rpZip.addFile("manifest.json", Buffer.from(resourcePackManifestJson));
            rpZip.addFile("pack_icon.png", Buffer.from(Logo128, "base64"));
            const rpZipBlob = rpZip.toBuffer();

            // Create the behavior pack mcpack file
            const bpZip = new AdmZip();
            bpZip.addFile("manifest.json", Buffer.from(behaviorPackManifestJson));
            bpZip.addFile("pack_icon.png", Buffer.from(Logo128, "base64"));
            bpZip.addFile("scripts/main.js", Buffer.from(mainJs));
            const bpZipBlob = bpZip.toBuffer();

            // Create the mcaddon file
            const mcaddonZip = new AdmZip();
            mcaddonZip.addFile(rpFilename, rpZipBlob);
            mcaddonZip.addFile(bpFilename, bpZipBlob);
            const mcaddonZipBlob = mcaddonZip.toBuffer();

            // Download the mcaddon file
            pxt.BrowserUtils.browserDownloadUInt8Array(new Uint8Array(mcaddonZipBlob), mcaddonFilename, {
                contentType: "application/zip"
            });
       }
   }

    protected onDownloadButtonClick = async () => {
        pxt.tickEvent("editortools.downloadbutton", { collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        if (this.shouldShowPairingDialogOnDownload()
            && !pxt.packetio.isConnected()
            && !pxt.packetio.isConnecting()
        ) {
            await cmds.pairAsync(true);
        }
        if (pxt.appTarget.appTheme.id === "bedrock") {
            await this.buildAndDownloadMcAddOnAsync();
        } else {
            this.compile();
        }
    }

    protected onHwDownloadClick = () => {
        // Matching the tick in the call to compile() above for historical reasons
        pxt.tickEvent("editortools.download", { collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        pxt.tickEvent("editortools.downloadasfile", { collapsed: this.getCollapsedState() }, { interactiveConsent: true });
        (this.props.parent as ProjectView).compile(true);
    }

    protected onPairClick = () => {
        pxt.tickEvent("editortools.pair", undefined, { interactiveConsent: true });
        this.props.parent.pairAsync();
    }

    protected onCannotPairClick = async () => {
        pxt.tickEvent("editortools.pairunsupported", undefined, { interactiveConsent: true });
        const reasonUnsupported = await pxt.usb.getReasonUnavailable();
        let modalBody: string;
        switch (reasonUnsupported) {
            case "security":
                modalBody = lf("WebUSB is disabled by browser policies. Check with your admin for help.");
                break;
            case "oldwindows":
                modalBody = lf("WebUSB is not available on Windows devices with versions below 8.1.");
                break;
            case "electron":
                modalBody = lf("WebUSB is not supported in electron.");
                break;
            case "notimpl":
                modalBody = lf("WebUSB is not supported by this browser; please check for updates.");
                break;
        }

        dialogAsync({
            header: lf("Cannot Connect Device"),
            body: modalBody,
            hasCloseIcon: true,
            buttons: [
                {
                    label: lf("Okay"),
                    className: "primary",
                    onclick: hideDialog
                }
            ]
        });
    }

    protected onDisconnectClick = () => {
        cmds.showDisconnectAsync();
    }

    protected onHelpClick = () => {
        pxt.tickEvent("editortools.downloadhelp");
        window.open(pxt.appTarget.appTheme.downloadDialogTheme?.downloadMenuHelpURL);
    }

    protected shouldShowPairingDialogOnDownload = () => {
        return pxt.appTarget.appTheme.preferWebUSBDownload
            && pxt.appTarget?.compile?.webUSB
            && pxt.usb.isEnabled
            && !userPrefersDownloadFlagSet();
    }

    protected getCompileButton(view: View): JSX.Element[] {
        const collapsed = true; // TODO: Cleanup this
        const targetTheme = pxt.appTarget.appTheme;
        const { compiling, isSaving } = this.props.parent.state;
        const { compileState } = this.state;
        const compileTooltip = lf("Download your code to {0}", targetTheme.boardName);

        let downloadText: string;
        if (compileState === "success") {
            downloadText = targetTheme.useUploadMessage ? lf("Uploaded!") : lf("Downloaded!")
        }
        else {
            downloadText = targetTheme.useUploadMessage ? lf("Upload") : lf("Download")
        }


        const boards = pxt.appTarget.simulator && !!pxt.appTarget.simulator.dynamicBoardDefinition;
        const editorSupportsWebUSB = pxt.appTarget?.compile?.webUSB;
        const webUSBSupported = pxt.usb.isEnabled && editorSupportsWebUSB;
        const showUsbNotSupportedHint = editorSupportsWebUSB
            && !pxt.usb.isEnabled
            && !pxt.BrowserUtils.isPxtElectron()
            && (pxt.BrowserUtils.isChromiumEdge() || pxt.BrowserUtils.isChrome());
        const packetioConnected = !!this.getData("packetio:connected");
        const packetioConnecting = !!this.getData("packetio:connecting");
        const packetioIcon = this.getData("packetio:icon") as string;
        const hideFileDownloadIcon = view === View.Computer && this.shouldShowPairingDialogOnDownload();
        const fileDownloadIcon = targetTheme.downloadIcon || "xicon file-download";

        const successIcon = (packetioConnected && pxt.appTarget.appTheme.downloadDialogTheme?.deviceSuccessIcon)
            || "xicon file-download-check";
        const downloadIcon = (!!packetioConnecting && "ping " + packetioIcon)
            || (compileState === "success" && successIcon)
            || (!!packetioConnected && packetioIcon)
            || (!hideFileDownloadIcon && fileDownloadIcon);

        let downloadButtonClasses = "left attached ";
        const downloadButtonIcon = "ellipsis";
        let hwIconClasses = "";
        let displayRight = false;
        if (isSaving) {
            downloadButtonClasses += "disabled ";
        } else if (compiling) {
            downloadButtonClasses += "loading disabled ";
        }
        if (packetioConnected)
            downloadButtonClasses += "connected ";
        else if (packetioConnecting)
            downloadButtonClasses += "connecting ";
        switch (view) {
            case View.Mobile:
                downloadButtonClasses += "download-button-full ";
                displayRight = collapsed;
                break;
            case View.Tablet:
                downloadButtonClasses += `download-button-full ${!collapsed ? 'large fluid' : ''} `;
                hwIconClasses = !collapsed ? "large" : "";
                displayRight = collapsed;
                break;
            case View.Computer:
            default:
                downloadButtonClasses += "large fluid ";
                hwIconClasses = "large";
        }

        let el = [];
        el.push(<EditorToolbarButton key="downloadbutton" icon={downloadIcon} className={`primary download-button ${downloadButtonClasses}`} text={view != View.Mobile ? downloadText : undefined} title={compileTooltip} onButtonClick={this.onDownloadButtonClick} view='computer' />)

        const deviceName = pxt.hwName || pxt.appTarget.appTheme.boardNickname || lf("device");
        const tooltip = pxt.hwName
            || (packetioConnected && lf("Connected to {0}", deviceName))
            || (packetioConnecting && lf("Connecting..."))
            || (boards ? lf("Click to select hardware") : (webUSBSupported ? lf("Click for one-click downloads.") : undefined));

        const hardwareMenuText = view == View.Mobile ? lf("Hardware") : lf("Choose Hardware");
        const downloadMenuText = view == View.Mobile ? (pxt.hwName || lf("Download")) : lf("Download as File");
        const downloadHelp = pxt.appTarget.appTheme.downloadDialogTheme?.downloadMenuHelpURL;

        // Add the ... menu
        const usbIcon = pxt.appTarget.appTheme.downloadDialogTheme?.deviceIcon || "usb";
        el.push(
            <sui.DropdownMenu key="downloadmenu" role="menuitem" icon={`${downloadButtonIcon} horizontal ${hwIconClasses}`} title={lf("Download options")} className={`${hwIconClasses} right attached editortools-btn hw-button button`} dataTooltip={tooltip} displayAbove={true} displayRight={displayRight}>
                {webUSBSupported && !packetioConnected && <sui.Item role="menuitem" icon={usbIcon} text={lf("Connect Device")} tabIndex={-1} onClick={this.onPairClick} />}
                {showUsbNotSupportedHint && <sui.Item role="menuitem" icon={usbIcon} text={lf("Connect Device")} tabIndex={-1} onClick={this.onCannotPairClick} />}
                {webUSBSupported && (packetioConnecting || packetioConnected) && <sui.Item role="menuitem" icon={usbIcon} text={lf("Disconnect")} tabIndex={-1} onClick={this.onDisconnectClick} />}
                {boards && <sui.Item role="menuitem" icon="microchip" text={hardwareMenuText} tabIndex={-1} onClick={this.onHwItemClick} />}
                <sui.Item role="menuitem" icon="xicon file-download" text={downloadMenuText} tabIndex={-1} onClick={this.onHwDownloadClick} />
                {downloadHelp && <sui.Item role="menuitem" icon="help circle" text={lf("Help")} tabIndex={-1} onClick={this.onHelpClick} />}
            </sui.DropdownMenu>
        )

        return el;
    }

    renderCore() {
        const { tutorialOptions, projectName, compiling, isSaving, simState, debugging, editorState } = this.props.parent.state;
        const header = this.getData(`header:${this.props.parent.state.header.id}`) ?? this.props.parent.state.header;

        const targetTheme = pxt.appTarget.appTheme;
        const isController = pxt.shell.isControllerMode();
        const readOnly = pxt.shell.isReadOnly();
        const tutorial = tutorialOptions ? tutorialOptions.tutorial : false;
        const simOpts = pxt.appTarget.simulator;
        const headless = simOpts.headless;
        const flyoutOnly = editorState && editorState.hasCategories === false;

        const disableFileAccessinMaciOs = targetTheme.disableFileAccessinMaciOs && (pxt.BrowserUtils.isIOS() || pxt.BrowserUtils.isMac());
        const disableFileAccessinAndroid = pxt.appTarget.appTheme.disableFileAccessinAndroid && pxt.BrowserUtils.isAndroid();
        const ghid = header && pxt.github.parseRepoId(header.githubId);
        const hasRepository = !!ghid;
        const showSave = !readOnly && !isController && !targetTheme.saveInMenu
            && !tutorial && !debugging && !disableFileAccessinMaciOs && !disableFileAccessinAndroid
            && !hasRepository;
        const showProjectRename = !tutorial && !readOnly && !isController
            && !targetTheme.hideProjectRename && !debugging;
        const showProjectRenameReadonly = false; // always allow renaming, even for github projects
        const compile = pxt.appTarget.compile;
        const compileBtn = targetTheme.showDownloadButton || compile.hasHex || compile.saveAsPNG || compile.useUF2;
        const compileTooltip = lf("Download your code to {0}", targetTheme.boardName);
        const compileLoading = !!compiling;
        const running = simState == SimState.Running;
        const starting = simState == SimState.Starting;

        const showUndoRedo = !readOnly && !debugging && !flyoutOnly;
        const showZoomControls = !flyoutOnly;
        const showGithub = !!pxt.appTarget.cloud
            && !!pxt.appTarget.cloud.githubPackages
            && targetTheme.githubEditor
            && !pxt.BrowserUtils.isPxtElectron()
            && !readOnly && !isController && !debugging && !tutorial;

        const downloadIcon = pxt.appTarget.appTheme.downloadIcon || "download";

        const bigRunButtonTooltip = (() => {
            switch (simState) {
                case SimState.Stopped:
                    return lf("Start");
                case SimState.Pending:
                case SimState.Starting:
                    return lf("Starting");
                default:
                    return lf("Stop");
            }
        })();

        const mobile = View.Mobile;
        const computer = View.Computer;

        let downloadButtonClasses = "";
        let saveButtonClasses = "";
        if (isSaving) {
            downloadButtonClasses = "disabled";
            saveButtonClasses = "loading disabled";
        } else if (compileLoading) {
            downloadButtonClasses = "loading disabled";
            saveButtonClasses = "disabled";
        }

        return <div id="editortools" className="ui" role="region" aria-label={lf("Editor toolbar")}>
            <div id="downloadArea" role="menu" className="ui column items">{headless &&
                <div className="ui item">
                    <div className="ui icon large buttons">
                        {compileBtn && <EditorToolbarButton icon={downloadIcon} className={`primary large download-button mobile tablet hide ${downloadButtonClasses}`} title={compileTooltip} onButtonClick={this.compile} view='computer' />}
                    </div>
                </div>}
                {/* TODO clean this; make it just getCompileButton, and set the buttons fontsize to 0 / the icon itself back to normal to just hide text */}
                {!headless && <div className="ui item portrait hide">
                    {compileBtn && this.getCompileButton(computer)}
                </div>}
                {!headless && <div className="ui portrait only">
                    {compileBtn && this.getCompileButton(mobile)}
                </div>}
            </div>
            {(showProjectRename || showGithub || identity.CloudSaveStatus.wouldRender(header.id)) &&
                <div id="projectNameArea" role="menu" className="ui column items">
                    <div className={`ui right ${showSave ? "labeled" : ""} input projectname-input projectname-computer`}>
                        {showProjectRename && this.getSaveInput(showSave, "fileNameInput2", projectName, showProjectRenameReadonly)}
                        {showGithub && <githubbutton.GithubButton parent={this.props.parent} key={`githubbtn${computer}`} />}
                        <identity.CloudSaveStatus headerId={header.id} />
                    </div>
                </div>}
            <div id="editorToolbarArea" role="menu" className="ui column items">
                {showUndoRedo && <div className="ui icon buttons">{this.getUndoRedo(computer)}</div>}
                {showZoomControls && <div className="ui icon buttons mobile hide">{this.getZoomControl(computer)}</div>}
                {targetTheme.bigRunButton && !pxt.shell.isTimeMachineEmbed() &&
                    <div className="big-play-button-wrapper">
                        <EditorToolbarButton
                            className={`big-play-button play-button ${running ? "stop" : "play"}`}
                            key='runmenubtn' disabled={starting}
                            icon={running ? "stop" : "play"}
                            title={bigRunButtonTooltip} onButtonClick={this.startStopSimulator}
                            view='computer'
                        />
                    </div>}
            </div>
        </div>;
    }
}

interface ZoomSliderProps extends ISettingsProps {
    view: string;
    zoomMin?: number;
    zoomMax?: number;
}

interface ZoomSliderState {
    zoomValue: number;
}

export class ZoomSlider extends data.Component<ZoomSliderProps, ZoomSliderState> {
    private zoomMin = this.props.zoomMin ? this.props.zoomMin : 0;
    private zoomMax = this.props.zoomMax ? this.props.zoomMax : 5;

    constructor(props: ZoomSliderProps) {
        super(props);
        this.state = {zoomValue: Math.floor((this.zoomMax + 1 - this.zoomMin) / 2) + this.zoomMin};

        this.handleWheelZoom = this.handleWheelZoom.bind(this);
        this.zoomUpdate = this.zoomUpdate.bind(this);
        this.zoomOut = this.zoomOut.bind(this);
        this.zoomIn = this.zoomIn.bind(this);
    }

    componentDidMount() {
        window.addEventListener('wheel', this.handleWheelZoom);
    }

    componentWillUnmount() {
        window.removeEventListener('wheel', this.handleWheelZoom);
    }

    handleWheelZoom(e: WheelEvent) {
        if (e.ctrlKey) {
            if (e.deltaY < 0) {
                this.increaseZoomState();
            } else {
                this.decreaseZoomState();
            }
        }
    }

    private decreaseZoomState() {
        if (this.state.zoomValue > this.zoomMin) {
            this.setState({zoomValue: this.state.zoomValue - 1});
        }
    }
    private increaseZoomState() {
        if (this.state.zoomValue < this.zoomMax) {
            this.setState({zoomValue: this.state.zoomValue + 1})
        }
    }

    zoomOut() {
        if (this.state.zoomValue > this.zoomMin) {
            this.decreaseZoomState();
            this.props.parent.editor.zoomOut();
            this.props.parent.forceUpdate();
        }
    }

    zoomIn() {
        if (this.state.zoomValue < this.zoomMax) {
            this.increaseZoomState();
            this.props.parent.editor.zoomIn();
            this.props.parent.forceUpdate();
        }
    }

    zoomUpdate(e: React.ChangeEvent<HTMLInputElement>) {
        const newZoomValue = parseInt((e.target as any).value);
        if (this.state.zoomValue < newZoomValue) {
            for (let i = 0; i < (newZoomValue - this.state.zoomValue); i++) {
                this.props.parent.editor.zoomIn();
            }
        } else if (newZoomValue < this.state.zoomValue) {
            for (let i = 0; i < (this.state.zoomValue - newZoomValue); i++) {
                this.props.parent.editor.zoomOut();
            }
        }
        this.setState({zoomValue: newZoomValue});
        this.props.parent.forceUpdate();
    }

    renderCore() {
        return <div className="zoom">
            <EditorToolbarButton icon="minus circle" className="editortools-btn zoomout-editortools-btn borderless" title={lf("Zoom Out")} onButtonClick={this.zoomOut} view={this.props.view} key="minus"/>
            <div id="zoomSlider">
                <input className="zoomSliderBar" type="range" min={this.zoomMin} max={this.zoomMax} step="1" value={this.state.zoomValue.toString()} onChange={this.zoomUpdate}
                aria-valuemax={this.zoomMax} aria-valuemin={this.zoomMin} aria-valuenow={this.state.zoomValue}></input>
            </div>
            <EditorToolbarButton icon='plus circle' className="editortools-btn zoomin-editortools-btn borderless" title={lf("Zoom In")} onButtonClick={this.zoomIn} view={this.props.view} key="plus" />
        </div>
    }
}


export class SmallEditorToolbar extends EditorToolbar {
    constructor(props: ISettingsProps) {
        super(props);
    }
    renderCore() {
        return <div id="headerToolbar" className="smallEditorToolbar">
            <ZoomSlider parent={this.props.parent} view={super.getViewString(View.Computer)} zoomMin={0} zoomMax={5}></ZoomSlider>
            <div className="ui icon undo-redo-buttons">{super.getUndoRedo(View.Computer)}</div>
        </div>
    }
}


interface EditorToolbarButtonProps extends sui.ButtonProps {
    view: string;
    onButtonClick: (view: string) => void;
}

class EditorToolbarButton extends sui.StatelessUIElement<EditorToolbarButtonProps> {
    constructor(props: EditorToolbarButtonProps) {
        super(props);
        this.state = {
        }

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        const { onButtonClick, view } = this.props;
        onButtonClick(view);
    }

    renderCore() {
        const { onClick, onButtonClick, role, ...rest } = this.props;
        return <sui.Button role={role || "menuitem"} {...rest} onClick={this.handleClick} />;
    }
}

interface EditorToolbarSaveInputProps extends React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    view: string;
    onChangeValue: (value: string, view: string) => void;
}

interface EditorToolbarSaveInputState {
    editValue: string | undefined;
}

class EditorToolbarSaveInput extends React.Component<EditorToolbarSaveInputProps, EditorToolbarSaveInputState> {
    constructor(props: EditorToolbarSaveInputProps) {
        super(props);
        this.state = {
            editValue: undefined
        };
    }

    render() {
        const { onChange, onChangeValue, view, ...rest } = this.props;
        const { editValue } = this.state;


        return <input
            onChange={this.onChange}
            onBlur={this.onBlur}
            onKeyDown={this.onKeyDown}
            className="mobile hide ui"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            {...rest}
            value={editValue !== undefined ? editValue : this.props.value}
        />
    }

    protected onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({
            editValue: e.target.value
        });

        const { onChangeValue, view } = this.props;
        onChangeValue(e.target.value, view);
    }

    protected onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (!this.state.editValue) return;

        const { onChangeValue, view } = this.props;
        onChangeValue(e.target.value, view);
        this.setState({
            editValue: undefined
        });
    }

    protected onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.metaKey && !e.shiftKey) {
            (e.target as HTMLInputElement).blur();
            e.stopPropagation();
        }
    }
}
