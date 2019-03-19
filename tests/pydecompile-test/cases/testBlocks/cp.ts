declare interface PwmPin {
    /**
     * Emits a Pulse-width modulation (PWM) signal for a given duration.
     * @param name the pin that modulate
     * @param frequency frequency to modulate in Hz.
     * @param ms duration of the pitch in milli seconds.
     */
    //% blockId=pin_analog_pitch block="analog pitch|pin %pin|at (Hz)%frequency|for (ms) %ms"
    //% help=pins/analog-pitch weight=4 async advanced=true blockGap=8
    //% blockNamespace=pins shim=PwmPinMethods::analogPitch
    analogPitch(frequency: number, ms: number): void;
}

declare namespace pins {
    //% fixedInstance shim=pxt::getPin(8)
    const A8: PwmPin;


    //% fixedInstance shim=pxt::getPin(9)
    const A9: PwmPin;


    //% fixedInstance shim=pxt::getPin(10)
    const A10: PwmPin;


    //% fixedInstance shim=pxt::getPin(11)
    const A11: PwmPin;
}