import * as Blockly from "blockly";

export class BreakpointIcon extends Blockly.icons.Icon {
    static readonly type = new Blockly.icons.IconType("breakpoint");

    protected isSet_ = false;
    protected breakpointSvg: SVGCircleElement;

    constructor(sourceBlock: Blockly.Block, protected readonly onStateChange: (block: Blockly.Block, isSet: boolean) => void) {
        super(sourceBlock);
    }

    override getType(): Blockly.icons.IconType<Blockly.IIcon> {
        return BreakpointIcon.type;
    }

    override initView(pointerdownListener: (e: PointerEvent) => void): void {
        super.initView(pointerdownListener);

        if (this.breakpointSvg) return;

        // Red/Grey filled circle, for Set/Unset breakpoint respectively.
        this.breakpointSvg = Blockly.utils.dom.createSvgElement(
            'circle',
            {
                'class': 'blocklyBreakpointSymbol',
                'stroke': 'white',
                'stroke-width': 2,
                'cx': 7,
                'cy': 11.5,
                'r': 8,
            },
            this.svgRoot
        );

        this.updateColor();
    }

    override getSize(): Blockly.utils.Size {
        return new Blockly.utils.Size(25, 25);
    }

    override onClick(): void {
        this.isSet_ = !this.isSet_;
        this.updateColor();

        this.onStateChange(this.sourceBlock, this.isSet_);
    }

    isEnabled(): boolean {
        return this.isSet_;
    }

    setEnabled(enabled: boolean) {
        this.isSet_ = enabled;
        this.updateColor();
    }

    protected updateColor() {
        if (!this.breakpointSvg) return;

        this.breakpointSvg.setAttribute("fill", this.isSet_ ? "#FF0000" : "#CCCCCC")
    }
}