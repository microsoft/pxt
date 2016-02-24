namespace control {
    /**
     * Schedules code that run in the background.
    //% help=functions/in-background shim=micro_bit::runInBackground
     */
    export function inBackground(body: Action): void { }

    /**
     * Resets the BBC micro:bit.
     */
    //% weight=1 shim=uBit.reset async help=functions/reset
    export function reset() : void { }
}
