/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as tutorial from "./tutorial";
import * as container from "./container";
import * as core from "./core";
import * as cloud from "./cloud";
import * as cloudsync from "./cloudsync";
import * as pkg from "./package";

type ISettingsProps = pxt.editor.ISettingsProps;

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

function openTutorial(parent: pxt.editor.IProjectView, path: string) {
    pxt.tickEvent(`docs`, { path }, { interactiveConsent: true });
    parent.startActivity("tutorial", path);
}

function openDocs(parent: pxt.editor.IProjectView, path: string) {
    pxt.tickEvent(`docs`, { path }, { interactiveConsent: true });
    parent.setSideDoc(path);
}

function renderDocItems(parent: pxt.editor.IProjectView, elements: pxt.DocMenuEntry[], cls: string = "") {
    return elements.map(m =>
        m.tutorial ? <DocsMenuItem key={"docsmenututorial" + m.path} role="menuitem" ariaLabel={pxt.Util.rlf(m.name)} text={pxt.Util.rlf(m.name)} className={"ui " + cls} parent={parent} path={m.path} onItemClick={openTutorial} />
            : !/^\//.test(m.path) ? <a key={"docsmenulink" + m.path} role="menuitem" aria-label={m.name} title={m.name} className={`ui item link ${cls}`} href={m.path} target="docs">{pxt.Util.rlf(m.name)}</a>
                : <DocsMenuItem key={"docsmenu" + m.path} role="menuitem" ariaLabel={pxt.Util.rlf(m.name)} text={pxt.Util.rlf(m.name)} className={"ui " + cls} parent={parent} path={m.path} onItemClick={openDocs} />
    );
}

// Always append a link to the appropriate language (Blocks, JS, Python) to the help menu
function getDocsLanguageItem(editor: DocsMenuEditorName, parent: pxt.editor.IProjectView, cls: string = ""): JSX.Element {
    const path = "/" + editor.toLowerCase();
    // Use rlf as "Blocks" is localized above & "JavaScript" and "Python" should not be localized
    return <DocsMenuItem key={"docsmenu" + path} role="menuitem" ariaLabel={pxt.Util.rlf(editor)} text={pxt.Util.rlf(editor)} className={`ui ${cls}`} parent={parent} path={path} onItemClick={openDocs} />
}

type DocsMenuEditorName = "Blocks" | "JavaScript" | "Python";
interface DocsMenuProps extends ISettingsProps {
    editor: DocsMenuEditorName;
}

export class DocsMenu extends data.PureComponent<DocsMenuProps, {}> {
    renderCore() {
        const parent = this.props.parent;
        const targetTheme = pxt.appTarget.appTheme;
        return <sui.DropdownMenu role="menuitem" icon="help circle large"
            className="item mobile hide help-dropdown-menuitem" textClass={"landscape only"} title={lf("Help")} >
            {renderDocItems(parent, targetTheme.docMenu)}
            {getDocsLanguageItem(this.props.editor, parent)}
        </sui.DropdownMenu>
    }
}


interface DocsMenuItemProps extends sui.ItemProps {
    parent: pxt.editor.IProjectView;
    path: string;
    onItemClick: (parent: pxt.editor.IProjectView, path: string) => void;
}

class DocsMenuItem extends sui.StatelessUIElement<DocsMenuItemProps> {

    constructor(props: DocsMenuItemProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    handleClick() {
        const { onItemClick, parent, path } = this.props;
        onItemClick(parent, path);
    }

    renderCore() {
        const { onClick, onItemClick, parent, path, ...rest } = this.props;
        return <sui.Item {...rest} onClick={this.handleClick} />
    }
}

export interface SettingsMenuProps extends ISettingsProps {
    highContrast: boolean;
    greenScreen: boolean;
    accessibleBlocks: boolean;
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
export interface SettingsMenuState {
    highContrast?: boolean;
    greenScreen?: boolean;
    accessibleBlocks?: boolean;
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
        this.toggleHighContrast = this.toggleHighContrast.bind(this);
        this.toggleGreenScreen = this.toggleGreenScreen.bind(this);
        this.toggleAccessibleBlocks = this.toggleAccessibleBlocks.bind(this);
        this.showResetDialog = this.showResetDialog.bind(this);
        this.showShareDialog = this.showShareDialog.bind(this);
        this.pair = this.pair.bind(this);
        this.pairBluetooth = this.pairBluetooth.bind(this);
        this.showAboutDialog = this.showAboutDialog.bind(this);
        this.print = this.print.bind(this);
        this.signOutGithub = this.signOutGithub.bind(this);
    }

