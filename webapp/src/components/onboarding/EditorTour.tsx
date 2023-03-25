import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Location, TeachingBubble, TargetContent } from "../../../../react-common/components/controls/TeachingBubble";

const Simulator: TargetContent = {
    title: lf("Micro:bit Simulator"),
    description: lf("The simulator shows what your program will look like running on a micro:bit."),
    targetQuery: "#boardview",
    location: Location.Right,
};

const Toolbox: TargetContent = {
    title: lf("Toolbox"),
    description: lf("The toolbox is organized into different categories with blocks of code you can drag out and use in your program. You can search for specific blocks, open the extensions gallery for more blocks, or click Advanced to expand the toolbox categories shown."),
    targetQuery: "#blocksEditorToolbox",
    location: Location.Right,
};

const Workspace: TargetContent = {
    title: lf("Workspace"),
    description: lf("The workspace is where you will build your micro:bit program by dragging blocks from the toolbox and snapping them together."),
    targetQuery: "#blocksEditor", // includes the toolbox
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
    description: lf("Download your program to your micro:bit."),
    targetQuery: "#downloadArea",
    location: Location.Above,
};

const EditorContent: TargetContent[] = [
    Simulator,
    Toolbox,
    Workspace,
    Share,
    Download,
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
        pxt.tickEvent("tour.finish", data());
        onClose();
    }

    return <TeachingBubble id="teachingBubble"
        targetContent={EditorContent[currentStep]}
        onNext={onNext}
        onBack={onBack}
        stepNumber={currentStep + 1}
        totalSteps={EditorContent.length}
        onClose={onExit}
        onFinish={onFinish}
    />
};