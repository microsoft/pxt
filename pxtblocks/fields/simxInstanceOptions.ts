import type * as Blockly from "blockly";

/**
 * The value of the entry that ends the dropdown of a fixed-instance parameter
 * whose instances a simulator extension's editor tab creates. It is not a
 * qualified name, so it never equals the value of an instance.
 */
export const SIMX_CREATE_OPTION_VALUE = "@simxcreate@";

/**
 * Returns the options of the dropdown of a fixed-instance parameter: the
 * options of the type's instances, in their order, followed, if `createText` is
 * given, by one entry showing `createText` whose value is
 * `SIMX_CREATE_OPTION_VALUE`.
 * @param instances the options of the type's instances
 * @param createText the text of the entry asking for a new instance; undefined if no editor tab creates the type's instances here
 */
export function getSimxInstanceDropdownOptions(instances: Blockly.MenuOption[], createText: string | undefined): Blockly.MenuOption[] {
    return createText === undefined ? instances.slice() : [...instances, [createText, SIMX_CREATE_OPTION_VALUE]];
}
