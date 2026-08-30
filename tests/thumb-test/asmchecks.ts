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
// The *baseline cases pin how the compiler in this tree lowers specific
// constructs, partly by asserting which specialized helpers are ABSENT from
// the listing. They are the reference half of a differential pair: work that
// specializes those constructs flips or extends these expectations alongside
// its codegen change, and a mismatch in either direction is the signal (the
// specialization silently stopped firing, or it appeared where it was not
// expected). The helper names and label patterns asserted absent here are
// therefore a naming contract with that work -- renaming an emitted helper or
// thunk label means updating the patterns below in the same change.

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
