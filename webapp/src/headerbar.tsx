/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

import * as auth from "./auth";
import * as cmds from "./cmds"
import * as container from "./container";
import * as identity from "./identity";
import * as pkg from "./package";
import * as projects from "./projects";
import * as tutorial from "./tutorial";

import ISettingsProps = pxt.editor.ISettingsProps;
import { ThemeManager } from "../../react-common/components/theming/themeManager";

type HeaderBarView = "home" | "editor" | "tutorial" | "tutorial-tab" | "debugging" | "sandbox" | "time-machine";
const LONGPRESS_DURATION = 750;

export class HeaderBar extends data.Component<ISettingsProps, {}> {
    protected longpressTimer: any;
    protected touchStartTime: number;

    constructor(props: ISettingsProps) {
        super(props);
    }

    goHome = () => {
        pxt.tickEvent("menu.home", undefined, { interactiveConsent: true });
        if (this.getView() !== "home") this.props.parent.showExitAndSaveDialog();
    }

    showShareDialog = () => {
        pxt.tickEvent("menu.share", undefined, { interactiveConsent: true });
        this.props.parent.showShareDialog();
    }

    launchFullEditor = () => {
        pxt.tickEvent("sandbox.openfulleditor", undefined, { interactiveConsent: true });
        this.props.parent.launchFullEditor();
    }

    exitTutorial = () => {
        const tutorialOptions = this.props.parent.state.tutorialOptions;
        pxt.tickEvent("menu.exitTutorial", { tutorial: tutorialOptions?.tutorial }, { interactiveConsent: true });
        this.props.parent.exitTutorial();
    }

    showReportAbuse = () => {
        pxt.tickEvent("tutorial.reportabuse", undefined, { interactiveConsent: true });
        this.props.parent.showReportAbuse();
    }

    toggleDebug = () => {
        // This function will get called when the user clicks the "Exit Debug Mode" button in the menu bar.
        pxt.tickEvent("simulator.debug", undefined, { interactiveConsent: true });
        this.props.parent.toggleDebugging();
    }

    brandIconClick = () => {
        pxt.tickEvent("projects.brand", undefined, { interactiveConsent: true });
        this.goHome();
    }

    backButtonTouchStart = (evt: any) => {
        this.longpressTimer = setTimeout(() => cmds.nativeHostLongpressAsync(), LONGPRESS_DURATION);
        this.touchStartTime = new Date().getTime();
    }

    backButtonTouchEnd = (evt: any) => {
        evt.preventDefault();
        if (this.touchStartTime && (new Date().getTime() - this.touchStartTime) < LONGPRESS_DURATION) {
            cmds.nativeHostBackAsync();
        }
        this.touchStartTime = null;
        clearTimeout(this.longpressTimer);
    }

    onPlayWithFriendsClick = (evt: any) => {
        evt.preventDefault();
        pxt.tickEvent("menu.playwithfriends", undefined, { interactiveConsent: true });
        window.open(pxt.multiplayer.SHORT_LINK(), "_blank");
    }

    protected getView = (): HeaderBarView => {
        const { home, debugging, tutorialOptions } = this.props.parent.state;
        if (home) {
            return "home";
        } else if (pxt.shell.isSandboxMode()) {
            return "sandbox";
        } else if (pxt.shell.isTimeMachineEmbed()) {
            return "time-machine";
        } else if (debugging) {
            return "debugging";
        } else if (!pxt.BrowserUtils.useOldTutorialLayout() && !!tutorialOptions?.tutorial) {
            return "tutorial-tab";
        } else if (!!tutorialOptions?.tutorial) {
            return "tutorial";
        } else {
            return "editor";
        }
    }

    getOrganizationLogo(targetTheme: pxt.AppTheme, highContrast?: boolean, view?: string) {
        if (view === "time-machine") {
            return <></>;
        }

        return <div className="ui item logo organization" role="presentation">
            {targetTheme.organizationWideLogo || targetTheme.organizationLogo
                ? <img className={`ui logo ${view !== "home" ? "mobile hide" : ""}`} src={targetTheme.organizationWideLogo || targetTheme.organizationLogo} alt={lf("{0} Logo", targetTheme.organization)} />
                : <span className="name">{targetTheme.organization}</span>}
            {targetTheme.organizationLogo && view !== "home" && (<img className={`ui image mobile only`} src={targetTheme.organizationLogo} alt={lf("{0} Logo", targetTheme.organization)} />)}
        </div>
    }

