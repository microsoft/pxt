/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as sui from "./sui";

type ISettingsProps = pxt.editor.ISettingsProps;

export class TutorialMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    openTutorialStep(step: number) {
        pxt.tickEvent(`tutorial.step`, { tutorial: this.props.parent.state.tutorial, step: step });
        this.props.parent.setState({ tutorialStep: step, tutorialReady: false })
        this.props.parent.setTutorialStep(step);
    }

    render() {
        const state = this.props.parent.state;
        const tutorialReady = state.tutorialReady;
        const targetTheme = pxt.appTarget.appTheme;
        const tutorialSteps = state.tutorialSteps;
        const currentStep = state.tutorialStep;
        const tutorialName = state.tutorialName;

        return <div className="ui item">
            <div className="ui item tutorial-menuitem">
                {tutorialSteps.map((step, index) =>
                    <sui.Button key={'tutorialStep' + index} class={`icon circular ${currentStep == index ? 'red selected' : 'inverted'} ${!tutorialReady ? 'disabled' : ''}`} text={` ${index + 1} `} onClick={() => this.openTutorialStep(index) }/>
                ) }
            </div>
        </div>;
    }
}

interface TutorialOptions {
    tutorialId: string;
    tutorialName: string;
    showCategories?: boolean;
}

export class TutorialContent extends data.Component<ISettingsProps, {}> {
    public static notify(message: pxsim.SimulatorMessage) {
        let tc = document.getElementById("tutorialcontent") as HTMLIFrameElement;
        if (tc && tc.contentWindow) tc.contentWindow.postMessage(message, "*");
    }

    constructor(props: ISettingsProps) {
        super(props);
    }

    setPath(path: string) {
        const docsUrl = pxt.webConfig.docsUrl || '/--docs';
        const mode = this.props.parent.isBlocksEditor() ? "blocks" : "js";
        const url = `${docsUrl}#tutorial:${path}:${mode}:${pxt.Util.localeInfo()}`;
        this.setUrl(url);
    }

    private setUrl(url: string) {
        let el = document.getElementById("tutorialcontent") as HTMLIFrameElement;
        if (el) el.src = url;
        else this.props.parent.setState({ tutorialUrl: url });
    }

    public static refresh() {
        let el = document.getElementById("tutorialcontent") as HTMLIFrameElement;
        if (el && el.contentWindow) {
            el.parentElement.style.height = "";
            el.parentElement.style.height = el.contentWindow.document.body.scrollHeight + "px";
        }
    }

    renderCore() {
        const state = this.props.parent.state;
        const docsUrl = state.tutorialUrl;
        if (!docsUrl) return null;

        return <iframe id="tutorialcontent" onLoad={() => TutorialContent.refresh() } src={docsUrl} role="complementary" sandbox="allow-scripts allow-same-origin allow-popups" />
    }
}

export class TutorialCard extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    previousTutorialStep() {
        const currentStep = this.props.parent.state.tutorialStep;
        const previousStep = currentStep - 1;

        pxt.tickEvent(`tutorial.previous`, { tutorial: this.props.parent.state.tutorial, step: previousStep });
        this.props.parent.setState({ tutorialStep: previousStep, tutorialReady: false })
        this.props.parent.setTutorialStep(previousStep);
    }

    nextTutorialStep() {
        const currentStep = this.props.parent.state.tutorialStep;
        const nextStep = currentStep + 1;

        pxt.tickEvent(`tutorial.next`, { tutorial: this.props.parent.state.tutorial, step: nextStep });
        this.props.parent.setState({ tutorialStep: nextStep, tutorialReady: false })
        this.props.parent.setTutorialStep(nextStep);
    }

    finishTutorial() {
        this.props.parent.exitTutorial();
    }

    setPath(path: string) {
        let tc = this.refs["tutorialcontent"] as TutorialContent;
        if (!tc) return;
        tc.setPath(path);
    }

    render() {
        const state = this.props.parent.state;
        const tutorialReady = state.tutorialReady;
        const currentStep = state.tutorialStep;
        const cardLocation = state.tutorialCardLocation || 'bottom';
        const maxSteps = state.tutorialSteps.length;
        const hasPrevious = currentStep != 0;
        const hasNext = currentStep != maxSteps - 1;
        const hasFinish = currentStep == maxSteps - 1;

        return <div id="tutorialcard" className={`ui ${pxt.options.light ? "" : "transition fly in"} ${cardLocation} visible active`}>
            <div className="ui raised fluid card">
                <div className="ui">
                    <TutorialContent ref="tutorialcontent" parent={this.props.parent} />
                </div>
                <div className="extra content">
                    <div className="ui two buttons">
                        {hasPrevious ? <sui.Button icon="left chevron" class={`ui icon red button ${!tutorialReady ? 'disabled' : ''}`} text={lf("Back") } onClick={() => this.previousTutorialStep() } /> : undefined }
                        {hasNext ? <sui.Button icon="right chevron" class={`ui icon green button ${!tutorialReady ? 'disabled' : ''}`} text={lf("Next") } onClick={() => this.nextTutorialStep() } /> : undefined }
                        {hasFinish ? <sui.Button icon="left checkmark" class={`ui icon orange button ${!tutorialReady ? 'disabled' : ''}`} text={lf("Finish") } onClick={() => this.finishTutorial() } /> : undefined }
                    </div>
                </div>
            </div>
        </div>;
    }
}