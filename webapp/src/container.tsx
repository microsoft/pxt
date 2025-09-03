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
import { ThemeManager } from "../../react-common/components/theming/themeManager";

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
    inBlocks: boolean;
}

export class DocsMenu extends data.PureComponent<DocsMenuProps, {}> {
    renderCore() {
        const { parent, editor } = this.props;
        const targetTheme = pxt.appTarget.appTheme;
        const accessibleBlocksEnabled = data.getData<boolean>(auth.ACCESSIBLE_BLOCKS);

        const items: MenuItem[] = [];

        if (this.props.inBlocks && accessibleBlocksEnabled) {
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
                id="docs-menuitem"
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
        this.props.parent.toggleAccessibleBlocks("settings");
    }

    showResetDialog() {
        pxt.tickEvent("menu.reset", undefined, { interactiveConsent: true });
        pxt.tickEvent("reset"); // Deprecated, will Feb 2018.
        this.props.parent.showResetDialog();
    }

    pair() {
        pxt.tickEvent("menu.pair");
        this.props.parent.pairAsync();
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
        const highContrast = ThemeManager.isCurrentThemeHighContrast();
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

        if (this.props.inBlocks) {
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
            <MenuDropdown
                id="settings-menuitem"
                className="settings-menuitem"
                title={lf("Settings")}
                icon="icon setting large"
                items={items}
            />
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

export interface SideDocsTab {
    id: string;
    title?: string;
    icon?: string;
    component?: () => JSX.Element;
    builtInKey?: pxt.editor.BuiltInHelp;
}

export interface SideDocsProps extends ISettingsProps {
    docsUrl: string;
    sideDocsCollapsed: boolean;
    extraTabs?: SideDocsTab[]; // dynamic tabs passed from parent
    showBuiltIns?: boolean; // defaults to true
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
export interface SideDocsState {
    // docsIframeUrl stores the last non-built-in docs URL used by the iframe tab.
    docsIframeUrl?: string;
    sideDocsCollapsed?: boolean;
    activeTabId?: string;
    sideDocsWidthPx?: number;
    tabsTopPx?: number;
}


interface BuiltInHelpDetails {
    component: () => JSX.Element;
    popOutHref: string;
    singleTabStop: boolean; // if the whole doc is only one tab stop, the "open in new tab" button placement becomes unintuitive.
}

const builtIns: Record<pxt.editor.BuiltInHelp, BuiltInHelpDetails> = {
    "keyboardControls": {
        component: KeyboardControlsHelp,
        popOutHref: "https://makecode.com/accessibility",
        singleTabStop: true
    }
}

export const builtInPrefix = "/builtin/"

export class SideDocs extends data.Component<SideDocsProps, SideDocsState> {
    private openingSideDoc = false;

    constructor(props: SideDocsProps) {
        super(props);
        this.state = {
            docsIframeUrl: undefined,
            sideDocsCollapsed: undefined,
            activeTabId: 'docs-iframe',
            sideDocsWidthPx: 0,
            tabsTopPx: 48
        }

        this.toggleVisibility = this.toggleVisibility.bind(this);
        this.notifyPopOut = this.notifyPopOut.bind(this);
        this.close = this.close.bind(this);
        this.updateLayoutMeasurements = this.updateLayoutMeasurements.bind(this);
    }

    private rootDocsUrl(): string {
        return (pxt.webConfig.docsUrl || '/--docs') + "#";
    }

    private notifyPopOut() {
        SideDocs.notify({
            type: "popout"
        })
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
        this.setState({ activeTabId: 'docs-iframe' });
    }

    setMarkdown(md: string) {
        const docsUrl = this.rootDocsUrl();
        // always render blocks by default when sending custom markdown
        const mode = "blocks" // this.props.parent.isBlocksEditor() ? "blocks" : "js";
        const url = `${docsUrl}md:${encodeURIComponent(md)}:${mode}:${pxt.Util.localeInfo()}`;
        // Use setUrl so we keep internal iframe URL state in sync
        this.setUrl(url);
    }

    toggleBuiltInHelp(help: pxt.editor.BuiltInHelp, focusIfVisible: boolean) {
        const url = `${builtInPrefix}${help}`;
        // determine collapse based on active tab id (built-in) rather than a shared url cache
        const shouldCollapse = this.state.activeTabId === (help as string) && !this.state.sideDocsCollapsed && !focusIfVisible;

        pxt.tickEvent(
            `sidedocs.builtin`,
            {
                path: url,
                focusIfVisible: focusIfVisible ? "true" : "false",
                collapsing: shouldCollapse ? "true" : "false"
            },
        );

        if (shouldCollapse) {
            const wasEditorFocused = Blockly.getFocusManager().getFocusedTree();
            this.props.parent.setState({ sideDocsCollapsed: true });

            if (!wasEditorFocused) {
                this.props.parent.editor.focusWorkspace();
            }
        } else {
            this.openingSideDoc = true;
            Blockly.hideChaff(true);
            this.setUrl(url);
            this.setState({ activeTabId: help as string });
        }
    }

    private setUrl(url: string) {
        this.props.parent.setState({ sideDocsLoadUrl: url, sideDocsCollapsed: false });
        // store last non-built-in docs url in state.docsIframeUrl so iframe tab has its own url cache
        if (!url.startsWith(builtInPrefix)) {
            this.setState({ docsIframeUrl: url, activeTabId: 'docs-iframe' });
        } else {
            const key = this.getBuiltInKeyFromUrl(url);
            if (key) this.setState({ activeTabId: key });
        }
    }

    expand() {
        this.props.parent.setState({ sideDocsCollapsed: false });
    }

    collapse() {
        this.props.parent.setState({ sideDocsCollapsed: true });
        this.props.parent.editor.focusWorkspace();
    }

    close() {
        this.props.parent.setState({ sideDocsCollapsed: true, sideDocsLoadUrl: '' });
        this.props.parent.editor.focusWorkspace();
    }

    isCollapsed() {
        return !!this.state.sideDocsCollapsed;
    }

    toggleVisibility() {
        const state = this.props.parent.state;
        const nextCollapsed = !state.sideDocsCollapsed;
        // If we're expanding the panel, set openingSideDoc so componentDidUpdate will focus the close button
        if (!nextCollapsed) this.openingSideDoc = true;
        this.props.parent.setState({ sideDocsCollapsed: nextCollapsed });
    }

    componentDidMount() {
        window.addEventListener('resize', this.updateLayoutMeasurements);
        this.updateLayoutMeasurements();
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.updateLayoutMeasurements);
    }

    componentDidUpdate() {
        this.props.parent.editor.resize();

        let sidedocsclose = document.getElementById("sidedocsclose");
        if (this.openingSideDoc && sidedocsclose) {
            (sidedocsclose as HTMLElement).focus();
            this.openingSideDoc = false;
        }

        this.updateLayoutMeasurements();
    }

    UNSAFE_componentWillReceiveProps(nextProps: SideDocsProps) {
        const newState: SideDocsState = {};
        if (nextProps.sideDocsCollapsed != undefined) {
            newState.sideDocsCollapsed = nextProps.sideDocsCollapsed;
        }
        if (nextProps.docsUrl != undefined) {
            // If incoming docsUrl indicates a built-in, set active tab accordingly; otherwise track it as the iframe URL
            if (nextProps.docsUrl && nextProps.docsUrl.startsWith(builtInPrefix)) {
                const key = this.getBuiltInKeyFromUrl(nextProps.docsUrl);
                if (key) newState.activeTabId = key;
                else newState.activeTabId = 'docs-iframe';
            } else {
                newState.docsIframeUrl = nextProps.docsUrl;
                newState.activeTabId = 'docs-iframe';
            }
        }
        if (Object.keys(newState).length > 0) this.setState(newState)
    }

    shouldComponentUpdate(nextProps: SideDocsProps, nextState: SideDocsState, nextContext: any): boolean {
        return this.state.sideDocsCollapsed != nextState.sideDocsCollapsed
            || this.state.docsIframeUrl != nextState.docsIframeUrl
            || this.state.activeTabId != nextState.activeTabId
            || this.state.sideDocsWidthPx != nextState.sideDocsWidthPx
            || this.state.tabsTopPx != nextState.tabsTopPx;
    }

    private handleKeyDown = (ev: React.KeyboardEvent<HTMLElement>) => {
        if (ev.key == "Escape") {
            ev.stopPropagation();
            this.collapse();
        }
    }

    private getBuiltInKeyFromUrl(url: string): pxt.editor.BuiltInHelp | undefined {
        if (url && url.startsWith(builtInPrefix)) {
            return url.slice(builtInPrefix.length) as pxt.editor.BuiltInHelp;
        }
        return undefined;
    }

    private buildTabs(): SideDocsTab[] {
        const tabs: SideDocsTab[] = [];
        // persistent iframe docs tab
        tabs.push({ id: 'docs-iframe', title: lf("Docs"), icon: "help circle" });

        const showBuiltIns = this.props.showBuiltIns !== false;
        if (showBuiltIns) {
            for (const k in builtIns) {
                const key = k as pxt.editor.BuiltInHelp;
                const info = builtIns[key];
                tabs.push({ id: key as string, title: pxt.Util.rlf(key), icon: "keyboard", component: info.component, builtInKey: key });
            }
        }

        if (this.props.extraTabs) {
            for (const et of this.props.extraTabs) {
                const tid = et.id || `extra-${Math.random().toString(36).slice(2, 8)}`;
                tabs.push({ id: tid, title: et.title, icon: et.icon, component: et.component });
            }
        }

        return tabs;
    }

    private selectTab(tabId: string) {
        const tabs = this.buildTabs();
        const tab = tabs.find(t => t.id === tabId);
        if (!tab) return;
        if (tab.builtInKey) {
            const url = builtInPrefix + tab.builtInKey;
            this.setUrl(url);
            this.setState({ activeTabId: tabId });
        } else if (tab.id === 'docs-iframe') {
            // prefer iframe-specific non-built-in url from our state; avoid accidentally using a built-in url stored on parent
            const candidateFromState = this.state.docsIframeUrl;
            const candidateFromProps = (this.props.docsUrl && !this.props.docsUrl.startsWith(builtInPrefix)) ? this.props.docsUrl : undefined;
            const url = candidateFromState || candidateFromProps || this.rootDocsUrl();
            this.setUrl(url);
        } else if (tab.component) {
            this.setState({ activeTabId: tabId });
            this.props.parent.setState({ sideDocsLoadUrl: '', sideDocsCollapsed: false });
        }
    }

    private updateLayoutMeasurements() {
        const sidedocs = document.getElementById('sidedocs');
        const mainmenu = document.getElementById('mainmenu');
        const newState: Partial<SideDocsState> = {};
        if (sidedocs) {
            const r = sidedocs.getBoundingClientRect();
            newState.sideDocsWidthPx = Math.round(r.width);
        } else {
            newState.sideDocsWidthPx = 0;
        }
        if (mainmenu) {
            const r2 = mainmenu.getBoundingClientRect();
            newState.tabsTopPx = Math.round(r2.bottom + 8);
        } else {
            newState.tabsTopPx = 48;
        }
        if (newState.sideDocsWidthPx !== this.state.sideDocsWidthPx || newState.tabsTopPx !== this.state.tabsTopPx) {
            this.setState(newState as SideDocsState);
        }
    }

    renderCore() {
        const tabs = this.buildTabs();
        // If activeTabId is not set, defer to the incoming props to determine if the current prop url is a built-in.
        const activeTabId = this.state.activeTabId || (this.props.docsUrl && this.props.docsUrl.startsWith(builtInPrefix) ? this.getBuiltInKeyFromUrl(this.props.docsUrl as string) || 'docs-iframe' : 'docs-iframe');
        const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

        const { sideDocsCollapsed, docsIframeUrl } = this.state;
        const lockedEditor = !!pxt.appTarget.appTheme.lockedEditor;

        const url = (activeTab.id === 'docs-iframe') ? (sideDocsCollapsed ? this.rootDocsUrl() : (docsIframeUrl || (this.props.docsUrl && !this.props.docsUrl.startsWith(builtInPrefix) ? this.props.docsUrl : this.rootDocsUrl()))) : (activeTab.builtInKey ? `${builtInPrefix}${activeTab.builtInKey}` : '');

        const builtInDetail = url && url.startsWith(builtInPrefix) ? builtIns[url.slice(builtInPrefix.length) as pxt.editor.BuiltInHelp] : undefined;
        const openInNewTabLinkProps: React.ComponentProps<'a'> = builtInDetail ? {
            target: "_blank",
            href: builtInDetail.popOutHref,
            rel: "noopener",
            onClick: this.close,
        } : {
            onClick: this.notifyPopOut,
            onKeyDown: fireClickOnEnter,
            role: "button",
            tabIndex: 0,
        };

        const openInNewTab = !lockedEditor && <div key="newTab" className="ui app hide" id="sidedocsbar">
            <a className="ui icon link" aria-label={lf("Open documentation in new tab")} {...openInNewTabLinkProps}>
                <sui.Icon icon="external" />
            </a>
        </div>;

        const content = <div key="content" id="sidedocsframe-wrapper">
            {/* Close button in the top-right of the expanded panel */}
            <sui.Button id="sidedocsclose" className={`sidedocs-close ui icon button`} icon="close" title={lf("Close the side documentation")} ariaLabel={lf("Close the side documentation")} onClick={this.close} />
            {this.renderTabContent(activeTab, url, builtInDetail, lockedEditor)}
        </div>;

        const flipNewTabLinkOrder = builtInDetail?.singleTabStop;
        const contentParts = flipNewTabLinkOrder ? [content, openInNewTab] : [openInNewTab, content];

        /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
        return <div>
            {/* tab strip */}
             <div id="sidedocstabs" role="tablist" className="sidedoc-tablist" aria-orientation="vertical">
                 {(() => {
                     const onTabKeyDown = (ev: React.KeyboardEvent<HTMLElement>, idx: number) => {
                         const key = ev.key;
                         if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End') {
                             ev.preventDefault();
                             let newIdx = idx;
                             if (key === 'ArrowUp') newIdx = (idx - 1 + tabs.length) % tabs.length;
                             else if (key === 'ArrowDown') newIdx = (idx + 1) % tabs.length;
                             else if (key === 'Home') newIdx = 0;
                             else if (key === 'End') newIdx = tabs.length - 1;
                             const tabBtn = document.getElementById('sidedocstabs')?.querySelectorAll('button')[newIdx] as HTMLButtonElement;
                             if (tabBtn) {
                                 tabBtn.focus();
                                 // invoke selectTab directly to ensure state is in sync
                                 this.selectTab(tabs[newIdx].id);
                             }
                         } else if (key === 'Escape') {
                             this.collapse();
                         }
                     };
 
                     return tabs.map((t, i) => {
                         const isActive = t.id === activeTabId;
                        return (
                            <div key={t.id} title={t.title || ''} className={`sidedoc-tab ${isActive ? 'active' : ''}`}>
                                <sui.Button
                                    role="tab"
                                    aria-selected={isActive}
                                    ariaLabel={t.title || ''}
                                    title={t.title || ''}
                                    aria-controls="sidedocsframe-wrapper"
                                    onClick={() => this.selectTab(t.id)}
                                    onKeyDown={(ev: React.KeyboardEvent<HTMLElement>) => onTabKeyDown(ev, i)}
                                    tabIndex={0}
                                    icon={t.icon || "help"}
                                    className={`sidedoc-tab-button`}
                                />
                            </div>
                        );
                     });
                 })()}
             </div>
             <div id="sidedocs" onKeyDown={this.handleKeyDown}>
                 {!sideDocsCollapsed ? contentParts : null}
             </div>
         </div>
         /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
     }

    renderTabContent(tab: SideDocsTab, url: string, builtInDetail: BuiltInHelpDetails | undefined, lockedEditor: boolean) {
        if (!tab) return null;
        if (tab.component) {
            const TabComponent = tab.component;
            try {
                return <TabComponent />;
            } catch (e) {
                return <div>{lf("Error rendering tab content")}</div>;
            }
        }

        // If no tab.component provided, fall back to iframe/built-in handling
        const BuiltInComponent = builtInDetail?.component;
        return BuiltInComponent ? <BuiltInComponent /> : (
            <iframe id="sidedocsframe" src={url} title={lf("Documentation")} aria-atomic="true" aria-live="assertive"
                sandbox={`allow-scripts allow-same-origin allow-forms ${lockedEditor ? "" : "allow-popups"}`} />
        );
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