// Defaults run once, in the callee's lexical scope and parameter order, after
// every explicit call argument is evaluated. No unfetteredInitializers needed.
namespace DefaultInitializers {
    let trace = "";
    let calls = 0;
    function next(): number { trace += "d"; return ++calls; }
    function supplied(): number { trace += "a"; return 10; }
    function absent(): number { calls++; return undefined; }

    interface Factory {
        make(n?: number, other?: number): number;
        empty(n?: number): number;
        array(value?: number[]): number[];
        text(value?: string): string;
    }
    class Maker implements Factory {
        offset = 100;
        constructor() { }
        make(n = next(), other = n + this.offset): number { return n + other; }
        empty(n = absent()): number { return n; }
        array(value = [next()]): number[] { return value; }
        text(value = "hello"): string { return value; }
    }
    function destructured({ x } = { x: next() }, n = x + 1): number { return x + n; }
    function captured(n = next()): () => number { return () => ++n; }
    function defaults(text = "world", negative = -1, missing: number = undefined): string {
        return text + ":" + negative + ":" + missing;
    }
    function scope() {
        let outer = 40;
        const f: (n?: number) => number = (n = ++outer) => n;
        assert(f() === 41 && f(undefined) === 42, "qzdpi:lexical");
        assert(f(0) === 0 && outer === 42, "qzdpi:lexical-explicit");
    }
    export function run() {
        const direct = new Maker();
        const iface: Factory = direct;
        const dynamic: any = direct;
        assert(iface.make() === 102 && calls === 1, "qzdpi:iface-order-this");
        assert(dynamic.make() === 104 && calls === 2, "qzdpi:any-order-this");
        trace = "";
        assert(direct.make(undefined, supplied()) === 13, "qzdpi:direct");
        assert(trace === "ad" && calls === 3, "qzdpi:argument-evaluation-order");
        assert(iface.make(7, 8) === 15 && calls === 3, "qzdpi:skip-supplied");
        assert(direct.empty() === undefined && calls === 4, "qzdpi:undefined-default-once");
        assert(dynamic.empty() === undefined && calls === 5, "qzdpi:any-undefined-once");
        const a = iface.array();
        const b = iface.array();
        a[0] = 99;
        assert(a !== b && b[0] === 7, "qzdpi:fresh-reference");
        assert(iface.array(a) === a && calls === 7, "qzdpi:reference-supplied");
        assert(destructured() === 17 && calls === 8, "qzdpi:destructured-once");
        assert(destructured({ x: 20 }) === 41 && calls === 8, "qzdpi:destructured-explicit");
        const action: (n?: number) => () => number = captured;
        const counter = action();
        assert(counter() === 10 && counter() === 11 && calls === 9, "qzdpi:boxed-default");
        assert(iface.text() === "hello" && dynamic.text(undefined) === "hello", "qzdpi:string-default");
        assert(direct.text("") === "", "qzdpi:string-explicit");
        assert(defaults() === "world:-1:undefined", "qzdpi:other-initializers");
        scope();
    }
}
DefaultInitializers.run();