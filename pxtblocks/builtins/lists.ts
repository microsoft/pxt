/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly"
import { installBuiltinHelpInfo, setBuiltinHelpInfo } from "../help";
import { provider } from "../constants";

export function initLists() {
    const msg = Blockly.Msg;

    // lists_create_with
    const listsCreateWithId = "lists_create_with";
    const listsCreateWithDef = pxt.blocks.getBlockDefinition(listsCreateWithId);
    msg.LISTS_CREATE_EMPTY_TITLE = listsCreateWithDef.block["LISTS_CREATE_EMPTY_TITLE"];
    msg.LISTS_CREATE_WITH_INPUT_WITH = listsCreateWithDef.block["LISTS_CREATE_WITH_INPUT_WITH"];
    msg.LISTS_CREATE_WITH_CONTAINER_TITLE_ADD = listsCreateWithDef.block["LISTS_CREATE_WITH_CONTAINER_TITLE_ADD"];
    msg.LISTS_CREATE_WITH_ITEM_TITLE = listsCreateWithDef.block["LISTS_CREATE_WITH_ITEM_TITLE"];
    installBuiltinHelpInfo(listsCreateWithId);

    // lists_length
    const listsLengthId = "lists_length";
    const listsLengthDef = pxt.blocks.getBlockDefinition(listsLengthId);
    msg.LISTS_LENGTH_TITLE = listsLengthDef.block["LISTS_LENGTH_TITLE"];

    // We have to override this block definition because the builtin block
    // allows both Strings and Arrays in its input check and that confuses
    // our Blockly compiler
    let block = Blockly.Blocks[listsLengthId];
    block.init = function () {
        this.jsonInit({
            "message0": msg.LISTS_LENGTH_TITLE,
            "args0": [
                {
                    "type": "input_value",
                    "name": "VALUE",
                    "check": ['Array']
                }
            ],
            "output": 'Number',
            "outputShape": provider.SHAPES.ROUND
        });
    }

    installBuiltinHelpInfo(listsLengthId);

    // lists_index_get
    const listsIndexGetId = "lists_index_get";
    const listsIndexGetDef = pxt.blocks.getBlockDefinition(listsIndexGetId);
    Blockly.Blocks["lists_index_get"] = {
        init: function () {
            this.jsonInit({
                "message0": listsIndexGetDef.block["message0"],
                "args0": [
                    {
                        "type": "input_value",
                        "name": "LIST",
                        "check": "Array"
                    },
                    {
                        "type": "input_value",
                        "name": "INDEX",
                        "check": "Number"
                    }
                ],
                "colour": pxt.toolbox.blockColors['arrays'],
                "outputShape": provider.SHAPES.ROUND,
                "inputsInline": true
            });

            this.setPreviousStatement(false);
            this.setNextStatement(false);
            this.setOutput(true);
            setBuiltinHelpInfo(this, listsIndexGetId);
        }
    };

    // lists_index_set
    const listsIndexSetId = "lists_index_set";
    const listsIndexSetDef = pxt.blocks.getBlockDefinition(listsIndexSetId);
    Blockly.Blocks[listsIndexSetId] = {
        init: function () {
            this.jsonInit({
                "message0": listsIndexSetDef.block["message0"],
                "args0": [
                    {
                        "type": "input_value",
                        "name": "LIST",
                        "check": "Array"
                    },
                    {
                        "type": "input_value",
                        "name": "INDEX",
                        "check": "Number"
                    },
                    {
                        "type": "input_value",
                        "name": "VALUE",
                        "check": null
                    }
                ],
                "previousStatement": null,
                "nextStatement": null,
                "colour": pxt.toolbox.blockColors['arrays'],
                "inputsInline": true
            });
            setBuiltinHelpInfo(this, listsIndexSetId);
        }
    };
}