/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";
import * as auth from "./auth";
import * as pkg from "./package";
import * as Blockly from "blockly";
import { fireClickOnEnter } from "./util";

import IProjectView = pxt.editor.IProjectView;
import ISettingsProps = pxt.editor.ISettingsProps;
import UserInfo = pxt.editor.UserInfo;
import SimState = pxt.editor.SimState;
import { sendUpdateFeedbackTheme } from "../../react-common/components/controls/Feedback/FeedbackEventListener";
import KeyboardControlsHelp from "./components/KeyboardControlsHelp";
import { MenuDropdown, MenuItem } from "../../react-common/components/controls/MenuDropdown";

// common menu items -- do not remove
// lf("About")
// lf("Getting started")
// lf("Buy")
// lf("Blocks")
// lf("Examples")
// lf("Tutorials")
// lf("Projects")
// lf("Reference")
// lf("Support")
// lf("Hardware")
// lf("Tour")

function openTutorial(parent: IProjectView, path: string) {
    pxt.tickEvent(`docs`, { path }, { interactiveConsent: true });
    parent.startActivity({
        activity: "tutorial",
        path
    });
}

function openDocs(parent: IProjectView, path: string) {
    pxt.tickEvent(`docs`, { path }, { interactiveConsent: true });
    parent.setSideDoc(path);
}

function startTour(parent: IProjectView) {
    pxt.tickEvent(`tour.start`, { origin: "help-menu" });
    parent.showOnboarding();
}

function openKeyboardNavHelp(parent: IProjectView) {
    parent.toggleBuiltInSideDoc("keyboardControls", true);
}

function renderDocItems(parent: IProjectView, elements: pxt.DocMenuEntry[], className?: string): MenuItem[] {
    const items: MenuItem[] = [];

    for (const docItem of elements) {
        const baseItem = {
            label: pxt.U.rlf(docItem.name),
            title: pxt.U.rlf(docItem.name),
            className,
        };

        if (docItem.tutorial) {
            items.push({
                ...baseItem,
                role: "menuitem",
                onClick: () => openTutorial(parent, docItem.path),
            })
        }
        else if (!/^\//.test(docItem.path)) {
            items.push({
                ...baseItem,
                role: "link",
                href: docItem.path,
                ariaLabel: docItem.name
            });
        } else {
            items.push({
                ...baseItem,
                role: "menuitem",
                onClick: () => openDocs(parent, docItem.path),
                ariaLabel: docItem.name
            });
        }
    }
    return items;
}

type DocsMenuEditorName = "Blocks" | "JavaScript" | "Python";
interface DocsMenuProps extends ISettingsProps {
    editor: DocsMenuEditorName;
    hasMainBlocksFile: boolean;
}

function showKeyboardControls() {
    const languageRestriction = pkg.mainPkg?.config?.languageRestriction;
    const pyOnly = languageRestriction === pxt.editor.LanguageRestriction.PythonOnly;
    const noBlocks = languageRestriction === pxt.editor.LanguageRestriction.NoBlocks;
    const tsOnly = languageRestriction === pxt.editor.LanguageRestriction.JavaScriptOnly;
    return !pyOnly && !tsOnly && !noBlocks && !!pkg.mainEditorPkg().files[pxt.MAIN_BLOCKS];
}

export class DocsMenu extends data.PureComponent<DocsMenuProps, {}> {
    renderCore() {
        const { parent, editor } = this.props;
        const targetTheme = pxt.appTarget.appTheme;
        const accessibleBlocksEnabled = data.getData<boolean>(auth.ACCESSIBLE_BLOCKS);

        const items: MenuItem[] = [];

        if (this.props.hasMainBlocksFile && parent.isBlocksEditor() && showKeyboardControls() && accessibleBlocksEnabled) {
            items.push({
                role: "menuitem",
                label: lf("Keyboard Controls"),
                title: lf("Keyboard Controls"),
                onClick: () => openKeyboardNavHelp(parent)
            });
        }

        if (targetTheme.tours?.editor) {
            items.push({
                role: "menuitem",
                label: lf("Tour"),
                title: lf("Tour"),
                onClick: () => startTour(parent)
            });
        }

        items.push(...renderDocItems(parent, targetTheme.docMenu));

        items.push({
            role: "menuitem",
            label: pxt.Util.rlf(this.props.editor),
            title: pxt.Util.rlf(this.props.editor),
            onClick: () => openDocs(parent,  "/" + editor.toLowerCase())
        });

        return (
            <MenuDropdown
                role="menuitem"
                title={lf("Help")}
                className="mobile-hidden help-dropdown-menuitem"
                icon="icon help circle large"
                items={items}
            />
        );
    }
}

