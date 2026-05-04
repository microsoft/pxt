import { COLOR_PICKER_BLOCK_TYPE, ColorPickerBlock } from "./colorPickerBlock";
import { FieldColorPickerNumberType } from "./util";

import * as Blockly from "blockly";
import { ColorPickerWidget } from "./colorPickerWidget";


export class FieldColorPickerNumber extends Blockly.FieldNumber {
    private inputKeydownHandler: (e: KeyboardEvent) => {} | undefined;
    protected keyboardControlActive = false;
    protected colorPicker: ColorPickerWidget | undefined;

    constructor(
        value?: string | number | typeof Blockly.Field.SKIP_SETUP,
        type: FieldColorPickerNumberType = FieldColorPickerNumberType.Degrees,
    ) {
        super(value, 0, getMaxForType(type));
    }

    getFieldDescription(): string {
        return this.getValue() + "";
    }

    setType(type: FieldColorPickerNumberType) {
        this.setMax(getMaxForType(type));
    }

    protected widgetDispose_(): void {
        this.removeEventListeners();
        super.widgetDispose_();
    }

    private addEventListeners() {
        this.inputKeydownHandler = this.inputKeydownListener.bind(this);
        this.htmlInput_.addEventListener("keydown", this.inputKeydownHandler);
        this.htmlInput_.addEventListener("keyup", this.inputKeyupListener);
    }

    private removeEventListeners() {
        this.htmlInput_.removeEventListener("keydown", this.inputKeydownHandler);
        this.htmlInput_.removeEventListener("keyup", this.inputKeyupListener);
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

    private inputKeyupListener = (e: KeyboardEvent) => {
        const colorPickerBlock = this.sourceBlock_?.getParent() as ColorPickerBlock;
        const newValue = Math.max(0, Math.min(this.max_, parseInt(this.htmlInput_.value)));

        if (!Number.isNaN(newValue)) {
            if (colorPickerBlock?.type === COLOR_PICKER_BLOCK_TYPE && this.colorPicker) {
                const channel = parseInt(this.sourceBlock_.outputConnection.targetConnection.getParentInput().name.slice(-1));

                colorPickerBlock.setColorHSV(this.colorPicker.updateColorChannel(colorPickerBlock.format, channel, newValue));
            }
        }
    }

    protected showEditor_(_e?: Event, quietInput?: boolean): void {
        // Align with Blockly's approach in https://github.com/google/blockly-samples/blob/master/plugins/field-slider/src/field_slider.ts
        // Always quiet the input for the super constructor, as we don't want to
        // focus on the text field, and we don't want to display the modal
        // editor on mobile devices.
        super.showEditor_(_e, true);

        if (typeof this.min_ === "number" && typeof this.max_ === "number") {
            this.htmlInput_.ariaLabel = lf("Enter a value between {0} and {1}", this.min_, this.max_);
        }

        Blockly.DropDownDiv.hideWithoutAnimation();
        Blockly.DropDownDiv.clearContent();
        Blockly.DropDownDiv.getContentDiv().style.height = "";

        const contentDiv = Blockly.DropDownDiv.getContentDiv();

        // Accessibility properties
        contentDiv.setAttribute('role', 'menu');
        contentDiv.setAttribute('aria-haspopup', 'true');

        const colorPickerBlock = this.sourceBlock_?.getParent() as ColorPickerBlock;

        let coorHSV = [0, 0, 0];

        if (colorPickerBlock?.type === COLOR_PICKER_BLOCK_TYPE) {
            coorHSV = colorPickerBlock.colorHSV;
        }

        this.colorPicker = new ColorPickerWidget(
            active => { this.keyboardControlActive = active; },
            () => this.keyboardControlActive,
            () => { if (this.htmlInput_) this.htmlInput_.focus(); },
            hsv => this.onColorChanged(hsv),
        );

        this.colorPicker.createDom(contentDiv, coorHSV);

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

function getMaxForType(type: FieldColorPickerNumberType) {
    switch (type) {
        case FieldColorPickerNumberType.Degrees:
            return 360;
        case FieldColorPickerNumberType.Percentage:
            return 100;
        case FieldColorPickerNumberType.RGB:
            return 255;
    }
}