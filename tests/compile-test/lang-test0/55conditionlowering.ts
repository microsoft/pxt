// Structural semantics of condition lowering: evaluation order and counts for
// &&/||/!, the difference between condition position and value position, every
// syntactic construct that takes a condition, comparisons feeding logical
// operators, freshly allocated operands re-evaluated in loop headers, and
// exceptions raised part way through a condition.

namespace CondLower {
    let lg = ""

    function reset() {
        lg = ""
    }

    // Each operand records that it ran, then yields the requested truth value,
    // so `lg` is the exact left-to-right evaluation trace of a condition.
    function A(r: boolean): boolean {
        lg += "A"
        return r
    }

    function B(r: boolean): boolean {
        lg += "B"
        return r
    }

    function C(r: boolean): boolean {
        lg += "C"
        return r
    }

    function D(r: boolean): boolean {
        lg += "D"
        return r
    }

    // --- short-circuit order and operand counts -------------------------

    function testShortCircuit() {
        msg("short circuit")

        // && stops at the first falsy operand
        reset()
        let r = A(true) && B(false)
        assert(lg == "AB", "sc:and:both")
        assert(r === false, "sc:and:bothv")

        reset()
        r = A(false) && B(true)
        assert(lg == "A", "sc:and:short")
        assert(r === false, "sc:and:shortv")

        // || stops at the first truthy operand
        reset()
        r = A(true) || B(true)
        assert(lg == "A", "sc:or:short")
        assert(r === true, "sc:or:shortv")

        reset()
        r = A(false) || B(true)
        assert(lg == "AB", "sc:or:both")
        assert(r === true, "sc:or:bothv")

        // nested group: the right operand of && is itself a ||
        reset()
        let hit = false
        if (A(true) && (B(false) || C(true))) hit = true
        assert(lg == "ABC", "sc:group1")
        assert(hit, "sc:group1v")

        reset()
        hit = false
        if (A(false) && (B(true) || C(true))) hit = true
        assert(lg == "A", "sc:group2")
        assert(!hit, "sc:group2v")

        reset()
        hit = false
        if (A(true) && (B(true) || C(true))) hit = true
        assert(lg == "AB", "sc:group3")
        assert(hit, "sc:group3v")

        // negation wrapped around a short-circuit chain
        reset()
        r = !(A(true) && !B(true))
        assert(lg == "AB", "sc:notand1")
        assert(r === true, "sc:notand1v")

        reset()
        r = !(A(true) && !B(false))
        assert(lg == "AB", "sc:notand2")
        assert(r === false, "sc:notand2v")

        reset()
        r = !(A(false) && !B(true))
        assert(lg == "A", "sc:notand3")
        assert(r === true, "sc:notand3v")

        // chains of three and four operands
        reset()
        hit = false
        if (A(true) && B(true) && C(false)) hit = true
        assert(lg == "ABC", "sc:and3")
        assert(!hit, "sc:and3v")

        reset()
        hit = false
        if (A(true) && B(false) && C(true)) hit = true
        assert(lg == "AB", "sc:and3short")

        reset()
        hit = false
        if (A(true) || B(true) || C(true)) hit = true
        assert(lg == "A", "sc:or3short")
        assert(hit, "sc:or3shortv")

        reset()
        hit = false
        if (A(false) || B(false) || C(true)) hit = true
        assert(lg == "ABC", "sc:or3")
        assert(hit, "sc:or3v")

        reset()
        hit = false
        if (A(true) && B(true) && C(true) && D(false)) hit = true
        assert(lg == "ABCD", "sc:and4")
        assert(!hit, "sc:and4v")

        // mixed precedence: && binds tighter than ||
        reset()
        hit = false
        if (A(false) && B(true) || C(true)) hit = true
        assert(lg == "AC", "sc:mixed1")
        assert(hit, "sc:mixed1v")

        reset()
        hit = false
        if (A(true) && B(true) || C(true)) hit = true
        assert(lg == "AB", "sc:mixed2")
        assert(hit, "sc:mixed2v")
    }

    // --- value position vs condition position ---------------------------

