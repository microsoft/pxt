// APIs for language/runtime support (records, locals, function values)

namespace pxsim {
    export var quiet = false;

    export function check(cond: boolean, msg: string = "sim: check failed") {
        if (!cond) {
            debugger
            throw new Error(msg)
        }
    }

    let refObjId = 1;
    let liveRefObjs: any = {};
    let stringRefCounts: any = {};
    let refCounting = true;
    let floatingPoint = false;

    export function noRefCounting() {
        refCounting = false;
    }

    export function enableFloatingPoint() {
        floatingPoint = true
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

    export function noLeakTracking(r: RefObject) {
        delete liveRefObjs[r.id + ""]
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

    export interface VTable {
        name: string;
        methods: LabelFn[];
        refmask: boolean[];
    }

    export class RefRecord extends RefObject {
        fields: any[] = [];
        vtable: VTable;

        destroy() {
            let refmask = this.vtable.refmask
            for (let i = 0; i < refmask.length; ++i)
                if (refmask[i]) decr(this.fields[i])
            this.fields = null
            this.vtable = null
        }

        isRef(idx: number) {
            check(0 <= idx && idx < this.fields.length)
            return !!this.vtable.refmask[idx]
        }

        print() {
            console.log(`RefInstance id:${this.id} (${this.vtable.name}) len:${this.fields.length}`)
        }
    }

    export class RefAction extends RefObject {
        fields: any[] = [];
        reflen: number
        func: LabelFn;

        isRef(idx: number) {
            check(0 <= idx && idx < this.fields.length)
            return idx < this.reflen
        }

        ldclo(n: number) {
            n >>= 2;
            check(0 <= n && n < this.fields.length)
            return this.fields[n]
        }

        destroy() {
            for (let i = 0; i < this.reflen; ++i)
                decr(this.fields[i])
            this.fields = null
            this.func = null
        }

        print() {
            console.log(`RefAction id:${this.id} refs:${this.refcnt} len:${this.fields.length}`)
        }
    }

    export namespace pxtcore {
        export function mkAction(reflen: number, len: number, fn: LabelFn) {
            let r = new RefAction();
            r.reflen = reflen
            r.func = fn
            for (let i = 0; i < len; ++i)
                r.fields.push(null)
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

    export interface MapEntry {
        key: number;
        val: any;
    }

    export class RefMap extends RefObject {
        vtable = 42;
        data: MapEntry[] = [];

        findIdx(key: number) {
            for (let i = 0; i < this.data.length; ++i) {
                if (this.data[i].key >> 1 == key)
                    return i;
            }
            return -1;
        }

        destroy() {
            super.destroy()
            for (let i = 0; i < this.data.length; ++i) {
                if (this.data[i].key & 1) {
                    decr(this.data[i].val);
                }
                this.data[i].val = 0;
            }
            this.data = []
        }

        print() {
            console.log(`RefMap id:${this.id} refs:${this.refcnt} size:${this.data.length}`)
        }
    }


    function num(v: any) {
        if (!floatingPoint && v === undefined) return 0;
        return v;
    }

    function ref(v: any) {
        if (v === undefined) return null;
        return v;
    }

    export function decr(v: any): void {
        if (!refCounting) return
        if (v instanceof RefObject) {
            let o = <RefObject>v
            check(o.refcnt > 0)
            if (--o.refcnt == 0) {
                delete liveRefObjs[o.id + ""]
                o.destroy()
            }
        }
    }

    export function initString(v: string) {
        return v
    }

    export function incr(v: any) {
        if (!refCounting) return v
        if (v instanceof RefObject) {
            let o = <RefObject>v
            check(o.refcnt > 0)
            o.refcnt++
        }
        return v;
    }

    export function dumpLivePointers() {
        if (!refCounting) return
        Object.keys(liveRefObjs).forEach(k => {
            (<RefObject>liveRefObjs[k]).print()
        })
        Object.keys(stringRefCounts).forEach(k => {
            let n = stringRefCounts[k]
            console.log("Live String:", JSON.stringify(k), "refcnt=", n)
        })
    }

    export namespace numops {
        export function toString(v: any) {
            if (v === null) return "null"
            else if (v === undefined) return "undefined"
            return initString(v.toString())
        }
        export function toBoolDecr(v: any) {
            decr(v)
            return !!v
        }
        export function toBool(v: any) {
            return !!v
        }
    }

    export namespace langsupp {
        export function toInt(v: number) { return (v | 0) } // TODO
        export function toFloat(v: number) { return v }

        export function ignore(v: any) { return v; }
    }

    export namespace pxtcore {
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

        export function programSize() {
            return 0;
        }

        export function afterProgramPage() {
            return 0;
        }

        // these shouldn't generally be called when compiled for simulator
        // provide implementation to silence warnings and as future-proofing
        export function toInt(n: number) { return n >> 0 }
        export function toUInt(n: number) { return n >>> 0 }
        export function toDouble(n: number) { return n }
        export function toFloat(n: number) { return n }
        export function fromInt(n: number) { return n }
        export function fromUInt(n: number) { return n }
        export function fromDouble(n: number) { return n }
        export function fromFloat(n: number) { return n }
        export function fromBool(n: any) { return !!n }
    }

    export namespace pxtrt {
        export var incr = pxsim.incr;
        export var decr = pxsim.decr;

        export function toInt8(v: number) {
            return ((v & 0xff) << 24) >> 24
        }

        export function toInt16(v: number) {
            return ((v & 0xffff) << 16) >> 16
        }

        export function toInt32(v: number) {
            return v | 0
        }

        export function toUInt32(v: number) {
            return v >>> 0
        }

        export function toUInt8(v: number) {
            return v & 0xff
        }

        export function toUInt16(v: number) {
            return v & 0xffff
        }

        export function nullFix(v: any) {
            if (v === null || v === undefined || v === false)
                return 0
            if (v === true)
                return 1
            return v
        }

        export function nullCheck(v: any) {
            if (v === null || v === undefined)
                U.userError("Dereferencing null/undefined value.")
        }

        export function panic(code: number) {
            U.userError("PANIC! Code " + code)
        }

        export function stringToBool(s: string) {
            decr(s)
            return s ? 1 : 0
        }

        export function ptrToBool(v: any) {
            decr(v)
            return v ? 1 : 0
        }

        export function emptyToNull(s: string): any {
            if (s == "") return 0
            return s
        }

        export function ldfld(r: RefRecord, idx: number) {
            nullCheck(r)
            check(!r.isRef(idx))
            let v = num(r.fields[idx])
            decr(r)
            return v;
        }

        export function stfld(r: RefRecord, idx: number, v: any) {
            nullCheck(r)
            check(!r.isRef(idx))
            r.fields[idx] = v;
            decr(r)
        }

        export function ldfldRef(r: RefRecord, idx: number) {
            nullCheck(r)
            check(r.isRef(idx))
            let v = incr(ref(r.fields[idx]))
            decr(r)
            return v
        }

        export function stfldRef(r: RefRecord, idx: number, v: any) {
            nullCheck(r)
            check(r.isRef(idx))
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
            check(0 <= idx && idx < a.fields.length)
            check(a.fields[idx] === null)
            //console.log(`STCLO [${idx}] = ${v}`)
            a.fields[idx] = v;
            return a;
        }

        export function runtimeWarning(msg: string) {
            Runtime.postMessage(pxsim.getWarningMessage(msg))
        }

        export function mkMap() {
            return new RefMap();
        }

        export function mapGet(map: RefMap, key: number) {
            let i = map.findIdx(key);
            if (i < 0) {
                decr(map)
                return 0;
            }
            let r = map.data[i].val;
            decr(map)
            return r;
        }

        export function mapGetRef(map: RefMap, key: number) {
            let i = map.findIdx(key);
            if (i < 0) {
                decr(map);
                return 0;
            }
            let r = incr(map.data[i].val);
            decr(map)
            return r;
        }

        export function mapSet(map: RefMap, key: number, val: any) {
            let i = map.findIdx(key);
            if (i < 0) {
                map.data.push({
                    key: key << 1,
                    val: val
                });
            } else {
                if (map.data[i].key & 1) {
                    decr(map.data[i].val);
                    map.data[i].key = key << 1;
                }
                map.data[i].val = val;
            }
            decr(map)
        }

        export function mapSetRef(map: RefMap, key: number, val: any) {
            let i = map.findIdx(key);
            if (i < 0) {
                map.data.push({
                    key: (key << 1) | 1,
                    val: val
                });
            } else {
                if (map.data[i].key & 1) {
                    decr(map.data[i].val);
                } else {
                    map.data[i].key = (key << 1) | 1;
                }
                map.data[i].val = val;
            }
            decr(map)
        }

        export function switch_eq(a: any, b: any) {
            if (a == b) {
                decr(b)
                return true
            }
            return false
        }

        // these are never used in simulator; silence the warnings
        export var getGlobalsPtr: any;
    }


    export namespace pxtcore {
        export function mkClassInstance(vtable: VTable) {
            check(!!vtable.methods)
            check(!!vtable.refmask)
            let r = new RefRecord()
            r.vtable = vtable
            let len = vtable.refmask.length
            for (let i = 0; i < len; ++i)
                r.fields.push(floatingPoint ? undefined : 0)
            return r
        }

        // these are never used in simulator; silence the warnings
        export var getNumGlobals: any;
        export var RefRecord_destroy: any;
        export var RefRecord_print: any;
        export var anyPrint: any;
        export var dumpDmesg: any;
        export var getVTable: any;
        export var switch_eq: any;
        export var valType: any;
        export var typeOf: any;
        export var lookupPin: any;
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
            pxtrt.nullCheck(a)
            incr(a)
            loop()
        }
    }


}
