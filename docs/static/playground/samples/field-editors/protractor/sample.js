
//% color=#D83B01
namespace turtle {
    /**
     * Turns by an angle between 0 and 180
     */
    //% block="turn %angle=protractor"
    export function turn(angle: number) {

    }

    /**
     * A field editor that displays a protractor
     */
    //% blockId=protractor block="%angle"
    //% shim=TD_ID
    //% angle.fieldEditor=protractor
    //% colorSecondary="#FFFFFF"
    //% weight=0 blockHidden=1 speed.fieldOptions.decompileLiterals=1    
    export function __protractor(angle: number) {
        return angle;
    }
}
