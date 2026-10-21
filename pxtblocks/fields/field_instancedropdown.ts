/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldDropdown } from "./field_dropdown";
import { FieldCustom, FieldCustomDropdownOptions } from "./field_utils";

/** The field editor id of `FieldInstanceDropdown`. */
export const INSTANCE_DROPDOWN_FIELD = "instancedropdown";

/**
 * The value of the entry that ends the dropdown of a fixed-instance parameter
 * whose instances the editor can create. It is not a qualified name, so it
 * never equals the value of an instance.
 */
export const CREATE_INSTANCE_OPTION_VALUE = "@createinstance@";

/**
 * Returns the options of the dropdown of a fixed-instance parameter: the
 * options of the type's instances, in their order, followed, if `createText` is
 * given, by one entry showing `createText` whose value is
 * `CREATE_INSTANCE_OPTION_VALUE`.
 * @param instances the options of the type's instances
 * @param createText the text of the entry asking for a new instance; undefined if the editor cannot create the type's instances here
 */
export function getInstanceDropdownOptions(instances: Blockly.MenuOption[], createText: string | undefined): Blockly.MenuOption[] {
    return createText === undefined ? instances.slice() : [...instances, [createText, CREATE_INSTANCE_OPTION_VALUE]];
}

/**
 * The dropdown of a fixed-instance parameter whose instances the editor can
 * create. It lists the type's instances and, while the editor can create one
 * (`pxt.react.canCreateInstance`), ends in an entry asking for a new one;
 * picking the entry keeps the field's value and asks the editor to create an
 * instance (`pxt.react.createInstance`).
 *
 * Options: `data`, the options of the type's instances; `type`, the type's
 * fully qualified name; `blocksInfo`, the API info that declares the type.
 */
export class FieldInstanceDropdown extends FieldDropdown implements FieldCustom {
    public isFieldCustom_ = true;
    // the fully qualified name of the fixed-instance type the field picks an instance of
    protected typeQName: string;

    constructor(text: string, options: FieldCustomDropdownOptions, validator?: Blockly.FieldValidator) {
        super(createMenuGenerator(options.data, options.type, getTypeName(options.blocksInfo, options.type)), validator);
        this.typeQName = options.type;
    }

    protected onItemSelected_(menu: Blockly.Menu, menuItem: Blockly.MenuItem) {
        if (menuItem.getValue() === CREATE_INSTANCE_OPTION_VALUE)
            pxt.react.createInstance?.(this.typeQName);
        else
            super.onItemSelected_(menu, menuItem);
    }
}

// Lists `instances`, then, while the editor can create the type's instances,
// the entry asking for a new one, read each time the dropdown opens.
function createMenuGenerator(instances: Blockly.MenuOption[], typeQName: string, typeName: string): Blockly.MenuGeneratorFunction {
    return () => getInstanceDropdownOptions(instances,
        pxt.react.canCreateInstance?.(typeQName) ? lf("New {0}...", typeName) : undefined);
}

// The name of the type the entry asking for a new instance uses: the type's
// `block` attribute, else its unqualified name in lower case.
function getTypeName(blocksInfo: pxtc.BlocksInfo | undefined, typeQName: string): string {
    const block = blocksInfo?.apis.byQName[typeQName]?.attributes.block;
    return block || typeQName.slice(typeQName.lastIndexOf(".") + 1).toLowerCase();
}
