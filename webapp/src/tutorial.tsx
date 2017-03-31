/// <reference path="../../typings/globals/react/index.d.ts" />
/// <reference path="../../typings/globals/react-dom/index.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as workspace from "./workspace";
import * as data from "./data";
import * as sui from "./sui";

type ISettingsProps = pxt.editor.ISettingsProps;
type TutorialOptions = pxt.editor.TutorialOptions;

export class TutorialMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    openTutorialStep(step: number) {
        let options = this.props.parent.state.tutorialOptions;
        options.tutorialStep = step;
        options.tutorialReady = false;
        pxt.tickEvent(`tutorial.step`, { tutorial: options.tutorial, step: step });
        this.props.parent.setState({ tutorialOptions: options })
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
                        <sui.Button key={'tutorialStep' + index} class={`icon circular ${currentStep == index ? 'red selected' : 'inverted'} ${!tutorialReady ? 'disabled' : ''}`} text={`${index + 1}`} onClick={() => this.openTutorialStep(index) }/> :
                        <button key={'tutorialStep' + index} className={`ui button icon circular inverted ${!tutorialReady ? 'disabled' : ''} clear`} data-tooltip={`${index + 1}`} data-position="bottom right" data-variation="inverted" onClick={() => this.openTutorialStep(index) }>
                            <i className="icon circle thin" />
                        </button>
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
        $('#root')
            .dimmer({'closable': true})
            .dimmer('show');
    }

    renderCore() {
        const { tutorialUrl } = this.state;
        if (!tutorialUrl) return null;

        return <iframe id="tutorialcontent" style={{"width":"1px", "height": "1px"}} onLoad={() => TutorialContent.refresh()} src={tutorialUrl} role="complementary" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
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
        const { tutorialReady, tutorialHint } = options;
        if (!tutorialHint) return <div />;

        return <sui.Modal open={visible} className="hintdialog" size="large" header={lf("Hint") } closeIcon={true}
                onClose={() => this.setState({ visible: false })} dimmer={true}
                closeOnDimmerClick closeOnDocumentClick>
                    <div className="content">
                        <div dangerouslySetInnerHTML={{__html: tutorialHint}} />
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
        options.tutorialReady = false;

        pxt.tickEvent(`tutorial.previous`, { tutorial: options.tutorial, step: previousStep });
        this.props.parent.setState({ tutorialOptions: options })
        this.props.parent.setTutorialStep(previousStep);
    }

    nextTutorialStep() {
        let options = this.props.parent.state.tutorialOptions;
        const currentStep = options.tutorialStep;
        const nextStep = currentStep + 1;

        options.tutorialStep = nextStep;
        options.tutorialReady = false;

        pxt.tickEvent(`tutorial.next`, { tutorial: options.tutorial, step: nextStep });
        this.props.parent.setState({ tutorialOptions: options })
        this.props.parent.setTutorialStep(nextStep);
    }

    finishTutorial() {
        this.closeLightbox();
        this.props.parent.exitTutorial();
    }

    closeLightbox() {
        // Hide light box
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
        const { tutorialReady, tutorialHeaderContent, tutorialStep, tutorialSteps } = options;
        if (!tutorialReady) return <div />

        const currentStep = tutorialStep;
        const maxSteps = tutorialSteps.length;
        const hasPrevious = tutorialReady && currentStep != 0;
        const hasNext = tutorialReady && currentStep != maxSteps - 1;
        const hasFinish = currentStep == maxSteps - 1;

        return <div id="tutorialcard" className={`ui ${tutorialReady ? 'tutorialReady' : ''}`} >
            <div className='ui buttons'>
                <button className={`ui left attached button prevbutton icon grey ${!hasPrevious ? 'disabled' : ''}`} title={lf("Back") } onClick={() => this.previousTutorialStep()}>
                    <i className="left chevron icon"></i>
                </button>
                <div className="ui segment attached message">
                    <div className='avatar-image' onClick={() => this.showHint()}></div>
                    <div className='tutorialmessage' onClick={() => this.showHint()}>
                        <div className="content" dangerouslySetInnerHTML={{__html: tutorialHeaderContent}} />
                    </div>
                    <sui.Button class="large green okbutton showlightbox" text={lf("Ok") } onClick={() => this.closeLightbox() } />
                    <sui.Button class="mini blue hintbutton hidelightbox" text={lf("Hint") } onClick={() => this.showHint()} />
                </div>
                <button className={`ui right icon button nextbutton right attached grey ${!hasNext ? 'disabled' : ''}`} title={lf("Next") } onClick={() => this.nextTutorialStep()}>
                    <i className="right chevron icon"></i>
                </button>
                {hasFinish ? <sui.Button icon="left checkmark" class={`ui icon orange button ${!tutorialReady ? 'disabled' : ''}`} text={lf("Finish") } onClick={() => this.finishTutorial() } /> : undefined }
            </div>
        </div>;
    }
}