namespace pxtblockly {
    export class FieldVariableDropdown extends Blockly.FieldVariable {
        constructor(varName: string) {
            super(varName);
            this.menuGenerator_ = this.customDropdownCreate;
        }
        customDropdownCreate(): any {
            const options = super.dropdownCreate();
            return options.filter((opt) => opt[1] != Blockly.DELETE_VARIABLE_ID);
        }
        
    }
}