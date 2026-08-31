/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as chai from "chai";

/**
 * Expectations over the ARM Thumb assembly listing produced for each case
 * program in tests/thumb-test/cases.
 *
 * A case file named <name>.ts is checked by the entry keyed "<name>.ts" in
 * `asmChecks` below. A case with no entry fails, so that adding a program
 * without an expectation is not silently a no-op.
 */

export type AsmCheck = (asm: string, res: pxtc.CompileResult) => void;

// --- helpers -------------------------------------------------------------

/** True when `name` appears as a label definition, e.g. "_main___P1:". */
export function hasLabel(asm: string, name: string): boolean {
    return new RegExp("^\\s*" + escapeRegExp(name) + ":", "m").test(asm);
}

/** True when `name` appears anywhere in the listing as a whole token. */
export function mentions(asm: string, name: string): boolean {
    return new RegExp("(^|[^A-Za-z0-9_])" + escapeRegExp(name) + "([^A-Za-z0-9_]|$)").test(asm);
}

/** Number of matches of a global regex in the listing. */
export function countMatches(asm: string, re: RegExp): number {
    const g = re.global ? re : new RegExp(re.source, re.flags + "g");
    const m = asm.match(g);
    return m ? m.length : 0;
}

/**
 * Bytes of code generated for the program, from the size stats header that
 * target.switches.size adds to the listing. This excludes the fixed runtime
 * image, so it tracks codegen rather than the size of the hex template.
 */
export function codeSize(asm: string): number {
    const m = /^; generated code sizes \(bytes\): (\d+)/m.exec(asm);
    chai.assert(!!m, "no code size stats in listing (is target.switches.size set?)");
    return parseInt(m[1], 10);
}

/** Bytes of the emitted Intel hex text. */
export function hexSize(res: pxtc.CompileResult): number {
    const hex = res.outfiles[pxtc.BINARY_HEX];
    chai.assert(!!hex, "no " + pxtc.BINARY_HEX + " in compile result");
    return hex.length;
}

/** Fails if any of `names` occurs in the listing. */
export function assertAbsent(asm: string, names: string[]) {
    for (const n of names)
        chai.assert(!mentions(asm, n), "listing unexpectedly mentions " + n);
}

/** Fails if `re` matches the listing. */
export function assertNoMatch(asm: string, re: RegExp, what: string) {
    const n = countMatches(asm, re);
    chai.assert(n === 0, "listing unexpectedly contains " + n + " " + what);
}

/** Fails unless `re` matches the listing at least `min` times. */
export function assertAtLeast(asm: string, re: RegExp, min: number, what: string) {
    const n = countMatches(asm, re);
    chai.assert(n >= min, "expected at least " + min + " " + what + ", found " + n);
}

/** Fails unless `re` matches the listing at most `max` times. */
export function assertAtMost(asm: string, re: RegExp, max: number, what: string) {
    const n = countMatches(asm, re);
    chai.assert(n <= max, "expected at most " + max + " " + what + ", found " + n);
}

/**
 * Listing up to _code_end: the program's own code, without the appended
 * runtime helper text (whose bodies make their own C++ fallback calls).
 */
export function userCode(asm: string): string {
    const i = asm.search(/^_code_end:/m);
    chai.assert(i >= 0, "no _code_end marker in listing");
    return asm.substr(0, i);
}

/**
 * Fails unless `actual` is within `pct` percent of `expected`. Bands are wide
 * on purpose: they catch silent large regressions in either direction without
 * turning every codegen tweak into a test edit.
 */
