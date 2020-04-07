enum MotorShaftDirection {
    //% block="clockwise"
    Clockwise,
    //% block="counter-clockwise"
    CounterClockwise
}

namespace sample {
    // use the inlineInputMode=inline to force inputs to appear on a single line

    //% block="map $value|from low $fromLow|high $fromHigh|to low $toLow|high $toHigh"
    export function mapBig(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number): number {
        return ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
    }


    //% block="map $value|from low $fromLow|high $fromHigh|to low $toLow|high $toHigh"
    //% inlineInputMode=inline
    export function map(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number): number {
        return ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
    }

    // use the expandableArgumentMode=toggle to collapse or expand input parameters

    /**
     * Run a motor
     * @param directon to turn the motor shaft in, eg: MotorShaftDirection.Clockwise
     * @param duration in milliseconds to run the motor the alarm sound, eg: 2000    
     */
    //% block="run the motor || %direction for %duration ms"
    //% duration.shadow=timePicker
    //% expandableArgumentMode="toggle"
    export function runMotor(direction: MotorShaftDirection, duration: number) {
     
    }
    
    // Use expandableArgumentMode=enabeled to collapse or expand EACH input parameter

    /**
     * Set the motor speed and direction
     * @param directon to turn the motor shaft in, eg: MotorShaftDirection.Clockwise
     * @param speed of the motor in RPM, eg: 30
     * @param duration in milliseconds to run the motor the alarm sound, eg: 2000    
     */
    //% block="set the motor to run || %direction|at %speed|for %duration ms"
    //% duration.shadow=timePicker
    //% speed.min=0 speed.max=60
    //% expandableArgumentMode="enabled"
    export function setMotorSpeed(direction: MotorShaftDirection, speed: number, duration: number) {
     
    }
    
}