function testGenRef<T>(v: T) {
    let x = v
    // test that clear() also gets generalized
    function clear() {
        x = null
    }
    clear()
}

function testGenRefOuter() {
    msg("testGenRefOuter");
    testGenRef(12)
    testGenRef("fXa" + "baa")
}

testGenRefOuter()