export function assertWithin(actual: number, expected: number, pct: number, what: string) {
    const lo = Math.floor(expected * (1 - pct / 100));
    const hi = Math.ceil(expected * (1 + pct / 100));
    chai.assert(actual >= lo && actual <= hi,
        what + " is " + actual + ", outside the band " + lo + ".." + hi +
        " (baseline " + expected + ", +/-" + pct + "%)");
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- per-case expectations -----------------------------------------------
//
// The *baseline cases pin the emitted codegen in both directions: which
// helpers the listing must contain and which it must not. Where an opt-out
// compile switch exists, a `variantChecks` entry below compiles the same case
// with the switch set and pins the codegen it restores; a mismatch in either
// half is the signal. Helper and label names here are a naming contract with
// the codegen -- renaming an emitted label means updating these patterns in
// the same change.

export const asmChecks: pxt.Map<AsmCheck> = {

    "boolbaseline.ts": (asm) => {
        // Conditions are materialized as tagged values and narrowed by a call
        // into the runtime at each test site.
        assertAtLeast(asm, /bl numops::toBoolDecr/g, 12, "calls to numops::toBoolDecr");

        // Helpers introduced by boolean condition lowering. Absent here.
        assertAbsent(asm, [
            "_numops_toBool",
            "_numops_toBoolDecr",
            "_pxt_fromBool",
            "_pxt_boolean_bang",
        ]);

        // No index-signature store in this program, so the map-set fast path
        // must not be emitted (it is demand-driven).
        assertAbsent(asm, ["_pxt_map_set_by_string"]);
    },

    "ifacebaseline.ts": (asm) => {
        const code = userCode(asm);

        // Shared iface-call thunks. The case dispatches one getter and one
        // method through the same iface index often enough to clear the
        // per-(index, numargs, getset) threshold, so both buckets get a thunk
        // and every counted call site branches to one.
        assertAtLeast(asm, /^\s*\S*ifacecall\d+_\S*_i\d+\S*:/gm, 2,
            "interface call thunk definitions");
        assertAtLeast(code, /bl \S*ifacecall\d+_\S*_i\d+\S*/g, 10,
            "calls to an interface call thunk");

        // Object-literal stores of one repeated key collapse onto a per-field
        // helper, so the generic pxtrt::mapSet no longer appears at any store
        // site -- only inside the helper body, which lives past _code_end.
        assertAtLeast(asm, /^\s*\S*mapset_i\d+\S*:/gm, 1,
            "object-literal store helper definitions (mapset_i)");
        assertAtLeast(code, /bl \S*mapset_i\d+\S*/g, 4,
            "calls to an object-literal store helper");
        assertNoMatch(code, /bl pxtrt::mapSet\b/g, "inline generic pxtrt::mapSet calls");

        // Vtable wrapper-skip: the two `scale` implementations are reached
        // only through iface entries whose call sites all pass a full arg
        // list, so their iface table slots point at _iface (b _nochk).
        assertAtLeast(asm, /^\s*\S*_iface:/gm, 2, "_iface: proc labels");

        // Typed string index-signature stores go through the thumb fast path
        // instead of pxtrt::mapSetGeneric.
        chai.assert(hasLabel(asm, "_pxt_map_set_by_string"),
            "no _pxt_map_set_by_string helper in listing");
        assertAtLeast(code, /bl _pxt_map_set_by_string/g, 2,
            "calls to _pxt_map_set_by_string");
        assertNoMatch(code, /bl pxtrt::mapSetGeneric/g, "generic map store calls");

        // The program still reaches the generic map runtime for the paths that
        // are not specialized (reads, key lookup, and the helper bodies).
        assertAtLeast(asm, /bl pxtrt::(mapGet|mapSet|lookupMapKey)/g, 4,
            "generic map runtime calls");

        // Checked-field-load helpers do NOT fire on this case: every `.size`
        // read here has an interface-typed receiver, so it lowers to iface
        // dispatch rather than a checked FieldAccess. Pinned at zero so that a
        // change making those reads direct field loads shows up here.
        assertNoMatch(asm, /ldfldchk_/g, "checked-field-load helpers (ldfldchk_)");
    },

    "fieldbaseline.ts": (asm) => {
        // Checked field loads are emitted inline here: a call into the class's
        // validate helper immediately followed by the load. QzCell declares two
        // fields, so their offsets are fixed at #4 (qzTally) and #8 (qzSpare),
        // and the offset in the sequence is what tells the two apart. The
        // floors are the exact read-site counts in the case program -- 6 above
        // the count gate and 4 below it -- so a read that stops taking the
        // checked path fails here instead of quietly making the case vacuous.
        assertAtLeast(asm, /bl _inst_QzCell\S*_validate\S*\n\s*ldr r0, \[r0, #4\]/g, 6,
            "inline checked loads of qzTally");
        assertAtLeast(asm, /bl _inst_QzCell\S*_validate\S*\n\s*ldr r0, \[r0, #8\]/g, 4,
            "inline checked loads of qzSpare");

        // Count-gated checked-field-load specialization. Absent here: qzTally
        // is calibrated to sit above the gate, so a thunk of any kind means the
        // specialization started firing in this tree.
        assertNoMatch(asm, /ldfldchk_/g, "checked-field-load thunks (ldfldchk_)");
    },

    "sizebaseline.ts": (asm, res) => {
        chai.assert(hexSize(res) > 0, "empty hex output");
        // Baseline measured on this fixture; see assertWithin on why the band
        // is wide.
        assertWithin(codeSize(asm), 5592, 15, "generated code size");
    },
};

// --- switch variants -----------------------------------------------------

/**
 * A case compiled a second time with extra compile switches and checked
 * against different expectations -- the opt-out half of the differential
 * pair described above asmChecks.
 */
export interface VariantCheck {
    /** Case file in tests/thumb-test/cases. */
    caseFile: string;
    /** Merged over the case's normal switches. */
    switches: pxtc.CompileSwitches;
    /** Names the variant in the test title; keep it short. */
    label: string;
    check: AsmCheck;
}

export const variantChecks: VariantCheck[] = [

    {
        caseFile: "ifacebaseline.ts",
        switches: { noIfaceSpec: true },
        label: "noIfaceSpec",
        check: (asm) => {
            // The program does reach the generic interface/map runtime entries.
            assertAtLeast(asm, /bl pxtrt::(mapGet|mapSet|lookupMapKey)/g, 4,
                "generic map runtime calls");

            // Every object-literal store is an inline generic mapSet again,
            // rather than a call to a per-field helper.
            assertAtLeast(userCode(asm), /bl pxtrt::mapSet\b/g, 4,
                "inline generic pxtrt::mapSet calls");

            // Specializations introduced by interface dispatch specialization.
            // Absent here: every access goes through the generic runtime path,
            // and no unreferenced helper text is emitted.
            assertAbsent(asm, [
                "_pxt_map_set_by_string",
            ]);
            assertNoMatch(asm, /ldfldchk_/g, "checked-field-load thunks (ldfldchk_)");
            assertNoMatch(asm, /ifacecall\d+_.*_i\d+/g, "interface call thunks");
            assertNoMatch(asm, /mapset_i/g, "specialized map-store thunks (mapset_i)");
            assertNoMatch(asm, /^\s*\S*_iface:/gm, "_iface: proc labels");
        },
    },
];

// --- external case programs ----------------------------------------------

/**
 * Semantic case programs that live outside tests/thumb-test/cases. These are
 * lang-test0 files that the compile-test suite executes on the JS backend;
 * compiling them here proves the same source also survives the native emitter
 * and the thumb assembler, and makes them available as an on-device payload.
 *
 * Keys are paths relative to the repository root. The runner prepends the
 * lang-test0 prelude, which supplies assert() and msg().
 *
 * The expectations are deliberately light. These programs assert language
 * semantics rather than codegen shape, so the check here is only that the
 * emitter produced real code for them.
 */
export const externalCases: pxt.Map<AsmCheck> = {

    "tests/compile-test/lang-test0/54conditiontruthiness.ts": (asm) => {
        chai.assert(codeSize(asm) > 0, "no code generated");
    },

    "tests/compile-test/lang-test0/55conditionlowering.ts": (asm) => {
        chai.assert(codeSize(asm) > 0, "no code generated");
    },

    "tests/compile-test/lang-test0/56ifacedispatch.ts": (asm) => {
        chai.assert(codeSize(asm) > 0, "no code generated");
    },
};
