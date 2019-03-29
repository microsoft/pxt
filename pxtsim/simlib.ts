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

    export class EventBusGeneric<T> {
        private queues: Map<EventQueue<T>> = {};
        private notifyID: number;
        private notifyOneID: number;
        private lastEventValue: string | number;
        private lastEventTimestampUs: number;
        private backgroundHandlerFlag: boolean = false;

        public nextNotifyEvent = 1024;

        public setBackgroundHandlerFlag() {
            this.backgroundHandlerFlag = true;
        }

        public setNotify(notifyID: number, notifyOneID: number) {
            this.notifyID = notifyID;
            this.notifyOneID = notifyOneID;
        }

        constructor(private runtime: Runtime, private valueToArgs?: EventValueToActionArgs<T>) { }

        private start(id: number | string, evid: number | string, background: boolean, create: boolean = false) {
            let key = (background ? "back" : "fore") + ":" + id + ":" + evid
            if (!this.queues[key] && create) this.queues[key] = new EventQueue<T>(this.runtime, this.valueToArgs);;
            return this.queues[key];
        }

        listen(id: number | string, evid: number | string, handler: RefAction) {
            let q = this.start(id, evid, this.backgroundHandlerFlag, true);
            if (this.backgroundHandlerFlag)
                q.addHandler(handler);
            else
                q.setHandler(handler);
            this.backgroundHandlerFlag = false;
        }

        removeBackgroundHandler(handler: RefAction) {
            Object.keys(this.queues).forEach((k: string) => {
                if (k.startsWith("back:"))
                    this.queues[k].removeHandler(handler)
            });
        }

        // this handles ANY (0) semantics for id and evid
        private getQueues(id: number | string, evid: number | string, bg: boolean) {
            let ret = [ this.start(0, 0, bg) ]
            if (id == 0 && evid == 0)
                return ret
            if (id == 0)
                ret.push(this.start(0, evid, bg))
            if (evid == 0)
                ret.push(this.start(id, 0, bg))
            if (id != 0 && evid != 0)
                ret.push(this.start(id, evid, bg))
            return ret
        }

        queue(id: number | string, evid: number | string, value: T = null) {
            if (runtime.pausedOnBreakpoint) return;
            // special handling for notify one
            const notifyOne = this.notifyID && this.notifyOneID && id == this.notifyOneID;
            if (notifyOne)
                id = this.notifyID;
            let queues = this.getQueues(id, evid, true).concat(this.getQueues(id, evid, false))
            this.lastEventValue = evid;
            this.lastEventTimestampUs = U.perfNowUs();
            Promise.each(queues, (q) => {
                if (q) return q.push(value, notifyOne);
                else return Promise.resolve()
            })
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

    export class EventBus extends EventBusGeneric<number> {
        // queue(id: number | string, evid: number | string, value: number = 0) {
        //     super.queue(id, evid, value);
        // }
    }

    export interface AnimationOptions {
        interval: number;
        // false means last frame
        frame: () => boolean;
        whenDone?: (cancelled: boolean) => void;
        setTimeoutHandle?: number;
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

        function context(): AudioContext {
            if (!_context) _context = freshContext();
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
            stopAll();
        }

        function stopTone() {
            if (_vca) _vca.gain.value = 0;
            _frequency = 0;
            if (audio) {
                audio.pause();
            }
        }

        export function stopAll() {
            stopTone();
            muteAllChannels();
        }

        export function stop() {
            stopTone();
        }

        export function frequency(): number {
            return _frequency;
        }

        const waveForms: OscillatorType[] = [null, "triangle", "sawtooth", "sine"]
        let metallicBuffer: AudioBuffer
        let noiseBuffer: AudioBuffer
        let squareBuffer: AudioBuffer[] = []

        function getMetallicBuffer() {
            if (!metallicBuffer) {
                const bufferSize = 1024;
                metallicBuffer = context().createBuffer(1, bufferSize, context().sampleRate);
                const output = metallicBuffer.getChannelData(0);

                for (let i = 0; i < bufferSize; i++) {
                    output[i] = (((i * 7919) & 1023) / 512.0) - 1.0;
                }
            }
            return metallicBuffer
        }

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
        #define SW_SINE 3 // TODO remove it? it takes space
        #define SW_NOISE 4
        #define SW_REAL_NOISE 5
        #define SW_SQUARE_10 11
        #define SW_SQUARE_50 15
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
                buffer = getMetallicBuffer()
            else if (waveFormIdx == 5)
                buffer = getNoiseBuffer()
            else if (11 <= waveFormIdx && waveFormIdx <= 15)
                buffer = getSquareBuffer((waveFormIdx - 10) * 10)
            else
                return null

            let node = context().createBufferSource();
            node.buffer = buffer;
            node.loop = true;
            if (waveFormIdx != 5)
                node.playbackRate.value = hz / (context().sampleRate / 1024);

            return node
        }

        const channels: Channel[] = []
        class Channel {
            generator: OscillatorNode | AudioBufferSourceNode;
            gain: GainNode
            mute() {
                if (this.generator) {
                    this.generator.stop()
                    this.generator.disconnect()
                }
                if (this.gain)
                    this.gain.disconnect()
                this.gain = null
                this.generator = null
            }
            remove() {
                const idx = channels.indexOf(this)
                if (idx >= 0) channels.splice(idx, 1)
                this.mute()
            }
        }

        function muteAllChannels() {
            while (channels.length)
                channels[0].remove()
        }

        export function playInstructionsAsync(b: RefBuffer) {
            let ctx = context();

            let idx = 0
            let ch = new Channel()
            let currWave = -1
            let currFreq = -1
            let timeOff = 0

            if (channels.length > 5)
                channels[0].remove()
            channels.push(ch)

            const scaleVol = (n: number) => (n / 1024) * 2

            const finish = () => {
                ch.mute()
                timeOff = 0
                currWave = -1
                currFreq = -1
            }

            const loopAsync = (): Promise<void> => {
                if (idx >= b.data.length || !b.data[idx])
                    return Promise.delay(timeOff).then(finish)

                const soundWaveIdx = b.data[idx]
                const flags = b.data[idx + 1]
                const freq = BufferMethods.getNumber(b, BufferMethods.NumberFormat.UInt16LE, idx + 2)
                const duration = BufferMethods.getNumber(b, BufferMethods.NumberFormat.UInt16LE, idx + 4)
                const startVol = BufferMethods.getNumber(b, BufferMethods.NumberFormat.UInt16LE, idx + 6)
                const endVol = BufferMethods.getNumber(b, BufferMethods.NumberFormat.UInt16LE, idx + 8)

                if (!ctx)
                    return Promise.delay(duration)

                if (currWave != soundWaveIdx || currFreq != freq) {
                    if (ch.generator) {
                        return Promise.delay(timeOff)
                            .then(() => {
                                finish()
                                return loopAsync()
                            })
                    }

                    ch.generator = _mute ? null : getGenerator(soundWaveIdx, freq)

                    if (!ch.generator)
                        return Promise.delay(duration)

                    currWave = soundWaveIdx
                    currFreq = freq
                    ch.gain = ctx.createGain()
                    ch.gain.gain.value = scaleVol(startVol)

                    ch.generator.connect(ch.gain)
                    ch.gain.connect(ctx.destination);
                    ch.generator.start();
                }

                idx += 10

                ch.gain.gain.setValueAtTime(scaleVol(startVol), ctx.currentTime + (timeOff / 1000))
                timeOff += duration
                ch.gain.gain.linearRampToValueAtTime(scaleVol(endVol), ctx.currentTime + (timeOff / 1000))

                return loopAsync()
            }

            return loopAsync()
                .then(() => ch.remove())
        }

        export function tone(frequency: number, gain: number) {
            if (_mute) return;
            if (frequency <= 0) return;
            _frequency = frequency;

            let ctx = context();
            if (!ctx) return;

            if (_vco) {
                _vco.stop();
                _vco.disconnect();
                _vco = undefined;
            }

            gain = Math.max(0, Math.min(1, gain));
            try {
                _vco = ctx.createOscillator();
                _vca = ctx.createGain();
                _vco.type = 'triangle';
                _vco.connect(_vca);
                _vca.connect(ctx.destination);
                _vca.gain.value = gain;
                _vco.start(0);
            } catch (e) {
                _vco = undefined;
                _vca = undefined;
                return;
            }

            _vco.frequency.value = frequency;
            _vca.gain.value = gain;
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

        function frequencyFromMidiNoteNumber(note: number) {
            return 440 * Math.pow(2, (note - 69) / 12);
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
            //console.log(`midi: cmd ${cmd} channel (-1) ${channel} note ${noteNumber} f ${noteFrequency} v ${velocity}`)

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
        svg.addClass(el, "noselect");
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