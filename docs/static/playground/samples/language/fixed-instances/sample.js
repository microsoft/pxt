/**
 * Use the "fixedInstance" macro to create a 
 * set number of instances for a given class.
 */

//% fixedInstances
//% blockNamespace=pinSample
class DigitalPinSample {
    //% blockId=device_set_digital_pin_sample 
    //% block="digital write|pin $this|to $value"
    digitalWrite(value: number): void {}
}
//% color=#ff8000
namespace pinSample {
    //% fixedInstance
    export let D0: DigitalPinSample;
    //% fixedInstance
    export let D1: DigitalPinSample;
}

// Fixed instances also support inheritance.

//% fixedInstances
//% blockNamespace=pinSample
class AnalogPinSample extends DigitalPinSample {
    //% blockId=device_set_analog_pin_sample 
    //% block="analog write|pin $this|to $value"
    analogWrite(value: number): void {}
}

namespace pinSample {
    //% fixedInstance
    export let A0: AnalogPinSample;
    
    //% fixedInstance whenUsed
    export const A7 = new AnalogPinSample(7);
}