
//% color=#D83B01
namespace turtle {
    /**
     * Turns by an angle between 0 and 180
     */
    //% block="turn %angle=protractorPicker"
    export function turn(angle: number) {

    }

    /**
     * A field editor that displays a protractor
     */
    //% blockId=protractorPicker block="%angle"
    //% shim=TD_ID
    //% angle.fieldEditor=protractor
    //% angle.fieldOptions.decompileLiterals=1    
    //% colorSecondary="#FFFFFF"
    //% blockHidden=1
    export function __protractor(angle: number) {
        return angle;
    }
}
