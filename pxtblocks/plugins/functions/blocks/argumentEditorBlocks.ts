import * as Blockly from "blockly";
import {
    ARGUMENT_EDITOR_BOOLEAN_BLOCK_TYPE,
    ARGUMENT_EDITOR_STRING_BLOCK_TYPE,
    ARGUMENT_EDITOR_NUMBER_BLOCK_TYPE,
    ARGUMENT_EDITOR_ARRAY_BLOCK_TYPE,
    ARGUMENT_EDITOR_CUSTOM_BLOCK_TYPE,
} from "../constants";

type ArgumentEditorMixinType = typeof ARGUMENT_EDITOR_MIXIN;

interface ArgumentEditorMixin extends ArgumentEditorMixinType {}

export type ArgumentEditorBlock = Blockly.Block & ArgumentEditorMixin;

const ARGUMENT_EDITOR_MIXIN = {
    typeName_: "",

    getTypeName(this: ArgumentEditorBlock) {
        return this.typeName_;
    },

    removeFieldCallback(this: ArgumentEditorBlock, field: Blockly.Field) {
        const parent = this.getParent() as Partial<ArgumentEditorBlock>;
        if (parent?.removeFieldCallback) {
            (parent as ArgumentEditorBlock).removeFieldCallback(field);
        }
    },
};

Blockly.Blocks[ARGUMENT_EDITOR_BOOLEAN_BLOCK_TYPE] = {
    ...ARGUMENT_EDITOR_MIXIN,
    init: function (this: ArgumentEditorBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_argument_editor",
                    name: "TEXT",
                    text: "bool",
                },
            ],
            extensions: ["output_boolean", "text_field_color"],
        });
        this.typeName_ = "boolean";
    },
};

Blockly.Blocks[ARGUMENT_EDITOR_STRING_BLOCK_TYPE] = {
    ...ARGUMENT_EDITOR_MIXIN,
    init: function (this: ArgumentEditorBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_argument_editor",
                    name: "TEXT",
                    text: "text",
                },
            ],
            extensions: ["output_string", "text_field_color"],
        });
        this.typeName_ = "string";
    },
};

Blockly.Blocks[ARGUMENT_EDITOR_NUMBER_BLOCK_TYPE] = {
    ...ARGUMENT_EDITOR_MIXIN,
    init: function (this: ArgumentEditorBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_argument_editor",
                    name: "TEXT",
                    text: "num",
                },
            ],
            extensions: ["output_number", "text_field_color"],
        });
        this.typeName_ = "number";
    },
};

Blockly.Blocks[ARGUMENT_EDITOR_ARRAY_BLOCK_TYPE] = {
    ...ARGUMENT_EDITOR_MIXIN,
    init: function (this: ArgumentEditorBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_argument_editor",
                    name: "TEXT",
                    text: "list",
                },
            ],
            extensions: ["output_array", "text_field_color"],
        });
        this.typeName_ = "Array";
    },
};

Blockly.Blocks[ARGUMENT_EDITOR_CUSTOM_BLOCK_TYPE] = {
    ...ARGUMENT_EDITOR_MIXIN,
    init: function (this: ArgumentEditorBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_argument_editor",
                    name: "TEXT",
                    text: "arg",
                },
            ],
            outputShape: new Blockly.zelos.ConstantProvider().SHAPES.ROUND,
            extensions: ["text_field_color"],
        });
        this.typeName_ = "any";
    },

    mutationToDom(this: ArgumentEditorBlock) {
        const container = Blockly.utils.xml.createElement("mutation");
        container.setAttribute("typename", this.typeName_);
        return container;
    },

    domToMutation(this: ArgumentEditorBlock, xmlElement: Element) {
        this.typeName_ = xmlElement.getAttribute("typename")!;
        this.setOutput(true, this.typeName_);
    },
};
