/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as md from "./marked";
import * as compiler from './compiler';
import * as ReactDOM from 'react-dom';
import * as pkg from './package';
import * as toolbox from "./toolbox";
import * as core from "./core";
import { InputHandler } from './inputHandler';

type ISettingsProps = pxt.editor.ISettingsProps;

interface SnippetBuilderProps extends ISettingsProps {
    mainWorkspace: Blockly.Workspace;
    config: pxt.SnippetConfig;
}

interface DefaultAnswersMap {
    [answerToken: string]: pxt.SnippetAnswerTypes;
}

interface AnswersMap {
    [answerToken: string]: pxt.SnippetAnswerTypes;
}

interface SnippetBuilderState {
    visible?: boolean;
    tsOutput?: string;
    mdOutput?: string;
    answers?: AnswersMap;
    history: number[];
    defaults: DefaultAnswersMap; // Will be typed once more clearly defined
    config?: pxt.SnippetConfig; // Will be a config type
    actions?: sui.ModalButton[];
}

let thisBlocksInfo: pxtc.BlocksInfo;


/**
 * Snippet builder takes a static config file and builds a modal with inputs and outputs based on config settings.
 * An output type is attached to the start of your markdown allowing you to define a number of markdown output. (blocks, lang)
 * An initial output is set and outputs defined at each questions are appended to the initial output.
 * answerTokens can be defined and are replaced before being outputted. This allows you to output answers and default values.
 */
export class SnippetBuilder extends data.Component<SnippetBuilderProps, SnippetBuilderState> {
    constructor(props: SnippetBuilderProps) {
        super(props);
        this.state = {
            visible: false,
            answers: {},
            history: [0], // Index to track current question
            defaults: {},
            config: props.config,
            tsOutput: props.config.initialOutput
        };

        this.cleanup = this.cleanup.bind(this);
        this.hide = this.hide.bind(this);
        this.cancel = this.cancel.bind(this);
        this.confirm = this.confirm.bind(this);
        this.backPage = this.backPage.bind(this);
        this.nextPage = this.nextPage.bind(this);
    }

    /**
     * Creates a hashmap with answerToken keys and the default value pair as 
     * provided by our config file.
     */
    buildDefaults() {
        const { config } = this.state;
        const defaults: DefaultAnswersMap = {};

        for (const question of config.questions) {
            const { inputs } = question;
            for (const input of inputs) {
                const { defaultAnswer, answerToken } = input;
                defaults[answerToken] = defaultAnswer;
            }
        }

        this.setState({ defaults }, this.generateOutputMarkdown);
    }

    toggleActionButton() {
        let newActionButton: sui.ModalButton;
        if (this.isLastQuestion()) {
            newActionButton =             {
                label: lf("Done"),
                onclick: this.confirm,
                icon: "check",
                className: "approve positive"
            };
        } else {
            newActionButton = {
                label: lf("Next"),
                onclick: this.nextPage,
                icon: 'arrow right',
                className: 'arrow right',
            };
        }
        if (this.state.actions[1] !== newActionButton) {
            this.setState({
                actions: [
                    this.state.actions[0],
                    newActionButton
                ]
            });
        }
    }

    initializeActionButtons() {
        const actions: sui.ModalButton[] = [
            {
                label: lf("Back"),
                onclick: this.backPage,
                icon: 'arrow left',
                className: 'arrow left',
                labelPosition: 'left',
            },
            {
                label: lf("Next"),
                onclick: this.nextPage,
                icon: 'arrow right',
                className: 'arrow right',
            },
        ];

        this.setState({ actions });
    }

    componentDidMount() {
        // Sets default values
        this.buildDefaults();
    }

    /**
     * @param output - Takes in a string and returns the tokenized output
     * Loops over each token previously added to defaults and replaces with the answer value if one
     * exists. Otherwise it replaces the token with the provided default value.
     */
    replaceTokens(tsOutput: string) {
        const { answers, defaults } = this.state;
        let tokenizedOutput = tsOutput;
        const tokens = Object.keys(defaults);

        // Replaces output tokens with answer if available or default value
        for (let token of tokens) {
            const value = answers[token] || defaults[token];
            tokenizedOutput = tokenizedOutput.split(`$${token}`).join(value);
        }

        return tokenizedOutput;
    }

    /**
     * 
     * This attaches three backticks to the front followed by an output type (blocks, lang)
     * The current output is then tokenized and three backticks are appended to the end of the string.
     */
    generateOutputMarkdown = pxt.Util.debounce(() => {
        const { config, tsOutput } = this.state;
        // Attaches starting and ending line based on output type
        let md = `\`\`\`${config.outputType}\n`;
        md += this.replaceTokens(tsOutput);
        md += `\n\`\`\``;

        this.setState({ mdOutput: md });
    }, 300, false);

