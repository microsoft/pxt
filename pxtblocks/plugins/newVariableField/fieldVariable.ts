import * as Blockly from "blockly";

/**
 * This is the same as the Blockly variable field but with the addition
 * of a "New Variable" option in the dropdown
 */
export class FieldVariable extends Blockly.FieldVariable {
    static CREATE_VARIABLE_ID = "CREATE_VARIABLE";

    static dropdownCreate(this: FieldVariable): Blockly.MenuOption[] {
        const options = Blockly.FieldVariable.dropdownCreate.call(this);

        options.push([Blockly.Msg['NEW_VARIABLE_DROPDOWN'], FieldVariable.CREATE_VARIABLE_ID]);
        // options.push([undefined, 'SEPARATOR']);

        return options;
    }

    constructor(
        varName: string | null | typeof Blockly.Field.SKIP_SETUP,
        validator?: Blockly.FieldVariableValidator,
        variableTypes?: string[],
        defaultType?: string,
        config?: Blockly.FieldVariableConfig,
    ) {
        super(varName, validator, variableTypes, defaultType, config);

        this.menuGenerator_ = FieldVariable.dropdownCreate;
    }

    protected override onItemSelected_(menu: Blockly.Menu, menuItem: Blockly.MenuItem) {
        if (this.sourceBlock_ && !this.sourceBlock_.isDeadOrDying()) {
            const id = menuItem.getValue();
            if (id === FieldVariable.CREATE_VARIABLE_ID) {
                Blockly.Variables.createVariableButtonHandler(this.sourceBlock_.workspace, name => {
                    const newVar = this.sourceBlock_.workspace.getVariable(name);

                    if (newVar) {
                        this.setValue(newVar.getId());
                    }
                });
                return;
            }
        }

        super.onItemSelected_(menu, menuItem);
    }
}

// Override the default variable field
Blockly.fieldRegistry.unregister("field_variable");
Blockly.fieldRegistry.register("field_variable", FieldVariable);
