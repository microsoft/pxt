import * as React from "react";

interface TutorialStepCounterProps {
    currentStep: number;
    totalSteps: number;
    setTutorialStep: (step: number) => void;
}

export function TutorialStepCounter(props: TutorialStepCounterProps) {
    const { currentStep, totalSteps } = props;
    const tutorialStepLabel = `${lf("Step")} ${currentStep + 1}/${totalSteps}`;

    const handleStepBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const { totalSteps, setTutorialStep } = props;
        const target = e.target as HTMLDivElement;
        const rect = target.getBoundingClientRect();

        setTutorialStep(Math.floor(((e.clientX - rect.left) / target.clientWidth) * totalSteps));
    }

    return <div className="tutorial-step-counter">
        <div className="tutorial-step-label">
            {tutorialStepLabel}
        </div>
        <div className="tutorial-step-bar" onClick={handleStepBarClick}>
            <div className="tutorial-step-bar-fill" style={{ width: ((currentStep + 1) / totalSteps) * 100 + "%" }} />
        </div>
    </div>
}