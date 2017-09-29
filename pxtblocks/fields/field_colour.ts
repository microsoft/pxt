/// <reference path="../../localtypings/blockly.d.ts" />


namespace pxtblockly {

    export class FieldColorNumber extends Blockly.FieldColour implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        private colour_: string;

        constructor(text: string, options: Blockly.FieldCustomOptions, opt_validator?: Function) {
            super(text, opt_validator);
        }

        /**
         * Return the current colour.
         * @return {string} Current colour in '#rrggbb' format.
         */
        getValue() {
            if (this.colour_.indexOf('#') > -1) {
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
    }
}