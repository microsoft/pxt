namespace pxsim.AudioContextManager {
    let _frequency = 0;
    let _context: AudioContext;
    let _vco: OscillatorNode;
    let _vca: GainNode;

    let _mute = false; //mute audio

    // for playing WAV
    let audio: HTMLAudioElement;

    const channels: Channel[] = []
    let stopAllListeners: (() => void)[] = [];

    // All other nodes get connected to this node which is connected to the actual
    // destination. Used for muting
    let destination: GainNode;

    export function isAudioElementActive() {
        return !!_vca;
    }

    export let soundEventCallback: (ev: "playinstructions" | "muteallchannels", data?: Uint8Array) => void;

    function context(): AudioContext {
        if (!_context) {
            _context = freshContext();
            if (_context) {
                destination = _context.createGain();
                destination.connect(_context.destination);
                destination.gain.setValueAtTime(1, 0);
            }
        }
        return _context;
    }

    function freshContext(): AudioContext {
        (<any>window).AudioContext = (<any>window).AudioContext || (<any>window).webkitAudioContext;
        if ((<any>window).AudioContext) {
            try {
                // this call my crash.
                // SyntaxError: audio resources unavailable for AudioContext construction
                return new (<any>window).AudioContext();
            } catch (e) { }
        }
        return undefined;
    }

    export function mute(mute: boolean) {
        _mute = mute;

        const ctx = context();
        if (mute) {
            destination.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
        }
        else {
            destination.gain.setTargetAtTime(1, ctx.currentTime, 0.015);
        }

        if (!mute && ctx && ctx.state === "suspended")
            ctx.resume();
    }

    export function isMuted() {
        return _mute;
    }

    function stopTone() {
        setCurrentToneGain(0);
        _frequency = 0;
        if (audio) {
            audio.pause();
        }
    }

    export function stopAll() {
        stopTone();
        muteAllChannels();

        for (const handler of stopAllListeners) {
            handler();
        }
    }

    export function stop() {
        stopTone();
        clearVca();
    }

    export function onStopAll(handler: () => void) {
        stopAllListeners.push(handler);
    }

    function clearVca() {
        if (_vca) {
            try {
                disconnectVca(_vca, _vco);
            } catch { }
            _vca = undefined;
            _vco = undefined;
        }
    }

    function disconnectVca(gain: GainNode, osc?: AudioNode) {
        if (gain.gain.value) {
            gain.gain.setTargetAtTime(0, context().currentTime, 0.015);
        }

        setTimeout(() => {
            gain.disconnect();
            if (osc) osc.disconnect();
        }, 450)
    }

    export function frequency(): number {
        return _frequency;
    }

    const waveForms: OscillatorType[] = [null, "triangle", "sawtooth", "sine"]
    let noiseBuffer: AudioBuffer
    let rectNoiseBuffer: AudioBuffer
    let cycleNoiseBuffer: AudioBuffer[] = []
    let squareBuffer: AudioBuffer[] = []

    function getNoiseBuffer() {
        if (!noiseBuffer) {
            const bufferSize = 100000;
            noiseBuffer = context().createBuffer(1, bufferSize, context().sampleRate);
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

    function getRectNoiseBuffer() {
        // Create a square wave filtered by a pseudorandom bit sequence.
        // This uses four samples per cycle to create square-ish waves.
        // The Web Audio API's frequency scaling may be using linear
        // interpolation which would turn a two-sample wave into a triangle.
        if (!rectNoiseBuffer) {
            const bufferSize = 131072; // must be a multiple of 4
            rectNoiseBuffer = context().createBuffer(1, bufferSize, context().sampleRate);
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

    function getCycleNoiseBuffer(bits: number) {
        if (!cycleNoiseBuffer[bits]) {
            // Buffer size needs to be a multiple of 4x the largest cycle length,
            // 4*64 in this case.
            const bufferSize = 1024;
            const buf = context().createBuffer(1, bufferSize, context().sampleRate);
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

    function getSquareBuffer(param: number) {
        if (!squareBuffer[param]) {
            const bufferSize = 1024;
            const buf = context().createBuffer(1, bufferSize, context().sampleRate);
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

    function getGenerator(waveFormIdx: number, hz: number): OscillatorNode | AudioBufferSourceNode {
        let form = waveForms[waveFormIdx]
        if (form) {
            let src = context().createOscillator()
            src.type = form
            src.frequency.value = hz
            return src
        }

        let buffer: AudioBuffer
        if (waveFormIdx == 4)
            buffer = getRectNoiseBuffer()
        else if (waveFormIdx == 5)
            buffer = getNoiseBuffer()
        else if (11 <= waveFormIdx && waveFormIdx <= 15)
            buffer = getSquareBuffer((waveFormIdx - 10) * 10)
        else if (16 <= waveFormIdx && waveFormIdx <= 18)
            buffer = getCycleNoiseBuffer((waveFormIdx - 16) + 4)
        else
            return null

        let node = context().createBufferSource();
        node.buffer = buffer;
        node.loop = true;
        const isFilteredNoise = waveFormIdx == 4 || (16 <= waveFormIdx && waveFormIdx <= 18);
        if (isFilteredNoise)
            node.playbackRate.value = hz / (context().sampleRate / 4);
        else if (waveFormIdx != 5)
            node.playbackRate.value = hz / (context().sampleRate / 1024);

        return node
    }

    class Channel {
        generator: OscillatorNode | AudioBufferSourceNode;
        gain: GainNode
        disconnectNodes() {
            if (this.gain)
                disconnectVca(this.gain, this.generator)
            else if (this.generator) {
                this.generator.stop()
                this.generator.disconnect()
            }
            this.gain = null
            this.generator = null
        }
        remove() {
            const idx = channels.indexOf(this)
            if (idx >= 0) channels.splice(idx, 1)
            this.disconnectNodes()
        }
    }

    let instrStopId = 1
    export function muteAllChannels() {
        soundEventCallback?.("muteallchannels");
        instrStopId++
        while (channels.length)
            channels[0].remove()
    }

    export function queuePlayInstructions(when: number, b: RefBuffer) {
        const prevStop = instrStopId
        U.delay(when)
            .then(() => {
                if (prevStop != instrStopId)
                    return Promise.resolve()
                return playInstructionsAsync(b.data)
            });

    }

    export function tone(frequency: number, gain: number) {
        if (frequency < 0) return;
        _frequency = frequency;

        let ctx = context();
        if (!ctx) return;


        gain = Math.max(0, Math.min(1, gain));
        try {
            if (!_vco) {
                _vco = ctx.createOscillator();
                _vca = ctx.createGain();
                _vca.gain.value = 0;
                _vco.type = 'triangle';
                _vco.connect(_vca);
                _vca.connect(destination);
                _vco.start(0);
            }
            setCurrentToneGain(gain);
        } catch (e) {
            _vco = undefined;
            _vca = undefined;
            return;
        }

        _vco.frequency.value = frequency;
        setCurrentToneGain(gain);
    }

    export function setCurrentToneGain(gain: number) {
        if (_vca?.gain) {
            _vca.gain.setTargetAtTime(gain, _context.currentTime, 0.015)
        }
    }

    function uint8ArrayToString(input: Uint8Array) {
        let len = input.length;
        let res = ""
        for (let i = 0; i < len; ++i)
            res += String.fromCharCode(input[i]);
        return res;
    }

    export function playBufferAsync(buf: RefBuffer) {
        if (!buf) return Promise.resolve();

        return new Promise<void>(resolve => {
            function res() {
                if (resolve) resolve();
                resolve = undefined;
            }
            const url = "data:audio/wav;base64," + window.btoa(uint8ArrayToString(buf.data))
            audio = new Audio(url);
            if (_mute)
                audio.volume = 0;
            audio.onended = () => res();
            audio.onpause = () => res();
            audio.onerror = () => res();
            audio.play();
        })
    }

    const MAX_SCHEDULED_BUFFER_NODES = 3;

    export function playPCMBufferStreamAsync(pull: () => Float32Array, sampleRate: number, volume = 0.3, isCancelled?: () => boolean) {
        return new Promise<void>(resolve => {
            let nodes: AudioBufferSourceNode[] = [];
            let nextTime = context().currentTime;
            let allScheduled = false;
            const channel = new Channel();

            channel.gain = context().createGain();
            channel.gain.gain.value = 0;
            channel.gain.gain.setValueAtTime(volume, context().currentTime);
            channel.gain.connect(destination);

            if (channels.length > 20)
                channels[0].remove()
            channels.push(channel);

            const checkCancel = () => {
                if (isCancelled && isCancelled() || !channel.gain) {
                    if (resolve) resolve();
                    resolve = undefined;
                    channel.remove();
                    return true;
                }
                return false;
            }

            // Every time we pull a buffer, schedule a node in the future to play it.
            // Scheduling the nodes ahead of time sounds much smoother than trying to
            // do it when the previous node completes (which sounds SUPER choppy in
            // FireFox).
            function playNext() {
                while (!allScheduled && nodes.length < MAX_SCHEDULED_BUFFER_NODES && !checkCancel()) {
                    const data = pull();
                    if (!data || !data.length) {
                        allScheduled = true;
                        break;
                    }
                    play(data);
                }

                if ((allScheduled && nodes.length === 0)) {
                    channel.remove();
                    if (resolve) resolve();
                    resolve = undefined;
                }
            }

            function play(data: Float32Array) {
                if (checkCancel()) return;

                const buff = context().createBuffer(1, data.length, sampleRate);
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
                const newNode = context().createBufferSource();
                nodes.push(newNode);
                newNode.connect(channel.gain);
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

    function frequencyFromMidiNoteNumber(note: number) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    export function playInstructionsAsync(instructions: Uint8Array, isCancelled?: () => boolean, onPull?: (freq: number, volume: number) => void) {
        return new Promise<void>(async resolve => {
            soundEventCallback?.("playinstructions", instructions);
            let resolved = false;
            let ctx = context();
            let channel = new Channel()

            if (channels.length > 20)
                channels[0].remove()
            channels.push(channel);


            channel.gain = ctx.createGain();
            channel.gain.gain.value = 1;

            channel.gain.connect(destination);

            const oscillators: pxt.Map<OscillatorNode | AudioBufferSourceNode> = {};
            const gains: pxt.Map<GainNode> = {};
            let startTime = ctx.currentTime;
            let currentTime = startTime;
            let currentWave = 0;

            let totalDuration = 0;

            /** Square waves are perceved as much louder than other sounds, so scale it down a bit to make it less jarring **/
            const scaleVol = (n: number, isSqWave?: boolean) => (n / 1024) / 4 * (isSqWave ? .5 : 1);

            const disconnectNodes = () => {
                if (resolved) return;
                resolved = true;
                channel.disconnectNodes();

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
                    oscillators[wave] = getGenerator(wave, startFrequency);
                    gains[wave] = ctx.createGain();
                    gains[wave].gain.value = 0;
                    gains[wave].connect(channel.gain);
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
                        osc.playbackRate.linearRampToValueAtTime(endFrequency / (ctx.sampleRate / 4), currentTime + duration);
                    else if (wave != 5)
                        osc.playbackRate.linearRampToValueAtTime(endFrequency / (ctx.sampleRate / 1024), currentTime + duration);
                }
                gain.gain.setValueAtTime(scaleVol(startVolume, isSquareWave), currentTime);
                gain.gain.linearRampToValueAtTime(scaleVol(endVolume, isSquareWave), currentTime + duration);

                currentWave = wave;
                currentTime += duration;
            }
            channel.gain.gain.setTargetAtTime(0, currentTime, 0.015);

            if (isCancelled || onPull) {
                const handleAnimationFrame = () => {
                    const time = ctx.currentTime;
                    if (time > startTime + totalDuration) {
                        return;
                    }


                    if (isCancelled && isCancelled()) {
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
        })
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

    export function sendMidiMessage(buf: RefBuffer) {
        const data = buf.data;
        if (!data.length) // garbage.
            return;

        // no midi access or no midi element,
        // limited interpretation of midi commands
        const cmd = data[0] >> 4;
        const channel = data[0] & 0xf;
        const noteNumber = data[1] || 0;
        const noteFrequency = frequencyFromMidiNoteNumber(noteNumber);
        const velocity = data[2] || 0;
        //pxsim.log(`midi: cmd ${cmd} channel (-1) ${channel} note ${noteNumber} f ${noteFrequency} v ${velocity}`)

        // play drums regardless
        if (cmd == 8 || ((cmd == 9) && (velocity == 0))) { // with MIDI, note on with velocity zero is the same as note off
            // note off
            stopTone();
        } else if (cmd == 9) {
            // note on -- todo handle velocity
            tone(noteFrequency, 1);
            if (channel == 9) // drums don't call noteOff
                setTimeout(() => stopTone(), 500);
        }
    }
}