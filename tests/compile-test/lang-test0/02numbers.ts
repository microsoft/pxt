function testIf(): void {
    let b = false;
    if (!b) {
        glb1 = 7;
    } else {
        assert(false, "b0");
    }
    assert(glb1 == 7, "glb3");
    if (b) {
        assert(false, "b1");
    } else {
        glb1 = 8;
    }
    assert(glb1 == 8, "glb3");
}

function testNums(): void {
    msg("TN")
    let z = 12
    msg("ZZ" + z);
    let x = 40 + 2;
    assert(x == 42, "add");
    x = 40 / 2;
    assert(x == 20, "div");
    let x3 = doStuff(x, 2);
    msg("nums#0")
    assert(x3 == 10, "call order");
    glb1 = 5;
    incrBy_2();
    assert(glb1 == 7, "glb1");
    incrBy_2();
    msg("nums#1")
    assert(glb1 == 9, "glb2");
    assert(Math.abs(-42) == 42, "abs");
    assert(Math.abs(42) == 42, "abs");
    assert(Math.sign(42) == 1, "abs");
    msg("nums#3")
    testIf();

    assert((3 & 6) == 2, "&")
    assert((3 | 6) == 7, "|")
    assert((3 ^ 6) == 5, "^")
    assert((~1) == -2, "~")
    let k1 = 1;
    assert((~k1) == -2, "~")
    assert((-10 >> 2) == -3, ">>")
    assert((-10 >>> 20) == 4095, ">>>")
    assert((-10 << 2) == -40, "<<")
    assert((10 << 2) == 40, "<<+")
    assert((10 >> 2) == 2, ">>+")
    assert((10 >>> 2) == 2, ">>>+")
    if (!hasFloat) {
        assert(1000000 * 1000000 == -727379968, "*")
        assert(100000001 * 100000001 == 2074919425, "*2")
        assert(-2 * -3 == 6, "-2*-3")
        assert(-2 * 3 == -6, "-2*3")
        assert(2 * 3 == 6, "2*3")
        assert(2 * -3 == -6, "2*-3")
    }
    msg("nums#4")

    assert(105 % 100 == 5, "perc")

    assert((2 ** 3) == 8, "**")
    let ke = 3;
    assert((ke ** 3) == ke * ke * ke, "**")

    // test number->bool conversion, #1057
    // x==20 here
    if (!x) {
        assert(false, "wrong bang")
    }

    let r = fib(15);
    msg("FB")
    msg("FIB" + r);
    assert(r == 987, "fib");

    msg("nums#5")

    assert(1 > 0.5, "<")
    assert(1 < 1.5, "<")
}

function fib(p: number): number {
    if (p <= 2) {
        return p;
    }
    let p2 = p - 1;
    return fib(p2) + fib(p - 2);
}

function doStuff(x: number, x2: number): number {
    let x3 = x / x2;
    return x3;
}


function incrBy_2(): void {
    glb1 = glb1 + 2;
}


function testComma() {
    glb1 = 0
    let x = (incrBy_2(), 77)
    assert(x == 77, "x")
    assert(glb1 == 2, "g")
    // make sure there are no leaks
    let y = ("aaa" + "zz", "x" + "yyy")
    assert(y.length == 4, "y")
}

testComma();

testNums();
