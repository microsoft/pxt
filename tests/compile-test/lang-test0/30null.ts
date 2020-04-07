
function testNullJS() {
    let x: number
    assert(x === undefined, "undef0")
    assert(x == null, "null0")
    x = null
    assert(x === null, "null1")
    assert(x == undefined, "undef1")
    x = 0
    assert(x != null, "null2")
}

function testNull() {
    msg("testNull")
    if (hasFloat) {
        testNullJS()
        return
    }
    let x = 0
    let y = 0
    x = null
    assert(x == y, "null")
    x = undefined
    assert(x == y, "undef")
    y = 1
    assert(x != y, "null")
}

testNull()


namespace UndefinedReturn {
    function bar() {
        return "foo123"
    }
    function foo(): any {
        let x = bar()
        if (!x)
            return 12
    }
    function foo2(): any {
        let x = bar()
        if (x)
            return 12
    }
    function foo3(): any {
        let x = bar()
    }
    function foo4(): any {
        let x = bar()
        return
    }
    function foo5() {
        let x = bar()
    }
    function foo6() {
        let x = bar()
        return
    }

    function testUndef() {
        msg("testUndef")
        assert(foo() === undefined)
        assert(foo2() === 12)
        assert(foo3() === undefined)
        assert(foo4() === undefined)
        assert(foo5() === undefined)
        assert(foo6() === undefined)
    }

    testUndef()
}
