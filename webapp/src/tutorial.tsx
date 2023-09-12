/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";
import * as sounds from "./sounds";
import * as core from "./core";
import * as md from "./marked";
import * as compiler from "./compiler";
import * as codecard from "./codecard";
import { HintTooltip } from "./hinttooltip";
import { PlayButton } from "./simtoolbar";
import { ProjectView } from "./app";
import * as editortoolbar from "./editortoolbar";
import * as ImmersiveReader from "./immersivereader";
import { fireClickOnEnter } from "./util";

type ISettingsProps = pxt.editor.ISettingsProps;

interface ITutorialBlocks {
    snippetBlocks: pxt.Map<pxt.Map<number>>;
    usedBlocks: pxt.Map<number>;
    highlightBlocks: pxt.Map<pxt.Map<number>>;
    validateBlocks: pxt.Map<pxt.Map<string[]>>;
}

/**
 * We'll run this step when we first start the tutorial to figure out what blocks are used so we can
 * filter the toolbox.
 */
export function getUsedBlocksAsync(code: string[], id: string, language?: string, skipCache = false): Promise<ITutorialBlocks> {
    if (!code) return Promise.resolve(undefined);

    // check to see if usedblocks has been prebuilt. this is hashed on the tutorial code + pxt version + target version
    if (pxt.appTarget?.tutorialInfo && !skipCache) {
        const hash = pxt.BrowserUtils.getTutorialCodeHash(code);
        if (pxt.appTarget.tutorialInfo[hash]) {
            pxt.tickEvent(`tutorial.usedblocks.cached`, { tutorial: id });
            return Promise.resolve(pxt.appTarget.tutorialInfo[hash]);
        }
    }

    return pxt.BrowserUtils.tutorialInfoDbAsync()
        .then(db => db.getAsync(id, code)
            .then(entry => {
                if (entry?.blocks && Object.keys(entry.blocks).length > 0 && !skipCache) {
                    pxt.tickEvent(`tutorial.usedblocks.indexeddb`, { tutorial: id });
                    // populate snippets if usedBlocks are present, but snippets are not
                    if (!entry?.snippets) getUsedBlocksInternalAsync(code, id, language, db, skipCache);
                    return Promise.resolve({ snippetBlocks: entry.snippets, usedBlocks: entry.blocks, highlightBlocks: entry.highlightBlocks, validateBlocks: entry.validateBlocks });
                } else {
                    return getUsedBlocksInternalAsync(code, id, language, db, skipCache);
                }
            })
            .catch((err) => {
                // fall back to full blocks decompile on error
                return getUsedBlocksInternalAsync(code, id, language, db, skipCache);
            })
        ).catch((err) => {
            // fall back to full blocks decompile on error
            return getUsedBlocksInternalAsync(code, id, language, null, skipCache);
        })
}