    showShareDialog() {
        pxt.tickEvent("menu.share", undefined, { interactiveConsent: true });
        this.props.parent.showShareDialog();
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
            this.props.parent.showBoardDialogAsync(undefined, true).done();
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

    print() {
        pxt.tickEvent("menu.print");
        this.props.parent.printCode();
    }

    signOutGithub() {
        pxt.tickEvent("menu.github.signout");
        const githubProvider = cloudsync.githubProvider();
        if (githubProvider) {
            githubProvider.logout();
            this.props.parent.forceUpdate();
            core.infoNotification(lf("Signed out from GitHub..."))
        }
    }

    componentWillReceiveProps(nextProps: SettingsMenuProps) {
        const newState: SettingsMenuState = {};
        if (nextProps.highContrast != undefined) {
            newState.highContrast = nextProps.highContrast;
        }
        if (nextProps.greenScreen !== undefined) {
            newState.greenScreen = nextProps.greenScreen;
        }
        if (nextProps.accessibleBlocks !== undefined) {
            newState.accessibleBlocks = nextProps.accessibleBlocks;
        }
        if (Object.keys(newState).length > 0) this.setState(newState)
    }

    shouldComponentUpdate(nextProps: SettingsMenuProps, nextState: SettingsMenuState, nextContext: any): boolean {
        return this.state.highContrast != nextState.highContrast
            || this.state.greenScreen != nextState.greenScreen
            || this.state.accessibleBlocks != nextState.accessibleBlocks;
    }

    renderCore() {
        const { highContrast, greenScreen, accessibleBlocks } = this.state;
        const targetTheme = pxt.appTarget.appTheme;
        const packages = pxt.appTarget.cloud && !!pxt.appTarget.cloud.packages;
        const reportAbuse = pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && pxt.appTarget.cloud.importing;
        const readOnly = pxt.shell.isReadOnly();
        const isController = pxt.shell.isControllerMode();
        const disableFileAccessinMaciOs = targetTheme.disableFileAccessinMaciOs && (pxt.BrowserUtils.isIOS() || pxt.BrowserUtils.isMac())
        const showSave = !readOnly && !isController && !!targetTheme.saveInMenu && !disableFileAccessinMaciOs;
        const showSimCollapse = !readOnly && !isController && !!targetTheme.simCollapseInMenu;
        const showGreenScreen = targetTheme.greenScreen || /greenscreen=1/i.test(window.location.href);
        const showPrint = targetTheme.print && !pxt.BrowserUtils.isIE();
        const showProjectSettings = targetTheme.showProjectSettings;
        const docItems = targetTheme.docMenu && targetTheme.docMenu.filter(d => !d.tutorial);

        // Electron does not currently support webusb
        const githubUser = !readOnly && !isController && this.getData("github:user") as pxt.editor.UserInfo;
        const showPairDevice = pxt.usb.isEnabled;

        const showCenterDivider = targetTheme.selectLanguage || targetTheme.highContrast || showGreenScreen || githubUser;

        return <sui.DropdownMenu role="menuitem" icon={'setting large'} title={lf("More...")} className="item icon more-dropdown-menuitem">
            {showProjectSettings ? <sui.Item role="menuitem" icon="options" text={lf("Project Settings")} onClick={this.openSettings} /> : undefined}
            {packages ? <sui.Item role="menuitem" icon="disk outline" text={lf("Extensions")} onClick={this.showPackageDialog} /> : undefined}
            {showPairDevice ? <sui.Item role="menuitem" icon='usb' text={lf("Pair device")} onClick={this.pair} /> : undefined}
            {pxt.webBluetooth.isAvailable() ? <sui.Item role="menuitem" icon='bluetooth' text={lf("Pair Bluetooth")} onClick={this.pairBluetooth} /> : undefined}
            {showPrint ? <sui.Item role="menuitem" icon="print" text={lf("Print...")} onClick={this.print} /> : undefined}
            {showSave ? <sui.Item role="menuitem" icon="save" text={lf("Save Project")} onClick={this.saveProject} /> : undefined}
            {!isController ? <sui.Item role="menuitem" icon="trash" text={lf("Delete Project")} onClick={this.removeProject} /> : undefined}
            {showSimCollapse ? <sui.Item role="menuitem" icon='toggle right' text={lf("Toggle the simulator")} onClick={this.toggleCollapse} /> : undefined}
            <div className="ui divider"></div>
            {targetTheme.selectLanguage ? <sui.Item icon='xicon globe' role="menuitem" text={lf("Language")} onClick={this.showLanguagePicker} /> : undefined}
            {targetTheme.highContrast ? <sui.Item role="menuitem" text={highContrast ? lf("High Contrast Off") : lf("High Contrast On")} onClick={this.toggleHighContrast} /> : undefined}
            {targetTheme.accessibleBlocks ? <sui.Item role="menuitem" text={accessibleBlocks ? lf("Accessible Blocks Off") : lf("Accessible Blocks On")} onClick={this.toggleAccessibleBlocks} /> : undefined}
            {showGreenScreen ? <sui.Item role="menuitem" text={greenScreen ? lf("Green Screen Off") : lf("Green Screen On")} onClick={this.toggleGreenScreen} /> : undefined}
            {docItems && renderDocItems(this.props.parent, docItems, "ui mobile only inherit")}
            {githubUser ? <div className="ui divider"></div> : undefined}
            {githubUser ? <div className="ui item" title={lf("Sign out {0} from GitHub", githubUser.name)} role="menuitem" onClick={this.signOutGithub}>
                <div className="avatar" role="presentation">
                    <img className="ui circular image" src={githubUser.photo} alt={lf("User picture")} />
                </div>
                {lf("Sign out")}
            </div> : undefined}
            {showCenterDivider && <div className="ui divider"></div>}
            {reportAbuse ? <sui.Item role="menuitem" icon="warning circle" text={lf("Report Abuse...")} onClick={this.showReportAbuse} /> : undefined}
            {!isController ? <sui.Item role="menuitem" icon='sign out' text={lf("Reset")} onClick={this.showResetDialog} /> : undefined}
            <sui.Item role="menuitem" text={lf("About...")} onClick={this.showAboutDialog} />
            {
                // we always need a way to clear local storage, regardless if signed in or not
            }
            {targetTheme.feedbackUrl ? <a className="ui item" href={targetTheme.feedbackUrl} role="menuitem" title={lf("Give Feedback")} target="_blank" rel="noopener noreferrer" >{lf("Give Feedback")}</a> : undefined}
        </sui.DropdownMenu>;
    }
}


interface IBaseMenuItemProps extends ISettingsProps {
    onClick: () => void;
    isActive: () => boolean;

