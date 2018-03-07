function testArrayForEach() {
    msg("testArrayFoEach");
    let strs: string[] = [];
    [1, 2, 3].forEach(x => strs.push("X" + x))
    let r = "A"
    for (let s of strs) {
        r += s
    }
    assert(r == "AX1X2X3", "forEach")
}

testArrayForEach()
