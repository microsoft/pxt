/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Colour input field.
 */

import {
    FieldGridDropdown
} from '@blockly/field-grid-dropdown';
import * as Blockly from 'blockly/core';
import { FieldCustom, FieldCustomOptions } from './field_utils';

/**
 * The value modes:
 *     hex - Outputs an HTML color string: "#ffffff" (with quotes)
 *     rgb - Outputs an RGB number in hex: 0xffffff
 *     index - Outputs the index of the color in the list of colors: 0
 */
export type FieldColourValueMode = "hex" | "rgb" | "index";

export interface FieldColourNumberOptions extends FieldCustomOptions {
    colours?: string; // parsed as a JSON array
    columns?: string; // parsed as a number
    className?: string;
    valueMode?: FieldColourValueMode;
}

/**
 * Similar to Blockly's field_colour but with support for different colour
 * formats.
 */
export class FieldColorNumber extends FieldGridDropdown implements FieldCustom {

    isFieldCustom_ = true;

    /**
     * Used to tell if the field needs to be rendered the next time the block is
     * rendered.  Colour fields are statically sized, and only need to be
     * rendered at initialization.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    protected override isDirty_ = false;

    private allColoursCSSFormat_: string[];
    private valueMode_: FieldColourValueMode;

    constructor(text: string, params: FieldColourNumberOptions, opt_validator?: Blockly.FieldValidator) {
        let allColoursCSSFormat: string[];
        let titles: string[] | undefined;
        const valueMode = params.valueMode ?? "rgb";
        // TOOD: replace with a logical value and render checkerboard-style.
        const transparentPlaceholderValue = "#dedede";
        if (params.colours) {
            allColoursCSSFormat = JSON.parse(params.colours);
            // Assume the first colour represents transparent if it's present elsewhere.
            if (allColoursCSSFormat.lastIndexOf(allColoursCSSFormat[0]) > 0) {
                allColoursCSSFormat[0] = transparentPlaceholderValue;
            }
        }
        else if (pxt.appTarget.runtime && pxt.appTarget.runtime.palette) {
            allColoursCSSFormat = pxt.Util.clone(pxt.appTarget.runtime.palette);
            allColoursCSSFormat[0] = transparentPlaceholderValue;
            if (pxt.appTarget.runtime.paletteNames) {
                titles = pxt.Util.clone(pxt.appTarget.runtime.paletteNames);
                titles[0] = lf("transparent");
            }
        }
        super(makeSwatches(allColoursCSSFormat, titles), opt_validator, {
            primaryColour: "white",
            borderColour: "#dadce0",
            columns: !!params.columns ? parseInt(params.columns) : 7
        });

        this.allColoursCSSFormat_ = allColoursCSSFormat;
        this.valueMode_ = valueMode;
        this.setValue(text);
    }

    /**
     * FieldDropdown has complex behaviors for normalizing options that aren't
     * applicable here. Instead, just return the options as-is.
     *
     * @param options The options (colour swatches) to normalize.
     * @returns The colour swatches as-is.
     */
    protected override trimOptions(options: Blockly.MenuOption[]) {
        return { options };
    }

