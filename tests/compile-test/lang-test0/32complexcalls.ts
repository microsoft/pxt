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

testComplexCallExpr()
