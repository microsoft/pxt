//
// Note that this is supposed to run from command line.
// Do not use anything besides basic.pause, control.inBackground, console.log
//

function msg(s: string): void {
    console.log(s)
    //basic.pause(50);
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
var u8: uint8
var i8: int8
var u16: uint16
var i16: int16

var xyz = 12;

console.log("Starting...")

basic.showNumber(0);



function defaultArgs(x: number, y = 3, z = 7) {
    return x + y + z;
}

function testDefaultArgs() {
    msg("testDefaultArgs");
    control.assert(defaultArgs(1) == 11, "defl0")
    control.assert(defaultArgs(1, 4) == 12, "defl1")
    control.assert(defaultArgs(1, 4, 8) == 13, "defl2")

    control.assert(optargs(1) == 1, "opt0");
    control.assert(optargs(1, 2) == 3, "opt1");
    control.assert(optargs(1, 2, 3) == 3, "opt2");

    control.assert(optstring(3) == 6, "os0")
    control.assert(optstring(3, "7") == 10, "os1")
    control.assert(optstring2(3) == 6, "os0")
    control.assert(optstring2(3, "7") == 10, "os1")
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
    control.assert(x == 42, "add");
    x = 40 / 2;
    control.assert(x == 20, "div");
    let r = fib(15);
    msg("FIB" + r);
    control.assert(r == 987, "fib");
    let x3 = doStuff(x, 2);
    control.assert(x3 == 10, "call order");
    glb1 = 5;
    incrBy_2();
    control.assert(glb1 == 7, "glb1");
    incrBy_2();
    control.assert(glb1 == 9, "glb2");
    control.assert(Math.abs(-42) == 42, "abs");
    control.assert(Math.abs(42) == 42, "abs");
    control.assert(Math.sign(42) == 1, "abs");
    testIf();

    control.assert((3 & 6) == 2, "&")
    control.assert((3 | 6) == 7, "|")
    control.assert((3 ^ 6) == 5, "^")
    control.assert((-10 >> 2) == -3, ">>")
    control.assert((-10 >>> 20) == 4095, ">>>")
    control.assert((-10 << 2) == -40, "<<")
    control.assert((10 << 2) == 40, "<<+")
    control.assert((10 >> 2) == 2, ">>+")
    control.assert((10 >>> 2) == 2, ">>>+")
    control.assert(1000000 * 1000000 == -727379968, "*")
    control.assert(100000001 * 100000001 == 2074919425, "*2")

    control.assert(105 % 100 == 5, "perc")
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
        control.assert(false, "b0");
    }
    control.assert(glb1 == 7, "glb3");
    if (b) {
        control.assert(false, "b1");
    } else {
        glb1 = 8;
    }
    control.assert(glb1 == 8, "glb3");
}


function incrBy_2(): void {
    glb1 = glb1 + 2;
}

function testStrings(): void {
    control.assert((42).toString() == "42", "42");

    let s = "live";
    control.assert(s == "live", "hello eq");
    s = s + "4OK";
    s2 = s;
    control.assert(s.charCodeAt(4) == 52, "hello eq2");
    control.assert(s.charAt(4) == "4", "hello eq2X");
    control.assert(s[4] == "4", "hello eq2X");
    control.assert(s.length == 7, "len7");
    s = "";
    for (let i = 0; i < 10; i++) {
        s = s + i;
    }
    control.assert(s == "0123456789", "for");
    let x = 10;
    s = "";
    while (x >= 0) {
        s = s + x;
        x = x - 1;
    }
    control.assert(s == "109876543210", "while");
    msg(s);
    msg(s2);

    s2 = "";
    // don't leak ref

    x = 21
    s = "foo"
    s = `a${x * 2}X${s}X${s}Z`
    control.assert(s == "a42XfooXfoo" + "Z", "`")

    control.assert("X" + true == "Xt" + "rue", "boolStr")
}


