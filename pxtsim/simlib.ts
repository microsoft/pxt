namespace pxsim {
    export type BoardPin = string;
    export interface BBLoc {
        type: "breadboard",
        row: string,
        col: string
        xOffset?: number,
        yOffset?: number,
        style?: PinStyle;
    };
    export interface BoardLoc {
        type: "dalboard",
        pin: BoardPin
    };
    export type Loc = BBLoc | BoardLoc;

    export function mkRange(a: number, b: number): number[] {
        let res: number[] = [];
        for (; a < b; a++)
            res.push(a);
        return res;
    }

    export class EventBus {
        private queues: Map<EventQueue> = {};
        private notifyID: number;
        private notifyOneID: number;
        private schedulerID: number;
        private idleEventID: number;
        private lastEventValue: string | number;
        private lastEventTimestampUs: number;
        private backgroundHandlerFlag: boolean = false;

        public nextNotifyEvent = 1024;

        constructor(
            private readonly runtime: Runtime,
            private readonly board: BaseBoard,
            private readonly valueToArgs?: EventValueToActionArgs
        ) {
            this.schedulerID = 15; // DEVICE_ID_SCHEDULER
            this.idleEventID = 2; // DEVICE_SCHEDULER_EVT_IDLE

            this.board.addMessageListener(this.handleMessage.bind(this));
        }

        private handleMessage(msg: pxsim.SimulatorMessage) {
            if (msg.type === "eventbus") {
                const ev = <SimulatorEventBusMessage>msg;
                this.queue(ev.id, ev.eventid, ev.value);
            }
        }

        public setBackgroundHandlerFlag() {
            this.backgroundHandlerFlag = true;
        }

        public setNotify(notifyID: number, notifyOneID: number) {
            this.notifyID = notifyID;
            this.notifyOneID = notifyOneID;
        }

        public setIdle(schedulerID: number, idleEventID: number) {
            this.schedulerID = schedulerID;
            this.idleEventID = idleEventID;
        }

        private start(id: EventIDType, evid: EventIDType, background: boolean, create: boolean = false) {
            let key = (background ? "back" : "fore") + ":" + id + ":" + evid
            if (!this.queues[key] && create) this.queues[key] = new EventQueue(this.runtime, this.valueToArgs);
            return this.queues[key];
        }

        listen(id: EventIDType, evid: EventIDType, handler: RefAction, flags = 0) {
            // special handle for idle, start the idle timeout
            if (id == this.schedulerID && evid == this.idleEventID)
                this.runtime.startIdle();

            let q = this.start(id, evid, this.backgroundHandlerFlag, true);
            if (this.backgroundHandlerFlag) {
                q.addHandler(handler, flags);
            }
            else {
                q.setHandler(handler, flags);
            }
            this.backgroundHandlerFlag = false;
        }

        removeBackgroundHandler(handler: RefAction) {
            Object.keys(this.queues).forEach((k: string) => {
                if (k.startsWith("back:"))
                    this.queues[k].removeHandler(handler)
            });
        }

        // this handles ANY (0) semantics for id and evid
        private getQueues(id: EventIDType, evid: EventIDType, bg: boolean) {
            let ret = [this.start(0, 0, bg)]
            if (id == 0 && evid == 0)
                return ret
            if (evid)
                ret.push(this.start(0, evid, bg))
            if (id)
                ret.push(this.start(id, 0, bg))
            if (id && evid)
                ret.push(this.start(id, evid, bg))
            return ret
        }

        queue(id: EventIDType, evid: EventIDType, value: EventIDType = null) {
            if (runtime.pausedOnBreakpoint) return;
            // special handling for notify one
            const notifyOne = this.notifyID && this.notifyOneID && id == this.notifyOneID;
            if (notifyOne)
                id = this.notifyID;
            let queues = this.getQueues(id, evid, true).concat(this.getQueues(id, evid, false))
            this.lastEventValue = evid;
            this.lastEventTimestampUs = U.perfNowUs();

            U.promiseMapAllSeries(queues, q => {
                if (q) return q.push(value, notifyOne);
                else return Promise.resolve()
            })
        }

        queueIdle() {
            if (this.schedulerID && this.idleEventID)
                this.queue(this.schedulerID, this.idleEventID);
        }

        // only for foreground handlers
        wait(id: number | string, evid: number | string, cb: (value?: any) => void) {
            let q = this.start(id, evid, false, true);
            q.addAwaiter(cb);
        }

        getLastEventValue() {
            return this.lastEventValue;
        }

        getLastEventTime() {
            return 0xffffffff & (this.lastEventTimestampUs - runtime.startTimeUs);
        }
    }

    export interface AnimationOptions {
        interval: number;
        // false means last frame
        frame: () => boolean;
        whenDone?: (cancelled: boolean) => void;
        setTimeoutHandle?: any;
    }

    export class AnimationQueue {
        private queue: AnimationOptions[] = [];
        private process: () => void;

        constructor(private runtime: Runtime) {
            this.process = () => {
                let top = this.queue[0];
                if (!top) return;
                if (this.runtime.dead) return;
                runtime = this.runtime;
                let res = top.frame();
                runtime.queueDisplayUpdate();
                runtime.maybeUpdateDisplay();
                if (res === false) {
                    this.queue.shift();
                    // if there is already something in the queue, start processing
                    if (this.queue[0]) {
                        this.queue[0].setTimeoutHandle = setTimeout(this.process, this.queue[0].interval);
                    }
                    // this may push additional stuff
                    top.whenDone(false);
                } else {
                    top.setTimeoutHandle = setTimeout(this.process, top.interval);
                }
            }
        }

        public cancelAll() {
            let q = this.queue
            this.queue = []
            for (let a of q) {
                a.whenDone(true)
                if (a.setTimeoutHandle) {
                    clearTimeout(a.setTimeoutHandle);
                }
            }
        }

        public cancelCurrent() {
            let top = this.queue[0]
            if (top) {
                this.queue.shift();
                top.whenDone(true);
                if (top.setTimeoutHandle) {
                    clearTimeout(top.setTimeoutHandle);
                }
            }
        }

        public enqueue(anim: AnimationOptions) {
            if (!anim.whenDone) anim.whenDone = () => { };
            this.queue.push(anim)
            // we start processing when the queue goes from 0 to 1
            if (this.queue.length == 1)
                this.process()
        }

        public executeAsync(anim: AnimationOptions) {
            U.assert(!anim.whenDone)
            return new Promise<boolean>((resolve, reject) => {
                anim.whenDone = resolve
                this.enqueue(anim)
            })
        }
    }

    export namespace AudioContextManager {
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

            for (const channel of workletChannels) {
                channel.dispose();
            }
            workletChannels = [];

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

        class Channel {
            generator: AudioNode;
            gain: GainNode

            constructor() {
                this.gain = context().createGain();
                this.gain.connect(destination);
                this.gain.gain.value = 0;
            }

            disconnectNodes() {
                if (this.gain)
                    disconnectVca(this.gain, this.generator)
                else if (this.generator) {
                    if ((this.generator as OscillatorNode | AudioBufferSourceNode).stop) {
                        (this.generator as OscillatorNode | AudioBufferSourceNode).stop();
                    }
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
                const channel = getChannel();
                channel.gain.gain.setValueAtTime(volume, context().currentTime);

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

        let nextSoundId = 0;

        interface ActiveSound {
            id: number;
            resolve: () => void;
            isCancelled: () => boolean;
        }

        class AudioWorkletChannel {
            node: AudioWorkletNode;
            analyser: AnalyserNode;
            activeSounds: ActiveSound[];

            protected animRef: number;

            constructor() {
                this.analyser = context().createAnalyser();
                this.analyser.fftSize = 2048;
                this.node = new AudioWorkletNode(context(), "pxt-mixer-audio-worklet-processor");
                this.node.connect(this.analyser);
                this.analyser.connect(destination);
                this.node.port.onmessage = e => {
                    if (e.data.type === "done") {
                        const entry = this.activeSounds.find(s => s.id === e.data.id);
                        if (entry) {
                            entry.resolve();
                            this.activeSounds = this.activeSounds.filter(s => s !== entry);
                        }
                        // console.log(`[channel ${workletChannels.indexOf(this)}]  done: ${e.data.id} remaining: ${this.activeSounds}`);
                    }
                }
                this.activeSounds = [];
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

        let workletInit: Promise<void>;
        let workletChannels: AudioWorkletChannel[] = [];
        export async function playInstructionsAsync(instructions: Uint8Array, isCancelled?: () => boolean, onPull?: (data: Float32Array, fft: Uint8Array) => void) {
            soundEventCallback?.("playinstructions", instructions);

            if (!workletInit) {
                workletInit = (async () => {
                    // await context().audioWorklet.addModule("/static/audioWorklet/audioWorkletProcessor.js");
                    await context().audioWorklet.addModule(getWorkletUri());
                })();
            }
            await workletInit;

            let channel: AudioWorkletChannel;
            let finished = false;

            if (onPull) {
                channel = new AudioWorkletChannel();

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
                channel = workletChannels.find(c => c.activeSounds.length < 30);

                if (!channel) {
                    channel = new AudioWorkletChannel();
                    workletChannels.push(channel);
                }
            }

            if (wavetable) {
                channel.setWavetable(wavetable);
            }

            await channel.playInstructionsAsync(instructions, isCancelled);

            finished = true;
        }

        let wavetable: number[];

        export function setWavetable(tableBuff: RefBuffer) {
            if (!tableBuff) {
                wavetable = undefined;
                return;
            }
            wavetable = [];
            for (let i = 0; i < tableBuff.data.length; i += 2) {
                wavetable.push(BufferMethods.getNumber(tableBuff, BufferMethods.NumberFormat.Int16LE, i));
            }

            for (const channel of workletChannels) {
                channel.setWavetable(wavetable);
            }
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
            let channel: Channel;
            let _resolve: () => void;

            const cancel = () => {
                if (!channel) return;
                channel.remove();
                channel = undefined;
                _resolve();
            }

            const promise = new Promise<void>(resolve => {
                _resolve = resolve;
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

                channel = getChannel();

                const node = context().createBufferSource();;
                node.playbackRate.value = playbackRate;

                channel.gain.gain.value = gain;
                channel.generator = node;
                (channel.generator as AudioBufferSourceNode).buffer = buf;
                (channel.generator as AudioBufferSourceNode).connect(channel.gain);
                (channel.generator as AudioBufferSourceNode).start(0);

                channel.generator.addEventListener("ended", () => {
                    channel.remove();
                    channel = undefined;
                    resolve();
                });
            });

            return {
                promise,
                cancel
            };
        }

        export function createAudioSourceNode(uri: string, clippingThreshold: number, volume: number): HTMLAudioElement {
            const audioElement = new Audio(uri);
            const source = context().createMediaElementSource(audioElement);
            const distortion = context().createWaveShaper();
            distortion.curve = makeDistortionCurve(clippingThreshold);
            distortion.oversample = "4x";

            const channel = getChannel();
            channel.generator = distortion;
            channel.generator.connect(channel.gain);
            source.connect(distortion);
            // scaling the volume to be a multiplier of 0.1
            // 0.1 is what sounded the best when testing audio recordings against other music blocks
            channel.gain.gain.value = volume * 0.1;

            return audioElement;
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


        function getChannel() {
            if (channels.length > 20)
                channels[0].remove();
            const channel = new Channel();
            channels.push(channel);
            return channel;
        }
    }

    export interface IPointerEvents {
        up: string,
        down: string[],
        move: string,
        enter: string,
        leave: string
    }

    export function isTouchEnabled(): boolean {
        return typeof window !== "undefined" &&
            ('ontouchstart' in window                              // works on most browsers
                || (navigator && navigator.maxTouchPoints > 0));       // works on IE10/11 and Surface);
    }

    export function hasPointerEvents(): boolean {
        return typeof window != "undefined" && !!(window as any).PointerEvent;
    }

    export const pointerEvents: IPointerEvents = hasPointerEvents() ? {
        up: "pointerup",
        down: ["pointerdown"],
        move: "pointermove",
        enter: "pointerenter",
        leave: "pointerleave"
    } : isTouchEnabled() ?
            {
                up: "mouseup",
                down: ["mousedown", "touchstart"],
                move: "touchmove",
                enter: "touchenter",
                leave: "touchend"
            } :
            {
                up: "mouseup",
                down: ["mousedown"],
                move: "mousemove",
                enter: "mouseenter",
                leave: "mouseleave"
            };
}

namespace pxsim.visuals {
    export interface IBoardPart<T> {
        style: string,
        element: SVGElement,
        overElement?: SVGElement,
        defs: SVGElement[],
        init(bus: EventBus, state: T, svgEl: SVGSVGElement, otherParams: Map<string>): void, //NOTE: constructors not supported in interfaces
        moveToCoord(xy: visuals.Coord): void,
        updateState(): void,
        updateTheme(): void,
    }

    export function translateEl(el: SVGElement, xy: [number, number]) {
        //TODO append translation instead of replacing the full transform
        svg.hydrate(el, { transform: `translate(${xy[0]} ${xy[1]})` });
    }

    export interface ComposeOpts {
        el1: SVGAndSize<SVGSVGElement>,
        scaleUnit1: number,
        el2: SVGAndSize<SVGSVGElement>,
        scaleUnit2: number,
        margin: [number, number, number, number],
        middleMargin: number,
        maxWidth?: string,
        maxHeight?: string,
    }
    export interface ComposeResult {
        host: SVGSVGElement,
        scaleUnit: number,
        under: SVGGElement,
        over: SVGGElement,
        edges: number[],
        toHostCoord1: (xy: Coord) => Coord,
        toHostCoord2: (xy: Coord) => Coord,
    }
    export function composeSVG(opts: ComposeOpts): ComposeResult {
        let [a, b] = [opts.el1, opts.el2];
        U.assert(a.x == 0 && a.y == 0 && b.x == 0 && b.y == 0, "el1 and el2 x,y offsets not supported");
        let setXY = (e: SVGSVGElement, x: number, y: number) => svg.hydrate(e, { x: x, y: y });
        let setWH = (e: SVGSVGElement, w: string, h: string) => {
            if (w)
                svg.hydrate(e, { width: w });
            if (h)
                svg.hydrate(e, { height: h });
        }
        let setWHpx = (e: SVGSVGElement, w: number, h: number) => svg.hydrate(e, { width: `${w}px`, height: `${h}px` });
        let scaleUnit = opts.scaleUnit2;
        let aScalar = opts.scaleUnit2 / opts.scaleUnit1;
        let bScalar = 1.0;
        let aw = a.w * aScalar;
        let ah = a.h * aScalar;
        setWHpx(a.el, aw, ah);
        let bw = b.w * bScalar;
        let bh = b.h * bScalar;
        setWHpx(b.el, bw, bh);
        let [mt, mr, mb, ml] = opts.margin;
        let mm = opts.middleMargin;
        let innerW = Math.max(aw, bw);
        let ax = mr + (innerW - aw) / 2.0;
        let ay = mt;
        setXY(a.el, ax, ay);
        let bx = mr + (innerW - bw) / 2.0;
        let by = ay + ah + mm;
        setXY(b.el, bx, by);
        let edges = [ay, ay + ah, by, by + bh];
        let w = mr + innerW + ml;
        let h = mt + ah + mm + bh + mb;
        let host = <SVGSVGElement>svg.elt("svg", {
            "version": "1.0",
            "viewBox": `0 0 ${w} ${h}`,
            "class": `sim-bb`,
        });
        setWH(host, opts.maxWidth, opts.maxHeight);
        setXY(host, 0, 0);
        let under = <SVGGElement>svg.child(host, "g");
        host.appendChild(a.el);
        host.appendChild(b.el);
        let over = <SVGGElement>svg.child(host, "g");
        let toHostCoord1 = (xy: Coord): Coord => {
            let [x, y] = xy;
            return [x * aScalar + ax, y * aScalar + ay];
        };
        let toHostCoord2 = (xy: Coord): Coord => {
            let [x, y] = xy;
            return [x * bScalar + bx, y * bScalar + by];
        };
        return {
            under: under,
            over: over,
            host: host,
            edges: edges,
            scaleUnit: scaleUnit,
            toHostCoord1: toHostCoord1,
            toHostCoord2: toHostCoord2,
        };
    }

    export function mkScaleFn(originUnit: number, targetUnit: number): (n: number) => number {
        return (n: number) => n * (targetUnit / originUnit);
    }
    export interface MkImageOpts {
        image: string,
        width: number,
        height: number,
        imageUnitDist: number,
        targetUnitDist: number
    }
    export function mkImageSVG(opts: MkImageOpts): SVGAndSize<SVGImageElement> {
        let scaleFn = mkScaleFn(opts.imageUnitDist, opts.targetUnitDist);
        let w = scaleFn(opts.width);
        let h = scaleFn(opts.height);
        let img = <SVGImageElement>svg.elt("image", {
            width: w,
            height: h
        });
        let href = img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `${opts.image}`);
        return { el: img, w: w, h: h, x: 0, y: 0 };
    }

    export type Coord = [number, number];
    export function findDistSqrd(a: Coord, b: Coord): number {
        let x = a[0] - b[0];
        let y = a[1] - b[1];
        return x * x + y * y;
    }
    export function findClosestCoordIdx(a: Coord, bs: Coord[]): number {
        let dists = bs.map(b => findDistSqrd(a, b));
        let minIdx = dists.reduce((prevIdx, currDist, currIdx, arr) => {
            return currDist < arr[prevIdx] ? currIdx : prevIdx;
        }, 0);
        return minIdx;
    }

    export function mkTxt(cx: number, cy: number, size: number, rot: number, txt: string, txtXOffFactor?: number, txtYOffFactor?: number): SVGTextElement {
        let el = <SVGTextElement>svg.elt("text")
        //HACK: these constants (txtXOffFactor, txtYOffFactor) tweak the way this algorithm knows how to center the text
        txtXOffFactor = txtXOffFactor || -0.33333;
        txtYOffFactor = txtYOffFactor || 0.3;
        const xOff = txtXOffFactor * size * txt.length;
        const yOff = txtYOffFactor * size;
        svg.hydrate(el, {
            style: `font-size:${size}px;`,
            transform: `translate(${cx} ${cy}) rotate(${rot}) translate(${xOff} ${yOff})`
        });
        pxsim.U.addClass(el, "noselect");
        el.textContent = txt;
        return el;
    }

    export type WireColor =
        "black" | "white" | "gray" | "purple" | "blue" | "green" | "yellow" | "orange" | "red" | "brown" | "pink";
    export const GPIO_WIRE_COLORS = ["pink", "orange", "yellow", "green", "purple"];
    export const WIRE_COLOR_MAP: Map<string> = {
        black: "#514f4d",
        white: "#fcfdfc",
        gray: "#acabab",
        purple: "#a772a1",
        blue: "#01a6e8",
        green: "#3cce73",
        yellow: "#ece600",
        orange: "#fdb262",
        red: "#f44f43",
        brown: "#c89764",
        pink: "#ff80fa"
    }
    export function mapWireColor(clr: WireColor | string): string {
        return WIRE_COLOR_MAP[clr] || clr;
    }

    export interface SVGAndSize<T extends SVGElement> {
        el: T,
        y: number,
        x: number,
        w: number,
        h: number
    };
    export type SVGElAndSize = SVGAndSize<SVGElement>;

    export const PIN_DIST = 15;

    export interface BoardView {
        getView(): SVGAndSize<SVGSVGElement>;
        getCoord(pinNm: string): Coord;
        getPinDist(): number;
        highlightPin(pinNm: string): void;
        removeEventListeners?(): void;
    }

    //expects rgb from 0,255, gives h in [0,360], s in [0, 100], l in [0, 100]
    export function rgbToHsl(rgb: [number, number, number]): [number, number, number] {
        let [r, g, b] = rgb;
        let [r$, g$, b$] = [r / 255, g / 255, b / 255];
        let cMin = Math.min(r$, g$, b$);
        let cMax = Math.max(r$, g$, b$);
        let cDelta = cMax - cMin;
        let h: number, s: number, l: number;
        let maxAndMin = cMax + cMin;

        //lum
        l = (maxAndMin / 2) * 100

        if (cDelta === 0)
            s = h = 0;
        else {
            //hue
            if (cMax === r$)
                h = 60 * (((g$ - b$) / cDelta) % 6);
            else if (cMax === g$)
                h = 60 * (((b$ - r$) / cDelta) + 2);
            else if (cMax === b$)
                h = 60 * (((r$ - g$) / cDelta) + 4);

            //sat
            if (l > 50)
                s = 100 * (cDelta / (2 - maxAndMin));
            else
                s = 100 * (cDelta / maxAndMin);
        }

        return [Math.floor(h), Math.floor(s), Math.floor(l)];
    }
}
