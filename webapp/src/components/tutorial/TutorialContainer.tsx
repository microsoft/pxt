import * as React from "react";
import { MarkedContent } from "../../marked";
import { Button, Modal, ModalButton } from "../../sui";
import { ImmersiveReaderButton, launchImmersiveReader } from "../../immersivereader";
import { TutorialStepCounter } from "./TutorialStepCounter";
import { TutorialHint } from "./TutorialHint";
import { TutorialResetCode } from "./TutorialResetCode";
import { classList } from "../../../../react-common/components/util";
import { TutorialValidationErrorMessage } from "./TutorialValidationErrorMessage";
import { GetValidator } from "../tutorialValidators";
import CodeValidator = pxt.tutorial.CodeValidator;
import CodeValidationResult = pxt.tutorial.CodeValidationResult;

interface TutorialContainerProps {
    parent: pxt.editor.IProjectView;
    tutorialId: string;
    name: string;
    steps: pxt.tutorial.TutorialStepInfo[];
    currentStep?: number;
    hideIteration?: boolean;
    hasTemplate?: boolean;
    preferredEditor?: string;
    hasBeenResized?: boolean;

    tutorialOptions?: pxt.tutorial.TutorialOptions; // TODO (shakao) pass in only necessary subset
    tutorialSimSidebar?: boolean;

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
    const [ stepErrorAttemptCount, setStepErrorAttemptCount ] = React.useState(0);
    const [ hideModal, setHideModal ] = React.useState(false);
    const [ showScrollGradient, setShowScrollGradient ] = React.useState(false);
    const [ validationFailures, setValidationFailures ] = React.useState([]);
    const contentRef = React.useRef(undefined);
    const immReaderRef = React.useRef(undefined);

    const showBack = currentStep !== 0;
    const showNext = currentStep !== steps.length - 1;
    const showDone = !showNext && !pxt.appTarget.appTheme.lockedEditor && !hideIteration;
    const showImmersiveReader = pxt.appTarget.appTheme.immersiveReader;
    const isHorizontal = props.tutorialSimSidebar || pxt.BrowserUtils.isTabletSize();

    const containerRef = React.useRef<HTMLDivElement>();
    const stepContentRef = React.useRef<HTMLDivElement>();

