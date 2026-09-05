// Interface dispatch semantics: dynamic member get/set/call through
// interface-typed, structurally typed and any-typed references.
//
// Interface member ids are global by name across the whole program, and some
// dispatch specializations are gated on how many static call sites a member
// has. Every member exercised here therefore carries a `qz` prefix that is
// unique to this file, and the call sites of the threshold-straddling members
// are counted deliberately: `qzLo` and `qzRare` sit below their thresholds,
// `qzHi`, `qzMany` and `qzHot` sit above. Both sides must behave identically.

namespace IfaceDispatch {

    // --- threshold straddling -------------------------------------------

    interface QzShape {
        qzFew: number
        qzMany: number
        qzLo(n: number): number
        qzHi(n: number): number
    }

    class QzThing implements QzShape {
        qzFew: number
        qzMany: number
        constructor(few: number, many: number) {
            this.qzFew = few
            this.qzMany = many
        }
        qzLo(n: number): number {
            return n + 1
        }
        qzHi(n: number): number {
            return n + 2
        }
    }

    // Within this function: qzLo is dispatched from 2 sites, qzHi from 5;
    // qzFew is read at 4 sites and qzMany at 6. All of them go through an
    // interface-typed reference, i.e. the checked/dynamic path.
    //
    // Call-site counts that feed the specialization thresholds are
    // PROGRAM-WIDE per member name. qzHi and qzMany have additional sites in
    // testAgreement and testDynamicGet, which keeps them above their gates;
    // qzLo (2 total) and qzFew (4 total) have no sites outside this function
    // and must stay below their gates (3 and 5). When editing this file,
    // grep the member name before adding a call or read anywhere.
    function testThresholds() {
        msg("thresholds")

        const a: QzShape = new QzThing(1, 10)
        const b: QzShape = new QzThing(2, 20)

        // qzLo: call site 1 and 2
        assert(a.qzLo(0) == 1, "th:lo1")
        assert(b.qzLo(5) == 6, "th:lo2")

        // qzHi: call sites 1..5
        assert(a.qzHi(0) == 2, "th:hi1")
        assert(b.qzHi(5) == 7, "th:hi2")
        assert(a.qzHi(10) == 12, "th:hi3")
        assert(b.qzHi(-2) == 0, "th:hi4")
        let hisum = 0
        for (let i = 0; i < 4; i++) hisum += a.qzHi(i)
        assert(hisum == 14, "th:hi5")

        // qzFew: read sites 1..4
        assert(a.qzFew == 1, "th:few1")
        assert(b.qzFew == 2, "th:few2")
        let fsum = a.qzFew
        fsum += b.qzFew
        assert(fsum == 3, "th:few34")

        // qzMany: read sites 1..6
        assert(a.qzMany == 10, "th:many1")
        assert(b.qzMany == 20, "th:many2")
        let msum = a.qzMany + b.qzMany
        assert(msum == 30, "th:many34")
        msum = msum - a.qzMany
        assert(msum == 20, "th:many5")
        msum = msum - b.qzMany
        assert(msum == 0, "th:many6")

        // two receivers reaching the same proc through the same call site
        assert(a.qzHi(3) == b.qzHi(3), "th:agree")
    }

    // --- the same method through three kinds of reference ----------------

    interface QzTriIface {
        qzTri(n: number): number
    }

    class QzTriImpl implements QzTriIface {
        base: number
        constructor(base: number) {
            this.base = base
        }
        qzTri(n: number): number {
            return this.base + n
        }
    }

    function testThreeRefs() {
        msg("three refs")

        const concrete = new QzTriImpl(100)
        const iface: QzTriIface = concrete
        const dyn: any = concrete

        // concrete (static vtable call), interface (dynamic) and any (dynamic)
        assert(concrete.qzTri(1) == 101, "tri:concrete")
        assert(iface.qzTri(1) == 101, "tri:iface")
        assert(dyn.qzTri(1) == 101, "tri:any")
        assert(concrete.qzTri(2) == iface.qzTri(2), "tri:same1")
        assert("" + iface.qzTri(3) == "" + dyn.qzTri(3), "tri:same2")
    }

    // --- optional and defaulted parameters through an interface ----------
    //
    // The emitter fills in a defaulted argument at the call site from the
    // statically known signature. Through an interface- or any-typed
    // reference there is no such signature, so an omitted argument arrives as
    // undefined and the callee's own default does not apply. What must hold
    // is that the interface and any paths agree with each other, and that a
    // callee written to test for undefined works on every path.

