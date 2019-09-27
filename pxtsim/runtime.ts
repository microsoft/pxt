/// <reference path="../localtypings/pxtparts.d.ts"/>

namespace pxsim {
    const MIN_MESSAGE_WAIT_MS = 200;
    let tracePauseMs = 0;
    export namespace U {
        // Keep these helpers unified with pxtlib/browserutils.ts
        export function containsClass(el: SVGElement | HTMLElement, classes: string) {
            return classes
                .split(/\s+/)
                .every(cls => containsSingleClass(el, cls));

            function containsSingleClass(el: SVGElement | HTMLElement, cls: string) {
                if (el.classList) {
                    return el.classList.contains(cls);
                } else {
                    const classes = (el.className + "").split(/\s+/);
                    return !(classes.indexOf(cls) < 0);
                }
            }
        }

        export function addClass(el: SVGElement | HTMLElement, classes: string) {
            classes
                .split(/\s+/)
                .forEach(cls => addSingleClass(el, cls));

            function addSingleClass(el: SVGElement | HTMLElement, cls: string) {
                if (el.classList) {
                    el.classList.add(cls);
                } else {
                    const classes = (el.className + "").split(/\s+/);
                    if (classes.indexOf(cls) < 0) {
                        el.className.baseVal += " " + cls;
                    }
                }
            }
        }

        export function removeClass(el: SVGElement | HTMLElement, classes: string) {
            classes
                .split(/\s+/)
                .forEach(cls => removeSingleClass(el, cls));

            function removeSingleClass(el: SVGElement | HTMLElement, cls: string) {
                if (el.classList) {
                    el.classList.remove(cls);
                } else {
                    el.className.baseVal = (el.className + "")
                        .split(/\s+/)
                        .filter(c => c != cls)
                        .join(" ");
                }
            }
        }

        export function remove(element: Element) {
            element.parentElement.removeChild(element);
        }

        export function removeChildren(element: Element) {
            while (element.firstChild) element.removeChild(element.firstChild);
        }

        export function clear(element: Element) {
            removeChildren(element);
        }

        export function assert(cond: boolean, msg = "Assertion failed") {
            if (!cond) {
                debugger
                throw new Error(msg)
            }
        }

        export function repeatMap<T>(n: number, fn: (index: number) => T): T[] {
            n = n || 0;
            let r: T[] = [];
            for (let i = 0; i < n; ++i) r.push(fn(i));
            return r;
        }

        export function userError(msg: string): Error {
            let e = new Error(msg);
            (<any>e).isUserError = true;
            throw e
        }

        export function now(): number {
            return Date.now();
        }

        let perf: () => number

        // current time in microseconds
        export function perfNowUs(): number {
            if (!perf)
                perf = typeof performance != "undefined" ?
                    performance.now.bind(performance) ||
                    (performance as any).moznow.bind(performance) ||
                    (performance as any).msNow.bind(performance) ||
                    (performance as any).webkitNow.bind(performance) ||
                    (performance as any).oNow.bind(performance) :
                    Date.now;
            return perf() * 1000;
        }

        export function nextTick(f: () => void) {
            (<any>Promise)._async._schedule(f)
        }

        // this will take lower 8 bits from each character
        export function stringToUint8Array(input: string) {
            let len = input.length;
            let res = new Uint8Array(len)
            for (let i = 0; i < len; ++i)
                res[i] = input.charCodeAt(i) & 0xff;
            return res;
        }

        export function uint8ArrayToString(input: ArrayLike<number>) {
            let len = input.length;
            let res = ""
            for (let i = 0; i < len; ++i)
                res += String.fromCharCode(input[i]);
            return res;
        }

        export function fromUTF8(binstr: string) {
            if (!binstr) return ""

            // escape function is deprecated
            let escaped = ""
            for (let i = 0; i < binstr.length; ++i) {
                let k = binstr.charCodeAt(i) & 0xff
                if (k == 37 || k > 0x7f) {
                    escaped += "%" + k.toString(16);
                } else {
                    escaped += binstr.charAt(i)
                }
            }

            // decodeURIComponent does the actual UTF8 decoding
            return decodeURIComponent(escaped)
        }

