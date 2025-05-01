/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldCustom } from "./field_utils";


export class FieldTsExpression extends Blockly.FieldTextInput implements FieldCustom {
    public isFieldCustom_ = true;
    protected pythonMode = false;


    /**
     * Same as parent, but adds a different class to text when disabled
     */
    public updateEditable() {
        const group = this.fieldGroup_;
        const block = this.getSourceBlock();
        if (!this.EDITABLE || !group || !block) {
            return;
        }
        if (this.enabled_ && block.isEditable()) {
            pxt.BrowserUtils.addClass(group, 'blocklyEditableText');
            pxt.BrowserUtils.removeClass(group, 'blocklyGreyExpressionBlockText');
        } else {
            pxt.BrowserUtils.addClass(group, 'blocklyGreyExpressionBlockText');
            pxt.BrowserUtils.removeClass(group, 'blocklyEditableText');
        }
    }

    public setPythonEnabled(enabled: boolean) {
        if (enabled === this.pythonMode) return;

        this.pythonMode = enabled;
        this.forceRerender();
    }

    getText() {
        return this.pythonMode ? pxt.Util.lf("<python code>") : this.getValue();
    }

    applyColour() {
        if (this.sourceBlock_ && this.getConstants()?.FULL_BLOCK_FIELDS) {
            if (this.borderRect_) {
                this.borderRect_.setAttribute('stroke',
                    (this.sourceBlock_ as Blockly.BlockSvg).style.colourPrimary);
                this.borderRect_.setAttribute('fill',
                    (this.sourceBlock_ as Blockly.BlockSvg).style.colourPrimary);
            }
        }
    }
}