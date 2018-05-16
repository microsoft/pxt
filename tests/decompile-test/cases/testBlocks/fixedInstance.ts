//% fixedInstances
declare interface AnalogPin extends DigitalPin {
    /**
     * Read the connector value as analog, that is, as a value comprised between 0 and 1023.
     * @param name pin to write to
     */
    //% help=pins/analog-read weight=53
    //% blockId=device_get_analog_pin block="analog read|pin %name" blockGap="8"
    //% blockNamespace=pins
    //% name.fieldEditor="gridpicker"
    //% name.fieldOptions.width=220
    //% name.fieldOptions.columns=4 shim=AnalogPinMethods::analogRead
    analogRead(): number;

    /**
     * Set the connector value as analog. Value must be comprised between 0 and 1023.
     * @param name pin name to write to
     * @param value value to write to the pin between ``0`` and ``1023``. eg:1023,0
     */
    //% help=pins/analog-write weight=52
    //% blockId=device_set_analog_pin block="analog write|pin %name|to %value" blockGap=8
    //% blockNamespace=pins
    //% name.fieldEditor="gridpicker"
    //% name.fieldOptions.width=220
    //% name.fieldOptions.columns=4 shim=AnalogPinMethods::analogWrite
    analogWrite(value: number): void;
}

//% fixedInstances
declare interface DigitalPin {
    /**
     * Read a pin or connector as either 0 or 1
     * @param name pin to read from
     */
    //% help=pins/digital-read weight=61
    //% blockId=device_get_digital_pin block="digital read|pin %name" blockGap=8
    //% parts="slideswitch" trackArgs=0
    //% blockNamespace=pins
    //% name.fieldEditor="gridpicker"
    //% name.fieldOptions.width=220
    //% name.fieldOptions.columns=4 shim=DigitalPinMethods::digitalRead
    digitalRead(): boolean;

    /**
     * Set a pin or connector value to either 0 or 1.
     * @param name pin to write to
     * @param value value to set on the pin
     */
    //% help=pins/digital-write weight=60
    //% blockId=device_set_digital_pin block="digital write|pin %name|to %value"
    //% parts="led" trackArgs=0
    //% blockNamespace=pins
    //% name.fieldEditor="gridpicker"
    //% name.fieldOptions.width=220
    //% name.fieldOptions.columns=4 shim=DigitalPinMethods::digitalWrite
    digitalWrite(value: boolean): void;

    /**
     * Make this pin a digital input, and create events where the timestamp is the duration
     * that this pin was either ``high`` or ``low``.
     */
    //% help=pins/on-pulsed weight=16 blockGap=8
    //% blockId=pins_on_pulsed block="on|pin %pin|pulsed %pulse"
    //% blockNamespace=pins
    //% pin.fieldEditor="gridpicker"
    //% pin.fieldOptions.width=220
    //% pin.fieldOptions.columns=4 shim=DigitalPinMethods::onPulsed
    onPulsed(pulse: number, body: () => void): void;

    /**
     * Return the duration of a pulse in microseconds
     * @param name the pin which measures the pulse
     * @param value the value of the pulse (default high)
     * @param maximum duration in micro-seconds
     */
    //% blockId="pins_pulse_in" block="pulse in (µs)|pin %name|pulsed %value"
    //% weight=18 blockGap=8
    //% help="pins/pulse-in"
    //% blockNamespace=pins
    //% pin.fieldEditor="gridpicker"
    //% pin.fieldOptions.width=220
    //% pin.fieldOptions.columns=4 maxDuration.defl=2000000 shim=DigitalPinMethods::pulseIn
    pulseIn(value: number, maxDuration?: number): number;

    /**
     * Set the pull direction of this pin.
     * @param name pin to set the pull mode on
     * @param pull one of the mbed pull configurations: PullUp, PullDown, PullNone
     */
    //% help=pins/set-pull weight=17 blockGap=8
    //% blockId=device_set_pull block="set pull|pin %pin|to %pull"
    //% blockNamespace=pins
    //% name.fieldEditor="gridpicker"
    //% name.fieldOptions.width=220
    //% name.fieldOptions.columns=4 shim=DigitalPinMethods::setPull
    setPull(pull: number): void;
}

