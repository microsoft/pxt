/// <reference path="../../built/pxtlib.d.ts" />

import * as Blockly from "blockly";
import { FieldDropdown } from "./field_dropdown";
import { FieldCustom, FieldCustomDropdownOptions } from "./field_utils";
import { getFixedInstanceDropdownOptions } from "./symbolDropdownOptions";

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
 * asks to edit the instance the field holds. It is not a qualified name, so it
 * never equals the value of an instance.
 */
export const OPEN_INSTANCE_OPTION_VALUE = "@openinstance@";

/**
 * The value of the entry of the dropdown of a fixed-instance parameter that
 * says the type has no instances yet, listed alone when there are none and no
 * other entry is offered. It is not a qualified name, so it never equals the
 * value of an instance.
 */
export const NO_INSTANCE_OPTION_VALUE = "@noinstance@";

/**
 * Returns the options of the dropdown of a fixed-instance parameter: the
 * options of the type's instances, in their order, then, if `editText` or
 * `createText` is given, the entries given: one showing `editText` whose
 * value is `OPEN_INSTANCE_OPTION_VALUE`, then one showing `createText` whose
 * value is `CREATE_INSTANCE_OPTION_VALUE`, after a separator when there are
 * instances to separate them from. With no instances and neither entry given,
 * it returns one entry showing `emptyText` whose value is
 * `NO_INSTANCE_OPTION_VALUE`, so the list is never empty.
 * @param instances the options of the type's instances
 * @param editText the text of the entry asking to edit the instance the field holds; undefined if the editor cannot open it here
 * @param createText the text of the entry asking for a new instance; undefined if the editor cannot create the type's instances here
 * @param emptyText the text of the entry saying the type has no instances yet
 */
export function getInstanceDropdownOptions(instances: Blockly.MenuOption[], editText: string | undefined, createText: string | undefined, emptyText: string): Blockly.MenuOption[] {
    const commands: Blockly.MenuOption[] = [];
    if (editText !== undefined) commands.push([editText, OPEN_INSTANCE_OPTION_VALUE]);
    if (createText !== undefined) commands.push([createText, CREATE_INSTANCE_OPTION_VALUE]);
    if (!commands.length) return instances.length ? instances.slice() : [[emptyText, NO_INSTANCE_OPTION_VALUE]];
    return instances.length ? [...instances, Blockly.FieldDropdown.SEPARATOR, ...commands] : commands;
}

/**
 * The dropdown of a fixed-instance parameter whose instances the editor can
 * create. Each time it opens, it lists the type's instances the current API
 * info declares, then, after a separator, an entry asking to edit the
 * instance the field holds, while the editor can open it
 * (`pxt.react.canOpenInstance`), and an entry asking for a new instance, while
 * the editor can create one (`pxt.react.canCreateInstance`). Picking either
 * entry keeps the field's value; the first asks the editor to open the
 * instance (`pxt.react.openInstance`), the second to create one
 * (`pxt.react.createInstance`). With no instances and neither entry offered,
 * it lists one entry saying the type has none yet, and picking it changes
 * nothing; that entry may be the field's value while the type has no
 * instances.
 *
 * Options: `data`, the options of the type's instances, listed while
 * `getBlocksInfo` is not given or returns undefined; `type`, the type's fully
 * qualified name; `blocksInfo`, the API info that declares the type;
 * `getBlocksInfo`, returning the current API info; `defaultValue`, the value
 * of the instance listed first. The field's value is kept when the current
 * API info no longer declares it.
 */
export class FieldInstanceDropdown extends FieldDropdown implements FieldCustom {
    public isFieldCustom_ = true;
    // the fully qualified name of the fixed-instance type the field picks an instance of
    protected typeQName: string;

    constructor(text: string, options: FieldCustomDropdownOptions, validator?: Blockly.FieldValidator) {
        super(createMenuGenerator(options, getTypeName(options.blocksInfo, options.type), new pxt.ImageConverter()), validator);
        this.typeQName = options.type;
    }

    protected onItemSelected_(menu: Blockly.Menu, menuItem: Blockly.MenuItem) {
        const value = menuItem.getValue();
        if (value === CREATE_INSTANCE_OPTION_VALUE)
            pxt.react.createInstance?.(this.typeQName);
        else if (value === OPEN_INSTANCE_OPTION_VALUE)
            pxt.react.openInstance?.(this.getValue());
        else if (value !== NO_INSTANCE_OPTION_VALUE)
            super.onItemSelected_(menu, menuItem);
    }
}

// Lists the options of the type's instances, built with `imgConv` from the
// API info `getBlocksInfo` returns, else `data`, then the entry asking to edit
// the instance the field holds, while the editor can open it, and the entry
// asking for a new instance, while the editor can create the type's instances,
// or, with none of these to list, the entry saying the type has no instances
// yet, all read each time the dropdown opens.
function createMenuGenerator(options: FieldCustomDropdownOptions, typeName: string, imgConv: pxt.ImageConverter): Blockly.MenuGeneratorFunction {
    const { data, type: typeQName, getBlocksInfo, defaultValue } = options;
    return function (this: Blockly.FieldDropdown) {
        const blocksInfo = getBlocksInfo?.();
        const instances: Blockly.MenuOption[] = blocksInfo ? getFixedInstanceDropdownOptions(blocksInfo, typeQName, defaultValue, imgConv) : data;
        const value = this.getValue();
        const label = value && pxt.react.canOpenInstance?.(value) ? getInstanceLabel(instances, value) : undefined;
        return getInstanceDropdownOptions(instances,
            label !== undefined ? lf("Edit {0}...", label) : undefined,
            pxt.react.canCreateInstance?.(typeQName) ? lf("New {0}...", typeName) : undefined,
            lf("No {0} yet", typeName));
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

// The name of the type the entries asking for a new instance and saying the type
// has none yet use: the type's `block` attribute, else its unqualified name in
// lower case.
function getTypeName(blocksInfo: pxtc.BlocksInfo | undefined, typeQName: string): string {
    const block = blocksInfo?.apis.byQName[typeQName]?.attributes.block;
    return block || typeQName.slice(typeQName.lastIndexOf(".") + 1).toLowerCase();
}
