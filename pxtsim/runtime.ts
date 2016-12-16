/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../built/pxtparts.d.ts"/>

namespace pxsim {
    export namespace U {
        export function addClass(el: HTMLElement, cls: string) {
            if (el.classList) el.classList.add(cls);
            else if (!el.className.indexOf(cls)) el.className += ' ' + cls;
        }

        export function removeClass(el: HTMLElement, cls: string) {
            if (el.classList) el.classList.remove(cls);
            else el.className = el.className.replace(cls, '').replace(/\s{2,}/, ' ');
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

        export function nextTick(f: () => void) {
            (<any>Promise)._async._schedule(f)
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
        depth: number;
        r0?: any;
        parent: StackFrame;
        retval?: any;
        lambdaArgs?: any[];
        caps?: any[];
        finalCallback?: ResumeFn;
        lastBrkId?: number;
        // ... plus locals etc, added dynamically
    }

    interface LR {
        caller: LR;
        retPC: number;
        currFn: LabelFn;
        baseSP: number;
        finalCallback?: ResumeFn;
    }

    export let runtime: Runtime;
    export function getResume() { return runtime.getResume() }

    export class BaseBoard {
        public runOptions: SimulatorRunMessage;

        public updateView() { }
        public receiveMessage(msg: SimulatorMessage) { }
        public initAsync(msg: SimulatorRunMessage): Promise<void> {
            this.runOptions = msg;
            return Promise.resolve()
        }
        public kill() { }

        protected serialOutBuffer: string = '';
        public writeSerial(s: string) {
            if (!s) return

            for (let i = 0; i < s.length; ++i) {
                let c = s[i];
                switch (c) {
                    case '\n':
                        Runtime.postMessage(<SimulatorSerialMessage>{
                            type: 'serial',
                            data: this.serialOutBuffer + '\n',
                            id: runtime.id,
                            sim: true
                        })
                        this.serialOutBuffer = ''
                        break;
                    case '\r': continue;
                    default: this.serialOutBuffer += c;
                }
            }
        }
    }

    export class CoreBoard extends BaseBoard {
        id: string;

        // the bus
        bus: pxsim.EventBus;

        // updates
        updateSubscribers: (() => void)[];

        // builtin
        builtinParts: Map<any>;
        builtinVisuals: Map<() => visuals.IBoardPart<any>>;
        builtinPartVisuals: Map<(xy: visuals.Coord) => visuals.SVGElAndSize>;

        constructor() {
            super()
            this.id = "b" + Math_.random(2147483647);
            this.bus = new pxsim.EventBus(runtime);

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
            AudioContextManager.stop();
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

    export class EventQueue<T> {
        max: number = 5;
        events: T[] = [];
        private mHandler: RefAction;

        constructor(public runtime: Runtime) { }

        public push(e: T) {
            if (!this.handler || this.events.length > this.max) return;

            this.events.push(e)

            // if this is the first event pushed - start processing
            if (this.events.length == 1)
                this.poke();
        }

        private poke() {
            let top = this.events.shift()
            this.runtime.runFiberAsync(this.handler, top)
                .done(() => {
                    // we're done processing the current event, if there is still something left to do, do it
                    if (this.events.length > 0)
                        this.poke();
                })
        }

        get handler() {
            return this.mHandler;
        }

        set handler(a: RefAction) {
            if (this.mHandler) {
                pxtcore.decr(this.mHandler);
            }

            this.mHandler = a;

            if (this.mHandler) {
                pxtcore.incr(this.mHandler);
            }
        }
    }

    // overriden at loadtime by specific implementation
    export let initCurrentRuntime: () => void = undefined;

    export class Runtime {
        public board: BaseBoard;
        numGlobals = 1000;
        errorHandler: (e: any) => void;
        postError: (e: any) => void;
        stateChanged: () => void;
        dead = false;
        running = false;
        startTime = 0;
        id: string;
        globals: any = {};
        currFrame: StackFrame;

        getResume: () => ResumeFn;
        run: (cb: ResumeFn) => void;
        setupTop: (cb: ResumeFn) => StackFrame;
        handleDebuggerMsg: (msg: DebuggerMessage) => void;

        runningTime(): number {
            return U.now() - this.startTime;
        }

        runFiberAsync(a: RefAction, arg0?: any, arg1?: any, arg2?: any) {
            incr(a)
            return new Promise<any>((resolve, reject) =>
                U.nextTick(() => {
                    runtime = this;
                    this.setupTop(resolve)
                    pxtcore.runAction3(a, arg0, arg1, arg2)
                    decr(a) // if it's still running, action.run() has taken care of incrementing the counter
                }))
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

        kill() {
            this.dead = true
            // TODO fix this
            this.setRunning(false);
        }

        updateDisplay() {
            this.board.updateView()
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
                    Runtime.postMessage(<SimulatorStateMessage>{ type: 'status', runtimeid: this.id, state: 'running' });
                } else {
                    Runtime.postMessage(<SimulatorStateMessage>{ type: 'status', runtimeid: this.id, state: 'killed' });
                }
                if (this.stateChanged) this.stateChanged();
            }
        }

        constructor(code: string) {
            U.assert(!!initCurrentRuntime);

            let yieldMaxSteps = 100

            // These variables are used by the generated code as well
            // ---
            let entryPoint: LabelFn;
            let pxtrt = pxsim.pxtrt
            let breakpoints: Uint8Array = null
            let breakAlways = false
            let globals = this.globals
            let yieldSteps = yieldMaxSteps
            // ---

            let currResume: ResumeFn;
            let dbgResume: ResumeFn;
            let breakFrame: StackFrame = null // for step-over
            let lastYield = Date.now()
            let _this = this

            function oops(msg: string) {
                throw new Error("sim error: " + msg)
            }

            // referenced from eval()ed code
            function doNothing(s: StackFrame) {
                s.pc = -1;
                return leave(s, s.parent.retval)
            }

            function maybeYield(s: StackFrame, pc: number, r0: any): boolean {
                yieldSteps = yieldMaxSteps;
                let now = Date.now()
                if (now - lastYield >= 20) {
                    lastYield = now
                    s.pc = pc;
                    s.r0 = r0;
                    let cont = () => {
                        if (_this.dead) return;
                        U.assert(s.pc == pc);
                        return loop(s)
                    }
                    //U.nextTick(cont)
                    setTimeout(cont, 5)
                    return true
                }
                return false
            }

            function setupDebugger(numBreakpoints: number) {
                breakpoints = new Uint8Array(numBreakpoints)
                breakAlways = true
            }

            function isBreakFrame(s: StackFrame) {
                if (!breakFrame) return true; // nothing specified
                for (let p = breakFrame; p; p = p.parent) {
                    if (p == s) return true
                }
                return false
            }

            function breakpoint(s: StackFrame, retPC: number, brkId: number, r0: any): StackFrame {
                U.assert(!dbgResume)

                s.pc = retPC;
                s.r0 = r0;

                Runtime.postMessage(getBreakpointMsg(s, brkId))
                dbgResume = (m: DebuggerMessage) => {
                    dbgResume = null;
                    if (_this.dead) return;
                    runtime = _this;
                    U.assert(s.pc == retPC);

                    breakAlways = false
                    breakFrame = null

                    switch (m.subtype) {
                        case "resume":
                            break
                        case "stepover":
                            breakAlways = true
                            breakFrame = s
                            break
                        case "stepinto":
                            breakAlways = true
                            break
                        case "stepout":
                            breakAlways = true;
                            breakFrame = s.parent || s;
                            break;
                    }

                    return loop(s)
                }

                return null;
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
                    case "pause":
                        breakAlways = true
                        breakFrame = null
                        break
                    case "resume":
                    case "stepover":
                    case "stepinto":
                    case "stepout":
                        if (dbgResume)
                            dbgResume(msg);
                        break;
                }
            }

            function loop(p: StackFrame) {
                if (_this.dead) {
                    console.log("Runtime terminated")
                    return
                }
                try {
                    runtime = _this
                    while (!!p) {
                        _this.currFrame = p;
                        p = p.fn(p)
                        _this.maybeUpdateDisplay()
                    }
                } catch (e) {
                    if (_this.errorHandler)
                        _this.errorHandler(e)
                    else {
                        console.error("Simulator crashed, no error handler", e.stack)
                        let msg = getBreakpointMsg(p, p.lastBrkId)
                        msg.exceptionMessage = e.message
                        msg.exceptionStack = e.stack
                        Runtime.postMessage(msg)
                        if (_this.postError)
                            _this.postError(e)
                    }
                }
            }

            function actionCall(s: StackFrame, cb?: ResumeFn): StackFrame {
                if (cb)
                    s.finalCallback = cb;
                s.depth = s.parent.depth + 1
                if (s.depth > 1000) {
                    U.userError("Stack overflow")
                }
                s.pc = 0
                return s;
            }

            function leave(s: StackFrame, v: any): StackFrame {
                s.parent.retval = v;
                if (s.finalCallback)
                    s.finalCallback(v);
                return s.parent
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
                U.assert(!!_this.board)
                U.assert(!_this.running)
                _this.setRunning(true);
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

            function buildResume(s: StackFrame, retPC: number) {
                if (currResume) oops("already has resume")
                s.pc = retPC;
                return (v: any) => {
                    if (_this.dead) return;
                    runtime = _this;
                    U.assert(s.pc == retPC);
                    // TODO should loop() be called here using U.nextTick?
                    // This matters if the simulator function calls cb()
                    // synchronously.
                    if (v instanceof FnWrapper) {
                        let w = <FnWrapper>v
                        let frame: StackFrame = {
                            parent: s,
                            fn: w.func,
                            lambdaArgs: [w.a0, w.a1, w.a2],
                            pc: 0,
                            caps: w.caps,
                            depth: s.depth + 1,
                            finalCallback: w.cb,
                        }
                        return loop(actionCall(frame))
                    }
                    s.retval = v;
                    return loop(s)
                }
            }

            // tslint:disable-next-line
            eval(code)

            this.run = (cb) => topCall(entryPoint, cb)
            this.getResume = () => {
                if (!currResume) oops("noresume")
                let r = currResume
                currResume = null
                return r
            }
            this.setupTop = setupTop
            this.handleDebuggerMsg = handleDebuggerMsg

            runtime = this;

            initCurrentRuntime();
        }
    }
}
