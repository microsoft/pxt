import * as Blockly from "blockly";
import { installHelpResources, installBuiltinHelpInfo } from "../help";
import { provider } from "../constants";

export function initText() {
    // builtin text
    const textInfo = pxt.blocks.getBlockDefinition('text');
    installHelpResources('text', textInfo.name, textInfo.tooltip, textInfo.url,
        (Blockly as any).Colours.textField,
        (Blockly as any).Colours.textField,
        (Blockly as any).Colours.textField);

    // builtin text_length66tyyy
    const textLengthId = "text_length";
    const textLengthDef = pxt.blocks.getBlockDefinition(textLengthId);
    Blockly.Msg.TEXT_LENGTH_TITLE = textLengthDef.block["TEXT_LENGTH_TITLE"];

    // We have to override this block definition because the builtin block
    // allows both Strings and Arrays in its input check and that confuses
    // our Blockly compiler
    let block = Blockly.Blocks[textLengthId];
    block.init = function () {
        this.jsonInit({
            "message0": Blockly.Msg.TEXT_LENGTH_TITLE,
            "args0": [
                {
                    "type": "input_value",
                    "name": "VALUE",
                    "check": ['String']
                }
            ],
            "output": 'Number',
            "outputShape": provider.SHAPES.ROUND
        });
    }
    installBuiltinHelpInfo(textLengthId);

    // builtin text_join
    const textJoinId = "text_join";
    const textJoinDef = pxt.blocks.getBlockDefinition(textJoinId);
    Blockly.Msg.TEXT_JOIN_TITLE_CREATEWITH = textJoinDef.block["TEXT_JOIN_TITLE_CREATEWITH"];
    installBuiltinHelpInfo(textJoinId);
}