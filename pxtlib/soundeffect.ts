namespace pxt.assets {
    export type SoundWaveForm = "square" | "sine" | "triangle" | "noise" | "sawtooth";
    export type SoundInterpolation = "linear" | "curve" | "logarithmic";
    export type SoundEffect = "vibrato" | "tremolo" | "warble" | "none";

    export interface Sound {
        wave: SoundWaveForm;
        interpolation: SoundInterpolation;
        effect: SoundEffect;
        startFrequency: number;
        endFrequency: number;
        startVolume: number;
        endVolume: number;
        duration: number;
    }

    export const MAX_FREQUENCY = 5000;
    export const MAX_VOLUME = 255;

    export function renderSoundPath(sound: pxt.assets.Sound, width: number, height: number) {
        let {
            startFrequency,
            endFrequency,
            startVolume,
            endVolume,
            wave,
            interpolation
        } = sound;

        startFrequency = Math.max(Math.min(startFrequency, MAX_FREQUENCY), 1);
        endFrequency = Math.max(Math.min(endFrequency, MAX_FREQUENCY), 1);

        startVolume = Math.max(Math.min(startVolume, MAX_VOLUME), 0);
        endVolume = Math.max(Math.min(endVolume, MAX_VOLUME), 0);

        // To make the graph appear consistent with the implementation, use a seeded random for the noise waveform.
        // The numbers are still nonsense but at least this reflects that it's deterministic.
        const random = new SeededRandom(startFrequency + endFrequency + 1);


        let getFrequencyAt: (x: number) => number;

        switch (interpolation) {
            case "linear":
                getFrequencyAt = x => startFrequency + x * (endFrequency - startFrequency) / width;
                break;
            case "curve":
                getFrequencyAt = x => startFrequency + (endFrequency - startFrequency) * Math.sin(x / width * (Math.PI / 2));
                break;
            case "logarithmic":
                getFrequencyAt = x => startFrequency + Math.log10(1 + 9 * (x / width)) * (endFrequency - startFrequency)
                break;
        }

        if (wave === "noise") {
            getFrequencyAt = () => random.randomRange(500, 5000)
        }

        const getVolumeAt = (x: number) =>
            Math.max(Math.min(((endVolume - startVolume) / width) * x + startVolume, MAX_VOLUME), 0);

        const minWaveWidth = 10;
        const maxWaveWidth = width / 2;

        const volumeToAmplitude = (volume: number) => (volume / MAX_VOLUME) * (height - 2) / 2;
        const frequencyToWidth = (frequency: number) => (1 - frequency / MAX_FREQUENCY) * (maxWaveWidth - minWaveWidth) + minWaveWidth;

        const parts: string[] = [`M ${2} ${height / 2}`];

        let currentX = 0;

        while (currentX < width) {
            parts.push(renderHalfWavePart(
                volumeToAmplitude(getVolumeAt(currentX)),
                frequencyToWidth(getFrequencyAt(currentX)) / 2,
                wave,
                false,
                random
            ))
            currentX += frequencyToWidth(getFrequencyAt(currentX)) / 2
            parts.push(renderHalfWavePart(
                volumeToAmplitude(getVolumeAt(currentX)),
                frequencyToWidth(getFrequencyAt(currentX)) / 2,
                wave,
                true,
                random
            ))
            currentX += frequencyToWidth(getFrequencyAt(currentX)) / 2
        }

        return parts.join(" ");
    }

    export function renderWaveSnapshot(frequency: number, volume: number, wave: SoundWaveForm, width: number, height: number, timeBase: number) {
        // To make the graph appear consistent with the implementation, use a seeded random for the noise waveform.
        // The numbers are still nonsense but at least this reflects that it's deterministic.
        const random = new SeededRandom(frequency);
        if (wave === "noise") frequency = random.randomRange(500, 5000);

        frequency = Math.max(Math.min(frequency, MAX_FREQUENCY), 1);

        const amplitude = (volume / MAX_VOLUME) * (height - 2) / 2;
        const waveHalfWidth =  (width / (frequency * timeBase / 1000)) / 2;

        let numSegments = Math.ceil(width / (waveHalfWidth * 2));

        if (numSegments % 2 === 1) numSegments++;

        // Center the wave because it makes an animation look better. The overflow will be clipped
        // by the outer svg
        const parts: string[] = [`M ${(width / 2) - (numSegments * waveHalfWidth)} ${height / 2}`];

        let currentX = 0;

        for (let i = 0; i < numSegments; i++) {
            parts.push(renderHalfWavePart(
                amplitude,
                waveHalfWidth,
                wave,
                false,
                random
            ))
            currentX += waveHalfWidth
            parts.push(renderHalfWavePart(
                amplitude,
                waveHalfWidth,
                wave,
                true,
                random
            ))
            currentX += waveHalfWidth
        }

        return parts.join(" ");
    }

    class SeededRandom {
        // Implementation of the Galois Linear Feedback Shift Register
        private lfsr: number;
        public seed: number;

        constructor(seed: number) {
            this.seed = seed;
            this.lfsr = seed;
        }


        next(): number {
            const n = this.lfsr = (this.lfsr >> 1) ^ ((-(this.lfsr & 1)) & 0xb400);
            return n / 0xffff;
        }

        randomRange(min: number, max: number): number {
            return min + (max - min) * this.next();
        }
    }


    function renderHalfWavePart(amplitude: number, width: number, wave: pxt.assets.SoundWaveForm, flip: boolean, random: SeededRandom) {
        switch (wave) {
            case "triangle":
                return `l ${width / 2} ${flip ? amplitude : -amplitude} l ${width / 2} ${flip ? -amplitude : amplitude}`;
            case "square":
                return `v ${flip ? amplitude : -amplitude} h ${width} v ${flip ? -amplitude : amplitude}`;
            case "sawtooth":
                if (flip) {
                    return `l ${width} ${amplitude} v ${-amplitude}`
                }
                else {
                    return `v ${-amplitude} l ${width} ${amplitude}`
                }
            case "sine":
                return `q ${width / 2} ${(flip ? amplitude : -amplitude) * 1.9} ${width} 0`;
            case "noise":
                const outParts: string[] = [];
                const points: number[] = [];

                const slice = Math.min(4, width / 4);
                let positive = flip;
                for (let x = 0; x < width; x += slice) {
                    points.push(random.randomRange(0, amplitude) * (positive ? 1 : -1));
                    positive = !positive
                }

                points[0] = flip ? amplitude : -amplitude;
                points[points.length - 1] = 0;
                let offset = 0;
                let x = 0;
                for (const point of points) {
                    let dx = Math.min(slice, width - x);
                    outParts.push(`v ${point - offset} h ${dx}`)
                    offset = point;
                    x += dx;

                    if (x >= width) break;
                }
                return outParts.join(" ");

        }
    }

    /**
     * Instruction buffer format:
     *
     *  Param            Bits
     *  waveform     	 8
     *  unused           8
     *  frequency (hz)   16
     *  duration (ms)    16
     *  start volume     16
     *  end volume       16
     *  end frequency    16
     *
     * Volume ranges from 0-1024
     *
     * Waveform values:
     *  triangle         1
     *  sawtooth         2
     *  sine             3
     *  tunable noise    4
     *  noise            5
     *  square (10%)     11
     *  square (20%)     12
     *  square (30%)     13
     *  square (40%)     14
     *  square (50%)     15
     *  cycle 16         16
     *  cycle 32         17
     *  cycle 64         18
     */

    interface Step {
        frequency: number;
        volume: number;
    }

     export function soundToInstructionBuffer(sound: Sound, fxSteps: number, fxRange: number) {
        const {
            startFrequency,
            endFrequency,
            startVolume,
            endVolume,
            interpolation,
            duration
        } = sound;

        const steps: Step[] = [];

        // Optimize the simple case
        if (sound.interpolation === "linear" && sound.effect === "none") {
            steps.push({
                frequency: startFrequency,
                volume: (startVolume / MAX_VOLUME) * 1024,
            })
            steps.push({
                frequency: endFrequency,
                volume: (endVolume / MAX_VOLUME) * 1024,
            })
        }
        else {

            fxSteps = Math.min(fxSteps, Math.floor(duration / 5))

            const getVolumeAt = (t: number) => ((startVolume + t * (endVolume - startVolume) / duration) / MAX_VOLUME) * 1024;
            let getFrequencyAt: (t: number) => number;

            switch (interpolation) {
                case "linear":
                    getFrequencyAt = t => startFrequency + t * (endFrequency - startFrequency) / duration;
                    break;
                case "curve":
                    getFrequencyAt = t => startFrequency + (endFrequency - startFrequency) * Math.sin(t / duration * (Math.PI / 2));
                    break;
                case "logarithmic":
                    getFrequencyAt = t => startFrequency + Math.log10(1 + 9 * (t / duration)) * (endFrequency - startFrequency)
                    break;
            }

            const timeSlice = duration / fxSteps;

            for (let i = 0; i < fxSteps; i++) {
                const newStep = {
                    frequency: Math.max(getFrequencyAt(i * timeSlice), 1),
                    volume: getVolumeAt(i * timeSlice)
                };

                if (sound.effect === "tremolo") {
                    if (i % 2 === 0) {
                        newStep.volume = Math.max(newStep.volume - fxRange * 500, 0)
                    }
                    else {
                        newStep.volume = Math.min(newStep.volume + fxRange * 500, 1023)
                    }
                }
                else if (sound.effect === "vibrato") {
                    if (i % 2 === 0) {
                        newStep.frequency = Math.max(newStep.frequency - fxRange * 100, 1)
                    }
                    else {
                        newStep.frequency = newStep.frequency + fxRange * 100
                    }
                }
                else if (sound.effect === "warble") {
                    if (i % 2 === 0) {
                        newStep.frequency = Math.max(newStep.frequency - fxRange * 1000, 1)
                    }
                    else {
                        newStep.frequency = newStep.frequency + fxRange * 1000
                    }
                }

                steps.push(newStep)
            }
        }

        const out = new Uint8Array(12 * (steps.length - 1));
        const stepDuration = Math.floor(duration / (steps.length - 1))

        for (let i = 0; i < steps.length - 1; i++) {
            const offset = i * 12;
            out[offset] = waveToValue(sound.wave);
            set16BitNumber(out, offset + 2, steps[i].frequency);
            set16BitNumber(out, offset + 4, stepDuration);
            set16BitNumber(out, offset + 6, steps[i].volume);
            set16BitNumber(out, offset + 8, steps[i + 1].volume);
            set16BitNumber(out, offset + 10, steps[i + 1].frequency);
        }

        return out;
    }

    function waveToValue(wave: SoundWaveForm) {
        switch (wave) {
            case "square": return 15;
            case "sine": return 3;
            case "triangle": return 1;
            case "noise": return 18;
            case "sawtooth": return 2;
        }
    }

    function set16BitNumber(buf: Uint8Array, offset: number, value: number) {
        const temp = new Uint8Array(2);
        new Uint16Array(temp.buffer)[0] = value | 0;
        buf[offset] = temp[0];
        buf[offset + 1] = temp[1];
    }
}