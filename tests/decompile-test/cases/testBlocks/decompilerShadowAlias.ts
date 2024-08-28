
enum DigitalPin {
    //% blockIdentity="pins._digitalPin"
    P0 = 100,  // MICROBIT_ID_IO_P0
    //% blockIdentity="pins._digitalPin"
    P1 = 101,  // MICROBIT_ID_IO_P1
    //% blockIdentity="pins._digitalPin"
    P2 = 102,  // MICROBIT_ID_IO_P2
    //% blockIdentity="pins._digitalPin"
    P3 = 103,  // MICROBIT_ID_IO_P3
    //% blockIdentity="pins._digitalPin"
    P4 = 104,  // MICROBIT_ID_IO_P4
    //% blockIdentity="pins._digitalPin"
    P5 = 105,  // MICROBIT_ID_IO_P5
    //% blockIdentity="pins._digitalPin"
    P6 = 106,  // MICROBIT_ID_IO_P6
    //% blockIdentity="pins._digitalPin"
    P7 = 107,  // MICROBIT_ID_IO_P7
    //% blockIdentity="pins._digitalPin"
    P8 = 108,  // MICROBIT_ID_IO_P8
    //% blockIdentity="pins._digitalPin"
    P9 = 109,  // MICROBIT_ID_IO_P9
    //% blockIdentity="pins._digitalPin"
    P10 = 110,  // MICROBIT_ID_IO_P10
    //% blockIdentity="pins._digitalPin"
    P11 = 111,  // MICROBIT_ID_IO_P11
    //% blockIdentity="pins._digitalPin"
    P12 = 112,  // MICROBIT_ID_IO_P12
    //% blockIdentity="pins._digitalPin"
    P13 = 113,  // MICROBIT_ID_IO_P13
    //% blockIdentity="pins._digitalPin"
    P14 = 114,  // MICROBIT_ID_IO_P14
    //% blockIdentity="pins._digitalPin"
    P15 = 115,  // MICROBIT_ID_IO_P15
    //% blockIdentity="pins._digitalPin"
    P16 = 116,  // MICROBIT_ID_IO_P16
    //% blockIdentity="pins._digitalPin"
    //% blockHidden=1
    P19 = 119,  // MICROBIT_ID_IO_P19
    //% blockIdentity="pins._digitalPin"
    //% blockHidden=1
    P20 = 120,  // MICROBIT_ID_IO_P20
}


namespace pins {
    /**
     * Returns the value of a C++ runtime constant
     */
    //% help=pins/digital-pin
    //% shim=TD_ID
    //% blockId=digital_pin
    //% block="digital pin $pin"
    //% pin.fieldEditor=pinpicker
    //% pin.fieldOptions.columns=4
    //% pin.fieldOptions.tooltips="false"
    //% group="Pins"
    //% weight=17
    //% blockGap=8
    //% advanced=true
    //% decompilerShadowAlias=digital_pin_shadow
    export function _digitalPin(pin: DigitalPin): number {
        return pin;
    }

    /**
     * Returns the value of a C++ runtime constant
     */
    //% help=pins/digital-pin
    //% shim=TD_ID
    //% blockId=digital_pin_shadow
    //% block="$pin"
    //% pin.fieldEditor=pinpicker
    //% pin.fieldOptions.columns=4
    //% pin.fieldOptions.tooltips="false"
    //% blockHidden=1
    export function _digitalPinShadow(pin: DigitalPin): number {
        return pin;
    }

    /**
     * Set a pin or connector value to either 0 or 1.
     * @param name pin to write to, eg: DigitalPin.P0
     * @param value value to set on the pin, 1 eg,0
     */
    //% help=pins/digital-write-pin weight=29
    //% blockId=device_set_digital_pin block="digital write|pin %name|to %value"
    //% value.min=0 value.max=1
    //% name.shadow=digital_pin_shadow shim=pins::digitalWritePin
    export function digitalWritePin(name: number, value: number): void {
    }
}