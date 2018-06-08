namespace motors {
    /**
     * Runs the motor at the given speed
     */
    //% block="crickit run at %speed=speedPicker \\%"
    //% speed.defl=50
    //% speed.min=-100 speed.max=100
    export function run(speed: number) {

    }

    /**
     * A speed picker
     * @param speed the speed, eg: 50
     */
    //% blockId=speedPicker block="%speed" shim=TD_ID
    //% speed.fieldEditor="speed" colorSecondary="#FFFFFF"
    //% blockHidden=1 speed.fieldOptions.decompileLiterals=1
    export function __speedPicker(speed: number): number {
        return speed;
    }
}