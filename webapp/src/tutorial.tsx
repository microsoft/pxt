/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";
import * as sounds from "./sounds";
import * as core from "./core";

type ISettingsProps = pxt.editor.ISettingsProps;

export class TutorialMenuItem extends data.Component<ISettingsProps, {}> {
    constructor(props: ISettingsProps) {
        super(props);
    }

    openTutorialStep(step: number) {
        let options = this.props.parent.state.tutorialOptions;
        options.tutorialStep = step;
        pxt.tickEvent(`tutorial.step`, { tutorial: options.tutorial, step: step }, { interactiveConsent: true });
        this.props.parent.setTutorialStep(step);
    }

    renderCore() {
        const { tutorialReady, tutorialStepInfo, tutorialStep } = this.props.parent.state.tutorialOptions;
        const currentStep = tutorialStep;
        if (!tutorialReady) return <div />;

        return <div className="ui item">
            <div className="ui item tutorial-menuitem" role="menubar">
                {tutorialStepInfo.map((step, index) =>
                    (index == currentStep) ?
                        <span className="step-label" key={'tutorialStep' + index}>
                            <a className={`ui circular label ${currentStep == index ? 'blue selected' : 'inverted'} ${!tutorialReady ? 'disabled' : ''}`} role="menuitem" aria-label={lf("Tutorial step {0}. This is the current step", index + 1)} tabIndex={0} onClick={() => this.openTutorialStep(index)} onKeyDown={sui.fireClickOnEnter}>{index + 1}</a>
                        </span> :
                        <span className="step-label" key={'tutorialStep' + index} data-tooltip={`${index + 1}`} data-inverted="" data-position="bottom center">
                            <a className={`ui empty circular label ${!tutorialReady ? 'disabled' : ''} clear`} role="menuitem" aria-label={lf("Tutorial step {0}", index + 1)} tabIndex={0} onClick={() => this.openTutorialStep(index)} onKeyDown={sui.fireClickOnEnter}></a>
                        </span>
                )}
            </div>
        </div>;
    }
}

// This Component overrides shouldComponentUpdate, be sure to update that if the state is updated
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
        sounds.tutorialStep();
        const okButton = document.getElementById('tutorialOkButton');
        if (okButton) okButton.focus();
    }

    renderCore() {
        const { tutorialUrl } = this.state;
        if (!tutorialUrl) return null;

        return <iframe id="tutorialcontent" style={{ "width": "1px", "height": "1px" }} src={tutorialUrl} role="complementary" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
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
        const { visible } = this.state;
        const options = this.props.parent.state.tutorialOptions;
        const { tutorialReady, tutorialStepInfo, tutorialStep, tutorialName } = options;
        if (!tutorialReady) return <div />;

        const step = tutorialStepInfo[tutorialStep];
        const tutorialHint = step.content;
        const tutorialFullscreen = step.fullscreen;
        const tutorialUnplugged = !!step.unplugged && tutorialStep < tutorialStepInfo.length - 1;

        const header = tutorialFullscreen ? (step.titleContent || tutorialName) : lf("Hint");

        const hide = () => this.setState({ visible: false });
        const next = () => {
            const nextStep = tutorialStep + 1;
            options.tutorialStep = nextStep;
            pxt.tickEvent(`tutorial.hint.next`, { tutorial: options.tutorial, step: nextStep });
            this.props.parent.setTutorialStep(nextStep);
        }

        const actions: sui.ModalButton[] = [tutorialUnplugged ? {
            label: lf("Next"),
            onclick: next,
            icon: 'check',
            className: 'green'
        } : {
                label: lf("Ok"),
                onclick: hide,
                icon: 'check',
                className: 'green'
            }]

        return <sui.Modal isOpen={visible} className="hintdialog"
            closeIcon={true} header={header} buttons={actions}
            onClose={hide} dimmer={true} longer={true}
            closeOnDimmerClick closeOnDocumentClick closeOnEscape>
            <div dangerouslySetInnerHTML={{ __html: tutorialHint }} />
        </sui.Modal>;
    }
}

interface TutorialCardState {
    popout?: boolean;
}

