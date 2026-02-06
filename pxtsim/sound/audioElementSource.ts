/// <reference path="./audioSource.ts" />

namespace pxsim.AudioContextManager {
    export class AudioElementSource extends AudioSource {
        protected audioElement: HTMLAudioElement;
        protected source: MediaElementAudioSourceNode;
        protected distortion: WaveShaperNode;

        constructor(context: AudioContext, destination: AudioNode, uri: string, clippingThreshold: number, volume: number) {
            super(context, destination);

            this.audioElement = new Audio(uri);
            this.source = context.createMediaElementSource(this.audioElement);
            this.distortion = context.createWaveShaper();
            this.distortion.curve = makeDistortionCurve(clippingThreshold);
            this.distortion.oversample = "4x";

            this.source.connect(this.distortion);
            this.distortion.connect(this.vca);

            // scaling the volume to be a multiplier of 0.1
            // 0.1 is what sounded the best when testing audio recordings against other music blocks
            this.vca.gain.value = volume * 0.1;
        }

        getAudioElement() {
            return this.audioElement;
        }

        dispose() {
            super.dispose();
            this.source.disconnect();
            this.distortion.disconnect();
            this.audioElement.pause();
            this.audioElement = undefined;
        }
    }

    function makeDistortionCurve(clippingThreshold: number) {
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        clippingThreshold = Math.max(0.01, Math.min(1, clippingThreshold));

        const slope = 1 / clippingThreshold;

        for (let i = 0; i < n_samples; i++) {
            const x = (i * 2) / n_samples - 1;
            const scaled = x * slope;
            curve[i] = Math.max(-1, Math.min(1, scaled));
        }

        return curve;
    }
}