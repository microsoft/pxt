/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as sui from "./sui";
import * as sounds from "./sounds";
import * as core from "./core";

type ISettingsProps = pxt.editor.ISettingsProps;
type TutorialOptions = pxt.editor.TutorialOptions;

export class TutorialMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    openTutorialStep(step: number) {
        let options = this.props.parent.state.tutorialOptions;
        options.tutorialStep = step;
        pxt.tickEvent(`tutorial.step`, { tutorial: options.tutorial, step: step });
        this.props.parent.setTutorialStep(step);
    }

    render() {
        const { tutorialReady, tutorialSteps, tutorialStep, tutorialName } = this.props.parent.state.tutorialOptions;
        const state = this.props.parent.state;
        const targetTheme = pxt.appTarget.appTheme;
        const currentStep = tutorialStep;

        return <div className="ui item">
            <div className="ui item tutorial-menuitem">
                {tutorialSteps.map((step, index) =>
                    (index == currentStep) ?
                        <span className="step-label" key={'tutorialStep' + index}>
                            <a className={`ui circular label ${currentStep == index ? 'blue selected' : 'inverted'} ${!tutorialReady ? 'disabled' : ''}`} onClick={() => this.openTutorialStep(index) }>{index + 1}</a>
                        </span> :
                        <span className="step-label" key={'tutorialStep' + index} data-tooltip={`${index + 1}`} data-inverted="" data-position="bottom center">
                            <a className={`ui empty circular label ${!tutorialReady ? 'disabled' : ''} clear`} onClick={() => this.openTutorialStep(index) }></a>
                        </span>
                ) }
            </div>
        </div>;
    }
}

export interface TutorialContentState {
    tutorialUrl: string;
}

export class TutorialContent extends data.Component<ISettingsProps, TutorialContentState> {
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
        else this.setState({ tutorialUrl: url });
    }

    shouldComponentUpdate(nextProps: ISettingsProps, nextState: TutorialContentState, nextContext: any): boolean {
        return this.state.tutorialUrl != nextState.tutorialUrl;
    }

    public static refresh() {
        // Show light box
        sounds.tutorialStep();
        $('#root')
            .dimmer({'closable': true})
            .dimmer('show');
    }

    renderCore() {
        const { tutorialUrl } = this.state;
        if (!tutorialUrl) return null;

        return <iframe id="tutorialcontent" style={{"width":"1px", "height": "1px"}} src={tutorialUrl} role="complementary" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
    }
}

export interface TutorialHintState {
    visible: boolean;
}

export class TutorialHint extends data.Component<ISettingsProps, TutorialHintState> {

    constructor(props: ISettingsProps) {
        super(props);
    }

    showHint() {
        this.setState({ visible: true })
    }

    renderCore() {
        const {visible} = this.state;
        const options = this.props.parent.state.tutorialOptions;
        const { tutorialReady, tutorialStepInfo, tutorialStep, tutorialName} = options;
        if (!tutorialReady) return <div />;

        const tutorialHint = tutorialStepInfo[tutorialStep].content;
        const tutorialFullscreen = tutorialStepInfo[tutorialStep].fullscreen;

        // TODO: Use step name instead of tutorial Name in full screen mode.
        const header = tutorialFullscreen ? tutorialName : lf("Hint");

        return <sui.Modal open={visible} className="hintdialog" size="small" header={header} closeIcon={true}
                onClose={() => this.setState({ visible: false })} dimmer={true}
                closeOnDimmerClick closeOnDocumentClick>
                    <div className="content">
                        <div dangerouslySetInnerHTML={{__html: tutorialHint}} />
                    </div>
                    <div className="actions" style={{textAlign: "right"}}>
                        <sui.Button class="green" icon={`check`} text={lf("Ok") } onClick={() => this.setState({ visible: false }) } />
                    </div>
            </sui.Modal>;
    }
}

export class TutorialCard extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    previousTutorialStep() {
        let options = this.props.parent.state.tutorialOptions;
        const currentStep = options.tutorialStep;
        const previousStep = currentStep - 1;

        options.tutorialStep = previousStep;

