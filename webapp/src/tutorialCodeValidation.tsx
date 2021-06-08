/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as compiler from "./compiler";
import { TutorialCard } from "./tutorial";

type ISettingsProps = pxt.editor.ISettingsProps;

interface TutorialCodeValidationProps extends ISettingsProps {
    onYesButtonClick: () => void;
    onNoButtonClick: () => void;
    validationTelemetry: (command: string) => void;
    initialVisible: boolean;
    isTutorialCodeInvalid: boolean;
    ruleComponents: pxt.tutorial.TutorialRuleStatus[];
    areStrictRulesPresent: boolean;
}

interface TutorialCodeValidationState {
    visible: boolean;
    ruleSnippets?: pxt.Map<string[]>;
}

export class ShowValidationMessage extends data.Component<TutorialCodeValidationProps, TutorialCodeValidationState> {
    protected snippetCache: pxt.Map<string> = {};

    constructor(props: TutorialCodeValidationProps) {
        super(props);

        this.state = { visible: this.props.initialVisible, ruleSnippets: {} };
    }

    showUnusedBlocksMessage(vis: boolean) {
        this.setState({ visible: vis });
    }

    moveOnToNextTutorialStep() {
        this.props.validationTelemetry("continue");
        this.props.onYesButtonClick();
        this.showUnusedBlocksMessage(false);
    }

    stayOnThisTutorialStep() {
        this.props.validationTelemetry("edit");
        this.props.onNoButtonClick();
    }

    componentDidMount() {
        this.props.ruleComponents.forEach(rule => {
            if (rule.blockIds && !this.state.ruleSnippets?.[rule.ruleName]?.length) {
                this.getRuleSnippets(rule);
            }
        })
    }

    UNSAFE_componentWillReceiveProps(nextProps: TutorialCodeValidationProps, nextState: TutorialCodeValidationState) {
        nextProps.ruleComponents.forEach(rule => {
            const prev = this.props.ruleComponents.find(r => r.ruleName == rule.ruleName);
            // Update if the list of blockids is different
            if ((rule.blockIds && rule.blockIds.sort().toString() != prev?.blockIds?.sort()?.toString())
                || rule.blockIds.length != nextState.ruleSnippets?.[rule.ruleName]?.length) {
                this.getRuleSnippets(rule);
            }
        })
    }

    renderRule(rule: pxt.tutorial.TutorialRuleStatus, index?: number) {
        const snippets = this.state.ruleSnippets?.[rule.ruleName];
        if (!snippets) {
            return <p key={index + rule.ruleName}>{(rule.ruleTurnOn && !rule.ruleStatus) ? rule.ruleMessage : ''}</p>
        } else {
            // TODO (jxwoon): render snippets
            return <p key={index + rule.ruleName}>{(rule.ruleTurnOn && !rule.ruleStatus) ? rule.ruleMessage : ''}</p>
        }
    }

    getRuleSnippets(rule: pxt.tutorial.TutorialRuleStatus) {
        if (rule.blockIds) {
            // Get all APIs from compiler
            compiler.getBlocksAsync().then(blocksInfo => {
                return Promise.all(rule.blockIds.map(id => {
                    if (this.snippetCache[id]) return this.snippetCache[id];

                    const symbol = blocksInfo.blocksById[id];
                    if (!symbol) {
                        return Promise.resolve(undefined);
                    }
                    // Get snippet based on the qualified name
                    return compiler.snippetAsync(symbol.qName, false).then(snippet => {
                        this.snippetCache[id] = snippet;
                        return snippet;
                    })
                })).then(snippets => {
                    this.setState({ ruleSnippets: {
                        ...this.state.ruleSnippets,
                        [rule.ruleName]: snippets.filter(s => !!s)
                    } });
                })
            })
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
                    {rulesDefined && rules.map((rule, index) => this.renderRule(rule, index))}
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

