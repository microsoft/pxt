/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as md from "./marked";
import * as compiler from './compiler';

type ISettingsProps = pxt.editor.ISettingsProps;

export interface SnippetBuilderState {
    visible?: boolean;
    output?: string;
    projectView?: pxt.editor.IProjectView;
    answers?: any; // Will be typed once more clearly defined
    currentQuestion: number;
    defaults: any; // Will be typed once more clearly defined
    mainWorkspace?: Blockly.Workspace;
    config?: any; // Will be a config type
}


/**
 * Snippet builder takes a static config file and builds a modal with inputs and outputs based on config settings.
 * An output type is attached to the start of your markdown allowing you to define a number of markdown output. (blocks, lang)
 * An initial output is set and outputs defined at each questions are appended to the initial output.
 * answerTokens can be defined and are replaced before being outputted. This allows you to output answers and default values.
 */
export class SnippetBuilder extends data.Component<ISettingsProps, SnippetBuilderState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false,
            answers: {},
            currentQuestion: 0, // Index to track current question
            defaults: {},
            config: staticConfig, // This will be set when it is recieved
            output: staticConfig.initialOutput
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
        const defaults: any = {};

        for (const question of config.questions) {
            const { inputs } = question;
            for (const input of inputs) {
                const { defaultAnswer, answerToken } = input;
                defaults[answerToken] = defaultAnswer;
            }
        }

        this.setState({ defaults });
    }

    /**
     * Calls build defaults on mount to create the defaults hashmap.
     */
    componentDidMount() {
        // Sets default values
        this.buildDefaults();
    }

    /**
     * @param output - Takes in a string and returns the tokenized output
     * Loops over each token previously added to defaults and replaces with the answer value if one
     * exists. Otherwise it replaces the token with the provided default value.
     */
    replaceTokens(output: string) {
        const { answers, defaults } = this.state;
        let tokenizedOutput = output;
        const tokens = Object.keys(defaults);

        // Replaces output tokens with answer if available or default value
        for (let token of tokens) {
            if (answers[token]) {
                tokenizedOutput = tokenizedOutput.split(`$${token}`).join(answers[token]);
            }
            else {
                tokenizedOutput = tokenizedOutput.split(`$${token}`).join(defaults[token]);
            }
        }

        return tokenizedOutput;
    }

    /**
     * 
     * @param output - Accepts an output to convert to markdown
     * This attaches three backticks to the front followed by an output type (blocks, lang)
     * The current output is then tokenized and three backticks are appended to the end of the string.
     */
    generateOutputMarkdown(output: string) {
        const { config } = this.state;
        // Attaches starting and ending line based on output type
        let md = `\`\`\`${config.outputType}\n`;
        md += this.replaceTokens(output);
        md += `\n\`\`\``;

        return md
    }

    /**
     * Hides the modal
     */
    hide() {
        this.setState({
            visible: false
        });
    }

    /**
     * 
     * @param projectView - used to access what would traditionally be in the parent prop
     * @param mainWorkspace  - used to append the final xml to the DOM
     */
    show(projectView: pxt.editor.IProjectView, mainWorkspace: Blockly.Workspace) {
        pxt.tickEvent('snippetBuilder.show', null, { interactiveConsent: false });
        this.setState({
            visible: true,
            mainWorkspace,
            projectView,
        });
    }

    /**
     * Closes the modal
     */
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
        const { mainWorkspace, output } = this.state;

        compiler.getBlocksAsync()
            .then(blocksInfo => compiler.decompileBlocksSnippetAsync(this.replaceTokens(output), blocksInfo))
            .then(resp => {
                const xmlDOM = Blockly.Xml.textToDom(resp)
                Blockly.Xml.appendDomToWorkspace(xmlDOM, mainWorkspace);
            });
    }

    /**
     * Hides modal and injects our blocks to the work space.
     */
    confirm() {
        this.injectBlocksToWorkspace();
        this.hide();
    }

    /** 
     * @param increment - this adds either 1 or -1 to the value of currentQuestion
     */
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
        const { currentQuestion, output } = this.state;
        const nextQuestion = config.questions[currentQuestion + 1];
        // If next question exists
        if (nextQuestion) {
            // If output is not already appended
            if (nextQuestion.output && output.indexOf(nextQuestion.output) === -1) {
                this.setState({ output: `${output}\n${nextQuestion.output}`});
            }
            // Change page to page + 1
            this.changePage(1);
        }
    }

    /**
     * Calls changePage with a -1 decrementor
     */
    backPage() {
        this.changePage(-1);
    }

    /**
     * @param answerToken - the answer token to update as defined by the given inputs answerToken in the config file
     * Updates provided answerTokens state on input change
     */
    textInputOnChange = (answerToken: string) => (v: string) => {
        const answers = this.state.answers;
        answers[answerToken] = v;

        this.setState({ answers })
    }

    renderCore() {
        const { visible, output, projectView, answers, currentQuestion, config } = this.state;

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
                                    {currQ.inputs.map((input: any) =>
                                        <div>
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
                        {projectView && <md.MarkedContent markdown={this.generateOutputMarkdown(output)} parent={projectView} />}
                    </div>
                </div>
            </sui.Modal>
        )
    }
}

// This will be passed down as a prop but is currently static
const staticConfig: any = {
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
            "goto": 2
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
            "goto": 3
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
                    "type": {
                        "options": [
                            {
                                "value": "SpriteKind.Player",
                                "label": "Player"
                            },
                            {
                                "value": "SpriteKind.Projectile",
                                "label": "Projectile"
                            },
                            {
                                "value": "SpriteKind.Food",
                                "label": "Food"
                            },
                            {
                                "value": "SpriteKind.Enemy",
                                "label": "Enemy"
                            }
                        ]
                    }
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