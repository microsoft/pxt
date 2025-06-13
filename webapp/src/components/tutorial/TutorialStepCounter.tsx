import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
interface TutorialStepCounterProps {
    tutorialId: string;
    currentStep: number;
    totalSteps: number;
    title?: string;
    isHorizontal?: boolean;
    hideDone?: boolean;
    setTutorialStep: (step: number) => void;
    onDone: () => void;
}

export function TutorialStepCounter(props: TutorialStepCounterProps) {
    const { tutorialId, currentStep, totalSteps, title, setTutorialStep } = props;

    const MAX_BUBBLES = 7;
    const startPoint = Math.max(0, Math.min(currentStep - Math.floor(MAX_BUBBLES / 2), totalSteps - MAX_BUBBLES));

    const stepsToShow = [];
    for (let i = 0; i < Math.min(MAX_BUBBLES, totalSteps); i++) {
        stepsToShow.push(i + startPoint);
    }

    const handleSetStep = (step: number) => () => {
        pxt.tickEvent("tutorial.step", { tutorial: tutorialId, step: step, prevStep: currentStep }, { interactiveConsent: true });
        setTutorialStep(step);
    }

    const handlePreviousStep = () => {
        const step = Math.max(currentStep - 1, 0);
        pxt.tickEvent("tutorial.previous", { tutorial: tutorialId, step: step, isModal: 0, isStepCounter: 1 }, { interactiveConsent: true });
        setTutorialStep(step);
    }

    const handleNextStep = () => {
        const step = Math.min(currentStep + 1, totalSteps - 1);
        setTutorialStep(step);
    }

    const stepButtonLabelText = (step: number) => lf("Go to step {0} of {1}", step + 1, totalSteps);
    const backButtonLabel = lf("Go to the previous step of the tutorial.");

    const lastStep = currentStep == totalSteps - 1;
    const nextButtonTitle = lastStep ? lf("Finish the tutorial.") : lf("Go to the next step of the tutorial.");
    const showNextButton = !lastStep || !props.hideDone;

    return <div className="tutorial-step-counter">
        <div className="tutorial-step-label">
            {title && <span className="tutorial-step-title">{title}</span>}
            <span className="tutorial-step-number">{lf("Step {0} of {1}", currentStep + 1, totalSteps)}</span>
        </div>
        <div className="tutorial-step-bubbles">
            <Button
                disabled={currentStep == 0}
                className={props.isHorizontal ? "ui button counter-previous-button" : "square-button"}
                leftIcon={`icon ${props.isHorizontal ? "arrow circle left" : "left chevron"}`}
                onClick={handlePreviousStep}
                aria-label={backButtonLabel}
                title={backButtonLabel} />
            {stepsToShow.map(stepNum => {
                const isCurrentStep = stepNum === currentStep;
                return <Button
                    key={`step${stepNum}`}
                    className={`empty circle-button ${isCurrentStep ? "current" : ""}`}
                    disabled={isCurrentStep}
                    onClick={handleSetStep(stepNum)}
                    aria-label={stepButtonLabelText(stepNum)}
                    title={stepButtonLabelText(stepNum)}
                    label={stepNum === currentStep ? `${stepNum + 1}` : undefined}
                />
            })}
            {showNextButton && <Button
                className={props.isHorizontal ? "ui button counter-next-button" : "square-button"}
                leftIcon={`icon ${lastStep ? "check" : props.isHorizontal ? "arrow circle right" : "right chevron"}`}
                onClick={lastStep ? props.onDone : handleNextStep}
                aria-label={nextButtonTitle}
                title={nextButtonTitle}
                label={props.isHorizontal ? lastStep ? lf("Done") : lf("Next") : ""} />}
        </div>
    </div>
}