    interface QzOptIface {
        qzOpt(a: number, b?: number): number
        qzOptSafe(a: number, b?: number): number
    }

    class QzOptImpl implements QzOptIface {
        qzOpt(a: number, b = 5): number {
            return a + b
        }
        qzOptSafe(a: number, b?: number): number {
            if (b === undefined) b = 5
            return a + b
        }
    }

    function testDefaults() {
        msg("defaults")

        const impl = new QzOptImpl()
        const iface: QzOptIface = impl
        const dyn: any = impl

        // a concrete call gets the default filled in at the call site
        assert(impl.qzOpt(1) == 6, "opt:concrete")

        // explicit arguments behave the same on every path
        assert(impl.qzOpt(1, 2) == 3, "opt:concrete2")
        assert(iface.qzOpt(1, 2) == 3, "opt:iface2")
        assert(dyn.qzOpt(1, 2) == 3, "opt:any2")

        // omitting the argument yields the same result on both dynamic paths
        assert(("" + iface.qzOpt(1)) == ("" + dyn.qzOpt(1)), "opt:dynagree")

        // a callee that defaults explicitly works everywhere
        assert(impl.qzOptSafe(1) == 6, "opt:safe1")
        assert(iface.qzOptSafe(1) == 6, "opt:safe2")
        assert(dyn.qzOptSafe(1) == 6, "opt:safe3")
        assert(iface.qzOptSafe(1, 2) == 3, "opt:safe4")
    }

    // --- one member name, two unrelated interfaces, different arities -----

    interface QzOneArg {
        qzShared(a: number): number
    }

    interface QzTwoArg {
        qzShared(a: number, b: number): number
    }

    class QzOneImpl implements QzOneArg {
        qzShared(a: number): number {
            return a + 1
        }
    }

    class QzTwoImpl implements QzTwoArg {
        qzShared(a: number, b: number): number {
            return a * b
        }
    }

    function testArityCollision() {
        msg("arity collision")

        const one: QzOneArg = new QzOneImpl()
        const two: QzTwoArg = new QzTwoImpl()

        assert(one.qzShared(1) == 2, "ar:one1")
        assert(one.qzShared(9) == 10, "ar:one2")
        assert(two.qzShared(3, 4) == 12, "ar:two1")
        assert(two.qzShared(5, 6) == 30, "ar:two2")

        // interleaved, so neither dispatch can be hoisted into the other
        let acc = 0
        for (let i = 1; i <= 3; i++) {
            acc += one.qzShared(i)
            acc += two.qzShared(i, i)
        }
        assert(acc == 23, "ar:mixed")
    }

    // --- one member name used as a property get and as a method ----------

    interface QzCollGet {
        qzColl: number
    }

    interface QzCollCall {
        qzColl(a: number, b: number): number
    }

    class QzCollField implements QzCollGet {
        qzColl: number
        constructor() {
            this.qzColl = 42
        }
    }

    class QzCollMethod implements QzCollCall {
        qzColl(a: number, b: number): number {
            return a * b
        }
    }

    function testGetCallCollision() {
        msg("get/call collision")

        const g: QzCollGet = new QzCollField()
        const c: QzCollCall = new QzCollMethod()

        assert(g.qzColl == 42, "gc:get1")
        assert(c.qzColl(6, 7) == 42, "gc:call1")
        assert(g.qzColl == c.qzColl(2, 21), "gc:agree")

        const ga: any = g
        const ca: any = c
        assert(ga.qzColl == 42, "gc:get2")
        assert(ca.qzColl(3, 14) == 42, "gc:call2")
        assert(typeof ca.qzColl == "function", "gc:type")
    }

    // --- a method that is both interface-dispatched and used as a value ---

    interface QzTakeIface {
        qzTake(n: number): number
    }

    class QzTaker implements QzTakeIface {
        mul: number
        constructor(mul: number) {
            this.mul = mul
        }
        qzTake(n: number): number {
            return n * this.mul
        }
    }

