namespace pxsim.AudioContextManager {
    export class AudioSource {
        static activeSources: AudioSource[] = [];

        static stopAll() {
            for (const source of AudioSource.activeSources) {
                source.dispose();
            }
            AudioSource.activeSources = [];
        }

        protected vca: GainNode;

        constructor(context: AudioContext, destination: AudioNode) {
            this.vca = context.createGain();
            this.vca.gain.value = 1;
            this.vca.connect(destination);
            AudioSource.activeSources.push(this);
        }

        dispose() {
            if (this.isDisposed()) return;
            this.vca.disconnect();
            this.vca = undefined;
        }

        isDisposed() {
            return !this.vca;
        }
    }
}