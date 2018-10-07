//% color="#AA278D"
namespace language {
    /**
     * This function will be used to create the shadow block that will
     * hold the dropdown values for the enum. This function will never
     * actually appear in user code, it is just for defining the block.
     * To ensure that the function does not show up in intellisense add
     * an "_" to the beginning of its name
     *
     * All of the listed comment attributes are required (including shim,
     * blockId, and block). The enum attributes work like this:
     *
     *   + enumName - The name of the enum. Must be a valid JavaScript identifier
     *
     *   + enumMemberName - The name that will be used to refer to members of
     *       the enum in dialogs and on the block. Should be singular
     *
     *   + enumPromptHint - The hint that will appear in the dialog for creating
     *       new members of the enum
     *
     *   + enumInitialMembers - These are the enum values that will always be added
     *       to the project when this block is used. The first value will be the one
     *       selected by default. Should be comma or whitespace separated and all
     *       valid JavaScript identifiers. Must have at least one value
     *
     *   + enumStartValue (optional) - A positive integer that specifies the
     *       lowest value that will be emitted when going from blocks to TypeScript
     *
     * To see the effect of these values, drag one of the blocks in the toolbox onto
     * the workspace and expand the dropdown. The "Add a new ___..." option will open
     * a sample dialog for creating new enum members.
     *
     * Enums are emitted at the top of user code only if the block is used in the
     * project (or if it was used in the past). If the user changes the value of
     * the enum in TypeScript then those changes should be persisted across compile/decompile.
     */
    //% shim=ENUM_GET
    //% blockId=color_enum_shim
    //% block="Color $arg"
    //% enumName="Colors"
    //% enumMemberName="color"
    //% enumPromptHint="e.g. Green, Orange, ..."
    //% enumInitialMembers="Red, Blue, Yellow"
    export function _colorEnumShim(arg: number) {
        // This function should do nothing, but must take in a single
        // argument of type number and return a number value.
        return arg;
    }


    /**
     * If the enumIsBitMask flag is set, then values will instead be emitted
     * as powers of 2 in the following format:
     *
     *   enum Flags {
     *     A = 1 << 0,
     *     B = 1 << 1,
     *     C = 1 << 2
     *   }
     *
     * Note that this enum starts at 1 instead of 0!
     */
    //% shim=ENUM_GET
    //% blockId=flag_enum_shim
    //% block="Flag $arg"
    //% enumName="Flags"
    //% enumMemberName="flag"
    //% enumPromptHint="e.g. B, C, ..."
    //% enumInitialMembers="A"
    //% enumIsBitMask=true
    export function _flagEnumShim(arg: number) {
        // This function should do nothing, but must take in a single
        // argument of type number and return a number value.
        return arg;
    }


    /**
     * In a function that uses an enum shadow block, the argument it takes in
     * should be of type "number" (not the enum type)
     */
    //% blockId=show_color
    //% block="show $color"
    //% color.shadow="color_enum_shim"
    export function showColor(color: number) {

    }
}