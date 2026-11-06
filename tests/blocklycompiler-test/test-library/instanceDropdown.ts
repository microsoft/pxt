namespace things {
    //% fixedInstances
    export class Thing {
    }

    //% fixedInstance whenUsed block="first"
    export const first = new Thing();

    //% blockId=things_use block="use %thing"
    export function use(thing: Thing) { }
}