function getUsedBlocksInternalAsync(code: string[], id: string, language?: string, db?: pxt.BrowserUtils.ITutorialInfoDb, skipCache = false): Promise<ITutorialBlocks> {
    const snippetBlocks: pxt.Map<pxt.Map<number>> = {};
    const usedBlocks: pxt.Map<number> = {};
    const highlightBlocks: pxt.Map<pxt.Map<number>> = {};
    const validateBlocks: pxt.Map<pxt.Map<string[]>> = {};
    return compiler.getBlocksAsync()
        .then(blocksInfo => {
            pxt.blocks.initializeAndInject(blocksInfo);
            if (language == "python") {
                return compiler.decompilePySnippetstoXmlAsync(code);
            }
            return compiler.decompileSnippetstoXmlAsync(code);
        }).then(xml => {
            if (xml?.length > 0) {
                let headless: Blockly.Workspace;
                for (let i = 0; i < xml.length; i++) {
                    const blocksXml = xml[i];
                    const snippetHash = pxt.BrowserUtils.getTutorialCodeHash([code[i]]);

                    headless = pxt.blocks.loadWorkspaceXml(blocksXml, false, { keepMetaComments: true });
                    if (!headless) {
                        pxt.debug(`used blocks xml failed to load\n${blocksXml}`);
                        throw new Error("blocksXml failed to load");
                    }
                    const allblocks = headless.getAllBlocks(false);
                    snippetBlocks[snippetHash] = {};
                    highlightBlocks[snippetHash] = {};
                    validateBlocks[snippetHash] = {};
                    for (let bi = 0; bi < allblocks.length; ++bi) {
                        const blk = allblocks[bi];
                        if (blk.type == "typescript_statement") {
                            pxt.tickEvent(`tutorial.usedblocks.greyblock`, { tutorial: id, code: code[i]?.substring(0, 2000) });
                        } else if (!blk.isShadow()) {
                            if (!snippetBlocks[snippetHash][blk.type]) {
                                snippetBlocks[snippetHash][blk.type] = 0;
                            }
                            snippetBlocks[snippetHash][blk.type] = snippetBlocks[snippetHash][blk.type] + 1;
                            usedBlocks[blk.type] = 1;
                        }

                        let comment = blk.getCommentText();
                        if (comment && /@highlight/.test(comment)) {
                            if (!highlightBlocks[snippetHash][blk.type]) {
                                highlightBlocks[snippetHash][blk.type] = 0;
                            }
                            highlightBlocks[snippetHash][blk.type] = highlightBlocks[snippetHash][blk.type] + 1;
                        }
                        while (comment && /@\S+/.test(comment)) {
                            const marker = comment.match(/@(\S+)/)[1];
                            comment = comment.replace(/@\S+/, "");
                            if (!validateBlocks[snippetHash][marker]) {
                                validateBlocks[snippetHash][marker] = [];
                            }
                            validateBlocks[snippetHash][marker].push(blk.type);
                        }
                    }
                }

                headless?.dispose();

                if (pxt.options.debug) {
                    pxt.debug(JSON.stringify(snippetBlocks, null, 2));
                }

                try {
                    if (db && !skipCache) db.setAsync(id, snippetBlocks, code, highlightBlocks, validateBlocks);
                }
                catch (e) {
                    // Don't fail if the indexeddb fails, but log it
                    pxt.log("Unable to cache used blocks in DB");
                }
                pxt.tickEvent(`tutorial.usedblocks.computed`, { tutorial: id });
            } else if (code?.length > 0) {
                throw new Error("Failed to decompile");
            }

            return { snippetBlocks, usedBlocks, highlightBlocks, validateBlocks };
        }).catch((e) => {
            pxt.reportException(e);
            throw new Error(`Failed to decompile tutorial`);
        });
}

export class TutorialMenu extends data.Component<ISettingsProps, {}> {
    protected hasActivities: boolean;
    constructor(props: ISettingsProps) {
        super(props);
        let tutorialOptions = this.props.parent.state.tutorialOptions;
        this.hasActivities = tutorialOptions && tutorialOptions.tutorialActivityInfo && tutorialOptions.tutorialActivityInfo.length > 1;
    }

    renderCore() {
        let tutorialOptions = this.props.parent.state.tutorialOptions;
        const tutorialCardContent = tutorialOptions.tutorialStepInfo?.[tutorialOptions.tutorialStep].headerContentMd
        const immersiveReaderEnabled = pxt.appTarget.appTheme.immersiveReader;

        if (this.hasActivities) {
            return <div className="menu tutorial-menu">
                <TutorialStepCircle parent={this.props.parent} />
                {immersiveReaderEnabled && <ImmersiveReader.ImmersiveReaderButton content={tutorialCardContent} tutorialOptions={tutorialOptions} />}
            </div>;
        } else if (tutorialOptions.tutorialStepInfo.length < 8) {
            return <div className="menu tutorial-menu">
                <TutorialMenuItem parent={this.props.parent} />
                {immersiveReaderEnabled && <ImmersiveReader.ImmersiveReaderButton content={tutorialCardContent} tutorialOptions={tutorialOptions} />}
            </div>;
        } else {
            return <div className="menu tutorial-menu">
                <TutorialMenuItem parent={this.props.parent} className="mobile hide" />
                <TutorialStepCircle parent={this.props.parent} className="mobile only" />
                {immersiveReaderEnabled && <ImmersiveReader.ImmersiveReaderButton content={tutorialCardContent} tutorialOptions={tutorialOptions} />}
            </div>
        }
    }
}

