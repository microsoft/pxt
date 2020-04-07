// APIs for language/runtime support (records, locals, function values)

namespace pxsim {
    export let quiet = false;

    export function check(cond: boolean, msg: string = "sim: check failed") {
        if (!cond) {
            debugger
            throw new Error(msg)
        }
    }

    export let title = "";
    let cfgKey: Map<number> = {}
    let cfg: Map<number> = {}

    export function getConfig(id: number) {
        if (cfg.hasOwnProperty(id + ""))
            return cfg[id + ""]
        return null
    }

    export function getConfigKey(id: string) {
        if (cfgKey.hasOwnProperty(id))
            return cfgKey[id]
        return null
    }

    export function getAllConfigKeys() {
        return Object.keys(cfgKey)
    }

    export function setConfigKey(key: string, id: number) {
        cfgKey[key] = id;
    }

    export function setConfig(id: number, val: number) {
        cfg[id] = val
    }


    export function setConfigData(cfg_: Map<number>, cfgKey_: Map<number>) {
        cfg = cfg_
        cfgKey = cfgKey_
    }

    export interface ConfigData {
        cfg: Map<number>;
        cfgKey: Map<number>;
    }

    export function getConfigData(): ConfigData {
        return { cfg, cfgKey }
    }

    export function setTitle(t: string) {
        title = t;
    }

    export class RefObject {
        id: number;

        constructor() {
            if (runtime)
                this.id = runtime.registerLiveObject(this);
            else
                this.id = 0;
        }

        destroy() { }

        scan(mark: (path: string, v: any) => void) {
            throw U.userError("scan not implemented")
        }

        gcKey(): string { throw U.userError("gcKey not implemented") }
        gcSize(): number { throw U.userError("gcSize not implemented") }
        gcIsStatic() { return false }

        print() {
            if (runtime && runtime.refCountingDebug)
                console.log(`RefObject id:${this.id}`)
        }

        // render a debug preview string
        toDebugString(): string {
            return "(object)";
        }

        static toAny(o: any): any {
            if (o && o.toAny) return o.toAny();
            return o;
        }

        static toDebugString(o: any): string {
            if (o === null) return "null";
            if (o === undefined) return "undefined;"
            if (o.vtable && o.vtable.name) return o.vtable.name;
            if (o.toDebugString) return o.toDebugString();
            if (typeof o == "string") return JSON.stringify(o);
            return o.toString();
        }
    }

    export class FnWrapper {
        constructor(
            public func: LabelFn,
            public caps: any[],
            public args: any[]) { }
    }

    export interface VTable {
        name: string;
        methods: LabelFn[];
        numFields: number;
        toStringMethod?: LabelFn;
        classNo: number;
        lastSubtypeNo: number;
        iface?: Map<any>;
        maxBgInstances?: number;
    }

    export class RefRecord extends RefObject {
        fields: any = {};
        vtable: VTable;

        scan(mark: (path: string, v: any) => void) {
            for (let k of Object.keys(this.fields))
                mark(k, this.fields[k])
        }

        gcKey() { return this.vtable.name }
        gcSize() { return this.vtable.numFields + 1 }

        destroy() {
            this.fields = null
            this.vtable = null
        }

        print() {
            if (runtime && runtime.refCountingDebug)
                console.log(`RefRecord id:${this.id} (${this.vtable.name})`)
        }
    }

    export class RefAction extends RefObject {
        fields: any[] = [];
        len: number
        func: LabelFn;

        scan(mark: (path: string, v: any) => void) {
            for (let i = 0; i < this.fields.length; ++i)
                mark("_cap" + i, this.fields[i])
        }

        gcKey() { return pxsim.functionName(this.func) }
        gcSize() { return this.fields.length + 3 }

        isRef(idx: number) {
            check(0 <= idx && idx < this.fields.length)
            return idx < this.len
        }

        ldclo(n: number) {
            n >>= 2;
            check(0 <= n && n < this.fields.length)
            return this.fields[n]
        }

        destroy() {
            this.fields = null
            this.func = null
        }

        print() {
            if (runtime && runtime.refCountingDebug)
                console.log(`RefAction id:${this.id} len:${this.fields.length}`)
        }
    }

    export namespace pxtcore {
        export function seedAddRandom(num: number) {
            // nothing yet
        }

        export function mkAction(len: number, fn: LabelFn) {
            let r = new RefAction();
            r.len = len
            r.func = fn
            for (let i = 0; i < len; ++i)
                r.fields.push(null)
            return r
        }

