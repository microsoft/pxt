namespace yelm.rt {
    export type LabelFn = (n: number) => CodePtr;
    export type ResumeFn = (v?: any) => void;
    
    export interface Target {
        name: string;
        initCurrentRuntime: () => void;
    }
    
    export function getTargets():Target[] {
        return [micro_bit.target]
    } 

    export interface CodePtr {
        fn: LabelFn;
        pc: number;
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
    }

    export class Runtime {
        private baseStack = 1000000;
        private freeStacks: number[] = [];
        public board: BaseBoard;
        numGlobals = 1000;
        mem: any;
        errorHandler: (e: any) => void;
        dead = false;

        getResume: () => ResumeFn;
        run: (cb: ResumeFn) => void;
        setupTop: (cb: ResumeFn) => void;

        runFiberAsync(a: RefAction) {
            incr(a)
            return new Promise<any>((resolve, reject) =>
                U.nextTick(() => {
                    this.setupTop(resolve)
                    action.run(a)
                    decr(a) // if it's still running, action.run() has taken care of incrementing the counter
                }))
        }

        // 2k block
        malloc() {
            if (this.freeStacks.length > 0)
                return this.freeStacks.pop();
            this.baseStack += 2000;
            return this.baseStack;
        }

        free(p: number) {
            this.freeStacks.push(p)
        }

        kill() {
            this.dead = true
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

        constructor(code: string) {
            // These variables are used by the generated code as well
            // ---
            var sp: number, lr: LR;
            var rr0: any, rr1: any, rr2: any, rr3: any;
            var r4: any, r5: any, r6: any, r7: any;
            var mem: any = {}
            var entryPoint: LabelFn;
            // ---

            var currResume: ResumeFn;
            this.mem = mem
            var _this = this

            function oops(msg: string) {
                throw new Error("sim error: " + msg)
            }

            function push(v: any) {
                sp -= 4;
                if (sp % 1000 == 0)
                    oops("stack overflow")
                mem[sp] = v;
                //console.log(`PUSH ${sp} ${v}`)
            }

            function pop() {
                //console.log(`POP ${sp} ${mem[sp]}`)
                sp += 4;
                return mem[sp - 4]
            }

            function loop(p: CodePtr) {
                if (_this.dead) {
                    console.log("Runtime terminated")
                    return
                }
                try {
                    runtime = _this
                    while (!!p) {
                        p = p.fn(p.pc)
                        _this.maybeUpdateDisplay()
                    }
                } catch (e) {
                    if (_this.errorHandler)
                        _this.errorHandler(e)
                    else
                        console.error("Simulator crashed, no error handler", e.stack)
                }
            }

            function actionCall(fn: LabelFn, retPC: number, cb?: ResumeFn): CodePtr {
                lr = {
                    caller: lr,
                    retPC: retPC,
                    currFn: fn,
                    baseSP: sp,
                    finalCallback: cb
                }
                return { fn, pc: 0 }
            }

            function leave(v: any): CodePtr {
                let topLr = lr
                lr = lr.caller
                let popped = pop()
                if (popped != topLr) oops("lrpop")
                rr0 = v;
                if (topLr.finalCallback)
                    topLr.finalCallback(v);
                return { fn: lr.currFn, pc: topLr.retPC }
            }

            function setupTop(cb: ResumeFn) {
                setupTopCore(cb)
                setupResume(0)
            }

            function setupTopCore(cb: ResumeFn) {
                let stackTop = _this.malloc();
                sp = stackTop;
                lr = {
                    caller: null,
                    retPC: 0,
                    baseSP: sp,
                    currFn: () => {
                        _this.free(stackTop)
                        if (cb)
                            cb(rr0)
                        return null
                    }
                }
            }

            function topCall(fn: LabelFn, cb: ResumeFn) {
                U.assert(!!_this.board)
                setupTopCore(cb)
                loop(actionCall(fn, 0))
            }

            function storeRegs() {
                let _lr = lr
                let _sp = sp
                let _r4 = r4
                let _r5 = r5
                let _r6 = r6
                let _r7 = r7
                return () => {
                    lr = _lr
                    sp = _sp
                    r4 = _r4
                    r5 = _r5
                    r6 = _r6
                    r7 = _r7
                }
            }

            function setupResume(retPC: number) {
                if (currResume) oops("already has resume")
                let restore = storeRegs()
                currResume = (v) => {
                    restore();
                    if (v instanceof FnWrapper) {
                        let w = <FnWrapper>v
                        rr0 = w.a0
                        rr1 = w.a1
                        rr2 = w.a2
                        rr3 = w.a3
                        return loop(actionCall(w.func, retPC, w.cb))
                    }
                    rr0 = v;
                    return loop({ fn: lr.currFn, pc: retPC })
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
        }
    }
}
