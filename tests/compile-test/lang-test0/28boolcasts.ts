class BazClass { }
function testBoolCasts() {
    msg("testBoolCast")
    function boolDie() {
        assert(false, "bool casts")
    }
    let x = "Xy" + "Z"

    if (x) { } else {
        boolDie()
    }

    if ("") {
        boolDie()
    }

    let v = new BazClass()
    if (v) { } else {
        boolDie()
    }
    if (!v) {
        boolDie()
    }
    v = null
    if (v) {
        boolDie()
    }
    if (!v) { } else {
        boolDie()
    }
}

testBoolCasts()
