namespace Ifaces {
    interface IFoo {
        foo(): number;
        bar(x: number): string;
        twoArg(x: number, y: number): number;
        baz: string;
    }

    class A {
        constructor() {
            this.baz = "Q" + "A"
        }
        foo() {
            return 12
        }
        bar(v: number) {
            return v.toString()
        }
        twoArg(x: number) {
           return x
        }
        baz: string;
    }
    class B extends A {
        foo() {
            return 13
        }
    }

    function foo(f: IFoo) {
        return f.foo() + f.baz + f.bar(42)
    }

    export function run() {
        msg("Ifaces.run")
        let a = new A()
        assert(foo(a) + "X" == "12QA42X")
        assert((a as IFoo).twoArg(1, 2) == 1, "t")
        a = new B()
        assert(foo(a) + "X" == "13QA42X", "b")
        let q = a as IFoo
        q.baz = "Z"
        assert(foo(q) + "X" == "13Z42X", "x")
        msg("Ifaces.runDONE")
    }
}

Ifaces.run()
