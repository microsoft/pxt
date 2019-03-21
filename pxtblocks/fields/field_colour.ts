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
                this.setColours(p);
            }

            if (params.columns) this.setColumns(parseInt(params.columns));
            if (params.className) this.className_ = params.className;
            if (params.valueMode) this.valueMode_ = params.valueMode;
        }

        /**
         * Return the current colour.
         * @param {boolean} opt_asHex optional field if the returned value should be a hex
         * @return {string} Current colour in '#rrggbb' format.
         */
        getValue(opt_asHex?: boolean) {
            if (opt_asHex) return this.colour_;
            switch (this.valueMode_) {
                case "hex":
                    return `"${this.colour_}"`;
                case "rgb":
                    if (this.colour_.indexOf('#') > -1) {
                        return `0x${this.colour_.replace(/^#/, '')}`;
                    }
                    else {
                        return this.colour_;
                    }
                case "index":
                    return this.getColours_().indexOf(this.colour_).toString();
            }
            return this.colour_;
        }

        /**
         * Set the colour.
         * @param {string} colour The new colour in '#rrggbb' format.
         */
        setValue(colour: string) {
            colour = fixEnumColor(colour);
            if (colour.indexOf('0x') > -1) {
                colour = `#${colour.substr(2)}`;
            }
            else if (this.valueMode_ === "index") {
                const allColors = this.getColours_();
                if (allColors.indexOf(colour) === -1) {
                    // Might be the index and not the color
                    const i = parseInt(colour);
                    if (!isNaN(i) && i >= 0 && i < allColors.length) {
                        colour = allColors[i];
                    }
                    else {
                        colour = allColors[0];
                    }
                }
            }

            if (this.sourceBlock_ && Blockly.Events.isEnabled() &&
                this.colour_ != colour) {
                Blockly.Events.fire(new (Blockly as any).Events.BlockChange(
                    this.sourceBlock_, 'field', this.name, this.colour_, colour));
            }
            this.colour_ = colour;
            if (this.sourceBlock_) {
                this.sourceBlock_.setColour(colour, colour, colour);
            }
        }

        showEditor_() {
            super.showEditor_();
            if (this.className_ && this.colorPicker_)
                Blockly.utils.addClass((this.colorPicker_.getElement()), this.className_);
        }

        getColours_(): string[] {
            return (this as any).colours_;
        }
    }

    function fixEnumColor(colour: string) {
        if (colour) {
            const match = /Colors\.([a-zA-Z]+)/.exec(colour);
            if (match) {
                switch (match[1].toLocaleLowerCase()) {
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
            }
        }
        return colour;
    }
}