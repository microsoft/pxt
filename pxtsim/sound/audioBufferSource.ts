/// <reference path="./audioSource.ts" />

namespace pxsim.AudioContextManager {
    export class AudioBufferSource extends AudioSource {
        protected bufferSource: AudioBufferSourceNode;

        constructor(context: AudioContext, destination: AudioNode) {
            super(context, destination);

            this.bufferSource = context.createBufferSource();
            this.bufferSource.connect(this.vca);
        }

        async playBufferAsync(buffer: AudioBuffer, playbackRate: number, gain: number) {
            return new Promise<void>((resolve, reject) => {
                this.vca.gain.value = gain;
                this.bufferSource.onended = () => resolve();
                this.bufferSource.buffer = buffer;
                this.bufferSource.playbackRate.value = playbackRate;
                this.bufferSource.start();
            });
        }

        dispose(): void {
            super.dispose();
            this.bufferSource.disconnect();
            this.bufferSource.stop();
            this.bufferSource = undefined;
        }
    }
}