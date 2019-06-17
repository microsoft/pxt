/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as md from "./marked";
import * as compiler from './compiler';
import { SpriteEditor } from './spriteEditor';

type ISettingsProps = pxt.editor.ISettingsProps;

interface ISnippetBuilderProps extends ISettingsProps {
    mainWorkspace: Blockly.Workspace;
}

type AnswerTypes = any; // Should include custom answer types for number, enums, string, image

interface IGoToParameters {
    [tokenType: string]: number;
}

interface IGoToOptions {
    question: number;
    parameters?: IGoToParameters;
}

export interface IQuestionInput {
    answerToken: string;
    defaultAnswer: AnswerTypes;
    type?: string;
    label?: string;
}

interface IQuestions {
    title: string;
    output?: string;
    goto?: IGoToOptions;
    inputs: IQuestionInput[];
}

interface ISnippetConfig {
    name: string;
    outputType: string;
    initialOutput?: string;
    questions: IQuestions[];
}

interface IDefaultAnswersMap {
    [answerToken: string]: AnswerTypes;
}

interface IAnswersMap {
    [answerToken: string]: AnswerTypes;
}

interface SnippetBuilderState {
    visible?: boolean;
    tsOutput?: string;
    answers?: IAnswersMap;
    history: number[];
    defaults: IDefaultAnswersMap; // Will be typed once more clearly defined
    config?: ISnippetConfig; // Will be a config type
}


/**
 * Snippet builder takes a static config file and builds a modal with inputs and outputs based on config settings.
 * An output type is attached to the start of your markdown allowing you to define a number of markdown output. (blocks, lang)
 * An initial output is set and outputs defined at each questions are appended to the initial output.
 * answerTokens can be defined and are replaced before being outputted. This allows you to output answers and default values.
 */
export class SnippetBuilder extends data.Component<ISnippetBuilderProps, SnippetBuilderState> {
    constructor(props: ISnippetBuilderProps) {
        super(props);
        this.state = {
            visible: false,
            answers: {},
            history: [0], // Index to track current question
            defaults: {},
            config: staticConfig, // This will be set when it is recieved
            tsOutput: staticConfig.initialOutput
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
        const defaults: IDefaultAnswersMap = {};

        for (const question of config.questions) {
            const { inputs } = question;
            for (const input of inputs) {
                const { defaultAnswer, answerToken } = input;
                defaults[answerToken] = defaultAnswer;
            }
        }

        this.setState({ defaults });
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
     * @param output - Accepts an output to convert to markdown
     * This attaches three backticks to the front followed by an output type (blocks, lang)
     * The current output is then tokenized and three backticks are appended to the end of the string.
     */
    generateOutputMarkdown(tsOutput: string) {
        const { config } = this.state;
        // Attaches starting and ending line based on output type
        let md = `\`\`\`${config.outputType}\n`;
        md += this.replaceTokens(tsOutput);
        md += `\n\`\`\``;

        return md
    }

    hide() {
        this.setState({
            visible: false
        });
    }

    show() {
        pxt.tickEvent('snippetBuilder.show', null, { interactiveConsent: true });
        this.setState({
            visible: true,
        });
    }

    cleanup() {
        // Reset state to initial values
        this.setState({
            answers: {},
            history: [0],
            tsOutput: staticConfig.initialOutput,
        });

        Blockly.hideChaff();
    }

    cancel() {
        pxt.tickEvent("snippetBuilder.cancel", undefined, { interactiveConsent: true });
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
                // TODO(jb)
                const xmlDOM = Blockly.Xml.textToDom(resp);
                // TODO(jb) hard coded in topmost child should be generalized
                const xmlOnStartBlock = this.findRootBlock(xmlDOM, 'pxt-on-start');
                const toAttach = this.findRootBlock(xmlOnStartBlock);
                const rootConnection = Blockly.Xml.domToBlock(toAttach, mainWorkspace);
                // Hard coded in top blocks
                this.getOnStartBlock(mainWorkspace)
                    .getInput("HANDLER")
                    .connection
                    .connect(rootConnection.previousConnection);
            })
            .then(this.cleanup)
            .catch((e) => {
                // pxt.reportException(e);
                throw new Error(`Failed to decompile snippet output`);
            });
    }

    confirm() {
        this.injectBlocksToWorkspace();
        Blockly.hideChaff();
        this.hide();
    }

    /**
     * Changes page by 1 if next question exists.
     * Looks for output and appends the next questions output if it exists and
     * is not already attached to the current output.
     */
    nextPage() {
        const { config } = this.state;
        const { history, tsOutput } = this.state;
        const currentQuestion = config.questions[history[history.length - 1]];
        const goto = currentQuestion.goto
        if (goto) {
            const nextQuestion = config.questions[goto.question];

            if (nextQuestion.output && tsOutput.indexOf(nextQuestion.output) === -1) {
                this.setState({ tsOutput: `${tsOutput}\n${nextQuestion.output}`});
            }
            this.setState({ history: [...history, goto.question ]})
        }
    }

