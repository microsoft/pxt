/// <reference path="./audioSource.ts" />

namespace pxsim.AudioContextManager {
    export class AudioToneSource extends AudioSource {
        protected static instance: AudioToneSource;

        static getInstance(context: AudioContext, destination: AudioNode) {
            if (!AudioToneSource.instance) {
                AudioToneSource.instance = new AudioToneSource(context, destination);
            }
            return AudioToneSource.instance;
        }

        static setCurrentToneGain(gain: number, currentTime: number) {
            if (AudioToneSource.instance) {
                AudioToneSource.instance.setGain(gain, currentTime);
            }
        }

        static isActive() {
            return !!AudioToneSource.instance;
        }

        static getFrequency() {
            return AudioToneSource.instance?.frequency || 0;
        }

        static dispose() {
            if (AudioToneSource.instance) {
                AudioToneSource.instance.dispose();
            }
        }

        protected oscillator: OscillatorNode;
        protected frequency: number;
        protected started = false;

        protected constructor(context: AudioContext, destination: AudioNode) {
            super(context, destination);

            this.oscillator = context.createOscillator();
            this.oscillator.type = "triangle";
            this.oscillator.frequency.value = 0;
            this.oscillator.connect(this.vca);
            this.frequency = 0;
        }

        setFrequency(frequency: number) {
            this.frequency = frequency;
            this.oscillator.frequency.value = frequency;
        }

        setGain(gain: number, currentTime: number) {
            this.vca.gain.setTargetAtTime(gain, currentTime, 0.015)
        }

        start() {
            if (!this.started) {
                this.oscillator.start();
                this.started = true;
            }
        }

        dispose(): void {
            super.dispose();
            this.oscillator.stop();
            this.oscillator.disconnect();
            AudioToneSource.instance = undefined;
        }
    }
}