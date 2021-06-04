/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import { TutorialCard } from "./tutorial";

type ISettingsProps = pxt.editor.ISettingsProps;

interface TutorialCodeValidationProps extends ISettingsProps {
    onYesButtonClick: () => void;
    onNoButtonClick: () => void;
    initialVisible: boolean;
    isTutorialCodeInvalid: boolean;
    ruleComponents: pxt.tutorial.TutorialRuleStatus[];
    areStrictRulesPresent: boolean;
    codeValidAndInvalidRuleMap: pxt.Map<string>;
}

interface tutorialCodeValidationState {
    visible: boolean;
}

export class MoveOn extends data.Component<TutorialCodeValidationProps, tutorialCodeValidationState> {
    constructor(props: TutorialCodeValidationProps) {
        super(props);

        this.state = { visible: this.props.initialVisible };
    }

    showUnusedBlocksMessage(vis: boolean) {
        this.setState({ visible: vis });
    }



    moveOnToNextTutorialStep() {
        const sortedValidAndInvalidRules = this.props.codeValidAndInvalidRuleMap;
        pxt.tickEvent('tutorial.validation.next ', sortedValidAndInvalidRules);
        console.log('tutorial.validation.next ', sortedValidAndInvalidRules)
        this.props.onYesButtonClick();
        this.showUnusedBlocksMessage(false);
    }

    stayOnThisTutorialStep() {
        const sortedValidAndInvalidRules = this.props.codeValidAndInvalidRuleMap;
        pxt.tickEvent('tutorial.validation.stay ', sortedValidAndInvalidRules);
        console.log('tutorial.validation.stay ', sortedValidAndInvalidRules);
        this.props.onNoButtonClick();
    }


    renderCore() {
        const codeInvalid = this.props.isTutorialCodeInvalid;
        const rules = this.props.ruleComponents;
        const rulesDefined = (rules != undefined);
        const strictRulePresent = this.props.areStrictRulesPresent;
        return <div>
            <div className={`tutorialCodeValidation no-select ${(!codeInvalid || (codeInvalid && !strictRulePresent)) ? 'hidden' : ''}`}>
                <div className="codeValidationPopUpText">
                    {rulesDefined ? rules.map((rule, index) => <p key={index + rule.ruleName}>{(rule.ruleTurnOn && !rule.ruleStatus) ? rule.ruleMessage : ''}</p>) : ''}
                </div>
                <div className="codeValidationPopUpText">
                    {lf("Do you still want to continue?")}
                </div>
                <div className="moveOnButtons">
                    <sui.Button className="yes" ariaLabel={lf("yes button for tutorial code validation")} onClick={this.moveOnToNextTutorialStep.bind(this)} onKeyDown={sui.fireClickOnEnter} > {lf("Continue Anyway")} </sui.Button>
                    <sui.Button className="no" ariaLabel={lf("no button for tutorial code validation")} onClick={this.stayOnThisTutorialStep.bind(this)} onKeyDown={sui.fireClickOnEnter} > {lf("Keep Editing")} </sui.Button>
                </div>
            </div>
        </div>;
    }
}

