import * as React from "react";

import { MarkedContent } from "../../marked";
import { Button, Modal, ModalButton } from "../../sui";

import { ImmersiveReaderButton, launchImmersiveReader } from "../../immersivereader";
import { TutorialStepCounter } from "./TutorialStepCounter";
import { TutorialHint } from "./TutorialHint";

interface TutorialContainerProps {
    parent: pxt.editor.IProjectView;
    name: string;
    steps: pxt.tutorial.TutorialStepInfo[];
    currentStep?: number;

    tutorialOptions?: pxt.tutorial.TutorialOptions; // TODO (shakao) pass in only necessary subset

    onTutorialStepChange?: (step: number) => void;
}

export function TutorialContainer(props: TutorialContainerProps) {
    const { parent, name, steps, tutorialOptions, onTutorialStepChange } = props;
    const [ currentStep, setCurrentStep ] = React.useState(props.currentStep || 0);
    const [ hideModal, setHideModal ] = React.useState(false);
    const [ layout, setLayout ] = React.useState<"vertical" | "horizontal">("vertical");

    const currentStepInfo = steps[currentStep];
    if (!steps[currentStep]) return <div />;

    const isModal = currentStepInfo.showDialog;
    const visibleStep = isModal ? Math.min(currentStep + 1, steps.length - 1) : currentStep;
    const markdown = steps[visibleStep].headerContentMd;
    const hintMarkdown = steps[visibleStep].hintContentMd;

    const showBack = currentStep !== 0;
    const showNext = currentStep !== steps.length - 1;
    const showImmersiveReader = pxt.appTarget.appTheme.immersiveReader;

    const setTutorialStep = (step: number) => {
        onTutorialStepChange(step);
        setCurrentStep(step);
        if (showNext) setHideModal(false);
    }
    const tutorialStepNext = () => setTutorialStep(Math.min(currentStep + 1, props.steps.length - 1));
    const tutorialStepBack = () => setTutorialStep(Math.max(currentStep - 1, 0));

    React.useEffect(() => {
        const observer = new ResizeObserver(() => {
            if (window.innerWidth <= pxt.BREAKPOINT_TABLET) {
                setLayout("horizontal");
            } else {
                setLayout("vertical");
            }
        });
        observer.observe(document.body)
        return () => observer.disconnect();
    }, [document.body])


    let modalActions: ModalButton[] = [
        { label: lf("Back"), onclick: tutorialStepBack, icon: "arrow circle left", disabled: !showBack, labelPosition: "left" },
        { label: lf("Ok"), onclick: tutorialStepNext, icon: "arrow circle right", disabled: !showNext, className: "green" }
    ];

    if (showImmersiveReader) {
        modalActions.push({
            className: "immersive-reader-button",
            onclick: () => { launchImmersiveReader(currentStepInfo.contentMd, tutorialOptions) },
            ariaLabel: lf("Launch Immersive Reader"),
            title: lf("Launch Immersive Reader")
        })
    }

    return <div className="tutorial-container">
        <div className="tutorial-top-bar">
            <TutorialStepCounter currentStep={visibleStep} totalSteps={steps.length} setTutorialStep={setTutorialStep} />
            {showImmersiveReader && <ImmersiveReaderButton content={markdown} tutorialOptions={tutorialOptions} />}
        </div>
        {layout === "horizontal" &&
            <Button icon="arrow circle left" disabled={!showBack} text={lf("Back")} onClick={tutorialStepBack} />}
        <div className="tutorial-content">
            <MarkedContent className="no-select" tabIndex={0} markdown={markdown} parent={parent} />
        </div>
        {layout === "horizontal" &&
            <Button icon="arrow circle right" disabled={!showNext} text={lf("Next")} onClick={tutorialStepNext} />}
        {layout === "vertical" && <div className="tutorial-controls">
            <Button icon="arrow circle left" disabled={!showBack} text={lf("Back")} onClick={tutorialStepBack} />
            <TutorialHint markdown={hintMarkdown} parent={parent} />
            <Button icon="arrow circle right" disabled={!showNext} text={lf("Next")} onClick={tutorialStepNext} />
        </div>}
        {isModal && !hideModal && <Modal isOpen={isModal} closeIcon={false} header={name} buttons={modalActions}
            className="hintdialog" onClose={showNext ? tutorialStepNext : () => setHideModal(true)} dimmer={true}
            longer={true} closeOnDimmerClick closeOnDocumentClick closeOnEscape>
            <MarkedContent markdown={currentStepInfo.contentMd} parent={parent} />
        </Modal>}
    </div>
}