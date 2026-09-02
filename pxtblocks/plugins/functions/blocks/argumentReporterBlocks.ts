import * as Blockly from "blockly";
import {
    ARGUMENT_REPORTER_BOOLEAN_BLOCK_TYPE,
    ARGUMENT_REPORTER_STRING_BLOCK_TYPE,
    ARGUMENT_REPORTER_NUMBER_BLOCK_TYPE,
    ARGUMENT_REPORTER_ARRAY_BLOCK_TYPE,
    ARGUMENT_REPORTER_CUSTOM_BLOCK_TYPE,
} from "../constants";
import { MsgKey } from "../msg";
import { setDuplicateOnDragStrategy, updateDuplicateOnDragState } from "../../duplicateOnDrag";

export const LOCALIZATION_NAME_MUTATION_KEY = "localizationname";

type ArgumentReporterMixinType = typeof ARGUMENT_REPORTER_MIXIN;

interface ArgumentReporterMixin extends ArgumentReporterMixinType {}

export type ArgumentReporterBlock = Blockly.BlockSvg & ArgumentReporterMixin;

const ARGUMENT_REPORTER_MIXIN = {
    typeName_: "",
    localizationName_: "",

    getTypeName(this: ArgumentReporterBlock) {
        return this.typeName_;
    },

    getLocalizationName(this: ArgumentReporterBlock) {
        return this.localizationName_ || this.getFieldValue("VALUE");
    },

    mutationToDom(this: ArgumentReporterBlock) {
        const container = Blockly.utils.xml.createElement("mutation");

        if (this.localizationName_) {
            container.setAttribute(LOCALIZATION_NAME_MUTATION_KEY, this.localizationName_);
        }
        return container;
    },

    domToMutation(this: ArgumentReporterBlock, xmlElement: Element) {
        if (xmlElement.hasAttribute(LOCALIZATION_NAME_MUTATION_KEY)) {
            this.localizationName_ = xmlElement.getAttribute(LOCALIZATION_NAME_MUTATION_KEY);
        }
    },
};

Blockly.Blocks[ARGUMENT_REPORTER_BOOLEAN_BLOCK_TYPE] = {
    ...ARGUMENT_REPORTER_MIXIN,
    init: function (this: ArgumentReporterBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_argument_reporter",
                    name: "VALUE",
                    text: "",
                },
            ],
            colour: Blockly.Msg[MsgKey.REPORTERS_HUE],
            extensions: ["output_boolean"],
        });
        this.typeName_ = "boolean";
        initArgumentReporter(this);
    },
};

Blockly.Blocks[ARGUMENT_REPORTER_STRING_BLOCK_TYPE] = {
    ...ARGUMENT_REPORTER_MIXIN,
    init: function (this: ArgumentReporterBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_argument_reporter",
                    name: "VALUE",
                    text: "",
                },
            ],
            colour: Blockly.Msg[MsgKey.REPORTERS_HUE],
            extensions: ["output_string"],
        });
        this.typeName_ = "string";
        initArgumentReporter(this);
    },
};

Blockly.Blocks[ARGUMENT_REPORTER_NUMBER_BLOCK_TYPE] = {
    ...ARGUMENT_REPORTER_MIXIN,
    init: function (this: ArgumentReporterBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_argument_reporter",
                    name: "VALUE",
                    text: "",
                },
            ],
            colour: Blockly.Msg[MsgKey.REPORTERS_HUE],
            extensions: ["output_number"],
        });
        this.typeName_ = "number";
        initArgumentReporter(this);
    },
};

Blockly.Blocks[ARGUMENT_REPORTER_ARRAY_BLOCK_TYPE] = {
    ...ARGUMENT_REPORTER_MIXIN,
    init: function (this: ArgumentReporterBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_argument_reporter",
                    name: "VALUE",
                    text: "",
                },
            ],
            colour: Blockly.Msg[MsgKey.REPORTERS_HUE],
            extensions: ["output_array"],
        });
        this.typeName_ = "Array";
        initArgumentReporter(this);
    },
};

Blockly.Blocks[ARGUMENT_REPORTER_CUSTOM_BLOCK_TYPE] = {
    ...ARGUMENT_REPORTER_MIXIN,
    init: function (this: ArgumentReporterBlock) {
        this.jsonInit({
            message0: " %1",
            args0: [
                {
                    type: "field_argument_reporter",
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
        initArgumentReporter(this);
    },

    mutationToDom(this: ArgumentReporterBlock) {
        const container = ARGUMENT_REPORTER_MIXIN.mutationToDom.call(this);
        container.setAttribute("typename", this.typeName_);
        return container;
    },

    domToMutation(this: ArgumentReporterBlock, xmlElement: Element) {
        this.typeName_ = xmlElement.getAttribute("typename")!;
        this.setOutput(true, this.typeName_);

        ARGUMENT_REPORTER_MIXIN.domToMutation.call(this, xmlElement);
    },
};


function initArgumentReporter(block: ArgumentReporterBlock) {
    setDuplicateOnDragStrategy(block);
    updateDuplicateOnDragState(block);
}