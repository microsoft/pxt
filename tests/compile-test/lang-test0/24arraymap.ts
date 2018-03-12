function testArrayMap() {
    msg("testArrayMap");
    let strs = [1, 2, 3].map(x => "X" + x)
    let r = "A"
    for (let s of strs) {
        r += s
    }
    assert(r == "AX1X2X3", "map")

    let flt = [17, 8, 2, 3, 100].filter((x, i) => x == i)
    assert(flt.length == 2, "flt")
    assert(flt[1] == 3, "flt")

    let sum = [1, 2, 3].reduce((s, v) => s + v, 0)
    assert(sum == 6, "red")

    let x = ["A" + "12", "B" + "3"].map((k, i) => k.length + i).reduce((c, n) => c * n, 1)
    assert(x == 9, "9")
}

testArrayMap()

function testArrayJoin() {
    {
        msg("testArraySort")
        let strs = [1, 2, 3];
        let r = "A" + strs.join("X");
        assert(r == "AX1X2X3", "join");
    }

    {
        let strs = ["a", "b", "c"];
        let r = "B" + strs.join("Y");
        assert(r == "BYaYbYc", "joinstr");
    }
}

testArraySort()

function testArraySome() {
    let str = [1, 2, 3];
    assert(str.some(x => x == 2), "sometrue");
    assert(!str.some(x => x < 0), "somefalse");
}

testArraySome();

function testArrayEvery() {
    let str = [1, 2, 3];
    assert(!str.every(x => x == 2), "everyfalse");
    assert(str.every(x => x < 0), "everytrue");
}

testArrayEvery();
