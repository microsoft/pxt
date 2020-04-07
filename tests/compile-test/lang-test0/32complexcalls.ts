class NestedFun {
    f: () => number;
}

function testComplexCallExpr() {
    msg("testComplexCallExpr")
    let a = new NestedFun()
    a.f = () => 12;

    function bar() {
        return () => 17;
    }

    assert(a.f() == 12, "af")
    assert(bar()() == 17, "ff")
}

function inl0(a: number, b: number) {
    return a - b
}
function inl1(a: number, b: number) {
    return b - a
}
function inl2(a: number, b: number) {
    return a
}
function inl3(a: number, b: number) {
    return b
}

function testInline() {
    msg("testInline")
    let pos = 0
    const arg0 = () => {
        assert(pos == 0)
        pos = 1
        return 1
    }
    const arg1 = () => {
        assert(pos == 1)
        pos = 2
        return 2
    }

    pos = 0
    assert(inl0(arg0(), arg1()) == -1)
    pos = 0
    assert(inl1(arg0(), arg1()) == 1)
    pos = 0
    assert(inl2(arg0(), arg1()) == 1)
    pos = 0
    assert(inl3(arg0(), arg1()) == 2)
}

testComplexCallExpr()
testInline()
