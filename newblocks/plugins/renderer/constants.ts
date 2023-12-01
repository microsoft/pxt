import * as Blockly from "blockly";


export class ConstantProvider extends Blockly.zelos.ConstantProvider {
    /**
     * Data URI of svg for collapsing a block.
     */
    static COLLAPSE_IMAGE_DATAURI = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3Csvg enable-background='new 0 0 24 24' version='1.1' viewBox='0 0 24 24' xml:space='preserve' xmlns='http://www.w3.org/2000/svg'%3E%3Cstyle type='text/css'%3E .st0%7Bfill:%23CF8B17;%7D .st1%7Bfill:%23FFFFFF;%7D%0A%3C/style%3E%3Ctitle%3Erepeat%3C/title%3E%3Ccircle cx='12' cy='12' r='10.503' fill='none' stroke='%23fff' stroke-linecap='square' stroke-linejoin='round' stroke-width='2'/%3E%3Cg transform='matrix(.0086269 0 0 -.0086269 4.8224 17.354)'%3E%3Cpath d='m1611 367.42q0 53-37 90l-651 651q-38 38-91 38-54 0-90-38l-651-651q-38-36-38-90 0-53 38-91l74-75q39-37 91-37 53 0 90 37l486 486 486-486q37-37 90-37 52 0 91 37l75 75q37 39 37 91z' fill='%23fff'/%3E%3C/g%3E%3C/svg%3E%0A";


    /**
    * Data URI of svg for expanding a collapsed block.
    */
    static EXPAND_IMAGE_DATAURI = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3Csvg enable-background='new 0 0 24 24' version='1.1' viewBox='0 0 24 24' xml:space='preserve' xmlns='http://www.w3.org/2000/svg'%3E%3Cstyle type='text/css'%3E .st0%7Bfill:%23CF8B17;%7D .st1%7Bfill:%23FFFFFF;%7D%0A%3C/style%3E%3Ctitle%3Erepeat%3C/title%3E%3Ccircle cx='12' cy='12' r='10.503' fill='none' stroke='%23fff' stroke-linecap='square' stroke-linejoin='round' stroke-width='2'/%3E%3Cg transform='matrix(.0086269 0 0 -.0086269 4.8224 17.654)'%3E%3Cpath d='m1611 832q0-53-37-90l-651-651q-38-38-91-38-54 0-90 38l-651 651q-38 36-38 90 0 53 38 91l74 75q39 37 91 37 53 0 90-37l486-486 486 486q37 37 90 37 52 0 91-37l75-75q37-39 37-91z' fill='%23fff'/%3E%3C/g%3E%3C/svg%3E%0A";

    /**
     * Color of the glow outline around highlighted blocks.
     */
    HIGHLIGHT_GLOW_COLOUR = '#FFF200';

    /**
     * The width of the glow outline around highlighted blocks.
     */
    HIGHLIGHT_GLOW_SIZE = 1.1;

    /**
     * Radius of SVG path for ellipses in collapsed blocks.
     */
    ELLIPSES_RADIUS = 6;

    /**
     * Spacing of ellipses in collapsed blocks.
     */
    ELLIPSES_SPACING = 8;

    highlightOutlineFilterId?: string;
    highlightOutlineFilter?: SVGElement;
    ellipses = this.makeEllipses();


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

    makeEllipses() {
        const r = this.ELLIPSES_RADIUS;
        const spacing = this.ELLIPSES_SPACING;

        let mainPath = "";
        for (let i = 0; i < 3; i++) {
            mainPath += Blockly.utils.svgPaths.moveBy(spacing, 0)
                + Blockly.utils.svgPaths.arc('a', '180 1,1', r,
                    Blockly.utils.svgPaths.point(r * 2, 0));
        }
        for (let i = 0; i < 3; i++) {
            mainPath += Blockly.utils.svgPaths.arc('a', '180 1,1', r,
                Blockly.utils.svgPaths.point(- r * 2, 0))
                + Blockly.utils.svgPaths.moveBy(-spacing, 0);
        }

        return mainPath;
    };
}