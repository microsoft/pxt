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
}