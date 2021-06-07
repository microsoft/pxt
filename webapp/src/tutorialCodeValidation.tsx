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
    options: pxt.tutorial.TutorialOptions;
}

interface tutorialCodeValidationState {
    visible: boolean;
}

export class ShowValidationMessage extends data.Component<TutorialCodeValidationProps, tutorialCodeValidationState> {
    constructor(props: TutorialCodeValidationProps) {
        super(props);

        this.state = { visible: this.props.initialVisible };
    }

    showUnusedBlocksMessage(vis: boolean) {
        this.setState({ visible: vis });
    }



    moveOnToNextTutorialStep() {
        this.validationRuleStatus(false);
        this.props.onYesButtonClick();
        this.showUnusedBlocksMessage(false);
    }

    stayOnThisTutorialStep() {
        this.validationRuleStatus(true);
        this.props.onNoButtonClick();
    }


    validationRuleStatus(isEditing: boolean) {
        const { tutorialName, tutorialStepInfo, tutorialStep } = this.props.options;
        const stepInfo = tutorialStepInfo[tutorialStep];
        const rules = stepInfo.listOfValidationRules;

        if (rules != undefined) {
            const validationRuleStepStatus: pxt.Map<string | number> = {};
            validationRuleStepStatus["tutorial"] = tutorialName;
            validationRuleStepStatus["step"] = tutorialStep;
            for (let i = 0; i < rules.length; i++) {
                if (rules[i].ruleTurnOn) {
                    validationRuleStepStatus["ruleName"] = rules[i].ruleName;
                    let str = 'tutorial.validation' + (isEditing ? '.edit' : '.continue') + (rules[i].ruleStatus ? '.pass' : '.fail');
                    pxt.tickEvent(str, validationRuleStepStatus);
                }
            }
        }
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

