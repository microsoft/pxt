/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as sui from "./sui";
import * as md from "./marked";
import { TutorialCard, TutorialHint } from "./tutorial";
import { fireClickOnEnter } from "./util";

import ISettingsProps = pxt.editor.ISettingsProps;

export class SidebarTutorialHint extends TutorialHint {
    constructor(props: ISettingsProps) {
        super(props);
    }

    renderCore() {
        const options = this.getWebappState("tutorialOptions");
        const { tutorialName, tutorialStepInfo, tutorialStep } = options;
        const stepInfo = tutorialStepInfo[tutorialStep];
        const tutorialHint = stepInfo.hintContentMd;
        const showDialog = stepInfo.showDialog;
        const fullText = stepInfo.contentMd;
        const classes = this.props.parent.createModalClasses("hintdialog");

        let onClick = tutorialStep < tutorialStepInfo.length - 1 ? this.next : this.closeHint;
        const actions: sui.ModalButton[] = [{
            label: lf("Start"),
            onclick: onClick,
            className: 'green'
        }]
        return <div id="callout" className={`callout-container`}>
            <sui.Button className={`callout-hint ui circular label blue hintbutton`} icon="lightbulb outline" tabIndex={-1} onKeyDown={fireClickOnEnter} />
            {!showDialog ? <div className={`callout-wrapper`}>
                <div className="callout-hint-header">Hint:</div>
                <div className="callout-hint-text"><md.MarkedContent markdown={tutorialHint} unboxSnippets={true} parent={this.props.parent}/></div>
            </div>
            :
            <sui.Modal isOpen={true} className={classes}
                closeIcon={false} header={tutorialName} buttons={actions}
                onClose={onClick} dimmer={true} longer={true}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape>
                <md.MarkedContent markdown={fullText} parent={this.props.parent} />
            </sui.Modal>}
        </div>
    }
}

export class SidebarTutorialCard extends TutorialCard {
    constructor(props: ISettingsProps) {
        super(props);
    }

    renderCore() {
        const options = this.getWebappState("tutorialOptions");
        const { tutorialName, tutorialStepInfo, tutorialStep } = options;
        const stepInfo = tutorialStepInfo[tutorialStep];
        const hasHint = !!tutorialStepInfo[tutorialStep].hintContentMd || tutorialStepInfo[tutorialStep].showDialog;
        const tutorialCardContent = stepInfo.headerContentMd;
        const showDialog = stepInfo.showDialog;

        let tutorialAriaLabel = '',
            tutorialHintTooltip = '';
        if (hasHint) {
            tutorialAriaLabel += lf("Press Space or Enter to show a hint.");
            tutorialHintTooltip += lf("Click to show a hint!");
        }

        return <div id="sidebar">
            <div className={`tutorialTitle`}><p>{tutorialName}</p></div>
            <div ref="tutorialmessage" className={`tutorialMessage`} role="alert" aria-label={tutorialAriaLabel} tabIndex={hasHint ? 0 : -1}
                onKeyDown={hasHint ? fireClickOnEnter : undefined}>
                <div className="content">
                    {!showDialog && <md.MarkedContent className="no-select" markdown={tutorialCardContent} parent={this.props.parent} onDidRender={this.onMarkdownDidRender} />}
                </div>
            </div>
                    {hasHint && <SidebarTutorialHint parent={this.props.parent}/>}
        </div>
    }
}
