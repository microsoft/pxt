/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldCustom, FieldCustomOptions } from "./field_utils";

import { FieldColour } from "@blockly/field-colour";

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

export class FieldColorNumber extends FieldColour implements FieldCustom {
    public isFieldCustom_ = true;

    protected colour_: string;
    private valueMode_: FieldColourValueMode = "rgb";
    protected colours_: string[];

    constructor(text: string, params: FieldColourNumberOptions, opt_validator?: Blockly.FieldValidator) {
        super(text, opt_validator);

        if (params.colours)
            this.setColours(JSON.parse(params.colours));
        else if (pxt.appTarget.runtime && pxt.appTarget.runtime.palette) {
            let p = pxt.Util.clone(pxt.appTarget.runtime.palette);
            p[0] = "#dedede";
            let t;
            if (pxt.appTarget.runtime.paletteNames) {
                t = pxt.Util.clone(pxt.appTarget.runtime.paletteNames);
                t[0] = lf("transparent");
            }
            this.setColours(p, t);
        }

        // Set to first color in palette (for toolbox)
        this.setValue(this.getColours_()[0]);

        if (params.columns) this.setColumns(parseInt(params.columns));
        if (params.valueMode) this.valueMode_ = params.valueMode;
    }

    setColours(colours: string[], titles?: string[]): FieldColour {
        const s = super.setColours(colours, titles);
        this.colours_ = colours;
        return s;
    }


    doClassValidation_(colour: string) {
        return "string" != typeof colour ? null : parseColour(colour, this.getColours_());
    }

    /**
     * Return the current colour.
     * @param {boolean} opt_asHex optional field if the returned value should be a hex
     * @return {string} Current colour in '#rrggbb' format.
     */
    getValue(opt_asHex?: boolean) {
        if (opt_asHex) return this.value_;
        switch (this.valueMode_) {
            case "hex":
                return `"${this.value_}"`;
            case "rgb":
                if (this.value_.indexOf('#') > -1) {
                    return `0x${this.value_.replace(/^#/, '')}`;
                }
                else {
                    return this.value_;
                }
            case "index":
                if (!this.value_) return "-1";
                const allColours = this.getColours_();
                for (let i = 0; i < allColours.length; i++) {
                    if (this.value_.toUpperCase() === allColours[i].toUpperCase()) {
                        return i + "";
                    }
                }
        }
        return this.value_;
    }

    /**
     * Set the colour.
     * @param {string} colour The new colour in '#rrggbb' format.
     */
    doValueUpdate_(colour: string) {
        super.doValueUpdate_(parseColour(colour, this.getColours_()))
        // this.applyColour();
    }

    getColours_(): string[] {
        return this.colours_;
    }

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
            borderRect.style.fill = this.getValue() as string;
        } else {
            borderRect.style.display = 'none';
            // In general, do *not* let fields control the color of blocks. Having the
            // field control the color is unexpected, and could have performance
            // impacts.
            block.pathObject.svgPath.setAttribute('fill', parseColour(this.getValue(), this.getColours_()));
            block.pathObject.svgPath.setAttribute('stroke', '#fff');
        }
    }
}

function parseColour(colour: string, allColours: string[]) {
    if (colour) {
        const enumSplit = /Colors\.([a-zA-Z]+)/.exec(colour);
        const hexSplit = /(0x|#)([0-9a-fA-F]+)/.exec(colour);

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
                default: return colour;
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

        if (allColours) {
            const parsedAsInt = parseInt(colour);

            // Might be the index and not the color
            if (!isNaN(parsedAsInt) && allColours[parsedAsInt] != undefined) {
                return allColours[parsedAsInt];
            } else {
                return allColours[0];
            }
        }
    }
    return colour;
}

Blockly.Css.register(`
/* eslint-disable indent */
table.blocklyColourTable {
    outline: none;
    border-radius: 11px;
}

table.blocklyColourTable > tr > td {
    height: 22px;
    width: 22px;
    margin: 2px;
    text-align: center;
    cursor: pointer;
    border-radius: 4px;
    border: 2px solid rgba(0,0,0,.1);
}

table.blocklyColourTable > tr > td:hover {
    border: 1px solid #FFF;
    box-sizing: border-box;
}

table.blocklyColourTable > tr > td.blocklyColourSelected {
    border: 1px solid #000;
    box-sizing: border-box;
    color: #fff;
}

table.blocklyColourTable>tr>td.blocklyColourHighlighted {
    border-color: #eee;
    box-shadow: 2px 2px 7px 2px rgba(0,0,0,.3);
    position: relative;
}

.blocklyColourSelected, .blocklyColourSelected:hover {
    border-color: #eee !important;
    outline: 1px solid #333;
    position: relative;
}
/* eslint-enable indent */
`);