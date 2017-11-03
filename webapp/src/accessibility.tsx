/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface EditorAccessibilityMenuProps extends ISettingsProps {
    highContrast: boolean;
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
export interface EditorAccessibilityMenuState {
    highContrast?: boolean;
}

export class EditorAccessibilityMenu extends data.Component<EditorAccessibilityMenuProps, EditorAccessibilityMenuState> {

    openJavaScript() {
        pxt.tickEvent("accmenu.editor.openJS");
        this.props.parent.openJavaScript();
    }

    selectLang() {
        pxt.tickEvent("accmenu.editor.importdialog");
        this.props.parent.selectLang();
    }

    toggleHighContrast() {
        pxt.tickEvent("accmenu.editor.togglecontrast");
        this.props.parent.toggleHighContrast();
    }

    goHome() {
        pxt.tickEvent("accmenu.editor.home");
        this.props.parent.exitAndSave();
    }

    componentWillReceiveProps(nextProps: EditorAccessibilityMenuProps) {
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
        const {highContrast} = this.props.parent.state;
        const targetTheme = pxt.appTarget.appTheme;
        return <div className="ui accessibleMenu borderless fixed menu" role="menubar">
            <sui.Item class={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" icon="xicon js" text={lf("Skip to JavaScript editor") } onClick={() => this.openJavaScript() } />
            {targetTheme.selectLanguage ? <sui.Item class={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" icon="xicon globe" text={lf("Select Language") } onClick={() => this.selectLang() } /> : undefined}
            {targetTheme.highContrast ? <sui.Item class={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" text={highContrast ? lf("High Contrast Off") : lf("High Contrast On") } onClick={() => this.toggleHighContrast() } /> : undefined}
            <sui.Item class={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" icon="home" text={lf("Go Home") } onClick={() => this.goHome() } />
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

    newProject() {
        pxt.tickEvent("accmenu.home.new");
        this.props.parent.newProject();
    }

    importProjectDialog() {
        pxt.tickEvent("accmenu.home.importdialog");
        this.props.parent.importProjectDialog();
    }

    selectLang() {
        pxt.tickEvent("accmenu.home.langpicker");
        this.props.parent.selectLang();
    }

    toggleHighContrast() {
        pxt.tickEvent("accmenu.home.togglecontrast");
        this.props.parent.toggleHighContrast();
    }

    componentWillReceiveProps(nextProps: HomeAccessibilityMenuProps) {
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
        const {highContrast} = this.state;
        const targetTheme = pxt.appTarget.appTheme;
        return <div className="ui accessibleMenu borderless fixed menu" role="menubar">
            <sui.Item class={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" icon="add circle" text={lf("New Project") } onClick={() => this.newProject() } />
            <sui.Item class={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" icon="upload" text={lf("Import Project") } onClick={() => this.importProjectDialog() } />
            {targetTheme.selectLanguage ? <sui.Item class={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" icon="xicon globe" text={lf("Select Language") } onClick={() => this.selectLang() } /> : undefined}
            {targetTheme.highContrast ? <sui.Item class={`${targetTheme.invertedMenu ? `inverted` : ''} menu`} role="menuitem" text={highContrast ? lf("High Contrast Off") : lf("High Contrast On") } onClick={() => this.toggleHighContrast() } /> : undefined}
        </div>;
    }
}