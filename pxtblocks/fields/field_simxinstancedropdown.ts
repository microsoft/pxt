/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldDropdown } from "./field_dropdown";
import { FieldCustom, FieldCustomDropdownOptions } from "./field_utils";
import { getSimxInstanceDropdownOptions, SIMX_CREATE_OPTION_VALUE } from "./simxInstanceOptions";

/** The field editor id of `FieldSimxInstanceDropdown`. */
export const SIMX_INSTANCE_DROPDOWN_FIELD = "simxinstancedropdown";

/**
 * The dropdown of a fixed-instance parameter whose instances a simulator
 * extension's editor tab creates. It lists the type's instances and, while the
 * editor offers that tab, ends in an entry asking for a new one; picking the
 * entry keeps the field's value and asks the editor to show the tab and have
 * it create an instance (`pxt.react.createSimxInstance`).
 *
 * Options: `data`, the options of the type's instances; `type`, the type's
 * fully qualified name; `blocksInfo`, the API info that declares the type.
 */
export class FieldSimxInstanceDropdown extends FieldDropdown implements FieldCustom {
    public isFieldCustom_ = true;
    // the fully qualified name of the fixed-instance type the field picks an instance of
    protected typeQName: string;

    constructor(text: string, options: FieldCustomDropdownOptions, validator?: Blockly.FieldValidator) {
        super(createMenuGenerator(options.data, options.type, getTypeName(options.blocksInfo, options.type)), validator);
        this.typeQName = options.type;
    }

    protected onItemSelected_(menu: Blockly.Menu, menuItem: Blockly.MenuItem) {
        if (menuItem.getValue() === SIMX_CREATE_OPTION_VALUE)
            pxt.react.createSimxInstance?.(this.typeQName);
        else
            super.onItemSelected_(menu, menuItem);
    }
}

// Lists `instances`, then, while the editor offers the tab creating the type's
// instances, the entry asking for a new one, read each time the dropdown opens.
function createMenuGenerator(instances: Blockly.MenuOption[], typeQName: string, typeName: string): Blockly.MenuGeneratorFunction {
    return () => getSimxInstanceDropdownOptions(instances,
        pxt.react.canCreateSimxInstance?.(typeQName) ? lf("New {0}...", typeName) : undefined);
}

// The name of the type the entry asking for a new instance uses: the type's
// `block` attribute, else its unqualified name in lower case.
function getTypeName(blocksInfo: pxtc.BlocksInfo | undefined, typeQName: string): string {
    const block = blocksInfo?.apis.byQName[typeQName]?.attributes.block;
    return block || typeQName.slice(typeQName.lastIndexOf(".") + 1).toLowerCase();
}
