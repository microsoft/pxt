// APIs for language/runtime support (records, locals, function values)

namespace pxsim {
    export var quiet = false;

    export function check(cond: boolean) {
        if (!cond) {
            debugger
            throw new Error("sim: check failed")
        }
    }

    let refObjId = 1;
    let liveRefObjs: any = {};
    let stringLiterals: any;
    let stringRefCounts: any = {};
    let refCounting = true;

    export function noRefCounting() {
        refCounting = false;
    }

    export class RefObject {
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
        constructor(
            public func: LabelFn,
            public caps: any[],
            public a0: any,
            public a1: any,
            public a2: any,
            public cb: ResumeFn) { }
    }

    export class RefRecord extends RefObject {
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

    export class RefAction extends RefRecord {
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

    export namespace pxt {
        export function mkAction(reflen: number, len: number, fn: LabelFn) {
            let r = new RefAction();
            r.len = len
            r.reflen = reflen
            r.func = fn
            return r
        }

        export function runAction3(a: RefAction, a0: any, a1: any, a2: any) {
            let cb = getResume();

            if (a instanceof RefAction) {
                pxtrt.incr(a)
                cb(new FnWrapper(a.func, a.fields, a0, a1, a2, () => {
                    pxtrt.decr(a)
                }))
            } else {
                // no-closure case
                cb(new FnWrapper(<any>a, null, a0, a1, a2, null))
            }
        }

        export function runAction2(a: RefAction, a0: any, a1: any) {
            runAction3(a, a0, a1, null)
        }

        export function runAction1(a: RefAction, v: any) {
            runAction3(a, v, null, null)
        }

        export function runAction0(a: RefAction) {
            runAction3(a, null, null, null)
        }
    }

    export class RefLocal extends RefObject {
        v = 0;

        print() {
            console.log(`RefLocal id:${this.id} refs:${this.refcnt} v:${this.v}`)
        }
    }

    export class RefRefLocal extends RefObject {
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
        if (noRefCounting()) return
        if (v instanceof RefObject) {
            let o = <RefObject>v
            check(o.refcnt > 0)
            if (--o.refcnt == 0) {
                delete liveRefObjs[o.id + ""]
                o.destroy()
            }
        } else if (typeof v == "string") {
            if (stringLiterals && !stringLiterals.hasOwnProperty(v)) {
                stringRefDelta(v, -1)
            }
        } else if (!v) {
            // OK (null)
        } else if (typeof v == "function") {
            // OK (function literal)
        } else {
            throw new Error("bad decr")
        }
    }

    export function setupStringLiterals(strings: any) {
        // reset
        liveRefObjs = {};
        stringRefCounts = {};

        // and set up strings
        strings[""] = 1
        strings["true"] = 1
        strings["false"] = 1

        // comment out next line to disable string ref counting
        stringLiterals = strings
    }

    function stringRefDelta(s: string, n: number) {
        if (!stringRefCounts.hasOwnProperty(s))
            stringRefCounts[s] = 0
        let r = (stringRefCounts[s] += n)
        if (r == 0)
            delete stringRefCounts[s]
        else
            check(r > 0)
        return r
    }

    export function initString(v: string) {
        if (!v || !stringLiterals) return v
        if (typeof v == "string" && !stringLiterals.hasOwnProperty(v))
            stringRefDelta(v, 1)
        return v
    }

    export function incr(v: any) {
        if (noRefCounting()) return v
        if (v instanceof RefObject) {
            let o = <RefObject>v
            check(o.refcnt > 0)
            o.refcnt++
        } else if (stringLiterals && typeof v == "string" && !stringLiterals.hasOwnProperty(v)) {
            let k = stringRefDelta(v, 1)
            check(k > 1)
        }
        return v;
    }

    export function dumpLivePointers() {
        if (noRefCounting()) return
        Object.keys(liveRefObjs).forEach(k => {
            (<RefObject>liveRefObjs[k]).print()
        })
        Object.keys(stringRefCounts).forEach(k => {
            let n = stringRefCounts[k]
            console.log("Live String:", JSON.stringify(k), "refcnt=", n)
        })
    }

    export namespace pxt {
        export var incr = pxsim.incr;
        export var decr = pxsim.decr;

        export function ptrOfLiteral(v: any) {
            return v;
        }

        export function debugMemLeaks() {
            dumpLivePointers();
        }

        export function allocate() {
            U.userError("allocate() called in simulator")
        }

        export function templateHash() {
            return 0;
        }

        export function programHash() {
            return 0;
        }
    }

    export namespace pxtrt {
        export var incr = pxsim.incr;
        export var decr = pxsim.decr;

        export function panic(code: number) {
            U.userError("PANIC! Code " + code)
        }

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

        // these are never used in simulator; silence the warnings
        export var ldglb: any;
        export var ldglbRef: any;
        export var stglb: any;
        export var stglbRef: any;
        export var getNumGlobals: any;
        export var getGlobalsPtr: any;
    }


    export namespace pxt {
        export function mkRecord(reflen: number, totallen: number) {
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

    export namespace thread {
        export var panic = pxtrt.panic;

        export function pause(ms: number) {
            let cb = getResume();
            setTimeout(() => { cb() }, ms)
        }

        export function runInBackground(a: RefAction) {
            runtime.runFiberAsync(a).done()
        }

        export function forever(a: RefAction) {
            function loop() {
                runtime.runFiberAsync(a)
                    .then(() => Promise.delay(20))
                    .then(loop)
                    .done()
            }
            incr(a)
            loop()
        }
    }


}
