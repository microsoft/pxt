namespace console {
    //% shim=serial::writeString
    function writeStr(s: string) {
    }
    export function log(msg: string) {
        writeStr(msg)
        writeStr("\n")
    }
}

namespace basic {
    /**
     * Pause for the specified time in milliseconds
     * @param ms how long to pause for, eg: 100, 200, 500, 1000, 2000
     */
    //% async block="pause (ms) %pause"
    //% blockId=device_pause icon="\uf110" shim=basic::pause
    export function pause(ms: number): void {
    }

    export function showNumber(value: number, interval?: number): void {
        console.log("SHOW NUMBER: " + value)
    }
}

namespace control {
    /**
     * Schedules code that run in the background.
     */
    //% blockId="control_in_background" block="run in background" blockGap=8 shim=control::inBackground
    export function inBackground(a: () => void): void
    { }

    /**
     *  Display specified error code and stop the program.
    */
    //% shim=pxtrt::panic
    export function panic(code: number) {
    }

    /**
     * If the condition is false, display msg on serial console, and panic with code 098.
     */
    export function assert(condition: boolean, msg?: string) {
        if (!condition) {
            console.log("ASSERTION FAILED")
            if (msg != null)
                console.log(msg)
            panic(98)
        }
    }
}
