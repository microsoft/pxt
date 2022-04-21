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
    export const MAX_VOLUME = 100;

    export function renderSoundPath(sound: pxt.assets.Sound, width: number, height: number) {
        const {
            startFrequency,
            endFrequency,
            startVolume,
            endVolume,
            wave,
            interpolation
        } = sound;

        const scale = (start: number, end: number, percent: number) => {
            return Math.pow(start, 1 - percent) * Math.pow(end, percent)
        }

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
            getFrequencyAt = () => random.randomRange(500, 1000)
        }

        const getVolumeAt = (x: number) =>
            Math.max(Math.min(((endVolume - startVolume) / width) * x + startVolume, 100), 0);

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
        if (wave === "noise") frequency = random.randomRange(500, 1000);


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
}