    /**
     * Create the block UI for this colour field.
     *
     * @internal
     */
    override initView() {
        const constants = this.getConstants();
        // This can't happen, but TypeScript thinks it can and lint forbids `!.`.
        if (!constants) throw Error('Constants not found');
        this.size_ = new Blockly.utils.Size(
            constants.FIELD_COLOUR_DEFAULT_WIDTH,
            constants.FIELD_COLOUR_DEFAULT_HEIGHT,
        );
        this.createBorderRect_();
        this.getBorderRect().style['fillOpacity'] = '1';
        this.getBorderRect().setAttribute('stroke', '#fff');
        if (this.isFullBlockField()) {
            this.clickTarget_ = (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot();
        }
    }

    /**
     * Shows the colour picker dropdown attached to the field.
     *
     * @param e The event that triggered display of the colour picker dropdown.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    protected override showEditor_(e?: MouseEvent) {
        super.showEditor_(e);
        Blockly.DropDownDiv.getContentDiv().classList.add('blocklyFieldColour');
        Blockly.DropDownDiv.repositionForWindowResize();
    }

    /**
     * Defines whether this field should take up the full block or not.
     *
     * @returns True if this field should take up the full block. False otherwise.
     */
    override isFullBlockField(): boolean {
        const block = this.getSourceBlock();
        if (!block) throw new Blockly.UnattachedFieldError();

        const constants = this.getConstants();
        return (
            this.blockIsSimpleReporter() &&
            Boolean(constants?.FIELD_COLOUR_FULL_BLOCK)
        );
    }

    /**
     * @returns True if the source block is a value block with a single editable
     *     field.
     * @internal
     */
    blockIsSimpleReporter(): boolean {
        const block = this.getSourceBlock();
        if (!block) throw new Blockly.UnattachedFieldError();

        if (!block.outputConnection) return false;

        for (const input of block.inputList) {
            if (input.connection || input.fieldRow.length > 1) return false;
        }
        return true;
    }

    /**
     * Updates text field to match the colour/style of the block.
     *
     * @internal
     */
    override applyColour() {
        const block = this.getSourceBlock() as Blockly.BlockSvg | null;
        if (!block) throw new Blockly.UnattachedFieldError();

        if (!this.fieldGroup_) return;

        const borderRect = this.borderRect_;
        if (!borderRect) {
            throw new Error('The border rect has not been initialized');
        }

        if (!this.isFullBlockField()) {
            borderRect.style.display = 'block';
            borderRect.style.fill = this.getCSSValue();
        } else {
            borderRect.style.display = 'none';
            // In general, do *not* let fields control the color of blocks. Having the
            // field control the color is unexpected, and could have performance
            // impacts.
            block.pathObject.svgPath.setAttribute('fill', this.getCSSValue());
            block.pathObject.svgPath.setAttribute('stroke', '#fff');
        }
    }

    /**
     * Returns the height and width of the field.
     *
     * This should *in general* be the only place render_ gets called from.
     *
     * @returns Height and width.
     */
    override getSize(): Blockly.utils.Size {
        if (this.getConstants()?.FIELD_COLOUR_FULL_BLOCK) {
            // In general, do *not* let fields control the color of blocks. Having the
            // field control the color is unexpected, and could have performance
            // impacts.
            // Full block fields have more control of the block than they should
            // (i.e. updating fill colour) so they always need to be rerendered.
            this.render_();
            this.isDirty_ = false;
        }
        return super.getSize();
    }

    /**
     * Updates the colour of the block to reflect whether this is a full
     * block field or not.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    protected override render_() {
        this.updateSize_();

        const block = this.getSourceBlock() as Blockly.BlockSvg | null;
        if (!block) throw new Blockly.UnattachedFieldError();
        // Calling applyColour updates the UI (full-block vs non-full-block) for the
        // colour field, and the colour of the field/block.
        block.applyColour();
    }

    /**
     * Updates the size of the field based on whether it is a full block field
     * or not.
     *
     * @param margin margin to use when positioning the field.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    protected updateSize_(margin?: number) {
        const constants = this.getConstants();
        if (!constants) return;
        let totalWidth;
        let totalHeight;
        if (this.isFullBlockField()) {
            const xOffset = margin ?? 0;
            totalWidth = xOffset * 2;
            totalHeight = constants.FIELD_TEXT_HEIGHT;
        } else {
            totalWidth = constants.FIELD_COLOUR_DEFAULT_WIDTH;
            totalHeight = constants.FIELD_COLOUR_DEFAULT_HEIGHT;
        }

        this.size_.height = totalHeight;
        this.size_.width = totalWidth;

        this.positionBorderRect_();
    }

    /**
     * Ensure that the input value is a valid colour.
     *
     * @param newValue The input value.
     * @returns A valid colour, or null if invalid.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    protected override doClassValidation_(
        newValue: string,
    ): string | null | undefined;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    protected override doClassValidation_(newValue?: string): string | null;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    protected override doClassValidation_(
        newValue?: string,
    ): string | null | undefined {
        if (!this.allColoursCSSFormat_) {
            // This is the super constructor setting the value to the first
            // option before we've had a chance to assign fields.
            return newValue;
        }

        if (typeof newValue !== 'string') {
            return null;
        }
        const cssFormat = valueFormatToCSSFormat(newValue, this.allColoursCSSFormat_);
        const normalizedValueFormat = cssFormatToValueFormat(
            cssFormat,
            this.valueMode_,
            this.allColoursCSSFormat_
        );
        return normalizedValueFormat;
    }

    /**
     * Get the text for this field.  Used when the block is collapsed.
     *
     * @returns Text representing the value of this field.
     */
    override getText(): string {
        let colour = this.getCSSValue();
        // Try to use #rgb format if possible, rather than #rrggbb.
        if (/^#(.)\1(.)\2(.)\3$/.test(colour)) {
            colour = '#' + colour[1] + colour[3] + colour[5];
        }
        return colour;
    }

    getFieldDescription(): string {
        const value = this.getCSSValue();
        return value ? lf("color ${0}", value) : lf("color");
    }

    getCSSValue() {
        return valueFormatToCSSFormat(this.getValue(), this.allColoursCSSFormat_);
    }

}

function makeSwatches(
    allColoursCSSFormat: string[],
    titles?: string[],
): Blockly.MenuOption[] {
    const allColoursValueFormat = allColoursCSSFormat.map(c => cssFormatToValueFormat(c, valueMode, allColoursCSSFormat))
    return allColoursValueFormat.map((colourValueFormat, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'blocklyColourSwatch';
        swatch.style.backgroundColor = allColoursCSSFormat[index];

        if (titles && index < titles.length) {
            swatch.title = titles[index];
        }

        return [swatch, colourValueFormat];
    });
}

function cssFormatToValueFormat(value_: string, valueMode: FieldColourValueMode, allColoursCSSFormat: string[]) {
    switch (valueMode) {
        case "hex":
            return `"${value_}"`;
        case "rgb":
            if (value_.indexOf('#') > -1) {
                return `0x${value_.replace(/^#/, '')}`;
            }
            else {
                return value_;
            }
        case "index":
            if (!value_) return "-1";
            for (let i = 0; i < allColoursCSSFormat.length; i++) {
                if (value_.toUpperCase() === allColoursCSSFormat[i].toUpperCase()) {
                    return i + "";
                }
            }
    }
    return value_;
}

function valueFormatToCSSFormat(value: string, allColoursCSSFormat: string[]): string {
    // This supports a variety of formats this field editor does not generate.
    if (value) {
        const enumSplit = /Colors\.([a-zA-Z]+)/.exec(value);
        const hexSplit = /(0x|#)([0-9a-fA-F]+)/.exec(value);

        if (enumSplit) {
            switch (enumSplit[1].toLocaleLowerCase()) {
                case "red": return "#FF0000";
                case "orange": return "#FF7F00";
                case "yellow": return "#FFFF00";
                case "green": return "#00FF00";
                case "blue": return "#0000FF";
                case "indigo": return "#4B0082";
                case "violet": return "#8A2BE2";
                case "purple": return "#A033E5";
                case "pink": return "#FF007F";
                case "white": return "#FFFFFF";
                case "black": return "#000000";
                default: return value;
            }
        } else if (hexSplit) {
            const hexLiteralNumber = hexSplit[2];

            if (hexLiteralNumber.length === 3) {
                // if shorthand color, return standard hex triple
                let output = "#";
                for (let i = 0; i < hexLiteralNumber.length; i++) {
                    const digit = hexLiteralNumber.charAt(i);
                    output += digit + digit;
                }
                return output;
            } else if (hexLiteralNumber.length === 6) {
                return "#" + hexLiteralNumber;
            }
        }

        const parsedAsInt = parseInt(value);

        // Might be the index and not the color
        if (!isNaN(parsedAsInt) && allColoursCSSFormat[parsedAsInt] != undefined) {
            return allColoursCSSFormat[parsedAsInt];
        } else {
            return allColoursCSSFormat[0];
        }
    }
    return value;
}

/**
 * CSS for colour picker.
 */
Blockly.Css.register(`
.blocklyColourSwatch {
    width: 22px;
    height: 22px;
}

.blocklyFieldColour.blocklyFieldGridContainer {
    padding: 0px;
}

.blocklyFieldColour .blocklyFieldGrid {
    grid-gap: 0px;
    row-gap: 0px;
    outline: none;
}

.blocklyFieldColour .blocklyFieldGrid .blocklyFieldGridItem {
    padding: 0;
    border: none;
    margin: 2px;
}

.blocklyFieldColour .blocklyFieldGrid .blocklyFieldGridItem .blocklyColourSwatch {
    border: 2px solid rgba(0,0,0,.1);
    border-radius: 4px;
}

.blocklyFieldColour .blocklyFieldGridItem:focus .blocklyColourSwatch {
    box-shadow: 2px 2px 7px 2px rgba(0,0,0,.3);
    border-color: #eee;
    border-width: 1px;
}

.blocklyFieldColour .blocklyFieldGrid .blocklyFieldGridItemSelected .blocklyColourSwatch {
    outline: 1px solid #000;
    border-color: #eee;
    border-width: 1px;
}
`);