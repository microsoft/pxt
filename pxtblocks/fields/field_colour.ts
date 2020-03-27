/// <reference path="../../localtypings/blockly.d.ts" />


namespace pxtblockly {
    /**
     * The value modes:
     *     hex - Outputs an HTML color string: "#ffffff" (with quotes)
     *     rgb - Outputs an RGB number in hex: 0xffffff
     *     index - Outputs the index of the color in the list of colors: 0
     */
    export type FieldColourValueMode = "hex" | "rgb" | "index";

    export interface FieldColourNumberOptions extends Blockly.FieldCustomOptions {
        colours?: string; // parsed as a JSON array
        columns?: string; // parsed as a number
        className?: string;
        valueMode?: FieldColourValueMode;
    }

    export class FieldColorNumber extends Blockly.FieldColour implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        protected colour_: string;
        private valueMode_: FieldColourValueMode = "rgb";

        constructor(text: string, params: FieldColourNumberOptions, opt_validator?: Function) {
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
            if (params.className) this.className_ = params.className;
            if (params.valueMode) this.valueMode_ = params.valueMode;
        }

        /**
         * @override
         */
        applyColour() {
            if (this.borderRect_) {
                this.borderRect_.style.fill = this.value_;
            } else if (this.sourceBlock_) {
                (this.sourceBlock_ as any)?.pathObject?.svgPath?.setAttribute('fill', this.value_);
                (this.sourceBlock_ as any)?.pathObject?.svgPath?.setAttribute('stroke', '#fff');
            }
        };

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
            this.value_ = parseColour(colour, this.getColours_());
            this.applyColour();
        }

        showEditor_() {
            super.showEditor_();
            if (this.className_ && this.picker_)
                pxt.BrowserUtils.addClass(this.picker_ as HTMLElement, this.className_);
        }

        getColours_(): string[] {
            return this.colours_;
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
}