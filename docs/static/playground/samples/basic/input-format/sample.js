enum MotorShaftDirection {
    //% block="clockwise"
    Clockwise,
    //% block="counter-clockwise"
    CounterClockwise
}

//% color="170"
namespace sample {
    // Use inlineInputMode=inline to force inputs to appear
    // on a single line

    //% block="map $value|from low $fromLow|high $fromHigh|to low $toLow|high $toHigh"
    export function mapBig(value: number,
        fromLow: number, fromHigh: number,
        toLow: number, toHigh: number): number {

        return ((value - fromLow) * (toHigh - toLow))
            / (fromHigh - fromLow) + toLow;
    }

    //% block="map $value|from low $fromLow|high $fromHigh|to low $toLow|high $toHigh"
    //% inlineInputMode=inline
    export function map(value: number,
        fromLow: number, fromHigh: number,
        toLow: number, toHigh: number): number {

        return ((value - fromLow) * (toHigh - toLow))
            / (fromHigh - fromLow) + toLow;
    }

    // Use inlineInputMode=external to force inputs to wrap
    // across several lines

    //% block="magnitude of 3d vector | at x $x and y $y and z $z"
    //% inlineInputMode=external
    export function mag3d(x: number, y: number, z: number): number {
        return Math.sqrt(x * x + y * y + z * z);
    }

    // Use expandableArgumentMode=toggle to collapse or
    // expand input parameters

    /**
     * Run a motor
     * @param directon to turn the motor shaft in
     * @param duration in milliseconds to run the
     *      motor the alarm sound
     */
    //% block="run the motor || $direction for $duration ms"
    //% duration.shadow=timePicker
    //% expandableArgumentMode="toggle"
    //% direction.defl=MotorShaftDirection.CounterClockwise
    //% duration.defl=200
    export function runMotor(
        direction?: MotorShaftDirection,
        duration?: number) {

    }

    // Use expandableArgumentMode=enabled to collapse or
    // expand EACH input parameter

    /**
     * Set the motor speed and direction
     * @param directon to turn the motor shaft in
     * @param speed of the motor in RPM
     * @param duration in milliseconds to run the
     *      motor the alarm sound
     */
    //% block="set the motor to run || $direction|at $speed|for $duration ms"
    //% duration.shadow=timePicker
    //% speed.min=0 speed.max=60
    //% expandableArgumentMode="enabled"
    //% direction.defl=MotorShaftDirection.Clockwise
    //% speed.defl=30
    //% duration.defl=2000
    export function setMotorSpeed(
        direction?: MotorShaftDirection,
        speed?: number,
        duration?: number) {

    }

}