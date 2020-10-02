/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as sui from "./sui";
import * as md from "./marked";
import { TutorialCard } from "./tutorial";

type ISettingsProps = pxt.editor.ISettingsProps;

export class SidebarTutorialCard extends TutorialCard {
    constructor(props: ISettingsProps) {
        super(props);
    }

    renderCore() {
        const options = this.props.parent.state.tutorialOptions;
        const { tutorialName, tutorialReady, tutorialStepInfo, tutorialStep, tutorialStepExpanded, metadata } = options;
        const stepInfo = tutorialStepInfo[tutorialStep];
        const hasHint = true; // VIVIAN TODO
        const tutorialHint = stepInfo.hintContentMd;
        const tutorialCardContent = stepInfo.headerContentMd;
        const unplugged = stepInfo.unplugged;

        let tutorialAriaLabel = '',
            tutorialHintTooltip = '';
        if (hasHint) {
            tutorialAriaLabel += lf("Press Space or Enter to show a hint.");
            tutorialHintTooltip += lf("Click to show a hint!");
        }


        // TODO onClick={hintOnClick} for hint button


        return <div id="sidebar">
            <div className={`tutorialTitle`}><p>{tutorialName}</p></div>
            <div ref="tutorialmessage" className={`tutorialMessage`} role="alert" aria-label={tutorialAriaLabel} tabIndex={hasHint ? 0 : -1}
                        onKeyDown={hasHint ? sui.fireClickOnEnter : undefined}>
                        <div className="content">
                            {!unplugged && <md.MarkedContent className="no-select" markdown={tutorialCardContent} parent={this.props.parent} onDidRender={this.onMarkdownDidRender} />}
                        </div>
                    </div>
                    <div id="callout" className={`callout-container`}>
                        <sui.Button className={`callout-hint ui circular label blue hintbutton`} icon="lightbulb outline" tabIndex={-1} onKeyDown={sui.fireClickOnEnter} />
                        <div className={`callout-wrapper`}><md.MarkedContent markdown={tutorialHint} parent={this.props.parent}/>
                        </div>
                    </div>
        </div>
    }
}