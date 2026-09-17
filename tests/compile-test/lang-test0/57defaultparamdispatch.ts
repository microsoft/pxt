// Regression for #11562. Default initializers belong to the runtime callee,
// not the statically known call signature. Both omitted and explicit undefined
// arguments trigger defaults; other falsy values must survive unchanged.

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

    // Statically resolved calls still apply the default.
    assert(direct.dfOpt(1) == 6, "qzdp:direct");

    // Passing the argument explicitly works on every path.
    assert(direct.dfOpt(1, 2) == 3, "qzdp:direct2");
    assert(viaIface.dfOpt(1, 2) == 3, "qzdp:iface2");
    assert(viaAny.dfOpt(1, 2) == 3, "qzdp:any2");

    // Regression for #11562: dynamic calls must apply the implementation's default.
    assert(viaIface.dfOpt(1) == 6, "qzdp:iface");
    assert(viaAny.dfOpt(1) == 6, "qzdp:any");

    assert(direct.dfOpt(1, undefined) === 6, "qzdp:direct-undefined");
    assert(viaIface.dfOpt(1, undefined) === 6, "qzdp:iface-undefined");
    assert(viaAny.dfOpt(1, undefined) === 6, "qzdp:any-undefined");
    assert(viaIface.dfOpt(1, 0) === 1, "qzdp:zero");
    assert(viaIface.dfOpt(1, null) === 1, "qzdp:null");
}

namespace DefaultDispatch {
    class Base implements DfShape {
        dfOpt(a: number, b = 5): number { return a + b; }
    }
    class Derived extends Base {
        dfOpt(a: number, b = 9): number { return a + b; }
        fromSuper(): number { return super.dfOpt(1); }
    }
    class ParameterProperty {
        constructor(public value = 13) { }
    }
    class DerivedConstructor extends ParameterProperty {
        constructor(value = 17) { super(value); }
    }
    interface OptionalValues {
        value(n?: any): any;
        pair(a?: number, b?: number): number;
        capture(n?: number): () => number;
    }
    class Values implements OptionalValues {
        value(n: any = 11): any { return n; }
        pair(a = 2, b = 3): number { return a * 10 + b; }
        capture(n = 7): () => number { return () => ++n; }
    }
    function free(n = 19): number { return n; }
    function bool(n = true): boolean { return n; }
    function ref(n: number[] = null): number[] { return n; }
    function missing(n?: number): number { return n; }
    function immutableCapture(n = 29): () => number { return () => n; }

    // Native calls use TD_ID; simjs runs the TypeScript dummy body.
    //% shim=TD_ID
    function shimDefault(n = 31): number { return n; }
    //% shim=TD_ID
    //% n.defl=37 explicitDefaults="n"
    function annotatedDefault(n?: number): number { return n; }

    export function run() {
        const derived = new Derived();
        const base: Base = derived;
        const iface: DfShape = derived;
        const dynamic: any = derived;
        assert(derived.dfOpt(1) === 10, "qzdp:derived");
        assert(base.dfOpt(1) === 10, "qzdp:virtual-default");
        assert(iface.dfOpt(1) === 10, "qzdp:override-iface");
        assert(dynamic.dfOpt(1) === 10, "qzdp:override-any");
        assert(base.dfOpt(1, undefined) === 10, "qzdp:virtual-undefined");
        assert(base.dfOpt(1, 2) === 3, "qzdp:virtual-explicit");
        assert(derived.fromSuper() === 6, "qzdp:super");

        const action: (n?: number) => number = free;
        const dynamicAction: any = free;
        const arrow: (n?: number) => number = (n = 23) => n;
        assert(free() === 19 && free(undefined) === 19, "qzdp:free");
        assert(action() === 19 && action(undefined) === 19, "qzdp:action");
        assert(dynamicAction() === 19, "qzdp:any-action");
        assert(arrow() === 23 && arrow(0) === 0, "qzdp:arrow");
        const literal: DfShape = { dfOpt: (a: number, b = 41) => a + b };
        assert(literal.dfOpt(1) === 42, "qzdp:literal-action");

        const values: OptionalValues = new Values();
        const anyValues: any = values;
        assert(values.value() === 11, "qzdp:value-default");
        assert(values.value(undefined) === 11, "qzdp:value-undefined");
        assert(values.value(null) === null, "qzdp:preserve-null");
        assert(values.value(0) === 0, "qzdp:preserve-zero");
        assert(values.value(false) === false, "qzdp:preserve-false");
        assert(values.value("") === "", "qzdp:preserve-empty-string");
        const nan = values.value(0 / 0);
        assert(nan !== nan, "qzdp:preserve-nan");
        assert(values.pair() === 23, "qzdp:multiple");
        assert(anyValues.pair() === 23, "qzdp:arity-padding");
        assert(values.pair(undefined, 8) === 28, "qzdp:argument-hole");
        assert(values.pair(4) === 43, "qzdp:trailing");
        const counter = values.capture();
        const explicitCounter = values.capture(10);
        assert(counter() === 8 && counter() === 9, "qzdp:boxed-param");
        assert(explicitCounter() === 11, "qzdp:boxed-explicit");
        assert(immutableCapture()() === 29, "qzdp:immutable-capture");

        assert(new ParameterProperty().value === 13, "qzdp:constructor-property");
        assert(new ParameterProperty(undefined).value === 13, "qzdp:constructor-undefined");
        assert(new DerivedConstructor().value === 17, "qzdp:derived-constructor");
        assert(new DerivedConstructor(0).value === 0, "qzdp:constructor-zero");
        assert(bool() && !bool(false), "qzdp:boolean");
        const array = [1, 2];
        assert(ref() === null && ref(array) === array, "qzdp:reference");
        assert(missing() === undefined, "qzdp:no-default");
        assert(shimDefault() === 31 && shimDefault(0) === 0, "qzdp:shim-default");
        assert(shimDefault(undefined) === undefined, "qzdp:shim-undefined-unchanged");
        assert(annotatedDefault() === 37, "qzdp:annotated-default");
    }
}

testDefaultParamDispatch();
DefaultDispatch.run();