export class TutorialCard extends data.Component<ISettingsProps, TutorialCardState> {
    public focusInitialized: boolean;

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
        }

        this.tutorialCardKeyDown = this.tutorialCardKeyDown.bind(this);
        this.okButtonKeyDown = this.okButtonKeyDown.bind(this);
    }

    previousTutorialStep() {
        let options = this.props.parent.state.tutorialOptions;
        const currentStep = options.tutorialStep;
        const previousStep = currentStep - 1;

        options.tutorialStep = previousStep;

        pxt.tickEvent(`tutorial.previous`, { tutorial: options.tutorial, step: previousStep }, { interactiveConsent: true });
        this.props.parent.setTutorialStep(previousStep);
    }

    nextTutorialStep() {
        let options = this.props.parent.state.tutorialOptions;
        const currentStep = options.tutorialStep;
        const nextStep = currentStep + 1;

        options.tutorialStep = nextStep;

        pxt.tickEvent(`tutorial.next`, { tutorial: options.tutorial, step: nextStep }, { interactiveConsent: true });
        this.props.parent.setTutorialStep(nextStep);
    }

    finishTutorial() {
        this.closeLightbox();
        this.props.parent.completeTutorial();
    }

    private closeLightboxOnEscape = (e: KeyboardEvent) => {
        const charCode = core.keyCodeFromEvent(e);
        if (charCode === 27) {
            this.closeLightbox();
        }
    }

    setPopout() {
        this.setState({ popout: true });
    }

    private closeLightbox() {
        sounds.tutorialNext();
        document.documentElement.removeEventListener("keydown", this.closeLightboxOnEscape);

        // Hide lightbox
        this.props.parent.hideLightbox();
        this.setState({ popout: false });
    }

    componentWillUpdate() {
        document.documentElement.addEventListener("keydown", this.closeLightboxOnEscape);
    }

    private tutorialCardKeyDown(e: KeyboardEvent) {
        const charCode = core.keyCodeFromEvent(e);
        if (charCode == core.TAB_KEY) {
            e.preventDefault();
            const tutorialOkRef = this.refs["tutorialok"] as sui.Button;
            const okButton = ReactDOM.findDOMNode(tutorialOkRef) as HTMLElement;
            okButton.focus();
        }
    }

    private okButtonKeyDown(e: KeyboardEvent) {
        const charCode = core.keyCodeFromEvent(e);
        if (charCode == core.TAB_KEY) {
            e.preventDefault();
            const tutorialCard = this.refs['tutorialmessage'] as HTMLElement;
            tutorialCard.focus();
        }
    }

    componentDidUpdate(prevProps: ISettingsProps, prevState: TutorialCardState) {
        const tutorialCard = this.refs['tutorialmessage'] as HTMLElement;
        const tutorialOkRef = this.refs["tutorialok"] as sui.Button;
        const okButton = ReactDOM.findDOMNode(tutorialOkRef) as HTMLElement;
        if (prevState.popout != this.state.popout && this.state.popout) {
            // Setup focus trap around the tutorial card and the ok button
            tutorialCard.addEventListener('keydown', this.tutorialCardKeyDown);
            okButton.addEventListener('keydown', this.okButtonKeyDown);
            tutorialCard.focus();
        } else if (prevState.popout != this.state.popout && !this.state.popout) {
            // Unregister event handlers
            tutorialCard.removeEventListener('keydown', this.tutorialCardKeyDown);
            okButton.removeEventListener('keydown', this.okButtonKeyDown);
            tutorialCard.focus();
        }
    }

    showHint() {
        this.closeLightbox();
        this.props.parent.showTutorialHint();
    }

    renderCore() {
        const options = this.props.parent.state.tutorialOptions;
        const { tutorialReady, tutorialStepInfo, tutorialStep } = options;
        if (!tutorialReady) return <div />
        const tutorialHeaderContent = tutorialStepInfo[tutorialStep].headerContent;
        let tutorialAriaLabel = tutorialStepInfo[tutorialStep].ariaLabel;

        const currentStep = tutorialStep;
        const maxSteps = tutorialStepInfo.length;
        const hasNext = tutorialReady && currentStep != maxSteps - 1;
        const hasFinish = currentStep == maxSteps - 1;
        const hasHint = tutorialStepInfo[tutorialStep].hasHint;

        if (hasHint) {
            tutorialAriaLabel += lf("Press Space or Enter to show a hint.");
        }

        return <div id="tutorialcard" className={`ui ${tutorialReady ? 'tutorialReady' : ''}`} >
            <div className='ui buttons'>
                <div className="ui segment attached tutorialsegment">
                    <div className='avatar-image' onClick={() => this.showHint()} onKeyDown={sui.fireClickOnEnter}></div>
                    {hasHint ? <sui.Button className="mini blue hintbutton hidelightbox" text={lf("Hint")} tabIndex={-1} onClick={() => this.showHint()} onKeyDown={sui.fireClickOnEnter} /> : undefined}
                    <div ref="tutorialmessage" className={`tutorialmessage`} role="alert" aria-label={tutorialAriaLabel} tabIndex={hasHint ? 0 : -1} onClick={() => { if (hasHint) this.showHint(); }} onKeyDown={sui.fireClickOnEnter}>
                        <div className="content" dangerouslySetInnerHTML={{ __html: tutorialHeaderContent }} />
                    </div>
                    <sui.Button ref="tutorialok" id="tutorialOkButton" className="large green okbutton showlightbox" text={lf("Ok")} onClick={() => this.closeLightbox()} onKeyDown={sui.fireClickOnEnter} />
                </div>
                {hasNext ? <sui.Button icon="right chevron" rightIcon className={`nextbutton right attached green ${!hasNext ? 'disabled' : ''}`} text={lf("Next")} ariaLabel={lf("Go to the next step of the tutorial.")} onClick={() => this.nextTutorialStep()} onKeyDown={sui.fireClickOnEnter} /> : undefined}
                {hasFinish ? <sui.Button icon="left checkmark" className={`orange right attached ${!tutorialReady ? 'disabled' : ''}`} text={lf("Finish")} ariaLabel={lf("Finish the tutorial.")} onClick={() => this.finishTutorial()} onKeyDown={sui.fireClickOnEnter} /> : undefined}
            </div>
        </div>;
    }
}