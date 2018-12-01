/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as sui from "./sui";
import * as core from "./core";

type ISettingsProps = pxt.editor.ISettingsProps;

export interface CreateFunctionDialogState {
    visible?: boolean;
    workspace?: Blockly.Workspace;
    isEdit?: boolean;
    block?: Blockly.Block;
}

export class CreateFunctionDialog extends data.Component<ISettingsProps, CreateFunctionDialogState> {
    static defaultTypes: pxt.FunctionEditorTypeInfo[] = null;

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false,
            workspace: null,
            block: null
        }

        this.hide = this.hide.bind(this);
        this.modalDidOpen = this.modalDidOpen.bind(this);
        this.cancel = this.cancel.bind(this);
        this.confirm = this.confirm.bind(this);
    }

    hide() {
        this.setState({ visible: false });
    }

    show(isEdit: boolean = false) {
        // TODO distinguish between create and edit
        pxt.tickEvent('createfunction.show', undefined, { interactiveConsent: false });
        this.setState({
            visible: true,
            isEdit
        });
    }

    modalDidOpen(ref: HTMLElement) {
        const workspaceDiv = document.getElementById('functionEditorWorkspace');
        let { workspace } = this.state;

        if (!workspaceDiv) {
            return;
        }

        Blockly.hideChaff();

        // Create the Blockly workspace if needed and inject it
        // TODO Figure out how to reuse previous workspace (right now it persists but doesn't get re-rendered unless we inject Blockly again, which creates a new workspace)
        workspace = Blockly.inject(workspaceDiv, {
            trashcan: false,
            scrollbars: true
        });
        workspace.newBlock("");
        this.setState({ workspace });

        // Add the default function block
        // TODO use function, not number

        // Resize
        Blockly.svgResize(workspace);
    }

    cancel() {
        pxt.tickEvent("createfunction.cancel", undefined, { interactiveConsent: true });
        this.hide();
    }

    confirm() {
        // TODO Add the function to the workspace
        this.hide();
    }


    // TEMP
    sendToWorkspace() {
        const { workspace } = this.state;
        workspace.
    }

    // TEMP
    readFromWorkspace() {
        const { workspace } = this.state;
        const block = workspace.getTopBlocks(true)[0];
        this.setState({ block });
    }

    renderCore() {
        const { visible } = this.state;
        const actions: sui.ModalButton[] = [{
            label: lf("Done"),
            onclick: this.confirm,
            icon: 'check',
            className: 'approve positive'
        }];

        this.prepareDefaultTypes();
        const types = CreateFunctionDialog.defaultTypes;

        if (pxt.appTarget.runtime &&
            pxt.appTarget.runtime.extraFunctionTypes &&
            Array.isArray(pxt.appTarget.runtime.extraFunctionTypes)) {
            pxt.appTarget.runtime.extraFunctionTypes.forEach(t => {
                types.push(t);
            });
        }

        return (
            <sui.Modal isOpen={visible} className="createfunction" size="large"
                onClose={this.hide} dimmer={true} buttons={actions}
                closeIcon={true} header={this.state.isEdit ? lf("Edit function") : lf("Create a function")}
                closeOnDimmerClick closeOnDocumentClick closeOnEscape
                modalDidOpen={this.modalDidOpen}
            >
                <div>
                    <div id="functionEditorWorkspace"></div>

                    {/* TEMP */}
                    <textarea id="xmlExporterImporter"></textarea>
                    <button id="sendToWorkspace" onClick={this.}>Send to workspace</button>
                    <button id="readFromWorkspace">Read from workspace</button>
                </div>
            </sui.Modal>
        )
    }

    private prepareDefaultTypes() {
        if (!CreateFunctionDialog.defaultTypes) {
            CreateFunctionDialog.defaultTypes = [
                {
                    label: lf("Text"),
                    type: "string"
                },
                {
                    label: lf("Boolean"),
                    type: "boolean"
                },
                {
                    label: lf("Number"),
                    type: "number"
                },
            ];
        }
    }
}