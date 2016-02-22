enum DigitalPins {
    //% enumval=uBit.io.P0
    P0,
    //% enumval=uBit.io.P1
    P1,
    //% enumval=uBit.io.P2
    P2,
    //% enumval=uBit.io.P3
    P3,
    //% enumval=uBit.io.P4
    P4,
    //% enumval=uBit.io.P5
    P5,
    //% enumval=uBit.io.P6
    P6,
    //% enumval=uBit.io.P7
    P7,
    //% enumval=uBit.io.P8
    P8,
    //% enumval=uBit.io.P9
    P9,
    //% enumval=uBit.io.P10
    P10,
    //% enumval=uBit.io.P11
    P11,
    //% enumval=uBit.io.P12
    P12,
    //% enumval=uBit.io.P13
    P13,
    //% enumval=uBit.io.P14
    P14,
    //% enumval=uBit.io.P15
    P15,
    //% enumval=uBit.io.P16
    P16,
    //% enumval=uBit.io.P19
    P19,
    //% enumval=uBit.io.P20
    P20,
}

enum AnalogPins {
    //% enumval=uBit.io.P0
    P0,
    //% enumval=uBit.io.P1
    P1,
    //% enumval=uBit.io.P2
    P2,
    //% enumval=uBit.io.P3
    P3,
    //% enumval=uBit.io.P4
    P4,
    //% enumval=uBit.io.P10
    P10,
}


namespace pins {
    /**
      * Set a pin or connector value to either 0 or 1.
      * @param name TODO
      * @param value TODO
      */
    //% help=functions/digital-write-pin weight=48 shim=micro_bit::digitalWritePin async
    export function digitalWritePin(name: DigitalPins, value: number): void { }

    /**
     * Read the specified pin or connector as either 0 or 1
     * @param name TODO
     */
    //% help=functions/digital-read-pin weight=49 shim=micro_bit::digitalReadPin async
    export function digitalReadPin(name: DigitalPins): number { return 0; }

    /**
     * Read the connector value as analog, that is, as a value comprised between 0 and 1023.
     * @param name TODO
     */
    //% help=functions/analog-read-pin weight=47 shim=micro_bit::analogReadPin async
    export function analogReadPin(name: AnalogPins): number { return 0; }

    /**
     * Set the connector value as analog. Value must be comprised between 0 and 1023.
     * @param name TODO
     * @param value TODO
     */
    //% help=functions/analog-write-pin weight=46 shim=micro_bit::analogWritePin async
    export function analogWritePin(name: AnalogPins, value: number): void { }

    /**
     * Configures the Pulse-width modulation (PWM) of the analog output to the given value in **microseconds** or `1/1000` milliseconds.
     * If this pin is not configured as an analog output (using `analog write pin`), the operation has no effect.
     * @param pin TODO
     * @param micros TODO
     */
    //% shim=micro_bit::setAnalogPeriodUs async help=functions/analog-set-period weight=10
    export function analogSetPeriod(pin: AnalogPins, micros: number): void { }

    /**
     * Sets the pin used when using `pins->analog pitch`.
     * @param name TODO
     */
    //% shim=micro_bit::enablePitch async help=functions/analog-set-pitch weight=12
    export function analogSetPitchPin(name: AnalogPins): void { }

    /**
     * Emits a Pulse-width modulation (PWM) signal to the current pitch pin. Use `analog set pitch pin` to define the pitch pin.
     * @param frequency TODO
     * @param ms TODO
     */
    //% shim=micro_bit::pitch help=functions/analog-pitch weight=14
    export function analogPitch(frequency: number, ms: number): void { }

    /**
     * Re-maps a number from one range to another. That is, a value of ``from low`` would get mapped to ``to low``, a value of ``from high`` to ``to high``, values in-between to values in-between, etc.
     * @param value TODO
     * @param fromLow TODO
     * @param fromHigh TODO
     * @param toLow TODO
     * @param toHigh TODO
     */
    //% help=functions/map weight=40
    export function map(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number): number {
        let r: number;
        return ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
    }

    /**
     * Writes a value to the servo, controlling the shaft accordingly. On a standard servo, this will set the angle of the shaft (in degrees), moving the shaft to that orientation. On a continuous rotation servo, this will set the speed of the servo (with ``0`` being full-speed in one direction, ``180`` being full speed in the other, and a value near ``90`` being no movement).
     * @param name TODO
     * @param value TODO
     */
    //% help=functions/servo-write-pin weight=44 shim=micro_bit::servoWritePin async
    export function servoWritePin(name: AnalogPins, value: number): void { }

    /**
     * Configures this IO pin as an analog/pwm output, configures the period to be 20 ms, and sets the pulse width, based on the value it is given **microseconds** or `1/1000` milliseconds.
     * @param pin TODO
     * @param micros TODO
     */
    //% shim=micro_bit::setServoPulseUs async help=functions/serial-set-pulse weight=10
    export function servoSetPulse(pin: AnalogPins, micros: number): void { }
}