import * as Blockly from "blockly";


export class ConstantProvider extends Blockly.zelos.ConstantProvider {
    highlightOutlineFilterId?: string;
    highlightOutlineFilter?: SVGElement;

    HIGHLIGHT_GLOW_COLOUR = '#FFF200';

    HIGHLIGHT_GLOW_SIZE = 1.1;

    override createDom(svg: SVGElement, tagName: string, selector: string): void {
        super.createDom(svg, tagName, selector);

        const defs = Blockly.utils.dom.createSvgElement(Blockly.utils.Svg.DEFS, {}, svg);


        // This is the same as the Zelos selected glow filter but with a different
        // standard deviation to make it wider
        const highlightOutlineFilter = Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.FILTER,
            {
                'id': 'blocklyHighlightedGlowFilter' + this.randomIdentifier,
                'height': '160%',
                'width': '180%',
                'y': '-30%',
                'x': '-40%',
            },
            defs,
        );
        Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.FEGAUSSIANBLUR,
            { 'in': 'SourceGraphic', 'stdDeviation': this.HIGHLIGHT_GLOW_SIZE },
            highlightOutlineFilter,
        );
        // Set all gaussian blur pixels to 1 opacity before applying flood
        const selectedComponentTransfer = Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.FECOMPONENTTRANSFER,
            { 'result': 'outBlur' },
            highlightOutlineFilter,
        );
        Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.FEFUNCA,
            { 'type': 'table', 'tableValues': '0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1' },
            selectedComponentTransfer,
        );
        // Color the highlight
        Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.FEFLOOD,
            {
                'flood-color': this.HIGHLIGHT_GLOW_COLOUR,
                'flood-opacity': 1,
                'result': 'outColor',
            },
            highlightOutlineFilter,
        );
        Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.FECOMPOSITE,
            {
                'in': 'outColor',
                'in2': 'outBlur',
                'operator': 'in',
                'result': 'outGlow',
            },
            highlightOutlineFilter,
        );
        this.highlightOutlineFilterId = highlightOutlineFilter.id;
        this.highlightOutlineFilter = highlightOutlineFilter;
    }

    dispose(): void {
        super.dispose();

        if (this.highlightOutlineFilter) {
            Blockly.utils.dom.removeNode(this.highlightOutlineFilter);
        }
    }
}