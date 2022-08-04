import * as React from "react";
import { classList } from "../../../../react-common/components/util";

interface TutorialStepCounterProps {
    tutorialId: string;
    currentStep: number;
    totalSteps: number;
    title?: string;
    className?: string;
    setTutorialStep: (step: number) => void;
}

export function TutorialStepCounter(props: TutorialStepCounterProps) {
    const { tutorialId, currentStep, totalSteps, title, className } = props;

    const handleStepBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const { totalSteps, setTutorialStep } = props;
        const target = e.target as HTMLDivElement;
        const rect = target.getBoundingClientRect();
        const step = Math.floor(((e.clientX - rect.left) / target.clientWidth) * totalSteps);

        pxt.tickEvent("tutorial.step", { tutorial: tutorialId, step: step }, { interactiveConsent: true });
        setTutorialStep(step);
    }

    return <div className={classList("tutorial-step-counter", className)}>
        <div className="tutorial-step-label">
            <span className="tutorial-step-title">{title || lf("Step")}</span>
            <span className="tutorial-step-number">{`${currentStep + 1}/${totalSteps}`}</span>
        </div>
        <div className="tutorial-step-bar" onClick={handleStepBarClick}>
            <div className="tutorial-step-bar-fill" style={{ width: ((currentStep + 1) / totalSteps) * 100 + "%" }} />
        </div>
    </div>
}