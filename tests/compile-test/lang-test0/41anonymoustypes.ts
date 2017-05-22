namespace AnonymousTypes {

    class Foo {
        a: number;
        private b: number;
        bar() { return this.b; }
        constructor(inp: number) {
            this.a = inp
            this.b = inp + 1
        }
    }

    function foo(f: { a: number }) {
        return f.a + 1
    }
    export function test() {
        msg("AnonymousTypes")
        let x = { a: 2, b: "bar" }
        let nested = { a: { b: { c: 3 } } }

        let bar = new Foo(42)
        let baz: { a: number } = bar
        assert(nested.a.b.c == 3)
        assert(x.a == 2);
        assert(x.b == "bar");
        assert(foo(x) == 3)
        assert(foo(bar) == 43);
        assert(bar.bar() == 43)
        assert(foo(baz) == 43)
        // HUH bar(40) - new (expects any)
    }
}

AnonymousTypes.test()

