import * as React from "react";
import * as md from "../../marked";

import { Button } from "../core/Button";

interface TutorialContainerProps {
    parent: pxt.editor.IProjectView;
    steps: pxt.tutorial.TutorialStepInfo[];
    currentStep?: number;
}

interface TutorialContainerState {
    currentStep: number;
}

export class TutorialContainer extends React.Component<TutorialContainerProps, TutorialContainerState> {
    constructor(props: TutorialContainerProps) {
        super(props);

        this.state = { currentStep: props.currentStep || 0 };
    }

    protected changeTutorialStep(step: number, back?: boolean) {
        const { currentStep } = this.state;
        if (back) {
            this.setState({ currentStep: Math.max(currentStep - 1, 0) });
        } else {
            this.setState({ currentStep: Math.min(currentStep + 1, this.props.steps.length - 1) });
        }
    }

    protected previousArrowClickHandler = () => {
        this.changeTutorialStep(this.state.currentStep, true);
    }

    protected nextArrowClickHandler = () => {
        this.changeTutorialStep(this.state.currentStep);
    }

    render() {
        const { parent, steps } = this.props;
        const { currentStep } = this.state;

        const markdown = steps[currentStep].headerContentMd;

        return <div>
            <div></div>
            <div className="tutorial-content">
                <md.MarkedContent className="no-select" tabIndex={0} markdown={markdown} parent={parent} />
            </div>
            <div className="tutorial-controls">
                <Button icon="arrow left" text={lf("Previous")} onClick={this.previousArrowClickHandler} />
                <Button icon="lightbulb" />
                <Button icon="arrow right" text={lf("Next")} onClick={this.nextArrowClickHandler} />
            </div>
        </div>
    }
}