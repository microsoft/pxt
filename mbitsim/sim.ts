/// <reference path="../typings/node/node.d.ts"/>

"use strict";

let fs = require("fs");

namespace rt {
    let quiet = true;

    function check(cond: boolean) {
        if (!cond)
            throw new Error("mbit sim: check failed")
    }

    export namespace micro_bit {
        export function panic(code: number) {
            console.log("PANIC:", code)
            throw new Error("PANIC " + code)
        }

        export function pause(ms: number) {
            let cb = getResume();
            setTimeout(() => { cb() }, ms)
        }

        export function runInBackground(a: RefAction) {
            incr(a)
            setTimeout(() => {
                currRuntime.setupTop(() => { })
                action.run(a)
                decr(a) // if it's still running, action.run() has taken care of incrementing the counter
            }, 1)
        }

        export function serialSendString(s: string) {
            if (s.trim() && !quiet)
                console.log("SERIAL:", s)
        }

        export function showDigit(v: number) {
            if (!quiet)
                console.log("DIGIT:", v)
        }
    }

    var refObjId = 1;
    var liveRefObjs: any = {};

    class RefObject {
        id: number = refObjId++;
        refcnt: number = 1;

        constructor() {
            liveRefObjs[this.id + ""] = this
        }

        destroy() { }

        print() {
            console.log(`RefObject id:${this.id} refs:${this.refcnt}`)
        }
    }

    export class FnWrapper {
        constructor(public func: LabelFn, public a0: any, public a1: any, public a2: any, public a3: any, public cb: ResumeFn = null) { }
    }

    class RefRecord extends RefObject {
        len: number;
        reflen: number;
        fields: any[] = [];

        destroy() {
            for (let i = 0; i < this.reflen; ++i)
                decr(this.fields[i])
            this.fields = null
        }

        print() {
            console.log(`RefRecord id:${this.id} refs:${this.refcnt} len:${this.len}`)
        }
    }

    class RefAction extends RefRecord {
        func: LabelFn;

        ldclo(n: number) {
            n >>= 2;
            check(0 <= n && n < this.len)
            return this.fields[n]
        }

        destroy() {
            super.destroy();
            this.func = null
        }

        print() {
            console.log(`RefAction id:${this.id} refs:${this.refcnt} len:${this.len}`)
        }
    }

    export namespace action {
        export function mk(reflen: number, len: number, fn: LabelFn) {
            let r = new RefAction();
            r.len = len
            r.reflen = reflen
            r.func = fn
            return r
        }

        export function run2(a: RefAction, a0: any, a1: any) {
            let cb = getResume();

            if (a instanceof RefAction) {
                bitvm.incr(a)
                cb(new FnWrapper(a.func, a, a, a0, a1, () => {
                    bitvm.decr(a)
                }))
            } else {
                // no-closure case
                cb(new FnWrapper(<any>a, null, null, a0, a1))
            }
        }

        export function run1(a: RefAction, v: any) {
            run2(a, v, null)
        }

        export function run(a: RefAction) {
            run2(a, null, null)
        }
    }

    class RefLocal extends RefObject {
        v = 0;

        print() {
            console.log(`RefLocal id:${this.id} refs:${this.refcnt} v:${this.v}`)
        }
    }

    class RefRefLocal extends RefObject {
        v: any = null;

        destroy() {
            decr(this.v)
        }

        print() {
            console.log(`RefRefLocal id:${this.id} refs:${this.refcnt} v:${this.v}`)
        }
    }

    function num(v: any) {
        if (v === undefined) return 0;
        return v;
    }

    function ref(v: any) {
        if (v === undefined) return null;
        return v;
    }

    export function decr(v: any): void {
        if (v instanceof RefObject) {
            let o = <RefObject>v
            check(o.refcnt > 0)
            if (--o.refcnt == 0) {
                delete liveRefObjs[o.id + ""]
                o.destroy()
            }
        }
    }

    export function incr(v: any) {
        if (v instanceof RefObject) {
            let o = <RefObject>v
            check(o.refcnt > 0)
            o.refcnt++
        }
        return v;
    }

    export function dumpLivePointers() {
        Object.keys(liveRefObjs).forEach(k => {
            (<RefObject>liveRefObjs[k]).print()
        })
    }

    export namespace bitvm {
        export var incr = rt.incr;
        export var decr = rt.decr;

        export function ldfld(r: RefRecord, idx: number) {
            check(r.reflen <= idx && idx < r.len)
            let v = num(r.fields[idx])
            decr(r)
            return v;
        }

        export function stfld(r: RefRecord, idx: number, v: any) {
            check(r.reflen <= idx && idx < r.len)
            r.fields[idx] = v;
            decr(r)
        }

        export function ldfldRef(r: RefRecord, idx: number) {
            check(0 <= idx && idx < r.reflen)
            let v = incr(ref(r.fields[idx]))
            decr(r)
            return v
        }

