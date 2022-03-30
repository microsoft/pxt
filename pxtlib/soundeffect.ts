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

    export function renderSoundPath(sound: pxt.assets.Sound, width: number, height: number) {
        const {
            startFrequency,
            endFrequency,
            startVolume,
            endVolume,
            wave,
            interpolation
        } = sound;

        const logInterpolation = (start: number, end: number, percent: number) => {
            return Math.pow(start, 1 - percent) * Math.pow(end, percent)
        }

        const getFrequencyAt = (x: number) => {
            // Frequency doesn't really have any meaning for noise waveform
            if (wave === "noise") return random.randomRange(200, 500);

            switch (interpolation) {
                case "logarithmic":
                    return logInterpolation(startFrequency, endFrequency, x / width);
                case "curve":
                    return startFrequency + (endFrequency - startFrequency) * Math.sin(x / width * (Math.PI / 2))
                case "linear":
                default:
                    return ((endFrequency - startFrequency) / width) * x + startFrequency;
            }
        }

        const getVolumeAt = (x: number) =>
            ((endVolume - startVolume) / width) * x + startVolume;

        const volumeToAmplitude = (volume: number) => (volume / 1023) * (height - 2) / 2;
        const frequencyToWidth = (frequency: number) => Math.min(width, Math.max(10, (1 / logInterpolation(1, 4000, frequency / 4000)) * width / 2));

        const parts: string[] = [`M ${2} ${height / 2}`];

        let currentX = 0;

        // To make the graph appear consistent with the implementation, use a seeded random for the noise waveform.
        // The numbers are still nonsense but at least this reflects that it's deterministic.
        const random = new SeededRandom(startFrequency + endFrequency + 1);

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
}