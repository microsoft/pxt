/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";
import * as auth from "./auth";
import * as pkg from "./package";
import { fireClickOnEnter } from "./util";

import IProjectView = pxt.editor.IProjectView;
import ISettingsProps = pxt.editor.ISettingsProps;
import UserInfo = pxt.editor.UserInfo;
import SimState = pxt.editor.SimState;
import { sendUpdateFeedbackTheme } from "../../react-common/components/controls/Feedback/FeedbackEventListener";

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

function renderDocItems(parent: IProjectView, elements: pxt.DocMenuEntry[], cls: string = "") {
    return elements.map(m =>
        m.tutorial ? <DocsMenuItem key={"docsmenututorial" + m.path} role="menuitem" ariaLabel={pxt.Util.rlf(m.name)} text={pxt.Util.rlf(m.name)} className={"ui " + cls} parent={parent} path={m.path} onItemClick={openTutorial} />
            : !/^\//.test(m.path) ? <a key={"docsmenulink" + m.path} role="menuitem" aria-label={m.name} title={m.name} className={`ui item link ${cls}`} href={m.path} target="docs">{pxt.Util.rlf(m.name)}</a>
                : <DocsMenuItem key={"docsmenu" + m.path} role="menuitem" ariaLabel={pxt.Util.rlf(m.name)} text={pxt.Util.rlf(m.name)} className={"ui " + cls} parent={parent} path={m.path} onItemClick={openDocs} />
    );
}

// Always append a link to the appropriate language (Blocks, JS, Python) to the help menu
function getDocsLanguageItem(editor: DocsMenuEditorName, parent: IProjectView, cls: string = ""): JSX.Element {
    const path = "/" + editor.toLowerCase();
    // Use rlf as "Blocks" is localized above & "JavaScript" and "Python" should not be localized
    return <DocsMenuItem key={"docsmenu" + path} role="menuitem" ariaLabel={pxt.Util.rlf(editor)} text={pxt.Util.rlf(editor)} className={`ui ${cls}`} parent={parent} path={path} onItemClick={openDocs} />
}

function getTourItem(parent: IProjectView, cls: string = ""): JSX.Element {
    const path = "/tour";
    return <DocsMenuItem key={"docsmenu" + path} role="menuitem" ariaLabel={lf("Tour")} text={lf("Tour")} className={`ui ${cls}`} parent={parent} path={path} onItemClick={startTour} />
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
            {targetTheme.tours?.editor && getTourItem(parent)}
            {renderDocItems(parent, targetTheme.docMenu)}
            {getDocsLanguageItem(this.props.editor, parent)}
        </sui.DropdownMenu>
    }
}


interface DocsMenuItemProps extends sui.ItemProps {
    parent: IProjectView;
    path: string;
    onItemClick: (parent: IProjectView, path: string) => void;
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
    dropdown: sui.DropdownMenu;
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
        this.hide = this.hide.bind(this);
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

    hide() {
        this.dropdown?.hide();
    }

