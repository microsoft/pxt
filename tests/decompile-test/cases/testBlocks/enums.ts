const enum MyEnum {
    //% blockIdentity="enumTest.enumShim"
    Value1,
    //% blockIdentity="enumTest.enumShim"
    Value2
}

namespace enumTest {

    /**
     * Enum shim (for shadow blocks)
     */
    //% shim=TD_ID
    //% blockId=enum_shim
    //% block="enum %enum"
    export function enumShim(value: MyEnum): number {
        return value;
    }


    /**
     * Enum event with no shadow block
     */
    //% blockId=enum_event
    //% block="event %enum"
    export function enumEvent(value: MyEnum, handler: () => void) {

    }

    /**
     * Enum API with no shadow block
     */
    //% blockId=enum_arg
    //% block="arg %enum"
    export function enumArg(value: MyEnum) {

    }

    /**
     * Enum API with a shadow block
     */
    //% blockId=enum_shadow_arg
    //% block="shadow %enum=enum_shim"
    export function enumShadowArg(value: number) {

    }

    //% shim=ENUM_GET
    //% blockId=enum_user_shim
    //% enumName="PlainOldEnum" enumMemberName="whatever" enumPromptHint="whatever" enumInitialMembers="whatever"
    export function userEnumShim(arg: number) {
        return arg;
    }

    //% shim=ENUM_GET
    //% blockId=enum_user_shim_with_start_value
    //% enumName="EnumWithStart" enumMemberName="whatever" enumPromptHint="whatever" enumInitialMembers="whatever"
    //% enumStartValue=3
    export function userEnumShimStartValue(arg: number) {
        return arg;
    }

    //% shim=ENUM_GET
    //% blockId=enum_user_shim_bit_mask
    //% enumName="EnumOfFlags" enumMemberName="whatever" enumPromptHint="whatever" enumInitialMembers="whatever"
    //% enumIsBitMask=true
    export function userEnumShimBitMask(arg: number) {
        return arg;
    }

    //% shim=ENUM_GET
    //% blockId=enum_user_shim_hash
    //% enumName="EnumOfFHash" enumMemberName="whatever" enumPromptHint="whatever" enumInitialMembers="whatever,dontcare"
    //% enumIsHash=true
    export function userEnumShimHash(arg: number) {
        return arg;
    }
}

namespace animation {
    export enum AnimationTypes {
        //% block="all"
        All,
        //% block="frame"
        ImageAnimation,
        //% block="path"
        MovementAnimation
    }

    /**
     * Stops all animations (simple and looping) of the specified type on a sprite
     * @param type the animation type to stop
     * @param sprite the sprite to filter animations by
     */
    //% blockId=stop_animations
    //% block="stop %type animations"
    //% group="Animate"
    export function stopAnimation(type: AnimationTypes) {
    }
}