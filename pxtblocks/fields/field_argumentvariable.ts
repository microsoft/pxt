namespace pxtblockly {
    /** 
     * Subclass of FieldVariable to filter out the "delete" option when 
     * variables are part of a function argument (or else the whole function
     * gets deleted).
    */
    export class FieldArgumentVariable extends Blockly.FieldVariable {
        constructor(varName: string) {
            super(varName);
            this.menuGenerator_ = this.dropdownCreate;
        }
        dropdownCreate(): any {
            const options = Blockly.FieldVariable.dropdownCreate.call(this);
            return options.filter((opt: any) => opt[1] != Blockly.DELETE_VARIABLE_ID);
        }
    }
}
