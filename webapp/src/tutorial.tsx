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

type ISettingsProps = pxt.editor.ISettingsProps;

/**
 * We'll run this step when we first start the tutorial to figure out what blocks are used so we can
 * filter the toolbox.
 */
export function getUsedBlocksAsync(code: string, language?: string): Promise<pxt.Map<number>> {
    if (!code) return Promise.resolve({});
    const usedBlocks: pxt.Map<number> = {};
    return compiler.getBlocksAsync()
        .then(blocksInfo => {
            pxt.blocks.initializeAndInject(blocksInfo);
            if (language == "python")
                return compiler.pySnippetToBlocksAsync(code, blocksInfo);
            return compiler.decompileBlocksSnippetAsync(code, blocksInfo);
        }).then(resp => {
            const blocksXml = resp.outfiles["main.blocks"];
            if (blocksXml) {
                const headless = pxt.blocks.loadWorkspaceXml(blocksXml);
                if (!headless) {
                    pxt.debug(`used blocks xml failed to load\n${blocksXml}`);
                    throw new Error("blocksXml failed to load");
                }
                const allblocks = headless.getAllBlocks();
                for (let bi = 0; bi < allblocks.length; ++bi) {
                    const blk = allblocks[bi];
                    if (!blk.isShadow()) usedBlocks[blk.type] = 1;
                }
                if (pxt.options.debug)
                    pxt.debug(JSON.stringify(usedBlocks, null, 2));
                return usedBlocks;
            } else {
                throw new Error("Failed to decompile");
            }
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
        if (this.hasActivities) {
            return <TutorialStepCircle parent={this.props.parent} />;
        } else if (tutorialOptions.tutorialStepInfo.length < 8) {
            return <TutorialMenuItem parent={this.props.parent} />;
        } else {
            return <div className="menu">
                <TutorialMenuItem parent={this.props.parent} className="mobile hide" />
                <TutorialStepCircle parent={this.props.parent} className="mobile only" />
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
        return <a className={className} role="menuitem" aria-label={ariaLabel} tabIndex={0} onClick={this.handleClick} onKeyDown={sui.fireClickOnEnter}>
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
                <sui.Button role="button" icon={`${isRtl ? 'right' : 'left'} chevron`} disabled={!hasPrev} className={`prevbutton left ${!hasPrev ? 'disabled' : ''}`} text={lf("Back")} textClass="widedesktop only" ariaLabel={lf("Go to the previous step of the tutorial.")} onClick={this.handlePrevClick} onKeyDown={sui.fireClickOnEnter} />
                <span className="step-label" key={'tutorialStep' + currentStep}>
                    <sui.ProgressCircle progress={currentStep + 1} steps={tutorialStepInfo.length} stroke={4.5} />
                    <span className={`ui circular label blue selected ${!tutorialReady ? 'disabled' : ''}`}
                        aria-label={lf("You are currently at tutorial step {0}.")}>{tutorialStep + 1}</span>
                </span>
                <sui.Button role="button" icon={`${isRtl ? 'left' : 'right'} chevron`} disabled={!hasNext} rightIcon className={`nextbutton right ${!hasNext ? 'disabled' : ''}`} text={lf("Next")} textClass="widedesktop only" ariaLabel={lf("Go to the next step of the tutorial.")} onClick={this.handleNextClick} onKeyDown={sui.fireClickOnEnter} />
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

        if (!step.unplugged) {
            if (!tutorialHint) return <div />;

            return <div className={`tutorialhint no-select ${!visible ? 'hidden' : ''}`} ref={this.setRef}>
                <md.MarkedContent markdown={this.state.showFullText ? fullText : tutorialHint} unboxSnippets={true} parent={this.props.parent} />
            </div>
        } else {
            let onClick = tutorialStep < tutorialStepInfo.length - 1 ? this.next : this.closeHint;
            const actions: sui.ModalButton[] = [{
                label: lf("Ok"),
                onclick: onClick,
                icon: 'check',
                className: 'green'
            }]

            return <sui.Modal isOpen={visible} className="hintdialog"
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

    public focusInitialized: boolean;

    constructor(props: ISettingsProps) {
        super(props);
        const options = this.props.parent.state.tutorialOptions;
        this.prevStep = options.tutorialStep;

        this.state = {
            showSeeMore: false,
            showHint: options.tutorialStepInfo[this.prevStep].fullscreen
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
        this.props.parent.completeTutorialAsync().done();
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

    componentWillUpdate() {
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
            Promise.resolve().delay(500)
                .then(() => pxsim.U.removeClass(tutorialCard, animationClasses));
        }
        if (this.prevStep != step) {
            this.setShowSeeMore(options.autoexpandStep);
            this.prevStep = step;

            // on "new step", sync tutorial card state. used when exiting the modal, since that bypasses the react lifecycle
            this.setState({ showHint: options.tutorialStepInfo[step].unplugged || options.tutorialStepInfo[step].fullscreen })
        }
    }

    componentDidMount() {
        this.setShowSeeMore(this.props.parent.state.tutorialOptions.autoexpandStep);
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
            || tutorialStepInfo[tutorialStep].unplugged;
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
        const unplugged = tutorialStep < tutorialStepInfo.length - 1 && step && !!step.unplugged;

        this.props.parent.clearUserPoke();

        if (!unplugged) {
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
            show = tutorialCard.clientHeight < tutorialCard.firstElementChild.firstElementChild.scrollHeight;
            if (show) {
                this.cardHeight = tutorialCard.firstElementChild.firstElementChild.scrollHeight;
                if (autoexpand) this.props.parent.setTutorialInstructionsExpanded(true);
            }
        }
        this.setState({ showSeeMore: show });
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

        if (!visible) {
            if (th.elementRef) th.elementRef.removeEventListener('click', this.expandedHintOnClick);
            this.setState({ showHint: false });
            this.props.parent.pokeUserActivity();
        } else {
            if (th.elementRef) th.elementRef.addEventListener('click', this.expandedHintOnClick);
            this.setState({ showHint: true });
            this.props.parent.stopPokeUserActivity();

            const options = this.props.parent.state.tutorialOptions;
            if (!options.tutorialStepInfo[options.tutorialStep].unplugged)
                document.addEventListener('click', this.closeHint); // add close listener if not modal
            pxt.tickEvent(`tutorial.showhint`, { tutorial: options.tutorial, step: options.tutorialStep });
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
        const unplugged = stepInfo.unplugged;

        let tutorialAriaLabel = '',
            tutorialHintTooltip = '';
        if (hasHint) {
            tutorialAriaLabel += lf("Press Space or Enter to show a hint.");
            tutorialHintTooltip += lf("Click to show a hint!");
        }

        let hintOnClick = this.hintOnClick;
        // double-click issue on edge when closing hint from tutorial card click
        if ((pxt.BrowserUtils.isEdge() || pxt.BrowserUtils.isIE()) && this.state.showHint && !unplugged) {
            hintOnClick = null;
        }

        const isRtl = pxt.Util.isUserLanguageRtl();
        return <div id="tutorialcard" className={`ui ${tutorialStepExpanded ? 'tutorialExpanded' : ''} ${tutorialReady ? 'tutorialReady' : ''} ${this.state.showSeeMore ? 'seemore' : ''}  ${!this.state.showHint ? 'showTooltip' : ''} ${hasHint ? 'hasHint' : ''}`} style={tutorialStepExpanded ? this.getExpandedCardStyle('height') : null} >
            {hasHint && this.state.showHint && !unplugged && <div className="mask" role="region" onClick={this.closeHint}></div>}
            <div className='ui buttons'>
                {hasPrevious ? <sui.Button icon={`${isRtl ? 'right' : 'left'} chevron large`} className={`prevbutton left attached ${!hasPrevious ? 'disabled' : ''}`} text={lf("Back")} textClass="widedesktop only" ariaLabel={lf("Go to the previous step of the tutorial.")} onClick={this.previousTutorialStep} onKeyDown={sui.fireClickOnEnter} /> : undefined}
                <div className="ui segment attached tutorialsegment">
                    <div ref="tutorialmessage" className={`tutorialmessage`} role="alert" aria-label={tutorialAriaLabel} tabIndex={hasHint ? 0 : -1}
                        onClick={hasHint ? hintOnClick : undefined} onKeyDown={hasHint ? sui.fireClickOnEnter : undefined}>
                        <div className="content">
                            {!unplugged && <md.MarkedContent className="no-select" markdown={tutorialCardContent} parent={this.props.parent} onDidRender={this.onMarkdownDidRender} />}
                        </div>
                    </div>
                    <div className="avatar-container">
                        {(!unplugged && hasHint) && <sui.Button className={`ui circular label blue hintbutton hidelightbox ${hasHint && this.props.pokeUser ? 'shake flash' : ''}`} icon="lightbulb outline" tabIndex={-1} onClick={hintOnClick} onKeyDown={sui.fireClickOnEnter} />}
                        {(!unplugged && hasHint) && <HintTooltip ref="hinttooltip" pokeUser={this.props.pokeUser} text={tutorialHintTooltip} onClick={hintOnClick} />}
                        <TutorialHint ref="tutorialhint" parent={this.props.parent} />
                    </div>
                    {this.state.showSeeMore && !tutorialStepExpanded && <sui.Button className="fluid compact lightgrey" icon="chevron down" tabIndex={0} text={lf("More...")} onClick={this.toggleExpanded} onKeyDown={sui.fireClickOnEnter} />}
                    {this.state.showSeeMore && tutorialStepExpanded && <sui.Button className="fluid compact lightgrey" icon="chevron up" tabIndex={0} text={lf("Less...")} onClick={this.toggleExpanded} onKeyDown={sui.fireClickOnEnter} />}
                    <sui.Button ref="tutorialok" id="tutorialOkButton" className="large green okbutton showlightbox" text={lf("Ok")} onClick={this.closeLightbox} onKeyDown={sui.fireClickOnEnter} />
                </div>
                {hasNext ? <sui.Button icon={`${isRtl ? 'left' : 'right'} chevron large`} className={`nextbutton right attached ${!hasNext ? 'disabled' : ''}`} text={lf("Next")} textClass="widedesktop only" ariaLabel={lf("Go to the next step of the tutorial.")} onClick={this.nextTutorialStep} onKeyDown={sui.fireClickOnEnter} /> : undefined}
                {hasFinish ? <sui.Button icon="left checkmark" className={`orange right attached ${!tutorialReady ? 'disabled' : ''}`} text={lf("Finish")} ariaLabel={lf("Finish the tutorial.")} onClick={this.finishTutorial} onKeyDown={sui.fireClickOnEnter} /> : undefined}
            </div>
        </div>;
    }
}

export class WorkspaceHeader extends data.Component<any, {}> {
    private flyoutWidth: number = 0;
    private flyoutTitle: string = lf("Toolbox");
    private workspaceTitle: string = lf("Workspace");
    constructor(props: any) {
        super(props);
    }

    componentWillUpdate() {
        let flyout = document.querySelector('.blocklyFlyout');
        if (flyout) {
            this.flyoutWidth = flyout.clientWidth;
        }
    }

    private headerStyle() {
        return {
            width: this.flyoutWidth
        }
    }

    renderCore() {
        return <div id="headers">
            <div id="flyoutHeader" style={this.headerStyle()}>{this.flyoutTitle}</div>
            <div id="workspaceHeader">{this.workspaceTitle}</div>
        </div>;
    }
}
