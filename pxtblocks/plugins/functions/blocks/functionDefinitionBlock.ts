import * as Blockly from "blockly";
import {
    CommonFunctionMixin,
    COMMON_FUNCTION_MIXIN,
    FunctionArgument,
    CommonFunctionBlock,
} from "../commonFunctionMixin";
import {
    ARGUMENT_REPORTER_ARRAY_BLOCK_TYPE,
    ARGUMENT_REPORTER_BOOLEAN_BLOCK_TYPE,
    ARGUMENT_REPORTER_CUSTOM_BLOCK_TYPE,
    ARGUMENT_REPORTER_NUMBER_BLOCK_TYPE,
    ARGUMENT_REPORTER_STRING_BLOCK_TYPE,
    FUNCTION_CALL_BLOCK_TYPE,
    FUNCTION_CALL_OUTPUT_BLOCK_TYPE,
    FUNCTION_DEFINITION_BLOCK_TYPE,
} from "../constants";
import { createCustomArgumentReporter, getDefinition, isVariableBlockType, mutateCallersAndDefinition, rename } from "../utils";
import { FieldAutocapitalizeTextInput } from "../fields/fieldAutocapitalizeTextInput";
import { MsgKey } from "../msg";
import { FunctionManager } from "../functionManager";
import { COLLAPSE_IMAGE_DATAURI } from "../svgs";
import { ArgumentReporterBlock } from "./argumentReporterBlocks";
import { DUPLICATE_ON_DRAG_MUTATION_KEY } from "../../duplicateOnDrag";

interface FunctionDefinitionMixin extends CommonFunctionMixin {
    createArgumentReporter_(arg: FunctionArgument): ArgumentReporterBlock;
    customContextMenu(menuOptions: Blockly.ContextMenuRegistry.LegacyContextMenuOption[]): void;
    makeEditOption(): Blockly.ContextMenuRegistry.LegacyContextMenuOption;
    makeCallOption(): Blockly.ContextMenuRegistry.LegacyContextMenuOption;
    afterWorkspaceLoad?(): void;
}

export type FunctionDefinitionBlock = CommonFunctionBlock & FunctionDefinitionMixin;

const FUNCTION_DEFINITION_MIXIN: FunctionDefinitionMixin = {
    ...COMMON_FUNCTION_MIXIN,

    populateArgument_: function (this: FunctionDefinitionBlock, arg, connectionMap, input) {
        let oldBlock = null;
        if (connectionMap?.[arg.id]) {
            const saveInfo = connectionMap[arg.id];
            oldBlock = saveInfo.block;
        }

        let argumentReporter;

        // Decide which block to attach.
        if (connectionMap && oldBlock && !oldBlock.isDisposed()) {
            // Update the text if needed. The old argument reporter is the same type,
            // and on the same input, but the argument's display name may have changed.
            argumentReporter = oldBlock as ArgumentReporterBlock;
            argumentReporter.setFieldValue(arg.name, "VALUE");
            delete connectionMap[input.name];
        } else {
            argumentReporter = this.createArgumentReporter_(arg);
        }

        argumentReporter.duplicateOnDrag_ = true;

        // Attach the block.
        input.connection!.connect(argumentReporter.outputConnection!);
    },

    afterWorkspaceLoad: function(this: FunctionDefinitionBlock) {
        for (const input of this.inputList) {
            if (input.type !== Blockly.inputs.inputTypes.VALUE) continue;
            const target = input.connection?.targetBlock();

            if (target?.isShadow() && target.mutationToDom) {
                const mutation = target.mutationToDom();

                if (mutation.getAttribute(DUPLICATE_ON_DRAG_MUTATION_KEY)) {
                    target.setShadow(false);
                }
            }
            const shadowDom = input.connection && input.getShadowDom();

            if (isVariableBlockType(shadowDom?.getAttribute("type"))) {
                input.setShadowDom(null);
            }
        }
    },

    addFunctionLabel_: function (this: FunctionDefinitionBlock, text) {
        const nameField = new FieldAutocapitalizeTextInput(text || "", rename, {
            spellcheck: false,
            disableAutocapitalize: true,
        });
        this.appendDummyInput("function_name").appendField(nameField, "function_name");
    },

    updateFunctionLabel_: function (this: FunctionDefinitionBlock, text: string) {
        Blockly.Events.disable();
        this.getField("function_name")!.setValue(text);
        Blockly.Events.enable();
    },

    createArgumentReporter_: function (this: FunctionDefinitionBlock, arg: FunctionArgument): ArgumentReporterBlock {
        let blockType = "";
        switch (arg.type) {
            case "boolean":
                blockType = ARGUMENT_REPORTER_BOOLEAN_BLOCK_TYPE;
                break;
            case "number":
                blockType = ARGUMENT_REPORTER_NUMBER_BLOCK_TYPE;
                break;
            case "string":
                blockType = ARGUMENT_REPORTER_STRING_BLOCK_TYPE;
                break;
            case "Array":
                blockType = ARGUMENT_REPORTER_ARRAY_BLOCK_TYPE;
                break;
            default:
                blockType = ARGUMENT_REPORTER_CUSTOM_BLOCK_TYPE;
        }
        Blockly.Events.disable();
        let newBlock;
        try {
            if (blockType == ARGUMENT_REPORTER_CUSTOM_BLOCK_TYPE) {
                newBlock = createCustomArgumentReporter(arg.type, this.workspace);
            } else {
                newBlock = this.workspace.newBlock(blockType);
            }
            newBlock.setFieldValue(arg.name, "VALUE");
            newBlock.setShadow(true);
            if (!this.isInsertionMarker() && newBlock instanceof Blockly.BlockSvg) {
                newBlock.initSvg();
                newBlock.render();
            }
        } finally {
            Blockly.Events.enable();
        }
        return newBlock as ArgumentReporterBlock;
    },

    customContextMenu: function (this: FunctionDefinitionBlock, menuOptions: Blockly.ContextMenuRegistry.LegacyContextMenuOption[]) {
        if (this.isInFlyout || this.workspace?.options?.readOnly) return;
        menuOptions.push(this.makeEditOption());
        menuOptions.push(this.makeCallOption());
    },

    makeEditOption: function (this: FunctionDefinitionBlock) {
        return {
            enabled: !(this.workspace?.options?.readOnly),
            text: Blockly.Msg.FUNCTIONS_EDIT_OPTION,
            callback: () => {
                editFunctionCallback(this);
            }
        };
    },

    makeCallOption: function (this: FunctionDefinitionBlock) {
        const functionName = this.getName();

        const mutation = Blockly.utils.xml.createElement("mutation");
        mutation.setAttribute("name", functionName);
        const callBlock = Blockly.utils.xml.createElement("block");
        callBlock.appendChild(mutation);
        callBlock.setAttribute("type", FUNCTION_CALL_BLOCK_TYPE);

        return {
            enabled: this.workspace.remainingCapacity() > 0 && !(this.workspace?.options?.readOnly),
            text: Blockly.Msg.FUNCTIONS_CREATE_CALL_OPTION.replace("%1", functionName),
            callback: Blockly.ContextMenu.callbackFactory(this, callBlock),
        };
    }
};

