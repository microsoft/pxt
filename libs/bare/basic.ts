namespace control {
    //% shim=serial::writeString
    export function __log(s: string) {
    }

    export function dmesg(s: string) {
        // ignore
    }
}

//% async
//% shim=basic::pause
function pause(ms: number): void { }

namespace control {
    /**
     * Pause for the specified time in milliseconds
     * @param ms how long to pause for, eg: 100, 200, 500, 1000, 2000
     */
    //% async block="pause (ms) %pause"
    //% blockId=device_pause icon="\uf110" shim=basic::pause
    export function pause(ms: number): void {
    }

    /**
     * Schedules code that run in the background.
     */
    //% blockId="control_in_background" block="run in background" blockGap=8 shim=control::inBackground
    export function runInBackground(a: () => void): void { }
}

/**
 * Reading and writing data to the console output.
 */
//% weight=12 color=#002050 icon="\uf120"
//% advanced=true
namespace console {
    /**
     * Write a line of text to the console output.
     * @param value to send
     */
    //% weight=90
    //% help=console/log blockGap=8 text.shadowOptions.toString=true
    //% blockId=console_log block="console|log %text"
    export function log(value: any): void {
        let s: string = value + ""
        control.__log(s)
        control.__log("\n")
        control.dmesg(s)
    }
}

//% indexerGet=BufferMethods::getByte indexerSet=BufferMethods::setByte
interface Buffer {
}