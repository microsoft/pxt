// APIs for language/runtime support (records, locals, function values)

namespace ks.rt {
    export var quiet = false;

    export function check(cond: boolean) {
        if (!cond)
            throw new Error("sim: check failed")
    }

    var refObjId = 1;
    var liveRefObjs: any = {};

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
        constructor(public func: LabelFn, public caps: any[], public a0: any, public a1: any, public cb: ResumeFn) { }
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
                cb(new FnWrapper(a.func, a.fields, a0, a1, () => {
                    bitvm.decr(a)
                }))
            } else {
                // no-closure case
                cb(new FnWrapper(<any>a, null, a0, a1, null))
            }
        }

        export function run1(a: RefAction, v: any) {
            run2(a, v, null)
        }

        export function run(a: RefAction) {
            run2(a, null, null)
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

        export function ldglb(idx: number) {
            check(0 <= idx && idx < runtime.numGlobals);
            return num(runtime.globals[idx])
        }

        export function ldglbRef(idx: number) {
            check(0 <= idx && idx < runtime.numGlobals);
            return incr(ref(runtime.globals[idx]))
        }

        // note the idx comes last - it's more convenient that way in the emitter
        export function stglb(v: any, idx: number) {
            check(0 <= idx && idx < runtime.numGlobals);
            runtime.globals[idx] = v;
        }

        export function stglbRef(v: any, idx: number) {
            check(0 <= idx && idx < runtime.numGlobals);
            decr(runtime.globals[idx])
            runtime.globals[idx] = v;
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

    export namespace thread {
        export function pause(ms: number) {
            let cb = getResume();
            setTimeout(() => { cb() }, ms)
        }
        
        export function runInBackground(a: RefAction) {
            runtime.runFiberAsync(a).done()
        }
    }


}