function testNumCollection(): void {
    let collXYZ: number[] = [];
    control.assert(collXYZ.length == 0, "");
    collXYZ.push(42);
    control.assert(collXYZ.length == 1, "");
    collXYZ.push(22);
    control.assert(collXYZ[1] == 22, "");
    collXYZ.splice(0, 1);
    control.assert(collXYZ[0] == 22, "");
    collXYZ.removeElement(22);
    control.assert(collXYZ.length == 0, "");
    for (let i = 0; i < 100; i++) {
        collXYZ.push(i);
    }
    control.assert(collXYZ.length == 100, "");

    collXYZ = [1, 2, 3];
    control.assert(collXYZ.length == 3, "cons");
    control.assert(collXYZ[0] == 1, "cons0");
    control.assert(collXYZ[1] == 2, "cons1");
    control.assert(collXYZ[2] == 3, "cons2");
}

function testStringCollection(): void {
    let coll = (<string[]>[]);
    coll.push("foobar");
    coll.push((12).toString());
    coll.push(coll[0] + "xx");
    control.assert(coll.indexOf("12") == 1, "idx");
    coll = [
        "a" + "b",
        coll[2],
    ]
    control.assert(coll[0] == "ab", "")
    control.assert(coll[1] == "foob" + "arxx", "")
    control.assert(coll.length == 2, "")
}

function testStringOps(): void {
    control.assert("foo".concat("bar") == "foobar", "concat");
    control.assert("xAb".charCodeAt(1) == 65, "code at");
    control.assert("B".charCodeAt(0) == 66, "tcc");
    control.assert(parseInt("-123") == -123, "tonum");
    control.assert("fo"[1] == "o", "at");
    control.assert("fo".length == 2, "count");
    control.assert("fo".charCodeAt(17) == 0, "ct oor");
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
    msg("postPref")
    let x = new Testrec()
    lazyAcc = 0
    recordId(x).num = 12
    control.assert(x.num == 12 && lazyAcc == 1, "X0")
    let y = recordId(x).num++
    control.assert(x.num == 13 && lazyAcc == 2, "X1")
    control.assert(y == 12, "X2")
    y = ++recordId(x).num
    control.assert(y == 14 && x.num == 14 && lazyAcc == 3, "X2")

    recordId(x).num >>= 1
    control.assert(x.num == 7, "X3")
    control.assert(lazyAcc == 4, "X4")
}

function testArrIncr() {
    let arr = [1]
    glb1 = 0
    function getarr() {
        glb1++
        return arr
    }
    getarr()[0]++
    control.assert(glb1 == 1)
    control.assert(arr[0] == 2, "t")
    function getarr2() {
        return [1]
    }
    getarr2()[0]++ // make sure it doesn't crash
}

function eqOp() {
    msg("eqOp")
    let x = 12
    control.assert((x += 10) == 22, "Y0")
    control.assert(x == 22, "Y1")
    x /= 2
    control.assert(x == 11, "Y2")

    let s = ("fo" + 1)
    let t = ("ba" + 2)
    s += t
    control.assert(s == "fo1b" + "a2", "fb")
}

function testRec0(): Testrec {
    let testrec = new Testrec();
    testrec.str2 = "Hello" + " world";
    testrec.str = testrec.str2;
    testrec.num = 42;
    control.assert(testrec.str == "Hello world", "recstr");
    control.assert(testrec.num == 42, "recnum");
    msg(testrec.str2);
    let testrec2 = <Testrec>null;
    control.assert(testrec2 == null, "isinv");
    control.assert(testrec == testrec, "eq");
    control.assert(testrec != null, "non inv");
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
    control.assert(glb1 == 18, "inbg0")
    control.assert(rec.str == "foo", "inbg1")
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
    control.assert(x == 55, "55")
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
    control.assert(x == 42 + p * 6, "run2");
    control.assert(coll.length == 2, "run2");
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
    control.assert(sum == 24, "cap")
    msg("testAdd10");
    runTwice(add10);
    msg("end-testAdd10");
    control.assert(sum == 44, "nocap");
    runTwice(add7);
    control.assert(sum == 44 + 14, "glb")
    addX();
    add10();
    control.assert(sum == 44 + 14 + x + 10, "direct");
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
    control.assert(tot == "foo42foo42", "");
    tot = "";
    action = null;
}

