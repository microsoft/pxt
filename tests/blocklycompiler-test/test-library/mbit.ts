namespace basic {
    /**
     * Scroll a number on the screen. If the number fits on the screen (i.e. is a single digit), do not scroll.
     * @param interval speed of scroll; eg: 150, 100, 200, -100
     */
    //% help=basic/show-number
    //% weight=96
    //% blockId=device_show_number block="show|number %number" blockGap=8
    //% async
    //% parts="ledmatrix" interval.defl=150
    export function showNumber(value: number, interval?: number) {
    }

    /**
     * Display text on the display, one character at a time. If the string fits on the screen (i.e. is one letter), does not scroll.
     * @param text the text to scroll on the screen, eg: "Hello!"
     * @param interval how fast to shift characters; eg: 150, 100, 200, -100
     */
    //% help=basic/show-string
    //% weight=87 blockGap=16
    //% block="show|string %text"
    //% blockId=device_print_message
    //% parts="ledmatrix"
    //% text.shadowOptions.toString=true interval.defl=150
    export function showString(text: string, interval?: number): void {

    }

    /**
     * Creates a template string
     */
    //% weight=75
    //% blockId=device_build_string_literal block="create string grid"
    //% gridLiteral=1
    export function createTemplateGrid(leds: string): string {
        return leds
    }

    /**
     * Repeats the code forever in the background. On each iteration, allows other codes to run.
     * @param body code to execute
     */
    //% help=basic/forever weight=55 blockGap=8 blockAllowMultiple=1
    //% blockId=device_forever block="forever" icon="\uf01e"
    export function forever(a: () => void): void {

    }
}


namespace radio {
    /**
     * Registers code to run when the radio receives a number.
     */
    //% help=radio/on-received-number blockHandlerKey="radioreceived"
    //% blockId=radio_on_number_2 block="on radio received" blockGap=16 draggableParameters="reporter"
    //% useLoc="radio.onDataPacketReceived"
    export function onReceivedNumber(cb: (receivedNumber: number) => void) {

    }

    /**
     * Registers code to run when the radio receives a string.
     */
    //% help=radio/on-received-string
    //% blockId=radio_on_string_2 block="on radio received" blockGap=16 draggableParameters="reporter"
    //% useLoc="radio.onDataPacketReceived"
    export function onReceivedString(cb: (receivedString: string) => void) {

    }
}

namespace custom {
    //% blockId=custom_handlerStatement
    //% handlerStatement
    //% block
    export function handlerStatement(handler: () => void) {

    }
}
