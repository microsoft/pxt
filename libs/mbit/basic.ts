namespace basic {
    /**
     * Display text on the display, one character at a time, and shift by one column each ``interval`` milliseconds. If the string fits on the screen (i.e. is one letter), does not scroll.
     * @param interval how fast to shift characters; eg: 150, 100, 200, -100
     */
    //% help=functions/show-string weight=87
    //% shim=micro_bit::scrollString async block="show string %1" async
    //% blockId=device_print_message
    export function showString(text: string, interval: number = 150): void { }

    /**
     * Scroll a number on the screen and shift by one column every ``interval`` milliseconds. If the number fits on the screen (i.e. is a single digit), does not scroll.
     * @param interval speed of scroll; eg: 150, 100, 200, -100
     */
    //% help=functions/show-number
    //% weight=89
    //% shim=micro_bit::scrollNumber
    //% blockId=device_show_number block="show number %number" blockGap=8
    //% async
    export function showNumber(value: number, interval: number = 150): void { }
    
    /**
     * Shows a sequence of LED screens as an animation with an ``interval`` delay between each frame
     * @param leds TODO
     * @param interval TODO
     */
    //% help=functions/show-animation shim=micro_bit::showAnimation imageLiteral async
    export function showAnimation(leds: string, interval: number) : void {}

    /**
     * Draws an image on the LED screen and pauses for the given milliseconds.
     * @param leds TODO
     * @param ms TODO
     */
    //% help=functions/show-leds weight=95 shim=micro_bit::showLeds imageLiteral async
    //% blockId=device_show_leds
    export function showLeds(leds: string, ms: number) : void {}

    /**
     * Draws an image on the LED screen.
     * @param leds TODO
     */
    //% help=functions/plot-leds weight=80 shim=micro_bit::plotLeds imageLiteral
    export function plotLeds(leds: string) : void {}


    /**
     * Turn off all LEDs
     */
    //% help=functions/clear-screen weight=79
    //% shim=micro_bit::clearScreen
    //% blockId=device_clear_display block="clear screen"
    export function clearScreen(): void { }

    /**
     * Repeats the code forever in the background. On each iteration, allows other codes to run.
     * @param body TODO
     */
    //% help=functions/forever weight=55
    //% blockId=device_forever block="forever"
    export function forever(body:() => void) : void {
        control.inBackground(() => {
            while(true) {
                body();
                basic.pause(20);
            }
        })
    }

    /**
     * Pause for the specified time in milliseconds
     * @param ms how long to pause for, eg: 100, 200, 500, 1000, 2000
     */
    //% help=functions/pause weight=88
    //% shim=micro_bit::pause async block="pause for %1 ms"
    //% blockId=device_pause
    export function pause(ms: number): void { }
}