    function testMethodAsValue() {
        msg("method as value")

        const t = new QzTaker(3)
        const iface: QzTakeIface = t

        // A bare method reference is not a value in this language; wrapping it
        // in a lambda is the supported form.
        const f = (n: number) => t.qzTake(n)
        const g = (n: number) => iface.qzTake(n)

        assert(f(2) == 6, "mv:lambda")
        assert(g(2) == 6, "mv:ifacelambda")
        assert(iface.qzTake(2) == 6, "mv:direct")

        // the same proc reached through a higher order call
        function apply(fn: (n: number) => number, n: number): number {
            return fn(n)
        }
        assert(apply(f, 4) == 12, "mv:apply1")
        assert(apply(g, 4) == 12, "mv:apply2")
        assert(apply(n => iface.qzTake(n), 5) == 15, "mv:apply3")
    }

    // --- polymorphic sites: class instances and object literals -----------

    interface QzValIface {
        qzVal(): number
    }

    class QzValClass implements QzValIface {
        n: number
        constructor(n: number) {
            this.n = n
        }
        qzVal(): number {
            return this.n
        }
    }

    function useQzVal(v: QzValIface): number {
        return v.qzVal() + 1
    }

    function testPolymorphic() {
        msg("polymorphic");

        // the same call site sees a class instance and an object literal
        assert(useQzVal(new QzValClass(1)) == 2, "poly:class")
        assert(useQzVal({ qzVal: () => 5 }) == 6, "poly:literal")

        const mixed: QzValIface[] = [
            new QzValClass(1),
            { qzVal: () => 2 },
            new QzValClass(3),
            { qzVal: () => 4 }
        ]
        const expected = [2, 3, 4, 5]
        for (let i = 0; i < mixed.length; i++)
            assert(useQzVal(mixed[i]) == expected[i], "poly:elem" + i)

        let total = 0
        for (const m of mixed) total += m.qzVal()
        assert(total == 10, "poly:total")
    }

    // --- toString override -----------------------------------------------

    interface QzNamed {
        toString(): string
    }

    class QzLabel implements QzNamed {
        id: number
        constructor(id: number) {
            this.id = id
        }
        toString(): string {
            return "L" + this.id
        }
    }

    function testToString() {
        msg("toString")

        const l = new QzLabel(7)
        assert("" + l == "L7", "ts:concat")
        assert(`${l}` == "L7", "ts:template")
        assert(l.toString() == "L7", "ts:direct")

        const named: QzNamed = l
        assert(named.toString() == "L7", "ts:iface")

        const dyn: any = l
        assert(dyn.toString() == "L7", "ts:any")
        assert("" + dyn == "L7", "ts:anyconcat")

        // in a condition, so the override result feeds a truth test
        assert(!!("" + l), "ts:truthy")
        assert(("" + l).length == 2, "ts:len")
    }

    // --- stores through every dynamic path --------------------------------

    interface QzRec {
        // qzRare is never present in the initializer, so its only stores are
        // the two explicit ones below
        qzRare?: number
        qzHot: number
    }

    interface QzPropOnly {
        qzProp: number
    }

    class QzPropClass implements QzPropOnly {
        qzProp: number
        constructor() {
            this.qzProp = 0
        }
    }

    class QzAccClass {
        _v: number
        constructor() {
            this._v = 0
        }
        get qzAcc(): number {
            return this._v + 1
        }
        set qzAcc(v: number) {
            this._v = v * 2
        }
    }

    interface QzAccIface {
        qzAcc: number
    }

    class QzBase {
        qzInherited: number
        constructor() {
            this.qzInherited = 1
        }
        qzSuper(n: number): number {
            return n + 1
        }
    }

    class QzDerived extends QzBase {
        constructor() {
            super()
        }
        qzSuper(n: number): number {
            return super.qzSuper(n) * 10
        }
    }

    interface QzInheritedIface {
        qzInherited: number
        qzSuper(n: number): number
    }

