namespace pxsim.AudioContextManager {
    let _context: AudioContext;

    let _mute = false; //mute audio

    // for playing WAV
    let audio: HTMLAudioElement;
    let stopAllListeners: (() => void)[] = [];

    // All other nodes get connected to this node which is connected to the actual
    // destination. Used for muting
    let destination: GainNode;

    export function isAudioElementActive() {
        return AudioToneSource.isActive();
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
        AudioToneSource.dispose();

        if (audio) {
            audio.pause();
        }
    }

    export function stopAll() {
        stopTone();
        muteAllChannels();

        AudioSource.stopAll();

        for (const handler of stopAllListeners) {
            handler();
        }
    }

    export function stop() {
        stopTone();
    }

    export function onStopAll(handler: () => void) {
        stopAllListeners.push(handler);
    }

    export function frequency(): number {
        return AudioToneSource.getFrequency();
    }

    let instrStopId = 1
    export function muteAllChannels() {
        soundEventCallback?.("muteallchannels");
        instrStopId++;
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

        let source: AudioToneSource;

        try {
            source = AudioToneSource.getInstance(context(), destination);

            source.setFrequency(frequency);
            source.setGain(gain, context().currentTime);
            source.start();
        }
        catch (e) {
            if (source) {
                source.dispose();
            }
        }
    }

    export function setCurrentToneGain(gain: number) {
        AudioToneSource.setCurrentToneGain(gain, context().currentTime);
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

    export async function playPCMBufferStreamAsync(pull: () => Float32Array, sampleRate: number, volume = 0.3, isCancelled?: () => boolean) {
        const source = new AudioBufferStreamSource(context(), destination);

        await source.playStreamAsync(pull, sampleRate, volume, isCancelled);

        if (!source.isDisposed()) {
            source.dispose();
        }
    }

    function frequencyFromMidiNoteNumber(note: number) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    export async function playInstructionsAsync(instructions: Uint8Array, isCancelled?: () => boolean, onPull?: (data: Float32Array, fft: Uint8Array) => void) {
        soundEventCallback?.("playinstructions", instructions);

        await AudioWorkletSource.initializeWorklet(context());

        let channel: AudioWorkletSource;
        let finished = false;

        if (onPull) {
            channel = new AudioWorkletSource(context(), destination);

            const bufferLength = channel.analyser.frequencyBinCount;
            const dataArray = new Float32Array(bufferLength);
            const fftArray = new Uint8Array(bufferLength);

            const handleAnimationFrame = () => {
                if (finished || isCancelled?.()) {
                    channel.dispose();
                    return;
                }

                channel.analyser.getFloatTimeDomainData(dataArray);
                channel.analyser.getByteFrequencyData(fftArray);
                onPull(dataArray, fftArray);

                requestAnimationFrame(handleAnimationFrame)
            }
            requestAnimationFrame(handleAnimationFrame);
        }
        else {
            channel = AudioWorkletSource.getAvailableSource();

            if (!channel) {
                channel = new AudioWorkletSource(context(), destination);
            }
        }

        await channel.playInstructionsAsync(instructions, isCancelled);

        finished = true;
    }

    export function setWavetable(tableBuff: RefBuffer) {
        if (!tableBuff) {
            AudioWorkletSource.setWavetable(undefined);
            return;
        }

        const wavetable = [];
        for (let i = 0; i < tableBuff.data.length; i += 2) {
            wavetable.push(BufferMethods.getNumber(tableBuff, BufferMethods.NumberFormat.Int16LE, i));
        }

        AudioWorkletSource.setWavetable(wavetable);
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

    export interface PlaySampleResult {
        promise: Promise<void>;
        cancel: () => void;
    }

    export function startSamplePlayback(sample: RefBuffer, format: BufferMethods.NumberFormat, sampleRange: number, sampleRate: number, gain: number): PlaySampleResult {
        let playbackRate = 1;
        // chrome errors out if the sample rate is outside [3000, 768000]
        if (sampleRate < 3000) {
            playbackRate = sampleRate / 3000;
            sampleRate = 3000;
        }
        else if (sampleRate > 768000) {
            playbackRate = sampleRate / 768000;
            sampleRate = 768000;
        }

        const size = BufferMethods.fmtInfo(format).size;
        const buf = context().createBuffer(
            1,
            sample.data.length / size,
            sampleRate
        );

        const data = buf.getChannelData(0);

        for (let i = 0; i < buf.length; i++) {
            data[i] = (BufferMethods.getNumber(sample, format, i * size) / sampleRange) * 2 - 1
        }

        const source = new AudioBufferSource(context(), destination);

        return {
            cancel: () => source.dispose(),
            promise: source.playBufferAsync(buf, playbackRate, gain)
        };
    }

    export function createAudioSourceNode(uri: string, clippingThreshold: number, volume: number): HTMLAudioElement {
        const source = new AudioElementSource(context(), destination, uri, clippingThreshold, volume);

        return source.getAudioElement();
    }

    export function createSpatialAudioPlayer(): number {
        return new SpatialAudioPlayer(context(), destination).id;
    }

    export function setSpatialAudioPlayerPosition(id: number, x: number, y: number, z: number) {
        const player = SpatialAudioPlayer.getPlayerById(id);
        if (player) {
            player.setPosition(x, y, z);
        }
    }

    export function setSpatialAudioPlayerOrientation(id: number, x: number, y: number, z: number) {
        const player = SpatialAudioPlayer.getPlayerById(id);
        if (player) {
            player.setOrientation(x, y, z);
        }
    }

    export function setSpatialAudioPlayerCone(id: number, innerAngle: number, outerAngle: number, outerGain: number) {
        const player = SpatialAudioPlayer.getPlayerById(id);
        if (player) {
            player.setCone(innerAngle, outerAngle, outerGain);
        }
    }

    export function setSpatialAudioRollOff(id: number, refDistance: number, maxDistance: number, rollOffFactor: number) {
        const player = SpatialAudioPlayer.getPlayerById(id);
        if (player) {
            player.setRollOff(refDistance, maxDistance, rollOffFactor);
        }
    }

    export function setSpatialAudioDistanceModel(id: number, model: DistanceModelValue) {
        const player = SpatialAudioPlayer.getPlayerById(id);
        if (player) {
            player.setDistanceModel(model);
        }
    }

    export function disposeSpatialAudioPlayer(id: number) {
        const player = SpatialAudioPlayer.getPlayerById(id);
        if (player) {
            player.dispose();
        }
    }

    export function queuePlayInstructionsAtSpatialAudioPlayer(id: number, when: number, b: RefBuffer) {
        const player = SpatialAudioPlayer.getPlayerById(id);
        if (player) {
            const prevStop = instrStopId
            U.delay(when)
                .then(() => {
                    if (prevStop != instrStopId)
                        return Promise.resolve()
                    return player.playInstructionsAsync(b.data)
                });
        }
    }

    export function setListenerPosition(x: number, y: number, z: number) {
        const ctx = context();
        if (ctx) {
            ctx.listener.positionX.setTargetAtTime(x, 0, 0.02);
            ctx.listener.positionY.setTargetAtTime(y, 0, 0.02);
            ctx.listener.positionZ.setTargetAtTime(z, 0, 0.02);
        }
    }
}