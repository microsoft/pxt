namespace ClassTest {
    class A {
        v: number
        s: string
        foo() {
            glb1++
            this.v = 9
            this.s = "xx" + "z42z"
        }
        bar(v: number, i: string) {
            glb1 += v + this.v
        }
    }

    class B extends A {
        s2: string
        foo() {
            glb1 += 2
            this.v = 10
            this.s2 = "xy" + "z42z"
        }
        bar(v: number, i: string) {
            glb1 += v + parseInt(i) + this.v
        }
    }

    class C extends A {
        foo() {
            glb1 += 3
            this.v = 7
        }
    }

    class D extends C {
        bar(v: number, i: string) {
            glb1 = this.v
            this.v = 13
            super.bar(v, i)
        }
    }

    class E {
        foo() { }
    }

    class F extends E {
        foo() { }
    }

    function testACall(a: A, v0: number, v1: number) {
        glb1 = 0
        a.foo()
        //console.log("foo is " + glb1)
        assert(glb1 == v0, "v0")
        a.bar(32, "6" + "4")
        //console.log("bar is " + glb1)
        assert(glb1 == v1, "v1")
    }

    export function run() {
        msg("ClassTest.run")
        let f = new F()
        testACall(new A(), 1, 42)
        testACall(new B(), 2, 108)
        testACall(new C(), 3, 42)
        testACall(new D(), 3, 52)
    }
}

namespace Ctors {
    class A {
        v: number
        s: string
        constructor(k = 12) {
            this.v = k
        }
    }

    class B extends A {
        q: number
        constructor() {
            super()
            this.q = 17
        }
    }

    class C extends B { }
    class D extends A { }

    export function run() {
        msg("Ctors.run")
        let a = new A()
        assert(a.v == 12, "A12")
        a = new B()
        assert(a.v == 12, "B12")
        // downcasts outlawed for now
        //assert((a as B).q == 17, "B17")
        a = new C()
        assert(a.v == 12, "C12")
        // downcasts outlawed for now
        //assert((a as B).q == 17, "C17")
        let d = new D(33)
        assert(d.v == 33, "D33")
        d = new D()
        assert(d.v == 12, "D12")
    }
}

namespace ParentUnused {
    class A {
        foo(a: number) { }
    }
    class B extends A {
        foo(a: number) { }
    }
    export function run() {
        const b = new B();
        b.foo(1)
    }
}

ClassTest.run()
Ctors.run()
ParentUnused.run()