    icon?: string;
    text?: string;
    title?: string;
    className?: string;
}

class BaseMenuItemProps extends data.Component<IBaseMenuItemProps, {}> {
    constructor(props: IBaseMenuItemProps) {
        super(props);
    }

    renderCore() {
        const active = this.props.isActive();
        return <sui.Item className={`${this.props.className} ${active ? "selected" : ""}`} role="menuitem" textClass="landscape only" text={this.props.text} icon={this.props.icon} active={active} onClick={this.props.onClick} title={this.props.title} />
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
        return <BaseMenuItemProps className="javascript-menuitem" icon="xicon js" text="JavaScript" title={lf("Convert code to JavaScript")} onClick={this.onClick} isActive={this.isActive} parent={this.props.parent} />
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
        return <BaseMenuItemProps className="python-menuitem" icon="xicon python" text="Python" title={lf("Convert code to Python")} onClick={this.onClick} isActive={this.isActive} parent={this.props.parent} />
    }
}

class BlocksMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    protected onClick = (): void => {
        pxt.tickEvent("menu.blocks", undefined, { interactiveConsent: true });
        this.props.parent.openBlocks();
    }

    protected isActive = (): boolean => {
        return this.props.parent.isBlocksActive();
    }

    renderCore() {
        return <BaseMenuItemProps className="blocks-menuitem" icon="xicon blocks" text={lf("Blocks")} title={lf("Convert code to Blocks")} onClick={this.onClick} isActive={this.isActive} parent={this.props.parent} />
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
        const isRunning = this.props.parent.state.simState == pxt.editor.SimState.Running;
        const runTooltip = isRunning ? lf("Stop the simulator") : lf("Start the simulator");

        return <BaseMenuItemProps className="sim-menuitem" icon={active && isRunning ? "stop" : "play"} text={lf("Simulator")} title={!active ? lf("Show Simulator") : runTooltip} onClick={this.onClick} isActive={this.isActive} parent={this.props.parent} />
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
        // show python in toggle if: python editor currently active, or blocks editor active & saved language pref is python
        const showPython = parent.isPythonActive() || (parent.isBlocksActive() && pxt.Util.isPyLangPref());

        return (
            <div id="editortoggle" className={`ui grid padded ${(pyOnly || tsOnly) ? "one-language" : ""}`}>
                {sandbox && !headless && <SandboxMenuItem parent={parent} />}
                {!pyOnly && !tsOnly && <BlocksMenuItem parent={parent} />}
                {python && showPython ? <PythonMenuItem parent={parent} /> : <JavascriptMenuItem parent={parent} />}
                {!pyOnly && !tsOnly && python && <sui.DropdownMenu id="editordropdown" role="menuitem" icon="chevron down" rightIcon title={lf("Select code editor language")} className={`item button attached right ${dropdownActive ? "active" : ""}`}>
                    <JavascriptMenuItem parent={parent} />
                    <PythonMenuItem parent={parent} />
                </sui.DropdownMenu>}
                <div className={`ui item toggle ${python ? 'hasdropdown' : ''}`}></div>
            </div>
        )
    }
}

export class MainMenu extends data.Component<ISettingsProps, {}> {

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
        }

