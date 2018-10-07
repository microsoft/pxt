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
function pause(ms: number): void {}

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
    export function runInBackground(a: () => void): void
    { }
}
