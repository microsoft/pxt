/// <reference path="./audioSource.ts" />

namespace pxsim.AudioContextManager {
    const MAX_SCHEDULED_BUFFER_NODES = 3;

    export class AudioBufferStreamSource extends AudioSource {
        protected currentBufferSource: AudioBufferSourceNode;

        constructor(protected context: AudioContext, destination: AudioNode) {
            super(context, destination);
        }

        playStreamAsync(pull: () => Float32Array, sampleRate: number, volume = 0.3, isCancelled?: () => boolean) {
            return new Promise<void>(resolve => {
                let nodes: AudioBufferSourceNode[] = [];
                let nextTime = this.context.currentTime;
                let allScheduled = false;
                this.vca.gain.setValueAtTime(volume, nextTime);

                const checkCancel = () => {
                    if (!this.vca || isCancelled?.()) {
                        if (resolve) resolve();
                        resolve = undefined;
                        return true;
                    }
                    return false;
                }

                // Every time we pull a buffer, schedule a node in the future to play it.
                // Scheduling the nodes ahead of time sounds much smoother than trying to
                // do it when the previous node completes (which sounds SUPER choppy in
                // FireFox).
                const playNext = () => {
                    while (!allScheduled && nodes.length < MAX_SCHEDULED_BUFFER_NODES && !checkCancel()) {
                        const data = pull();
                        if (!data || !data.length) {
                            allScheduled = true;
                            break;
                        }
                        play(data);
                    }

                    if ((allScheduled && nodes.length === 0)) {
                        if (resolve) resolve();
                        resolve = undefined;
                    }
                }

                const play = (data: Float32Array) => {
                    if (checkCancel()) return;

                    const buff = this.context.createBuffer(1, data.length, sampleRate);
                    if (buff.copyToChannel) {
                        buff.copyToChannel(data, 0);
                    }
                    else {
                        const channelBuffer = buff.getChannelData(0);
                        for (let i = 0; i < data.length; i++) {
                            channelBuffer[i] = data[i];
                        }
                    }

                    // Audio buffer source nodes are supposedly very cheap, so no need to reuse them
                    const newNode = this.context.createBufferSource();
                    nodes.push(newNode);
                    newNode.connect(this.vca);
                    newNode.buffer = buff;
                    newNode.addEventListener("ended", () => {
                        nodes.shift().disconnect();
                        playNext();
                    });
                    newNode.start(nextTime);
                    nextTime += buff.duration;
                }

                playNext();
            });
        }
    }
}