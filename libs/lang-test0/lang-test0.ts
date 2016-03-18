//%  shim=micro_bit::panic
function panic(code2: number): void { }

//%  shim=micro_bit::showDigit
function showDigit(code2: number): void { }

function msg(s: string): void {
    //console.log(s)
    //basic.pause(50);
}

function assert(cond: boolean, msg_: string) {
    if (!cond) {
        console.log("ASSERT: " + msg_);
        panic(45);
    }
}

//
// start tests
//

var glb1: number;
var s2: string;
var x: number;
var action: Action;
var tot: string;
var lazyAcc: number;
var sum: number;

var xyz = 12;

console.log("Starting...")

//lib.print_17(3);
showDigit(0);
//assert(lib3.getX() == 17 * 3, "");

testNums();
testStrings();
testNumCollection();
testStringCollection();
testStringOps();
testReccoll();
inBg();
testAction(1);
testAction(7);
testIter();
testActionSave();
testLazyOps();
testRefLocals();
testByRefParams();
testFunDecl();
testDefaultArgs();
testMemoryFree();
testMemoryFreeHOF();
postPreFix()
eqOp()
testEnums()

// test some top-level code
let xsum = 0;
for (let i = 0; i < 11; ++i) {
    xsum = xsum + i;
}
assert(xsum == 55, "mainfor")

control.inBackground(() => {
    xsum = xsum + 10;
})

basic.pause(20)
assert(xsum == 65, "mainforBg")

assert(xyz == 12, "init")

function incrXyz() {
    xyz++;
    return 0;
}
var unusedInit = incrXyz();

assert(xyz == 13, "init2")

testClass()
showDigit(1);

console.log("ALL TESTS OK")


function defaultArgs(x: number, y = 3, z = 7) {
    return x + y + z;
}

function testDefaultArgs() {
    msg("testDefaultArgs");
    assert(defaultArgs(1) == 11, "defl0")
    assert(defaultArgs(1, 4) == 12, "defl1")
    assert(defaultArgs(1, 4, 8) == 13, "defl2")

    assert(optargs(1) == 1, "opt0");
    assert(optargs(1, 2) == 3, "opt1");
    assert(optargs(1, 2, 3) == 3, "opt2");

    assert(optstring(3) == 6, "os0")
    assert(optstring(3, "7") == 10, "os1")
    assert(optstring2(3) == 6, "os0")
    assert(optstring2(3, "7") == 10, "os1")
}

function optargs(x: number, y?: number, z?: number) {
    return x + y;
}

function optstring(x: number, s?: string) {
    if (s != null) {
        return parseInt(s) + x;
    }
    return x * 2;
}

function optstring2(x: number, s: string = null) {
    if (s != null) {
        return parseInt(s) + x;
    }
    return x * 2;
}