        export function stfldRef(r: RefRecord, idx: number, v: any) {
            check(0 <= idx && idx < r.reflen)
            decr(r.fields[idx])
            r.fields[idx] = v
            decr(r)
        }

        var globalBase = 9000000;

        export function ldglb(idx: number) {
            check(0 <= idx && idx < currRuntime.numGlobals);
            return num(currRuntime.mem[globalBase + idx])
        }

        export function ldglbRef(idx: number) {
            check(0 <= idx && idx < currRuntime.numGlobals);
            return incr(ref(currRuntime.mem[globalBase + idx]))
        }

        // note the idx comes last - it's more convenient that way in the emitter
        export function stglb(v: any, idx: number) {
            check(0 <= idx && idx < currRuntime.numGlobals);
            currRuntime.mem[globalBase + idx] = v;
        }

        export function stglbRef(v: any, idx: number) {
            check(0 <= idx && idx < currRuntime.numGlobals);
            decr(currRuntime.mem[globalBase + idx])
            currRuntime.mem[globalBase + idx] = v;
        }

        export function ldloc(r: RefLocal) {
            return r.v
        }

        export function ldlocRef(r: RefLocal) {
            return incr(r.v)
        }

        export function stloc(r: RefLocal, v: any) {
            r.v = v;
        }

        export function stlocRef(r: RefRefLocal, v: any) {
            decr(r.v)
            r.v = v;
        }

        export function mkloc() {
            return new RefLocal();
        }

        export function mklocRef() {
            return new RefRefLocal();
        }

        // Store a captured local in a closure. It returns the action, so it can be chained.
        export function stclo(a: RefAction, idx: number, v: any) {
            check(0 <= idx && idx < a.len)
            check(a.fields[idx] === undefined)
            //console.log(`STCLO [${idx}] = ${v}`)
            a.fields[idx] = v;
            return a;
        }

        export function stringData(s: string) {
            return s;
        }
    }

    export namespace boolean {
        export function not_(v: boolean) {
            return !v;
        }
    }


    // A ref-counted collection of either primitive or ref-counted objects (String, Image,
    // user-defined record, another collection)
    class RefCollection extends RefObject {
        data: any[] = [];

        // 1 - collection of refs (need decr)
        // 2 - collection of strings (in fact we always have 3, never 2 alone)
        constructor(public flags: number) {
            super();
        }

        destroy() {
            let data = this.data
            if (this.flags & 1)
                for (let i = 0; i < data.length; ++i) {
                    decr(data[i]);
                    data[i] = 0;
                }
            this.data = [];
        }

        print() {
            console.log(`RefCollection id:${this.id} refs:${this.refcnt} len:${this.data.length} flags:${this.flags} d0:${this.data[0]}`)
        }
    }

    export namespace collection {
        export function mk(f: number) {
            return new RefCollection(f);
        }

        export function count(c: RefCollection) {
            return c.data.length;
        }

        export function add(c: RefCollection, x: any) {
            if (c.flags & 1) incr(x);
            c.data.push(x);
        }

        export function in_range(c: RefCollection, x: number) {
            return (0 <= x && x < c.data.length);
        }

        export function at(c: RefCollection, x: number) {
            if (in_range(c, x)) {
                let tmp = c.data[x];
                if (c.flags & 1) incr(tmp);
                return tmp;
            }
            else {
                check(false);
            }
        }

        export function remove_at(c: RefCollection, x: number) {
            if (!in_range(c, x))
                return;

            if (c.flags & 1) decr(c.data[x]);
            c.data.splice(x, 1)
        }

        export function set_at(c: RefCollection, x: number, y: any) {
            if (!in_range(c, x))
                return;

            if (c.flags & 1) {
                decr(c.data[x]);
                incr(y);
            }
            c.data[x] = y;
        }

        export function index_of(c: RefCollection, x: any, start: number) {
            if (!in_range(c, start))
                return -1;
            return c.data.indexOf(x, start)
        }

        export function remove(c: RefCollection, x: any) {
            let idx = index_of(c, x, 0);
            if (idx >= 0) {
                remove_at(c, idx);
                return 1;
            }
            return 0;
        }
    }

    export namespace math {
        export function abs(v: number) { return v < 0 ? -v : v; }
        export function sign(v: number) { return v == 0 ? 0 : v < 0 ? -1 : 1; }
    }

    // for explanations see:
    // http://stackoverflow.com/questions/3428136/javascript-integer-math-incorrect-results (second answer)
    // (but the code below doesn't come from there; I wrote it myself)
    function intMult(a: number, b: number) {
        return (((a & 0xffff) * (b >>> 16) + (b & 0xffff) * (a >>> 16)) << 16) + ((a & 0xffff) * (b & 0xffff));
    }