Blockly.Blocks[FUNCTION_DEFINITION_BLOCK_TYPE] = {
    ...FUNCTION_DEFINITION_MIXIN,
    init: function (this: FunctionDefinitionBlock) {
        this.jsonInit({
            style: {
                hat: "cap",
            },
        });

        this.name_ = "";
        this.arguments_ = [];
        this.functionId_ = "";

        this.createAllInputs_();
        this.setColour(Blockly.Msg[MsgKey.PROCEDURES_HUE]);
        this.setTooltip(Blockly.Msg[MsgKey.PROCEDURES_DEFNORETURN_TOOLTIP]);
        this.setHelpUrl(Blockly.Msg[MsgKey.PROCEDURES_DEFNORETURN_HELPURL]);
        this.setStatements_(true);
        this.setInputsInline(true);

        if (this.workspace.options.collapse) {
            const image = COLLAPSE_IMAGE_DATAURI;
            this.appendDummyInput("function_collapse").appendField(
                new Blockly.FieldImage(
                    image,
                    24,
                    24,
                    "",
                    () => {
                        this.setCollapsed(true);
                    },
                    false
                )
            );
        }
    },
};


function editFunctionCallback(block: CommonFunctionBlock) {
    // Edit can come from either the function definition or a function call.
    // Normalize by setting the block to the definition block for the function.
    if (block.type == FUNCTION_CALL_BLOCK_TYPE || block.type == FUNCTION_CALL_OUTPUT_BLOCK_TYPE) {
        // This is a call block, find the definition block corresponding to the
        // name. Make sure to search the correct workspace, call block can be in flyout.
        const workspaceToSearch = block.workspace;
        block = getDefinition(block.getName(), workspaceToSearch);
    }
    // "block" now refers to the function definition block, it is safe to proceed.
    Blockly.hideChaff();
    if (Blockly.getSelected()) {
        Blockly.getSelected().unselect();
    }

    FunctionManager.getInstance().editFunctionExternal(
        block.mutationToDom(),
        mutation => {
            if (mutation) {
                mutateCallersAndDefinition(block.getName(), block.workspace, mutation);
                block.updateDisplay_();
            }

            setTimeout(() => {
                if ((block as (FunctionDefinitionBlock & Blockly.BlockSvg)).afterWorkspaceLoad) {
                    (block as (FunctionDefinitionBlock & Blockly.BlockSvg)).afterWorkspaceLoad();
                }
            });
        }
    )
}