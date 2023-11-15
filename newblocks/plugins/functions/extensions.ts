import * as Blockly from "blockly/core";
import { getDefinition } from "./utils";
import { MsgKey } from "./msg";

const provider = new Blockly.zelos.ConstantProvider();

function outputNumber(this: Blockly.Block) {
    this.setInputsInline(true);
    this.setOutputShape(provider.SHAPES.ROUND);
    this.setOutput(true, "Number");
}

function outputString(this: Blockly.Block) {
    this.setInputsInline(true);
    this.setOutputShape(provider.SHAPES.ROUND);
    this.setOutput(true, "String");
}

function outputBoolean(this: Blockly.Block) {
    this.setInputsInline(true);
    this.setOutputShape(provider.SHAPES.HEXAGONAL);
    this.setOutput(true, "Boolean");
}

function outputArray(this: Blockly.Block) {
    this.setInputsInline(true);
    this.setOutputShape(provider.SHAPES.ROUND);
    this.setOutput(true, "Array");
}

function textFieldColor(this: Blockly.Block) {
    if (this.workspace instanceof Blockly.WorkspaceSvg) {
        const constants = this.workspace.getRenderer().getConstants();

        this.setColour(constants.FIELD_BORDER_RECT_COLOUR);
    } else {
        this.setColour("#fff");
    }
}

const contextMenuEdit = {
    customContextMenu: function (this: Blockly.Block, menuOptions: any[]) {
        const gtdOption = {
            enabled: true, // FIXME: !this.inDebugWorkspace(),
            text: Blockly.Msg[MsgKey.FUNCTIONS_GO_TO_DEFINITION_OPTION],
            callback: () => {
                const functionName = this.getField("function_name")!.getText();
                const definition = getDefinition(functionName, this.workspace);
                if (definition && this.workspace instanceof Blockly.WorkspaceSvg)
                    this.workspace.centerOnBlock(definition.id);
            },
        };
        menuOptions.push(gtdOption);
    },
};

// pxt-blockly: Register functions-related extensions
Blockly.Extensions.registerMixin("function_contextmenu_edit", contextMenuEdit);
Blockly.Extensions.register("output_number", outputNumber);
Blockly.Extensions.register("output_string", outputString);
Blockly.Extensions.register("output_boolean", outputBoolean);
Blockly.Extensions.register("output_array", outputArray);
Blockly.Extensions.register("text_field_color", textFieldColor);
