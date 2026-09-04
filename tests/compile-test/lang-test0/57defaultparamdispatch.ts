// Reproduces a known defect: default parameter values are not applied when a
// method is invoked through dynamic (interface or any-typed) dispatch.
//
// Mechanism: a statically resolved call site fills omitted arguments with the
// declared defaults, because the compiler can see the declaration. A dynamic
// call site pushes only the arguments written at the call, and the arity
// wrapper on the callee fills the missing slots with `undefined` -- the
// parameter initializer (`b = 5` below) never runs. The method then computes
// 1 + undefined = NaN.
//
// The assertions that fail today are commented out (block marked REPRO) so
// the suite stays green. To reproduce: uncomment that block and run
// `gulp testlang` -- qzdp:iface and qzdp:any fail with the calls yielding
// NaN instead of 6. A fix for the defect makes the REPRO block pass; it can
// then be uncommented permanently and the qzdp:agree assertion below retired.
//
// 56ifacedispatch.ts documents the same constraint where it affects the
// dispatch corpus; this file is the minimal standalone repro.

interface DfShape {
    dfOpt(a: number, b?: number): number;
}

class DfThing implements DfShape {
    constructor() { }
    dfOpt(a: number, b = 5): number {
        return a + b;
    }
}

function testDefaultParamDispatch() {
    msg("default params through dynamic dispatch");

    const direct = new DfThing();
    const viaIface: DfShape = direct;
    const viaAny: any = direct;

    // Statically resolved call: the compiler applies the default. Passes.
    assert(direct.dfOpt(1) == 6, "qzdp:direct");

    // Passing the argument explicitly works on every path.
    assert(direct.dfOpt(1, 2) == 3, "qzdp:direct2");
    assert(viaIface.dfOpt(1, 2) == 3, "qzdp:iface2");
    assert(viaAny.dfOpt(1, 2) == 3, "qzdp:any2");

    // REPRO -- uncomment these two lines to surface the defect:
    // assert(viaIface.dfOpt(1) == 6, "qzdp:iface");
    // assert(viaAny.dfOpt(1) == 6, "qzdp:any");

    // Kept active so any CHANGE in the current behavior is noticed: the two
    // dynamic paths must at least agree with each other. Compared as strings
    // so this holds both before a fix (NaN == NaN fails as numbers) and
    // after one.
    assert("" + viaIface.dfOpt(1) == "" + viaAny.dfOpt(1), "qzdp:agree");
}

testDefaultParamDispatch();
