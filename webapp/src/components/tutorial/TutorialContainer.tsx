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
    onTutorialComplete?: () => void;
    setParentHeight?: (height?: number) => void;
}

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 170;

export function TutorialContainer(props: TutorialContainerProps) {
    const { parent, name, steps, tutorialOptions, onTutorialStepChange, onTutorialComplete, setParentHeight } = props;
    const [ currentStep, setCurrentStep ] = React.useState(props.currentStep || 0);
    const [ hideModal, setHideModal ] = React.useState(false);
    const [ layout, setLayout ] = React.useState<"vertical" | "horizontal">("vertical");
    const contentRef = React.useRef(undefined);

    const currentStepInfo = steps[currentStep];
    if (!steps[currentStep]) return <div />;

    const isModal = currentStepInfo.showDialog;
    const visibleStep = isModal ? Math.min(currentStep + 1, steps.length - 1) : currentStep;
    const title = steps[visibleStep].title;
    const markdown = steps[visibleStep].headerContentMd;
    const hintMarkdown = steps[visibleStep].hintContentMd;

    const showBack = currentStep !== 0;
    const showNext = currentStep !== steps.length - 1;
    const showDone = !showNext && !pxt.appTarget.appTheme.lockedEditor && !tutorialOptions?.metadata?.hideIteration;
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

    React.useEffect(() => {
        if (layout == "horizontal") {
            const scrollHeight = contentRef?.current?.children?.[1]?.scrollHeight;
            if (scrollHeight) {
                setParentHeight(Math.min(Math.max(scrollHeight + 2, MIN_HEIGHT), MAX_HEIGHT));
            }
        } else {
            setParentHeight();
        }
    })

    let modalActions: ModalButton[] = [{ label: lf("Ok"), onclick: tutorialStepNext,
        icon: "arrow circle right", disabled: !showNext, className: "green" }];

    if (showBack) modalActions.unshift({ label: lf("Back"), onclick: tutorialStepBack,
        icon: "arrow circle left", disabled: !showBack, labelPosition: "left" })

    if (showImmersiveReader) {
        modalActions.push({
            className: "immersive-reader-button",
            onclick: () => { launchImmersiveReader(currentStepInfo.contentMd, tutorialOptions) },
            ariaLabel: lf("Launch Immersive Reader"),
            title: lf("Launch Immersive Reader")
        })
    }

    const backButton = <Button icon="arrow circle left" disabled={!showBack} text={lf("Back")} onClick={tutorialStepBack} />;
    const nextButton = showDone
        ? <Button icon="check circle" text={lf("Done")} onClick={onTutorialComplete} />
        : <Button icon="arrow circle right" disabled={!showNext} text={lf("Next")} onClick={tutorialStepNext} />;

    return <div className="tutorial-container">
        <div className="tutorial-top-bar">
            <TutorialStepCounter currentStep={visibleStep} totalSteps={steps.length} setTutorialStep={setTutorialStep} />
            {showImmersiveReader && <ImmersiveReaderButton content={markdown} tutorialOptions={tutorialOptions} />}
        </div>
        {layout === "horizontal" && backButton}
        <div className="tutorial-content" ref={contentRef}>
            {title && <div className="tutorial-title">{title}</div>}
            <MarkedContent className="no-select" tabIndex={0} markdown={markdown} parent={parent}/>
        </div>
        <div className="tutorial-controls">
            { layout === "vertical" && backButton }
            <TutorialHint markdown={hintMarkdown} parent={parent} showLabel={layout === "horizontal"} />
            { layout === "vertical" && nextButton }
        </div>
        {layout === "horizontal" && nextButton}
        {isModal && !hideModal && <Modal isOpen={isModal} closeIcon={false} header={name} buttons={modalActions}
            className="hintdialog" onClose={showNext ? tutorialStepNext : () => setHideModal(true)} dimmer={true}
            longer={true} closeOnDimmerClick closeOnDocumentClick closeOnEscape>
            <MarkedContent markdown={currentStepInfo.contentMd} parent={parent} />
        </Modal>}
    </div>
}