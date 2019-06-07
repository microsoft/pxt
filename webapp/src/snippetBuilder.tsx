/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as md from "./marked";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface CreateSnippetBuilderState {
    visible?: boolean;
    output?: string;
    projectView?: pxt.editor.IProjectView;
    answers?: any;
    currentQuestion: number;
    defaults: any;
}

const exampleBlock: string = `
enum SpriteKind {
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
\`, SpriteKind.Player)`;

export class CreateSnippetBuilder extends data.Component<ISettingsProps, CreateSnippetBuilderState> {
    static cachedFunctionTypes: pxt.FunctionEditorTypeInfo[] = null;

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false,
            output: exampleBlock,
            answers: {},
            currentQuestion: 0,
            defaults: {},
        };
        this.hide = this.hide.bind(this);
        this.cancel = this.cancel.bind(this);
        this.confirm = this.confirm.bind(this);
        this.backPage = this.backPage.bind(this);
        this.nextPage = this.nextPage.bind(this);
    }

    buildDefaults() {
        const defaults: any = {};

        for (const question of questions) {
            const { inputs } = question;
            for (const input of inputs) {
                const { defaultAnswer, answerToken } = input;
                defaults[answerToken] = defaultAnswer;
            }
        }

        this.setState({ defaults });
    }

    componentDidMount() {
        this.buildDefaults();
    }

    replaceTokens(output: string) {
        const { answers, defaults } = this.state;
        let cleanOutput = output;
        const tokens = Object.keys(defaults);

        for (let token of tokens) {
            if (answers[token]) {
                cleanOutput = cleanOutput.split(`$${token}`).join(answers[token]);
            }
            else {
                cleanOutput = cleanOutput.split(`$${token}`).join(defaults[token]);
            }
        }

        return `\`\`\`blocks
        ${cleanOutput}
        \`\`\``;
    }

    hide() {
        this.setState({
            visible: false
        });
    }

    show(projectView: pxt.editor.IProjectView) {
        pxt.tickEvent('snippetBuilder.show', null, { interactiveConsent: false });
        this.setState({
            visible: true,
            projectView,
        });
    }

    cancel() {
        pxt.tickEvent("snippetBuilder.cancel", undefined, { interactiveConsent: true });
        this.hide();
    }

    confirm() {
        this.hide();
    }

    changePage(increment: 1 | -1) {
        const { currentQuestion } = this.state;
        this.setState({ currentQuestion: currentQuestion + increment });
    }

    nextPage() {
        const { currentQuestion } = this.state;
        this.changePage(1);
        console.log('current question =>', currentQuestion + 1);
        if (questions[currentQuestion + 1].output) {
            this.setState({ output: `${this.state.output}\n${questions[currentQuestion + 1].output}`});
        }
    }

    backPage() {
        this.changePage(-1);
    }

    textInputOnChange = (answerKey: string) => (v: string) => {
        const answers = this.state.answers;
        answers[answerKey] = v;

        this.setState({ answers })
        console.log(answers);
    }

    renderCore() {
        const { visible, output, projectView, answers, currentQuestion } = this.state;
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

        const currQ = questions[currentQuestion];

        // TODO: Workspace component
        return (
            <sui.Modal isOpen={visible} className="snippetBuilder" size="large"
                closeOnEscape={false} closeIcon={false} closeOnDimmerClick={false} closeOnDocumentClick={false}
                dimmer={true} buttons={actions} header={lf("Sprite Wizard")}
            >
                <div>
                    <div className="list">
                        {currQ &&
                            <div>
                                <div>{currQ.title}</div>
                                <div className='horizontal list'>
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
                        {projectView && <md.MarkedContent markdown={this.replaceTokens(output)} parent={projectView} />}
                    </div>
                </div>
            </sui.Modal>
        )
    }
}

const questions: any = [
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
                            "value": 0,
                            "label": "Player"
                        },
                        {
                            "value": 1,
                            "label": "Projectile"
                        },
                        {
                            "value": 2,
                            "label": "Food"   
                        },
                        {
                            "value": 3,
                            "label": "Enemy"
                        }
                    ]
                }
            }
        ],
        "output": "$spriteName.setType($spriteKind)",
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