    hide() {
        this.setState({
            visible: false
        });
    }

    show() {
        pxt.tickEvent('snippet.builder.show', null, { interactiveConsent: true });
        this.initializeActionButtons();
        this.setState({
            visible: true,
        });
    }

    cleanup() {
        // Reset state to initial values
        this.setState({
            answers: {},
            history: [0],
            tsOutput: this.props.config.initialOutput,
        });

        Blockly.hideChaff();
    }

    cancel() {
        const { name } = this.state.config;
        pxt.tickEvent("snippet.builder.cancel", { snippet: name, page: this.getCurrentPage() }, { interactiveConsent: true });

        this.hide();
        this.cleanup();
    }

    findRootBlock(xmlDOM: Element, type?: string): Element {
        for (const child in xmlDOM.children) {
            const xmlChild = xmlDOM.children[child];

            if (xmlChild.tagName === 'block') {
                if (type) {
                    const childType = xmlChild.getAttribute('type');

                    if (childType && childType === type) {
                        return xmlChild
                        // return this.findRootBlock(xmlChild);
                    }
                } else {
                    return xmlChild;
                }
            }

            const childChildren = this.findRootBlock(xmlChild);
            if (childChildren) {
                return childChildren;
            }
        }
        return null;
    }

    getOnStartBlock(mainWorkspace: Blockly.Workspace) {
        const topBlocks = mainWorkspace.getTopBlocks(true);
        for (const block of topBlocks) {
            if (block.type === 'pxt-on-start') {
                return block;
            }
        }

        return null;
    }

    /**
     * Takes the output from state, runs replace tokens, decompiles the resulting typescript
     * and outputs the result as a Blockly xmlDOM. This then uses appendDomToWorkspace to attach 
     * our xmlDOM to the mainWorkspaces passed to the component.
     */
    injectBlocksToWorkspace() {
        const { tsOutput } = this.state;
        const { mainWorkspace } = this.props

        compiler.getBlocksAsync()
            .then(blocksInfo => compiler.decompileBlocksSnippetAsync(this.replaceTokens(tsOutput), blocksInfo))
            .then(resp => {
                // Convert XML text to xml dom in order to parse
                const xmlDOM = Blockly.Xml.textToDom(resp);
                // TODO(jb) hard coded in topmost child should be generalized
                const xmlOnStartBlock = this.findRootBlock(xmlDOM, 'pxt-on-start');
                // Finds the on start blocks children
                const toAttach = this.findRootBlock(xmlOnStartBlock);
                const rootConnection = Blockly.Xml.domToBlock(toAttach, mainWorkspace);
                // Hard coded in top blocks
                this.getOnStartBlock(mainWorkspace)
                    .getInput("HANDLER").connection.connect(rootConnection.previousConnection);
            }).catch((e) => {
                core.errorNotification(e);
                throw new Error(`Failed to decompile snippet output`);
            });
    }

    confirm() {
        const { name } = this.state.config;
        pxt.tickEvent('snippet.builder.back.page', { snippet: name, page: this.getCurrentPage() }, { interactiveConsent: true });
        this.injectBlocksToWorkspace();
        Blockly.hideChaff();
        this.hide();
    }

    getCurrentPage() {
        const { history } = this.state;

        return history[history.length - 1];
    }

    getCurrentQuestion() {
        const { config } = this.state;

        return config.questions[this.getCurrentPage()];
    }

    getNextQuestion() {
        const { config } = this.state;
        const currentQuestion = this.getCurrentQuestion();
        if (currentQuestion.goto) {
            return config.questions[currentQuestion.goto.question];
        }
        return null;
    }

    isLastQuestion() {
        if (this.getCurrentQuestion().goto) {
            return false;
        }

        return true;
    }

    updateOutput(question: pxt.SnippetQuestions) {
        const { tsOutput } = this.state;

        if (question.output && tsOutput.indexOf(question.output) === -1) {
            this.setState({ tsOutput: `${tsOutput}\n${question.output}`}, this.generateOutputMarkdown);
        }
    }

    /**
     * Changes page by 1 if next question exists.
     * Looks for output and appends the next questions output if it exists and
     * is not already attached to the current output.
     */
    nextPage() {
        const { config, history } = this.state;
        const currentQuestion = this.getCurrentQuestion();
        const goto = currentQuestion.goto;

        if (this.isLastQuestion()) {
            this.confirm();
        } else if (goto) {
            // Look ahead and update markdown
            const nextQuestion = this.getNextQuestion();
            this.updateOutput(nextQuestion);

            this.setState({ history: [...history, goto.question ]}, this.toggleActionButton)
            pxt.tickEvent('snippet.builder.next.page', { snippet: config.name, page: goto.question}, { interactiveConsent: true });
        }
    }

