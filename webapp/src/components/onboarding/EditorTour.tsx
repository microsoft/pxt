import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Location, TeachingBubble, TargetContent } from "../../../../react-common/components/controls/TeachingBubble";

const Simulator: TargetContent = {
    title: lf("Micro:bit Simulator"),
    description: lf("See what your code looks like running on a micro:bit!"),
    targetQuery: "#boardview",
    location: Location.Right,
};

const Toolbox: TargetContent = {
    title: lf("Toolbox"),
    description: lf("Drag out blocks of code from the Toolbox categories into the Workspace."),
    targetQuery: "#blocksEditorToolbox",
    location: Location.Right,
};

const Workspace: TargetContent = {
    title: lf("Workspace"),
    description: lf("Snap blocks of code together to build your program."),
    targetQuery: "#blocksEditor", // includes the toolbox
    sansQuery: ".blocklyToolboxDiv",
    location: Location.Center,
};

const Share: TargetContent = {
    title: lf("Share"),
    description: lf("Create a link to your project to share with others."),
    targetQuery: ".shareproject",
    location: Location.Below,
};

const Download: TargetContent = {
    title: lf("Download"),
    description: lf("Download your program onto the micro:bit."),
    targetQuery: "#downloadArea",
    location: Location.Above,
};

const Congrats: TargetContent = {
    title: lf("Congratulations!"),
    description: lf("You've completed the editor tour! {0} Happy coding!", "🤩🏆🤩"),
    targetQuery: "#root",
    location: Location.Center,
};

const EditorContent: TargetContent[] = [
    Toolbox,
    Workspace,
    Simulator,
    Share,
    Download,
    Congrats
];

export interface EditorTourProps {
    onClose: () => void;
}

export const EditorTour = (props: EditorTourProps) => {
    const { onClose } = props;
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
        title: EditorContent[currentStep].title,
        stepDuration: getStepDuration(),
        tourDuration: getTourDuration(),
        step: currentStep + 1,
        totalSteps: EditorContent.length
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
        if (currentStep < EditorContent.length - 1) {
            pxt.tickEvent("tour.finish", data());
            setCurrentStep(currentStep + 1);
        } else { // Congrats modal
            pxt.tickEvent("tour.congrats", data());
            onClose();
        }
    }

    return <TeachingBubble id="teachingBubble"
        targetContent={EditorContent[currentStep]}
        onNext={onNext}
        onBack={onBack}
        stepNumber={currentStep + 1}
        totalSteps={EditorContent.length - 1}
        onClose={onExit}
        onFinish={onFinish}
    />
};