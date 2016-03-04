/// <reference path="../typings/bluebird/bluebird.d.ts"/>

namespace yelm.rt {
    export module U {
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

    export interface Target {
        name: string;
        initCurrentRuntime: () => void;
    }

    export function getTargets(): Target[] {
        return [micro_bit.target, minecraft.target]
    }

    export interface StackFrame {
        fn: LabelFn;
        pc: number;
        parent: StackFrame;
        retval?: any;
        lambdaArgs?: any[];
        caps?: any[];
        finalCallback?: ResumeFn;
        // ... plus locals etc, added dynamically
    }

    interface LR {
        caller: LR;
        retPC: number;
        currFn: LabelFn;
        baseSP: number;
        finalCallback?: ResumeFn;
    }

    export var runtime: Runtime;
    export function getResume() { return runtime.getResume() }

    export class BaseBoard {
        public updateView() { }
        public receiveMessage(msg: SimulatorMessage) { }
    }

    export class EventQueue<T> {
        max: number = 5;
        events: T[] = [];
        handler: RefAction;

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
    }

    export class Runtime {
        public board: BaseBoard;
        numGlobals = 1000;
        errorHandler: (e: any) => void;
        stateChanged: () => void;
        dead = false;
        running = false;
        startTime = 0;
        target: Target;
        enums: Map<number>;
        id: string;
        globals:any[] = [];

        getResume: () => ResumeFn;
        run: (cb: ResumeFn) => void;
        setupTop: (cb: ResumeFn) => StackFrame;

        runningTime(): number {
            return U.now() - this.startTime;
        }

        runFiberAsync(a: RefAction, arg0?: any, arg1?: any) {
            incr(a)
            return new Promise<any>((resolve, reject) =>
                U.nextTick(() => {
                    runtime = this;
                    this.setupTop(resolve)
                    action.run2(a, arg0, arg1)
                    decr(a) // if it's still running, action.run() has taken care of incrementing the counter
                }))
        }

        // communication
        static messagePosted: (data: SimulatorMessage) => void;
        static postMessage(data: SimulatorMessage) {
            // TODO: origins
            if (typeof window !== 'undefined' && window.parent) {
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
                    Runtime.postMessage(<SimulatorStateMessage>{ type: 'status', state: 'running' });
                } else {
                    Runtime.postMessage(<SimulatorStateMessage>{ type: 'status', state: 'killed' });
                }
                if (this.stateChanged) this.stateChanged();
            }
        }

        constructor(code: string, targetName: string, enums: Map<number>) {
            this.enums = enums;
            // These variables are used by the generated code as well
            // ---
            var entryPoint: LabelFn;
            var bitvm = rt.bitvm
            // ---

            var currResume: ResumeFn;
            var _this = this

            function oops(msg: string) {
                throw new Error("sim error: " + msg)
            }

            function loop(p: StackFrame) {
                if (_this.dead) {
                    console.log("Runtime terminated")
                    return
                }
                try {
                    runtime = _this
                    while (!!p) {
                        p = p.fn(p)
                        _this.maybeUpdateDisplay()
                    }
                } catch (e) {
                    if (_this.errorHandler)
                        _this.errorHandler(e)
                    else
                        console.error("Simulator crashed, no error handler", e.stack)
                }
            }

            function actionCall(s: StackFrame, cb?: ResumeFn): StackFrame {
                if (cb)
                    s.finalCallback = cb;
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
                    fn: () => {
                        if (cb) cb(frame.retval)
                        return null
                    }
                }
                return frame
            }

            function topCall(fn: LabelFn, cb: ResumeFn) {
                U.assert(!!_this.board)
                U.assert(!!_this.enums)
                U.assert(!_this.running)
                _this.setRunning(true);
                let topFrame = setupTopCore(cb)
                let frame: StackFrame = {
                    parent: topFrame,
                    fn: fn,
                    pc: 0
                }
                loop(actionCall(frame))
            }
            
            function checkResumeConsumed() {
                if (currResume) oops("getResume() not called")                
            }

            function setupResume(s: StackFrame, retPC: number) {
                if (currResume) oops("already has resume")
                s.pc = retPC;
                currResume = (v) => {
                    if (_this.dead) return;
                    runtime = _this;
                    U.assert(s.pc == retPC);
                    if (v instanceof FnWrapper) {
                        let w = <FnWrapper>v
                        let frame: StackFrame = {
                            parent: s,
                            fn: w.func,
                            lambdaArgs: [w.a0, w.a1],
                            pc: 0,
                            caps: w.caps,
                            finalCallback: w.cb,
                        }
                        return loop(actionCall(frame))
                    }
                    s.retval = v;
                    return loop(s)
                }
            }

            eval(code)

            this.run = (cb) => topCall(entryPoint, cb)
            this.getResume = () => {
                if (!currResume) oops("noresume")
                let r = currResume
                currResume = null
                return r
            }
            this.setupTop = setupTop

            runtime = this;

            let trg = yelm.rt.getTargets().filter(t => t.name == targetName)[0]
            if (!trg) {
                U.userError("target " + targetName + " not supported")
            }

            this.target = trg;
            trg.initCurrentRuntime();
        }
    }
}