function testLazyOps(): void {
    lazyAcc = 0;
    if (incrLazyAcc(10, false) && incrLazyAcc(1, true)) {
        control.assert(false, "");
    } else {
        control.assert(lazyAcc == 10, "lazy1");
    }
    control.assert(lazyAcc == 10, "lazy2");
    if (incrLazyAcc(100, true) && incrLazyAcc(1, false)) {
        control.assert(false, "");
    } else {
        control.assert(lazyAcc == 111, "lazy4");
    }
    lazyAcc = 0;
    if (incrLazyAcc(100, true) && incrLazyAcc(8, true)) {
        control.assert(lazyAcc == 108, "lazy5");
    } else {
        control.assert(false, "");
    }
    lazyAcc = 0;
    if (incrLazyAcc(10, true) || incrLazyAcc(1, true)) {
        control.assert(lazyAcc == 10, "lazy1b");
    } else {
        control.assert(false, "");
    }
    control.assert(lazyAcc == 10, "lazy2xx");
    if (incrLazyAcc(100, false) || incrLazyAcc(1, false)) {
        control.assert(false, "");
    } else {
        control.assert(lazyAcc == 111, "lazy4x");
    }
    lazyAcc = 0;
    if (incrLazyAcc(100, false) || incrLazyAcc(8, true)) {
        control.assert(lazyAcc == 108, "lazy5");
    } else {
        control.assert(false, "");
    }
    lazyAcc = 0;
    if (incrLazyAcc(10, true) && incrLazyAcc(1, true) && incrLazyAcc(100, false)) {
        control.assert(false, "");
    } else {
        control.assert(lazyAcc == 111, "lazy10");
    }
    lazyAcc = 0;
    if (incrLazyAcc(10, true) && incrLazyAcc(1, true) || incrLazyAcc(100, false)) {
        control.assert(lazyAcc == 11, "lazy101");
    } else {
        control.assert(false, "");
    }

    lazyAcc = 0;
    control.assert((true ? incrLazyNum(1, 42) : incrLazyNum(10, 36)) == 42, "?:")
    control.assert(lazyAcc == 1, "?:0");
    control.assert((false ? incrLazyNum(1, 42) : incrLazyNum(10, 36)) == 36, "?:1")
    control.assert(lazyAcc == 11, "?:2");
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
    control.assert(s == "101112", "reflocals");
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
    control.assert(sum == 18, "by ref");
}

function refparamWrite(s: string): void {
    s = s + "c";
    control.assert(s == "abc", "abc");
}

function refparamWrite2(testrec: Testrec): void {
    testrec = new Testrec();
    control.assert(testrec.bool == false, "");
}

function refparamWrite3(testrecX: Testrec): void {
    control.inBackground(() => {
        basic.pause(1);
        control.assert(testrecX.str == "foo", "ff");
        testrecX.str = testrecX.str + "x";
    });
    testrecX = new Testrec();
    testrecX.str = "foo";
    basic.pause(30);
    control.assert(testrecX.str == "foox", "ff2");
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

    toString() {
        return `Foo${this.getPin()}`
    }
}

function testClass() {
    let f = new Foo(272, 100);
    control.assert(f.getPin() == 172, "ctor")
    f.setPin(42)
    control.assert(f.getPin() == 42, "getpin")
}

enum En {
    A,
    B,
    C,
    D = 4200,
    E,
}

enum En2 {
    D0 = En.D,
    D1,
    D2 = 1,
}


function testEnums() {
    msg("enums")

    let k = En.C as number
    control.assert(k == 2, "e0")
    k = En.D as number
    control.assert(k == 4200, "e1")
    k = En.E as number
    control.assert(k == 4201, "e43")

    k = En2.D0 as number
    control.assert(k == 4200, "eX0")
    k = En2.D1 as number
    control.assert(k == 4201, "eX1")

    msg("enums0")
    control.assert(switchA(En.A) == 7, "s1")
    control.assert(switchA(En.B) == 7, "s2")
    control.assert(switchA(En.C) == 12, "s3")
    control.assert(switchA(En.D) == 13, "s4")
    control.assert(switchA(En.E) == 12, "s5")
    control.assert(switchA(-3 as En) == 12, "s6")

    msg("enums1")
    control.assert(switchB(En.A) == 7, "x1")
    control.assert(switchB(En.B) == 7, "x2")
    control.assert(switchB(En.C) == 17, "x3")
    control.assert(switchB(En.D) == 13, "x4")
    control.assert(switchB(En.E) == 14, "x5")

    let kk = 1
    if (kk & En2.D2) {
    } else {
        control.assert(false, "e&")
    }
    kk = 2
    if (kk & En2.D2) {
        control.assert(false, "e&")
    }
}