    export namespace number {
        export function lt(x: number, y: number) { return x < y; }
        export function le(x: number, y: number) { return x <= y; }
        export function neq(x: number, y: number) { return x != y; }
        export function eq(x: number, y: number) { return x == y; }
        export function gt(x: number, y: number) { return x > y; }
        export function ge(x: number, y: number) { return x >= y; }
        export function add(x: number, y: number) { return (x + y) | 0; }
        export function subtract(x: number, y: number) { return (x - y) | 0; }
        export function divide(x: number, y: number) { return Math.floor(x / y) | 0; }
        export function multiply(x: number, y: number) { return intMult(x, y); }
        export function to_string(x: number) { return x + ""; }
        export function to_character(x: number) { return String.fromCharCode(x); }
        export function post_to_wall(s: number) { console.log(s); }
    }

    export namespace record {
        export function mk(reflen: number, totallen: number) {
            check(0 <= reflen && reflen <= totallen);
            check(reflen <= totallen && totallen <= 255);
            let r = new RefRecord();
            r.reflen = reflen
            r.len = totallen
            for (let i = 0; i < totallen; ++i)
                r.fields.push(i < reflen ? null : 0)
            return r
        }
    }

    export namespace string {
        // TODO check edge-conditions

        export function mkEmpty() {
            return ""
        }

        export function concat(a: string, b: string) {
            return (a + b);
        }

        export function concat_op(s1: string, s2: string) {
            return concat(s1, s2);
        }

        export function substring(s: string, i: number, j: number) {
            return s.slice(i, i + j);
        }

        export function equals(s1: string, s2: string) {
            return s1 == s2;
        }

        export function count(s: string) {
            return s.length
        }

        function inRange(s: string, i: number) { return 0 <= i && i < s.length }

        export function at(s: string, i: number) {
            return inRange(s, i) ? s.charAt(i) : null;
        }

        export function to_character_code(s: string) {
            return code_at(s, 0);
        }

        export function code_at(s: string, i: number) {
            return inRange(s, i) ? s.charCodeAt(i) : 0;
        }

        export function to_number(s: string) {
            return parseInt(s);
        }

        export function post_to_wall(s: string) {
            console.log(s);
        }
    }

}

namespace rt {
    export type LabelFn = (n: number) => void;
    export type ResumeFn = (v?: any) => void;

    interface LR {
        caller: LR;
        retPC: number;
        currFn: LabelFn;
        baseSP: number;
        finalCallback?: ResumeFn;
    }

    export interface Runtime {
        run(cb: ResumeFn): void;
        getResume(): ResumeFn;
        numGlobals: number;
        mem: any;
        setupTop(cb: ResumeFn): void;
        malloc(): number; // 2k block
        free(ptr: number): void;
    }

    export var currRuntime: Runtime;
    export function getResume() { return currRuntime.getResume() }

    export function mkRuntime(code: string): Runtime {
        var sp: number, lr: LR;
        var rr0: any, rr1: any, rr2: any, rr3: any;
        var r4: any, r5: any, r6: any, r7: any;
        var mem: any = {}
        var entryPoint: LabelFn;
        var currResume: ResumeFn;

        var baseStack = 1000000;
        var freeStacks: number[] = [];

        function malloc() {
            if (freeStacks.length > 0)
                return freeStacks.pop();
            baseStack += 2000;
            return baseStack;
        }

        function free(p: number) {
            freeStacks.push(p)
        }

        function oops(msg: string) {
            throw new Error("mbitsim error: " + msg)
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

        function actionCall(fn: LabelFn, retPC: number, cb?: ResumeFn) {
            lr = {
                caller: lr,
                retPC: retPC,
                currFn: fn,
                baseSP: sp,
                finalCallback: cb
            }
            fn(0)
        }

        function leave(v: any) {
            let topLr = lr
            lr = lr.caller
            let popped = pop()
            if (popped != topLr) oops("lrpop")
            rr0 = v;
            if (topLr.finalCallback)
                topLr.finalCallback(v);
            return lr.currFn(topLr.retPC);
        }

        function setupTop(cb: ResumeFn) {
            setupTopCore(cb)
            setupResume(0)
        }

        function setupTopCore(cb: ResumeFn) {
            let stackTop = malloc();
            sp = stackTop;
            lr = {
                caller: null,
                retPC: 0,
                baseSP: sp,
                currFn: () => {
                    free(stackTop)
                    if (cb)
                        cb(rr0)
                }
            }
        }

        function topCall(fn: LabelFn, cb: ResumeFn) {
            setupTopCore(cb)
            actionCall(fn, 0)
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
                    return actionCall(w.func, retPC, w.cb)
                }
                rr0 = v;
                return lr.currFn(retPC)
            }
        }

        eval(code)

        return (currRuntime = {
            run: (cb) => topCall(entryPoint, cb),
            getResume: () => {
                if (!currResume) oops("noresume")
                let r = currResume
                currResume = null
                return r
            },
            numGlobals: 1000,
            mem,
            setupTop,
            malloc,
            free
        })
    }
}


function main() {
    let f = fs.readFileSync(process.argv[2], "utf8")
    let r = rt.mkRuntime(f)
    r.run(() => {
        console.log("DONE")
        rt.dumpLivePointers();
    })
}

main();
