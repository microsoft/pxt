import * as React from "react";

import { MarkedContent } from "../../marked";
import { Button, Modal, ModalButton } from "../../sui";

import { ImmersiveReaderButton, launchImmersiveReader } from "../../immersivereader";
import { TutorialStepCounter } from "./TutorialStepCounter";
import { TutorialHint } from "./TutorialHint";
import { TutorialResetCode } from "./TutorialResetCode";
import { classList } from "../../../../react-common/components/util";

interface TutorialContainerProps {
    parent: pxt.editor.IProjectView;
    tutorialId: string;
    name: string;
    steps: pxt.tutorial.TutorialStepInfo[];
    currentStep?: number;
    hideIteration?: boolean;
    hasTemplate?: boolean;
    preferredEditor?: string;

    tutorialOptions?: pxt.tutorial.TutorialOptions; // TODO (shakao) pass in only necessary subset

    onTutorialStepChange?: (step: number) => void;
    onTutorialComplete?: () => void;
    setParentHeight?: (height?: number) => void;
}

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 194;

export function TutorialContainer(props: TutorialContainerProps) {
    const { parent, tutorialId, name, steps, hideIteration, hasTemplate,
        preferredEditor, tutorialOptions, onTutorialStepChange, onTutorialComplete,
        setParentHeight } = props;
    const [ currentStep, setCurrentStep ] = React.useState(props.currentStep || 0);
    const [ hideModal, setHideModal ] = React.useState(false);
    const [ showScrollGradient, setShowScrollGradient ] = React.useState(false);
    const [ layout, setLayout ] = React.useState<"vertical" | "horizontal">("vertical");
    const contentRef = React.useRef(undefined);

    const showBack = currentStep !== 0;
    const showNext = currentStep !== steps.length - 1;
    const showDone = !showNext && !pxt.appTarget.appTheme.lockedEditor && !hideIteration;
    const showImmersiveReader = pxt.appTarget.appTheme.immersiveReader;

    React.useEffect(() => {
        const observer = new ResizeObserver(() => {
            if (pxt.BrowserUtils.isTabletSize()) {
                setLayout("horizontal");
            } else {
                setLayout("vertical");
            }
            setShowScrollGradient(contentRef?.current?.scrollHeight > contentRef?.current?.offsetHeight);
        });
        observer.observe(document.body)
        return () => observer.disconnect();
    }, [document.body])

    React.useEffect(() => {
        if (layout == "horizontal") {
            let scrollHeight = 0;
            const children = contentRef?.current?.children ? pxt.Util.toArray(contentRef?.current?.children) : [];
            children.forEach((el: any) => scrollHeight += el?.scrollHeight);

            if (scrollHeight) {
                setParentHeight(Math.min(Math.max(scrollHeight + 2, MIN_HEIGHT), MAX_HEIGHT));
            }
        } else {
            setParentHeight();
        }
    })

    React.useEffect(() => {
        setCurrentStep(props.currentStep);
    }, [props.currentStep])

    React.useEffect(() => {
        const contentDiv = contentRef?.current;
        contentDiv.scrollTo(0, 0);
        setShowScrollGradient(contentDiv.scrollHeight > contentDiv.offsetHeight);

        onTutorialStepChange(currentStep);
        if (showNext) setHideModal(false);
    }, [currentStep])

    React.useEffect(() => {
        return () => MarkedContent.clearBlockSnippetCache();
    }, [hideModal])

    const currentStepInfo = steps[currentStep];
    if (!steps[currentStep]) return <div />;

    const isModal = currentStepInfo.showDialog;
    const visibleStep = isModal ? Math.min(currentStep + 1, steps.length - 1) : currentStep;
    const firstNonModalStep = steps.findIndex(el => !el.showDialog);
    const title = steps[visibleStep].title;
    const markdown = steps[visibleStep].headerContentMd;
    const hintMarkdown = steps[visibleStep].hintContentMd;

    const tutorialStepNext = () => {
        const step = Math.min(currentStep + 1, props.steps.length - 1);
        pxt.tickEvent("tutorial.next", { tutorial: tutorialId, step: step, isModal: isModal ? 1 : 0 }, { interactiveConsent: true });
        setCurrentStep(step);
    }

    const tutorialStepBack = () => {
        const step = Math.max(currentStep - 1, 0);
        pxt.tickEvent("tutorial.previous", { tutorial: tutorialId, step: step, isModal: isModal ? 1 : 0 }, { interactiveConsent: true });
        setCurrentStep(step);
    }

    const onModalClose = showNext ? tutorialStepNext : () => setHideModal(true);

    const tutorialContentScroll = () => {
        const contentDiv = contentRef?.current;
        setShowScrollGradient(contentDiv && ((contentDiv.scrollHeight - contentDiv.scrollTop - contentDiv.clientHeight) > 1));
    }

    let modalActions: ModalButton[] = [{ label: lf("Ok"), onclick: onModalClose,
        icon: "arrow circle right", className: "green" }];

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

    const progressString = `${name} ${visibleStep + 1}/${steps.length}`;

    const hasHint = !!hintMarkdown;


    return <div className="tutorial-container">
        <div className="tutorial-top-bar mobile-hidden">
            <TutorialStepCounter tutorialId={tutorialId} currentStep={visibleStep} totalSteps={steps.length} title={name} setTutorialStep={setCurrentStep} />
            {showImmersiveReader && <ImmersiveReaderButton content={markdown} tutorialOptions={tutorialOptions} />}
        </div>
        {layout === "horizontal" && backButton}
        <div className={classList("tutorial-content", hasHint && "has-hint")} ref={contentRef} onScroll={tutorialContentScroll}>
            <div className="mobile-only tutorial-mobile-header">
                <div className="tutorial-mobile-progress">
                    {progressString}
                </div>
                {showImmersiveReader && <ImmersiveReaderButton content={markdown} tutorialOptions={tutorialOptions} />}
            </div>
            {title && <div className="tutorial-title">{title}</div>}
            <MarkedContent className="no-select" tabIndex={0} markdown={markdown} parent={parent}/>
            <div className="tutorial-controls">
                { layout === "vertical" && backButton }
                { hasHint && <TutorialHint tutorialId={tutorialId} currentStep={visibleStep} markdown={hintMarkdown} parent={parent} />}
                { layout === "vertical" && nextButton }
            </div>
        </div>
        {hasTemplate && currentStep == firstNonModalStep && preferredEditor !== "asset" && !pxt.appTarget.appTheme.hideReplaceMyCode ||
            <TutorialResetCode tutorialId={tutorialId} currentStep={visibleStep} resetTemplateCode={parent.resetTutorialTemplateCode} />}
        {showScrollGradient && <div className="tutorial-scroll-gradient" />}
        {layout === "horizontal" && nextButton}
        {isModal && !hideModal && <Modal isOpen={isModal} closeIcon={false} header={currentStepInfo.title || name} buttons={modalActions}
            className="hintdialog" onClose={onModalClose} dimmer={true}
            longer={true} closeOnDimmerClick closeOnDocumentClick closeOnEscape>
            <MarkedContent markdown={currentStepInfo.contentMd} parent={parent} />
        </Modal>}
    </div>
}