function switchA(e: En) {
    let r = 12;
    switch (e) {
        case En.A:
        case En.B: return 7;
        case En.D: r = 13; break;
    }
    return r
}

function switchB(e: En) {
    let r = 33;
    switch (e) {
        case En.A:
        case En.B: return 7;
        case En.D: r = 13; break;
        case En.E: r = 14; break;
        default: return 17;
    }
    return r;
}

function testForOf() {
    let arr = [1, 7, 8]
    let sum = 0
    for (let e of arr) {
        sum += (e - 1)
    }
    control.assert(sum == 13, "fo1")

    // make sure we incr reference count of the array during the loop execution
    for (let q of [3, 4, 12]) {
        sum += (q - 2)
    }
    control.assert(sum == 26, "fo2")

    // iteration over a string
    let s = "hello, world!"
    let s2 = ""
    for (let c of s) {
        s2 += c
    }
    control.assert(s == s2, "fo3")

    // mutation of array during iteration
    let fibs = [0, 1]
    for (let x of fibs) {
        if (fibs.length < 10) {
            fibs.push(fibs[fibs.length - 2] + fibs[fibs.length - 1])
        }
    }
    control.assert(fibs.length == 10, "fo4")

    // mutation of array during iteration
    let xs = [10, 9, 8]
    for (let x of xs) {
        control.assert(xs.removeElement(x), "fo5")
    }

    // array concatenation
    let yss = [[1, 2, 3], [4, 5], [6, 7, 8], [9, 10]]
    let concat: number[] = []
    for (let ys of yss) {
        for (let y of ys) {
            concat.push(y)
        }
    }
    control.assert(concat.length == 10, "fo6")

    sum = 0
    for (let y of concat) {
        sum += y
    }
    control.assert(sum == 55, "fo7")
}


class Node<T> {
    v: T;
    k: string;
    next: Node<T>;
}

class Map<T> {
    head: Node<T>;

    getElt(k: string): T {
        return mapGet(this, k)
    }

    setElt(k: string, v: T) {
        mapSet(this, k, v)
    }
}

function mapSet<T>(m: Map<T>, k: string, v: T) {
    for (let p = m.head; p != null; p = p.next) {
        if (p.k == k) {
            p.v = v
            return
        }
    }
    let n = new Node<T>()
    n.next = m.head
    n.k = k
    n.v = v
    m.head = n
}

function mapGet<T>(m: Map<T>, k: string): T {
    for (let p = m.head; p != null; p = p.next) {
        if (p.k == k) {
            return p.v
        }
    }
    return null
}

function testMaps() {
    let m = new Map<number>();
    let q = new Map<string>();

    mapSet(q, "one", "foo" + "bar")
    control.assert(mapGet(q, "one").length == 6, "")

    mapSet(q, "one", "foo2" + "bar")
    control.assert(mapGet(q, "one").length == 7, "")
    q.setElt("two", "x" + "y")
    control.assert(q.getElt("two").length == 2, "")
    q.setElt("two", "x" + "yz")
    control.assert(q.getElt("two").length == 3, "thr")


    mapSet(m, "one", 1)
    control.assert(mapGet(m, "one") == 1, "1")

    mapSet(m, "two", 2)
    control.assert(m.getElt("two") == 2, "2")
    //control.control.assert(mapGet(m, "zzzz") == null, "0")
}

function testComma() {
    glb1 = 0
    let x = (incrBy_2(), 77)
    control.assert(x == 77, "x")
    control.assert(glb1 == 2, "g")
    // make sure there are no leaks
    let y = ("aaa" + "zz", "x" + "yyy")
    control.assert(y.length == 4, "y")
}

function doubleIt(f: (x: number) => number) {
    return f(1) - f(2)
}

function triple(f: (x: number, y: number, z: number) => number) {
    return f(5, 20, 8)
}

function checkLen(f: (x: string) => string, k: number) {
    // make sure strings are GCed
    f("baz")
    let s = f("foo")
    control.assert(s.length == k, "len")
}

