namespace pxsim.AudioContextManager {
    const waveForms: OscillatorType[] = [null, "triangle", "sawtooth", "sine"]
    let noiseBuffer: AudioBuffer
    let rectNoiseBuffer: AudioBuffer
    let cycleNoiseBuffer: AudioBuffer[] = []
    let squareBuffer: AudioBuffer[] = []

    function getNoiseBuffer(context: AudioContext) {
        if (!noiseBuffer) {
            const bufferSize = 100000;
            noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
            const output = noiseBuffer.getChannelData(0);

            let x = 0xf01ba80;
            for (let i = 0; i < bufferSize; i++) {
                x ^= x << 13;
                x ^= x >> 17;
                x ^= x << 5;
                output[i] = ((x & 1023) / 512.0) - 1.0;
            }
        }
        return noiseBuffer
    }

    function getRectNoiseBuffer(context: AudioContext) {
        // Create a square wave filtered by a pseudorandom bit sequence.
        // This uses four samples per cycle to create square-ish waves.
        // The Web Audio API's frequency scaling may be using linear
        // interpolation which would turn a two-sample wave into a triangle.
        if (!rectNoiseBuffer) {
            const bufferSize = 131072; // must be a multiple of 4
            rectNoiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
            const output = rectNoiseBuffer.getChannelData(0);

            let x = 0xf01ba80;
            for (let i = 0; i < bufferSize; i += 4) {
                // see https://en.wikipedia.org/wiki/Xorshift
                x ^= x << 13;
                x ^= x >> 17;
                x ^= x << 5;
                if (x & 0x8000) {
                    output[i] = 1.0;
                    output[i + 1] = 1.0;
                    output[i + 2] = -1.0;
                    output[i + 3] = -1.0;
                } else {
                    output[i] = 0.0;
                    output[i + 1] = 0.0;
                    output[i + 2] = 0.0;
                    output[i + 3] = 0.0;
                }
            }
        }
        return rectNoiseBuffer
    }

    function getCycleNoiseBuffer(context: AudioContext, bits: number) {
        if (!cycleNoiseBuffer[bits]) {
            // Buffer size needs to be a multiple of 4x the largest cycle length,
            // 4*64 in this case.
            const bufferSize = 1024;
            const buf = context.createBuffer(1, bufferSize, context.sampleRate);
            const output = buf.getChannelData(0);

            // See pxt-common-packages's libs/mixer/melody.cpp for details.
            // "bits" must be in the range 4..6.
            const cycle_bits: number[] = [0x2df0eb47, 0xc8165a93];
            const mask_456: number[] = [0xf, 0x1f, 0x3f];
            for (let i = 0; i < bufferSize; i += 4) {
                let cycle: number = i / 4;
                let is_on: boolean;
                let cycle_mask = mask_456[bits - 4];
                cycle &= cycle_mask;
                is_on = (cycle_bits[cycle >> 5] & (1 << (cycle & 0x1f))) != 0;
                if (is_on) {
                    output[i] = 1.0;
                    output[i + 1] = 1.0;
                    output[i + 2] = -1.0;
                    output[i + 3] = -1.0;
                } else {
                    output[i] = 0.0;
                    output[i + 1] = 0.0;
                    output[i + 2] = 0.0;
                    output[i + 3] = 0.0;
                }
            }
            cycleNoiseBuffer[bits] = buf
        }
        return cycleNoiseBuffer[bits]
    }

