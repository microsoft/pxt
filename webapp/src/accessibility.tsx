/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as auth from "./auth";
import * as data from "./data";
import * as sui from "./sui";

import ISettingsProps = pxt.editor.ISettingsProps;
import { classList } from "../../react-common/components/util";

export interface EditorAccessibilityMenuProps extends ISettingsProps {
    highContrast?: boolean;
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
export interface EditorAccessibilityMenuState {
    highContrast?: boolean;
}

export class EditorAccessibilityMenu extends data.Component<EditorAccessibilityMenuProps, EditorAccessibilityMenuState> {

    constructor(props: EditorAccessibilityMenuProps) {
        super(props);
        this.state = {
        }

        this.openJavaScript = this.openJavaScript.bind(this);
        this.openPython = this.openPython.bind(this);
        this.showLanguagePicker = this.showLanguagePicker.bind(this);
        this.showThemePicker = this.showThemePicker.bind(this);
        this.goHome = this.goHome.bind(this);
        this.openBlocks = this.openBlocks.bind(this);
        this.toggleAccessibleBlocks = this.toggleAccessibleBlocks.bind(this);
    }

    openBlocks(e: React.MouseEvent<HTMLElement>) {
        this.props.parent.openBlocks();
    }

    openJavaScript() {
        pxt.tickEvent("accmenu.editor.openJS", undefined, { interactiveConsent: true });
        this.props.parent.openJavaScript();
    }

    openPython() {
        pxt.tickEvent("accmenu.editor.openPY", undefined, { interactiveConsent: true });
        this.props.parent.openPython();
    }

    showLanguagePicker() {
        pxt.tickEvent("accmenu.editor.importdialog", undefined, { interactiveConsent: true });
        this.props.parent.showLanguagePicker();
    }

    showThemePicker() {
        pxt.tickEvent("accmenu.editor.showthemepicker", undefined, { interactiveConsent: true });
        this.props.parent.showThemePicker();
    }

    goHome() {
        pxt.tickEvent("accmenu.editor.home", undefined, { interactiveConsent: true });
        this.props.parent.showExitAndSaveDialog();
    }

    toggleAccessibleBlocks() {
        this.props.parent.toggleAccessibleBlocks("accmenu");
    }

    UNSAFE_componentWillReceiveProps(nextProps: EditorAccessibilityMenuProps) {
        const newState: EditorAccessibilityMenuState = {};
        if (nextProps.highContrast != undefined) {
            newState.highContrast = nextProps.highContrast;
        }
        if (Object.keys(newState).length > 0) this.setState(newState)
    }

    shouldComponentUpdate(nextProps: EditorAccessibilityMenuProps, nextState: EditorAccessibilityMenuState, nextContext: any): boolean {
        return this.state.highContrast != nextState.highContrast;
    }

    renderCore() {
        const targetTheme = pxt.appTarget.appTheme;
        const hasHome = !pxt.shell.isControllerMode();

        const accessibleBlocksOn = this.getData<boolean>(auth.ACCESSIBLE_BLOCKS);
        const menuClass = classList(targetTheme.invertedMenu && "inverted", "menu");

        return <div className="ui accessibleMenu borderless fixed menu" role="menubar">
            {!accessibleBlocksOn &&
                <sui.Item
                    className={menuClass}
                    role="menuitem"
                    icon="xicon blocks"
                    text={lf("Enable blocks keyboard controls")}
                    onClick={this.toggleAccessibleBlocks}
                />
            }
            {accessibleBlocksOn &&
                <sui.Item
                    className={menuClass}
                    role="menuitem"
                    icon="xicon blocks"
                    text={lf("Skip to Blocks workspace")}
                    onClick={this.openBlocks}
                />
            }
            <sui.Item
                className={menuClass}
                role="menuitem"
                icon="xicon js"
                text={lf("Skip to JavaScript editor")}
                onClick={this.openJavaScript}
            />
            {targetTheme.python &&
                <sui.Item
                    className={menuClass}
                    role="menuitem"
                    icon="xicon python"
                    text={lf("Skip to Python editor")}
                    onClick={this.openPython}
                />
            }
            {targetTheme.selectLanguage &&
                <sui.Item
                    className={menuClass}
                    role="menuitem"
                    icon="xicon globe"
                    text={lf("Select Language")}
                    onClick={this.showLanguagePicker}
                />
            }
            {targetTheme.defaultColorTheme &&
                <sui.Item
                    className={menuClass}
                    role="menuitem"
                    icon="paint brush"
                    text={lf("Select Theme")}
                    onClick={this.showThemePicker}
                />
            }
            {hasHome &&
                <sui.Item
                    className={menuClass}
                    role="menuitem"
                    icon="home"
                    text={lf("Go Home")}
                    onClick={this.goHome}
                />
            }
        </div>;
    }
}

export interface HomeAccessibilityMenuProps extends ISettingsProps {
    highContrast: boolean;
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
export interface HomeAccessibilityMenuState {
    highContrast?: boolean;
}

export class HomeAccessibilityMenu extends data.Component<HomeAccessibilityMenuProps, HomeAccessibilityMenuState> {

    constructor(props: HomeAccessibilityMenuProps) {
        super(props);
        this.state = {
        }

        this.newProject = this.newProject.bind(this);
        this.importProjectDialog = this.importProjectDialog.bind(this);
        this.showLanguagePicker = this.showLanguagePicker.bind(this);
        this.showThemePicker = this.showThemePicker.bind(this);
    }

    async newProject(): Promise<void> {
        pxt.tickEvent("accmenu.home.new", undefined, { interactiveConsent: true });
        const headers = this.getData(`headers:`);
        const firstProject = (!headers || headers?.length == 0);
        return this.props.parent.newUserCreatedProject(firstProject)
    }

    importProjectDialog() {
        pxt.tickEvent("accmenu.home.importdialog", undefined, { interactiveConsent: true });
        this.props.parent.importProjectDialog();
    }

    showLanguagePicker() {
        pxt.tickEvent("accmenu.home.langpicker");
        this.props.parent.showLanguagePicker();
    }

    showThemePicker() {
        pxt.tickEvent("accmenu.home.showthemepicker", undefined, { interactiveConsent: true });
        this.props.parent.showThemePicker();
    }

    UNSAFE_componentWillReceiveProps(nextProps: HomeAccessibilityMenuProps) {
        const newState: HomeAccessibilityMenuState = {};
        if (nextProps.highContrast != undefined) {
            newState.highContrast = nextProps.highContrast;
        }
        if (Object.keys(newState).length > 0) this.setState(newState)
    }

    shouldComponentUpdate(nextProps: HomeAccessibilityMenuProps, nextState: HomeAccessibilityMenuState, nextContext: any): boolean {
        return this.state.highContrast != nextState.highContrast;
    }

    renderCore() {
        const { highContrast } = this.state;
        const targetTheme = pxt.appTarget.appTheme;
        return <div className="ui accessibleMenu borderless fixed menu" role="menubar">
            <sui.Item className={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" icon="add circle" text={lf("New Project")} onClick={this.newProject} />
            <sui.Item className={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" icon="upload" text={lf("Import Project")} onClick={this.importProjectDialog} />
            {targetTheme.selectLanguage ? <sui.Item className={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" icon="xicon globe" text={lf("Select Language")} onClick={this.showLanguagePicker} /> : undefined}
            {targetTheme.defaultColorTheme ? <sui.Item className={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" icon="paint brush" text={("Select Theme")} onClick={this.showThemePicker} /> : undefined}
        </div>;
    }
}