    backPage() {
        const { history } = this.state;
        if (history.length > 1) {
            this.setState({ history: history.slice(0, history.length - 1)});
        }
    }

    onChange = (answerToken: string) => (v: string) => {
            this.setState((prevState: SnippetBuilderState) => ({
                answers: {
                    ...prevState.answers,
                    [answerToken]: v,
                }
            }));
        }

    renderCore() {
        const { visible, tsOutput, answers, config, history } = this.state;
        const { parent } = this.props;

        const actions: sui.ModalButton[] = [
            {
                label: lf("Back"),
                onclick: this.backPage,
                icon: 'arrow left',
                className: 'arrow left',
            },
            {
                label: lf("Next"),
                onclick: this.nextPage,
                icon: 'arrow right',
                className: 'arrow right',
            },
            {
                label: lf("Cancel"),
                onclick: this.cancel,
                icon: "cancel",
                className: "cancel lightgrey"
            },
            {
                label: lf("Done"),
                onclick: this.confirm,
                icon: "check",
                className: "approve positive"
            }
        ];

        const currQ = config.questions[history[history.length - 1]];

        return (
            <sui.Modal isOpen={visible} className={'snippet-builder'} size="large"
                closeOnEscape={false} closeIcon={false} closeOnDimmerClick={false} closeOnDocumentClick={false}
                dimmer={true} buttons={actions} header={config.name}
            >
                <div className="ui equal width grid">
                    {currQ &&
                        <div className='ui grid snippet input-section column'>
                            <div className='row'>{currQ.title}</div>
                            <div className='ui equal width grid row'>
                                {currQ.inputs.map((input: IQuestionInput) =>
                                    <div key={input.answerToken} className='column'>
                                        <InputHandler
                                            input={input}
                                            onChange={this.onChange(input.answerToken)}
                                            value={answers[input.answerToken]}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    }
                    <div id="snippetBuilderOutput" className='snippet output-section column'>
                        {parent && <md.MarkedContent className='snippet-markdown-content' markdown={this.generateOutputMarkdown(tsOutput)} parent={parent} />}
                    </div>
                </div>
            </sui.Modal>
        )
    }
}

interface IInputHandlerProps {
    input: IQuestionInput;
    onChange: (v: string) => void;
    value: string;
}

class InputHandler extends data.Component<IInputHandlerProps, {}> {
    constructor(props: IInputHandlerProps) {
        super(props);
    }

    renderCore() {
        const { value, input, onChange } = this.props;

        switch (input.type) {
            case 'spriteEditor':
                return (
                    <SpriteEditor
                        input={input}
                        onChange={onChange}
                        value={value}
                    />
                );
            case 'number':
            case 'text':
            default:
                return (
                    <sui.Input
                        label={input.label && input.label}
                        value={value || ''}
                        onChange={onChange}
                    />
                )
        }
    }
}

// This will be passed down as a prop but is currently static
const staticConfig: ISnippetConfig = {
    name: "Sprite Builder",
    outputType: 'blocks',
    initialOutput: `enum SpriteKind {
        Player,
        Projectile,
        Food,
        Enemy
    }

    let $spriteName = sprites.create($spriteImage, $spriteKind)`,
    questions: [
        {
            "title": "What should your sprite be called?",
            "inputs": [{
                    "answerToken": "spriteName",
                    "defaultAnswer": "mySprite",
                    "type": "text"
            }],
            "output": "",
            "goto": {
                "question": 2
            }
        },
        {
            "title": "Where should your sprite be placed?",
            "inputs": [
                {
                    "label": "x:",
                    "defaultAnswer": 80,
                    "answerToken": "xLocation",
                    "type": "number"
                },
                {
                    "label": "y:",
                    "defaultAnswer": 60,
                    "answerToken": "yLocation",
                    "type": "number"
                }
            ],
            "output": "$spriteName.setPosition($xLocation,$yLocation)",
            "goto": {
                "question": 3
            }
        },
        {
            "title": "What should your sprite look like?",
            "inputs": [
                {
                    "answerToken": "spriteImage",
                    "type": "spriteEditor",
                    defaultAnswer: `img\`
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    . . . . . . . . . . . . . . . .
                    \``
                }
            ],
            // "output": '$spriteName.setImage($spriteImage)',
            "goto": {
                question: 1,
            }
        },
        {
            "title": "What kind of sprite should this be?",
            "inputs": [
                {
                    "answerToken": "spriteKind",
                    "defaultAnswer": "SpriteKind.Player",
                    "type": "dropdown"
                }
            ],
            // "output": "$spriteName.setKind($spriteKind)",
            "goto": {
                "question": 4,
                "parameters": {
                    "spriteKind": 0
                }
            }
        },
        {
            "title": "How many lives should your player have?",
            "inputs": [
                {
                    "answerToken": "gameLives",
                    "defaultAnswer": 3,
                    "type": "number",
                }
            ],
            "output": "info.setLife($gameLives)"
        }
    ]
};
