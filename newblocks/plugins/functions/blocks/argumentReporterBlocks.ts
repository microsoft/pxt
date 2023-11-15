import * as Blockly from "blockly/core";
import {
    ARGUMENT_REPORTER_BOOLEAN_BLOCK_TYPE,
    ARGUMENT_REPORTER_STRING_BLOCK_TYPE,
    ARGUMENT_REPORTER_NUMBER_BLOCK_TYPE,
    ARGUMENT_REPORTER_ARRAY_BLOCK_TYPE,
    ARGUMENT_REPORTER_CUSTOM_BLOCK_TYPE,
} from "../constants";
import { MsgKey } from "../msg";

type ArgumentReporterMixinType = typeof ARGUMENT_REPORTER_MIXIN;

interface ArgumentReporterMixin extends ArgumentReporterMixinType {}

export type ArgumentReporterBlock = Blockly.Block & ArgumentReporterMixin;

const ARGUMENT_REPORTER_MIXIN = {
    typeName_: "",

    getTypeName(this: ArgumentReporterBlock) {
        return this.typeName_;
    },
};

Blockly.Blocks[ARGUMENT_REPORTER_BOOLEAN_BLOCK_TYPE] = {
    ...ARGUMENT_REPORTER_MIXIN,
    init: function (this: ArgumentReporterBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_label_serializable",
                    name: "VALUE",
                    text: "",
                },
            ],
            colour: Blockly.Msg[MsgKey.REPORTERS_HUE],
            extensions: ["output_boolean"],
        });
        this.typeName_ = "boolean";
    },
};

Blockly.Blocks[ARGUMENT_REPORTER_STRING_BLOCK_TYPE] = {
    ...ARGUMENT_REPORTER_MIXIN,
    init: function (this: ArgumentReporterBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_label_serializable",
                    name: "VALUE",
                    text: "",
                },
            ],
            colour: Blockly.Msg[MsgKey.REPORTERS_HUE],
            extensions: ["output_string"],
        });
        this.typeName_ = "string";
    },
};

Blockly.Blocks[ARGUMENT_REPORTER_NUMBER_BLOCK_TYPE] = {
    ...ARGUMENT_REPORTER_MIXIN,
    init: function (this: ArgumentReporterBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_label_serializable",
                    name: "VALUE",
                    text: "",
                },
            ],
            colour: Blockly.Msg[MsgKey.REPORTERS_HUE],
            extensions: ["output_number"],
        });
        this.typeName_ = "number";
    },
};

Blockly.Blocks[ARGUMENT_REPORTER_ARRAY_BLOCK_TYPE] = {
    ...ARGUMENT_REPORTER_MIXIN,
    init: function (this: ArgumentReporterBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_label_serializable",
                    name: "VALUE",
                    text: "",
                },
            ],
            colour: Blockly.Msg[MsgKey.REPORTERS_HUE],
            extensions: ["output_array"],
        });
        this.typeName_ = "Array";
    },
};

Blockly.Blocks[ARGUMENT_REPORTER_CUSTOM_BLOCK_TYPE] = {
    ...ARGUMENT_REPORTER_MIXIN,
    init: function (this: ArgumentReporterBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_label_serializable",
                    name: "VALUE",
                    text: "",
                },
            ],
            colour: Blockly.Msg[MsgKey.REPORTERS_HUE],
            inputsInline: true,
            outputShape: new Blockly.zelos.ConstantProvider().SHAPES.ROUND,
            output: null,
        });
        this.typeName_ = "";
    },

    mutationToDom(this: ArgumentReporterBlock) {
        const container = Blockly.utils.xml.createElement("mutation");
        container.setAttribute("typename", this.typeName_);
        return container;
    },

    domToMutation(this: ArgumentReporterBlock, xmlElement: Element) {
        this.typeName_ = xmlElement.getAttribute("typename")!;
        this.setOutput(true, this.typeName_);
    },
};