export interface SettingsMenuProps extends ISettingsProps {
    greenScreen: boolean;
    accessibleBlocks: boolean;
    showShare?: boolean;
    inBlocks: boolean;
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
export interface SettingsMenuState {
    greenScreen?: boolean;
    accessibleBlocks?: boolean;
    showShare?: boolean;
}

export class SettingsMenu extends data.Component<SettingsMenuProps, SettingsMenuState> {
    constructor(props: SettingsMenuProps) {
        super(props);
        this.state = {
        }

        this.openSettings = this.openSettings.bind(this);
        this.showPackageDialog = this.showPackageDialog.bind(this);
        this.showBoardDialog = this.showBoardDialog.bind(this);
        this.removeProject = this.removeProject.bind(this);
        this.saveProject = this.saveProject.bind(this);
        this.toggleCollapse = this.toggleCollapse.bind(this);
        this.showReportAbuse = this.showReportAbuse.bind(this);
        this.showLanguagePicker = this.showLanguagePicker.bind(this);
        this.showThemePicker = this.showThemePicker.bind(this);
        this.toggleHighContrast = this.toggleHighContrast.bind(this);
        this.toggleGreenScreen = this.toggleGreenScreen.bind(this);
        this.toggleAccessibleBlocks = this.toggleAccessibleBlocks.bind(this);
        this.showResetDialog = this.showResetDialog.bind(this);
        this.showShareDialog = this.showShareDialog.bind(this);
        this.showFeedbackDialog = this.showFeedbackDialog.bind(this);
        this.showExitAndSaveDialog = this.showExitAndSaveDialog.bind(this);
        this.pair = this.pair.bind(this);
        this.pairBluetooth = this.pairBluetooth.bind(this);
        this.showAboutDialog = this.showAboutDialog.bind(this);
        this.showTurnBackTimeDialog = this.showTurnBackTimeDialog.bind(this);
        this.print = this.print.bind(this);
        this.signOutGithub = this.signOutGithub.bind(this);
    }

    showExitAndSaveDialog() {
        pxt.tickEvent("menu.home", undefined, { interactiveConsent: true });
        this.props.parent.showExitAndSaveDialog();
    }

    showShareDialog() {
        pxt.tickEvent("menu.share", undefined, { interactiveConsent: true });
        this.props.parent.showShareDialog();
    }

    showFeedbackDialog() {
        pxt.tickEvent("menu.feedback");
        this.props.parent.showFeedbackDialog("generic");
    }

    openSettings() {
        pxt.tickEvent("menu.settings", undefined, { interactiveConsent: true });
        this.props.parent.openSettings();
    }

    showPackageDialog() {
        pxt.tickEvent("menu.addpackage", undefined, { interactiveConsent: true });
        this.props.parent.showPackageDialog();
    }

    showBoardDialog() {
        pxt.tickEvent("menu.changeboard", undefined, { interactiveConsent: true });
        if (pxt.hasHwVariants())
            this.props.parent.showChooseHwDialog();
        else
            this.props.parent.showBoardDialogAsync(undefined, true);
    }

    saveProject() {
        pxt.tickEvent("menu.saveproject", undefined, { interactiveConsent: true });
        this.props.parent.saveAndCompile();
    }

    removeProject() {
        pxt.tickEvent("menu.removeproject", undefined, { interactiveConsent: true });
        this.props.parent.removeProject();
    }

    toggleCollapse() {
        pxt.tickEvent("menu.toggleSim", undefined, { interactiveConsent: true });
        this.props.parent.toggleSimulatorCollapse();
    }

    showReportAbuse() {
        pxt.tickEvent("menu.reportabuse", undefined, { interactiveConsent: true });
        this.props.parent.showReportAbuse();
    }

    showLanguagePicker() {
        pxt.tickEvent("menu.langpicker", undefined, { interactiveConsent: true });
        this.props.parent.showLanguagePicker();
    }

    showThemePicker() {
        pxt.tickEvent("menu.themepicker", undefined, { interactiveConsent: true });
        this.props.parent.showThemePicker();
    }

