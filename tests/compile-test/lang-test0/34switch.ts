function testAnySwitch() {
    msg("testAnySwitch")
    function bar(x: number) {
        glb1 += x
        return x
    }
    function testIt(v: number) {
        glb1 = 0
        switch (v) {
            case bar(0): return 1
            default: return 7
            case bar(1): return 2
            case bar(2): return 3
        }
    }
    function ss() {
        return "f7" + "4n"
    }
    function testStr(s: string) {
        switch (s) {
            case "foo": return 0;
            case ss(): return 2;
            case "bar": return 1;
            default: return 7;
        }
    }
    function testQuick(v: number) {
        switch (v) {
            default: return 7
            case 0: return 1
            case 1: return 2
            case bar(2): return 3
            case 3: return 4
            case 4: return 5
            case 5: return 6
        }
    }
    let v = testIt(2)
    assert(v == 3, "v3")
    assert(glb1 == 3, "v3g")
    v = testIt(0)
    assert(v == 1, "v1")
    assert(glb1 == 0, "v1g")

    assert(testStr("foo") == 0, "f0")
    assert(testStr("bar") == 1, "f1")
    assert(testStr(ss()) == 2, "f2")

    for (let i = 0; i <= 6; ++i)
        assert(testQuick(i) == i + 1, "q")
}
testAnySwitch()
