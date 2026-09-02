import { FieldString } from "../text/fieldString";

import * as Blockly from "blockly";
import { ColorPickerWidget } from "./colorPickerWidget";
import { COLOR_PICKER_BLOCK_TYPE, ColorPickerBlock } from "./colorPickerBlock";


export class FieldColorPickerString extends FieldString {
    private inputKeydownHandler: (e: KeyboardEvent) => {} | undefined;
    protected keyboardControlActive = false;
    protected colorPicker: ColorPickerWidget | undefined;

    protected widgetDispose_(): void {
        this.removeEventListeners();
        super.widgetDispose_();
    }

    private addEventListeners() {
        this.inputKeydownHandler = this.inputKeydownListener.bind(this);
        this.htmlInput_.addEventListener("keydown", this.inputKeydownHandler);
    }

    private removeEventListeners() {
        this.htmlInput_.removeEventListener("keydown", this.inputKeydownHandler);
        this.colorPicker?.dispose();
        this.colorPicker = undefined;
    }

    private inputKeydownListener(e: KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            this.keyboardControlActive = true;
            if (this.colorPicker) {
                this.colorPicker.focusSlider();
            }
        }
    }

    protected showEditor_(_e?: Event, quietInput?: boolean): void {
        // Align with Blockly's approach in https://github.com/google/blockly-samples/blob/master/plugins/field-slider/src/field_slider.ts
        // Always quiet the input for the super constructor, as we don't want to
        // focus on the text field, and we don't want to display the modal
        // editor on mobile devices.
        super.showEditor_(_e, true);

        Blockly.DropDownDiv.hideWithoutAnimation();
        Blockly.DropDownDiv.clearContent();
        Blockly.DropDownDiv.getContentDiv().style.height = "";

        const contentDiv = Blockly.DropDownDiv.getContentDiv();

        // Accessibility properties
        contentDiv.setAttribute('role', 'menu');
        contentDiv.setAttribute('aria-haspopup', 'true');

        const colorPickerBlock = this.sourceBlock_?.getParent() as ColorPickerBlock;

        let colorHSV = [0, 0, 0];

        if (colorPickerBlock?.type === COLOR_PICKER_BLOCK_TYPE) {
            colorHSV = colorPickerBlock.colorHSV;
        }

        this.colorPicker = new ColorPickerWidget(
            active => { this.keyboardControlActive = active; },
            () => this.keyboardControlActive,
            () => { if (this.htmlInput_) this.htmlInput_.focus(); },
            hsv => this.onColorChanged(hsv),
        );

        this.colorPicker.createDom(contentDiv, colorHSV);

        // Set colour and size of drop-down
        const positionBlock = colorPickerBlock || this.sourceBlock_;
        Blockly.DropDownDiv.setColour('#ffffff', '#dddddd');
        Blockly.DropDownDiv.showPositionedByBlock(this, positionBlock as Blockly.BlockSvg, undefined, undefined, false);

        this.addEventListeners();

        if (!quietInput) {
            this.htmlInput_.focus();
            this.htmlInput_.select();
        }
    }

    protected onColorChanged(hsv: number[]) {
        const parent = this.sourceBlock_?.getParent() as ColorPickerBlock | undefined;

        if (parent?.type !== COLOR_PICKER_BLOCK_TYPE) {
            return;
        }

        parent.setColorHSV(hsv);

        if (this.htmlInput_) {
            this.htmlInput_.value = this.getValue() + "";
        }
    }
}