    toggleHighContrast() {
        pxt.tickEvent("menu.togglecontrast", undefined, { interactiveConsent: true });
        this.props.parent.toggleHighContrast();
    }

    toggleGreenScreen() {
        pxt.tickEvent("menu.togglegreenscreen", undefined, { interactiveConsent: true });
        this.props.parent.toggleGreenScreen();
    }

    toggleAccessibleBlocks() {
        pxt.tickEvent("menu.toggleaccessibleblocks", undefined, { interactiveConsent: true });
        this.props.parent.toggleAccessibleBlocks();
    }

    showResetDialog() {
        pxt.tickEvent("menu.reset", undefined, { interactiveConsent: true });
        pxt.tickEvent("reset"); // Deprecated, will Feb 2018.
        this.props.parent.showResetDialog();
    }

    pair() {
        pxt.tickEvent("menu.pair");
        this.props.parent.pairDialogAsync();
    }

    pairBluetooth() {
        pxt.tickEvent("menu.pair.bluetooth")
        core.showLoading("webblepair", lf("Pairing Bluetooth device..."))
        pxt.webBluetooth.pairAsync()
            .then(() => core.hideLoading("webblepair"));
    }

    showAboutDialog() {
        pxt.tickEvent("menu.about");
        this.props.parent.showAboutDialog();
    }

    showTurnBackTimeDialog() {
        pxt.tickEvent("menu.turnBackTime");
        this.props.parent.showTurnBackTimeDialogAsync();
    }

    print() {
        pxt.tickEvent("menu.print");
        this.props.parent.printCode();
    }

    signOutGithub() {
        pxt.tickEvent("menu.github.signout");
        this.props.parent.signOutGithub();
    }

    UNSAFE_componentWillReceiveProps(nextProps: SettingsMenuProps) {
        const newState: SettingsMenuState = {};
        if (nextProps.greenScreen !== undefined) {
            newState.greenScreen = nextProps.greenScreen;
        }
        if (nextProps.accessibleBlocks !== undefined) {
            newState.accessibleBlocks = nextProps.accessibleBlocks;
        }
        if (nextProps.showShare !== undefined) {
            newState.showShare = nextProps.showShare;
        }
        if (Object.keys(newState).length > 0) this.setState(newState)
    }

    shouldComponentUpdate(nextProps: SettingsMenuProps, nextState: SettingsMenuState, nextContext: any): boolean {
        return this.state.greenScreen != nextState.greenScreen
            || this.state.accessibleBlocks != nextState.accessibleBlocks
            || this.state.showShare != nextState.showShare
            || nextProps.inBlocks !== this.props.inBlocks
    }

