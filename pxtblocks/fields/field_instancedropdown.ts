/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldDropdown } from "./field_dropdown";
import { FieldCustom, FieldCustomDropdownOptions } from "./field_utils";

/** The field editor id of `FieldInstanceDropdown`. */
export const INSTANCE_DROPDOWN_FIELD = "instancedropdown";

/**
 * The value of the entry of the dropdown of a fixed-instance parameter that
 * asks for a new instance of the type. It is not a qualified name, so it never
 * equals the value of an instance.
 */
export const CREATE_INSTANCE_OPTION_VALUE = "@createinstance@";

/**
 * The value of the entry of the dropdown of a fixed-instance parameter that
 * asks to open the instance the field holds. It is not a qualified name, so it
 * never equals the value of an instance.
 */
export const OPEN_INSTANCE_OPTION_VALUE = "@openinstance@";

/**
 * Returns the options of the dropdown of a fixed-instance parameter: the
 * options of the type's instances, in their order, then, if `openText` or
 * `createText` is given, the entries given: one showing `openText` whose
 * value is `OPEN_INSTANCE_OPTION_VALUE`, then one showing `createText` whose
 * value is `CREATE_INSTANCE_OPTION_VALUE`, after a separator when there are
 * instances to separate them from.
 * @param instances the options of the type's instances
 * @param openText the text of the entry asking to open the instance the field holds; undefined if the editor cannot open it here
 * @param createText the text of the entry asking for a new instance; undefined if the editor cannot create the type's instances here
 */
export function getInstanceDropdownOptions(instances: Blockly.MenuOption[], openText: string | undefined, createText: string | undefined): Blockly.MenuOption[] {
    const commands: Blockly.MenuOption[] = [];
    if (openText !== undefined) commands.push([openText, OPEN_INSTANCE_OPTION_VALUE]);
    if (createText !== undefined) commands.push([createText, CREATE_INSTANCE_OPTION_VALUE]);
    if (!commands.length) return instances.slice();
    return instances.length ? [...instances, Blockly.FieldDropdown.SEPARATOR, ...commands] : commands;
}

/**
 * The dropdown of a fixed-instance parameter whose instances the editor can
 * create. It lists the type's instances, then, after a separator, an entry
 * asking to open the instance the field holds, while the editor can open it
 * (`pxt.react.canOpenInstance`), and an entry asking for a new instance, while
 * the editor can create one (`pxt.react.canCreateInstance`). Picking either
 * entry keeps the field's value; the first asks the editor to open the
 * instance (`pxt.react.openInstance`), the second to create one
 * (`pxt.react.createInstance`).
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
        const value = menuItem.getValue();
        if (value === CREATE_INSTANCE_OPTION_VALUE)
            pxt.react.createInstance?.(this.typeQName);
        else if (value === OPEN_INSTANCE_OPTION_VALUE)
            pxt.react.openInstance?.(this.getValue());
        else
            super.onItemSelected_(menu, menuItem);
    }
}

// Lists `instances`, then the entry asking to open the instance the field
// holds, while the editor can open it, and the entry asking for a new
// instance, while the editor can create the type's instances, read each time
// the dropdown opens.
function createMenuGenerator(instances: Blockly.MenuOption[], typeQName: string, typeName: string): Blockly.MenuGeneratorFunction {
    return function (this: Blockly.FieldDropdown) {
        const value = this.getValue();
        const label = value && pxt.react.canOpenInstance?.(value) ? getInstanceLabel(instances, value) : undefined;
        return getInstanceDropdownOptions(instances,
            label !== undefined ? lf("Open {0}...", label) : undefined,
            pxt.react.canCreateInstance?.(typeQName) ? lf("New {0}...", typeName) : undefined);
    };
}

// The label of the option among `instances` whose value is `value`: its text,
// or its image's alt text; undefined if no option has that value.
function getInstanceLabel(instances: Blockly.MenuOption[], value: string): string | undefined {
    for (const option of instances) {
        if (option === Blockly.FieldDropdown.SEPARATOR || option[1] !== value) continue;
        const label = option[0];
        return typeof label === "string" ? label : "alt" in label ? label.alt : undefined;
    }
    return undefined;
}

// The name of the type the entry asking for a new instance uses: the type's
// `block` attribute, else its unqualified name in lower case.
function getTypeName(blocksInfo: pxtc.BlocksInfo | undefined, typeQName: string): string {
    const block = blocksInfo?.apis.byQName[typeQName]?.attributes.block;
    return block || typeQName.slice(typeQName.lastIndexOf(".") + 1).toLowerCase();
}
