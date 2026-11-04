// The play-instructions buffer format: a sequence of fixed-size steps, each a waveform byte and a
// flags byte followed by UInt16LE fields at the offsets below.
namespace pxsim.music {
    /** Bytes in one step of a play-instructions buffer. */
    export const INSTRUCTION_STEP_BYTES = 12;
    /** Offset of a step's waveform byte; 0 is a rest. */
    export const INSTRUCTION_WAVE_OFFSET = 0;
    /** Offset of a step's flags byte; always 0. */
    export const INSTRUCTION_FLAGS_OFFSET = 1;
    /** Offset of a step's UInt16LE start frequency, in Hz. */
    export const INSTRUCTION_START_FREQUENCY_OFFSET = 2;
    /** Offset of a step's UInt16LE duration, in milliseconds. */
    export const INSTRUCTION_DURATION_OFFSET = 4;
    /** Offset of a step's UInt16LE start volume. */
    export const INSTRUCTION_START_VOLUME_OFFSET = 6;
    /** Offset of a step's UInt16LE end volume. */
    export const INSTRUCTION_END_VOLUME_OFFSET = 8;
    /** Offset of a step's UInt16LE end frequency, in Hz. */
    export const INSTRUCTION_END_FREQUENCY_OFFSET = 10;

    /** Reads the UInt16LE at offset in buf. Bytes past the end of buf read as 0. */
    export function readUint16(buf: Uint8Array, offset: number): number {
        return (buf[offset] | 0) | ((buf[offset + 1] | 0) << 8);
    }

    /** Total duration in milliseconds of a play-instructions buffer: the sum of its steps' durations. */
    export function instructionsDurationMs(instructions: Uint8Array): number {
        let total = 0;
        for (let i = 0; i < instructions.length; i += INSTRUCTION_STEP_BYTES)
            total += readUint16(instructions, i + INSTRUCTION_DURATION_OFFSET);
        return total;
    }
}