    renderCore() {
        const hasIdentity = pxt.auth.hasIdentity();
        const highContrast = this.getData<boolean>(auth.HIGHCONTRAST)
        const { greenScreen } = this.state;
        const accessibleBlocks = this.getData<boolean>(auth.ACCESSIBLE_BLOCKS);
        const targetTheme = pxt.appTarget.appTheme;
        const packages = pxt.appTarget.cloud && !!pxt.appTarget.cloud.packages;
        const reportAbuse = pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.importing;
        const readOnly = pxt.shell.isReadOnly();
        const isController = pxt.shell.isControllerMode();
        const disableFileAccessinMaciOs = targetTheme.disableFileAccessinMaciOs && (pxt.BrowserUtils.isIOS() || pxt.BrowserUtils.isMac())
        const disableFileAccessinAndroid = pxt.appTarget.appTheme.disableFileAccessinAndroid && pxt.BrowserUtils.isAndroid();
        sendUpdateFeedbackTheme(highContrast);

        const headless = pxt.appTarget.simulator?.headless;
        const showHome = !targetTheme.lockedEditor && !isController && auth.hasIdentity();
        const showShare = this.props.showShare && pxt.appTarget.cloud?.sharing && !isController;
        const showSave = !readOnly && !isController && !!targetTheme.saveInMenu && !disableFileAccessinMaciOs && !disableFileAccessinAndroid;
        const showSimCollapse = !readOnly && !isController && !!targetTheme.simCollapseInMenu && !(headless && this.props.inBlocks);
        const showGreenScreen = targetTheme.greenScreen || /greenscreen=1/i.test(window.location.href);
        const showPrint = targetTheme.print && !pxt.BrowserUtils.isIE();
        const showProjectSettings = targetTheme.showProjectSettings;
        const docItems = targetTheme.docMenu && targetTheme.docMenu.filter(d => !d.tutorial);
        const usbIcon = pxt.appTarget.appTheme.downloadDialogTheme?.deviceIcon || "usb";

        // Electron does not currently support webusb
        // Targets with identity show github user on the profile screen.
        const githubUser = !hasIdentity && !readOnly && !isController && this.getData("github:user") as UserInfo;
        const showPairDevice = pxt.usb.isEnabled;

        const showCenterDivider = targetTheme.selectLanguage || targetTheme.highContrast || showGreenScreen || githubUser;
        const showFeedbackOption = pxt.U.ocvEnabled();

        const simCollapseText = headless ? lf("Toggle the File Explorer") : lf("Toggle the simulator");
        const extDownloadMenuItems = pxt.commands.getDownloadMenuItems?.() || [];


        const items: MenuItem[] = [];
        if (showHome) {
            items.push({
                role: "menuitem",
                className: "mobile-only",
                leftIcon: "icon home",
                title: lf("Home"),
                label: lf("Home"),
                ariaLabel: lf("Home screen"),
                onClick: this.showExitAndSaveDialog
            });
        }

        if (showShare) {
            items.push({
                role: "menuitem",
                className: "mobile-only",
                leftIcon: "icon share alternate",
                title: lf("Publish your game to create a shareable link"),
                label: lf("Share"),
                ariaLabel: lf("Share Project"),
                onClick: this.showShareDialog
            });
        }

        if (showHome || showShare) {
            items.push({ role: "separator", className: "mobile-only" });
        }

        if (showProjectSettings) {
            items.push({
                role: "menuitem",
                leftIcon: "icon options",
                label: lf("Project Settings"),
                title: lf("Project Settings"),
                onClick: this.openSettings
            });
        }

        if (packages) {
            items.push({
                role: "menuitem",
                leftIcon: "icon disk outline",
                label: lf("Extensions"),
                title: lf("Extensions"),
                onClick: this.showPackageDialog
            });
        }

        if (showPairDevice) {
            items.push({
                role: "menuitem",
                leftIcon: usbIcon,
                label: lf("Connect Device"),
                title: lf("Connect Device"),
                onClick: this.pair
            });
        }

        if (pxt.webBluetooth.isAvailable()) {
            items.push({
                role: "menuitem",
                leftIcon: "icon bluetooth",
                label: lf("Pair Bluetooth"),
                title: lf("Pair Bluetooth"),
                onClick: this.pairBluetooth
            });
        }

        if (showPrint) {
            items.push({
                role: "menuitem",
                leftIcon: "icon print",
                label: lf("Print..."),
                title: lf("Print..."),
                onClick: this.print
            });
        }

        if (showSave) {
            items.push({
                role: "menuitem",
                leftIcon: "icon save",
                label: lf("Save Project"),
                title: lf("Save Project"),
                onClick: this.saveProject
            });
        }

        if (!isController) {
            items.push({
                role: "menuitem",
                leftIcon: "icon trash",
                label: lf("Delete Project"),
                title: lf("Delete Project"),
                onClick: this.removeProject
            });
        }

        if (targetTheme.timeMachine) {
            items.push({
                role: "menuitem",
                leftIcon: "icon history",
                label: lf("Version History"),
                title: lf("Version History"),
                onClick: this.showTurnBackTimeDialog
            });
        }

        if (showSimCollapse) {
            items.push({
                role: "menuitem",
                leftIcon: "icon toggle right",
                label: simCollapseText,
                title: simCollapseText,
                onClick: this.toggleCollapse
            });
        }

        if (extDownloadMenuItems.length) {
            items.push({ role: "separator" });
            // FIXME: need to update mc to support this
            extDownloadMenuItems.forEach(props => {
                items.push({
                    role: "menuitem",
                    ...props
                });
            });
        }

        if (items.length) {
            items.push({ role: "separator" });
        }

        if (targetTheme.selectLanguage) {
            items.push({
                role: "menuitem",
                leftIcon: "xicon globe",
                label: lf("Language"),
                title: lf("Language"),
                onClick: this.showLanguagePicker
            });
        }

        items.push({
            role: "menuitem",
            leftIcon: "icon paint brush",
            label: lf("Theme"),
            title: lf("Theme"),
            onClick: this.showThemePicker
        });

        if (this.props.parent.isBlocksEditor() && showKeyboardControls()) {
            items.push({
                role: "menuitemcheckbox",
                label: lf("Keyboard Controls"),
                isChecked: accessibleBlocks,
                onChange: this.toggleAccessibleBlocks
            });
        }

        if (showGreenScreen) {
            items.push({
                role: "menuitemcheckbox",
                label: lf("Green Screen"),
                isChecked: greenScreen,
                onChange: this.toggleGreenScreen
            });
        }

        if (docItems?.length) {
            items.push({ role: "separator", className: "mobile-only" });
            items.push(...renderDocItems(this.props.parent, docItems, "mobile-only"));
        }

        if (githubUser) {
            items.push({ role: "separator" });
            items.push({
                role: "menuitem",
                className: "ui item",
                title: lf("Unlink {0} from GitHub", githubUser.name),
                onClick: this.signOutGithub,
                children: <>
                    <div className="avatar" role="presentation">
                        <img className="ui circular image" src={githubUser.photo} alt={lf("User picture")} />
                    </div>,
                    {lf("Disconnect GitHub")}
                </>
            });
        }

        if (showCenterDivider) {
            items.push({ role: "separator" });
        }

        if (reportAbuse) {
            items.push({
                role: "menuitem",
                leftIcon: "icon warning circle",
                label: lf("Report Abuse..."),
                title: lf("Report Abuse..."),
                onClick: this.showReportAbuse
            });
        }

        if (!isController) {
            items.push({
                role: "menuitem",
                leftIcon: "icon sign out",
                label: lf("Reset"),
                title: lf("Reset"),
                onClick: this.showResetDialog
            });
        }

        items.push({
            role: "menuitem",
            label: lf("About..."),
            title: lf("About..."),
            onClick: this.showAboutDialog
        });

        if (showFeedbackOption) {
            items.push({
                role: "menuitem",
                leftIcon: "icon comment",
                label: lf("Feedback"),
                title: lf("Feedback"),
                onClick: this.showFeedbackDialog
            });
        }

        return (
            <MenuDropdown items={items} title={lf("Settings")} icon="icon setting large" className="settings-menuitem" />
        );
    }
}


interface IBaseMenuItemProps extends ISettingsProps {
    onClick: (e: React.MouseEvent<HTMLElement>) => void;
    isActive: () => boolean;

