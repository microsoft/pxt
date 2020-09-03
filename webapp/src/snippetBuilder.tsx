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
import { InputHandler } from './snippetBuilderInputHandler';

type ISettingsProps = pxt.editor.ISettingsProps;

interface SnippetBuilderProps extends ISettingsProps {
    mainWorkspace: Blockly.WorkspaceSvg;
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
    tsOutput?: string[];
    mdOutput?: string;
    answers?: AnswersMap;
    history: number[];
    defaults: DefaultAnswersMap; // Will be typed once more clearly defined
    config?: pxt.SnippetConfig; // Will be a config type
    actions?: sui.ModalButton[];
}

/**
 * Snippet builder takes a static config file and builds a modal with inputs and outputs based on config settings.
 * An output type is attached to the start of your markdown allowing you to define a number of markdown output. (blocks, lang)
 * An initial output is set and outputs defined at each questions are appended to the initial output.
 * answerTokens can be defined and are replaced before being outputted. This allows you to output answers and default values.
 * TODO:
 * 1. Richer questions for different sprite paths
 *  - This includes fleshing out a different path experience for projectile, food, and enemy.
 *  - Stay in wall question for player.
 *  - On collision for projectile
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
            tsOutput: [props.config.initialOutput]
        };

        this.cleanup = this.cleanup.bind(this);
        this.hide = this.hide.bind(this);
        this.cancel = this.cancel.bind(this);
        this.confirm = this.confirm.bind(this);
        this.backPage = this.backPage.bind(this);
        this.nextPage = this.nextPage.bind(this);
        this.handleModalKeyDown = this.handleModalKeyDown.bind(this);
    }

    /**
     * Creates a hashmap with answerToken keys and the default value pair as 
     * provided by our config file.
     */
    buildDefaults() {
        const { config } = this.state;
        const defaults: AnswersMap = {};

        for (const question of config.questions) {
            const { inputs } = question;
            for (const input of inputs) {
                if (isSnippetInputAnswerSingular(input)) {
                    const { defaultAnswer, answerToken } = input;
                    defaults[answerToken] = defaultAnswer;
                }
                else {
                    const { defaultAnswers, answerTokens } = input;
                    for (let i = 0; i < answerTokens.length; i++) {
                        const token = answerTokens[i];
                        const defaultAnswer = defaultAnswers[i];
                        defaults[token] = defaultAnswer;
                    }
                }
            }
        }

        this.setState({ answers: defaults, defaults }, this.generateOutputMarkdown);
    }

    toggleActionButton() {
        let newActionButton: sui.ModalButton;
        if (this.isLastQuestion()) {
            newActionButton = {
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
    replaceTokens(tsOutput: string[]) {
        const { answers, defaults } = this.state;
        let tokenizedOutput = tsOutput.join('\n');
        const tokens = Object.keys(defaults);

        // Replaces output tokens with answer if available or default value
        for (let token of tokens) {
            const value = answers[token] || defaults[token];
            tokenizedOutput = tokenizedOutput.split(`$${token}`).join(value);
        }

        return tokenizedOutput;
    }

    /**
     * Takes in ts output and highlights the currently edited block 
     */
    highlightEditedBlocks(tsOutput: string[]) {
        const highlightString = '// @highlight';
        const inputs = this.getCurrentQuestion().inputs;

        // Get answer tokens being edited by inputs in this question
        const editedAnswerTokens = inputs
            .reduce((tokens: string[], input: pxt.SnippetQuestionInput) => {
                if (isSnippetInputAnswerSingular(input)) {
                    // Return singular answerToken
                    return pxt.Util.concat([tokens, [input.answerToken]]);
                }
                else {
                    // Return multiple answer tokens
                    return pxt.Util.concat([tokens, input.answerTokens]);
                }
            }, []);

        // Finds all blocks containing a currently editable answer token and adds a highlight line
        const highlightedOutput = tsOutput
            .reduce((newOutput: string[], currentLine: string) => {
                for (const answerToken of editedAnswerTokens) {
                    if (currentLine.indexOf(answerToken) !== -1) {
                        return pxt.Util.concat([newOutput, [highlightString, currentLine]]);
                    }
                }

                return pxt.Util.concat([newOutput, [currentLine]]);

            }, [])

        return highlightedOutput;
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
        md += this.replaceTokens(this.highlightEditedBlocks(tsOutput));
        md += `\n\`\`\``;
        // Removes whitespace
        // TODO(jb) md.replace(/\s/g, '_'); - This would ensure that no breaking values are introduced to the typescript. Ideally we would ensure typescript is valid before attempting to compile it.
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
            tsOutput: [this.props.config.initialOutput],
        });

        Blockly.hideChaff();
    }

    cancel() {
        const { name } = this.state.config;
        pxt.tickEvent("snippet.builder.cancel", { snippet: name, page: this.getCurrentPage() }, { interactiveConsent: true });

        this.hide();
        this.cleanup();
    }

    /**
     * Takes the output from state, runs replace tokens, decompiles the resulting typescript
     * and outputs the result as a Blockly xmlDOM. This then uses appendDomToWorkspace to attach 
     * our xmlDOM to the mainWorkspaces passed to the component.
     */
    injectBlocksToWorkspace() {
        const { tsOutput } = this.state;
        const { mainWorkspace } = this.props
        const { outputBehavior } = this.state.config;

        compiler.getBlocksAsync()
            .then(blocksInfo => compiler.decompileBlocksSnippetAsync(this.replaceTokens(tsOutput), blocksInfo))
            .then(resp => {
                // get the root blocks (e.g. on_start) from the new code
                const newXml = Blockly.Xml.textToDom(resp.outfiles["main.blocks"]);
                const newBlocksDom = pxt.blocks.findRootBlocks(newXml)

                // get the existing root blocks
                let existingBlocks = mainWorkspace.getTopBlocks(true);

                // if we're replacing all existing blocks, do that first
                if (outputBehavior === "replace") {
                    existingBlocks.forEach(b => {
                        b.dispose(false);
                    })
                    existingBlocks = []
                }

                // determine which blocks should merge together
                // TODO: handle parameter mismatch like on_collision's "kind" field.
                //      At the time of this writting this isn't a blocking issue since
                //      the snippet builder is only used for the Sprite Wizard (which
                //      only uses on_start and game modding (which outputs an entirely
                //      new game)
                let toMergeOrAttach = newBlocksDom.map(newB => {
                    let coincides = existingBlocks.filter(exB => {
                        const newType = newB.getAttribute('type');
                        return newType === exB.type
                    })
                    if (coincides.length)
                        return { newB, exB: coincides[0] }
                    return { newB, exB: null }
                })
                let toMerge = toMergeOrAttach.filter(p => !!p.exB);
                let toAttach = toMergeOrAttach.filter(p => !p.exB);

                // merge them
                function merge(pair: { newB: Element, exB: Blockly.Block }) {
                    let { newB, exB } = pair;
                    const firstChild = pxt.blocks.findRootBlock(newB)
                    const toAttach = Blockly.Xml.domToBlock(firstChild, mainWorkspace);
                    exB.getInput("HANDLER").connection.connect(toAttach.previousConnection);
                }
                toMerge.forEach(merge)

                // attach the rest
                function attach(pair: { newB: Element }) {
                    let { newB } = pair;
                    Blockly.Xml.domToBlock(newB, mainWorkspace);
                }
                toAttach.forEach(attach)

                // if there wasn't more than one existing block, reformat the code
                if (existingBlocks.length <= 1) {
                    pxt.blocks.layout.flow(mainWorkspace, { useViewWidth: true });
                }
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

    getNextQuestionNumber() {
        const { answers, defaults } = this.state;
        const currentQuestion = this.getCurrentQuestion();

        if (currentQuestion.goto) {
            const { parameters } = currentQuestion.goto;

            if (parameters) {
                for (const parameter of parameters) {
                    const { answer, token } = parameter;
                    if (!!answer && !!token) {
                        if (answer === answers[token] || (!answers[token] && answer === defaults[token])) {
                            return parameter.question;
                        }
                    }
                }
            }

            return currentQuestion.goto.question;
        }

        return null;
    }

    getNextQuestion() {
        const { config } = this.state;
        const nextQuestionNumber = this.getNextQuestionNumber();

        if (nextQuestionNumber) {
            return config.questions[nextQuestionNumber];
        }

        return null;
    }

    isLastQuestion() {
        if (this.getCurrentQuestion().goto) {
            return false;
        }

        return true;
    }

    /**
     * Changes page by 1 if next question exists.
     * Looks for output and appends the next questions output if it exists and
     * is not already attached to the current output.
     */
    nextPage() {
        const { config, history } = this.state;
        const currentQuestion: pxt.SnippetQuestions = this.getCurrentQuestion();
        const goto = currentQuestion.goto;

        if (this.isLastQuestion()) {
            this.confirm();
        } else if (goto) {
            // Look ahead and update markdown
            const nextQuestion = this.getNextQuestion();
            let newTsOutput = this.updateOutput(nextQuestion, this.state.answers, this.state.tsOutput)
            const nextQuestionNumber = this.getNextQuestionNumber();

            this.setState({ history: [...history, nextQuestionNumber], tsOutput: newTsOutput }, this.toggleActionButton)
            pxt.tickEvent('snippet.builder.next.page', { snippet: config.name, page: nextQuestionNumber }, { interactiveConsent: true });
            // Force generates output markdown for updated highlighting
            this.generateOutputMarkdown();
        }
    }

    backPage() {
        const { history, config } = this.state;

        if (history.length > 1) {
            this.setState({ history: history.slice(0, history.length - 1) }, () => {
                this.toggleActionButton();
                pxt.tickEvent('snippet.builder.back.page', { snippet: config.name, page: this.getCurrentPage() }, { interactiveConsent: true });

                // Force generates output markdown for updated highlighting
                this.generateOutputMarkdown();
            });
        }
    }

    handleModalKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        // Move to next page if enter or right arrow key pressed
        if (e.keyCode === 13 || e.keyCode === 39) {
            this.nextPage();
        }
        // Move to the previous page if left arrow key is pressed
        if (e.keyCode === 37) {
            this.backPage();
        }
    }

    onChange = (answerToken: string) => (v: string) => {
        let question = this.getCurrentQuestion();
        this.setState((prevState: SnippetBuilderState) => {
            let newAnswers = {
                ...prevState.answers,
                [answerToken]: v,
            };
            return {
                answers: newAnswers,
                tsOutput: this.updateOutput(question, newAnswers, prevState.tsOutput)
            }
        }, this.generateOutputMarkdown);
    }

    updateOutput(question: pxt.SnippetQuestions, answers: AnswersMap, oldTsOutput: string[]): string[] {
        let skipOutput = false
        if (!!question.outputConditionalOnAnswer) {
            let cond = question.outputConditionalOnAnswer;
            let qas = question.inputs
                .map(i => isSnippetInputAnswerSingular(i) ? [i.answerToken] : i.answerTokens)
                .reduce((p, n) => [...p, ...n], [])
            // we intentionally allow type coercion since sometimes answers are boolean, sometimes string
            if (qas.every(a => answers[a] != cond))
                skipOutput = true
        }

        let hasOutput = !!question.output
        let outputAlreadyIncluded = hasOutput && oldTsOutput.indexOf(question.output) !== -1

        let newOutput = oldTsOutput
        if (!skipOutput && !outputAlreadyIncluded && hasOutput) {
            newOutput = pxt.Util.concat([oldTsOutput, [question.output]]);
        } else if (skipOutput && outputAlreadyIncluded) {
            newOutput = oldTsOutput
                .filter(o => o !== question.output)
        }

        return newOutput;
    }

    renderCore() {
        const { visible, answers, config, mdOutput, actions, defaults } = this.state;
        const { parent } = this.props;

        const currentQuestion = this.getCurrentQuestion();

        let isFirstPage = this.getCurrentPage() === 0;

        return (
            <sui.Modal isOpen={visible} className={'snippet-builder full-screen-no-bg ' + (isFirstPage ? 'no-back-btn' : '')}
                overlayClassName={'snippet-builder-modal-overlay'}
                closeOnEscape={true} closeIcon={true} closeOnDimmerClick={false} closeOnDocumentClick={false}
                dimmer={true} buttons={actions} header={config.name} onClose={this.cancel}
                onKeyDown={this.handleModalKeyDown}
            >
                <div className="snippet-builder-inner">
                    {currentQuestion &&
                        <div className='snippet-question'>
                            <div className='ui segment raised'>
                                <h3>{pxt.Util.rlf(currentQuestion.title)}</h3>
                                <div className='ui equal width grid'>
                                    {currentQuestion.inputs.map((input: pxt.SnippetQuestionInput, i: number) =>
                                        <span className='column' key={`span-${i}`}>
                                            <InputHandler
                                                onChange={isSnippetInputAnswerSingular(input) ? this.onChange(input.answerToken) : this.onChange}
                                                input={input}
                                                value={isSnippetInputAnswerSingular(input) ? answers[input.answerToken] : answers[input.answerTokens[0]]}
                                                onEnter={this.nextPage}
                                                key={isSnippetInputAnswerSingular(input) ? input.answerToken : input.answerTokens[0]}
                                            />
                                        </span>
                                    )}
                                </div>
                                {currentQuestion.errorMessage && <p className='snippet-error'>{currentQuestion.errorMessage}</p>}
                            </div>
                            {currentQuestion.hint &&
                                <div className='snippet hint ui segment'>{
                                    pxt.Util.rlf(currentQuestion.hint)
                                        // replace new lines with <br> elements
                                        .split("\n")
                                        .reduce((p: (JSX.Element | string)[], n) => [...p, p.length ? (<br></br>) : "", n], [])}</div>}
                        </div>
                    }
                    <div className='snippet output-section'>
                        {mdOutput && <md.MarkedContent className='snippet-markdown-content' markdown={mdOutput} parent={parent} />}
                    </div>
                </div>
            </sui.Modal>
        )
    }
}

function getSnippetExtensions(): pxt.SnippetConfig[] {
    let allFiles = pxt.Util.concat(pkg.allEditorPkgs().map(p => p.sortedFiles()))
    let snippetConfigs = allFiles
        .filter(file => file.name === 'pxtsnippets.json')
        .map(file => pxt.Util.jsonTryParse(file.content)) as pxt.SnippetConfig[][];

    // patch in external typescript files (makes it much easier to edit large snippets)
    // TODO: support more .ts fields than just "initialOutput"
    const snippetExternalTs = allFiles
        .filter(file => file.name.endsWith('.snippetts'))
    snippetConfigs = snippetConfigs.map(cs => cs.map(c => {
        if (c.initialOutput.startsWith("file:")) {
            let externalFileName = c.initialOutput.slice("file:".length, c.initialOutput.length)
            let externalTs = snippetExternalTs
                .filter(f => f.name === externalFileName)
            if (externalTs.length != 1) {
                pxt.reportError("snippetbuilder", `invalid external .ts file path: ${externalFileName}`);
                return null
            }
        }
        return c
    }).filter(c => !!c))

    return pxt.Util.concat(snippetConfigs);
}

function openSnippetDialog(config: pxt.SnippetConfig, editor: Blockly.WorkspaceSvg, parent: pxt.editor.IProjectView) {
    const overlay = document.createElement('div');
    const wrapper = document.body.appendChild(overlay);
    const props = { parent: parent, mainWorkspace: editor, config };
    const snippetBuilder = ReactDOM.render(
        React.createElement(SnippetBuilder, props),
        wrapper
    ) as SnippetBuilder;
    snippetBuilder.show();
}

export function initializeSnippetExtensions(ns: string, extraBlocks: (toolbox.BlockDefinition | toolbox.ButtonDefinition)[], editor: Blockly.WorkspaceSvg, parent: pxt.editor.IProjectView) {
    const snippetExtensions = getSnippetExtensions();

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

// Type guard functions
export function isSnippetInputAnswerSingular(input: pxt.SnippetInputAnswerSingular | pxt.SnippetInputAnswerPlural): input is pxt.SnippetInputAnswerSingular {
    return (input as pxt.SnippetInputAnswerSingular).answerToken !== undefined;
}

type SnippetInputType = pxt.SnippetInputOtherType | pxt.SnippetInputNumberType | pxt.SnippetInputDropdownType | pxt.SnippetInputYesNoType
export function isSnippetInputAnswerTypeOther(input: SnippetInputType): input is pxt.SnippetInputOtherType {
    return (input as pxt.SnippetInputOtherType).type !== ('number' || 'dropdown');
}

export function isSnippetInputAnswerTypeNumber(input: SnippetInputType): input is pxt.SnippetInputNumberType {
    return (input as pxt.SnippetInputNumberType).max !== undefined;
}

export function isSnippetInputAnswerTypeYesNo(input: SnippetInputType): input is pxt.SnippetInputNumberType {
    return input.type === "yesno";
}

export function isSnippetInputAnswerTypeDropdown(input: SnippetInputType): input is pxt.SnippetInputDropdownType {
    return (input as pxt.SnippetInputDropdownType).options !== undefined;
}