function testLambdas() {
    let x = doubleIt(k => {
        return k * 108
    })
    control.assert(x == -108, "l0")
    x = triple((x, y, z) => {
        return x * y + z
    })
    control.assert(x == 108, "l1")
    checkLen((s) => {
        return s + "XY1"
    }, 6)
    checkLen((s) => s + "1212", 7)
}

function testLambdaDecrCapture() {
    let x = 6
    function b(s: string) {
        control.assert(s.length == x)
    }
    b("fo0" + "bAr")
}

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

function testArrayMap() {
    msg("testArrayMap");
    let strs = [1, 2, 3].map(x => "X" + x)
    let r = "A"
    for (let s of strs) {
        r += s
    }
    control.assert(r == "AX1X2X3", "map")

    let flt = [17, 8, 2, 3, 100].filter((x, i) => x == i)
    control.assert(flt.length == 2, "flt")
    control.assert(flt[1] == 3, "flt")

    let sum = [1, 2, 3].reduce((s, v) => s + v, 0)
    control.assert(sum == 6, "red")

    let x = ["A" + "12", "B" + "3"].map((k, i) => k.length + i).reduce((c, n) => c * n, 1)
    control.assert(x == 9, "9")
}

function testInnerLambdaCapture() {
    msg("testInnerLambdaCapture");
    glb1 = 0
    let a = 7
    let g = () => {
        let h = () => {
            glb1 += a
        }
        h()
    }
    g()
    control.assert(glb1 == 7, "7")
}

class StaticCl {
    static x = 12;
    static foo() {
        glb1 += StaticCl.x
    }
    static bar(k: number) {
        StaticCl.x = k
    }
}

function testStatic() {
    msg("testStatic");
    glb1 = 0
    StaticCl.foo()
    control.assert(glb1 == 12, "s0")
    StaticCl.bar(13)
    StaticCl.foo()
    control.assert(glb1 == 25, "s1")
}

class GetSet {
    _x: number;

    get x() {
        glb1++
        return this._x
    }

    set x(v: number) {
        glb1 += 4
        this._x = v
    }
}

function testAccessors() {
    msg("testAccessors")
    glb1 = 0
    let f = new GetSet()
    f.x = 12
    control.assert(glb1 == 4, "s")
    control.assert(f.x == 12, "s12")
    function getf() {
        glb1 += 100
        return f
    }
    getf().x++
    control.assert(glb1 == 110, "s10")
    control.assert(f.x == 13, "s13")
}