    icon?: string;
    text?: string;
    title?: string;
    className?: string;
    ariaLabel?: string;
}

class BaseMenuItemProps extends data.Component<IBaseMenuItemProps, {}> {
    constructor(props: IBaseMenuItemProps) {
        super(props);
    }

    renderCore() {
        const active = this.props.isActive();
        return <sui.Item className={`base-menuitem ${this.props.className} ${active ? "selected" : ""}`} role="option" textClass="landscape only"
            text={this.props.text} icon={this.props.icon} active={active} onClick={this.props.onClick} title={this.props.title} ariaLabel={this.props.ariaLabel} />
    }
}

class JavascriptMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    protected onClick = (): void => {
        pxt.tickEvent("menu.javascript", undefined, { interactiveConsent: true });
        this.props.parent.openJavaScript();
    }

    protected isActive = (): boolean => {
        return this.props.parent.isJavaScriptActive();
    }

    renderCore() {
        return <BaseMenuItemProps className="javascript-menuitem" icon="xicon js" text="JavaScript" title={lf("Convert code to JavaScript")} onClick={this.onClick} isActive={this.isActive} parent={this.props.parent} ariaLabel={lf("Convert code to JavaScript")}/>
    }
}

class PythonMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    protected onClick = (): void => {
        pxt.tickEvent("menu.python", undefined, { interactiveConsent: true });
        this.props.parent.openPython();
    }

    protected isActive = (): boolean => {
        return this.props.parent.isPythonActive();
    }

    renderCore() {
        return <BaseMenuItemProps className="python-menuitem" icon="xicon python" text="Python" title={lf("Convert code to Python")} onClick={this.onClick} isActive={this.isActive} parent={this.props.parent} ariaLabel={lf("Convert code to Python")} />
    }
}

class BlocksMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    protected onClick = (e: React.MouseEvent<HTMLElement>): void => {
        pxt.tickEvent("menu.blocks", undefined, { interactiveConsent: true });
        this.props.parent.openBlocks();
    }

    protected isActive = (): boolean => {
        return this.props.parent.isBlocksActive();
    }

    renderCore() {
        return <BaseMenuItemProps className="blocks-menuitem" icon="xicon blocks" text={lf("Blocks")} title={lf("Convert code to Blocks")} onClick={this.onClick} isActive={this.isActive} parent={this.props.parent} ariaLabel={lf("Convert code to Blocks")}/>
    }
}

class SandboxMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    protected onClick = (): void => {
        pxt.tickEvent("menu.simView", undefined, { interactiveConsent: true });
        this.props.parent.openSimView();
    }

    protected isActive = (): boolean => {
        return this.props.parent.isEmbedSimActive();
    }

    renderCore() {
        const active = this.isActive();
        const isRunning = this.props.parent.state.simState == SimState.Running;
        const runTooltip = isRunning ? lf("Stop the simulator") : lf("Start the simulator");

        return <BaseMenuItemProps className="sim-menuitem" icon={active && isRunning ? "stop" : "play"} text={lf("Simulator")} title={!active ? lf("Show Simulator") : runTooltip} onClick={this.onClick} isActive={this.isActive} parent={this.props.parent} />
    }
}

class AssetMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    protected onClick = (): void => {
        pxt.tickEvent("menu.assets", undefined, { interactiveConsent: true });
        this.props.parent.openAssets();
    }

    protected isActive = (): boolean => {
        return this.props.parent.isAssetsActive();
    }

    renderCore() {
        return <BaseMenuItemProps className="assets-menuitem" icon="picture" text={lf("Assets")} title={lf("View project assets")} onClick={this.onClick} isActive={this.isActive} parent={this.props.parent} />
    }
}
interface IEditorSelectorProps extends ISettingsProps {
    python?: boolean;
    sandbox?: boolean;
    headless?: boolean;
    languageRestriction?: pxt.editor.LanguageRestriction;
}

export class EditorSelector extends data.Component<IEditorSelectorProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    renderCore() {
        const { python, sandbox, headless, languageRestriction, parent } = this.props;
        const dropdownActive = python && (parent.isJavaScriptActive() || parent.isPythonActive());
        const tsOnly = languageRestriction === pxt.editor.LanguageRestriction.JavaScriptOnly;
        const pyOnly = languageRestriction === pxt.editor.LanguageRestriction.PythonOnly;
        const blocksOnly = languageRestriction === pxt.editor.LanguageRestriction.BlocksOnly;
        const noJavaScript = languageRestriction === pxt.editor.LanguageRestriction.NoJavaScript;
        const noPython = languageRestriction === pxt.editor.LanguageRestriction.NoPython;
        const noBlocks = languageRestriction === pxt.editor.LanguageRestriction.NoBlocks;

        // show python in toggle if: python editor currently active, or blocks editor active & saved language pref is python
        const pythonIsActive = (parent.isPythonActive() || pxt.shell.isPyLangPref());
        const showPython = python && !tsOnly && !blocksOnly && !noPython;
        const showBlocks = !pyOnly && !tsOnly && !noBlocks && !!pkg.mainEditorPkg().files[pxt.MAIN_BLOCKS];
        const showJavaScript = !noJavaScript && !pyOnly && !blocksOnly;
        const showSandbox = sandbox && !headless;
        const showDropdown = showPython && showJavaScript && showBlocks;
        const showAssets = pxt.appTarget.appTheme.assetEditor && !sandbox;

        let textLanguage: JSX.Element = undefined;
        let secondTextLanguage: JSX.Element = undefined;

        if (showDropdown) {
            if (pythonIsActive) textLanguage = <PythonMenuItem parent={parent}/>
            else textLanguage = <JavascriptMenuItem parent={parent}/>
        }
        else if (showPython && showJavaScript) {
            textLanguage = <JavascriptMenuItem parent={parent}/>;
            secondTextLanguage  = <PythonMenuItem parent={parent}/>;
        }
        else if (showPython) {
            textLanguage = <PythonMenuItem parent={parent}/>;
        }
        else if (showJavaScript) {
            textLanguage = <JavascriptMenuItem parent={parent}/>
        }

