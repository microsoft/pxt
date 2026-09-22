import * as Blockly from "blockly";
import { ColorDropdownField } from "./colorPickerDropdown";
import { ColorPickerNumberBlock, COLOR_NUMBER_BLOCK_TYPE, generateColorPickerNumberShadowDom } from "./colorPickerNumberBlock";
import { COLOR_STRING_BLOCK_TYPE, generateColorPickerStringShadowDom } from "./colorPickerStringBlock";
import { FieldColorPickerNumberType, fromFormatToHex, fromFormatToHSV, fromHexToFormat, fromHSVToFormat, getFieldTypesForFormat } from "./util";

export interface ColorPickerBlock extends Blockly.Block {
    colorHSVLoaded: boolean;
    colorHSV: number[];
    updateShape: (format: string) => void;
    setColorHSV: (hsv: number[]) => void;
    setFormat: (format: string, prevFormat?: string) => void;
    readColorFromInputs: () => void;
    updateColorPreview: () => void;
}

const HEX_INPUT_NAME = "HEX_INPUT";

export const COLOR_PICKER_BLOCK_TYPE = "makecode_color_picker";


export function initColorPickerBlock() {
    Blockly.Blocks[COLOR_PICKER_BLOCK_TYPE] = {
        // store the color as HSV because converting to RGB causes us to lose
        // the hue value for some colors (e.g. grayscale colors)
        colorHSVLoaded: false,
        colorHSV: [0, 0, 0],

        init: function (this: ColorPickerBlock) {
            this.setOutput(true, "Number");
            this.setColour(Blockly.Msg["COLOUR_HUE"] || 20);
            this.setInputsInline(true);

            this.appendDummyInput()
                .appendField(new Blockly.FieldImage(previewImage(), 24, 24, lf("Choose color"), () => {
                    const inputs = [HEX_INPUT_NAME, "INPUT0", "INPUT1", "INPUT2", "INPUT3"];
                    for (const input of inputs) {
                        const child = this.getInputTargetBlock(input);
                        if (child?.type === COLOR_STRING_BLOCK_TYPE || child?.type === COLOR_NUMBER_BLOCK_TYPE) {
                            this.readColorFromInputs();
                            child.getField(input === HEX_INPUT_NAME ? "TEXT" : "NUM").showEditor();
                            return;
                        }
                    }
                }), "PREVIEW")
                .appendField(new ColorDropdownField("rgb"), "FORMAT");

            this.updateShape(this.getFieldValue("FORMAT"));
            this.setColorHSV(this.colorHSV);
            this.setOnChange((event: Blockly.Events.BlockBase) => {
                if (event.type !== Blockly.Events.BLOCK_CHANGE && event.type !== Blockly.Events.BLOCK_MOVE
                    && event.type !== Blockly.Events.BLOCK_CREATE) return;
                const moved = event as Blockly.Events.BlockMove;
                if (event.blockId === this.id || moved.oldParentId === this.id || moved.newParentId === this.id
                    || this.getChildren(false).some(child => child.id === event.blockId)) {
                    this.updateColorPreview();
                }
            });
        },

        updateColorPreview: function (this: ColorPickerBlock) {
            const preview = this.getField("PREVIEW") as Blockly.FieldImage;
            const color = getColorPickerColor(this);
            // This is derived UI, not an edit: don't add history or invalidate redo.
            Blockly.Events.disable();
            try {
                preview.setValue(previewImage(color));
                preview.setAlt(color ? lf("Color {0}. Choose color", color) : lf("Color depends on input values"));
            }
            finally {
                Blockly.Events.enable();
            }
        },

        domToMutation: function (this: ColorPickerBlock, xmlElement: Element) {
            if (xmlElement.hasAttribute("hue") && xmlElement.hasAttribute("saturation") && xmlElement.hasAttribute("value")) {
                this.colorHSVLoaded = true;
                this.colorHSV = [
                    parseFloat(xmlElement.getAttribute("hue")) || 0,
                    parseFloat(xmlElement.getAttribute("saturation")) || 0,
                    parseFloat(xmlElement.getAttribute("value")) || 0
                ];

                this.setFormat(this.getFieldValue("FORMAT"));
            }

            if (xmlElement.hasAttribute("color")) {
                const color = xmlElement.getAttribute("color");
                if (color) {
                    this.setColour(color);
                }
            }
        },

        mutationToDom: function () {
            const container = document.createElement("mutation");
            if (this.colorHSVLoaded) {
                container.setAttribute("hue", this.colorHSV[0].toString());
                container.setAttribute("saturation", this.colorHSV[1].toString());
                container.setAttribute("value", this.colorHSV[2].toString());
            }
            container.setAttribute("color", this.getColour());

            return container;
        },

        updateShape: function (this: ColorPickerBlock, format: string) {
            let numericalInputs: FieldColorPickerNumberType[] = [];
            const hexInput = this.getInput(HEX_INPUT_NAME);

            if (format === "hex") {
                if (!hexInput) {
                    this.appendValueInput(HEX_INPUT_NAME)
                        .setCheck("String")
                        .setShadowDom(generateColorPickerStringShadowDom(fromFormatToHex("hsv", this.colorHSV)))
                }
            }
            else {
                if (hexInput) {
                    const target = hexInput.connection.targetBlock();
                    if (target?.isShadow()) {
                        target.dispose();
                    }
                    else {
                        target?.unplug();
                    }
                    this.removeInput(HEX_INPUT_NAME);
                }

                numericalInputs = getFieldTypesForFormat(format);
            }

            for (let i = 0; i < 4; i++) {
                const existing = this.getInput("INPUT" + i);
                const shouldRemove = i >= numericalInputs.length;
                const format = numericalInputs[i];

                if (existing) {
                    const target = existing.connection.targetBlock();

                    if (shouldRemove) {
                        if (target?.isShadow()) {
                            target.dispose();
                        }
                        else {
                            target?.unplug();
                        }

                        this.removeInput(existing.name);
                    }
                    else if (target) {
                        if (target.type === COLOR_NUMBER_BLOCK_TYPE) {
                            (target as ColorPickerNumberBlock).setFormat(format);
                        }
                    }
                    else {
                        existing.connection.setShadowDom(generateColorPickerNumberShadowDom(format, 0));
                    }
                }
                else if (shouldRemove) {
                    continue;
                }
                else {
                    this.appendValueInput("INPUT" + i)
                        .setCheck("Number")
                        .setShadowDom(generateColorPickerNumberShadowDom(format, 0));
                }
            }
        },

        setColorHSV: function (this: ColorPickerBlock, hsv: number[]) {
            this.colorHSV = hsv;
            if (this.getFieldValue("FORMAT") === "hex") {
                const color = fromFormatToHex("hsv", hsv);

                const hexInput = this.getInput(HEX_INPUT_NAME);
                const target = hexInput?.connection.targetBlock();

                if (target?.type === "text" || target?.type === COLOR_STRING_BLOCK_TYPE) {
                    const field = target.getField("TEXT");
                    field.setValue(color);
                }
                this.updateColorPreview();
                return;
            }

            const values = fromHSVToFormat(this.getFieldValue("FORMAT"), hsv);

            for (let i = 0; i < values.length; i++) {
                const input = this.getInput("INPUT" + i);
                const target = input?.connection.targetBlock();

                if (target?.type === COLOR_NUMBER_BLOCK_TYPE) {
                    const field = target.getField("NUM");
                    field.setValue(Math.round(values[i]).toString());
                }
            }

            this.updateColorPreview();
        },

        setFormat: function (this: ColorPickerBlock, format: string, prevFormat = format) {
            const hsv = this.colorHSV;
            if (format !== prevFormat) {
                this.updateShape(format);

                const field = this.getField("FORMAT") as ColorDropdownField;

                if (field.getValue() !== format) {
                    field.setValue(format);
                }

                this.setColorHSV(hsv);
            }
        },

        readColorFromInputs: function (this: ColorPickerBlock) {
            this.colorHSVLoaded = true;
            if (this.getFieldValue("FORMAT") === "hex") {
                // TODO: verify the target is a color picker string
                const hexInput = this.getInput(HEX_INPUT_NAME);
                const target = hexInput?.connection.targetBlock();

                if (target?.type === "text" || target?.type === COLOR_STRING_BLOCK_TYPE) {
                    const hex = target.getField("TEXT").getValue();
                    this.colorHSV = fromHexToFormat("hsv", hex);
                }
                return;
            }

            const currentValues = fromHSVToFormat(this.getFieldValue("FORMAT"), this.colorHSV);
            const newValues: number[] = [];

            for (let i = 0; i < currentValues.length; i++) {
                const input = this.getInput("INPUT" + i);
                const target = input?.connection.targetBlock();

                if (target?.type === COLOR_NUMBER_BLOCK_TYPE) {
                    const field = target.getField("NUM");
                    newValues.push(parseFloat(field.getValue()));
                }
                else {
                    newValues.push(currentValues[i]);
                }
            }

            this.colorHSV = fromFormatToHSV(this.getFieldValue("FORMAT"), newValues);
        }
    }
}

