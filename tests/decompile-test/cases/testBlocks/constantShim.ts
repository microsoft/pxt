/**
 * Test constants like Math.PI
 */
//% color=#5C2D91 weight=31
//% advanced=true
namespace constant {
    //% blockIdentity=constant._constant
    export const PI = 3.14;
    //% blockIdentity=constant._constant
    export const LN2 = 0;

    /**
     * Constants defined on the namespace
     */
    //% blockId=constant_dropdown block="%constant" constantShim
    //% shim=TD_ID weight=20 blockGap=8
    export function _constant(constant: number): number {
        return constant;
    }
}
