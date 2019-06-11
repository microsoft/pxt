/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as md from "./marked";
import * as compiler from './compiler';

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

interface IQuestionInput {
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

export interface SnippetBuilderState {
    visible?: boolean;
    tsOutput?: string;
    answers?: IAnswersMap;
    currentQuestion: number;
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
            currentQuestion: 0, // Index to track current question
            defaults: {},
            config: staticConfig, // This will be set when it is recieved
            tsOutput: staticConfig.initialOutput
        };

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

    cancel() {
        pxt.tickEvent("snippetBuilder.cancel", undefined, { interactiveConsent: true });
        this.hide();
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
                const xmlDOM = Blockly.Xml.textToDom(resp)

                Blockly.Xml.appendDomToWorkspace(xmlDOM, mainWorkspace);
            }).catch((e) => {
                pxt.reportException(e);
                throw new Error(`Failed to decompile snippet output`);
            });;
    }

    confirm() {
        this.injectBlocksToWorkspace();
        Blockly.hideChaff();
        this.hide();
    }

    changePage(increment: 1 | -1) {
        const { currentQuestion } = this.state;
        this.setState({ currentQuestion: currentQuestion + increment });
    }

    /**
     * Changes page by 1 if next question exists.
     * Looks for output and appends the next questions output if it exists and
     * is not already attached to the current output.
     */
    nextPage() {
        const { config } = this.state;
        const { currentQuestion, tsOutput } = this.state;
        const nextQuestion = config.questions[currentQuestion + 1];
        // If next question exists
        if (nextQuestion) {
            // If output is not already appended
            if (nextQuestion.output && tsOutput.indexOf(nextQuestion.output) === -1) {
                this.setState({ tsOutput: `${tsOutput}\n${nextQuestion.output}`});
            }
            // Change page to page + 1
            this.changePage(1);
        }
    }

    backPage() {
        this.changePage(-1);
    }

    textInputOnChange = (answerToken: string) => (v: string) => {
        const answers = this.state.answers;
        answers[answerToken] = v;

        this.setState({ answers })
    }

    renderCore() {
        const { visible, tsOutput, answers, currentQuestion, config } = this.state;
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
                onclick: this.hide,
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

        const currQ = config.questions[currentQuestion];

        return (
            <sui.Modal isOpen={visible} className="snippetBuilder" size="large"
                closeOnEscape={false} closeIcon={false} closeOnDimmerClick={false} closeOnDocumentClick={false}
                dimmer={true} buttons={actions} header={config.name}
            >
                <div>
                    <div className="list">
                        {currQ &&
                            <div>
                                <div>{currQ.title}</div>
                                <div className='list horizontal'>
                                    {currQ.inputs.map((input: IQuestionInput) =>
                                        <div key={input.answerToken}>
                                            <sui.Input
                                                label={input.label && input.label}
                                                value={answers[input.answerToken] || ''}
                                                onChange={this.textInputOnChange(input.answerToken)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        }
                    </div>
                    <div id="snippetBuilderOutput">
                        {parent && <md.MarkedContent markdown={this.generateOutputMarkdown(tsOutput)} parent={parent} />}
                    </div>
                </div>
            </sui.Modal>
        )
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

    let $spriteName = sprites.create(img\`
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
    \`, SpriteKind.Player)`,
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
        // {
        //     "title": "What should your sprite look like?",
        //     "inputs": [
        //         {
        //             "answerToken": "spriteImage",
        //             "type": "spriteEditor"
        //         }
        //     ],
        //     "ouput": "${spriteName} = sprites.setImage(img```${spriteImage}```)",
        //     "goto": 1
        // },
        {
            "title": "What kind of sprite should this be?",
            "inputs": [
                {
                    "answerToken": "spriteKind",
                    "defaultAnswer": "SpriteKind.Player",
                    "type": "dropdown"
                }
            ],
            "output": "$spriteName.setKind($spriteKind)",
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