function testNums(): void {
    let x = 40 + 2;
    assert(x == 42, "add");
    x = 40 / 2;
    assert(x == 20, "div");
    let r = fib(15);
    msg("FIB" + r);
    assert(r == 987, "fib");
    let x3 = doStuff(x, 2);
    assert(x3 == 10, "call order");
    glb1 = 5;
    incrBy_2();
    assert(glb1 == 7, "glb1");
    incrBy_2();
    assert(glb1 == 9, "glb2");
    assert(Math.abs(-42) == 42, "abs");
    assert(Math.abs(42) == 42, "abs");
    assert(Math.sign(42) == 1, "abs");
    testIf();

    assert((3 & 6) == 2, "&")
    assert((3 | 6) == 7, "|")
    assert((3 ^ 6) == 5, "^")
    assert((-10 >> 2) == -3, ">>")
    assert((-10 >>> 20) == 4095, ">>>")
    assert((-10 << 2) == -40, "<<")
    assert((10 << 2) == 40, "<<+")
    assert((10 >> 2) == 2, ">>+")
    assert((10 >>> 2) == 2, ">>>+")
    assert(1000000 * 1000000 == -727379968, "*")
    assert(100000001 * 100000001 == 2074919425, "*2")
    
    assert(105 % 100 == 5, "perc")
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


function incrBy_2(): void {
    glb1 = glb1 + 2;
}

function testStrings(): void {
    assert((42).toString() == "42", "42");

    let s = "live";
    assert(s == "live", "hello eq");
    s = s + "4OK";
    s2 = s;
    assert(s.charCodeAt(4) == 52, "hello eq2");
    assert(s.charAt(4) == "4", "hello eq2X");
    assert(s[4] == "4", "hello eq2X");
    assert(s.length == 7, "len7");
    s = "";
    for (let i = 0; i < 10; i++) {
        s = s + i;
    }
    assert(s == "0123456789", "for");
    let x = 10;
    s = "";
    while (x >= 0) {
        s = s + x;
        x = x - 1;
    }
    assert(s == "109876543210", "while");
    msg(s);
    msg(s2);

    s2 = ""; // don't leak ref

    x = 21
    s = "foo"
    s = `a${x * 2}X${s}X${s}Z`
    assert(s == "a42XfooXfoo" + "Z", "`")

    assert("X" + true == "Xt" + "rue", "boolStr")
}


function testNumCollection(): void {
    let collXYZ: number[] = [];
    assert(collXYZ.length == 0, "");
    collXYZ.push(42);
    assert(collXYZ.length == 1, "");
    collXYZ.push(22);
    assert(collXYZ[1] == 22, "");
    collXYZ.splice(0, 1);
    assert(collXYZ[0] == 22, "");
    collXYZ.removeElement(22);
    assert(collXYZ.length == 0, "");
    for (let i = 0; i < 100; i++) {
        collXYZ.push(i);
    }
    assert(collXYZ.length == 100, "");

    collXYZ = [1, 2, 3];
    assert(collXYZ.length == 3, "cons");
    assert(collXYZ[0] == 1, "cons0");
    assert(collXYZ[1] == 2, "cons1");
    assert(collXYZ[2] == 3, "cons2");
}

function testStringCollection(): void {
    let coll = (<string[]>[]);
    coll.push("foobar");
    coll.push((12).toString());
    coll.push(coll[0] + "xx");
    assert(coll.indexOf("12") == 1, "idx");
    coll = [
        "a" + "b",
        coll[2],
    ]
    assert(coll[0] == "ab", "")
    assert(coll[1] == "foob" + "arxx", "")
    assert(coll.length == 2, "")
}

function testStringOps(): void {
    assert("foo".concat("bar") == "foobar", "concat");
    assert("xAb".charCodeAt(1) == 65, "code at");
    assert("B".charCodeAt(0) == 66, "tcc");
    assert(parseInt("-123") == -123, "tonum");
    assert("fo"[1] == "o", "at");
    assert("fo".length == 2, "count");
    assert("fo".charCodeAt(17) == 0, "ct oor");
}

class Testrec {
    str: string;
    num: number;
    bool: boolean;
    str2: string;
}

function recordId(x: Testrec) {
    lazyAcc++
    return x
}

function postPreFix() {
    let x = new Testrec()
    lazyAcc = 0
    recordId(x).num = 12
    assert(x.num == 12 && lazyAcc == 1, "X0")
    let y = recordId(x).num++
    assert(x.num == 13 && lazyAcc == 2, "X1")
    assert(y == 12, "X2")
    y = ++recordId(x).num
    assert(y == 14 && x.num == 14 && lazyAcc == 3, "X2")

    recordId(x).num >>= 1
    assert(x.num == 7, "X3")
    assert(lazyAcc == 4, "X4")
}

function eqOp() {
    let x = 12
    assert((x += 10) == 22, "Y0")
    assert(x == 22, "Y1")
    x /= 2
    assert(x == 11, "Y2")

    let s = ("fo" + 1)
    let t = ("ba" + 2)
    s += t
    assert(s == "fo1b" + "a2", "fb")
}

function testRec0(): Testrec {
    let testrec = new Testrec();
    testrec.str2 = "Hello" + " world";
    testrec.str = testrec.str2;
    testrec.num = 42;
    assert(testrec.str == "Hello world", "recstr");
    assert(testrec.num == 42, "recnum");
    msg(testrec.str2);
    let testrec2 = <Testrec>null;
    assert(testrec2 == null, "isinv");
    assert(testrec == testrec, "eq");
    assert(testrec != null, "non inv");
    return testrec;
}

function testReccoll(): void {
    let coll: Testrec[] = [];
    let item = testRec0();
    msg("in reccoll");
    coll.push(item);
}

function inBg() {
    let k = 7
    let q = 14
    let rec = new Testrec();
    glb1 = 0
    control.inBackground(() => {
        glb1 = glb1 + 10 + (q - k)
        rec.str = "foo"
    })
    control.inBackground(() => {
        glb1 = glb1 + 1
    })
    basic.pause(50)
    assert(glb1 == 18, "inbg0")
    assert(rec.str == "foo", "inbg1")
}

function runTwice(fn: Action): void {
    msg("r2 start");
    fn();
    fn();
    msg("r2 stop");
}

function iter(max: number, fn: (v: number) => void) {
    for (var i = 0; i < max; ++i) {
        fn(i);
    }
}

function testIter() {
    x = 0
    iter(10, v => {
        x = x + (v + 1)
    })
    assert(x == 55, "55")
}

function testAction(p: number): void {
    let s = "hello" + "1";
    let coll = [] as number[];
    let p2 = p * 2;
    x = 42;
    runTwice(() => {
        x = x + p + p2;
        coll.push(x);
        msg(s + x);
    });
    assert(x == 42 + p * 6, "run2");
    assert(coll.length == 2, "run2");
}

function add7() {
    sum = sum + 7;
}

function testFunDecl() {
    msg("testFunDecl");
    let x = 12;
    sum = 0;
    function addX() {
        sum = sum + x;
    }
    function add10() {
        sum = sum + 10;
    }
    runTwice(addX)
    assert(sum == 24, "cap")
    msg("testAdd10");
    runTwice(add10);
    msg("end-testAdd10");
    assert(sum == 44, "nocap");
    runTwice(add7);
    assert(sum == 44 + 14, "glb")
    addX();
    add10();
    assert(sum == 44 + 14 + x + 10, "direct");
}

function saveAction(fn: Action): void {
    action = fn;
}

function saveGlobalAction(): void {
    let s = "foo" + "42";
    tot = "";
    saveAction(() => {
        tot = tot + s;
    });
}

function testActionSave(): void {
    saveGlobalAction();
    runTwice(action);
    msg(tot);
    assert(tot == "foo42foo42", "");
    tot = "";
    action = null;
}

function testLazyOps(): void {
    lazyAcc = 0;
    if (incrLazyAcc(10, false) && incrLazyAcc(1, true)) {
        assert(false, "");
    } else {
        assert(lazyAcc == 10, "lazy1");
    }
    assert(lazyAcc == 10, "lazy2");
    if (incrLazyAcc(100, true) && incrLazyAcc(1, false)) {
        assert(false, "");
    } else {
        assert(lazyAcc == 111, "lazy4");
    }
    lazyAcc = 0;
    if (incrLazyAcc(100, true) && incrLazyAcc(8, true)) {
        assert(lazyAcc == 108, "lazy5");
    } else {
        assert(false, "");
    }
    lazyAcc = 0;
    if (incrLazyAcc(10, true) || incrLazyAcc(1, true)) {
        assert(lazyAcc == 10, "lazy1b");
    } else {
        assert(false, "");
    }
    assert(lazyAcc == 10, "lazy2xx");
    if (incrLazyAcc(100, false) || incrLazyAcc(1, false)) {
        assert(false, "");
    } else {
        assert(lazyAcc == 111, "lazy4x");
    }
    lazyAcc = 0;
    if (incrLazyAcc(100, false) || incrLazyAcc(8, true)) {
        assert(lazyAcc == 108, "lazy5");
    } else {
        assert(false, "");
    }
    lazyAcc = 0;
    if (incrLazyAcc(10, true) && incrLazyAcc(1, true) && incrLazyAcc(100, false)) {
        assert(false, "");
    } else {
        assert(lazyAcc == 111, "lazy10");
    }
    lazyAcc = 0;
    if (incrLazyAcc(10, true) && incrLazyAcc(1, true) || incrLazyAcc(100, false)) {
        assert(lazyAcc == 11, "lazy101");
    } else {
        assert(false, "");
    }

    lazyAcc = 0;
    assert((true ? incrLazyNum(1, 42) : incrLazyNum(10, 36)) == 42, "?:")
    assert(lazyAcc == 1, "?:0");
    assert((false ? incrLazyNum(1, 42) : incrLazyNum(10, 36)) == 36, "?:1")
    assert(lazyAcc == 11, "?:2");
}

function incrLazyAcc(delta: number, res: boolean): boolean {
    lazyAcc = lazyAcc + delta;
    return res;
}

function incrLazyNum(delta: number, res: number) {
    lazyAcc = lazyAcc + delta;
    return res;
}


function testRefLocals(): void {
    msg("start test ref locals");
    let s = "";
    // For 4 or more it runs out of memory
    for (let i = 0; i < 3; i++) {
        msg(i + "");
        let copy = i;
        control.inBackground(() => {
            basic.pause(10 * i);
            copy = copy + 10;
        });
        control.inBackground(() => {
            basic.pause(20 * i);
            s = s + copy;
        });
    }
    basic.pause(200);
    assert(s == "101112", "reflocals");
}

function byRefParam_0(p: number): void {
    control.inBackground(() => {
        basic.pause(1);
        sum = sum + p;
    });
    p = p + 1;
}

function byRefParam_2(pxx: number): void {
    pxx = pxx + 1;
    control.inBackground(() => {
        basic.pause(1);
        sum = sum + pxx;
    });
}

function testByRefParams(): void {
    msg("testByRefParams");
    refparamWrite("a" + "b");
    refparamWrite2(new Testrec());
    refparamWrite3(new Testrec());
    sum = 0;
    let x = 1;
    control.inBackground(() => {
        basic.pause(1);
        sum = sum + x;
    });
    x = 2;
    byRefParam_0(4);
    byRefParam_2(10);
    basic.pause(30);
    assert(sum == 18, "by ref");
}

function refparamWrite(s: string): void {
    s = s + "c";
    assert(s == "abc", "abc");
}

function refparamWrite2(testrec: Testrec): void {
    testrec = new Testrec();
    assert(testrec.bool == false, "");
}

function refparamWrite3(testrecX: Testrec): void {
    control.inBackground(() => {
        basic.pause(1);
        assert(testrecX.str == "foo", "ff");
        testrecX.str = testrecX.str + "x";
    });
    testrecX = new Testrec();
    testrecX.str = "foo";
    basic.pause(30);
    assert(testrecX.str == "foox", "ff2");
}

function testMemoryFree(): void {
    msg("testMemoryFree");
    for (let i = 0; i < 1000; i++) {
        allocImage();
    }
}

function runOnce(fn: Action): void {
    fn();
}

function createObj() {
    return new Testrec();
}

function testMemoryFreeHOF(): void {
    msg("testMemoryFreeHOF");
    for (let i = 0; i < 1000; i++) {
        runOnce(() => {
            let tmp = createObj();
        });
    }
}

function allocImage(): void {
    let tmp = createObj();
}

class Foo {
    pin: number;
    buf: number[];

    constructor(k: number, l: number) {
        this.pin = k - l
    }

    setPin(p: number) {
        this.pin = p
    }

    getPin() {
        return this.pin
    }

    init() {
        this.buf = [1, 2]
    }
}

function testClass() {
    let f = new Foo(272, 100);
    assert(f.getPin() == 172, "ctor")
    f.setPin(42)
    assert(f.getPin() == 42, "getpin")
}

enum En {
    A,
    B,
    C,
    D = 42,
    E,
}

function testEnums() {
    let k = En.C as number
    assert(k == 2, "e0")
    k = En.D as number
    assert(k == 42, "e1")
    k = En.E as number
    assert(k == 43, "e43")
}