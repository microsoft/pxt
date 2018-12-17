//% color=#0078D7 weight=100
namespace userEnums {
    /**
     * Test enum define block
     */
    //% shim=ENUM_GET
    //% blockId=enum_user_shim block="%arg"
    //% enumName="PlainOldEnum" enumMemberName="whatever" enumPromptHint="whatever" enumInitialMembers="whatever"
    export function userEnumShim(arg: number) {
        return arg;
    }

    /**
     * Test enum define block with a start value set
     */
    //% shim=ENUM_GET
    //% blockId=enum_user_shim_with_start_value block="%arg"
    //% enumName="EnumWithStart" enumMemberName="whatever" enumPromptHint="whatever" enumInitialMembers="whatever"
    //% enumStartValue=3
    export function userEnumShimStartValue(arg: number) {
        return arg;
    }

    /**
     * Test enum define block for a bit mask
     */
    //% shim=ENUM_GET
    //% blockId=enum_user_shim_bit_mask block="%arg"
    //% enumName="EnumOfFlags" enumMemberName="whatever" enumPromptHint="whatever"  enumInitialMembers="whatever"
    //% enumIsBitMask=true
    export function userEnumShimBitMask(arg: number) {
        return arg;
    }

    /**
     * Test enum define block for a hash
     */
    //% shim=ENUM_GET
    //% blockId=enum_user_shim_hash block="%arg"
    //% enumName="EnumHash" enumMemberName="whatever" enumPromptHint="whatever"  enumInitialMembers="whatever,dontcare"
    //% enumIsHash=true
    export function userEnumShimHash(arg: number) {
        return arg;
    }
}