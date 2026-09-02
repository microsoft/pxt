import * as Blockly from "blockly";
import { FieldColorPickerString } from "./colorPickerStringField";
import { FieldColorPickerNumberType } from "./util";

export const COLOR_STRING_BLOCK_TYPE = "makecode_color_picker_string";

export interface ColorPickerStringBlock extends Blockly.Block {
}

export function initColorPickerStringBlock() {
    Blockly.Blocks[COLOR_STRING_BLOCK_TYPE] = {
        format: FieldColorPickerNumberType.Degrees,
        init: function () {
            this.appendDummyInput()
                .appendField(new FieldColorPickerString(), "TEXT");
            this.setOutput(true, "String");
            this.setColour(Blockly.Msg["COLOUR_HUE"] || 20);
        }
    }
}

export function generateColorPickerStringShadowDom(value: string) {
    const container = document.createElement("shadow");
    container.setAttribute("type", COLOR_STRING_BLOCK_TYPE);

    const fieldValue = document.createElement("field");
    fieldValue.setAttribute("name", "TEXT");
    fieldValue.textContent = value.toString();
    container.appendChild(fieldValue);

    return container;
}