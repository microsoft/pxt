namespace pxtblockly {
    export class FieldVariableDropdown extends Blockly.FieldVariable {
        constructor(varName: string) {
            super(varName);
            this.menuGenerator_ = this.customDropdownCreate;
        }
        customDropdownCreate(): any {
            const options = Blockly.FieldVariable.dropdownCreate.call(this);
            return options.filter((opt: any) => opt[1] != Blockly.DELETE_VARIABLE_ID);
        }
        
    }
}