/// <reference path="../../localtypings/blockly.d.ts" />


namespace pxtblockly {

    export interface FieldColourNumberOptions extends Blockly.FieldCustomOptions {
        colours?: string; // parsed as a JSON array
        columns?: string; // parsed as a number
        className?: string;
    }

    export class FieldColorNumber extends Blockly.FieldColour implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        protected colour_: string;

        private colorPicker_: goog.ui.ColorPicker;
        private className_: string;

        constructor(text: string, params: FieldColourNumberOptions, opt_validator?: Function) {
            super(text, opt_validator);

            if (params.colours) this.setColours(JSON.parse(params.colours));
            if (params.columns) this.setColumns(parseInt(params.columns));
            if (params.className) this.className_ = params.className;
        }

        /**
         * Return the current colour.
         * @param {boolean} opt_asHex optional field if the returned value should be a hex
         * @return {string} Current colour in '#rrggbb' format.
         */
        getValue(opt_asHex?: boolean) {
            if (!opt_asHex && this.colour_.indexOf('#') > -1) {
                return `0x${this.colour_.replace(/^#/, '')}`;
            }
            return this.colour_;
        }

        /**
         * Set the colour.
         * @param {string} colour The new colour in '#rrggbb' format.
         */
        setValue(colour: string) {
            if (colour.indexOf('0x') > -1) {
                colour = `#${colour.substr(2)}`;
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
    }
}