    function testValuePosition() {
        msg("value position")

        // In value position || yields the operand itself, not a 0/1 truth.
        const fb = "f" + "b"
        const empty = "" + ""
        let s: string = empty || fb
        assert(s == "fb", "vp:orstr")
        s = fb || "other"
        assert(s == "fb", "vp:orstr2")

        let calls = 0
        function f(): number {
            calls++
            return 7
        }

        // && in value position yields the falsy left operand, right not run
        const z = 0
        let n: number = z && f()
        assert(n === 0, "vp:andnum")
        assert(calls == 0, "vp:andnocall")

        // and the right operand when the left is truthy
        const five = 5
        n = five && f()
        assert(n == 7, "vp:andnum2")
        assert(calls == 1, "vp:andcall")

        const nine = 9
        n = five || nine
        assert(n == 5, "vp:ornum")

        // ! always yields a real boolean, comparable strictly
        let b = !empty
        assert(b === true, "vp:bangempty")
        b = !fb
        assert(b === false, "vp:bangstr")
        assert(!!fb === true, "vp:bangbang")
        assert(typeof !fb == "boolean", "vp:bangtype")

        // a boolean stored, passed through a call, then used as a condition:
        // this round-trips the raw 0/1 form back to a tagged boolean
        function takes(v: boolean): boolean {
            return v
        }
        const stored = !empty
        const returned = takes(stored)
        assert(returned === true, "vp:rt1")
        let hit = 0
        if (returned) hit++
        if (takes(!fb)) hit += 10
        assert(hit == 1, "vp:rt2")

        // the same value observed as an any
        const anyb: any = returned
        assert(anyb === true, "vp:rtany")
        assert(!!anyb === true, "vp:rtanybang")
    }

    // --- every construct that takes a condition -------------------------

    function classify(n: number): string {
        if (n < 0) return "neg"
        else if (n == 0) return "zero"
        else if (n < 10) return "small"
        else return "big"
    }

    function testConstructs() {
        msg("condition constructs")

        assert(classify(-3) == "neg", "cc:if1")
        assert(classify(0) == "zero", "cc:if2")
        assert(classify(5) == "small", "cc:if3")
        assert(classify(50) == "big", "cc:if4")

        // while
        let i = 0
        let acc = 0
        while (i < 5 && acc < 100) {
            acc += i
            i++
        }
        assert(i == 5 && acc == 10, "cc:while")

        // do..while, body always runs once
        let j = 100
        let runs = 0
        do {
            runs++
        } while (j < 5)
        assert(runs == 1, "cc:dowhile")

        j = 0
        runs = 0
        do {
            runs++
            j++
        } while (j < 4 || runs < 2)
        assert(j == 4 && runs == 4, "cc:dowhile2")

        // for with a compound header condition
        let k = 0
        let sum2 = 0
        for (k = 0; k < 10 && sum2 < 12; k++) sum2 += k
        assert(k == 6 && sum2 == 15, "cc:for")

        // nested ternaries
        function grade(n: number): string {
            return n > 90 ? "a" : n > 80 ? "b" : n > 70 ? "c" : "f"
        }
        assert(grade(95) == "a", "cc:tern1")
        assert(grade(85) == "b", "cc:tern2")
        assert(grade(75) == "c", "cc:tern3")
        assert(grade(5) == "f", "cc:tern4")

        // ternary whose branches are themselves conditions
        const t = (1 < 2) ? (3 > 4) : (5 > 6)
        assert(t === false, "cc:tern5")
    }

    // --- comparisons feeding logical operators --------------------------

    function testComparisons() {
        msg("comparisons")

        const a = 1
        const b = 2
        const c = 4
        const d = 3

        assert((a < b && c > d) === true, "cmp:1")
        assert((a > b && c > d) === false, "cmp:2")
        assert((a > b || c > d) === true, "cmp:3")
        assert((a > b || c < d) === false, "cmp:4")

        const x = "x" + "y"
        const y = "xy"
        const p: number = 1
        const q: number = 2
        assert((x == y || p != q) === true, "cmp:5")
        assert((x != y && p == q) === false, "cmp:6")

        // string relational comparisons inside a chain
        const s1 = "a" + ""
        const s2 = "b" + ""
        assert((s1 < s2 && s2 > s1) === true, "cmp:str1")
        assert((s1 > s2 || s1 == s2) === false, "cmp:str2")
        assert((s1 <= s1 && s2 >= s2) === true, "cmp:str3")
        assert((s1 < s2 && s1.length > 0 && s2 != "") === true, "cmp:str4")

        // comparison result stored and re-tested
        const cmp = s1 < s2
        assert(cmp === true, "cmp:store")
        let hit = 0
        if (cmp && a < b) hit++
        assert(hit == 1, "cmp:retest")

        // arr.length directly as a condition and inside chains
        const empty: number[] = []
        const full = [1, 2, 3]
        assert(!empty.length, "cmp:len0")
        assert(!!full.length, "cmp:len1")
        let lh = 0
        if (empty.length) lh += 100
        if (full.length) lh += 1
        if (full.length && !empty.length) lh += 10
        if (empty.length || full.length) lh += 1000
        assert(lh == 1011, "cmp:lenchain")
    }

    // --- freshly allocated operands re-evaluated in loop headers ---------
    //
    // Each iteration allocates the value the condition tests, so an
    // imbalanced reference count on the condition path shows up as a GC
    // failure or a wrong final state rather than as a wrong first iteration.

