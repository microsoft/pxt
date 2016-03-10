/**
 * Provides access to basic micro:bit functionality.
 */
//% color=190 weight=100
namespace basic {

    /**
     * Scroll a number on the screen. If the number fits on the screen (i.e. is a single digit), do not scroll.
     * @param interval speed of scroll; eg: 150, 100, 200, -100
     */
    //% help=functions/show-number
    //% weight=96
    //% shim=micro_bit::scrollNumber
    //% blockId=device_show_number block="show|number %number" blockGap=8 icon="\uf1ec"
    //% async
    export function showNumber(value: number, interval: number = 150): void { }

    /**
     * Draws an image on the LED screen.
     * @param leds TODO
     * @param interval TODO
     */
    //% help=functions/show-leds 
    //% weight=95 blockGap=8
    //% shim=micro_bit::showLeds 
    //% imageLiteral=1 async
    //% blockId=device_show_leds
    //% block="show leds" icon="\uf00a"
    export function showLeds(leds: string, interval: number = 400): void { }

    /**
     * Display text on the display, one character at a time. If the string fits on the screen (i.e. is one letter), does not scroll.
     * @param text the text to scroll on the screen, eg: "Hello!"
     * @param interval how fast to shift characters; eg: 150, 100, 200, -100
     */
    //% help=functions/show-string 
    //% weight=87 blockGap=8
    //% shim=micro_bit::scrollString async 
    //% block="show|string %text" icon="\uf031" 
    //% async
    //% blockId=device_print_message
    export function showString(text: string, interval: number = 150): void { }

    /**
     * Turn off all LEDs
     */
    //% help=functions/clear-screen weight=79
    //% shim=micro_bit::clearScreen
    //% blockId=device_clear_display block="clear screen" icon="\uf12d"
    export function clearScreen(): void { }

    /**
     * Shows a sequence of LED screens as an animation.
     * @param leds TODO
     * @param interval TODO
     */
    //% help=functions/show-animation shim=micro_bit::showAnimation imageLiteral=1 async
    export function showAnimation(leds: string, interval: number = 400): void { }

    /**
     * Draws an image on the LED screen.
     * @param leds TODO
     */
    //% help=functions/plot-leds weight=80 shim=micro_bit::plotLeds imageLiteral=1
    export function plotLeds(leds: string): void { }

    /**
     * Repeats the code forever in the background. On each iteration, allows other codes to run.
     * @param body TODO
     */
    //% help=functions/forever weight=55 blockGap=8
    //% blockId=device_forever block="forever" icon="\uf01e" shim=micro_bit::forever
    export function forever(body: () => void): void { }

    /**
     * Pause for the specified time in milliseconds
     * @param ms how long to pause for, eg: 100, 200, 500, 1000, 2000
     */
    //% help=functions/pause weight=54
    //% shim=micro_bit::pause async block="pause (ms) %pause"
    //% blockId=device_pause icon="\uf110"
    export function pause(ms: number): void { }
}
