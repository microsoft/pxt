/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as md from "./marked";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface CreateSnippetBuilderState {
    visible?: boolean;
    markdownContent?: string;
    projectView?: pxt.editor.IProjectView;
    answers?: any;
}

const defaults: any = {
    $nameToken: 'mySprite',
};

const exampleBlock: string = `\`\`\`blocks
enum SpriteKind {
    Player,
    Projectile,
    Food,
    Enemy
}

let $nameToken = sprites.create(img\`
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
\`, SpriteKind.Player)
\`\`\``;

export class CreateSnippetBuilder extends data.Component<ISettingsProps, CreateSnippetBuilderState> {
    static cachedFunctionTypes: pxt.FunctionEditorTypeInfo[] = null;

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false,
            markdownContent: exampleBlock,
            answers: {},
        };
        this.hide = this.hide.bind(this);
        this.cancel = this.cancel.bind(this);
        this.confirm = this.confirm.bind(this);
    }

    replaceTokens(markdownContent: string) {
        const { answers } = this.state;
        let output = markdownContent;
        const tokens = Object.keys(defaults);

        for (let token of tokens) {
            if (answers[token]) {
                output = output.replace(token, answers[token]);
            }
            else {
                output = output.replace(token, defaults[token]);
            }
        }

        return output;
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

    textInputOnChange = (answerKey: string) => (v: string) => {
        const answers = this.state.answers;
        answers[answerKey] = v;

        this.setState({ answers })
        console.log(answers);
    }

    renderCore() {
        const { visible, markdownContent, projectView, answers } = this.state;
        const actions: sui.ModalButton[] = [
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

        // TODO: Workspace component
        // TODO: Make markdown editable by input
        return (
            <sui.Modal isOpen={visible} className="snippetBuilder" size="large"
                closeOnEscape={false} closeIcon={false} closeOnDimmerClick={false} closeOnDocumentClick={false}
                dimmer={true} buttons={actions} header={lf("Sprite Wizard")}
            >
                <div>
                    <div className="list">
                        <div>
                            <div>
                                <sui.Input
                                    onChange={this.textInputOnChange('$nameToken')}
                                    label={'What is the name of your sprite?'}
                                    value={answers['$nameToken'] || ''}
                                />
                            </div>
                        </div>
                    </div>
                    <div id="functionEditorWorkspace">
                        {projectView && <md.MarkedContent markdown={this.replaceTokens(markdownContent)} parent={projectView} />}
                    </div>
                </div>
            </sui.Modal>
        )
    }
}