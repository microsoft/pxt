class GetSet {
    _x: number;

    get x() {
        glb1++
        return this._x
    }

    set x(v: number) {
        glb1 += 4
        this._x = v
    }
}

class GetSet2 {
    _x: number;

    set x(v: number) {
        glb1 += 4
        this._x = v
    }

    get x() {
        glb1++
        return this._x
    }
}

interface GetSetIface {
    x: number;
}

function testAccessors() {
    msg("testAccessors")
    let f = new GetSet()
    glb1 = 0
    f.x = 12
    assert(glb1 == 4, "s")
    assert(f.x == 12, "s12")
    function getf() {
        glb1 += 100
        return f
    }
    getf().x++
    assert(glb1 == 110, "s10")
    assert(f.x == 13, "s13")
}

function testAccessors2() {
    msg("testAccessors2")
    let f = new GetSet2()
    glb1 = 0
    f.x = 12
    assert(glb1 == 4, "s")
    assert(f.x == 12, "s12")
    function getf() {
        glb1 += 100
        return f
    }
    getf().x++
    assert(glb1 == 110, "s10")
    assert(f.x == 13, "s13")
}

function testAccessorsIface() {
    msg("testAccessorsIface")
    glb1 = 0
    let f = new GetSet() as GetSetIface
    f.x = 12
    assert(glb1 == 4, "s")
    assert(f.x == 12, "s12")
    function getf() {
        glb1 += 100
        return f
    }
    getf().x++
    assert(glb1 == 110, "s10")
    assert(f.x == 13, "s13")
}

function testAccessorsAny() {
    msg("testAccessorsAny")
    glb1 = 0
    let f = new GetSet() as any
    f.x = 12
    assert(glb1 == 4, "s")
    assert(f.x == 12, "s12")
}

testAccessors()
testAccessors2()
testAccessorsIface()
testAccessorsAny()

namespace FieldRedef {
    class A {
        prop: boolean;
        constructor() {
            this.prop = true;
        }

        action() {
            if (this.prop)
                glb1 += 1
        }
    }

    class B extends A {
        get prop() {
            return false;
        }
        set prop(v: boolean) {
            glb1 += 10
        }
    }

    function test() {
        msg("FieldRedef.run")
        clean()
        const a = new A();
        const b = new B();
        assert(glb1 == 10)
        a.action();
        assert(glb1 == 11)
        b.action();
        assert(glb1 == 11)
    }

    test()
}


namespace NoArgs {
    interface Foo {
        xyz(): number;
        abc: () => number;
    }

    function bar2(off: number, f: Foo) {
        assert(f.abc() == off, "nab1")
        assert(f.xyz() == off + 1, "nab2")
    }

    function bar(off: number, f: any) {
        bar2(off, f)

        assert(f.abc() == off, "nab1x")
        assert(f.xyz() == off + 1, "nab2x")
    }

    class Bar implements Foo {
        abc: () => number;
        xyz: () => number;
        constructor() {
            this.abc = () => 20
            this.xyz = () => 21
        }
    }

    class Baz implements Foo {
        abc() { return 30 }
        xyz() { return 31 }
    }

    bar(10, { xyz: () => 11, abc: () => 10 })
    bar(20, new Bar())
    bar(30, new Baz())
    msg("NoArgs OK")
}

namespace WithArgs {
    interface Foo {
        xyz(x: number, y: number): number;
        abc: (x: number, y: number) => number;
    }

    function bar2(off: number, f: Foo) {
        assert(f.abc(2, 1) == off, "wa1")
        assert(f.xyz(2, 1) == off + 1, "wa2")
    }

    function bar(off: number, f: any) {
        bar2(off, f)

        assert(f.abc(2, 1) == off, "wa1'")
        assert(f.xyz(2, 1) == off + 1, "wa2'")

        testBind(off, f)
    }

    class Bar implements Foo {
        abc: (x: number, y: number) => number;
        xyz: (x: number, y: number) => number;
        constructor() {
            this.abc = (x: number, y: number) => {
                return 19 + x / y
            }
            this.xyz = (x: number, y: number) => 20 + x / y
        }
    }

    class Baz implements Foo {
        abc(x: number, y: number) { return 29 + x / y }
        xyz(x: number, y: number) { return 30 + x / y }
    }

    class Qux implements Foo {
        get abc() {
            return (x: number, y: number) => {
                return 59 + x / y
            }
        }
        get xyz() {
            return (x: number, y: number) => 60 + x / y
        }
    }

    function qux(off: number) {
        bar(off, {
            xyz: (x: number, y: number) => off - 1 + x / y,
            abc: (x: number, y: number) => {
                return off - 2 + x / y
            }
        })
    }

    function testBind(off: number, f: Foo) {
        const abc = f.abc
        const abc2 = (f as any).abc
        // const xyz = f.xyz // currently we error at compilation on this one; need to reconsider
        const xyz2 = (f as any).xyz
        assert(abc(2, 1) == off, "bn1")
        assert(abc2(2, 1) == off, "bn2")
        assert(xyz2(2, 1) == off + 1, "bn3")
    }

    bar(11, {
        xyz: (x: number, y: number) => 10 + x / y,
        abc: (x: number, y: number) => {
            return 9 + x / y
        }
    })
    bar(21, new Bar())
    bar(31, new Baz())
    qux(41)
    qux(51)
    bar(61, new Qux())
    msg("WithArgs OK")
}

namespace DontCall {
    interface Foo {
        num: any
        getter: number
    }
    class Bar implements Foo {
        num() {
            assert(false, "num")
        }
        get getter() {
            return 1
        }
    }
    function test(x: any) {
        assert(typeof x.num == "function", "late")
        assert(typeof (x as Foo).num == "function", "late2")
        assert(x.getter == 1, "late3")
        assert((x as Foo).getter == 1, "late4")
    }
    test(new Bar())
    msg("DontCall OK")
}