/** Evaluate literal inputs only; never guess a runtime value for variables or expressions. */
export function getColorPickerColor(block: Blockly.Block): string | undefined {
    const format = block.getFieldValue("FORMAT");
    if (format === "hex") {
        const child = block.getInputTargetBlock(HEX_INPUT_NAME);
        if (child?.type !== COLOR_STRING_BLOCK_TYPE && child?.type !== "text") return undefined;
        const hex = child.getFieldValue("TEXT");
        return /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)
            ? fromFormatToHex("hsv", fromHexToFormat("hsv", hex)) : undefined;
    }
    const values: number[] = [];
    for (let i = 0; i < getFieldTypesForFormat(format).length; i++) {
        const child = block.getInputTargetBlock("INPUT" + i);
        if (child?.type !== COLOR_NUMBER_BLOCK_TYPE && child?.type !== "math_number") return undefined;
        const value = Number(child.getFieldValue("NUM"));
        if (!Number.isFinite(value)) return undefined;
        values.push(value);
    }
    return fromFormatToHex(format, values);
}

function previewImage(color?: string): string {
    const content = color
        ? `<rect x="1" y="1" width="22" height="22" fill="${color}" stroke="white"/><rect x="2" y="2" width="20" height="20" fill="none" stroke="black"/>`
        : '<rect x="1" y="1" width="22" height="22" fill="white" stroke="black"/><text x="12" y="18" text-anchor="middle" font-size="18" fill="black">?</text>';
    return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">${content}</svg>`);
}