    getTargetLogo(targetTheme: pxt.AppTheme, highContrast?: boolean, view?: string) {
        if (view === "time-machine") {
            return <></>;
        }

        const shouldLinkHome = pxt.shell.hasHomeScreen() && view !== "home";

        const role = shouldLinkHome ? "menuitem" : "presentation";
        const onClickHandler = shouldLinkHome ? this.brandIconClick : undefined;

        // TODO: "sandbox" view components are temporary share page layout
        return <div aria-label={lf("{0} Logo", targetTheme.boardName)} role={role} className={`ui item logo brand ${view !== "sandbox" && view !== "home" ? "mobile hide" : ""}`} onClick={onClickHandler}>
            {targetTheme.useTextLogo
            ? [ <span className="name" key="org-name">{targetTheme.organizationText}</span>,
                <span className="name-short" key="org-name-short">{targetTheme.organizationShortText || targetTheme.organizationText}</span> ]
            : (targetTheme.logo || targetTheme.portraitLogo
                ? <img className={`ui ${targetTheme.logoWide ? "small" : ""} logo`} src={targetTheme.logo || targetTheme.portraitLogo} alt={lf("{0} Logo", targetTheme.boardName)} />
                : <span className="name">{targetTheme.boardName}</span>)}
        </div>
    }

    getCenterLabel(targetTheme: pxt.AppTheme, view: HeaderBarView, tutorialOptions?: pxt.tutorial.TutorialOptions) {
        const showAssets = !!pkg.mainEditorPkg().files[pxt.ASSETS_FILE];
        const languageRestriction = pkg.mainPkg?.config?.languageRestriction;
        // If there is only one editor (eg Py only, no assets), we display a label instead of a toggle
        const hideToggle = !showAssets && (languageRestriction === pxt.editor.LanguageRestriction.JavaScriptOnly
            || languageRestriction === pxt.editor.LanguageRestriction.PythonOnly) || targetTheme.blocksOnly;

        switch (view) {
            case "tutorial":
                const activityName = tutorialOptions?.tutorialActivityInfo ?
                    tutorialOptions.tutorialActivityInfo[tutorialOptions.tutorialStepInfo[tutorialOptions.tutorialStep].activity].name :
                    null;
                const hideIteration = tutorialOptions?.metadata?.hideIteration;

                if (activityName) return <div className="ui item">{activityName}</div>
                if (!hideIteration) return <tutorial.TutorialMenu parent={this.props.parent} />
                break;
            case "tutorial-tab":
                if (tutorialOptions && (pxt.BrowserUtils.isTabletSize() || this.props.parent.useTutorialSimSidebarLayout())) {
                    const currentStep = tutorialOptions.tutorialStep ? tutorialOptions.tutorialStep + 1 : undefined;
                    const totalSteps = tutorialOptions.tutorialStepInfo ? tutorialOptions.tutorialStepInfo?.length : undefined;
                    return (
                        <div className="tutorial-header-label">
                            <div className="ui item tutorial-header-name-label">{tutorialOptions.tutorialName}</div>
                            {currentStep && totalSteps && (
                                <>
                                    <div className="ui item tutorial-header-step-label">{" - "}</div> { /* Keeping this separate helps simplify spacing */ }
                                    <div className="ui item tutorial-header-step-label">{lf("Step {0} of {1}", currentStep, totalSteps, totalSteps)}</div>
                                </>
                            )}
                        </div>
                    );
                }
                return <div />;
            case "debugging":
                return  <sui.MenuItem className="centered" icon="large bug" name="Debug Mode" />
            case "sandbox":
            case "editor":
            case "time-machine":
                if (hideToggle) {
                    // Label for single language
                    switch (languageRestriction) {
                        case pxt.editor.LanguageRestriction.PythonOnly:
                            return <sui.MenuItem className="centered" icon="xicon python" name="Python" />
                        case pxt.editor.LanguageRestriction.JavaScriptOnly:
                            return <sui.MenuItem className="centered" icon="xicon js" name="JavaScript" />
                        default:
                            break;
                    }
                } else {
                    return <div className="ui item link editor-menuitem" role="menuitem">
                        <container.EditorSelector parent={this.props.parent} sandbox={view === "sandbox"} python={targetTheme.python} languageRestriction={languageRestriction} headless={pxt.appTarget.simulator?.headless} />
                    </div>
                }
        }

        return <div />;
    }

