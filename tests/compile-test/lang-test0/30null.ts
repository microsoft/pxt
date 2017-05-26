
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
