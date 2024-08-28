import * as Blockly from "blockly";
import { showEditorMixin } from "../plugins/newVariableField/fieldDropdownMixin";

export class FieldDropdown extends Blockly.FieldDropdown {
    // Everything in this class below this line is duplicated in pxtblocks/plugins/newVariableField/fieldVariable.ts
    // and should be kept in sync with FieldVariable in that file
    private svgRootBinding: Blockly.browserEvents.Data | null = null;
    private fieldRootBinding: Blockly.browserEvents.Data | null = null;
    private clickTargetRect: SVGRectElement;

    override initView() {
        super.initView();

        if (this.shouldAddBorderRect_()) {
            return;
        }

        // Repurpose the border rect as a transparent click target
        this.createBorderRect_();
        this.clickTargetRect = this.borderRect_!;
        this.clickTargetRect.setAttribute("stroke-opacity", "0");
        this.clickTargetRect.setAttribute("fill-opacity", "0");

        // Make sure to unset the border rect so that it isn't included in size
        // calculations
        this.borderRect_ = undefined;
    }

    override shouldAddBorderRect_() {
        if (this.sourceBlock_.type === "variables_get") {
            return false;
        }

        // Returning false for this function will turn the entire block into
        // a click target for this field. If there are other editable fields
        // in this block, make sure we return true so that we don't make them
        // inaccessible
        for (const input of this.sourceBlock_.inputList) {
            for (const field of input.fieldRow) {
                if (field === this) continue;

                if (field.EDITABLE) {
                    return true;
                }
            }
        }
        if (!this.sourceBlock_.getInputsInline()) {
            return true;
        }
        return super.shouldAddBorderRect_();
    }

    protected override bindEvents_() {
        if (this.shouldAddBorderRect_()) {
            super.bindEvents_();
            return;
        }

        // If shouldAddBorderRect_ returns false, we want the block
        // to act as one big click target except if the block has icons
        // on it (e.g. comments, warnings, etc). In that case, we want
        // to go back to the default behavior of only respecting clicks
        // on the field itself so that we don't block clikcing on the
        // icons. To accomplish this, we register two event handlers
        // one on the sourceblock and one on the field root and check
        // the sourceblock icons to make sure only one ever runs
        this.svgRootBinding = Blockly.browserEvents.conditionalBind(
            (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot(),
            'pointerdown',
            this,
            (e: PointerEvent) => {
                if (this.sourceBlock_.icons.length) {
                    return;
                }
                this.onMouseDown_(e);
            },
            false
        );

        this.fieldRootBinding = Blockly.browserEvents.conditionalBind(
            this.getSvgRoot(),
            'pointerdown',
            this,
            (e: PointerEvent) => {
                if (!this.sourceBlock_.icons.length) {
                    return;
                }
                this.onMouseDown_(e);
            },
            false
        );
    }

    override dispose() {
        super.dispose();
        if (this.svgRootBinding) {
            Blockly.browserEvents.unbind(this.svgRootBinding);
            Blockly.browserEvents.unbind(this.fieldRootBinding);
        }
    }

    protected override positionBorderRect_() {
        super.positionBorderRect_();

        // The logic below is duplicated from the blockly implementation
        if (!this.clickTargetRect) {
            return;
        }
        this.clickTargetRect.setAttribute('width', String(this.size_.width));
        this.clickTargetRect.setAttribute('height', String(this.size_.height));
        this.clickTargetRect.setAttribute(
            'rx',
            String(this.getConstants()!.FIELD_BORDER_RECT_RADIUS),
        );
        this.clickTargetRect.setAttribute(
            'ry',
            String(this.getConstants()!.FIELD_BORDER_RECT_RADIUS),
        );
    }

    protected showEditor_(e?: MouseEvent): void {
        showEditorMixin.call(this, e);
    }
}