    getExitButtons(targetTheme: pxt.AppTheme, view: HeaderBarView, tutorialOptions?: pxt.tutorial.TutorialOptions) {
        switch (view) {
            case "debugging":
                return <sui.ButtonMenuItem className="exit-debugmode-btn" role="menuitem" icon="external" text={lf("Exit Debug Mode")} textClass="landscape only" onClick={this.toggleDebug} />
            case "sandbox":
                if (!targetTheme.hideEmbedEdit) return <sui.Item role="menuitem" icon="external" textClass="mobile hide" text={lf("Edit")} onClick={this.launchFullEditor} />
                break;
            case "tutorial":
            case "tutorial-tab":
                const tutorialButtons = [];
                if (tutorialOptions?.tutorialReportId) {
                    const reportTutorialLabel = lf("Unapproved Content");
                    tutorialButtons.push(<sui.Item key="tutorial-report" role="menuitem" icon="exclamation triangle"
                        className="report-tutorial-btn link-button icon-and-text" textClass="landscape only"
                        text={reportTutorialLabel} ariaLabel={reportTutorialLabel} onClick={this.showReportAbuse} />);
                }
                if (!targetTheme.lockedEditor && !tutorialOptions?.metadata?.hideIteration && (view !== "tutorial-tab" || pxt.appTarget.simulator?.headless)) {
                    const exitTutorialLabel = lf("Exit tutorial");
                    tutorialButtons.push(<sui.Item key="tutorial-exit" role="menuitem" icon="sign out large"
                        className="exit-tutorial-btn link-button icon-and-text" textClass="landscape only"
                        text={exitTutorialLabel} ariaLabel={exitTutorialLabel} onClick={this.exitTutorial} />);
                }

                if (!!tutorialButtons.length) return tutorialButtons;
                break;
        }

        return <div />
    }

    // TODO: eventually unify these components into one menu
    getSettingsMenu = (view: HeaderBarView) => {
        const { greenScreen, accessibleBlocks, header } = this.props.parent.state;
        switch (view){
            case "home":
                return <projects.ProjectSettingsMenu parent={this.props.parent} />
            case "tutorial-tab":
            case "editor":
                return (
                    <container.SettingsMenu
                        parent={this.props.parent}
                        greenScreen={greenScreen}
                        accessibleBlocks={accessibleBlocks}
                        showShare={!!header}
                        inBlocks={this.props.parent.isBlocksActive()}
                        inTutorial={this.props.parent.isTutorial()}
                    />
                );
            default:
                return <div />
        }
    }

    renderCore() {
        const targetTheme = pxt.appTarget.appTheme;
        const highContrast = ThemeManager.isCurrentThemeHighContrast();
        const view = this.getView();

        const { home, header, tutorialOptions } = this.props.parent.state;
        const isController = pxt.shell.isControllerMode();
        const isNativeHost = cmds.isNativeHost();
        const hasIdentity = auth.hasIdentity() && !pxt.auth.proxyIdentityThroughIPC();
        const activeEditor = this.props.parent.isPythonActive() ? "Python"
            : (this.props.parent.isJavaScriptActive() ? "JavaScript" : "Blocks");

        const showHomeButton = (view === "editor" || view === "tutorial-tab") && !targetTheme.lockedEditor && !isController;
        const showShareButton = (view === "editor" || view === "tutorial-tab") && header && pxt.appTarget.cloud?.sharing && !isController;
        const showHelpButton = view === "editor" && targetTheme.docMenu?.length;

        // Approximate each tutorial step to be 22 px
        const manyTutorialSteps = view == "tutorial" && (tutorialOptions.tutorialStepInfo.length * 22 > window.innerWidth / 3);

        return <div id="mainmenu" className={`ui borderless fixed menu ${targetTheme.invertedMenu ? `inverted` : ''} ${manyTutorialSteps ? "thin" : ""}`} role="menubar">
            <div className="left menu">
                {isNativeHost && <sui.Item className="icon nativeback" role="menuitem" icon="chevron left large" ariaLabel={lf("Back to application")}
                    onClick={cmds.nativeHostBackAsync} onMouseDown={this.backButtonTouchStart} onMouseUp={this.backButtonTouchEnd} onMouseLeave={this.backButtonTouchEnd} />}
                {this.getOrganizationLogo(targetTheme, highContrast, view)}
                {view === "tutorial"
                    // TODO: temporary place for tutorial name, we will eventually redesign the header for tutorial view
                    ? <sui.Item className="tutorialname" tabIndex={-1} textClass="landscape only" text={tutorialOptions.tutorialName}/>
                    : this.getTargetLogo(targetTheme, highContrast, view)}
            </div>
            {!home && <div className="center menu">
                {this.getCenterLabel(targetTheme, view, tutorialOptions)}
            </div>}
            <div className="right menu">
                {this.getExitButtons(targetTheme, view, tutorialOptions)}
                {showHomeButton && <sui.Item className={`icon openproject ${hasIdentity ? "mobile hide" : ""}`} role="menuitem" title={lf("Home")} icon="home large" ariaLabel={lf("Home screen")} onClick={this.goHome} />}
                {showShareButton && <sui.Item className="icon shareproject mobile hide" role="menuitem" title={lf("Publish your game to create a shareable link")} icon="share alternate large" ariaLabel={lf("Share Project")} onClick={this.showShareDialog} />}
                {showHelpButton && <container.DocsMenu parent={this.props.parent} editor={activeEditor} inBlocks={this.props.parent.isBlocksActive()} />}
                {this.getSettingsMenu(view)}
                {hasIdentity && (view === "home" || view === "editor" || view === "tutorial-tab") && <identity.UserMenu parent={this.props.parent} />}
            </div>
        </div>
    }
}