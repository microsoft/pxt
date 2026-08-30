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
        // Boolean condition lowering emits thumb fast paths for the boolean
        // conversion runtime calls.
        for (const helper of ["_numops_toBool", "_numops_toBoolDecr",
            "_pxt_fromBool", "_pxt_boolean_bang"])
            chai.assert(hasLabel(asm, helper), "no " + helper + " helper in listing");

        const code = userCode(asm);

        // Every condition site narrows through the fast path; nothing in the
        // program still calls the C++ entry point directly.
        assertAtLeast(code, /bl _numops_toBoolDecr/g, 8, "calls to _numops_toBoolDecr");
        assertNoMatch(code, /bl numops::toBoolDecr/g, "calls to numops::toBoolDecr");

        // `&&` / `||` in condition position short-circuit to a raw 0/1 instead
        // of building a tagged boolean. numops::toBool is only reached from
        // that boxed path, so neither entry point is called at all.
        assertNoMatch(code, /bl (numops::toBool|_numops_toBool)\b/g,
            "calls to a toBool entry point");

        // `!` in condition position is raw-in / raw-out, so its result is no
        // longer re-tagged. The one remaining fromBool is the single `!` this
        // case uses in value position (an argument), which must still box.
        assertAtLeast(code, /bl _pxt_boolean_bang/g, 5, "calls to _pxt_boolean_bang");
        assertAtMost(code, /bl (pxt::fromBool|_pxt_fromBool)\b/g, 1,
            "calls to a fromBool entry point");
    },

    "ifacebaseline.ts": (asm) => {
        // The program does reach the generic interface/map runtime entries.
        assertAtLeast(asm, /bl pxtrt::(mapGet|mapSet|lookupMapKey)/g, 4,
            "generic map runtime calls");

        // Specializations introduced by interface dispatch specialization.
        // Absent here: every access goes through the generic runtime path.
        assertAbsent(asm, [
            "_pxt_map_set_by_string",
        ]);
        assertNoMatch(asm, /ldfldchk_/g, "checked-field-load thunks (ldfldchk_)");
        assertNoMatch(asm, /ifacecall\d+_.*_i\d+/g, "interface call thunks");
        assertNoMatch(asm, /mapset_i/g, "specialized map-store thunks (mapset_i)");
        assertNoMatch(asm, /^\s*\S*_iface:/gm, "_iface: proc labels");
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
        caseFile: "boolbaseline.ts",
        switches: { noBoolLower: true },
        label: "noBoolLower",
        check: (asm) => {
            // Conditions are materialized as tagged values and narrowed by a
            // call into the runtime at each test site.
            assertAtLeast(asm, /bl numops::toBoolDecr/g, 12, "calls to numops::toBoolDecr");

            // The thumb fast paths are neither emitted nor called.
            assertAbsent(asm, [
                "_numops_toBool",
                "_numops_toBoolDecr",
                "_pxt_fromBool",
                "_pxt_boolean_bang",
            ]);
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
