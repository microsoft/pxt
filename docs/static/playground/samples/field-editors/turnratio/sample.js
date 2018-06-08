namespace motors {
    /**
     * Steers two motors by the given ratio
     */
    //% block="steer %turnRatio=turnRatioPicker"
    //% turnRatio.min=-200 turnRatio=200
    export function steer(turnRatio: number) {
    }


    /**
     * A turn ratio picker
     * @param turnratio the turn ratio, eg: 0
     */
    //% blockId=turnRatioPicker block="%turnratio" shim=TD_ID
    //% turnratio.fieldEditor="turnratio" colorSecondary="#FFFFFF"
    //% blockHidden=1 turnRatio.fieldOptions.decompileLiterals=1
    export function __turnRatioPicker(turnratio: number): number {
        return turnratio;
    }
}