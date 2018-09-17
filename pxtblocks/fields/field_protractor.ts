/// <reference path="../../localtypings/blockly.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts"/>

namespace pxtblockly {
    export interface FieldProtractorOptions extends Blockly.FieldCustomOptions {
    }

    export class FieldProtractor extends Blockly.FieldSlider implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        private params: any;

        private circleSVG: SVGElement;
        private circleBar: SVGCircleElement;
        private reporter: SVGTextElement;

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
        constructor(value_: any, params: FieldProtractorOptions, opt_validator?: Function) {
            super(String(value_), '0', '180', null, '15', lf("Angle"), opt_validator);
            this.params = params;
        }

        createLabelDom_(labelText: string) {
            const labelContainer = document.createElement('div');
            this.circleSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGGElement;
            pxsim.svg.hydrate(this.circleSVG, {
                viewBox: "0 0 200 100",
                width: "170"
            });

            labelContainer.appendChild(this.circleSVG);

            const outerCircle = pxsim.svg.child(this.circleSVG, "circle", {
                'stroke-dasharray': '565.48', 'stroke-dashoffset': '0',
                'cx': 100, 'cy': 100, 'r': '90', 'style': `fill:transparent; transition: stroke-dashoffset 0.1s linear;`,
                'stroke': '#a8aaa8', 'stroke-width': '1rem'
            }) as SVGCircleElement;
            this.circleBar = pxsim.svg.child(this.circleSVG, "circle", {
                'stroke-dasharray': '565.48', 'stroke-dashoffset': '0',
                'cx': 100, 'cy': 100, 'r': '90', 'style': `fill:transparent; transition: stroke-dashoffset 0.1s linear;`,
                'stroke': '#f12a21', 'stroke-width': '1rem'
            }) as SVGCircleElement;

            this.reporter = pxsim.svg.child(this.circleSVG, "text", {
                'x': 100, 'y': 80,
                'text-anchor': 'middle', 'dominant-baseline': 'middle',
                'style': 'font-size: 50px',
                'class': 'sim-text inverted number'
            }) as SVGTextElement;

            // labelContainer.setAttribute('class', 'blocklyFieldSliderLabel');
            const readout = document.createElement('span');
            readout.setAttribute('class', 'blocklyFieldSliderReadout');
            return [labelContainer, readout];
        };

        setReadout_(readout: Element, value: string) {
            this.updateAngle(parseFloat(value));
            // Update reporter
            this.reporter.textContent = `${value}°`;
        }

        private updateAngle(angle: number) {
            angle = Math.max(0, Math.min(180, angle));
            const radius = 90;
            const pct = (180 - angle) / 180 * Math.PI * radius;
            this.circleBar.setAttribute('stroke-dashoffset', `${pct}`);
        }
    }
}