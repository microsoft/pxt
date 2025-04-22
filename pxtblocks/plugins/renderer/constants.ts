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

    FIELD_TEXT_FONTFAMILY = '"Monaco", "Menlo", "Ubuntu Mono", "Consolas", "source-code-pro", monospace';
    FIELD_TEXT_FONTWEIGHT = '600';

    /**
     * Color of the glow outline around highlighted blocks.
     */
    HIGHLIGHT_GLOW_COLOUR = '#FFF200';

    ERROR_HIGHLIGHT_GLOW_COLOR = '#FF0000';

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

    errorOutlineFilterId?: string;
    errorOutlineFilter?: SVGElement;

    embossFilterOverride?: SVGElement;

    ellipses = this.makeEllipses();


    override createDom(svg: SVGElement, tagName: string, selector: string, injectionDivIfIsParent?: HTMLElement,): void {
        super.createDom(svg, tagName, selector, injectionDivIfIsParent);

        const defs = Blockly.utils.dom.createSvgElement(Blockly.utils.Svg.DEFS, {}, svg);

        this.highlightOutlineFilter = this.createHighlight(defs, "blocklyHighlightedGlowFilter", this.HIGHLIGHT_GLOW_COLOUR);
        this.highlightOutlineFilterId = this.highlightOutlineFilter.id;

        this.errorOutlineFilter = this.createHighlight(defs, "blocklyErrorHighlightedGlowFilter", this.ERROR_HIGHLIGHT_GLOW_COLOR);
        this.errorOutlineFilterId = this.errorOutlineFilter.id;

        this.embossFilterOverride = this.createOutline(defs, "blocklyBubbleEmbossGlowFilter")
        this.embossFilterId = this.embossFilterOverride.id
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

    override getCSS_(selector: string) {
        const css = super.getCSS_(selector);

        return css.concat([
            // Connection indicator.
            selector + ' .blocklyConnectionIndicator, ' + selector + ' .blocklyInputConnectionIndicator {',
            'fill: #ff0000;',
            'stroke: #ffff00;',
            'stroke-width: 3px;',
            '}',
            selector + ' .blocklyConnectionIndicator {',
            'display: none;',
            '}',
            selector + ' .blocklyBlockDragSurface > g > .blocklyDraggable > .blocklyConnectionIndicator {',
            'display: block;',
            '}',
            selector + ' .blocklyConnectionLine {',
            'stroke: #ffff00;',
            'stroke-width: 4px;',
            '}',
            selector + ' .blocklyConnectionLine.hidden {',
            'display: none;',
            '}',

            // Flyout heading.
            selector + ' .blocklyFlyoutHeading .blocklyFlyoutLabelText {' +
            'font-size: 1.5rem;',
            '}'
        ])
    }

    protected createHighlight(defs: SVGDefsElement, id: string, color: string) {
        const highlightOutlineFilter = Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.FILTER,
            {
                'id': id + this.randomIdentifier,
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
                'flood-color': color,
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

        return highlightOutlineFilter;
    }

    protected createOutline(defs: SVGDefsElement, id: string) {
        const highlightOutlineFilter = Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.FILTER,
            {
                'id': id + this.randomIdentifier,
                'height': '160%',
                'width': '180%',
                'y': '-30%',
                'x': '-40%',
            },
            defs,
        );
        Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.FEGAUSSIANBLUR,
            { 'in': 'SourceGraphic', 'stdDeviation': 0.92 },
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
        // Flood the blur with an opacity
        Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.FEFLOOD,
            {
                'flood-color': "#000000",
                'flood-opacity': 0.5,
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

        // Stack the flooded blur on top of the original blur
        // to create a darkened outline. Then place the original
        // image on top of the darkened outline.
        const merge = Blockly.utils.dom.createSvgElement(
            'feMerge',
            {},
            highlightOutlineFilter,
        );

        Blockly.utils.dom.createSvgElement(
            'feMergeNode',
            {
                'in': 'outBlur'
            },
            merge,
        );

        Blockly.utils.dom.createSvgElement(
            'feMergeNode',
            {
                'in': 'outGlow'
            },
            merge,
        );

        Blockly.utils.dom.createSvgElement(
            'feMergeNode',
            {
                'in': 'SourceGraphic'
            },
            merge,
        );

        return highlightOutlineFilter;
    }

    override shapeFor(connection: Blockly.RenderedConnection) {
        let checks = connection.getCheck();
        if (!checks && connection.targetConnection) {
            checks = connection.targetConnection.getCheck();
        }
        switch (connection.type) {
            case Blockly.ConnectionType.INPUT_VALUE:
            case Blockly.ConnectionType.OUTPUT_VALUE:
                // The default zelos renderer just inherits the shape from
                // the parent if it's set. Instead, respect the type checks.
                // outputShape = connection.getSourceBlock().getOutputShape();
                // if (outputShape !== null) {
                //     switch (outputShape) {
                //         case this.SHAPES.HEXAGONAL:
                //             return this.HEXAGONAL!;
                //         case this.SHAPES.ROUND:
                //             return this.ROUNDED!;
                //         case this.SHAPES.SQUARE:
                //             return this.SQUARED!;
                //     }
                // }
                // Includes doesn't work in IE.
                if (checks && checks.includes('Boolean')) {
                    return this.HEXAGONAL!;
                }
                if (checks && checks.includes('Number')) {
                    return this.ROUNDED!;
                }
                if (checks && checks.includes('String')) {
                    return this.ROUNDED!;
                }
                return this.ROUNDED!;
            case Blockly.ConnectionType.PREVIOUS_STATEMENT:
            case Blockly.ConnectionType.NEXT_STATEMENT:
                return this.NOTCH!;
            default:
                throw Error('Unknown type');
        }
    }
}