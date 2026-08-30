// Truthiness matrix for every construct that lowers to a condition test.
//
// The falsy set here is exactly the set numops::toBool treats as false:
// false, 0 (any representation, including -0 and a boxed double zero), null,
// undefined, NaN and "". Everything else is truthy, including "0", " ",
// "false", [], {} and function values.
//
// Every value reaches its condition through an any-typed identity call so the
// test site sees an opaque operand and cannot be folded at compile time.

namespace CondTruth {
    function opaque(v: any): any {
        return v
    }

    function opaqueStr(v: string): string {
        return v
    }

    function opaqueNum(v: number): number {
        return v
    }

    function opaqueArr(v: number[]): number[] {
        return v
    }

    class TCase {
        v: any
        t: boolean
        id: string
        constructor(v: any, t: boolean, id: string) {
            this.v = v
            this.t = t
            this.id = id
        }
    }

    // Pushes one value through every construct that lowers to a condition.
    function check(c: TCase) {
        const v = opaque(c.v)
        const want = c.t

        // plain `if` condition
        let hit = false
        if (v) hit = true
        assert(hit == want, "if:" + c.id)

        // `if (!v)` -- the negated condition, which lowers to the inverted jump
        let nhit = false
        if (!v) nhit = true
        assert(nhit == !want, "ifnot:" + c.id)

        // else branch of the same test must be the complement
        let branch = 0
        if (v) branch = 1
        else branch = 2
        assert(branch == (want ? 1 : 2), "ifelse:" + c.id)

        // conditional expression
        const t = v ? 11 : 22
        assert(t == (want ? 11 : 22), "ternary:" + c.id)

        // `while` header, body entered at most once
        let iter = 0
        while (v) {
            iter++
            break
        }
        assert(iter == (want ? 1 : 0), "while:" + c.id)

        // `do..while` runs the body once and only then tests the condition
        let dit = 0
        do {
            dit++
        } while (v && dit < 2)
        assert(dit == (want ? 2 : 1), "dowhile:" + c.id)

        // `for` header condition
        let fit = 0
        for (; v;) {
            fit++
            break
        }
        assert(fit == (want ? 1 : 0), "for:" + c.id)

        // condition-position && : truth of the pair, never the operand value
        let andHit = false
        if (v && true) andHit = true
        assert(andHit == want, "and1:" + c.id)
        let andZero = false
        if (v && false) andZero = true
        assert(andZero == false, "and0:" + c.id)

        // condition-position ||
        let orHit = false
        if (v || false) orHit = true
        assert(orHit == want, "or0:" + c.id)
        let orOne = false
        if (v || true) orOne = true
        assert(orOne == true, "or1:" + c.id)

        // double negation must yield a real tagged boolean, comparable strictly
        const b = !!v
        assert(b === want, "bangbang:" + c.id)
        assert(typeof b == "boolean", "bangbangtype:" + c.id)

        // single negation is also a real boolean
        const nb = !v
        assert(nb === !want, "bang:" + c.id)
    }

    export function run() {
        msg("condition truthiness")

        const zero = opaqueNum(0)
        const one = opaqueNum(1)

        const cases: TCase[] = []
        function add(v: any, t: boolean, id: string) {
            cases.push(new TCase(v, t, id))
        }

        // --- falsy ---
        add(false, false, "false")
        add(zero, false, "zero")
        add(zero * -1, false, "negzero")
        add(null, false, "null")
        add(undefined, false, "undefined")
        add(zero / zero, false, "nan")
        add(opaqueStr(""), false, "emptystr")

        // --- truthy ---
        add(true, true, "true")
        add(one, true, "one")
        add(zero - one, true, "minusone")
        // forced past the tagged-int range, so the value is a boxed double
        add(0x20000000 * (one + one), true, "bigint")
        add(opaqueStr("0"), true, "str0")
        add(opaqueStr(" "), true, "space")
        add(opaqueStr("false"), true, "strfalse")
        add(opaqueStr("00"), true, "str00")
        add([], true, "emptyarr")
        add([zero], true, "zeroarr")
        add({}, true, "emptyobj")
        add({ a: zero }, true, "obj")
        add(() => zero, true, "fn")

        // Doubles only exist on floating-point targets; a boxed zero and a
        // fractional nonzero both go through the boxed side of the falsy test.
        if (hasFloat) {
            const big = opaqueNum(1e18)
            add(big - big, false, "boxedzero")
            add(opaqueNum(0.5) - opaqueNum(0.25), true, "fraction")
            add(opaqueNum(-0.5), true, "negfraction")
        }

        for (const c of cases) check(c)

        assert(cases.length == (hasFloat ? 23 : 20), "casecount")

        // The same values reaching a condition through a non-any local, so the
        // condition sees a statically typed operand rather than a boxed any.
        const es = opaqueStr("")
        assert(!es, "typed:emptystr")
        const ns = opaqueStr("x")
        assert(!!ns, "typed:str")
        const nz = opaqueNum(0)
        assert(!nz, "typed:zero")
        const nn = opaqueNum(3)
        assert(!!nn, "typed:num")
        const na = opaqueArr(null)
        assert(!na, "typed:nullarr")
        const ea = opaqueArr([])
        assert(!!ea, "typed:emptyarr")

        // A boolean-typed local is already 0/1 in the lowered form; it must
        // still compare strictly and survive a round trip through a call.
        function passBool(b: boolean): boolean {
            return b
        }
        const bt = passBool(!!ns)
        const bf = passBool(!!es)
        assert(bt === true, "roundtrip:true")
        assert(bf === false, "roundtrip:false")
        let rhit = 0
        if (bt) rhit++
        if (bf) rhit += 10
        assert(rhit == 1, "roundtrip:cond")

        msg("condition truthiness done")
    }
}

CondTruth.run()