        this.brandIconClick = this.brandIconClick.bind(this);
        this.orgIconClick = this.orgIconClick.bind(this);
        this.goHome = this.goHome.bind(this);
        this.showShareDialog = this.showShareDialog.bind(this);
        this.launchFullEditor = this.launchFullEditor.bind(this);
        this.exitTutorial = this.exitTutorial.bind(this);
        this.showReportAbuse = this.showReportAbuse.bind(this);
        this.toggleDebug = this.toggleDebug.bind(this);
    }

    brandIconClick() {
        const hasHome = !pxt.shell.isControllerMode();
        if (!hasHome) return;

        pxt.tickEvent("menu.brand", undefined, { interactiveConsent: true });
        this.props.parent.showExitAndSaveDialog();
    }

    orgIconClick() {
        pxt.tickEvent("menu.org", undefined, { interactiveConsent: true });
    }

    goHome() {
        pxt.tickEvent("menu.home", undefined, { interactiveConsent: true });
        this.props.parent.showExitAndSaveDialog();
    }

    showShareDialog() {
        pxt.tickEvent("menu.share", undefined, { interactiveConsent: true });
        this.props.parent.showShareDialog();
    }

    launchFullEditor() {
        pxt.tickEvent("sandbox.openfulleditor", undefined, { interactiveConsent: true });
        this.props.parent.launchFullEditor();
    }

    exitTutorial() {
        pxt.tickEvent("menu.exitTutorial", undefined, { interactiveConsent: true });
        if (this.props.parent.state.tutorialOptions
            && this.props.parent.state.tutorialOptions.tutorialRecipe)
            this.props.parent.completeTutorialAsync().done();
        else
            this.props.parent.exitTutorial();
    }

    showReportAbuse() {
        pxt.tickEvent("tutorial.reportabuse", undefined, { interactiveConsent: true });
        this.props.parent.showReportAbuse();
    }

    toggleDebug() {
        // This function will get called when the user clicks the "Exit Debug Mode" button in the menu bar.
        pxt.tickEvent("simulator.debug", undefined, { interactiveConsent: true });
        this.props.parent.toggleDebugging();
    }

    renderCore() {
        const { debugging, home, header, highContrast, greenScreen, accessibleBlocks, simState, tutorialOptions } = this.props.parent.state;
        if (home) return <div />; // Don't render if we're on the home screen

        const targetTheme = pxt.appTarget.appTheme;
        const lockedEditor = !!targetTheme.lockedEditor;
        const isController = pxt.shell.isControllerMode();
        const homeEnabled = !lockedEditor && !isController;
        const sandbox = pxt.shell.isSandboxMode();
        const inTutorial = !!tutorialOptions && !!tutorialOptions.tutorial;
        const activityName = tutorialOptions && tutorialOptions.tutorialActivityInfo ?
            tutorialOptions.tutorialActivityInfo[tutorialOptions.tutorialStepInfo[tutorialOptions.tutorialStep].activity].name :
            null;
        const hideIteration = tutorialOptions && tutorialOptions.metadata && tutorialOptions.metadata.hideIteration;
        const tutorialReportId = tutorialOptions && tutorialOptions.tutorialReportId;
        const docMenu = targetTheme.docMenu && targetTheme.docMenu.length && !sandbox && !inTutorial && !debugging;
        const hc = !!this.props.parent.state.highContrast;
        const showShare = !inTutorial && header && pxt.appTarget.cloud && pxt.appTarget.cloud.sharing && !isController && !debugging;

        const logo = (hc ? targetTheme.highContrastLogo : undefined) || targetTheme.logo;
        const portraitLogo = (hc ? targetTheme.highContrastPortraitLogo : undefined) || targetTheme.portraitLogo;
        const rightLogo = sandbox ? targetTheme.portraitLogo : targetTheme.rightLogo;
        const logoWide = !!targetTheme.logoWide;
        const portraitLogoSize = logoWide ? "small" : "mini";

        const simOpts = pxt.appTarget.simulator;
        const isHeadless = simOpts && simOpts.headless;

        const hasCloud = this.hasCloud();
        const user = hasCloud ? this.getUser() : undefined;
        const showCloud = !sandbox && !inTutorial && !debugging && !!user;

        const cfg = pkg.mainPkg && pkg.mainPkg.config;
        const languageRestriction = cfg && cfg.languageRestriction;

        const inAltEditor = debugging || inTutorial;
        const tsOnly = !inAltEditor && languageRestriction === pxt.editor.LanguageRestriction.JavaScriptOnly;
        const pyOnly = !inAltEditor && languageRestriction === pxt.editor.LanguageRestriction.PythonOnly;
        const showToggle = !inAltEditor && !targetTheme.blocksOnly
            && (sandbox || !(tsOnly || pyOnly)); // show if sandbox or not single language
        const editor = this.props.parent.isPythonActive() ? "Python" : (this.props.parent.isJavaScriptActive() ? "JavaScript" : "Blocks");

        /* tslint:disable:react-a11y-anchors */
        return <div id="mainmenu" className={`ui borderless fixed ${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menubar" aria-label={lf("Main menu")}>
            {!sandbox ? <div className="left menu">
                {!targetTheme.hideMenubarLogo &&
                    <a href={(!lockedEditor && isController) ? targetTheme.logoUrl : undefined} aria-label={lf("{0} Logo", targetTheme.boardName)} role="menuitem" target="blank" rel="noopener" className="ui item logo brand" tabIndex={0} onClick={lockedEditor ? undefined : this.brandIconClick} onKeyDown={sui.fireClickOnEnter}>
                        {logo || portraitLogo
                            ? <img className={`ui logo ${logo ? " portrait hide" : ''}`} src={logo || portraitLogo} alt={lf("{0} Logo", targetTheme.boardName)} />
                            : <span className="name">{targetTheme.boardName}</span>}
                        {portraitLogo ? (<img className={`ui ${portraitLogoSize} image portrait only`} src={portraitLogo} alt={lf("{0} Logo", targetTheme.boardName)} />) : null}
                    </a>
                }
                {!inTutorial && homeEnabled ? <sui.Item className="icon openproject" role="menuitem" textClass="landscape only" icon="home large" ariaLabel={lf("Home screen")} text={lf("Home")} onClick={this.goHome} /> : null}
                {showShare ? <sui.Item className="icon shareproject" role="menuitem" textClass="widedesktop only" ariaLabel={lf("Share Project")} text={lf("Share")} icon="share alternate large" onClick={this.showShareDialog} /> : null}
                {inTutorial && <sui.Item className="tutorialname" tabIndex={-1} textClass="landscape only" text={tutorialOptions.tutorialName} />}
            </div> : <div className="left menu">
                    <span id="logo" className="ui item logo">
                        <img className="ui mini image" src={rightLogo} tabIndex={0} onClick={this.launchFullEditor} onKeyDown={sui.fireClickOnEnter} alt={`${targetTheme.boardName} Logo`} />
                    </span>
                </div>}
            {showToggle && <div className="ui item link editor-menuitem">
                <container.EditorSelector parent={this.props.parent} sandbox={sandbox} python={targetTheme.python} languageRestriction={languageRestriction} headless={isHeadless} />
            </div>}
            {inTutorial && activityName && <div className="ui item">{activityName}</div>}
            {inTutorial && !hideIteration && <tutorial.TutorialMenu parent={this.props.parent} />}
            {debugging && !inTutorial ? <sui.MenuItem className="debugger-menu-item centered" icon="large bug" name="Debug Mode" /> : undefined}
            {tsOnly && !sandbox && <sui.MenuItem className="centered" icon="xicon js" name="JavaScript" />}
            {pyOnly && !sandbox && <sui.MenuItem className="centered" icon="xicon python" name="Python" />}
            <div className="right menu">
                {debugging ? <sui.ButtonMenuItem className="exit-debugmode-btn" role="menuitem" icon="external" text={lf("Exit Debug Mode")} textClass="landscape only" onClick={this.toggleDebug} /> : undefined}
                {docMenu ? <container.DocsMenu parent={this.props.parent} editor={editor} /> : undefined}
                {sandbox || inTutorial || debugging ? undefined : <container.SettingsMenu parent={this.props.parent} highContrast={highContrast} greenScreen={greenScreen} accessibleBlocks={accessibleBlocks} />}
                {showCloud ? <cloud.UserMenu parent={this.props.parent} /> : undefined}
                {sandbox && !targetTheme.hideEmbedEdit ? <sui.Item role="menuitem" icon="external" textClass="mobile hide" text={lf("Edit")} onClick={this.launchFullEditor} /> : undefined}
                {inTutorial && tutorialReportId ? <sui.ButtonMenuItem className="report-tutorial-btn" role="menuitem" icon="warning circle" text={lf("Report Abuse")} textClass="landscape only" onClick={this.showReportAbuse} /> : undefined}
                {(inTutorial && !lockedEditor && !hideIteration) && <sui.ButtonMenuItem className="exit-tutorial-btn" role="menuitem" icon="external" text={lf("Exit tutorial")} textClass="landscape only" onClick={this.exitTutorial} />}

                {!sandbox ? <a href={lockedEditor ? undefined : targetTheme.organizationUrl} aria-label={lf("{0} Logo", targetTheme.organization)} role="menuitem" target="blank" rel="noopener" className="ui item logo organization" onClick={lockedEditor ? undefined : this.orgIconClick}>
                    {targetTheme.organizationWideLogo || targetTheme.organizationLogo
                        ? <img className={`ui logo ${targetTheme.organizationWideLogo ? " portrait hide" : ''}`} src={targetTheme.organizationWideLogo || targetTheme.organizationLogo} alt={lf("{0} Logo", targetTheme.organization)} />
                        : <span className="name">{targetTheme.organization}</span>}
                    {targetTheme.organizationLogo ? (<img className='ui mini image portrait only' src={targetTheme.organizationLogo} alt={lf("{0} Logo", targetTheme.organization)} />) : null}
                </a> : undefined}
            </div>
        </div>;
        /* tslint:enable:react-a11y-anchors */
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
        const docsUrl = this.rootDocsUrl();
        const mode = blocksEditor ? "blocks" : "js";
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

    private setUrl(url: string) {
        this.props.parent.setState({ sideDocsLoadUrl: url, sideDocsCollapsed: false });
    }

    collapse() {
        this.props.parent.setState({ sideDocsCollapsed: true });
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

    componentWillReceiveProps(nextProps: SideDocsProps) {
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

    renderCore() {
        const { sideDocsCollapsed, docsUrl } = this.state;
        const isRTL = pxt.Util.isUserLanguageRtl();
        const showLeftChevron = (sideDocsCollapsed || isRTL) && !(sideDocsCollapsed && isRTL); // Collapsed XOR RTL
        const lockedEditor = !!pxt.appTarget.appTheme.lockedEditor;

        if (!docsUrl) return null;

        const url = sideDocsCollapsed ? this.rootDocsUrl() : docsUrl;
        /* tslint:disable:react-iframe-missing-sandbox */
        return <div>
            <button id="sidedocstoggle" role="button" aria-label={sideDocsCollapsed ? lf("Expand the side documentation") : lf("Collapse the side documentation")} className="ui icon button large" onClick={this.toggleVisibility}>
                <sui.Icon icon={`icon inverted chevron ${showLeftChevron ? 'left' : 'right'}`} />
            </button>
            <div id="sidedocs">
                <div id="sidedocsframe-wrapper">
                    <iframe id="sidedocsframe" src={url} title={lf("Documentation")} aria-atomic="true" aria-live="assertive"
                        sandbox={`allow-scripts allow-same-origin allow-forms ${lockedEditor ? "" : "allow-popups"}`} />
                </div>
                {!lockedEditor && <div className="ui app hide" id="sidedocsbar">
                    <a className="ui icon link" role="button" tabIndex={0} data-content={lf("Open documentation in new tab")} aria-label={lf("Open documentation in new tab")} onClick={this.popOut} onKeyDown={sui.fireClickOnEnter} >
                        <sui.Icon icon="external" />
                    </a>
                </div>}
            </div>
        </div>
        /* tslint:enable:react-iframe-missing-sandbox */
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

        /* tslint:disable:react-a11y-anchors */
        return <div className="ui horizontal small divided link list sandboxfooter">
            {targetTheme.organizationUrl && targetTheme.organization ? <a className="item" target="_blank" rel="noopener noreferrer" href={targetTheme.organizationUrl}>{targetTheme.organization}</a> : undefined}
            <a target="_blank" className="item" href={targetTheme.termsOfUseUrl} rel="noopener noreferrer">{lf("Terms of Use")}</a>
            <a target="_blank" className="item" href={targetTheme.privacyUrl} rel="noopener noreferrer">{lf("Privacy")}</a>
            <span className="item"><a role="button" className="ui thin portrait only" title={compileTooltip} onClick={this.compile}><sui.Icon icon={`icon ${pxt.appTarget.appTheme.downloadIcon || 'download'}`} />{pxt.appTarget.appTheme.useUploadMessage ? lf("Upload") : lf("Download")}</a></span>
        </div>;
        /* tslint:enable:react-a11y-anchors */
    }
}