    signOutGithub() {
        pxt.tickEvent("menu.github.signout");
        this.hide();
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
        const { greenScreen, accessibleBlocks } = this.state;
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

        return <sui.DropdownMenu role="menuitem" icon={'setting large'} title={lf("Settings")} className="item icon more-dropdown-menuitem" ref={ref => this.dropdown = ref}>
            {showHome && <sui.Item className="mobile only inherit" role="menuitem" icon="home" title={lf("Home")} text={lf("Home")} ariaLabel={lf("Home screen")} onClick={this.showExitAndSaveDialog} />}
            {showShare && <sui.Item className="mobile only inherit" role="menuitem" icon="share alternate" title={lf("Publish your game to create a shareable link")} text={lf("Share")} ariaLabel={lf("Share Project")} onClick={this.showShareDialog} />}
            {(showHome || showShare) && <div className="ui divider mobile only inherit" />}
            {showProjectSettings ? <sui.Item role="menuitem" icon="options" text={lf("Project Settings")} onClick={this.openSettings} /> : undefined}
            {packages ? <sui.Item role="menuitem" icon="disk outline" text={lf("Extensions")} onClick={this.showPackageDialog} /> : undefined}
            {showPairDevice ? <sui.Item role="menuitem" icon={usbIcon} text={lf("Connect Device")} onClick={this.pair} /> : undefined}
            {pxt.webBluetooth.isAvailable() ? <sui.Item role="menuitem" icon='bluetooth' text={lf("Pair Bluetooth")} onClick={this.pairBluetooth} /> : undefined}
            {showPrint ? <sui.Item role="menuitem" icon="print" text={lf("Print...")} onClick={this.print} /> : undefined}
            {showSave ? <sui.Item role="menuitem" icon="save" text={lf("Save Project")} onClick={this.saveProject} /> : undefined}
            {!isController ? <sui.Item role="menuitem" icon="trash" text={lf("Delete Project")} onClick={this.removeProject} /> : undefined}
            {targetTheme.timeMachine ? <sui.Item role="menuitem" icon="history" text={lf("Version History")} onClick={this.showTurnBackTimeDialog} /> : undefined}
            {showSimCollapse ? <sui.Item role="menuitem" icon='toggle right' text={simCollapseText} onClick={this.toggleCollapse} /> : undefined}
            <div className="ui divider"></div>
            {targetTheme.selectLanguage ? <sui.Item icon='xicon globe' role="menuitem" text={lf("Language")} onClick={this.showLanguagePicker} /> : undefined}
            <sui.Item role="menuitem" icon="paint brush" text={lf("Theme")} onClick={this.showThemePicker} />
            {targetTheme.accessibleBlocks ? <sui.Item role="menuitem" text={accessibleBlocks ? lf("Accessible Blocks Off") : lf("Accessible Blocks On")} onClick={this.toggleAccessibleBlocks} /> : undefined}
            {showGreenScreen ? <sui.Item role="menuitem" text={greenScreen ? lf("Green Screen Off") : lf("Green Screen On")} onClick={this.toggleGreenScreen} /> : undefined}
            {docItems && renderDocItems(this.props.parent, docItems, "setting-docs-item mobile only inherit")}
            {githubUser ? <div className="ui divider"></div> : undefined}
            {githubUser ? <div className="ui item" title={lf("Unlink {0} from GitHub", githubUser.name)} role="menuitem" onClick={this.signOutGithub}>
                <div className="avatar" role="presentation">
                    <img className="ui circular image" src={githubUser.photo} alt={lf("User picture")} />
                </div>
                {lf("Disconnect GitHub")}
            </div> : undefined}
            {showCenterDivider && <div className="ui divider"></div>}
            {reportAbuse ? <sui.Item role="menuitem" icon="warning circle" text={lf("Report Abuse...")} onClick={this.showReportAbuse} /> : undefined}
            {!isController ? <sui.Item role="menuitem" icon='sign out' text={lf("Reset")} onClick={this.showResetDialog} /> : undefined}
            <sui.Item role="menuitem" text={lf("About...")} onClick={this.showAboutDialog} />
            {
                // we always need a way to clear local storage, regardless if signed in or not
            }
            {showFeedbackOption ? <sui.Item role="menuitem" icon="comment" text={lf("Give Feedback")} onClick={this.showFeedbackDialog} /> : undefined}
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
        return <sui.Item className={`base-menuitem ${this.props.className} ${active ? "selected" : ""}`} role="option" textClass="landscape only"
            text={this.props.text} icon={this.props.icon} active={active} onClick={this.props.onClick} title={this.props.title} />
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

    private setUrl(url: string) {
        this.props.parent.setState({ sideDocsLoadUrl: url, sideDocsCollapsed: false });
    }

    expand() {
        this.props.parent.setState({ sideDocsCollapsed: false });
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

    renderCore() {
        const { sideDocsCollapsed, docsUrl } = this.state;
        const isRTL = pxt.Util.isUserLanguageRtl();
        const showLeftChevron = (sideDocsCollapsed || isRTL) && !(sideDocsCollapsed && isRTL); // Collapsed XOR RTL
        const lockedEditor = !!pxt.appTarget.appTheme.lockedEditor;

        if (!docsUrl) return null;

        const url = sideDocsCollapsed ? this.rootDocsUrl() : docsUrl;
        /* eslint-disable @microsoft/sdl/react-iframe-missing-sandbox */
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
                    <a className="ui icon link" role="button" tabIndex={0} data-content={lf("Open documentation in new tab")} aria-label={lf("Open documentation in new tab")} onClick={this.popOut} onKeyDown={fireClickOnEnter} >
                        <sui.Icon icon="external" />
                    </a>
                </div>}
            </div>
        </div>
        /* eslint-enable @microsoft/sdl/react-iframe-missing-sandbox */
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