    React.useEffect(() => {
        const observer = new ResizeObserver(updateScrollGradient);
        observer.observe(document.body)

        // We also want to update the scroll gradient if the tutorial wrapper is resized by the user.
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [document.body])

    React.useEffect(() => {
        if (props.hasBeenResized) {
            return;
        }

        if (isHorizontal) {
            let scrollHeight = 0;
            const children = contentRef?.current?.children ? pxt.Util.toArray(contentRef?.current?.children) : [];
            children.forEach((el: any) => scrollHeight += el?.scrollHeight);

            if (immReaderRef) {
                scrollHeight -= immReaderRef.current?.scrollHeight || 0;
            }

            const maxAllowed = Math.max(Math.min(MAX_HEIGHT, Math.floor(window.innerHeight * .25)), MIN_HEIGHT)
            if (scrollHeight) {
                setParentHeight(Math.min(Math.max(scrollHeight + 2, MIN_HEIGHT), maxAllowed));
            }
        } else {
            setParentHeight();
        }
    }, [props.hasBeenResized, document.body])

    React.useEffect(() => {
        setCurrentStep(props.currentStep);
    }, [props.currentStep])

    React.useEffect(() => {
        const contentDiv = contentRef?.current;
        if (stepContentRef.current) stepContentRef.current.focus();
        contentDiv.scrollTo(0, 0);
        updateScrollGradient();
        setStepErrorAttemptCount(0);

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

    const validateTutorialStep = async (isStepCounter: boolean = false) => {
        let validators: pxt.Map<CodeValidator> = {};

        currentStepInfo.localValidationConfig?.validatorsMetadata?.forEach(v => validators[v.validatorType] = GetValidator(v));
        tutorialOptions.globalValidationConfig?.validatorsMetadata?.forEach(v => {
            if (!validators[v.validatorType]) {
                validators[v.validatorType] = GetValidator(v);
            }
        })

        let failedResults: CodeValidationResult[] = [];
        for (let validator of Object.values(validators)) {
            let result = await validator?.execute({
                parent: props.parent,
                tutorialOptions: props.tutorialOptions,
            });
            if (result && !result.isValid) {
                failedResults.push(result);
            }
        }

        setValidationFailures(failedResults);
        if (failedResults.length == 0) {
            tutorialStepNext(isStepCounter);
        } else {
            // Use errAttempts below instead of stepErrorAttemptCount since state update is async
            // and may not complete before the tickEvent is called.
            let errAttempts = stepErrorAttemptCount + 1;
            setStepErrorAttemptCount(errAttempts);
            pxt.tickEvent("codevalidation.stopnext", {
                tutorial: tutorialId,
                step: currentStep,
                errorCount: failedResults.length,
                attemptsWithError: errAttempts,
            });
        }
    };

    const handleTutorialContinueAnyway = () => {
        pxt.tickEvent("codevalidation.continueanyway", {
            tutorial: tutorialId,
            step: currentStep,
            attemptsWithError: stepErrorAttemptCount,
        });
        tutorialStepNext();
    };

    const handleTutorialClose = () => {
        setValidationFailures([]);
        pxt.tickEvent("codevalidation.popupclose", {
            tutorial: tutorialId,
            step: currentStep,
            attemptsWithError: stepErrorAttemptCount,
        });
    };

    const handleStepCounterSetStep = (step: number) => {
        // Only validate if we're moving to the next step.
        // If going backwards, user could be trying to fix something from a previous step and this message could be annoying/confusing.
        // If going forwards multiple steps, then the user has fully skipped entire steps, so validation doesn't make much sense.
        if (step == currentStep + 1) {
            validateTutorialStep(true);
        } else {
            setCurrentStep(step);
        }
    }

    const tutorialStepNext = (isStepCounter: boolean = false) => {
        const step = Math.min(currentStep + 1, props.steps.length - 1);
        pxt.tickEvent(
            "tutorial.next",
            {
                tutorial: tutorialId,
                step: step,
                isModal: isModal ? 1 : 0,
                validationErrors: validationFailures?.length ?? 0,
                attemptsWithError: stepErrorAttemptCount,
                isStepCounter: isStepCounter ? 1 : 0,
            },
            { interactiveConsent: true }
        );
        if (validationFailures.length > 0) {
            setValidationFailures([]);
        }
        setCurrentStep(step);
    }

    const tutorialStepBack = () => {
        const step = Math.max(currentStep - 1, 0);
        pxt.tickEvent("tutorial.previous", { tutorial: tutorialId, step: step, isModal: isModal ? 1 : 0 }, { interactiveConsent: true });
        setCurrentStep(step);
    }

    const onModalClose = showNext ? () => tutorialStepNext() : () => setHideModal(true);

    const updateScrollGradient = () => {
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

    const doneButtonLabel = lf("Finish the tutorial.");
    const nextButtonLabel = lf("Go to the next step of the tutorial.");
    const nextButton = showDone
        ? <Button icon="check circle" title={doneButtonLabel} ariaLabel={doneButtonLabel} text={lf("Done")} onClick={onTutorialComplete} />
        : <Button icon="arrow circle right" title={nextButtonLabel} ariaLabel={nextButtonLabel} disabled={!showNext} text={lf("Next")} onClick={() => validateTutorialStep()} />;

    const stepCounter = <TutorialStepCounter
        tutorialId={tutorialId}
        currentStep={visibleStep}
        totalSteps={steps.length}
        title={name}
        isHorizontal={isHorizontal}
        setTutorialStep={handleStepCounterSetStep}
        onDone={onTutorialComplete} />;
    const hasHint = !!hintMarkdown;

    const handleMarkedContentRef = (ref: HTMLDivElement) => {
        stepContentRef.current = ref;
    }

    return <div className="tutorial-container" ref={containerRef}>
        {!isHorizontal && stepCounter}
        <div className={classList("tutorial-content", hasHint && "has-hint")} ref={contentRef} onScroll={updateScrollGradient}>
            <div className={"tutorial-content-bkg"}>
                {!isHorizontal && <div className="tutorial-step-label">
                    {name && <span className="tutorial-step-title">{name}</span>}
                    <span className="tutorial-step-number">{lf("Step {0} of {1}", visibleStep + 1, steps.length)}</span>
                </div>}
                {showImmersiveReader && <ImmersiveReaderButton ref={immReaderRef} content={markdown} tutorialOptions={tutorialOptions} />}
                {title && <div className="tutorial-title">{title}</div>}
                <MarkedContent className="no-select tutorial-step-content" tabIndex={0} markdown={markdown} parent={parent} contentRef={handleMarkedContentRef}/>
                <div className="tutorial-controls">
                    {hasHint && <TutorialHint tutorialId={tutorialId} currentStep={visibleStep} markdown={hintMarkdown} parent={parent} />}
                    {isHorizontal && stepCounter}
                    {!isHorizontal && nextButton}
                </div>
            </div>
        </div>
        {validationFailures.length > 0 &&
            <TutorialValidationErrorMessage
                onContinueClicked={handleTutorialContinueAnyway}
                onReturnClicked={handleTutorialClose}
                validationFailures={validationFailures}
                tutorialId={tutorialId}
                currentStep={currentStep}
                attemptsWithError={stepErrorAttemptCount} />}
        {hasTemplate && currentStep == firstNonModalStep && preferredEditor !== "asset" && !pxt.appTarget.appTheme.hideReplaceMyCode &&
            <TutorialResetCode tutorialId={tutorialId} currentStep={visibleStep} resetTemplateCode={parent.resetTutorialTemplateCode} />}
        {showScrollGradient && <div className="tutorial-scroll-gradient" />}
        {isModal && !hideModal && <Modal isOpen={isModal} closeIcon={false} header={currentStepInfo.title || name} buttons={modalActions}
            className="hintdialog" onClose={onModalClose} dimmer={true}
            longer={true} closeOnDimmerClick closeOnDocumentClick closeOnEscape>
            <MarkedContent markdown={currentStepInfo.contentMd} parent={parent} />
        </Modal>}
    </div>
}