/// <reference path="../../localtypings/blockly.d.ts"/>
/// <reference path="../../built/pxtsim.d.ts"/>

namespace pxtblockly {

    export interface FieldTurnRatioOptions extends Blockly.FieldCustomOptions {
    }

    export class FieldTurnRatio extends Blockly.FieldSlider implements Blockly.FieldCustom {
        public isFieldCustom_ = true;

        private params: any;

        private path_: SVGPathElement;
        private reporter_: SVGTextElement;

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
        constructor(value_: any, params: FieldTurnRatioOptions, opt_validator?: Function) {
            super(String(value_), '-100', '100', null, '10', 'TurnRatio', opt_validator);
            this.params = params;
        }

        static HALF = 80;
        static HANDLE_RADIUS = 30;
        static RADIUS = FieldTurnRatio.HALF - FieldTurnRatio.HANDLE_RADIUS - 1;

        createLabelDom_(labelText: string) {
            let labelContainer = document.createElement('div');
            let svg = Blockly.utils.createSvgElement('svg', {
                'xmlns': 'http://www.w3.org/2000/svg',
                'xmlns:html': 'http://www.w3.org/1999/xhtml',
                'xmlns:xlink': 'http://www.w3.org/1999/xlink',
                'version': '1.1',
                'height': (FieldTurnRatio.HALF + FieldTurnRatio.HANDLE_RADIUS + 10) + 'px',
                'width': (FieldTurnRatio.HALF * 2) + 'px'
            }, labelContainer);
            let defs = Blockly.utils.createSvgElement('defs', {}, svg);
            let marker = Blockly.utils.createSvgElement('marker', {
                'id': 'head',
                'orient': "auto",
                'markerWidth': '2',
                'markerHeight': '4',
                'refX': '0.1', 'refY': '1.5'
            }, defs);
            let markerPath = Blockly.utils.createSvgElement('path', {
                'd': 'M0,0 V3 L1.5,1.5 Z',
                'fill': '#f12a21'
            }, marker);
            this.reporter_ = pxsim.svg.child(svg, "text", {
                'x': FieldTurnRatio.HALF, 'y': 96,
                'text-anchor': 'middle', 'dominant-baseline': 'middle',
                'style': 'font-size: 50px',
                'class': 'sim-text inverted number'
            }) as SVGTextElement;
            this.path_ = Blockly.utils.createSvgElement('path', {
                'x1': FieldTurnRatio.HALF,
                'y1': FieldTurnRatio.HALF,
                'marker-end': 'url(#head)',
                'style': 'fill: none; stroke: #f12a21; stroke-width: 10'
            }, svg) as SVGPathElement;
            this.updateGraph_();
            let readout = document.createElement('span');
            readout.setAttribute('class', 'blocklyFieldSliderReadout');
            return [labelContainer, readout];
        };

        updateGraph_() {
            if (!this.path_) {
                return;
            }
            let v = goog.math.clamp(parseFloat(this.getText()), -100, 100);
            if (isNaN(v)) {
                v = 0;
            }

            const x = goog.math.clamp(parseFloat(this.getText()), -100, 100) / 100;
            const theta = x * Math.PI / 2;
            const cx = FieldTurnRatio.HALF;
            const cy = FieldTurnRatio.HALF - 14;
            const gamma = Math.PI - 2 * theta;
            const r = FieldTurnRatio.RADIUS;
            const alpha = 0.2 + Math.abs(x) * 0.5;
            const x1 = 0;
            const y1 = r * alpha;
            const y2 = r * Math.sin(Math.PI / 2 - theta);
            const x2 = r * Math.cos(Math.PI / 2 - theta);
            const y3 = y2 - r * alpha * Math.cos(2 * theta);
            const x3 = x2 - r * alpha * Math.sin(2 * theta);


            const d = `M ${cx} ${cy} C ${cx} ${cy - y1} ${cx + x3} ${cy - y3} ${cx + x2} ${cy - y2}`;
            this.path_.setAttribute('d', d);

            this.reporter_.textContent = `${v}`;
        }

        setReadout_(readout: Element, value: string) {
            this.updateGraph_();
        }
    }
}