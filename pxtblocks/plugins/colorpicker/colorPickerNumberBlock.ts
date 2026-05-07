import * as Blockly from "blockly";
import { FieldColorPickerNumber } from "./colorPickerNumberField";
import { FieldColorPickerNumberType } from "./util";

export const COLOR_NUMBER_BLOCK_TYPE = "makecode_color_picker_number";

export interface ColorPickerNumberBlock extends Blockly.Block {
    format: FieldColorPickerNumberType;
    setFormat: (format: FieldColorPickerNumberType) => void;
}

export function initColorPickerNumberBlock() {
    Blockly.Blocks[COLOR_NUMBER_BLOCK_TYPE] = {
        format: FieldColorPickerNumberType.Degrees,
        init: function () {
            this.appendDummyInput()
                .appendField(new FieldColorPickerNumber(0, FieldColorPickerNumberType.Degrees), "NUM");
            this.setOutput(true, "Number");
            this.setColour(Blockly.Msg["COLOUR_HUE"] || 20);
        },
        domToMutation: function (this: ColorPickerNumberBlock, xmlElement: Element) {
            const format = parseInt(xmlElement.getAttribute("format"));

            this.setFormat(format);
        },
        mutationToDom: function (this: ColorPickerNumberBlock) {
            const container = document.createElement("mutation");
            container.setAttribute("format", this.format.toString());
            return container;
        },
        setFormat: function (this: ColorPickerNumberBlock, format: FieldColorPickerNumberType) {
            if (format !== this.format) {
                this.format = format;
                const field = this.getField("NUM") as FieldColorPickerNumber;
                field.setType(format);
            }
        }
    }
}

export function generateColorPickerNumberShadowDom(format: FieldColorPickerNumberType, value: number) {
    const container = document.createElement("shadow");
    container.setAttribute("type", COLOR_NUMBER_BLOCK_TYPE);

    const mutation = document.createElement("mutation");
    mutation.setAttribute("format", format.toString());
    container.appendChild(mutation);

    const fieldValue = document.createElement("field");
    fieldValue.setAttribute("name", "NUM");
    fieldValue.textContent = value.toString();
    container.appendChild(fieldValue);

    return container;
}