namespace InstanceOf {

    class Foo {
        x: number
        y: string
        bar() {
            return this.x
        }
    }

    class Bar extends Foo { }
    class Baz extends Foo { }
    class Bar2 extends Bar { }
    class Bar3 extends Bar { }

    function testNot(v: any) {
        assert(!(v instanceof Foo), "tn")
    }

    export function run() {
        msg("InstanceOf")

        assert(new Bar2() instanceof Foo, "if")
        assert(new Bar2() instanceof Bar, "ib")
        assert(new Bar2() instanceof Bar2, "ib2")
        assert(new Bar3() instanceof Bar, "ib")
        assert(!(new Bar2() instanceof Baz), "!ib")
        assert(!(new Foo() instanceof Baz), "!ib2")
        assert(!(new Foo() instanceof Bar), "!ib2")

        testNot(undefined)
        testNot(null)
        testNot(1)
        testNot(1.5)
        testNot(1.5 + 0.3)
        testNot("ell")
        testNot("ell" + "world")
        testNot({});

        (new Foo()).bar();
        (new Bar3()).bar();

        // This crashes (correctly)
        // let f:Foo = {} as any
        // f.bar()
        // let s = f.x + f.y
    }
}

InstanceOf.run()