interface ITutorialMenuProps extends ISettingsProps {
    className?: string;
}

export class TutorialMenuItem extends data.Component<ITutorialMenuProps, {}> {
    constructor(props: ITutorialMenuProps) {
        super(props);

        this.openTutorialStep = this.openTutorialStep.bind(this);
    }

    openTutorialStep(step: number) {
        let options = this.props.parent.state.tutorialOptions;
        pxt.tickEvent(`tutorial.step`, { tutorial: options.tutorial, step: step }, { interactiveConsent: true });
        this.props.parent.setTutorialStep(step);
    }

    renderCore() {
        const { tutorialReady, tutorialStepInfo, tutorialStep } = this.props.parent.state.tutorialOptions;
        const currentStep = tutorialStep;
        if (!tutorialReady) return <div />;

        function intermediateClassName(index: number) {
            if (tutorialStepInfo.length < 8 // always show first 8
                || index == 0 // always show first
                || index == tutorialStepInfo.length - 1 // always show last
                || Math.abs(index - currentStep) < 2 // 1 around current step
            ) return "";

            return "mobile hide";
        }

        return <div className={`ui item ${this.props.className}`}>
            <div className="ui item tutorial-menuitem" role="menubar">
                {tutorialStepInfo.map((step, index) =>
                    (index == currentStep) ?
                        <span className="step-label" key={'tutorialStep' + index}>
                            <TutorialMenuItemLink index={index}
                                className={`ui circular label ${currentStep == index ? 'blue selected' : 'inverted'} ${!tutorialReady ? 'disabled' : ''}`}
                                ariaLabel={lf("Tutorial step {0}. This is the current step", index + 1)}
                                onClick={this.openTutorialStep}>{index + 1}</TutorialMenuItemLink>
                        </span> :
                        <span className={`ui step-label ${intermediateClassName(index)}`} key={'tutorialStep' + index} data-tooltip={`${index + 1}`} data-inverted="" data-position="bottom center">
                            <TutorialMenuItemLink index={index}
                                className={`ui empty circular label ${!tutorialReady ? 'disabled' : ''} clear`}
                                ariaLabel={lf("Tutorial step {0}", index + 1)}
                                onClick={this.openTutorialStep} />
                        </span>
                )}
            </div>
        </div>;
    }
}

interface TutorialMenuItemLinkProps {
    index: number;
    className: string;
    ariaLabel: string;
    onClick: (index: number) => void;
}

export class TutorialMenuItemLink extends data.Component<TutorialMenuItemLinkProps, {}> {

    handleClick = () => {
        this.props.onClick(this.props.index);
    }

    renderCore() {
        const { className, ariaLabel, index } = this.props;
        return <a className={className} role="menuitem" aria-label={ariaLabel} tabIndex={0} onClick={this.handleClick} onKeyDown={fireClickOnEnter}>
            {this.props.children}
        </a>;
    }
}

export class TutorialStepCircle extends data.Component<ITutorialMenuProps, {}> {
    constructor(props: ITutorialMenuProps) {
        super(props);

        this.openTutorialStep = this.openTutorialStep.bind(this);
    }

    handleNextClick = () => {
        let options = this.props.parent.state.tutorialOptions;
        this.openTutorialStep(options.tutorialStep + 1);
    }

    handlePrevClick = () => {
        let options = this.props.parent.state.tutorialOptions;
        this.openTutorialStep(options.tutorialStep - 1);
    }

    openTutorialStep(step: number) {
        let options = this.props.parent.state.tutorialOptions;
        pxt.tickEvent(`tutorial.step`, { tutorial: options.tutorial, step: step }, { interactiveConsent: true });
        this.props.parent.setTutorialStep(step);
    }

