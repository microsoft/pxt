declare const sampleRate: number;

function millisToSamples(millis: number): number {
    return Math.floor(millis * sampleRate / 1000);
}