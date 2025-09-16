/// <reference path="./audioSource.ts" />

namespace pxsim.AudioContextManager {
    let nextSoundId = 0;

    interface ActiveSound {
        id: number;
        resolve: () => void;
        isCancelled: () => boolean;
    }

    export class AudioWorkletSource extends AudioSource {
        static allWorkletSources: AudioWorkletSource[] = [];

        protected static wavetable: number[];
        private static workletInit: Promise<void>;

        static initializeWorklet(context: AudioContext): Promise<void> {
            if (!AudioWorkletSource.workletInit) {
                AudioWorkletSource.workletInit = context.audioWorklet.addModule(getWorkletUri());
                // AudioWorkletSource.workletInit = context.audioWorklet.addModule("/static/audioWorklet/audioWorkletProcessor.js");
            }

            return AudioWorkletSource.workletInit;
        }

        static getAvailableSource(): AudioWorkletSource {
            for (const source of AudioWorkletSource.allWorkletSources) {
                if (source.activeSounds.length < 30) {
                    return source;
                }
            }

            return undefined;
        }

        static setWavetable(wavetable: number[]) {
            if (!wavetable) {
                AudioWorkletSource.wavetable = undefined;
                return;
            }
            AudioWorkletSource.wavetable = wavetable;

            for (const source of AudioWorkletSource.allWorkletSources) {
                source.setWavetable(wavetable);
            }
        }

        node: AudioWorkletNode;
        analyser: AnalyserNode;
        activeSounds: ActiveSound[];

        protected animRef: number;

        constructor(context: AudioContext, destination: AudioNode) {
            super(context, destination);

            AudioWorkletSource.allWorkletSources.push(this);

            this.analyser = context.createAnalyser();
            this.analyser.fftSize = 2048;
            this.node = new AudioWorkletNode(context, "pxt-mixer-audio-worklet-processor");
            this.node.connect(this.analyser);
            this.analyser.connect(this.vca);
            this.node.port.onmessage = e => {
                if (e.data.type === "done") {
                    const entry = this.activeSounds.find(s => s.id === e.data.id);
                    if (entry) {
                        entry.resolve();
                        this.activeSounds = this.activeSounds.filter(s => s !== entry);
                    }
                }
            }
            this.activeSounds = [];

            if (AudioWorkletSource.wavetable) {
                this.setWavetable(AudioWorkletSource.wavetable);
            }
        }

        playInstructionsAsync(instructions: Uint8Array, isCancelled?: () => boolean) {
            return new Promise<void>((resolve) => {
                const msg = {
                    type: "play",
                    instructions: instructions,
                    id: nextSoundId++
                };

                const sound = {
                    id: msg.id,
                    resolve,
                    isCancelled
                }

                this.activeSounds.push(sound);
                this.node.port.postMessage(msg);

                if (isCancelled) {
                    this.updateActiveSounds();
                }
            });
        }

        setWavetable(wavetable: number[]) {
            this.node.port.postMessage({
                type: "wavetable",
                wavetable
            });
        }

        dispose() {
            super.dispose();
            AudioWorkletSource.allWorkletSources = AudioWorkletSource.allWorkletSources.filter(s => s !== this);

            this.node.disconnect();
            this.node.port.close();
            this.node = undefined;
            this.analyser.disconnect();
            this.analyser = undefined;

            for (const sound of this.activeSounds) {
                sound.resolve();
            }
        }

        protected updateActiveSounds() {
            if (this.animRef) {
                cancelAnimationFrame(this.animRef);
                this.animRef = undefined;
            }

            for (const sound of this.activeSounds) {
                if (sound.isCancelled?.()) {
                    sound.resolve();
                    this.activeSounds = this.activeSounds.filter(s => s !== sound);
                    this.node.port.postMessage({
                        type: "cancel",
                        id: sound.id
                    });
                }
            }

            if (this.activeSounds.length) {
                this.animRef = requestAnimationFrame(() => {
                    this.updateActiveSounds();
                });
            }
        }
    }
}