    renderCore() {
        const { tutorialReady, tutorialStepInfo, tutorialStep } = this.props.parent.state.tutorialOptions;
        const currentStep = tutorialStep;
        const hasPrev = tutorialReady && currentStep != 0;
        const hasNext = tutorialReady && currentStep != tutorialStepInfo.length - 1;
        const isRtl = false;

        if (!tutorialReady) return <div />;

        return <div id="tutorialsteps" className={`ui item ${this.props.className}`}>
            <div className="ui item" role="menubar">
                <sui.Button role="button" icon={`${isRtl ? 'right' : 'left'} chevron`} disabled={!hasPrev} className={`prevbutton left ${!hasPrev ? 'disabled' : ''}`} text={lf("Back")} textClass="widedesktop only" ariaLabel={lf("Go to the previous step of the tutorial.")} onClick={this.handlePrevClick} onKeyDown={fireClickOnEnter} />
                <span className="step-label" key={'tutorialStep' + currentStep}>
                    <sui.ProgressCircle progress={currentStep + 1} steps={tutorialStepInfo.length} stroke={4.5} />
                    <span className={`ui circular label blue selected ${!tutorialReady ? 'disabled' : ''}`}
                        aria-label={lf("You are currently at tutorial step {0}.")}>{tutorialStep + 1}</span>
                </span>
                <sui.Button role="button" icon={`${isRtl ? 'left' : 'right'} chevron`} disabled={!hasNext} rightIcon className={`nextbutton right ${!hasNext ? 'disabled' : ''}`} text={lf("Next")} textClass="widedesktop only" ariaLabel={lf("Go to the next step of the tutorial.")} onClick={this.handleNextClick} onKeyDown={fireClickOnEnter} />
            </div>
        </div>;
    }
}

export interface TutorialHintState {
    visible: boolean;
    showFullText: boolean;
}

export class TutorialHint extends data.Component<ISettingsProps, TutorialHintState> {
    public elementRef: HTMLDivElement;
    protected setRef: (el: HTMLDivElement) => void = (el) => { this.elementRef = el };

    constructor(props: ISettingsProps) {
        super(props);

        this.next = this.next.bind(this);
        this.showHint = this.showHint.bind(this);
        this.closeHint = this.closeHint.bind(this);
    }

    next() {
        const options = this.props.parent.state.tutorialOptions;
        const { tutorialStep, tutorial } = options;
        this.setState({ visible: false });
        const nextStep = tutorialStep + 1;

        pxt.tickEvent(`tutorial.hint.next`, { tutorial: tutorial, step: nextStep });
        this.props.parent.setTutorialStep(nextStep);
    }

    showHint(visible: boolean, showFullText?: boolean) {
        if (visible) Blockly.hideChaff();
        this.setState({ visible, showFullText });
    }

    protected closeHint() {
        this.showHint(false, this.state.showFullText);
    }

    renderCore() {
        const { visible } = this.state;
        const options = this.props.parent.state.tutorialOptions;
        const { tutorialReady, tutorialStepInfo, tutorialStep, tutorialName } = options;
        if (!tutorialReady) return <div />;

        const step = tutorialStepInfo[tutorialStep];
        const tutorialHint = step.hintContentMd;
        const fullText = step.contentMd;

        const hideIteration = options.metadata.hideIteration;
        const flyoutOnly = options.metadata.flyoutOnly;

        const immersiveReaderEnabled = pxt.appTarget.appTheme.immersiveReader;

        if (!step.showDialog) {
            if (!tutorialHint) return <div />;

            return <div className={`tutorialhint no-select ${!visible ? 'hidden' : ''}`} ref={this.setRef}>
                <md.MarkedContent markdown={this.state.showFullText ? fullText : tutorialHint} unboxSnippets={true} parent={this.props.parent} />
            </div>
        } else {
            let onClick = tutorialStep < tutorialStepInfo.length - 1 ? this.next : this.closeHint;
            let actions: sui.ModalButton[] = [];
            if (immersiveReaderEnabled) {
                actions.push({
                    className: "immersive-reader-button",
                    onclick: () => { ImmersiveReader.launchImmersiveReader(fullText, options) },
                    ariaLabel: lf("Launch Immersive Reader"),
                    title: lf("Launch Immersive Reader")
                })
            }
            actions.push({
                label: hideIteration && flyoutOnly ? lf("Start") : lf("Ok"),
                onclick: onClick,
                icon: 'check',
                className: 'green'
            });

            const classes = this.props.parent.createModalClasses("hintdialog");

            return <sui.Modal isOpen={visible} className={classes}
                closeIcon={false} header={tutorialName} buttons={actions}
                onClose={onClick} dimmer={true} longer={true}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape>
                <md.MarkedContent markdown={fullText} parent={this.props.parent} />
            </sui.Modal>
        }
    }
}

