/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";
import * as codecard from "./codecard"

type ISettingsProps = pxt.editor.ISettingsProps;

export interface CreateFunctionDialogState {
    visible?: boolean;
    functionEditorWorkspace?: Blockly.WorkspaceSvg;
    functionCallback?: Blockly.Functions.ConfirmEditCallback;
    initialMutation?: Element;
    functionBeingEdited?: Blockly.FunctionDeclarationBlock;
    mainWorkspace?: Blockly.Workspace;
}

export class CreateFunctionDialog extends data.Component<ISettingsProps, CreateFunctionDialogState> {
    static cachedFunctionTypes: pxt.FunctionEditorTypeInfo[] = null;

    constructor(props: ISettingsProps) {
        super(props);
        this.state = {
            visible: false,
            functionEditorWorkspace: null,
            functionCallback: null,
            initialMutation: null,
            functionBeingEdited: null
        };

        this.hide = this.hide.bind(this);
        this.modalDidOpen = this.modalDidOpen.bind(this);
        this.cancel = this.cancel.bind(this);
        this.confirm = this.confirm.bind(this);
    }

    hide() {
        Blockly.WidgetDiv.DIV.classList.remove("functioneditor");
        const { functionEditorWorkspace, mainWorkspace } = this.state;
        functionEditorWorkspace.clear();
        functionEditorWorkspace.dispose();
        (mainWorkspace as any).refreshToolboxSelection();
        this.setState({
            visible: false, functionEditorWorkspace: null,
            functionCallback: null,
            initialMutation: null,
            functionBeingEdited: null
        });
    }

    show(initialMutation: Element, cb: Blockly.Functions.ConfirmEditCallback, mainWorkspace: Blockly.Workspace) {
        pxt.tickEvent('createfunction.show', null, { interactiveConsent: false });
        this.setState({
            visible: true,
            functionCallback: cb,
            initialMutation,
            mainWorkspace
        });
    }

    modalDidOpen(ref: HTMLElement) {
        const workspaceDiv = document.getElementById('functionEditorWorkspace');
        let { functionEditorWorkspace, initialMutation } = this.state;

        if (!workspaceDiv) {
            return;
        }

        // Adjust the WidgetDiv classname so that it can show up above the dimmer
        Blockly.WidgetDiv.DIV.classList.add("functioneditor");

        // Create the function editor workspace
        functionEditorWorkspace = Blockly.inject(workspaceDiv, {
            trashcan: false,
            scrollbars: true
        }) as Blockly.WorkspaceSvg;
        (functionEditorWorkspace as any).showContextMenu_ = () => { }; // Disable the context menu
        functionEditorWorkspace.clear();

        const functionBeingEdited = functionEditorWorkspace.newBlock('function_declaration') as Blockly.FunctionDeclarationBlock;
        (functionBeingEdited as any).domToMutation(initialMutation);
        functionBeingEdited.initSvg();
        functionBeingEdited.render(false);
        functionEditorWorkspace.centerOnBlock(functionBeingEdited.id);

        functionEditorWorkspace.addChangeListener(() => {
            const { functionBeingEdited } = this.state;
            if (functionBeingEdited) {
                functionBeingEdited.updateFunctionSignature();
            }
        });

        this.setState({
            functionEditorWorkspace,
            functionBeingEdited
        });
        Blockly.svgResize(functionEditorWorkspace);
    }

    cancel() {
        pxt.tickEvent("createfunction.cancel", undefined, { interactiveConsent: true });
        this.hide();
    }

    confirm() {
        Blockly.hideChaff();
        const { functionBeingEdited, mainWorkspace, functionCallback } = this.state;
        const mutation = (functionBeingEdited as any).mutationToDom();
        if (Blockly.Functions.validateFunctionExternal(mutation, mainWorkspace)) {
            functionCallback(mutation);
            this.hide();
        }
    }

    addArgumentFactory(typeName: string) {
        return () => this.addArgument(typeName);
    }

    addArgument(typeName: string) {
        const { functionBeingEdited } = this.state;
        switch (typeName) {
            case "boolean":
                functionBeingEdited.addBooleanExternal();
                break;
            case "string":
                functionBeingEdited.addStringExternal();
                break;
            case "number":
                functionBeingEdited.addNumberExternal();
                break;
            default:
                functionBeingEdited.addCustomExternal(typeName);
                break;
        }
    }

    // TODO fix mobile confirm buttons (no text, but still space for text)

    renderCore() {
        const { visible } = this.state;
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
        const types = this.getArgumentTypes().slice();

        return (
            <sui.Modal isOpen={visible} className="createfunction" size="large"
                closeOnEscape={false} closeIcon={false} closeOnDimmerClick={false} closeOnDocumentClick={false}
                dimmer={true} buttons={actions} header={lf("Edit Function")}
                modalDidOpen={this.modalDidOpen}
            >
                <div>
                    <span className="ui text mobile only paramlabel">{lf("Add a parameter")}</span>
                    <div className="horizontal list">
                        <span className="ui text mobile hide paramlabel">{lf("Add a parameter")}</span>
                        {types.map(t =>
                            <sui.Button
                                key={t.typeName}
                                role="button"
                                className="icon"
                                icon={t.icon}
                                textClass="mobile hide"
                                text={t.label || t.typeName}
                                ariaLabel={lf("Add {0} parameter", t.label || t.typeName)}
                                onClick={this.addArgumentFactory(t.typeName)}
                            />
                        )}
                    </div>
                    <div id="functionEditorWorkspace"></div>
                </div>
            </sui.Modal>
        )
    }

    private getArgumentTypes(): pxt.FunctionEditorTypeInfo[] {
        if (!CreateFunctionDialog.cachedFunctionTypes) {
            const types: pxt.FunctionEditorTypeInfo[] = [
                {
                    label: lf("Text"),
                    typeName: "string",
                    icon: pxt.blocks.defaultIconForArgType("string")
                },
                {
                    label: lf("Boolean"),
                    typeName: "boolean",
                    icon: pxt.blocks.defaultIconForArgType("boolean")
                },
                {
                    label: lf("Number"),
                    typeName: "number",
                    icon: pxt.blocks.defaultIconForArgType("number")
                }
            ];

            if (pxt.appTarget.runtime &&
                pxt.appTarget.runtime.functionsOptions &&
                pxt.appTarget.runtime.functionsOptions.extraFunctionEditorTypes &&
                Array.isArray(pxt.appTarget.runtime.functionsOptions.extraFunctionEditorTypes)) {
                pxt.appTarget.runtime.functionsOptions.extraFunctionEditorTypes.forEach(t => {
                    types.push(t);
                });
            }

            types.forEach(t => {
                if (!t.icon) {
                    t.icon = pxt.blocks.defaultIconForArgType();
                }
            });
            CreateFunctionDialog.cachedFunctionTypes = types;
        }

        return CreateFunctionDialog.cachedFunctionTypes;
    }
}