        export function toUTF8(str: string, cesu8?: boolean) {
            let res = "";
            if (!str) return res;
            for (let i = 0; i < str.length; ++i) {
                let code = str.charCodeAt(i);
                if (code <= 0x7f) res += str.charAt(i);
                else if (code <= 0x7ff) {
                    res += String.fromCharCode(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
                } else {
                    if (!cesu8 && 0xd800 <= code && code <= 0xdbff) {
                        let next = str.charCodeAt(++i);
                        if (!isNaN(next))
                            code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
                    }

                    if (code <= 0xffff)
                        res += String.fromCharCode(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                    else
                        res += String.fromCharCode(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                }

            }
            return res;
        }
    }

    export interface Map<T> {
        [index: string]: T;
    }

    export type LabelFn = (s: StackFrame) => StackFrame;
    export type ResumeFn = (v?: any) => void;

    export interface StackFrame {
        fn: LabelFn;
        pc: number;
        overwrittenPC?: boolean;
        depth: number;
        r0?: any;
        parent: StackFrame;
        retval?: any;
        lambdaArgs?: any[];
        caps?: any[];
        lastBrkId?: number;

        tryFrame?: TryFrame;
        thrownValue?: any;
        hasThrownValue?: boolean;
        // ... plus locals etc, added dynamically
    }

    export interface TryFrame {
        parent?: TryFrame;
        handlerPC: number;
        handlerFrame: StackFrame;
    }

    export class BreakLoopException { }

    export namespace pxtcore {
        export function beginTry(lbl: number) {
            runtime.currFrame.tryFrame = {
                parent: runtime.currTryFrame(),
                handlerPC: lbl,
                handlerFrame: runtime.currFrame
            }
        }

        export function endTry() {
            const s = runtime.currFrame
            s.tryFrame = s.tryFrame.parent
        }

        export function throwValue(v: any) {
            let tf = runtime.currTryFrame()
            if (!tf)
                U.userError("unhandled exception: " + v)
            const s = tf.handlerFrame
            runtime.currFrame = s
            s.pc = tf.handlerPC
            s.tryFrame = tf.parent
            s.thrownValue = v
            s.hasThrownValue = true
            throw new BreakLoopException()
        }

        export function getThrownValue() {
            const s = runtime.currFrame
            U.assert(s.hasThrownValue)
            s.hasThrownValue = false
            return s.thrownValue
        }

        export function endFinally() {
            const s = runtime.currFrame
            if (s.hasThrownValue) {
                s.hasThrownValue = false
                throwValue(s.thrownValue)
            }
        }
    }

    interface LR {
        retPC: number;
        currFn: LabelFn;
        baseSP: number;
        finalCallback?: ResumeFn;
    }

    interface SerialMessage {
        data: string;
        time: number;
    }

    export let runtime: Runtime;
    export function getResume() { return runtime.getResume() }

    export type MessageListener = (msg: SimulatorMessage) => void;

    const SERIAL_BUFFER_LENGTH = 16;
    export class BaseBoard {
        id: string;
        bus: pxsim.EventBus;
        runOptions: SimulatorRunMessage;
        messageListeners: MessageListener[] = [];

        constructor() {
            this.id = "b" + Math.round(Math.random() * 2147483647);
            this.bus = new pxsim.EventBus(runtime);
        }

        public updateView() { }
        public receiveMessage(msg: SimulatorMessage) {
            this.dispatchMessage(msg);
        }
        private dispatchMessage(msg: SimulatorMessage) {
            for (const listener of this.messageListeners)
                listener(msg)
        }
        public addMessageListener(listener: MessageListener) {
            this.messageListeners.push(listener);
        }

        get storedState(): Map<any> {
            if (!this.runOptions) return {}
            if (!this.runOptions.storedState)
                this.runOptions.storedState = {}
            return this.runOptions.storedState
        }
        public initAsync(msg: SimulatorRunMessage): Promise<void> {
            this.runOptions = msg;
            return Promise.resolve()
        }
        public setStoredState(k: string, value: any) {
            if (value == null)
                delete this.storedState[k]
            else
                this.storedState[k] = value
            Runtime.postMessage({
                type: "simulator",
                command: "setstate",
                stateKey: k,
                stateValue: value
            } as SimulatorCommandMessage)
        }
        public onDebuggerResume() { }
        public screenshotAsync(width?: number): Promise<ImageData> {
            return Promise.resolve(undefined);
        }
        public kill() { }

        protected serialOutBuffer: string = '';
        private messages: SerialMessage[] = [];
        private serialTimeout: number;
        private lastSerialTime = 0;

        public writeSerial(s: string) {
            this.serialOutBuffer += s;
            if (/\n/.test(this.serialOutBuffer) || this.serialOutBuffer.length > SERIAL_BUFFER_LENGTH) {
                this.messages.push({
                    time: Date.now(),
                    data: this.serialOutBuffer
                });
                this.debouncedPostAll();
                this.serialOutBuffer = '';
            }
        }

        private debouncedPostAll = () => {
            const nowtime = Date.now();
            if (nowtime - this.lastSerialTime > MIN_MESSAGE_WAIT_MS) {
                clearTimeout(this.serialTimeout);
                if (this.messages.length) {
                    Runtime.postMessage(<any>{
                        type: 'bulkserial',
                        data: this.messages,
                        id: runtime.id,
                        sim: true
                    })
                    this.messages = [];
                    this.lastSerialTime = nowtime;
                }
            }
            else {
                this.serialTimeout = setTimeout(this.debouncedPostAll, 50);
            }
        }
    }

    export class CoreBoard extends BaseBoard {
        // updates
        updateSubscribers: (() => void)[];

        // builtin
        builtinParts: Map<any>;
        builtinVisuals: Map<() => visuals.IBoardPart<any>>;
        builtinPartVisuals: Map<(xy: visuals.Coord) => visuals.SVGElAndSize>;

        constructor() {
            super()

            // updates
            this.updateSubscribers = []
            this.updateView = () => {
                this.updateSubscribers.forEach(sub => sub());
            }

            this.builtinParts = {};
            this.builtinVisuals = {};
            this.builtinPartVisuals = {};
        }

        kill() {
            super.kill();
            AudioContextManager.stopAll();
        }
    }

    class BareBoard extends BaseBoard {
    }

    export function initBareRuntime() {
        runtime.board = new BareBoard();
        let myRT = pxsim as any
        myRT.basic = {
            pause: thread.pause,
            showNumber: (n: number) => {
                let cb = getResume();
                console.log("SHOW NUMBER:", n)
                U.nextTick(cb)
            }
        }
        myRT.serial = {
            writeString: (s: string) => runtime.board.writeSerial(s),
        }
        myRT.pins = {
            createBuffer: BufferMethods.createBuffer,
        }
        myRT.control = {
            inBackground: thread.runInBackground
        }
    }

    export type EventValueToActionArgs = (value: EventIDType) => any[];

    enum LogType {
        UserSet, BackAdd, BackRemove
    }

    export type EventIDType = number | string;

    export class EventQueue {
        max: number = 5;
        events: EventIDType[] = [];
        private awaiters: ((v?: any) => void)[] = [];
        private lock: boolean;
        private _handlers: RefAction[] = [];
        private _addRemoveLog: { act: RefAction, log: LogType }[] = [];

        constructor(public runtime: Runtime, private valueToArgs?: EventValueToActionArgs) { }

        public push(e: EventIDType, notifyOne: boolean): Promise<void> {
            if (this.awaiters.length > 0) {
                if (notifyOne) {
                    const aw = this.awaiters.shift();
                    if (aw) aw();
                } else {
                    const aws = this.awaiters.slice();
                    this.awaiters = [];
                    aws.forEach(aw => aw());
                }
            }
            if (this.handlers.length == 0 || this.events.length > this.max)
                return Promise.resolve()

            this.events.push(e)

            // start processing, if not already processing
            if (!this.lock)
                return this.poke();
            else
                return Promise.resolve()
        }

        private poke(): Promise<void> {
            this.lock = true;
            let events = this.events;
            // all events will be processed by concurrent promisified code below, so start afresh
            this.events = []
            // in order semantics for events and handlers
            return Promise.each(events, (value) => {
                return Promise.each(this.handlers, (handler) => {
                    return this.runtime.runFiberAsync(handler, ...(this.valueToArgs ? this.valueToArgs(value) : [value]))
                })
            }).then(() => {
                // if some events arrived while processing above then keep processing
                if (this.events.length > 0) {
                    return this.poke()
                } else {
                    this.lock = false
                    // process the log (synchronous)
                    this._addRemoveLog.forEach(l => {
                        if (l.log === LogType.BackAdd) { this.addHandler(l.act) }
                        else if (l.log === LogType.BackRemove) { this.removeHandler(l.act) }
                        else this.setHandler(l.act)
                    });
                    this._addRemoveLog = [];
                    return Promise.resolve()
                }
            })
        }

        get handlers() {
            return this._handlers;
        }

        setHandler(a: RefAction) {
            if (!this.lock) {
                this._handlers = [a];
            } else {
                this._addRemoveLog.push({ act: a, log: LogType.UserSet });
            }
        }

        addHandler(a: RefAction) {
            if (!this.lock) {
                let index = this._handlers.indexOf(a)
                // only add if new, just like CODAL
                if (index == -1) {
                    this._handlers.push(a);
                }
            } else {
                this._addRemoveLog.push({ act: a, log: LogType.BackAdd });
            }
        }

        removeHandler(a: RefAction) {
            if (!this.lock) {
                let index = this._handlers.indexOf(a)
                if (index != -1) {
                    this._handlers.splice(index, 1)
                }
            } else {
                this._addRemoveLog.push({ act: a, log: LogType.BackRemove });
            }
        }

        addAwaiter(awaiter: (v?: any) => void) {
            this.awaiters.push(awaiter);
        }
    }

    // overriden at loadtime by specific implementation
    export let initCurrentRuntime: (msg: SimulatorRunMessage) => void = undefined;
    export let handleCustomMessage: (message: pxsim.SimulatorCustomMessage) => void = undefined;


    function _leave(s: StackFrame, v: any): StackFrame {
        s.parent.retval = v;
        return s.parent
    }

    // wraps simulator code as STS code - useful for default event handlers
    export function syntheticRefAction(f: (s: StackFrame) => any) {
        return pxtcore.mkAction(0, s => _leave(s, f(s)))
    }

    export class TimeoutScheduled {
        constructor(public id: number, public fn: Function, public totalRuntime: number, public timestampCall: number) { }
    }

    export class PausedTimeout {
        constructor(public fn: Function, public timeRemaining: number) { }
    }

    export function mkVTable(src: VTable): VTable {
        return {
            name: src.name,
            numFields: src.numFields,
            classNo: src.classNo,
            methods: src.methods,
            iface: src.iface,
            lastSubtypeNo: src.lastSubtypeNo,
            toStringMethod: src.toStringMethod
        };
    }

    let mapVTable: VTable = null
    export function mkMapVTable() {
        if (!mapVTable) mapVTable = mkVTable({ name: "_Map", numFields: 0, classNo: 0, lastSubtypeNo: 0, methods: null })
        return mapVTable
    }

    export class Runtime {
        public board: BaseBoard;
        numGlobals = 1000;
        errorHandler: (e: any) => void;
        postError: (e: any) => void;
        stateChanged: () => void;

        dead = false;
        running = false;
        idleTimer: number = undefined;
        recording = false;
        recordingTimer = 0;
        recordingLastImageData: ImageData = undefined;
        recordingWidth: number = undefined;
        startTime = 0;
        startTimeUs = 0;
        pausedTime = 0;
        lastPauseTimestamp = 0;
        id: string;
        globals: any = {};
        currFrame: StackFrame;
        entry: LabelFn;
        loopLock: Object = null;
        loopLockWaitList: (() => void)[] = [];

        timeoutsScheduled: TimeoutScheduled[] = []
        timeoutsPausedOnBreakpoint: PausedTimeout[] = [];
        pausedOnBreakpoint: boolean = false;

        perfCounters: PerfCounter[]
        perfOffset = 0
        perfElapsed = 0
        perfStack = 0

        public refCountingDebug = false;
        private refObjId = 1;

        overwriteResume: (retPC: number) => void;
        getResume: () => ResumeFn;
        run: (cb: ResumeFn) => void;
        setupTop: (cb: ResumeFn) => StackFrame;
        handleDebuggerMsg: (msg: DebuggerMessage) => void;

        registerLiveObject(object: RefObject) {
            const id = this.refObjId++;
            return id;
        }

        runningTime(): number {
            return U.now() - this.startTime - this.pausedTime;
        }

        runningTimeUs(): number {
            return 0xffffffff & ((U.perfNowUs() - this.startTimeUs) >> 0);
        }

        runFiberAsync(a: RefAction, arg0?: any, arg1?: any, arg2?: any) {
            return new Promise<any>((resolve, reject) =>
                U.nextTick(() => {
                    runtime = this;
                    this.setupTop(resolve)
                    pxtcore.runAction(a, [arg0, arg1, arg2])
                }))
        }

        currTryFrame() {
            for (let p = this.currFrame; p; p = p.parent)
                if (p.tryFrame)
                    return p.tryFrame
            return null
        }

        // communication
        static messagePosted: (data: SimulatorMessage) => void;
        static postMessage(data: SimulatorMessage) {
            if (!data) return;
            // TODO: origins
            if (typeof window !== 'undefined' && window.parent && window.parent.postMessage) {
                window.parent.postMessage(data, "*");
            }
            if (Runtime.messagePosted) Runtime.messagePosted(data);
        }

        static postScreenshotAsync(opts?: SimulatorScreenshotMessage): Promise<void> {
            const b = runtime && runtime.board;
            const p = b
                ? b.screenshotAsync().catch(e => {
                    console.debug(`screenshot failed`);
                    return undefined;
                })
                : Promise.resolve(undefined);
            return p.then(img => Runtime.postMessage({
                type: "screenshot",
                data: img,
                delay: opts && opts.delay
            } as SimulatorScreenshotMessage));
        }

        static requestToggleRecording() {
            const r = runtime;
            if (!r) return;

            Runtime.postMessage(<SimulatorRecorderMessage>{
                type: "recorder",
                action: r.recording ? "stop" : "start"
            })
        }

        restart() {
            this.kill();
            setTimeout(() =>
                pxsim.Runtime.postMessage(<pxsim.SimulatorCommandMessage>{
                    type: "simulator",
                    command: "restart"
                }), 500);

        }

        kill() {
            this.dead = true
            // TODO fix this
            this.stopRecording();
            this.stopIdle();
            this.setRunning(false);
        }

        updateDisplay() {
            this.board.updateView();
            this.postFrame();
        }

        startRecording(width?: number) {
            if (this.recording || !this.running) return;

            this.recording = true;
            this.recordingTimer = setInterval(() => this.postFrame(), 66);
            this.recordingLastImageData = undefined;
            this.recordingWidth = width;
        }

        stopRecording() {
            if (!this.recording) return;
            if (this.recordingTimer) clearInterval(this.recordingTimer);
            this.recording = false;
            this.recordingTimer = 0;
            this.recordingLastImageData = undefined;
            this.recordingWidth = undefined;
        }

        postFrame() {
            if (!this.recording || !this.running) return;
            let time = pxsim.U.now();
            this.board.screenshotAsync(this.recordingWidth)
                .then(imageData => {
                    // check for duplicate images
                    if (this.recordingLastImageData && imageData
                        && this.recordingLastImageData.data.byteLength == imageData.data.byteLength) {
                        const d0 = this.recordingLastImageData.data;
                        const d1 = imageData.data;
                        const n = d0.byteLength;
                        let i = 0;
                        for (i = 0; i < n; ++i)
                            if (d0[i] != d1[i])
                                break;
                        if (i == n) // same, don't send update
                            return;
                    }
                    this.recordingLastImageData = imageData;
                    Runtime.postMessage(<SimulatorScreenshotMessage>{
                        type: "screenshot",
                        data: imageData,
                        time
                    })
                });
        }

        private numDisplayUpdates = 0;
        queueDisplayUpdate() {
            this.numDisplayUpdates++
        }

        maybeUpdateDisplay() {
            if (this.numDisplayUpdates) {
                this.numDisplayUpdates = 0
                this.updateDisplay()
            }
        }

        setRunning(r: boolean) {
            if (this.running != r) {
                this.running = r;
                if (this.running) {
                    this.startTime = U.now();
                    this.startTimeUs = U.perfNowUs();
                    Runtime.postMessage(<SimulatorStateMessage>{
                        type: 'status',
                        frameid: Embed.frameid,
                        runtimeid: this.id,
                        state: 'running'
                    });
                } else {
                    this.stopRecording();
                    this.stopIdle();
                    Runtime.postMessage(<SimulatorStateMessage>{
                        type: 'status',
                        frameid: Embed.frameid,
                        runtimeid: this.id,
                        state: 'killed'
                    });
                }
                if (this.stateChanged) this.stateChanged();
            }
        }

        dumpLivePointers() {
            return
        }

        constructor(msg: SimulatorRunMessage) {
            U.assert(!!initCurrentRuntime);

            this.id = msg.id
            this.refCountingDebug = !!msg.refCountingDebug;

            let breakpoints: Uint8Array = null
            let currResume: ResumeFn;
            let dbgHeap: Map<any>;
            let dbgResume: ResumeFn;
            let breakFrame: StackFrame = null // for step-over
            let lastYield = Date.now()
            let userGlobals: string[];
            let __this = this // ex

            // this is passed to generated code
            const evalIface = {
                runtime: this, // __this
                oops,
                doNothing,
                pxsim,
                globals: this.globals,
                setupYield,
                maybeYield,
                setupDebugger,
                isBreakFrame,
                breakpoint,
                trace,
                checkStack,
                leave: _leave,
                checkResumeConsumed,
                setupResume,
                setupLambda,
                checkSubtype,
                failedCast,
                buildResume,
                mkVTable,
            }

            function oops(msg: string) {
                throw new Error("sim error: " + msg)
            }

            function doNothing(s: StackFrame) {
                s.pc = -1;
                return _leave(s, s.parent.retval)
            }

            function flushLoopLock() {
                while (__this.loopLockWaitList.length > 0 && !__this.loopLock) {
                    let f = __this.loopLockWaitList.shift()
                    f()
                }
            }

            // Date.now() - 100ns on Chrome mac, 60ns on Safari iPhone XS
            // yield-- - 7ns on Chrome

            let yieldReset = () => { }
            function setupYield(reset: () => void) {
                yieldReset = reset
            }

            function loopForSchedule(s: StackFrame) {
                const lock = new Object();
                const pc = s.pc;
                __this.loopLock = lock;
                return () => {
                    if (__this.dead) return;
                    U.assert(s.pc == pc);
                    U.assert(__this.loopLock === lock);
                    __this.loopLock = null;
                    loop(s)
                    flushLoopLock()
                }
            }

            function maybeYield(s: StackFrame, pc: number, r0: any): boolean {
                // If code is running on a breakpoint, it's because we are evaluating getters;
                // no need to yield in that case.
                if (__this.pausedOnBreakpoint) return false;

                __this.cleanScheduledExpired()
                yieldReset();
                let now = Date.now()
                if (now - lastYield >= 20) {
                    lastYield = now
                    s.pc = pc;
                    s.r0 = r0;
                    /* tslint:disable:no-string-based-set-timeout */
                    setTimeout(loopForSchedule(s), 5)
                    return true
                }
                return false
            }

            function setupDebugger(numBreakpoints: number, userCodeGlobals?: string[]) {
                breakpoints = new Uint8Array(numBreakpoints)
                // start running and let user put a breakpoint on start
                breakpoints[0] = msg.breakOnStart ? 1 : 0;
                userGlobals = userCodeGlobals;
                return breakpoints
            }

            function isBreakFrame(s: StackFrame) {
                if (!breakFrame) return true; // nothing specified
                for (let p = breakFrame; p; p = p.parent) {
                    if (p == s) return true
                }
                return false
            }

            function breakpoint(s: StackFrame, retPC: number, brkId: number, r0: any): StackFrame {
                let lock = {}
                __this.loopLock = lock;
                U.assert(!dbgResume)
                U.assert(!dbgHeap)

                s.pc = retPC;
                s.r0 = r0;

                const { msg, heap } = getBreakpointMsg(s, brkId, userGlobals);
                dbgHeap = heap;
                Runtime.postMessage(msg)
                breakpoints[0] = 0;
                breakFrame = null;
                __this.pauseScheduled();
                dbgResume = (m: DebuggerMessage) => {
                    dbgResume = null;
                    dbgHeap = null;
                    if (__this.dead) return null;
                    __this.resumeAllPausedScheduled();
                    __this.board.onDebuggerResume();
                    runtime = __this;
                    U.assert(s.pc == retPC);

                    breakpoints[0] = 0
                    breakFrame = null

                    switch (m.subtype) {
                        case "resume":
                            break;
                        case "stepover":
                            breakpoints[0] = 1;
                            breakFrame = s;
                            break;
                        case "stepinto":
                            breakpoints[0] = 1;
                            break;
                        case "stepout":
                            breakpoints[0] = 1;
                            breakFrame = s.parent || s;
                            break;
                    }
                    U.assert(__this.loopLock == lock)
                    __this.loopLock = null;
                    loop(s);
                    flushLoopLock();
                }

                return null;
            }

            function trace(brkId: number, s: StackFrame, retPc: number, info: any) {
                setupResume(s, retPc);
                if (info.functionName === "<main>" || info.fileName === "main.ts") {
                    Runtime.postMessage({
                        type: "debugger",
                        subtype: "trace",
                        breakpointId: brkId,
                    } as TraceMessage)
                    thread.pause(tracePauseMs || 1)
                }
                else {
                    thread.pause(0)
                }
                checkResumeConsumed();
            }

            function handleDebuggerMsg(msg: DebuggerMessage) {
                switch (msg.subtype) {
                    case "config":
                        let cfg = msg as DebuggerConfigMessage
                        if (cfg.setBreakpoints) {
                            breakpoints.fill(0)
                            for (let n of cfg.setBreakpoints)
                                breakpoints[n] = 1
                        }
                        break;
                    case "traceConfig":
                        let trc = msg as TraceConfigMessage;
                        tracePauseMs = trc.interval;
                        break;
                    case "pause":
                        breakpoints[0] = 1
                        breakFrame = null
                        break
                    case "resume":
                    case "stepover":
                    case "stepinto":
                    case "stepout":
                        if (dbgResume)
                            dbgResume(msg);
                        break;
                    case "variables":
                        const vmsg = msg as VariablesRequestMessage;
                        let vars: Variables = undefined;
                        if (dbgHeap) {
                            const v = dbgHeap[vmsg.variablesReference];
                            if (v !== undefined)
                                vars = dumpHeap(v, dbgHeap, vmsg.fields);
                        }
                        Runtime.postMessage(<pxsim.VariablesMessage>{
                            type: "debugger",
                            subtype: "variables",
                            req_seq: msg.seq,
                            variables: vars
                        })
                        break;
                }
            }

            function loop(p: StackFrame) {
                if (__this.dead) {
                    console.log("Runtime terminated")
                    return
                }
                U.assert(!__this.loopLock)
                __this.perfStartRuntime()
                try {
                    runtime = __this
                    while (!!p) {
                        __this.currFrame = p;
                        __this.currFrame.overwrittenPC = false;
                        p = p.fn(p)
                        //if (yieldSteps-- < 0 && maybeYield(p, p.pc, 0)) break;
                        __this.maybeUpdateDisplay()
                        if (__this.currFrame.overwrittenPC)
                            p = __this.currFrame
                    }
                    __this.perfStopRuntime()
                } catch (e) {
                    if (e instanceof BreakLoopException) {
                        U.nextTick(loopForSchedule(__this.currFrame))
                        return
                    }
                    __this.perfStopRuntime()
                    if (__this.errorHandler)
                        __this.errorHandler(e)
                    else {
                        console.error("Simulator crashed, no error handler", e.stack)
                        const { msg } = getBreakpointMsg(p, p.lastBrkId, userGlobals)
                        msg.exceptionMessage = e.message
                        msg.exceptionStack = e.stack
                        Runtime.postMessage(msg)
                        if (__this.postError)
                            __this.postError(e)
                    }
                }
            }

            function checkStack(d: number) {
                if (d > 100)
                    U.userError("Stack overflow")
            }

            function actionCall(s: StackFrame): StackFrame {
                s.depth = s.parent.depth + 1
                checkStack(s.depth)
                s.pc = 0;
                return s;
            }

            function setupTop(cb: ResumeFn) {
                let s = setupTopCore(cb)
                setupResume(s, 0)
                return s
            }

            function setupTopCore(cb: ResumeFn) {
                let frame: StackFrame = {
                    parent: null,
                    pc: 0,
                    depth: 0,
                    fn: () => {
                        if (cb) cb(frame.retval)
                        return null
                    }
                }
                return frame
            }

            function topCall(fn: LabelFn, cb: ResumeFn) {
                U.assert(!!__this.board)
                U.assert(!__this.running)
                __this.setRunning(true);
                let topFrame = setupTopCore(cb)
                let frame: StackFrame = {
                    parent: topFrame,
                    fn: fn,
                    depth: 0,
                    pc: 0
                }
                loop(actionCall(frame))
            }

            function checkResumeConsumed() {
                if (currResume) oops("getResume() not called")
            }

            function setupResume(s: StackFrame, retPC: number) {
                currResume = buildResume(s, retPC)
            }

            function setupLambda(s: StackFrame, a: RefAction | LabelFn) {
                if (a instanceof RefAction) {
                    s.fn = a.func
                    s.caps = a.fields
                } else {
                    s.fn = a
                }
            }

            function checkSubtype(v: RefRecord, vt: VTable) {
                if (!v)
                    return false
                const vt2 = v.vtable
                if (vt === vt2)
                    return true
                return vt2 && vt.classNo <= vt2.classNo && vt2.classNo <= vt.lastSubtypeNo;
            }

            function failedCast(v: any) {
                // TODO generate the right panic codes
                if ((pxsim as any).control && (pxsim as any).control.dmesgValue)
                    (pxsim as any).control.dmesgValue(v)
                oops("failed cast on " + v)
            }

            function buildResume(s: StackFrame, retPC: number) {
                if (currResume) oops("already has resume")
                s.pc = retPC;
                let start = Date.now()
                let fn = (v: any) => {
                    if (__this.dead) return;
                    if (__this.loopLock) {
                        __this.loopLockWaitList.push(() => fn(v))
                        return;
                    }
                    runtime = __this;
                    let now = Date.now()
                    if (now - start > 3)
                        lastYield = now
                    U.assert(s.pc == retPC);
                    if (v instanceof FnWrapper) {
                        let w = <FnWrapper>v
                        let frame: StackFrame = {
                            parent: s,
                            fn: w.func,
                            lambdaArgs: w.args,
                            pc: 0,
                            caps: w.caps,
                            depth: s.depth + 1,
                        }
                        // If the function we call never pauses, this would cause the stack
                        // to grow unbounded.
                        let lock = {}
                        __this.loopLock = lock
                        return U.nextTick(() => {
                            U.assert(__this.loopLock === lock)
                            __this.loopLock = null
                            loop(actionCall(frame))
                            flushLoopLock()
                        })
                    }
                    s.retval = v;
                    return loop(s)
                }
                return fn
            }

            // tslint:disable-next-line
            const entryPoint = eval(msg.code)(evalIface);

            this.run = (cb) => topCall(entryPoint, cb)
            this.getResume = () => {
                if (!currResume) oops("noresume")
                let r = currResume
                currResume = null
                return r
            }
            this.setupTop = setupTop
            this.handleDebuggerMsg = handleDebuggerMsg
            this.entry = entryPoint
            this.overwriteResume = (retPC: number) => {
                currResume = null;
                if (retPC >= 0)
                    this.currFrame.pc = retPC;
                this.currFrame.overwrittenPC = true;
            }
            runtime = this;

            initCurrentRuntime(msg);
        }

        public setupPerfCounters(names: string[]) {
            if (!names || !names.length)
                return
            this.perfCounters = names.map(s => new PerfCounter(s))
        }

        private perfStartRuntime() {
            if (this.perfOffset !== 0) {
                this.perfStack++
            } else {
                this.perfOffset = U.perfNowUs() - this.perfElapsed
            }
        }

        private perfStopRuntime() {
            if (this.perfStack) {
                this.perfStack--
            } else {
                this.perfElapsed = this.perfNow()
                this.perfOffset = 0
            }
        }

        public perfNow() {
            if (this.perfOffset === 0)
                U.userError("bad time now")
            return (U.perfNowUs() - this.perfOffset) | 0
        }

        public startPerfCounter(n: number) {
            if (!this.perfCounters)
                return
            const c = this.perfCounters[n]
            if (c.start) U.userError("startPerf")
            c.start = this.perfNow()
        }

        public stopPerfCounter(n: number) {
            if (!this.perfCounters)
                return
            const c = this.perfCounters[n]
            if (!c.start) U.userError("stopPerf")
            const curr = this.perfNow() - c.start;
            c.start = 0;
            // skip outliers
            // if (c.numstops > 30 && curr > 1.2 * c.value / c.numstops)
            //    return
            c.value += curr;
            c.numstops++;

            let p = c.lastFewPtr++
            if (p >= c.lastFew.length) {
                p = 0
                c.lastFewPtr = 1
            }
            c.lastFew[p] = curr
        }

        startIdle() {
            // schedules handlers to run every 20ms
            if (this.idleTimer === undefined) {
                this.idleTimer = setInterval(() => {
                    if (!this.running || this.pausedOnBreakpoint) return;
                    const bus = this.board.bus;
                    if (bus)
                        bus.queueIdle();
                }, 20);
            }
        }

        stopIdle() {
            if (this.idleTimer !== undefined) {
                clearInterval(this.idleTimer);
                this.idleTimer = undefined;
            }
        }

        // Wrapper for the setTimeout
        schedule(fn: Function, timeout: number): number {
            if (timeout <= 0) timeout = 0;
            if (this.pausedOnBreakpoint) {
                this.timeoutsPausedOnBreakpoint.push(new PausedTimeout(fn, timeout));
                return -1;
            }
            const timestamp = U.now();
            const to = new TimeoutScheduled(-1, fn, timeout, timestamp)
            // We call the timeout function and add its id to the timeouts scheduled.
            const removeAndExecute = () => {
                const idx = this.timeoutsScheduled.indexOf(to)
                if (idx >= 0)
                    this.timeoutsScheduled.splice(idx, 1)
                fn();
            }
            to.id = setTimeout(removeAndExecute, timeout);
            this.timeoutsScheduled.push(to);
            return to.id;
        }

        // On breakpoint, pause all timeouts
        pauseScheduled() {
            this.pausedOnBreakpoint = true;
            this.timeoutsScheduled.forEach(ts => {
                clearTimeout(ts.id);
                let elapsed = U.now() - ts.timestampCall;
                let timeRemaining = ts.totalRuntime - elapsed;

                // Time reamining needs to be at least 1. Setting to 0 causes fibers
                // to never resume after breaking
                if (timeRemaining <= 0) timeRemaining = 1;
                this.timeoutsPausedOnBreakpoint.push(new PausedTimeout(ts.fn, timeRemaining))
            });
            this.lastPauseTimestamp = U.now();
            this.timeoutsScheduled = [];
        }

        // When resuming after a breakpoint, restart all paused timeouts with their remaining time.
        resumeAllPausedScheduled() {
            // Takes the list of all fibers paused on a breakpoint and resumes them.
            this.pausedOnBreakpoint = false;
            this.timeoutsPausedOnBreakpoint.forEach(pt => {
                this.schedule(pt.fn, pt.timeRemaining);
            });
            if (this.lastPauseTimestamp) {
                this.pausedTime += U.now() - this.lastPauseTimestamp;
                this.lastPauseTimestamp = 0;
            }
            this.timeoutsPausedOnBreakpoint = [];
        }

        // Removes from the timeouts scheduled list all the ones that had been fulfilled.
        cleanScheduledExpired() {
            let now = U.now();
            this.timeoutsScheduled = this.timeoutsScheduled.filter(ts => {
                let elapsed = now - ts.timestampCall;
                return ts.totalRuntime > elapsed;
            })
        }
    }


    export class PerfCounter {
        start = 0;
        numstops = 0;
        value = 0;
        lastFew = new Uint32Array(32);
        lastFewPtr = 0;
        constructor(public name: string) { }
    }

}
