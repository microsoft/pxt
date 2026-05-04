import * as Blockly from "blockly";
import { FieldDropdown } from "../../fields/field_dropdown";
import { ColorPickerBlock, COLOR_PICKER_BLOCK_TYPE } from "./colorPickerBlock";

const COLOR_FORMATS: [string, string][] = [
    ["RGB", "rgb"],
    ["HSL", "hsl"],
    ["HSV", "hsv"],
    ["CMYK", "cmyk"],
    ["Hex", "hex"]
]

export class ColorDropdownField extends FieldDropdown {
    constructor(value: string) {
        super(COLOR_FORMATS);

        this.setValue(value);
    }

    override onItemSelected_(menu: Blockly.Menu, menuItem: Blockly.MenuItem) {
        if (this.sourceBlock_?.type === COLOR_PICKER_BLOCK_TYPE) {
            const colorPicker = this.sourceBlock_ as ColorPickerBlock;
            if (!colorPicker.colorHSVLoaded) {
                colorPicker.readColorFromInputs();
            }
        }

        super.onItemSelected_(menu, menuItem);
    }

    override doValueUpdate_(newValue: string) {
        const prevValue = this.getValue();
        super.doValueUpdate_(newValue);
        if (this.sourceBlock_?.type === COLOR_PICKER_BLOCK_TYPE) {
            const colorPicker = this.sourceBlock_ as ColorPickerBlock;
            colorPicker.setFormat(newValue, prevValue);
        }
    }
}
