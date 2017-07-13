/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as sui from "./sui";
import * as pkg from "./package";
import * as core from "./core";
import * as compiler from "./compiler";

import * as codecard from "./codecard"
import * as gallery from "./gallery";

export interface SelectionResult {
    clickedCloseButton: boolean;
}

interface LandingProps {
    onSelect: (result: SelectionResult) => void;
}

interface LandingState {
    visible: boolean;
}

export let landingDialog: LandingDialog;

export class LandingDialog extends data.Component<LandingProps, LandingState> {
    constructor(props: LandingProps) {
        super(props)
        this.state = {
            visible: true
        }
    }

    hide(result?: SelectionResult) {
        this.setState({ visible: false });
        this.props.onSelect(result);
    }

    show() {
        this.setState({ visible: true });
    }

    shouldComponentUpdate(nextProps: LandingProps, nextState: LandingState, nextContext: any): boolean {
        return this.state.visible != nextState.visible;
    }

    renderCore() {
        landingDialog = this;
        const visible = this.state.visible;
        const theme = pxt.appTarget.appTheme;

        // lf("Make")
        // lf("Code")
        // lf("Projects")
        // lf("Examples")
        // lf("Tutorials")

        return (
            <sui.Modal open={visible} className="projectsdialog" size="fullscreen" closeIcon={false}
                onClose={() => this.setState({ visible: false }) } dimmer={true}>
                <button onClick={() => this.hide({clickedCloseButton: true})}>Close</button>
            </sui.Modal >
        );
    }
}
