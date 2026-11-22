// A play-instructions buffer is a list of 12-byte steps. Each step is laid out like this, with the
// 16-bit fields stored little-endian:
//
//   offset  size  field
//   0       1     waveform (0 is a rest)
//   1       1     flags (always 0)
//   2       2     start frequency, in Hz
//   4       2     duration, in milliseconds
//   6       2     start volume
//   8       2     end volume
//   10      2     end frequency, in Hz
namespace pxsim.music {
    export const INSTRUCTION_STEP_BYTES = 12;
    export const INSTRUCTION_WAVE_OFFSET = 0;
    export const INSTRUCTION_FLAGS_OFFSET = 1;
    export const INSTRUCTION_START_FREQUENCY_OFFSET = 2;
    export const INSTRUCTION_DURATION_OFFSET = 4;
    export const INSTRUCTION_START_VOLUME_OFFSET = 6;
    export const INSTRUCTION_END_VOLUME_OFFSET = 8;
    export const INSTRUCTION_END_FREQUENCY_OFFSET = 10;

    /** Reads the UInt16LE at offset in buf. Bytes past the end of buf read as 0. */
    export function readUint16(buf: Uint8Array, offset: number): number {
        return (buf[offset] | 0) | ((buf[offset + 1] | 0) << 8);
    }

    export function instructionsDurationMs(instructions: Uint8Array): number {
        let total = 0;
        for (let i = 0; i < instructions.length; i += INSTRUCTION_STEP_BYTES)
            total += readUint16(instructions, i + INSTRUCTION_DURATION_OFFSET);
        return total;
    }
}