class BazClass { }
function testBoolCasts() {
    msg("testBoolCast")
    function boolDie() {
        control.assert(false, "bool casts")
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

function testLazyRef() {
    msg("testLazyRef")
    let x = ("x" + "Y") || "foo"
    let y = "" || "bXr" + "2"
    control.assert(x.length == 2, "two")
    control.assert(y.length == 4, "emp")
    y = null || "foo"
    control.assert(y == "foo", "ln")

    x = "x" + "12x" && "7" + "xx"
    control.assert(x.length == 3, "and")

    x = "" && "blah"
    control.assert(x == "", "andemp")
    x = "foo" && "x" + "Y"
    control.assert(x.length == 2, "twoand")
    x = "x" + "Y" && "bar"
    control.assert(x.length == 3, "threeand")

    let z = 0 || 12
    control.assert(z == 12, "12")
    z = 12 || 13
    control.assert(z == 12, "12.2")
    z = 12 && 13
    control.assert(z == 13, "13")

    let q = new Testrec()
    let r: Testrec = null
    let qq = q && r
    control.assert(qq == null, "&n")
    qq = r && q
    control.assert(qq == null, "&r")
}

function testNull() {
    msg("testNull")
    let x = 0
    let y = 0
    x = null
    control.assert(x == y, "null")
    x = undefined
    control.assert(x == y, "undef")
    y = 1
    control.assert(x != y, "null")
}

function testToString() {
    msg("testToString")
    let f = new Foo(44, 2)
    let s = "" + f
    control.assert(s == "Foo42", "ts")
}

class NestedFun {
    f: () => number;
}

function testComplexCallExpr() {
    msg("testComplexCallExpr")
    let a = new NestedFun()
    a.f = () => 12;

    function bar() {
        return () => 17;
    }

    control.assert(a.f() == 12, "af")
    control.assert(bar()() == 17, "ff")
}

namespace ClassTest {
    class A {
        v: number
        s: string
        foo() {
            glb1++
            this.v = 9
            this.s = "xx" + "z42z"
        }
        bar(v: number, i: string) {
            glb1 += v + this.v
        }
    }

    class B extends A {
        s2: string
        foo() {
            glb1 += 2
            this.v = 10
            this.s2 = "xy" + "z42z"
        }
        bar(v: number, i: string) {
            glb1 += v + parseInt(i) + this.v
        }
    }

    class C extends A {
        foo() {
            glb1 += 3
            this.v = 7
        }
    }

    class D extends C {
        bar(v: number, i: string) {
            glb1 = this.v
            this.v = 13
            super.bar(v, i)
        }
    }

    function testACall(a: A, v0: number, v1: number) {
        glb1 = 0
        a.foo()
        //console.log("foo is " + glb1)
        control.assert(glb1 == v0, "v0")
        a.bar(32, "6" + "4")
        //console.log("bar is " + glb1)
        control.assert(glb1 == v1, "v1")
    }

    export function run() {
        msg("ClassTest.run")
        testACall(new A(), 1, 42)
        testACall(new B(), 2, 108)
        testACall(new C(), 3, 42)
        testACall(new D(), 3, 52)
    }
}

namespace Ctors {
    class A {
        v: number
        s: string
        constructor(k = 12) {
            this.v = k
        }
    }

    class B extends A {
        q: number
        constructor() {
            super()
            this.q = 17
        }
    }

    class C extends B { }
    class D extends A { }

    export function run() {
        msg("Ctors.run")
        let a = new A()
        control.assert(a.v == 12, "A12")
        a = new B()
        control.assert(a.v == 12, "B12")
        control.assert((a as B).q == 17, "B17")
        a = new C()
        control.assert(a.v == 12, "C12")
        control.assert((a as B).q == 17, "C17")
        let d = new D(33)
        control.assert(d.v == 33, "D33")
        d = new D()
        control.assert(d.v == 12, "D12")
    }
}

function testAnySwitch() {
    msg("testAnySwitch")
    function bar(x: number) {
        glb1 += x
        return x
    }
    function testIt(v: number) {
        glb1 = 0
        switch (v) {
            case bar(0): return 1
            default: return 7
            case bar(1): return 2
            case bar(2): return 3
        }
    }
    function ss() {
        return "f7" + "4n"
    }
    function testStr(s: string) {
        switch (s) {
            case "foo": return 0;
            case ss(): return 2;
            case "bar": return 1;
            default: return 7;
        }
    }
    function testQuick(v: number) {
        switch (v) {
            default: return 7
            case 0: return 1
            case 1: return 2
            case bar(2): return 3
            case 3: return 4
            case 4: return 5
            case 5: return 6
        }
    }
    let v = testIt(2)
    control.assert(v == 3, "v3")
    control.assert(glb1 == 3, "v3g")
    v = testIt(0)
    control.assert(v == 1, "v1")
    control.assert(glb1 == 0, "v1g")

    control.assert(testStr("foo") == 0, "f0")
    control.assert(testStr("bar") == 1, "f1")
    control.assert(testStr(ss()) == 2, "f2")

    for (let i = 0; i <= 6; ++i)
        control.assert(testQuick(i) == i + 1, "q")
}

function testLambdasWithMoreParams() {
    function a(f: (x: number, v: string, y: number) => void) {
        f(1, "a" + "X12b", 7)
    }
    a(() => { })
}

namespace Ifaces {
    interface IFoo {
        foo(): number;
        bar(x: number): string;
        baz: string;
    }

    class A {
        constructor() {
            this.baz = "Q" + "A"
        }
        foo() {
            return 12
        }
        bar(v: number) {
            return v.toString()
        }
        baz: string;
    }
    class B extends A {
        foo() {
            return 13
        }
    }

    function foo(f: IFoo) {
        return f.foo() + f.baz + f.bar(42)
    }

    export function run() {
        msg("Ifaces.run")
        let a = new A()
        control.assert(foo(a) + "X" == "12QA42X")
        a = new B()
        control.assert(foo(a) + "X" == "13QA42X")
        let q = a as IFoo
        q.baz = "Z"
        control.assert(foo(q) + "X" == "13Z42X")
    }
}

namespace ObjLit {
    interface Opts {
        width?: number;
        height?: number;
        msg?: string;
    }
    class OptImpl {
        width: number;
        get height() {
            return 33
        }
        get msg() {
            return "X" + "OptImpl"
        }
    }
    function foo(o: Opts) {
        if (!o.msg) {
            o.msg = "None"
        }
        glb1 += o.width - o.height + o.msg.length
        //console.log(`w=${ o.width } h=${ o.height } m=${ o.msg }`)
    }

    export function run() {
        glb1 = 0
        foo({
            width: 12,
            msg: "h" + "w"
        })
        control.assert(glb1 == 14)
        foo({
            width: 12,
            height: 13
        })
        control.assert(glb1 == 17)

        let op: Opts = {}
        op.width = 10
        op.msg = "X" + "Z123"
        foo(op)
        control.assert(glb1 == 17 + 15)

        glb1 = 0
        let v = new OptImpl()
        v.width = 34
        foo(v)
        control.assert(glb1 == 9)
    }
}

function testBitSize() {
    msg("testBitSize")

    u8 = 10 * 100
    control.assert(u8 == 232)
    u8 = 255
    control.assert(u8 == 255)
    i8 = -10
    control.assert(i8 == -10)
    i8 = 127
    control.assert(i8 == 127)
    i8 = -130 * 10 - 1
    control.assert(i8 == -21)
    u16 = 0xffff
    control.assert(u16 == 0xffff)
    u16 = -1
    control.assert(u16 == 0xffff)
    i16 = 1000 * 1000
    control.assert(i16 == 16960)
    i16 = -1000 * 1000
    control.assert(i16 == -16960)
}

namespace ObjectDestructuring {
    class X {
        public a: number;
        public b: string;
        public c: boolean;
        public d: Y;
    }

    class Y {
        public e: number;
        public f: number;
    }

    function testFunction(callBack: (x: X) => void) {
        const test = new X();
        test.a = 17;
        test.b = "okay";
        test.c = true;

        const subTest = new Y();
        subTest.e = 18;
        subTest.f = 19;

        test.d = subTest;

        callBack(test);
    }

    export function run() {
        glb1 = 0;

        testFunction(({}) => {
            glb1 = 1;
        });

        control.assert(glb1 === 1)

        testFunction(({a}) => {
            control.assert(a === 17);
            glb1 = 2;
        })

        control.assert(glb1 === 2);

        testFunction(({a: hello}) => {
            control.assert(hello === 17);
            glb1 = 3;
        })

        control.assert(glb1 === 3);

        testFunction(({a, b, c}) => {
            control.assert(a === 17);
            control.assert(b === "okay");
            control.assert(c);
            glb1 = 4;
        })

        control.assert(glb1 === 4);

        testFunction(({d: {e, f}}) => {
            control.assert(e === 18);
            control.assert(f === 19);
            glb1 = 5;
        })

        control.assert(glb1 === 5);
    }
}


// ---------------------------------------------------------------------------
// Driver starts
// ---------------------------------------------------------------------------

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
testArrIncr()
eqOp()
testEnums()
testForOf()
testMaps()
testComma();
testLambdas();
testLambdaDecrCapture();
testGenRefOuter()
testArrayMap()
testInnerLambdaCapture()
testStatic()
testAccessors()
testBoolCasts()
testLazyRef()
testNull()
testToString()
testComplexCallExpr()
ClassTest.run()
Ctors.run()
testAnySwitch()
testLambdasWithMoreParams()
Ifaces.run()
ObjLit.run()
testBitSize()
ObjectDestructuring.run();


msg("test top level code")
let xsum = 0;
for (let i = 0; i < 11; ++i) {
    xsum = xsum + i;
}
control.assert(xsum == 55, "mainfor")

control.inBackground(() => {
    xsum = xsum + 10;
})

basic.pause(20)
control.assert(xsum == 65, "mainforBg")

control.assert(xyz == 12, "init")

function incrXyz() {
    xyz++;
    return 0;
}
var unusedInit = incrXyz();

control.assert(xyz == 13, "init2")


testClass()

basic.showNumber(1)

/*
msg('test rest')

function rest(...args: number[]): number[] {
    return args;
}

control.assert(rest(0,10,20,30)[1] == 10, "rest");
*/
console.log("ALL TESTS OK")