//% fixedInstances
declare interface PwmPin extends AnalogPin {
    /**
     * Set the Pulse-width modulation (PWM) period of the analog output. The period is in
     * **microseconds** or `1/1000` milliseconds.
     * If this pin is not configured as an analog output (using `analog write pin`), the operation has
     * no effect.
     * @param name analog pin to set period to
     * @param micros period in micro seconds. eg:20000
     */
    //% help=pins/analog-set-period weight=51
    //% blockId=device_set_analog_period block="analog set period|pin %pin|to (µs)%period"
    //% blockNamespace=pins
    //% name.fieldEditor="gridpicker"
    //% name.fieldOptions.width=220
    //% name.fieldOptions.columns=4 shim=PwmPinMethods::analogSetPeriod
    analogSetPeriod(period: number): void;

    /**
     * Write a value to the servo to control the rotation of the shaft. On a standard servo, this will
     * set the angle of the shaft (in degrees), moving the shaft to that orientation. On a continuous
     * rotation servo, this will set the speed of the servo (with ``0`` being full-speed in one
     * direction, ``180`` being full speed in the other, and a value near ``90`` being no movement).
     * @param name pin to write to
     * @param value angle or rotation speed, eg:180,90,0
     */
    //% help=pins/servo-write weight=41 group="Servo"
    //% blockId=device_set_servo_pin block="servo write|pin %name|to %value" blockGap=8
    //% parts=microservo trackArgs=0
    //% blockNamespace=pins
    //% name.fieldEditor="gridpicker"
    //% name.fieldOptions.width=220
    //% name.fieldOptions.columns=4 shim=PwmPinMethods::servoWrite
    servoWrite(value: number): void;

    /**
     * Set the pin for PWM analog output, make the period be 20 ms, and set the pulse width.
     * The pulse width is based on the value it is given **microseconds** or `1/1000` milliseconds.
     * @param name pin name
     * @param duration pulse duration in micro seconds, eg:1500
     */
    //% help=pins/servo-set-pulse weight=40 group="Servo" blockGap=8
    //% blockId=device_set_servo_pulse block="servo set pulse|pin %value|to (µs) %duration"
    //% blockNamespace=pins
    //% name.fieldEditor="gridpicker"
    //% name.fieldOptions.width=220
    //% name.fieldOptions.columns=4 shim=PwmPinMethods::servoSetPulse
    servoSetPulse(duration: number): void;
}

declare namespace pins2 {
    // pin-pads
    //% fixedInstance shim=pxt::getPin(0)
    const A0: PwmPin;
    //% fixedInstance shim=pxt::getPin(0)
    const A1: PwmPin;
    //% fixedInstance shim=pxt::getPin(0)
    const A2: PwmPin;
    //% fixedInstance shim=pxt::getPin(0)
    const A3: PwmPin;

    //% fixedInstance shim=pxt::getPin(0)
    const A4: PwmPin;
    //% fixedInstance shim=pxt::getPin(0)
    const A5: PwmPin;
    //% fixedInstance shim=pxt::getPin(0)
    const A6: PwmPin;
    //% fixedInstance shim=pxt::getPin(0)
    const A7: PwmPin;

    // Define aliases, as Digital Pins

    //% fixedInstance shim=pxt::getPin(0)
    const SCL: DigitalPin;
    //% fixedInstance shim=pxt::getPin(0)
    const SDA: DigitalPin;
    //% fixedInstance shim=pxt::getPin(0)
    const RX: DigitalPin;
    //% fixedInstance shim=pxt::getPin(0)
    const TX: DigitalPin;

    // Aliases for built-in components

    //% fixedInstance shim=pxt::getPin(0)
    const A8: PwmPin; // light
    //% fixedInstance shim=pxt::getPin(0)
    const A9: PwmPin;
    //% fixedInstance shim=pxt::getPin(0)
    const D4: DigitalPin; // A
    //% fixedInstance shim=pxt::getPin(0)
    const D5: DigitalPin; // B
    //% fixedInstance shim=pxt::getPin(0)
    const D7: DigitalPin; // Slide
    //% fixedInstance shim=pxt::getPin(0)
    const D8: DigitalPin; // Neopixel

    //% fixedInstance shim=pxt::getPin(0)
    const D13: DigitalPin;
    //% fixedInstance shim=pxt::getPin(0)
    const LED: DigitalPin;

    //% fixedInstance shim=pxt::getPin(0)
    const A10: PwmPin; // mic
}

namespace pins2 {
    //% blockId="fi_arg" block="fixedInstance arg %p"
    export function fixedInstanceArg(p : PwmPin): void {}
}

//% fixedInstances decompileIndirectFixedInstances
declare interface ImageLike {
    //% block="set pixel of %myImage=variables_get at x %x y %y to %c"
    setPixel(x: number, y: number, color: number): void;
}