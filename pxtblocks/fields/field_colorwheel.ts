/// <reference path="../../localtypings/blockly.d.ts" />

namespace pxtblockly {

    export class FieldColorWheel extends Blockly.FieldSlider implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        private params: any;

        private channel_: string;

        /**
         * Class for a color wheel field.
         * @param {number|string} value The initial content of the field.
         * @param {Function=} opt_validator An optional function that is called
         *     to validate any constraints on what the user entered.  Takes the new
         *     text as an argument and returns either the accepted text, a replacement
         *     text, or null to abort the change.
         * @extends {Blockly.FieldNumber}
         * @constructor
         */
        constructor(value_: any, params: any, opt_validator?: Function) {
            super(String(value_), '0', '255', null, '10', 'Color', opt_validator);
            this.params = params;
            if (this.params['min']) this.min_ = parseFloat(this.params['min']);
            if (this.params['max']) this.max_ = parseFloat(this.params['max']);
            if (this.params['label']) this.labelText_ = this.params['label'];
            if (this.params['channel']) this.channel_ = this.params['channel'];
        }

        /**
         * Set the gradient CSS properties for the given node and channel
         * @param {Node} node - The DOM node the gradient will be set on.
         * @private
         */
        setBackground_(node: Element) {
            let gradient = this.createColourStops_().join(',');
            goog.style.setStyle(node, 'background',
                '-moz-linear-gradient(left, ' + gradient + ')');
            goog.style.setStyle(node, 'background',
                '-webkit-linear-gradient(left, ' + gradient + ')');
            goog.style.setStyle(node, 'background',
                '-o-linear-gradient(left, ' + gradient + ')');
            goog.style.setStyle(node, 'background',
                '-ms-linear-gradient(left, ' + gradient + ')');
            goog.style.setStyle(node, 'background',
                'linear-gradient(left, ' + gradient + ')');
            if (this.params['sliderWidth'])
                goog.style.setStyle(node, 'width',
                    `${this.params['sliderWidth']}px`)
        };

        setReadout_(readout: Element, value: string) {
            const hexValue = this.colorWheel(parseInt(value), this.channel_);
            // <span class="blocklyColorReadout" style="background-color: ${hexValue};"></span>
            const readoutSpan = document.createElement('span');
            readoutSpan.className = "blocklyColorReadout";
            readoutSpan.style.backgroundColor = `${hexValue}`;

            pxsim.U.clear(readout);
            readout.appendChild(readoutSpan);
        }

        createColourStops_() {
            let stops: string[] = [];
            for (let n = 0; n <= 255; n += 20) {
                stops.push(this.colorWheel(n, this.channel_));
            }
            return stops;
        };

        colorWheel(wheelPos: number, channel?: string): string {
            if (channel == "hsvfast") {
                return this.hsvFast(wheelPos, 255, 255);
            } else {
                wheelPos = 255 - wheelPos;
                if (wheelPos < 85) {
                    return this.hex(wheelPos * 3, 255, 255 - wheelPos * 3);
                }
                if (wheelPos < 170) {
                    wheelPos -= 85;
                    return this.hex(255, 255 - wheelPos * 3, wheelPos * 3);
                }
                wheelPos -= 170;
                return this.hex(255 - wheelPos * 3, wheelPos * 3, 255);
            }
        }

        hsvFast(hue: number, sat: number, val: number): string {
            let h = (hue % 255) >> 0;
            if (h < 0) h += 255;
            // scale down to 0..192
            h = (h * 192 / 255) >> 0;

            //reference: based on FastLED's hsv2rgb rainbow algorithm [https://github.com/FastLED/FastLED](MIT)
            let invsat = 255 - sat;
            let brightness_floor = ((val * invsat) / 255) >> 0;
            let color_amplitude = val - brightness_floor;
            let section = (h / 0x40) >> 0; // [0..2]
            let offset = (h % 0x40) >> 0; // [0..63]

            let rampup = offset;
            let rampdown = (0x40 - 1) - offset;

            let rampup_amp_adj = ((rampup * color_amplitude) / (255 / 4)) >> 0;
            let rampdown_amp_adj = ((rampdown * color_amplitude) / (255 / 4)) >> 0;

            let rampup_adj_with_floor = (rampup_amp_adj + brightness_floor);
            let rampdown_adj_with_floor = (rampdown_amp_adj + brightness_floor);

            let r: number;
            let g: number;
            let b: number;
            if (section) {
                if (section == 1) {
                    // section 1: 0x40..0x7F
                    r = brightness_floor;
                    g = rampdown_adj_with_floor;
                    b = rampup_adj_with_floor;
                } else {
                    // section 2; 0x80..0xBF
                    r = rampup_adj_with_floor;
                    g = brightness_floor;
                    b = rampdown_adj_with_floor;
                }
            } else {
                // section 0: 0x00..0x3F
                r = rampdown_adj_with_floor;
                g = rampup_adj_with_floor;
                b = brightness_floor;
            }
            return this.hex(r, g, b);
        }

        private hex(red: number, green: number, blue: number): string {
            return `#${this.componentToHex(red & 0xFF)}${this.componentToHex(green & 0xFF)}${this.componentToHex(blue & 0xFF)}`;
        }
        private componentToHex(c: number) {
            let hex = c.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
        }
    }
}