    function getSquareBuffer(context: AudioContext, param: number) {
        if (!squareBuffer[param]) {
            const bufferSize = 1024;
            const buf = context.createBuffer(1, bufferSize, context.sampleRate);
            const output = buf.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = i < (param / 100 * bufferSize) ? 1 : -1;
            }
            squareBuffer[param] = buf
        }
        return squareBuffer[param]
    }

    /*
    #define SW_TRIANGLE 1
    #define SW_SAWTOOTH 2
    #define SW_SINE 3
    #define SW_TUNEDNOISE 4
    #define SW_NOISE 5
    #define SW_SQUARE_10 11
    #define SW_SQUARE_50 15
    #define SW_SQUARE_CYCLE_16 16
    #define SW_SQUARE_CYCLE_32 17
    #define SW_SQUARE_CYCLE_64 18
    */


    /*
     struct SoundInstruction {
         uint8_t soundWave;
         uint8_t flags;
         uint16_t frequency;
         uint16_t duration;
         uint16_t startVolume;
         uint16_t endVolume;
     };
     */

    function getGenerator(context: AudioContext, waveFormIdx: number, hz: number): OscillatorNode | AudioBufferSourceNode {
        let form = waveForms[waveFormIdx]
        if (form) {
            let src = context.createOscillator()
            src.type = form
            src.frequency.value = hz
            return src
        }

        let buffer: AudioBuffer
        if (waveFormIdx == 4)
            buffer = getRectNoiseBuffer(context)
        else if (waveFormIdx == 5)
            buffer = getNoiseBuffer(context)
        else if (11 <= waveFormIdx && waveFormIdx <= 15)
            buffer = getSquareBuffer(context, (waveFormIdx - 10) * 10)
        else if (16 <= waveFormIdx && waveFormIdx <= 18)
            buffer = getCycleNoiseBuffer(context, (waveFormIdx - 16) + 4)
        else
            return null

        let node = context.createBufferSource();
        node.buffer = buffer;
        node.loop = true;
        const isFilteredNoise = waveFormIdx == 4 || (16 <= waveFormIdx && waveFormIdx <= 18);
        if (isFilteredNoise)
            node.playbackRate.value = hz / (context.sampleRate / 4);
        else if (waveFormIdx != 5)
            node.playbackRate.value = hz / (context.sampleRate / 1024);

        return node
    }

    export class PlayInstructionsSource extends AudioSource {
        analyser: AnalyserNode;
        gain: GainNode;

        constructor(public context: AudioContext, public destination: AudioNode) {
            super(context, destination);
            this.analyser = context.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.connect(this.vca);

            this.gain = context.createGain();
            this.gain.connect(this.analyser);
        }

        playInstructionsAsync(instructions: Uint8Array, isCancelled?: () => boolean, onPull?: (freq: number, volume: number) => void) {
            return new Promise<void>(async resolve => {
                soundEventCallback?.("playinstructions", instructions);
                let resolved = false;

                const oscillators: pxt.Map<OscillatorNode | AudioBufferSourceNode> = {};
                const gains: pxt.Map<GainNode> = {};
                let startTime = this.context.currentTime;
                let currentTime = startTime;
                let currentWave = 0;

                let totalDuration = 0;

                /** Square waves are perceved as much louder than other sounds, so scale it down a bit to make it less jarring **/
                const scaleVol = (n: number, isSqWave?: boolean) => (n / 1024) / 4 * (isSqWave ? .5 : 1);

                const disconnectNodes = () => {
                    if (resolved) return;
                    resolved = true;

                    for (const wave of Object.keys(oscillators)) {
                        oscillators[wave].stop();
                        oscillators[wave].disconnect();
                        gains[wave].disconnect();
                    }
                    resolve();
                }

                for (let i = 0; i < instructions.length; i += 12) {
                    const wave = instructions[i];
                    const startFrequency = readUint16(instructions, i + 2);
                    const duration = readUint16(instructions, i + 4) / 1000;
                    const startVolume = readUint16(instructions, i + 6);
                    const endVolume = readUint16(instructions, i + 8);
                    const endFrequency = readUint16(instructions, i + 10);
                    totalDuration += duration

                    if (wave === 0) {
                        currentTime += duration;
                        continue;
                    }

                    const isSquareWave = 11 <= wave && wave <= 15;

                    if (!oscillators[wave]) {
                        oscillators[wave] = getGenerator(this.context, wave, startFrequency);
                        gains[wave] = this.context.createGain();
                        gains[wave].gain.value = 0;
                        gains[wave].connect(this.gain);
                        oscillators[wave].connect(gains[wave]);
                        oscillators[wave].start();
                    }

                    if (currentWave && wave !== currentWave) {
                        gains[currentWave].gain.setTargetAtTime(0, currentTime, 0.015);
                    }

                    const osc = oscillators[wave];
                    const gain = gains[wave];

                    if (osc instanceof OscillatorNode) {
                        osc.frequency.setValueAtTime(startFrequency, currentTime);
                        osc.frequency.linearRampToValueAtTime(endFrequency, currentTime + duration);
                    }
                    else {
                        const isFilteredNoise = wave == 4 || (16 <= wave && wave <= 18);

                        if (isFilteredNoise)
                            osc.playbackRate.linearRampToValueAtTime(endFrequency / (this.context.sampleRate / 4), currentTime + duration);
                        else if (wave != 5)
                            osc.playbackRate.linearRampToValueAtTime(endFrequency / (this.context.sampleRate / 1024), currentTime + duration);
                    }
                    gain.gain.setValueAtTime(scaleVol(startVolume, isSquareWave), currentTime);
                    gain.gain.linearRampToValueAtTime(scaleVol(endVolume, isSquareWave), currentTime + duration);

                    currentWave = wave;
                    currentTime += duration;
                }
                this.gain.gain.setTargetAtTime(0, currentTime, 0.015);

                if (isCancelled || onPull) {
                    const handleAnimationFrame = () => {
                        const time = this.context.currentTime;
                        if (time > startTime + totalDuration) {
                            return;
                        }

                        if ((isCancelled && isCancelled()) || this.isDisposed()) {
                            disconnectNodes();
                            return;
                        }

                        const { frequency, volume } = findFrequencyAndVolumeAtTime((time - startTime) * 1000, instructions);
                        if (onPull) onPull(frequency, volume / 1024);

                        requestAnimationFrame(handleAnimationFrame)
                    }
                    requestAnimationFrame(handleAnimationFrame);
                }

                await U.delay(totalDuration * 1000)
                disconnectNodes();
            });
        }

        dispose(): void {
            if (this.isDisposed()) return;
            super.dispose();
            this.analyser.disconnect();
            this.gain.disconnect();
        }
    }


    function readUint16(buf: Uint8Array, offset: number) {
        const temp = new Uint8Array(2);
        temp[0] = buf[offset];
        temp[1] = buf[offset + 1];
        return new Uint16Array(temp.buffer)[0];
    }

    function findFrequencyAndVolumeAtTime(millis: number, instructions: Uint8Array) {
        let currentTime = 0;

        for (let i = 0; i < instructions.length; i += 12) {
            const startFrequency = readUint16(instructions, i + 2);
            const duration = readUint16(instructions, i + 4);
            const startVolume = readUint16(instructions, i + 6);
            const endVolume = readUint16(instructions, i + 8);
            const endFrequency = readUint16(instructions, i + 10);

            if (currentTime + duration < millis) {
                currentTime += duration;
                continue;
            }

            const offset = (millis - currentTime) / duration;

            return {
                frequency: startFrequency + (endFrequency - startFrequency) * offset,
                volume: startVolume + (endVolume - startVolume) * offset,
            }
        }

        return {
            frequency: -1,
            volume: -1
        };
    }
}