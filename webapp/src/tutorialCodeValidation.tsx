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

    collectingTurnedOnRulesList(rules: pxt.tutorial.TutorialRuleStatus[]) {
        let turnedOnRulesList: pxt.Map<string> = {};
        if (rules != undefined) {
            for (let i = 0; i < rules.length; i++) {
                if (rules[i].ruleTurnOn) {
                    turnedOnRulesList[rules[i].ruleName] = rules[i].ruleStatus + '';
                }
            }
        }
        return turnedOnRulesList;
    }

    moveOnToNextTutorialStep() {
        const listOfTurnedOnRules = this.collectingTurnedOnRulesList(this.props.ruleComponents);
        pxt.tickEvent('tutorial.validation.next ', listOfTurnedOnRules);
        this.props.onYesButtonClick();
        this.showUnusedBlocksMessage(false);
    }

    stayOnThisTutorialStep() {
        const listOfTurnedOnRules = this.collectingTurnedOnRulesList(this.props.ruleComponents);
        pxt.tickEvent('tutorial.validation.stay ', listOfTurnedOnRules);
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