interface TutorialCardState {
    showHint?: boolean;
    showSeeMore?: boolean;
}

interface TutorialCardProps extends ISettingsProps {
    pokeUser?: boolean;
}

export class TutorialCard extends data.Component<TutorialCardProps, TutorialCardState> {
    private prevStep: number;
    private cardHeight: number;
    private resizeDebouncer: () => void;

    public focusInitialized: boolean;

    constructor(props: ISettingsProps) {
        super(props);
        const options = this.props.parent.state.tutorialOptions;
        this.prevStep = options.tutorialStep;

        this.state = {
            showSeeMore: false,
            showHint: options.tutorialStepInfo[this.prevStep].showHint,
        }

        this.toggleHint = this.toggleHint.bind(this);
        this.closeHint = this.closeHint.bind(this);
        this.hintOnClick = this.hintOnClick.bind(this);
        this.closeLightbox = this.closeLightbox.bind(this);
        this.tutorialCardKeyDown = this.tutorialCardKeyDown.bind(this);
        this.okButtonKeyDown = this.okButtonKeyDown.bind(this);
        this.previousTutorialStep = this.previousTutorialStep.bind(this);
        this.nextTutorialStep = this.nextTutorialStep.bind(this);
        this.finishTutorial = this.finishTutorial.bind(this);
        this.toggleExpanded = this.toggleExpanded.bind(this);
        this.onMarkdownDidRender = this.onMarkdownDidRender.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    previousTutorialStep() {
        this.showHint(false); // close hint on new tutorial step
        let options = this.props.parent.state.tutorialOptions;
        const currentStep = options.tutorialStep;
        const previousStep = currentStep - 1;

        options.tutorialStep = previousStep;

        pxt.tickEvent(`tutorial.previous`, { tutorial: options.tutorial, step: previousStep }, { interactiveConsent: true });
        this.props.parent.setTutorialStep(previousStep);
    }

    nextTutorialStep() {
        this.showHint(false); // close hint on new tutorial step
        let options = this.props.parent.state.tutorialOptions;
        const currentStep = options.tutorialStep;
        const nextStep = currentStep + 1;

        options.tutorialStep = nextStep;

        pxt.tickEvent(`tutorial.next`, { tutorial: options.tutorial, step: nextStep }, { interactiveConsent: true });
        this.props.parent.setTutorialStep(nextStep);
    }

    finishTutorial() {
        this.closeLightbox();
        this.removeHintOnClick();
        this.props.parent.completeTutorialAsync();
    }

    private closeLightboxOnEscape = (e: KeyboardEvent) => {
        const charCode = core.keyCodeFromEvent(e);
        if (charCode === 27) {
            this.closeLightbox();
        }
    }

    private closeLightbox() {
        sounds.tutorialNext();
        document.documentElement.removeEventListener("keydown", this.closeLightboxOnEscape);

        // Hide lightbox
        this.props.parent.hideLightbox();
    }

    UNSAFE_componentWillUpdate() {
        document.documentElement.addEventListener("keydown", this.closeLightboxOnEscape);
    }

    private tutorialCardKeyDown(e: KeyboardEvent) {
        const charCode = core.keyCodeFromEvent(e);
        if (charCode == core.TAB_KEY) {
            e.preventDefault();
            const tutorialOkRef = this.refs["tutorialok"] as sui.Button;
            const okButton = ReactDOM.findDOMNode(tutorialOkRef) as HTMLElement;
            okButton.focus();
        }
    }

    private okButtonKeyDown(e: KeyboardEvent) {
        const charCode = core.keyCodeFromEvent(e);
        if (charCode == core.TAB_KEY) {
            e.preventDefault();
            const tutorialCard = this.refs['tutorialmessage'] as HTMLElement;
            tutorialCard.focus();
        }
    }

    private lastStep = -1;
    componentDidUpdate(prevProps: ISettingsProps, prevState: TutorialCardState) {
        const options = this.props.parent.state.tutorialOptions;
        const tutorialCard = this.refs['tutorialmessage'] as HTMLElement;

        const step = this.props.parent.state.tutorialOptions.tutorialStep;
        if (step != this.lastStep) {
            const animationClasses = `fade ${step < this.lastStep ? "right" : "left"} in visible transition animating`;
            tutorialCard.style.animationDuration = '500ms';
            this.lastStep = step;
            pxsim.U.addClass(tutorialCard, animationClasses);
            pxt.Util.delay(500)
                .then(() => pxsim.U.removeClass(tutorialCard, animationClasses));
        }
        if (this.prevStep != step) {
            this.setShowSeeMore(options.autoexpandStep);
            this.prevStep = step;

            // on "new step", sync tutorial card state. used when exiting the modal, since that bypasses the react lifecycle
            this.setState({ showHint: options.tutorialStepInfo[step].showDialog || options.tutorialStepInfo[step].showHint })
        }
    }

    private handleResize() {
        const options = this.props.parent.state.tutorialOptions;
        this.setShowSeeMore(options.autoexpandStep);
    }

    componentDidMount() {
        this.setShowSeeMore(this.props.parent.state.tutorialOptions.autoexpandStep);
        this.resizeDebouncer = pxt.Util.debounce(this.handleResize, 500);
        window.addEventListener('resize', this.resizeDebouncer);
    }

    onMarkdownDidRender() {
        this.setShowSeeMore(this.props.parent.state.tutorialOptions.autoexpandStep);
    }

    componentWillUnmount() {
        // Clear the markdown cache when we unmount
        md.MarkedContent.clearBlockSnippetCache();
        this.lastStep = -1;

        // Clear any existing timers
        this.props.parent.stopPokeUserActivity();

        this.removeHintOnClick();
        window.removeEventListener('resize', this.resizeDebouncer);
    }

    private removeHintOnClick() {
        // cleanup hintOnClick
        document.removeEventListener('click', this.closeHint);
    }

    toggleExpanded(ev: React.MouseEvent<HTMLDivElement>) {
        ev.stopPropagation();
        ev.preventDefault();
        const options = this.props.parent.state.tutorialOptions;
        const { tutorialStepExpanded } = options;
        this.props.parent.setTutorialInstructionsExpanded(!tutorialStepExpanded);
        return false;
    }

    private hasHint() {
        const options = this.props.parent.state.tutorialOptions;
        const { tutorialReady, tutorialStepInfo, tutorialStep } = options;
        if (!tutorialReady) return false;
        return !!tutorialStepInfo[tutorialStep].hintContentMd
            || tutorialStepInfo[tutorialStep].showDialog;
    }

    private hintOnClick(evt?: any) {
        const options = this.props.parent.state.tutorialOptions;
        if (!options) {
            pxt.reportError("tutorial", "leaking hintonclick");
            return;
        }
        if (evt) evt.stopPropagation();
        const { tutorialStepInfo, tutorialStep } = options;
        const step = tutorialStepInfo[tutorialStep];
        const showDialog = tutorialStep < tutorialStepInfo.length - 1 && step && !!step.showDialog;

        this.props.parent.clearUserPoke();

        if (!showDialog) {
            this.toggleHint();
        }
    }

    private expandedHintOnClick(evt?: any) {
        evt.stopPropagation();
    }

    private setShowSeeMore(autoexpand?: boolean) {
        // compare scrollHeight of inner text with height of card to determine showSeeMore
        const tutorialCard = this.refs['tutorialmessage'] as HTMLElement;
        let show = false;
        if (tutorialCard && tutorialCard.firstElementChild && tutorialCard.firstElementChild.firstElementChild) {
            show = tutorialCard.clientHeight <= tutorialCard.firstElementChild.firstElementChild.scrollHeight;
            if (show) {
                this.cardHeight = tutorialCard.firstElementChild.firstElementChild.scrollHeight;
                if (autoexpand) this.props.parent.setTutorialInstructionsExpanded(true);
            }
        }
        this.setState({ showSeeMore: show });
        this.props.parent.setEditorOffset();
    }

    getCardHeight() {
        return this.cardHeight;
    }

    getExpandedCardStyle(prop: string) {
        return { [prop]: `calc(${this.getCardHeight()}px + 2rem)` }
    }

    toggleHint(showFullText?: boolean) {
        this.showHint(!this.state.showHint, showFullText);
    }

    closeHint(evt?: any) {
        this.showHint(false);
    }

    showHint(visible: boolean, showFullText?: boolean) {
        this.removeHintOnClick();
        this.closeLightbox();
        if (!this.hasHint()) return;

        const th = this.refs["tutorialhint"] as TutorialHint;
        if (!th) return;
        const currentStep = this.props.parent.state.tutorialOptions.tutorialStep;

        if (!visible) {
            if (th.elementRef) th.elementRef.removeEventListener('click', this.expandedHintOnClick);
            this.setState({ showHint: false });
            this.props.parent.pokeUserActivity();
        } else {
            if (th.elementRef) th.elementRef.addEventListener('click', this.expandedHintOnClick);
            this.setState({ showHint: true });
            this.props.parent.stopPokeUserActivity();

            const options = this.props.parent.state.tutorialOptions;
            if (!options.tutorialStepInfo[options.tutorialStep].showDialog)
                document.addEventListener('click', this.closeHint); // add close listener if not modal
            pxt.tickEvent(`tutorial.showhint`, { tutorial: options.tutorial, step: options.tutorialStep });
            this.props.parent.setHintSeen(currentStep);
        }
        th.showHint(visible, showFullText);
    }

    renderCore() {
        const options = this.props.parent.state.tutorialOptions;
        const { tutorialReady, tutorialStepInfo, tutorialStep, tutorialStepExpanded, metadata } = options;
        if (!tutorialReady) return <div />
        const stepInfo = tutorialStepInfo[tutorialStep];

        const lockedEditor = !!pxt.appTarget.appTheme.lockedEditor;
        const currentStep = tutorialStep;
        const maxSteps = tutorialStepInfo.length;
        const hideIteration = metadata && metadata.hideIteration;
        const hasPrevious = tutorialReady && currentStep != 0 && !hideIteration;
        const hasNext = tutorialReady && currentStep != maxSteps - 1 && !hideIteration;
        const hasFinish = !lockedEditor && currentStep == maxSteps - 1 && !hideIteration;
        const hasHint = this.hasHint();
        const tutorialCardContent = stepInfo.headerContentMd;
        const showDialog = stepInfo.showDialog;

        const tutorialAriaLabel = lf("Press Space or Enter to show a hint.");
        const tutorialHintTooltip = lf("Click to show a hint!");

        let hintOnClick = this.hintOnClick;

        // double-click issue on edge when closing hint from tutorial card click
        if ((pxt.BrowserUtils.isEdge() || pxt.BrowserUtils.isIE()) && this.state.showHint && !showDialog) {
            hintOnClick = null;
        }

        const isRtl = pxt.Util.isUserLanguageRtl();
        return <div id="tutorialcard" className={`ui ${tutorialStepExpanded ? 'tutorialExpanded' : ''} ${tutorialReady ? 'tutorialReady' : ''} ${this.state.showSeeMore ? 'seemore' : ''}  ${!this.state.showHint ? 'showTooltip' : ''} ${hasHint ? 'hasHint' : ''}`} style={tutorialStepExpanded ? this.getExpandedCardStyle('height') : null} >
            {hasHint && this.state.showHint && !showDialog && <div className="mask" role="region" onClick={this.closeHint}></div>}
            <div className='ui buttons'>
                {hasPrevious ? <sui.Button icon={`${isRtl ? 'right' : 'left'} chevron large`} className={`prevbutton left attached ${!hasPrevious ? 'disabled' : ''}`} text={lf("Back")} textClass="widedesktop only" ariaLabel={lf("Go to the previous step of the tutorial.")} onClick={this.previousTutorialStep} onKeyDown={fireClickOnEnter} /> : undefined}
                <div className="ui segment attached tutorialsegment">
                    <div ref="tutorialmessage" className={`tutorialmessage`} role="alert">
                        <div className="content">
                            {!showDialog && <md.MarkedContent className="no-select" tabIndex={0} markdown={tutorialCardContent} parent={this.props.parent} onDidRender={this.onMarkdownDidRender} />}
                        </div>
                    </div>
                    <div className="avatar-container">
                        {(!showDialog && hasHint) && <sui.Button
                            className={`ui circular label blue hintbutton hidelightbox ${this.props.pokeUser ? 'shake flash' : ''}`}
                            icon="lightbulb"
                            aria-label={tutorialAriaLabel} title={tutorialHintTooltip}
                            onClick={hintOnClick} onKeyDown={fireClickOnEnter}
                        />}
                        {(!showDialog && hasHint) && <HintTooltip ref="hinttooltip" pokeUser={this.props.pokeUser} text={tutorialHintTooltip} onClick={hintOnClick} />}
                        <TutorialHint ref="tutorialhint" parent={this.props.parent} />
                    </div>
                    {this.state.showSeeMore && !tutorialStepExpanded && <sui.Button className="fluid compact lightgrey" icon="chevron down" tabIndex={0} text={lf("More...")} onClick={this.toggleExpanded} onKeyDown={fireClickOnEnter} />}
                    {this.state.showSeeMore && tutorialStepExpanded && <sui.Button className="fluid compact lightgrey" icon="chevron up" tabIndex={0} text={lf("Less...")} onClick={this.toggleExpanded} onKeyDown={fireClickOnEnter} />}
                </div>
                {hasNext ? <sui.Button icon={`${isRtl ? 'left' : 'right'} chevron large`} className={`nextbutton right attached ${!hasNext ? 'disabled' : ''}`} text={lf("Next")} textClass="widedesktop only" ariaLabel={lf("Go to the next step of the tutorial.")}
                    onClick={this.nextTutorialStep} onKeyDown={fireClickOnEnter} /> : undefined}
                {hasFinish ? <sui.Button icon="left checkmark" className={`orange right attached ${!tutorialReady ? 'disabled' : ''}`} text={lf("Finish")} ariaLabel={lf("Finish the tutorial.")} onClick={this.finishTutorial} onKeyDown={fireClickOnEnter} /> : undefined}
            </div>
        </div>;
    }
}

interface WorkspaceHeaderState {
    windowSize?: number;
}

export class WorkspaceHeader extends data.Component<any, WorkspaceHeaderState> {
    private flyoutWidth: number = 0;
    private flyoutTitle: string = lf("Toolbox");
    private workspaceWidth: number = 0;
    constructor(props: any) {
        super(props);

        this.handleResize = this.handleResize.bind(this);
        this.state = { windowSize: window.innerWidth };
    }

    handleResize() {
        this.setState({ windowSize: window.innerWidth });
    }

    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('wheel', this.handleResize);
        window.addEventListener('pointermove', this.handleResize);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('wheel', this.handleResize);
        window.removeEventListener('pointermove', this.handleResize);
    }

    UNSAFE_componentWillUpdate() {
        const flyout = document.querySelector('.blocklyFlyout');
        if (flyout) {
            this.flyoutWidth = flyout.getBoundingClientRect().width;
        }

        const workspace = document.querySelector('#blocksArea');
        if (workspace) {
            this.workspaceWidth = workspace.clientWidth - this.flyoutWidth - 4;
        }
    }

    private headerStyle() {
        return {
            width: this.flyoutWidth
        }
    }

    private workspaceStyle() {
        return {
            width: this.workspaceWidth
        }
    }

    renderCore() {
        return <div id="headers">
            <div id="flyoutHeader" style={this.headerStyle()}>
                <div id="flyoutHeaderTitle" className="no-select">{this.flyoutTitle}</div>
            </div>
            <div id="workspaceHeader" style={this.workspaceStyle()}>
                <editortoolbar.SmallEditorToolbar parent={this.props.parent} />
            </div>
        </div>;
    }
}
