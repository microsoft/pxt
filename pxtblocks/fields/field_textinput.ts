import * as Blockly from "blockly";
import { FieldCustom, FieldCustomOptions } from "./field_utils";

export class FieldTextInput extends Blockly.FieldTextInput implements FieldCustom {
    public isFieldCustom_ = true;

    constructor(value: string, options: FieldCustomOptions, opt_validator?: Blockly.FieldValidator) {
        super(value, opt_validator);
    }

    getFieldDescription(): string {
        return this.getValue();
    }
}