        return (
            <div id="editortoggle" className={`ui grid padded ${(pyOnly || tsOnly) ? "one-language" : ""}`} role="listbox" aria-orientation="horizontal" aria-label={lf("Editor toggle")}>
                {showSandbox && <SandboxMenuItem parent={parent} />}
                {showBlocks && <BlocksMenuItem parent={parent} />}
                {textLanguage}
                {secondTextLanguage}
                {showDropdown && <sui.DropdownMenu id="editordropdown" role="option" icon="chevron down" rightIcon title={lf("Select code editor language")} className={`item button attached right ${dropdownActive ? "active" : ""}`}>
                    <JavascriptMenuItem parent={parent} />
                    <PythonMenuItem parent={parent} />
                </sui.DropdownMenu>}
                {showAssets && <AssetMenuItem parent={parent} />}
                <div className={`ui item toggle ${dropdownActive ? 'dropdown-attached' : ''}`}></div>
            </div>
        )
    }
}

export interface SideDocsProps extends ISettingsProps {
    docsUrl: string;
    sideDocsCollapsed: boolean;
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
export interface SideDocsState {
    docsUrl?: string;
    sideDocsCollapsed?: boolean;
}

export const builtInPrefix = "/builtin/";

export class SideDocs extends data.Component<SideDocsProps, SideDocsState> {
    private openingSideDoc = false;

    constructor(props: SideDocsProps) {
        super(props);
        this.state = {
        }

        this.toggleVisibility = this.toggleVisibility.bind(this);
        this.popOut = this.popOut.bind(this);
    }

    private rootDocsUrl(): string {
        return (pxt.webConfig.docsUrl || '/--docs') + "#";
    }

    public static notify(message: pxsim.SimulatorMessage) {
        let sd = document.getElementById("sidedocsframe") as HTMLIFrameElement;
        if (sd && sd.contentWindow) sd.contentWindow.postMessage(message, "*");
    }

    setPath(path: string, blocksEditor: boolean) {
        this.openingSideDoc = true;
        let docsUrl = this.rootDocsUrl();
        const mode = blocksEditor ? "blocks" : "js";
        const query = pxt.BrowserUtils.isPxtElectron() ? "?pxtElectron=true" : "";
        if (query && docsUrl.endsWith("#")) docsUrl = docsUrl.substr(0, docsUrl.length - 1) + query + "#";
        const url = `${docsUrl}doc:${path}:${mode}:${pxt.Util.localeInfo()}`;
        this.setUrl(url);
    }

    setMarkdown(md: string) {
        const docsUrl = this.rootDocsUrl();
        // always render blocks by default when sending custom markdown
        // to side bar
        const mode = "blocks" // this.props.parent.isBlocksEditor() ? "blocks" : "js";
        const url = `${docsUrl}md:${encodeURIComponent(md)}:${mode}:${pxt.Util.localeInfo()}`;
        this.props.parent.setState({ sideDocsLoadUrl: url });
    }

    toggleBuiltInHelp(help: pxt.editor.BuiltInHelp, focusIfVisible: boolean) {
        const url = `${builtInPrefix}${help}`;
        if (this.state.docsUrl === url && !this.state.sideDocsCollapsed && !focusIfVisible) {
            const wasEditorFocused = Blockly.getFocusManager().getFocusedTree();
            this.props.parent.setState({ sideDocsCollapsed: true });

            if (!wasEditorFocused) {
                this.props.parent.editor.focusWorkspace();
            }
        } else {
            this.openingSideDoc = true;
            Blockly.hideChaff(true);
            this.setUrl(url);
        }
    }

    private setUrl(url: string) {
        this.props.parent.setState({ sideDocsLoadUrl: url, sideDocsCollapsed: false });
    }

    expand() {
        this.props.parent.setState({ sideDocsCollapsed: false });
    }

    collapse() {
        this.props.parent.setState({ sideDocsCollapsed: true });
        this.props.parent.editor.focusWorkspace();
    }

    isCollapsed() {
        return !!this.state.sideDocsCollapsed;
    }

    popOut() {
        SideDocs.notify({
            type: "popout"
        })
    }

    toggleVisibility() {
        const state = this.props.parent.state;
        this.props.parent.setState({ sideDocsCollapsed: !state.sideDocsCollapsed });
        document.getElementById("sidedocstoggle").focus();
    }

    componentDidUpdate() {
        this.props.parent.editor.resize();

        let sidedocstoggle = document.getElementById("sidedocstoggle");
        if (this.openingSideDoc && sidedocstoggle) {
            sidedocstoggle.focus();
            this.openingSideDoc = false;
        }
    }

    UNSAFE_componentWillReceiveProps(nextProps: SideDocsProps) {
        const newState: SideDocsState = {};
        if (nextProps.sideDocsCollapsed != undefined) {
            newState.sideDocsCollapsed = nextProps.sideDocsCollapsed;
        }
        if (nextProps.docsUrl != undefined) {
            newState.docsUrl = nextProps.docsUrl;
        }
        if (Object.keys(newState).length > 0) this.setState(newState)
    }

