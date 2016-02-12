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
     */
    //% shim=micro_bit::serialReadString
    export function readString(): string {
        return ""
    }

    /**
     * Sends a piece of text through Serial connection.
     */
    //% shim=micro_bit::serialSendString
    export function writeString(text: string): void {
    }

    /**
     * Sends the current pixel values, byte-per-pixel, over serial.
     */
    //% shim=micro_bit::serialSendDisplayState
    export function writeScreen(): void {
    }

    /**
     * Reads the screen from serial.
     */
    //% shim=micro_bit::serialReadDisplayState
    export function readScreen(): void {
    }

    /**
     * Writes a ``name: value`` pair line to the serial.
     */
    //% weight=80
    export function writeValue(name: string, value: number): void {
        writeString(name);
        writeString(": ");
        writeNumber(value);
        writeLine("");
    }    
}