        export function runAction(a: RefAction, args: any[]) {
            let cb = getResume();
            if (a instanceof RefAction) {
                cb(new FnWrapper(a.func, a.fields, args))
            } else {
                // no-closure case
                cb(new FnWrapper(<any>a, null, args))
            }
        }

        interface PerfCntInfo {
            stops: number;
            us: number;
            meds: number[];
        }
        let counters: any = {}

        // TODO move this somewhere else, so it can be invoked also on data coming from hardware
        function processPerfCounters(msg: string) {
            let r = ""
            const addfmtr = (s: string, len: number) => {
                r += s.length >= len ? s : ("              " + s).slice(-len)
            }
            const addfmtl = (s: string, len: number) => {
                r += s.length >= len ? s : (s + "                         ").slice(0, len)
            }
            const addnum = (n: number) => addfmtr("" + Math.round(n), 6)
            const addstats = (numstops: number, us: number) => {
                addfmtr(Math.round(us) + "", 8)
                r += " /"
                addnum(numstops)
                r += " ="
                addnum(us / numstops)
            }
            for (let line of msg.split(/\n/)) {
                if (!line) continue
                if (!/^\d/.test(line)) continue
                const fields = line.split(/,/)
                let pi: PerfCntInfo = counters[fields[2]]
                if (!pi)
                    counters[fields[2]] = pi = { stops: 0, us: 0, meds: [] }

                addfmtl(fields[2], 25)

                const numstops = parseInt(fields[0])
                const us = parseInt(fields[1])
                addstats(numstops, us)

                r += " |"

                addstats(numstops - pi.stops, us - pi.us)

                r += " ~"
                const med = parseInt(fields[3])
                addnum(med)

                if (pi.meds.length > 10)
                    pi.meds.shift()
                pi.meds.push(med)
                const mm = pi.meds.slice()
                mm.sort((a, b) => a - b)
                const ubermed = mm[mm.length >> 1]

                r += " ~~"
                addnum(ubermed)

                pi.stops = numstops
                pi.us = us

                r += "\n"
            }

            console.log(r)
        }


        export function dumpPerfCounters() {
            if (!runtime || !runtime.perfCounters)
                return
            let csv = "calls,us,name\n"
            for (let p of runtime.perfCounters) {
                p.lastFew.sort()
                const median = p.lastFew[p.lastFew.length >> 1]
                csv += `${p.numstops},${p.value},${p.name},${median}\n`
            }
            processPerfCounters(csv)
            // console.log(csv)
        }
    }

    export class RefRefLocal extends RefObject {
        v: any = null;

        scan(mark: (path: string, v: any) => void) {
            mark("*", this.v)
        }

        gcKey() { return "LOC" }
        gcSize() { return 2 }

        destroy() {
        }

        print() {
            if (runtime && runtime.refCountingDebug)
                console.log(`RefRefLocal id:${this.id} v:${this.v}`)
        }
    }

    export interface MapEntry {
        key: string;
        val: any;
    }

    export class RefMap extends RefObject {
        vtable = mkMapVTable();
        data: MapEntry[] = [];

        scan(mark: (path: string, v: any) => void) {
            for (let d of this.data) {
                mark(d.key, d.val)
            }
        }
        gcKey() { return "{...}" }
        gcSize() { return this.data.length * 2 + 4 }

        findIdx(key: string) {
            key = key + "" // make sure it's a string
            for (let i = 0; i < this.data.length; ++i) {
                if (this.data[i].key == key)
                    return i;
            }
            return -1;
        }

        destroy() {
            super.destroy()
            for (let i = 0; i < this.data.length; ++i) {
                this.data[i].val = 0;
            }
            this.data = []
        }

        print() {
            if (runtime && runtime.refCountingDebug)
                console.log(`RefMap id:${this.id} size:${this.data.length}`)
        }

        toAny(): any {
            const r: any = {};
            this.data.forEach(d => {
                r[d.key] = RefObject.toAny(d.val);
            })
            return r;
        }
    }


    function num(v: any) {
        return v;
    }

    function ref(v: any) {
        if (v === undefined) return null;
        return v;
    }

