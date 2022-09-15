import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
interface TutorialStepCounterProps {
    tutorialId: string;
    currentStep: number;
    totalSteps: number;
    title?: string;
    setTutorialStep: (step: number) => void;
}

export function TutorialStepCounter(props: TutorialStepCounterProps) {
    const { tutorialId, currentStep, totalSteps, title } = props;

    const MAX_BUBBLES = 7;
    const startPoint = Math.max(0, Math.min(currentStep - Math.floor(MAX_BUBBLES / 2), totalSteps - MAX_BUBBLES));

    const stepsToShow = [];
    for (let i = 0; i < Math.min(MAX_BUBBLES, totalSteps); i++) {
        stepsToShow.push(i + startPoint);
    }

    const handleSetStep = (step: number) => () => {
        const { setTutorialStep } = props;
        pxt.tickEvent("tutorial.step", { tutorial: tutorialId, step: step }, { interactiveConsent: true });
        setTutorialStep(step);
    }

    const stepButtonLabelText = (step: number) => lf("Go to step {0} of {1}", step + 1, totalSteps);
    const backButtonLabel = lf("Go to the previous step of the tutorial.");
    const nextButtonLabel = lf("Go to the next step of the tutorial.");

    return <div className="tutorial-step-counter">
        <div className="tutorial-step-label">
            <span className="tutorial-step-title">{title || lf("Step")}</span>
            <span className="tutorial-step-number">{`${currentStep + 1}/${totalSteps}`}</span>
        </div>
        <div className="tutorial-step-bubbles">
            <Button
                disabled={currentStep == 0}
                className={`square-button ${currentStep == 0 ? "disabled" : ""}`}
                leftIcon="icon left chevron"
                onClick={handleSetStep(currentStep - 1)}
                aria-label={backButtonLabel}
                title={backButtonLabel}
            />
            {stepsToShow.map(stepNum => <Button
                key={`step${stepNum}`}
                className={`empty circle-button ${stepNum === currentStep ? "active" : ""}`}
                onClick={handleSetStep(stepNum)}
                aria-label={stepButtonLabelText(stepNum)}
                title={stepButtonLabelText(stepNum)}
                label={stepNum === currentStep ? `${stepNum + 1}` : undefined}
            />)}
            <Button
                disabled={currentStep == totalSteps - 1}
                className={`square-button ${currentStep == -1 ? "disabled" : ""}`}
                leftIcon="icon right chevron"
                onClick={handleSetStep(currentStep + 1)}
                aria-label={nextButtonLabel}
                title={nextButtonLabel}
            />
        </div>
    </div>
}