    shouldComponentUpdate(nextProps: SideDocsProps, nextState: SideDocsState, nextContext: any): boolean {
        return this.state.sideDocsCollapsed != nextState.sideDocsCollapsed
            || this.state.docsUrl != nextState.docsUrl;
    }

    private handleKeyDown = (ev: React.KeyboardEvent<HTMLElement>) => {
        if (ev.key == "Escape") {
            ev.stopPropagation();
            this.collapse();
        }
    }

    renderCore() {
        const { sideDocsCollapsed, docsUrl } = this.state;
        const isRTL = pxt.Util.isUserLanguageRtl();
        const showLeftChevron = (sideDocsCollapsed || isRTL) && !(sideDocsCollapsed && isRTL); // Collapsed XOR RTL
        const lockedEditor = !!pxt.appTarget.appTheme.lockedEditor;

        if (!docsUrl) return null;

        const url = sideDocsCollapsed ? this.rootDocsUrl() : docsUrl;
        const isBuiltIn = url.startsWith(`${builtInPrefix}`);

        /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
        return <div>
            <button id="sidedocstoggle" role="button" aria-label={sideDocsCollapsed ? lf("Expand the side documentation") : lf("Collapse the side documentation")} className="ui icon button large" onClick={this.toggleVisibility}>
                <sui.Icon icon={`icon inverted chevron ${showLeftChevron ? 'left' : 'right'}`} />
            </button>
            <div id="sidedocs" onKeyDown={this.handleKeyDown}>
                {!lockedEditor && !isBuiltIn && <div className="ui app hide" id="sidedocsbar">
                    <a className="ui icon link" role="button" tabIndex={0} data-content={lf("Open documentation in new tab")} aria-label={lf("Open documentation in new tab")} onClick={this.popOut} onKeyDown={fireClickOnEnter} >
                        <sui.Icon icon="external" />
                    </a>
                </div>}
                <div id="sidedocsframe-wrapper">
                    {this.renderContent(url, isBuiltIn, lockedEditor)}
                </div>
            </div>
        </div>
        /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
    }

    renderContent(url: string, isBuiltin: boolean, lockedEditor: boolean) {
        if (isBuiltin) {
            const component = url.slice(builtInPrefix.length) as pxt.editor.BuiltInHelp;
            switch (component) {
                case "keyboardControls": {
                    return <KeyboardControlsHelp />
                }
            }
        }
        return (
            <iframe id="sidedocsframe" src={url} title={lf("Documentation")} aria-atomic="true" aria-live="assertive"
                sandbox={`allow-scripts allow-same-origin allow-forms ${lockedEditor ? "" : "allow-popups"}`} />
        )
    }
}

export interface SandboxFooterProps extends ISettingsProps {
}

export class SandboxFooter extends data.PureComponent<SandboxFooterProps, {}> {

    constructor(props: SandboxFooterProps) {
        super(props);
        this.state = {
        }

        this.compile = this.compile.bind(this);
    }

    compile() {
        pxt.tickEvent("sandboxfooter.compile", undefined, { interactiveConsent: true });
        this.props.parent.compile();
    }

    renderCore() {
        const targetTheme = pxt.appTarget.appTheme;

        const compileTooltip = lf("Download your code to the {0}", targetTheme.boardName);

        return <div className="ui horizontal small divided link list sandboxfooter">
            {targetTheme.organizationUrl && targetTheme.organization ? <a className="item" target="_blank" rel="noopener noreferrer" href={targetTheme.organizationUrl}>{targetTheme.organization}</a> : undefined}
            <a target="_blank" className="item" href={targetTheme.termsOfUseUrl} rel="noopener noreferrer">{lf("Terms of Use")}</a>
            <a target="_blank" className="item" href={targetTheme.privacyUrl} rel="noopener noreferrer">{lf("Privacy")}</a>
            <span className="item"><a role="button" className="ui thin portrait only" title={compileTooltip} onClick={this.compile}><sui.Icon icon={`icon ${pxt.appTarget.appTheme.downloadIcon || 'download'}`} />{pxt.appTarget.appTheme.useUploadMessage ? lf("Upload") : lf("Download")}</a></span>
        </div>;
    }
}