    export function dumpLivePointers() {
        if (runtime) runtime.dumpLivePointers();
    }
    export namespace numops {
        export function toString(v: any) {
            if (v === null) return "null"
            else if (v === undefined) return "undefined"
            return v.toString()
        }
        export function toBoolDecr(v: any) {
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
        export function ptrOfLiteral(v: any) {
            return v;
        }

        export function debugMemLeaks() {
            dumpLivePointers();
        }

        export function templateHash() {
            return 0;
        }

        export function programHash() {
            return 0;
        }

        export function programName() {
            return pxsim.title;
        }

        export function programSize() {
            return 0;
        }

        export function afterProgramPage() {
            return 0;
        }

        export function getConfig(key: number, defl: number) {
            let r = pxsim.getConfig(key)
            if (r == null) return defl
            return r
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
            return s ? 1 : 0
        }

        export function ptrToBool(v: any) {
            return v ? 1 : 0
        }

        export function emptyToNull(s: string): any {
            if (s == "") return 0
            return s
        }

        export function ldlocRef(r: RefRefLocal) {
            return (r.v)
        }

        export function stlocRef(r: RefRefLocal, v: any) {
            r.v = v;
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

        export let mapKeyNames: string[]

        export function mapGet(map: RefMap, key: number) {
            return mapGetByString(map, mapKeyNames[key])
        }

        export function mapSet(map: RefMap, key: number, val: any) {
            return mapSetByString(map, mapKeyNames[key], val)
        }

        export function mapGetByString(map: RefMap, key: string) {
            key += ""
            if (map instanceof RefRecord) {
                let r = map as RefRecord
                return r.fields[key]
            }
            let i = map.findIdx(key);
            if (i < 0) {
                return undefined;
            }
            return (map.data[i].val);
        }

        export function mapDeleteByString(map: RefMap, key: string) {
            if (!(map instanceof RefMap))
                pxtrt.panic(923)
            let i = map.findIdx(key);
            if (i >= 0)
                map.data.splice(i, 1)
            return true
        }

        export const mapSetGeneric = mapSetByString
        export const mapGetGeneric = mapGetByString

        export function mapSetByString(map: RefMap, key: string, val: any) {
            key += ""
            if (map instanceof RefRecord) {
                let r = map as RefRecord
                r.fields[key] = val
                return
            }
            let i = map.findIdx(key);
            if (i < 0) {
                map.data.push({
                    key: key,
                    val: val,
                });
            } else {
                map.data[i].val = val;
            }
        }

        export function keysOf(v: RefMap) {
            let r = new RefCollection()
            if (v instanceof RefMap)
                for (let k of v.data) {
                    r.push(k.key)
                }
            return r
        }

        // these are never used in simulator; silence the warnings
        export let getGlobalsPtr: any;
        export let lookupMapKey: any;
    }


    export namespace pxtcore {
        export function mkClassInstance(vtable: VTable) {
            check(!!vtable.methods)
            let r = new RefRecord()
            r.vtable = vtable
            return r
        }

        export function switch_eq(a: any, b: any) {
            if (a == b) {
                return true
            }
            return false
        }

        // these are never used in simulator; silence the warnings
        export let getNumGlobals: any;
        export let RefRecord_destroy: any;
        export let RefRecord_print: any;
        export let anyPrint: any;
        export let dumpDmesg: any;
        export let getVTable: any;
        export let valType: any;
        export let lookupPin: any;
        export let deleteRefObject: any;
        export let popThreadContext: any;
        export let pushThreadContext: any;
        export let failedCast: any;
        export let missingProperty: any;
        export let string_vt: any;
        export let buffer_vt: any;
        export let number_vt: any;
        export let RefAction_vtable: any;
        export let RefRecord_scan: any;
        export let RefRecord_gcsize: any;
        export let startPerfCounter: any;
        export let stopPerfCounter: any;
        export let string_inline_ascii_vt: any;
        export let string_inline_utf8_vt: any;
        export let string_cons_vt: any;
        export let string_skiplist16_vt: any;

        export function typeOf(obj: any) {
            return typeof obj;
        }
    }

    // these can only be used from assembly - silence warnings
    export let __aeabi_dadd: any;
    export let __aeabi_dcmplt: any;
    export let __aeabi_dcmpgt: any;
    export let __aeabi_dsub: any;
    export let __aeabi_ddiv: any;
    export let __aeabi_dmul: any;

    export namespace thread {
        export let panic = pxtrt.panic;

        export function pause(ms: number) {
            let cb = getResume();
            runtime.schedule(() => { cb() }, ms)
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
            loop()
        }
    }


}
