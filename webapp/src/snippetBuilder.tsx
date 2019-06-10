/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as md from "./marked";
import * as compiler from './compiler';

type ISettingsProps = pxt.editor.ISettingsProps;

export interface CreateSnippetBuilderState {
    visible?: boolean;
    output?: string;
    projectView?: pxt.editor.IProjectView;
    answers?: any; // Will be typed once more clearly defined
    currentQuestion: number;
    defaults: any; // Will be typed once more clearly defined
    mainWorkspace?: Blockly.Workspace;
    config?: any; // Will be a config type
}

export class CreateSnippetBuilder extends data.Component<ISettingsProps, CreateSnippetBuilderState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false,
            answers: {},
            currentQuestion: 0, // Index to track current question
            defaults: {},
            config: staticConfig,
            output: staticConfig.output
        };

        this.hide = this.hide.bind(this);
        this.cancel = this.cancel.bind(this);
        this.confirm = this.confirm.bind(this);
        this.backPage = this.backPage.bind(this);
        this.nextPage = this.nextPage.bind(this);
    }

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

    componentDidMount() {
        // Sets default values
        this.buildDefaults();
    }

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

    generateOutputMarkdown(output: string) {
        const { config } = this.state;
        // Attaches starting and ending line based on output type
        let md = `\`\`\`${config.outputType}\n`;
        md += this.replaceTokens(output);
        md += `\n\`\`\``;

        return md
    }

    hide() {
        this.setState({
            visible: false
        });
    }

    show(projectView: pxt.editor.IProjectView, mainWorkspace: Blockly.Workspace) {
        pxt.tickEvent('snippetBuilder.show', null, { interactiveConsent: false });
        this.setState({
            visible: true,
            mainWorkspace,
            projectView,
        });
    }

    cancel() {
        pxt.tickEvent("snippetBuilder.cancel", undefined, { interactiveConsent: true });
        this.hide();
    }

    injectBlocksToWorkspace() {
        const { mainWorkspace, output } = this.state;

        compiler.getBlocksAsync()
            .then(blocksInfo => compiler.decompileBlocksSnippetAsync(this.replaceTokens(output), blocksInfo))
            .then(resp => {
                Blockly.Xml.appendDomToWorkspace(Blockly.Xml.textToDom(resp), mainWorkspace);
            });
    }

    confirm() {
        this.injectBlocksToWorkspace();
        this.hide();
    }

    changePage(increment: 1 | -1) {
        const { currentQuestion } = this.state;
        this.setState({ currentQuestion: currentQuestion + increment });
    }

    nextPage() {
        const { config } = this.state;
        const { currentQuestion, output } = this.state;
        const nextQuestion = config.questions[currentQuestion + 1];
        // If output exists
        if (nextQuestion.output) {
            // If output is not already appended
            if (output.indexOf(nextQuestion.output) === -1) {
                this.setState({ output: `${output}\n${nextQuestion.output}`});
            }
            // Change page to page + 1
            this.changePage(1);
        }
    }

    backPage() {
        this.changePage(-1);
    }

    textInputOnChange = (answerKey: string) => (v: string) => {
        const answers = this.state.answers;
        answers[answerKey] = v;

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

        // TODO: Workspace component

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

// This will be passed down as a prop
const staticConfig: any = {
    name: "Sprite Builder",
    outputType: 'blocks',
    output: `enum SpriteKind {
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
            "goTo": 2
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
            "goTo": 3
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
        //     "goTo": 1
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
            "goTo": {
                "4": { "spriteKind": 0 },
                "default": null
            }
        },
        {
            "title": "How many lives should your player have?",
            "inputs": [
                {
                    "answerToken": "gameLives",
                    "defaultAnswer": 3,
                    "type": "number",
                    // "label": "img`livesImg` x ${gameLives}"
                }
            ],
            "output": "info.setLife($gameLives)"
        }
    ]
};