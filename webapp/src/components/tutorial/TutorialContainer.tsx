import * as React from "react";
import * as md from "../../marked";

import { Button } from "../../sui";

import { ImmersiveReaderButton } from "../../immersivereader";
import { TutorialStepCounter } from "./TutorialStepCounter";

interface TutorialContainerProps {
    parent: pxt.editor.IProjectView;
    steps: pxt.tutorial.TutorialStepInfo[];
    currentStep?: number;

    tutorialOptions?: pxt.tutorial.TutorialOptions; // TODO (shakao) pass in only necessary subset

    onTutorialStepChange?: (step: number) => void;
}

export function TutorialContainer(props: TutorialContainerProps) {
    const { parent, steps, tutorialOptions, onTutorialStepChange } = props;
    const [ currentStep, setCurrentStep ] = React.useState(props.currentStep || 0);

    const markdown = steps[currentStep].headerContentMd;
    const showImmersiveReader = pxt.appTarget.appTheme.immersiveReader;

    const setTutorialStep = (step: number) => {
        onTutorialStepChange(step);
        setCurrentStep(step);
    }

    return <div className="tutorial-container">
        <div className="tutorial-top-bar">
            <TutorialStepCounter currentStep={currentStep} totalSteps={steps.length} setTutorialStep={setTutorialStep} />
            {showImmersiveReader && <ImmersiveReaderButton content={markdown} tutorialOptions={tutorialOptions} />}
        </div>
        <div className="tutorial-content">
            <md.MarkedContent className="no-select" tabIndex={0} markdown={markdown} parent={parent} />
        </div>
        <div className="tutorial-controls">
            <Button icon="arrow circle left" disabled={currentStep === 0}
                text={lf("Back")} onClick={() => setTutorialStep(Math.max(currentStep - 1, 0))} />
            <Button icon="lightbulb" className="tutorial-hint" />
            <Button icon="arrow circle right" disabled={currentStep === steps.length - 1}
                text={lf("Next")} onClick={() => setTutorialStep(Math.min(currentStep + 1, props.steps.length - 1))} />
        </div>
    </div>
}