    function testFreshOperands() {
        msg("fresh operands");

        let s = "x"
        let i = 0
        while ((s + i).length < 8) {
            i++
            s = s + "y"
        }
        assert(s.length == 7, "fresh:concat")
        assert(i == 6, "fresh:concatn")

        // array literal built in the loop header
        let n = 0
        while ([n, n + 1].length > 0 && n < 200) n++
        assert(n == 200, "fresh:arrlit")

        // slices built in the header and in the body
        const base = [1, 2, 3, 4, 5]
        let k = 0
        let seen = 0
        while (base.slice(0, (k % 5) + 1).length > 0 && k < 300) {
            seen += base.slice(k % 5).length
            k++
        }
        assert(k == 300, "fresh:slicek")
        assert(seen == 900, "fresh:slicelen")

        // fresh object in a condition, in both operand positions of ||
        let m = 0
        while (({ v: m }).v < 150 || m < 0) m++
        assert(m == 150, "fresh:obj")

        // fresh string compared in a do..while
        let c = 0
        do {
            c++
        } while (("s" + c) != "s50")
        assert(c == 50, "fresh:strcmp")

        // ternary over a freshly built array, repeated
        let tsum = 0
        for (let q = 0; q < 200; q++) tsum += [q].length ? 1 : 0
        assert(tsum == 200, "fresh:tern")
    }

    // --- exceptions raised part way through a condition -----------------

    function testExceptionsInConditions() {
        msg("exceptions in conditions")

        function t(): boolean {
            lg += "t"
            return false
        }

        function boom(): boolean {
            lg += "!"
            throw "boom"
        }

        // throw from the right operand of || (left already evaluated)
        reset()
        let caught = ""
        try {
            if (t() || boom()) lg += "?"
            lg += "after"
        } catch (e) {
            caught = e
            lg += "c"
        }
        assert(lg == "t!c", "exn:right " + lg)
        assert(caught == "boom", "exn:rightval")

        // throw from the left operand: the right operand must never run
        reset()
        caught = ""
        try {
            if (boom() || t()) lg += "?"
        } catch (e) {
            caught = e
            lg += "c"
        }
        assert(lg == "!c", "exn:left " + lg)
        assert(caught == "boom", "exn:leftval")

        // throw from the right operand of &&
        reset()
        try {
            if (A(true) && boom()) lg += "?"
        } catch (e) {
            lg += "c"
        }
        assert(lg == "A!c", "exn:and " + lg)

        // && short-circuits before the throwing operand, so nothing is caught
        reset()
        let ok = false
        try {
            if (A(false) && boom()) lg += "?"
            ok = true
        } catch (e) {
            lg += "c"
        }
        assert(lg == "A", "exn:andshort " + lg)
        assert(ok, "exn:andshortok")

        // conditions still behave after the stack has been unwound
        reset()
        let hit = 0
        if (A(true) && B(true)) hit++
        if (A(false) || B(true)) hit += 10
        assert(hit == 11, "exn:after")
        assert(lg == "ABAB", "exn:afterlog " + lg)

        // throw from inside a loop header condition
        let iters = 0
        caught = ""
        try {
            while (iters < 10) {
                iters++
                if (iters > 3 && boom()) iters += 100
            }
        } catch (e) {
            caught = e
        }
        assert(iters == 4, "exn:loop")
        assert(caught == "boom", "exn:loopval")
    }

    // --- switch over computed scrutinees --------------------------------

    function testSwitch() {
        msg("switch")

        function pick(s: string): number {
            switch (s) {
                case "a" + "":
                case "b":
                    return 12
                case "c":
                    return 3
                default:
                    return 0
            }
        }
        assert(pick("a") == 12, "sw:s1")
        assert(pick("b") == 12, "sw:s2")
        assert(pick("c") == 3, "sw:s3")
        assert(pick("z") == 0, "sw:s4")

        // fallthrough that accumulates rather than returning
        function acc(n: number): string {
            let r = ""
            switch (n) {
                case 0:
                    r += "0"
                case 1:
                    r += "1"
                    break
                case 2:
                    r += "2"
                default:
                    r += "d"
            }
            return r
        }
        assert(acc(0) == "01", "sw:n0")
        assert(acc(1) == "1", "sw:n1")
        assert(acc(2) == "2d", "sw:n2")
        assert(acc(9) == "d", "sw:n3")

        // computed scrutinee, so the switch cannot be resolved statically
        let base = 0
        function bump(): number {
            base += 2
            return base
        }
        assert(acc(bump() - 2) == "01", "sw:c0")
        assert(acc(bump() - 3) == "1", "sw:c1")

        // switch whose scrutinee is a condition result
        function fromBool(b: boolean): string {
            switch (b ? "y" : "n") {
                case "y": return "yes"
                default: return "no"
            }
        }
        const s1 = "a" + ""
        assert(fromBool(!!s1) == "yes", "sw:b1")
        assert(fromBool(!s1) == "no", "sw:b2")
    }

    export function run() {
        msg("condition lowering")
        testShortCircuit()
        testValuePosition()
        testConstructs()
        testComparisons()
        testFreshOperands()
        testExceptionsInConditions()
        testSwitch()
        msg("condition lowering done")
    }
}

CondLower.run()
