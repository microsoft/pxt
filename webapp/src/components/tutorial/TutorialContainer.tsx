import * as React from "react";
import * as md from "../../marked";

import { Button } from "../core/Button";
import { ImmersiveReaderButton } from "../../immersivereader";
import { TutorialStepCounter } from "./TutorialStepCounter";

interface TutorialContainerProps {
    parent: pxt.editor.IProjectView;
    steps: pxt.tutorial.TutorialStepInfo[];
    currentStep?: number;

    tutorialOptions?: pxt.tutorial.TutorialOptions; // todo shakao see if we can remove
}

interface TutorialContainerState {
    currentStep: number;
}

export class TutorialContainer extends React.Component<TutorialContainerProps, TutorialContainerState> {
    constructor(props: TutorialContainerProps) {
        super(props);

        this.state = { currentStep: props.currentStep || 0 };
    }

    protected setTutorialStep = (step: number) => {
        this.setState({ currentStep: step });
    }

    protected previousArrowClickHandler = () => {
        this.setTutorialStep(Math.max(this.state.currentStep - 1, 0));
    }

    protected nextArrowClickHandler = () => {
        this.setTutorialStep(Math.min(this.state.currentStep + 1, this.props.steps.length - 1) );
    }

    render() {
        const { parent, steps, tutorialOptions } = this.props;
        const { currentStep } = this.state;

        const showImmersiveReader = pxt.appTarget.appTheme.immersiveReader;
        const markdown = steps[currentStep].headerContentMd;

        return <div className="tutorial-container">
            {/* for title, steps, etc <div></div> */}
            <div className="tutorial-top-bar">
                <TutorialStepCounter currentStep={currentStep} totalSteps={steps.length} setTutorialStep={this.setTutorialStep} />
                {showImmersiveReader && <ImmersiveReaderButton content={markdown} tutorialOptions={tutorialOptions} />}
            </div>
            <div className="tutorial-content">
                <md.MarkedContent className="no-select" tabIndex={0} markdown={markdown} parent={parent} />
            </div>
            <div className="tutorial-controls">
                <Button icon="arrow circle  left" text={lf("Back")} onClick={this.previousArrowClickHandler} />
                <Button icon="lightbulb" className="tutorial-hint" />
                {/* TODO has prev has next css  */}
                <Button icon="arrow circle right" text={lf("Next")} textFirst={true} onClick={this.nextArrowClickHandler} />
            </div>
        </div>
    }
}