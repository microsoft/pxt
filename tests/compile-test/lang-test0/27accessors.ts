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

interface GetSetIface {
    x: number;
}

function testAccessors() {
    msg("testAccessors")
    glb1 = 0
    let f = new GetSet()
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

testAccessors()
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