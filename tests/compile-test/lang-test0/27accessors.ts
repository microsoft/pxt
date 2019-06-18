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
    x:number;
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
