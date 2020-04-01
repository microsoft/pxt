function testLazyRef() {
    msg("testLazyRef")
    let x = ("x" + "Y") || "foo"
    let y = "" || "bXr" + "2"
    assert(x.length == 2, "two")
    assert(y.length == 4, "emp")
    y = null || "foo"
    assert(y == "foo", "ln")

    x = "x" + "12x" && "7" + "xx"
    assert(x.length == 3, "and")

    x = "" && "blah"
    assert(x == "", "andemp")
    x = "foo" && "x" + "Y"
    assert(x.length == 2, "twoand")
    x = "x" + "Y" && "bar"
    assert(x.length == 3, "threeand")

    let tw = 12
    let z = 0 || tw
    assert(z == 12, "12")
    z = tw || 13
    assert(z == 12, "12.2")
    z = tw && 13
    assert(z == 13, "13")

    let q = new Testrec()
    let r: Testrec = null
    let qq = q && r
    assert(qq == null, "&n")
    qq = r && q
    assert(qq == null, "&r")
}
testLazyRef()

// https://github.com/microsoft/pxt-arcade/issues/1519
namespace InlinePlusCond {
    interface MFX {
        _dummy: any;
    }
    
    const zero = 0 as any as MFX
    const one = 1 as any as MFX
    function sub(a:MFX, b:MFX) {
        return ((a as any as number) - (b as any as number)) as any as MFX
    }
    class Foobar {
        constructor(public x: MFX, public y: MFX) {}
    }
    
    function testIt() {
        let s = new Foobar(zero, one)
        let right = true
    
        let vv = zero
    
        s.x = sub(
            right ? vv : vv,
            s.y
        );

        assert(s.x as any as number == -1, "mfx")
    }

    testIt()
}
