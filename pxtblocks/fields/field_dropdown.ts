import * as Blockly from "blockly";
import { showEditorMixin } from "../plugins/newVariableField/fieldDropdownMixin";

export class FieldDropdown extends Blockly.FieldDropdown {
    protected shouldAddBorderRect_() {
        if (!this.sourceBlock_.getInputsInline()) {
            return true;
        }
        return super.shouldAddBorderRect_();
    }

    protected showEditor_(e?: MouseEvent): void {
        showEditorMixin.call(this, e);
    }
}