    backPage() {
        const { history, config } = this.state;

        if (history.length > 1) {
            this.setState({ history: history.slice(0, history.length - 1)}, () => {
                this.toggleActionButton();
                pxt.tickEvent('snippet.builder.back.page', { snippet: config.name, page: this.getCurrentPage() }, { interactiveConsent: true });
            });
        }
    }

    onChange = (answerToken: string) => (v: string) => {
            this.setState((prevState: SnippetBuilderState) => ({
                answers: {
                    ...prevState.answers,
                    [answerToken]: v,
                }
            }), this.generateOutputMarkdown);
        }

    renderCore() {
        const { visible, answers, config, mdOutput, actions } = this.state;
        const { parent } = this.props;

        const currentQuestion = this.getCurrentQuestion();

        return (
            <sui.Modal isOpen={visible} className={'snippet-builder'} size="large"
                closeOnEscape={false} closeIcon={true} closeOnDimmerClick={false} closeOnDocumentClick={false}
                dimmer={true} buttons={actions} header={config.name} onClose={this.cancel}
            >
                <div className="ui equal width grid">
                    <div className='column snippet-question'>
                        {currentQuestion &&
                            <div>
                                <div className='ui segment raised'>
                                    <h3>{pxt.Util.rlf(currentQuestion.title)}</h3>
                                    <div className='ui equal width grid'>
                                        {currentQuestion.inputs.map((input: pxt.SnippetQuestionInput) =>
                                            <span className='column' key={`span-${input.answerToken}`}>
                                                <InputHandler
                                                    onChange={this.onChange(input.answerToken)}
                                                    input={input}
                                                    value={answers[input.answerToken] || ''}
                                                    blocksInfo={thisBlocksInfo}
                                                    onEnter={this.nextPage}
                                                    key={input.answerToken}
                                                />
                                            </span>
                                        )}
                                    </div>
                                    {currentQuestion.errorMessage && <p className='snippet-error'>{currentQuestion.errorMessage}</p>}
                                </div>
                                {currentQuestion.hint &&
                                <div className='snippet hint ui segment'>{pxt.Util.rlf(currentQuestion.hint)}</div>}
                            </div>
                        }
                    </div>
                    <div className='snippet output-section column'>
                        {mdOutput && <md.MarkedContent className='snippet-markdown-content' markdown={mdOutput} parent={parent} />}
                    </div>
                </div>
            </sui.Modal>
        )
    }
}

function getSnippetExtensions(): pxt.SnippetConfig[] {
    const snippetConfigs = pxt.Util.concat(pkg.allEditorPkgs().map(p => p.sortedFiles()))
        .filter(file => file.name === 'pxtsnippets.json')
        .map(file => pxt.Util.jsonTryParse(file.content)) as pxt.SnippetConfig[][];

    return pxt.Util.concat(snippetConfigs);
}

function openSnippetDialog(config: pxt.SnippetConfig, editor: Blockly.WorkspaceSvg, parent: pxt.editor.IProjectView) {
    const wrapper = document.body.appendChild(document.createElement('div'));
    const props = { parent:   parent, mainWorkspace: editor, config };
    const snippetBuilder = ReactDOM.render(
        React.createElement(SnippetBuilder, props),
        wrapper
    ) as SnippetBuilder;
    snippetBuilder.show();
}

export function initializeSnippetExtensions(ns: string, extraBlocks: (toolbox.BlockDefinition | toolbox.ButtonDefinition)[], editor: Blockly.WorkspaceSvg, parent: pxt.editor.IProjectView, blocksInfo: pxtc.BlocksInfo) {
    const snippetExtensions = getSnippetExtensions();

    thisBlocksInfo = blocksInfo

    snippetExtensions
        .filter(snippet => snippet.namespace == ns)
        .forEach(snippet => {
            extraBlocks.push({
                name: `SNIPPET${name}_BUTTON`,
                type: "button",
                attributes: {
                    blockId: `SNIPPET${name}_BUTTON`,
                    label: snippet.label ? pxt.Util.rlf(snippet.label) : pxt.Util.lf("Editor"),
                    weight: 101,
                    group: snippet.group && snippet.group,
                },
                callback: () => {
                    openSnippetDialog(snippet, editor, parent);
                }
            });
        });
}
