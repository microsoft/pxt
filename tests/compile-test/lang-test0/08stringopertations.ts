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
