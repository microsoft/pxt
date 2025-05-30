import { useEffect, useRef, useState } from "react";
import { TeachingBubble } from "../../../../react-common/components/controls/TeachingBubble";

export interface TourProps {
    onClose: () => void;
    config: pxt.tour.TourConfig;
}

export const Tour = (props: TourProps) => {
    const { onClose, config } = props;
    const { steps, footer } = config;
    const [currentStep, setCurrentStep] = useState(0);
    const tourStartTime = useRef(Date.now());
    const stepStartTime = useRef(Date.now());

    useEffect(() => {
        stepStartTime.current = Date.now();
    }, [currentStep]);

    const getTourDuration = () => {
        return ((Date.now() - tourStartTime.current) / 1000).toFixed(1) + "s";
    }

    const getStepDuration = () => {
        return ((Date.now() - stepStartTime.current) / 1000).toFixed(1) + "s";
    }

    const data = () => ({
        title: steps[currentStep].title,
        stepDuration: getStepDuration(),
        tourDuration: getTourDuration(),
        step: currentStep + 1,
        totalSteps: steps.length
    });

    const onNext = () => {
        pxt.tickEvent("tour.next", data());
        setCurrentStep(currentStep + 1);
    };

    const onBack = () => {
        pxt.tickEvent("tour.back", data());
        setCurrentStep(currentStep - 1);
    };

    const onExit = () => {
        pxt.tickEvent("tour.exit", data());
        onClose();
    }

    const onFinish = () => {
        pxt.tickEvent("tour.finish", data());
        onClose();
    }

    const isLastStep = currentStep === steps.length - 1;
    const confetti = config.showConfetti && isLastStep;
    const hideSteps = !config.numberFinalStep && isLastStep;
    const totalDisplaySteps = config.numberFinalStep ? steps.length : steps.length - 1;
    return <TeachingBubble id="teachingBubble"
        targetContent={steps[currentStep]}
        onNext={onNext}
        onBack={onBack}
        stepNumber={currentStep + 1}
        totalSteps={totalDisplaySteps}
        hasPrevious={currentStep > 0}
        hasNext={!isLastStep}
        onClose={onExit}
        onFinish={onFinish}
        showConfetti={confetti}
        forceHideSteps={hideSteps}
        footer={footer}
    />
};