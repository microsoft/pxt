namespace basic {
    /* {help:functions/show-string}
     * {weight:87}
     * {hints:interval:150,100,200,-100}
     * {shim:micro_bit::scrollString}
     * {async}
     */
    /**
     * Display text on the display, one character at a time, and shift by one column each ``interval`` milliseconds. If the string fits on the screen (i.e. is one letter), does not scroll.
     */
    export function showString(text: string, interval: number = 150): void { }

    /**
     * Turn off all LEDs
     * {help:functions/clear-screen}
     * {weight:79}
     * {shim:micro_bit::clearScreen}
     */
    export function clearScreen(): void { }

    /**
     * Pause for the specified time in milliseconds
     * {help:functions/pause}
     * {weight:88}
     * {hints:ms:100,200,500,1000,2000}
     * {shim:micro_bit::pause}
     * {async} 
     */
    export function pause(ms: number): void { }

    /**
     * Scroll a number on the screen and shift by one column every ``interval`` milliseconds. If the number fits on the screen (i.e. is a single digit), does not scroll.
     * {help:functions/show-number}
     * {namespace:basic}
     * {weight:89}
     * {hints:interval:150,100,200,-100}
     * {shim:micro_bit::scrollNumber}
     * {async}
     */
    export function showNumber(value: number, interval: number = 150): void { }

    /**
     * Get the button state (pressed or not) for ``A`` and ``B``.
     * {help:functions/button-is-pressed}
     * {namespace:input}
     * {weight:59}
     * {shim:micro_bit::isButtonPressed}
     */
    export function buttonIsPressed(button: Button): boolean { return false; }
}

type Action = () => void;

namespace control {
    /**
     * Schedules code that run in the background.
     * {help:functions/in-background}
     * {shim:micro_bit::runInBackground}
     */
    export function inBackground(body: Action): void { }
}

enum Button {
    // {enumval:MICROBIT_ID_BUTTON_A}
    A,
    // {enumval:MICROBIT_ID_BUTTON_A}
    B,
    // {enumval:MICROBIT_ID_BUTTON_AB}
    AB,
}

namespace helpers {
    export function arraySplice<T>(arr: T[], start: number, len: number) {
        if (start < 0) return;
        for (let i = 0; i < len; ++i)
            arr.removeAt(start)
    }
}

namespace console {
    export function log(msg: string) {
        serial.writeLine(msg);
    }
}

namespace serial {
    /**
     * Prints a line of text to the serial
     */
    export function writeLine(text: string): void {
        writeString(text);
        writeString("\r\n");
    }

    /**
     * Prints a numeric value to the serial
     */
    export function writeNumber(value: number): void {
        writeString(value.toString());
    }

    /**
     * Reads a line of text from the serial port.
     * {shim:micro_bit::serialReadString}
     */
    export function readString(): string {
        return ""
    }

    /**
     * Sends a piece of text through Serial connection.
     * {shim:micro_bit::serialSendString}
     */
    export function writeString(text: string): void {
    }

    /**
     * Sends the current pixel values, byte-per-pixel, over serial.
     * {shim:micro_bit::serialSendDisplayState}
     */
    export function writeScreen(): void {
    }

    /**
     * Reads the screen from serial.
     * {shim:micro_bit::serialReadDisplayState}
     */
    export function readScreen(): void {
    }

    /**
     * Writes a ``name: value`` pair line to the serial.
     * {weight:80}
     */
    export function writeValue(name: string, value: number): void {
        writeString(name);
        writeString(": ");
        writeNumber(value);
        writeLine("");
    }
}
