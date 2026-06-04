namespace robot {
    /**
     * Steers the robot.
     */
    //% weight=97
    //% group="Motors"
    //% block="robot motor steer $turnRatio at $speed \\% || for $duration ms"
    //% blockid="mbitrobotmotorsteer"
    //% expandableArgumentMode="toggle"
    //% speed.defl=100
    //% speed.min=-100
    //% speed.max=100
    //% speed.shadow=speedPicker
    //% turnRatio.shadow=turnRatioPicker
    //% turnRatio.min=-200
    //% turnRatio.max=200
    //% duration.shadow=timePicker
    export function motorSteer(
        turnRatio: number = 0,
        speed: number = 100,
        duration?: number
    ) {

    }
}