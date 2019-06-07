/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as md from "./marked";
import * as codecard from "./codecard"

type ISettingsProps = pxt.editor.ISettingsProps;

export interface CreateSnippetBuilderState {
    visible?: boolean;
    markdownContent?: string;
    projectView?: pxt.editor.IProjectView;
}


const exampleBlock: string = `\`\`\`blocks
enum SpriteKind {
    Player,
    Projectile,
    Food,
    Enemy
}

let mySprite = sprites.create(img\`
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
        };
        this.hide = this.hide.bind(this);
        this.cancel = this.cancel.bind(this);
        this.confirm = this.confirm.bind(this);
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
        pxt.tickEvent("createfunction.cancel", undefined, { interactiveConsent: true });
        this.hide();
    }

    confirm() {
        this.hide();
    }

    renderCore() {
        const { visible, markdownContent, projectView } = this.state;
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
                            <div>What is the name of your sprite?</div>
                            <div>
                                <sui.Input />
                            </div>
                        </div>
                    </div>
                    <div id="functionEditorWorkspace">
                        {projectView && <md.MarkedContent markdown={markdownContent} parent={projectView} />}
                    </div>
                </div>
            </sui.Modal>
        )
    }
}