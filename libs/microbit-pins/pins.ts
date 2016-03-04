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


//% color=351 weight=30
namespace pins {
    /**
     * Read the specified pin or connector as either 0 or 1
     * @param name pin to read from
     */
    //% help=functions/digital-read-pin weight=30 shim=micro_bit::digitalReadPin
    //% blockId=device_get_digital_pin block="digital read|pin %name" blockGap=8
    export function digitalReadPin(name: DigitalPins): number {
        
        return 0;
    }

    /**
      * Set a pin or connector value to either 0 or 1.
      * @param name pin to write to
      * @param value value to set on the pin, eg: 1,0
      */
    //% help=functions/digital-write-pin weight=29 shim=micro_bit::digitalWritePin
    //% blockId=device_set_digital_pin block="digital write|pin %name|to %value"
    export function digitalWritePin(name: DigitalPins, value: number): void { }

    /**
     * Read the connector value as analog, that is, as a value comprised between 0 and 1023.
     * @param name pin to write to
     */
    //% help=functions/analog-read-pin weight=25 shim=micro_bit::analogReadPin
    //% blockId=device_get_analog_pin block="analog read|pin %name" blockGap="8" 
    export function analogReadPin(name: AnalogPins): number {
        return 0;
    }

    /**
     * Set the connector value as analog. Value must be comprised between 0 and 1023.
     * @param name pin name to write to
     * @param value value to write to the pin between ``0`` and ``1023``. eg:1023,0
     */
    //% help=functions/analog-write-pin weight=24 shim=micro_bit::analogWritePin
    //% blockId=device_set_analog_pin block="analog write|pin %name|to %value" blockGap=8
    export function analogWritePin(name: AnalogPins, value: number): void { }

    /**
     * Configures the Pulse-width modulation (PWM) of the analog output to the given value in **microseconds** or `1/1000` milliseconds.
     * If this pin is not configured as an analog output (using `analog write pin`), the operation has no effect.
     * @param pin analog pin to set period to
     * @param micros period in micro seconds. eg:20000
     */
    //% shim=micro_bit::setAnalogPeriodUs help=functions/analog-set-period weight=23
    //% blockId=device_set_analog_period block="analog set period|pin %pin|to (µs)%micros" 
    export function analogSetPeriod(pin: AnalogPins, micros: number): void { }

    /**
     * Writes a value to the servo, controlling the shaft accordingly. On a standard servo, this will set the angle of the shaft (in degrees), moving the shaft to that orientation. On a continuous rotation servo, this will set the speed of the servo (with ``0`` being full-speed in one direction, ``180`` being full speed in the other, and a value near ``90`` being no movement).
     * @param name pin to write to
     * @param value angle or rotation speed, eg:180,90,0
     */
    //% help=functions/servo-write-pin weight=20 shim=micro_bit::servoWritePin
    //% blockId=device_set_servo_pin block="servo write|pin %name|to %value" blockGap=8
    export function servoWritePin(name: AnalogPins, value: number): void { }

    /**
     * Configures this IO pin as an analog/pwm output, configures the period to be 20 ms, and sets the pulse width, based on the value it is given **microseconds** or `1/1000` milliseconds.
     * @param pin pin name
     * @param micros pulse duration in micro seconds, eg:1500
     */
    //% shim=micro_bit::setServoPulseUs help=functions/serial-set-pulse weight=19
    //% blockId=device_set_servo_pulse block="servo set pulse|pin %value|to (µs) %micros"
    export function servoSetPulse(pin: AnalogPins, micros: number): void { }

    /**
     * Re-maps a number from one range to another. That is, a value of ``from low`` would get mapped to ``to low``, a value of ``from high`` to ``to high``, values in-between to values in-between, etc.
     * @param value value to map in ranges
     * @param fromLow the lower bound of the value's current range
     * @param fromHigh the upper bound of the value's current range, eg: 1023
     * @param toLow the lower bound of the value's target range
     * @param toHigh the upper bound of the value's target range, eg: 4
     */
    //% help=functions/map weight=15
    //% blockId=math_map block="map %value|from low %fromLow|from high %fromHigh|to low %toLow|to high %toHigh"
    export function map(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number): number {
        return ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow;
    }

    /**
     * Sets the pin used when using `pins->analog pitch`.
     * @param name TODO
     */
    //% shim=micro_bit::enablePitch help=functions/analog-set-pitch weight=12
    export function analogSetPitchPin(name: AnalogPins): void { }

    /**
     * Emits a Pulse-width modulation (PWM) signal to the current pitch pin. Use `analog set pitch pin` to define the pitch pin.
     * @param frequency TODO
     * @param ms TODO
     */
    //% shim=micro_bit::pitch help=functions/analog-pitch weight=14 async
    export function analogPitch(frequency: number, ms: number): void { }
}