    function testStores() {
        msg("stores")

        // Object literal STORE sites (the count the store specialization
        // gates on): qzRare at 2 (below the gate of 3), qzHot at 4 store
        // sites plus 2 initializers (above it). Reads of both keys also occur
        // below but do not feed the store count.
        const r1: QzRec = { qzHot: 0 }
        const r2: QzRec = { qzHot: 0 }
        r1.qzRare = 1
        r2.qzRare = 2
        r1.qzHot = 10
        r2.qzHot = 20
        r1.qzHot = r1.qzHot + 1
        r2.qzHot = r2.qzHot + 1
        assert(r1.qzRare == 1 && r2.qzRare == 2, "st:rare")
        assert(r1.qzHot == 11 && r2.qzHot == 21, "st:hot")

        // store through an interface that only declares a property signature
        const p: QzPropOnly = new QzPropClass()
        p.qzProp = 5
        assert(p.qzProp == 5, "st:prop:class")
        const pl: QzPropOnly = { qzProp: 0 }
        pl.qzProp = 6
        assert(pl.qzProp == 6, "st:prop:literal")

        // accessor get/set reached through an interface-typed reference
        const acc = new QzAccClass()
        const ai: QzAccIface = acc
        ai.qzAcc = 4
        assert(acc._v == 8, "st:acc:set")
        assert(ai.qzAcc == 9, "st:acc:get")
        ai.qzAcc = ai.qzAcc + 1
        assert(acc._v == 20, "st:acc:rmw")

        // a growing map: every key is built at run time
        const grow: any = {}
        for (let i = 0; i < 40; i++) grow["qzk" + i] = i * 3
        assert(grow["qzk0"] == 0, "st:grow0")
        assert(grow["qzk7"] == 21, "st:grow7")
        assert(grow["qzk39"] == 117, "st:grow39")
        assert(grow["qzk" + (20 + 1)] == 63, "st:grow21")
        let gsum = 0
        for (let i = 0; i < 40; i++) gsum += grow["qzk" + i]
        assert(gsum == 2340, "st:growsum")

        // typed string index signature over a plain object literal
        const tbl: { [k: string]: number } = {}
        tbl["a"] = 1
        tbl["b"] = 2
        tbl["a"] = tbl["a"] + 10
        assert(tbl["a"] == 11 && tbl["b"] == 2, "st:idx:literal")

        // the same index-signature type pointing at a class instance: a store
        // of a declared field must reach the field, not trap
        const inst = new QzPropClass()
        const asIdx = inst as any as { [k: string]: number }
        asIdx["qzProp"] = 12
        assert(inst.qzProp == 12, "st:idx:class:set")
        assert(asIdx["qzProp"] == 12, "st:idx:class:get")
        asIdx["qzProp"] = asIdx["qzProp"] + 1
        assert(inst.qzProp == 13, "st:idx:class:rmw")

        // inherited field, through the subclass and through an interface
        const d = new QzDerived()
        assert(d.qzInherited == 1, "st:inh:init")
        d.qzInherited = 3
        assert(d.qzInherited == 3, "st:inh:set")
        const ii: QzInheritedIface = d
        ii.qzInherited = 4
        assert(d.qzInherited == 4, "st:inh:ifaceset")
        assert(ii.qzInherited == 4, "st:inh:ifaceget")

        // super call, direct and interface-dispatched
        assert(d.qzSuper(1) == 20, "st:super:direct")
        assert(ii.qzSuper(1) == 20, "st:super:iface")

        // class field store through a plain concrete reference, for contrast
        const base = new QzBase()
        base.qzInherited = 9
        assert(base.qzInherited == 9, "st:base")
        assert(base.qzSuper(1) == 2, "st:base:call")
    }

    // --- dynamic member get on an any-typed variable -----------------------

    function testDynamicGet() {
        msg("dynamic get")

        const o: any = { qzDyn: 5, qzOther: "s" }
        const key = "qz" + "Dyn"

        assert(o.qzDyn == 5, "dg:dot")
        assert(o["qzDyn"] == 5, "dg:literal")
        assert(o[key] == 5, "dg:computed")
        assert(o["qzMissing"] === undefined, "dg:missing")
        assert(o.qzOther == "s", "dg:other")

        // the same object reached as a class instance
        const inst: any = new QzThing(1, 2)
        // qzMany rather than qzFew: qzFew's read-site count is deliberately
        // held below its threshold by the block in testThresholds
        assert(inst.qzMany == 2, "dg:inst1")
        assert(inst["qzMany"] == 2, "dg:inst2")
        assert(inst["qz" + "Many"] == 2, "dg:inst3")
        assert(inst.qzHi(1) == 3, "dg:instcall")
    }

    export function run() {
        msg("iface dispatch")
        testThresholds()
        testThreeRefs()
        testDefaults()
        testArityCollision()
        testGetCallCollision()
        testMethodAsValue()
        testPolymorphic()
        testToString()
        testStores()
        testDynamicGet()
        msg("iface dispatch done")
    }
}

IfaceDispatch.run()