        pxt.tickEvent(`tutorial.previous`, { tutorial: options.tutorial, step: previousStep });
        this.props.parent.setTutorialStep(previousStep);
    }

    nextTutorialStep() {
        let options = this.props.parent.state.tutorialOptions;
        const currentStep = options.tutorialStep;
        const nextStep = currentStep + 1;

        options.tutorialStep = nextStep;

        pxt.tickEvent(`tutorial.next`, { tutorial: options.tutorial, step: nextStep });
        this.props.parent.setTutorialStep(nextStep);
    }

    finishTutorial() {
        this.closeLightbox();
        this.props.parent.completeTutorial();
    }

    closeLightbox() {
        // Hide light box
        sounds.tutorialNext();
        $('#root')
            .dimmer('hide');
    }

    componentWillUpdate() {
        $('#tutorialhint')
         .modal('attach events', '#tutorialcard .ui.button.hintbutton', 'show');
        ;
    }

    showHint() {
        this.closeLightbox();
        this.props.parent.showTutorialHint();
    }

    render() {
        const options = this.props.parent.state.tutorialOptions;
        const { tutorialReady, tutorialStepInfo, tutorialStep, tutorialSteps } = options;
        if (!tutorialReady) return <div />
        const tutorialHeaderContent = tutorialStepInfo[tutorialStep].headerContent;

        const currentStep = tutorialStep;
        const maxSteps = tutorialSteps.length;
        const hasPrevious = tutorialReady && currentStep != 0;
        const hasNext = tutorialReady && currentStep != maxSteps - 1;
        const hasFinish = currentStep == maxSteps - 1;
        const hasHint = tutorialStepInfo[tutorialStep].hasHint;

        return <div id="tutorialcard" className={`ui ${tutorialReady ? 'tutorialReady' : ''}`} >
            <div className='ui buttons'>
                <div className="ui segment attached message">
                    <div className='avatar-image' onClick={() => this.showHint()}></div>
                    {hasHint ? <sui.Button class="mini blue hintbutton hidelightbox" text={lf("Hint") } onClick={() => this.showHint()} /> : undefined }
                    <div className='tutorialmessage' onClick={() => this.showHint()}>
                        <div className="content" dangerouslySetInnerHTML={{__html: tutorialHeaderContent}} />
                    </div>
                    <sui.Button class="large green okbutton showlightbox" text={lf("Ok") } onClick={() => this.closeLightbox() } />
                </div>
                {hasNext ? <sui.Button icon="right chevron" class={`ui right icon button nextbutton right attached green ${!hasNext ? 'disabled' : ''}`} text={lf("Next") } onClick={() => this.nextTutorialStep() } /> : undefined }
                {hasFinish ? <sui.Button icon="left checkmark" class={`ui icon orange button ${!tutorialReady ? 'disabled' : ''}`} text={lf("Finish") } onClick={() => this.finishTutorial() } /> : undefined }
            </div>
        </div>;
    }
}

export interface TutorialCompleteState {
    visible?: boolean;
}

export class TutorialComplete extends data.Component<ISettingsProps, TutorialCompleteState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false
        }
    }

    hide() {
        this.setState({ visible: false });
    }

    show() {
        this.setState({ visible: true });
    }

    moreTutorials() {
        pxt.tickEvent(`tutorial.completed.more`);
        this.props.parent.openTutorials();
    }

    exitTutorial() {
        pxt.tickEvent(`tutorial.completed.exit`);
        this.hide();
        this.props.parent.exitTutorial(true);
    }

    renderCore() {
        const { visible } = this.state;

        return (
            <sui.Modal open={this.state.visible} className="sharedialog" header={lf("Congratulations! What's next?") } size="small"
                onClose={() => this.setState({ visible: false }) } dimmer={true}
                closeIcon={true}
                closeOnDimmerClick closeOnDocumentClick
                >
                <div className="ui two stackable cards">
                    <div className="ui grid centered link card" onClick={() => this.moreTutorials() }>
                        <div className="content">
                            <i className="avatar-image icon huge" style={{fontSize: '100px'}}/>
                        </div>
                        <div className="content">
                            <div className="header">
                                {lf("More Tutorials")}
                            </div>
                        </div>
                    </div>
                    <div className="ui grid centered link card" onClick={() => this.exitTutorial() }>
                        <div className="content">
                            <i className="external icon huge black" style={{fontSize: '100px'}} />
                        </div>
                        <div className="content">
                            <div className="header">
                                {lf("Exit Tutorial")}
                            </div>
                        </div>
                    </div>
                </div>
            </sui.Modal>
        )
    }
}