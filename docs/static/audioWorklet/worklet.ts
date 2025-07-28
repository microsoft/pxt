declare class AudioWorkletProcessor {
    port: MessagePort;
};
declare function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void;

class MixerAudioWorkletProcessor extends AudioWorkletProcessor {
    synth: Synth;


    constructor() {
        super();
        this.synth = createDefaultSynth();
        this.port.onmessage = event => {
            handleMessage(this.synth, event.data as [number, number, number]);
        };
    }

    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: any) {
        const output = outputs[0][0];
        if (output) {
            fillSamples(this.synth, output);

            for (let i = 1; i < outputs.length; ++i) {
                for (const channel of outputs[i]) {
                    channel.set(output);
                }
            }
        }
        return true;
    }
}

registerProcessor("pxt-monosynth-audio-worklet-processor", MixerAudioWorkletProcessor);