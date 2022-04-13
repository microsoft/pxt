function consStringTest() {
    msg("consStringTest")
    const s = "0123456789abcdef"
    let s0 = ""
    let s1 = ""
    for (let i = 0; i < 100; ++i) {
        s0 = s0 + s[i & 0xf]
        s1 = s[(99 - i) & 0xf] + s1
    }
    assert(s0 == s1, "c0")
    assert(s0.length == 100, "c1")
}

function testStringOps(): void {
    assert("foo".concat("bar") == "foobar", "concat");
    assert("xAb".charCodeAt(1) == 65, "code at");
    assert("B".charCodeAt(0) == 66, "tcc");
    assert(parseInt("-123") == -123, "tonum");
    assert("fo"[1] == "o", "at");
    assert("fo".length == 2, "count");
    assert(!"fo".charCodeAt(17), "nan");
}

testStringOps();
consStringTest()
