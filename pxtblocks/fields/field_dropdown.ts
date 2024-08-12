import * as Blockly from "blockly";
import { showEditorMixin } from "../plugins/newVariableField/fieldDropdownMixin";

export class FieldDropdown extends Blockly.FieldDropdown {
    protected shouldAddBorderRect_() {
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

    protected showEditor_(e?: MouseEvent): void {
        showEditorMixin.call(this, e);
    }
}