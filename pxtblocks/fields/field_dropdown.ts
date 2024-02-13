import * as Blockly from "blockly";

export class FieldDropdown extends Blockly.FieldDropdown {
    protected shouldAddBorderRect_() {
        if (!this.sourceBlock_.getInputsInline()) {
            return true;
        }
        return super.shouldAddBorderRect_();
    }
}