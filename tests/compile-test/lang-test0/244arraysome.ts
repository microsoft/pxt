function testArraySome() {
    let str = [1, 2, 3];
    assert(str.some(x => x == 2), "sometrue");
    assert(!str.some(x => x < 0), "somefalse");
}

testArraySome();
