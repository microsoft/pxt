import * as Blockly from "blockly";
import { CommonFunctionMixin, COMMON_FUNCTION_MIXIN, CommonFunctionBlock } from "../commonFunctionMixin";
import {
    FUNCTION_CALL_BLOCK_TYPE,
    FUNCTION_CALL_OUTPUT_BLOCK_TYPE,
    FUNCTION_DEFINITION_BLOCK_TYPE,
} from "../constants";
import { getDefinition, getShadowBlockInfoFromType_, isVariableBlockType, mutateCallersAndDefinition } from "../utils";
import { MsgKey } from "../msg";

interface FunctionCallMixin extends CommonFunctionMixin {
    attachShadow_(input: Blockly.Input, typeName: string): void;
    buildShadowDom_(argumentType: string): Element;
    onchange(event: Blockly.Events.Abstract): void;
    afterWorkspaceLoad(): void;
}

type FunctionCallBlock = CommonFunctionBlock & FunctionCallMixin;

const FUNCTION_CALL_MIXIN: FunctionCallMixin = {
    ...COMMON_FUNCTION_MIXIN,

    populateArgument_: function (this: FunctionCallBlock, arg, connectionMap, input) {
        let oldBlock = null;
        let oldShadow = null;
        if (connectionMap && arg.id in connectionMap) {
            const saveInfo = connectionMap[arg.id];
            oldBlock = saveInfo["block"];
            oldShadow = saveInfo["shadow"];
        }

        const checker = oldBlock?.workspace.connectionChecker;

        Blockly.Events.disable();
        try {
            if (
                oldBlock &&
                !oldBlock.isDisposed() &&
                connectionMap &&
                checker?.canConnectWithReason(oldBlock?.outputConnection!, input.connection!, false) ===
                    Blockly.Connection.CAN_CONNECT
            ) {
                // Reattach the old block and shadow DOM.
                oldBlock.outputConnection!.connect(input.connection!);
                let shadowDom: Element;
                if (oldBlock.isShadow()) {
                    shadowDom = Blockly.Xml.blockToDom(oldBlock) as Element;
                } else {
                    shadowDom = oldShadow || this.buildShadowDom_(arg.type);
                }
                if (shadowDom.getAttribute("type") !== "variables_get") {
                    input.connection!.setShadowDom(shadowDom);
                }

                delete connectionMap[input.name!];
            } else {
                this.attachShadow_(input, arg.type);
            }
        } finally {
            Blockly.Events.enable();
        }
    },

    afterWorkspaceLoad: function(this: FunctionCallBlock) {
        for (const input of this.inputList) {
            if (input.type !== Blockly.inputs.inputTypes.VALUE) continue;
            const target = input.connection?.targetBlock();

            if (target) {
                if (target.isShadow() && target.getVarModels().length) {
                    target.setShadow(false);
                }
            }
            const shadowDom = input.connection && input.getShadowDom();

            if (isVariableBlockType(shadowDom?.getAttribute("type"))) {
                input.setShadowDom(null);
            }
        }
    },

    addFunctionLabel_: function (this: FunctionCallBlock, text) {
        this.appendDummyInput("function_name").appendField(
            new Blockly.FieldLabel(text, "functionNameText"),
            "function_name"
        );
    },

    updateFunctionLabel_: function (this: FunctionCallBlock, text: string) {
        this.getField("function_name")!.setValue(text);
    },

    attachShadow_(this: FunctionCallBlock, input: Blockly.Input, argumentType: string): void {
        const shadowInfo = getShadowBlockInfoFromType_(argumentType, this.workspace);
        const shadowType = shadowInfo[0];
        const fieldName = shadowInfo[1];
        const fieldValue = shadowInfo[2];
        Blockly.Events.disable();
        let newBlock = null;
        try {
            newBlock = this.workspace.newBlock(shadowType);
            newBlock.setFieldValue(fieldValue, fieldName);
            newBlock.setShadow(shadowType !== "variables_get");
            if (!this.isInsertionMarker() && newBlock instanceof Blockly.BlockSvg) {
                newBlock.initSvg();
                newBlock.render();
            }
        } finally {
            Blockly.Events.enable();
        }

        if (newBlock) {
            newBlock.setShadow(true);
            newBlock.outputConnection!.connect(input.connection!);
        }
    },

    buildShadowDom_(this: FunctionCallBlock, argumentType: string): Element {
        const shadowDom = Blockly.utils.xml.createElement("shadow");
        const shadowInfo = getShadowBlockInfoFromType_(argumentType, this.workspace);
        const shadowType = shadowInfo[0];
        const fieldName = shadowInfo[1];
        const fieldValue = shadowInfo[2];
        const isVarGet = shadowType === "variables_get";
        shadowDom.setAttribute("type", shadowType);
        const fieldDom = Blockly.utils.xml.createElement("field");
        fieldDom.textContent = fieldValue;
        if (isVarGet) {
            fieldDom.setAttribute("id", fieldValue);
            const varModel = this.workspace.getVariableById(fieldValue);
            fieldDom.textContent = varModel ? varModel.name : "";
        }
        fieldDom.setAttribute("name", fieldName);
        shadowDom.appendChild(fieldDom);
        return shadowDom;
    },

    onchange(this: FunctionCallBlock, event: Blockly.Events.Abstract): void {
        if (!this.workspace || this.workspace.isFlyout) {
            // Block is deleted or is in a flyout.
            return;
        }
        if (
            event.type == Blockly.Events.BLOCK_CREATE &&
            (event as Blockly.Events.BlockCreate).ids?.indexOf(this.id) != -1
        ) {
            // Check whether there is a matching function definition for this caller.
            const name = this.getName();
            const def = getDefinition(name, this.workspace);
            if (def) {
                // The function definition exists, ensure the signatures match.
                const defArgs = def.getArguments().slice();
                const thisArgs = this.arguments_.slice();
                if (JSON.stringify(thisArgs) !== JSON.stringify(defArgs)) {
                    // The function signature has changed since this block was copied,
                    // update it.
                    mutateCallersAndDefinition(def.getName(), this.workspace, def.mutationToDom());
                }
                // Propagate the functionId of the definition to the caller
                this.functionId_ = def.functionId_;
            } else {
                // There is no function definition for this function, create an empty one
                // that matches the signature of the caller.
                Blockly.Events.setGroup(event.group);
                const xml = Blockly.utils.xml.createElement("xml");
                const block = Blockly.utils.xml.createElement("block");
                block.setAttribute("type", FUNCTION_DEFINITION_BLOCK_TYPE);
                const xy = this.getRelativeToSurfaceXY();
                const x = xy.x + Blockly.config.snapRadius * (this.RTL ? -1 : 1);
                const y = xy.y + Blockly.config.snapRadius * 2;
                block.setAttribute("x", x + "");
                block.setAttribute("y", y + "");
                const mutation = this.mutationToDom();
                block.appendChild(mutation);
                xml.appendChild(block);
                Blockly.Xml.domToWorkspace(xml, this.workspace);
                Blockly.Events.setGroup(false);
            }
        } else if (event.type == Blockly.Events.BLOCK_DELETE) {
            // If the deleted block was the function definition for this caller, delete
            // this caller.
            const name = this.getName();
            const def = getDefinition(name, this.workspace);
            if (!def) {
                Blockly.Events.setGroup(event.group);
                this.dispose(true);
                Blockly.Events.setGroup(false);
            }
        }
    },
};

