/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as data from "./data";
import * as sui from "./sui";

import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";

import ISettingsProps = pxt.editor.ISettingsProps;

export interface CreateFunctionDialogState {
    visible?: boolean;
    functionEditorWorkspace?: Blockly.WorkspaceSvg;
    functionCallback?: pxtblockly.ConfirmEditCallback;
    initialMutation?: Element;
    functionBeingEdited?: pxtblockly.FunctionDeclarationBlock;
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
        pxt.BrowserUtils.removeClass(Blockly.WidgetDiv.getDiv(), "functioneditor");
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

    show(initialMutation: Element, cb: pxtblockly.ConfirmEditCallback, mainWorkspace: Blockly.Workspace) {
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
        pxt.BrowserUtils.addClass(Blockly.WidgetDiv.getDiv(), "functioneditor");

        // Create the function editor workspace
        functionEditorWorkspace = Blockly.inject(workspaceDiv, {
            trashcan: false,
            move: {
                scrollbars: true
            },
            renderer: "pxt"
        }) as Blockly.WorkspaceSvg;
        (functionEditorWorkspace as any).showContextMenu_ = () => { }; // Disable the context menu
        functionEditorWorkspace.clear();

        const functionBeingEdited = functionEditorWorkspace.newBlock('function_declaration') as pxtblockly.FunctionDeclarationBlock & Blockly.BlockSvg;
        functionBeingEdited.domToMutation(initialMutation);
        functionBeingEdited.initSvg();
        functionBeingEdited.render();
        functionEditorWorkspace.centerOnBlock(functionBeingEdited.id, true);

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
        const mutation = functionBeingEdited.mutationToDom();
        if (pxtblockly.validateFunctionExternal(mutation, mainWorkspace)) {
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
            case "Array":
                functionBeingEdited.addArrayExternal();
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
                label: lf("Done"),
                onclick: this.confirm,
                icon: "check",
                className: "approve positive"
            }
        ];
        const types = this.getArgumentTypes().slice();
        const classes =  this.props.parent.createModalClasses("createfunction");
        return (
            <sui.Modal isOpen={visible} className={classes} size="large"
                closeOnEscape={false} closeIcon={true} closeOnDimmerClick={false} closeOnDocumentClick={false}
                dimmer={true} buttons={actions} header={lf("Edit Function")}
                modalDidOpen={this.modalDidOpen}
                onClose={this.hide}
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
                },
                {
                    label: lf("Array"),
                    typeName: "Array",
                    icon: pxt.blocks.defaultIconForArgType("Array")
                }
            ];

            const extraTypes = pxt.appTarget.runtime?.functionsOptions?.extraFunctionEditorTypes;

            if (Array.isArray(extraTypes)) {
                for (const extraType of extraTypes) {
                    const label = extraType.label || extraType.typeName;
                    const defaultName = extraType.defaultName;

                    types.push({
                        ...extraType,
                        label: pxt.Util.rlf(`{id:type}${label}`),
                        defaultName: defaultName && pxt.Util.rlf(`{id:var}${defaultName}`)
                    });
                }
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