Blockly.Blocks[FUNCTION_CALL_BLOCK_TYPE] = {
    ...FUNCTION_CALL_MIXIN,
    init: function (this: FunctionCallBlock) {
        this.jsonInit({
            extensions: ["function_contextmenu_edit"],
        });
        /* Data known about the function. */
        this.name_ = ""; // The name of the function.
        this.arguments_ = []; // The arguments of this function.
        this.functionId_ = ""; // An ID, independent from the block ID, to track a function across its call, definition and declaration blocks.

        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(Blockly.Msg[MsgKey.PROCEDURES_HUE]);
        this.setHelpUrl(Blockly.Msg[MsgKey.PROCEDURES_CALLNORETURN_HELPURL]);
        this.setTooltip(Blockly.Msg[MsgKey.FUNCTION_CALL_TOOLTIP]);
        this.setInputsInline(true);
    },
};

Blockly.Blocks[FUNCTION_CALL_OUTPUT_BLOCK_TYPE] = {
    ...FUNCTION_CALL_MIXIN,
    init: function (this: FunctionCallBlock) {
        this.jsonInit({
            extensions: ["function_contextmenu_edit"],
        });
        /* Data known about the function. */
        this.name_ = ""; // The name of the function.
        this.arguments_ = []; // The arguments of this function.
        this.functionId_ = ""; // An ID, independent from the block ID, to track a function across its call, definition and declaration blocks.

        this.setPreviousStatement(false);
        this.setNextStatement(false);
        this.setOutput(true, null);
        this.setOutputShape(new Blockly.zelos.ConstantProvider().SHAPES.ROUND);
        this.setColour(Blockly.Msg[MsgKey.PROCEDURES_HUE]);
        this.setHelpUrl(Blockly.Msg[MsgKey.PROCEDURES_CALLNORETURN_HELPURL]);
        this.setTooltip(Blockly.Msg[MsgKey.FUNCTION_CALL_TOOLTIP]);
        this.setInputsInline(true);
    },
};
