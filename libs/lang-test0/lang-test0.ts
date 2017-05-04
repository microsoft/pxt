//
// Note that this is supposed to run from command line.
// Do not use anything besides control.pause, control.runInBackground, console.log
//

control.pause(2000)

function msg(s: string): void {
    serial.writeString(s)
    serial.writeString("\n")
    //control.pause(50);
}

msg("start!")

function assert(cond: boolean, m?: string) {
    if (!cond) {
        msg("assertion failed: ")
        if (m)
            msg(m)
        while (1) {
            control.pause(1000)
        }
    }
}

//
// start tests
//

let glb1: number;
let s2: string;
let x: number;
let action: Action;
let tot: string;
let lazyAcc: number;
let sum: number;
let u8: uint8
let i8: int8
let u16: uint16
let i16: int16

let xyz = 12;


let hasFloat = true
if ((1 / 10) == 0) {
    hasFloat = false
}


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
    msg("TN")
    let z = 12
    msg("ZZ" + z);
    let x = 40 + 2;
    assert(x == 42, "add");
    x = 40 / 2;
    assert(x == 20, "div");
    let r = fib(15);
    msg("FB")
    msg("FIB" + r);
    assert(r == 987, "fib");
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
    assert((-10 >> 2) == -3, ">>")
    assert((-10 >>> 20) == 4095, ">>>")
    assert((-10 << 2) == -40, "<<")
    assert((10 << 2) == 40, "<<+")
    assert((10 >> 2) == 2, ">>+")
    assert((10 >>> 2) == 2, ">>>+")
    if (!hasFloat) {
        assert(1000000 * 1000000 == -727379968, "*")
        assert(100000001 * 100000001 == 2074919425, "*2")
    }
    msg("nums#4")

    assert(105 % 100 == 5, "perc")

    // test number->bool conversion, #1057
    // x==20 here
    if (!x) {
        assert(false, "wrong bang")
    }
    msg("nums#5")
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
    msg("testStrings")
    assert((42).toString() == "42", "42");

    msg("ts0x")
    let s = "live";
    assert(s == "live", "hello eq");
    msg("ts0y")

    s = s + "4OK";
    s2 = s;
    msg("ts0")
    assert(s.charCodeAt(4) == 52, "hello eq2");
    assert(s.charAt(4) == "4", "hello eq2X");
    assert(s[4] == "4", "hello eq2X");
    assert(s.length == 7, "len7");
    msg("ts0")
    s = "";

    control.pause(3)
    for (let i = 0; i < 10; i++) {
        msg("Y")
        s = s + i;
        msg(s)
    }
    assert(s == "0123456789", "for");
    let x = 10;
    s = "";
    while (x >= 0) {
        msg("X")
        s = s + x;
        x = x - 1;
    }
    assert(s == "109876543210", "while");
    msg(s);
    msg(s2);

    s2 = "";
    // don't leak ref

    x = 21
    s = "foo"
    s = `a${x * 2}X${s}X${s}Z`
    assert(s == "a42XfooXfoo" + "Z", "`")

    msg("X" + true)

    assert("X" + true == "Xt" + "rue", "boolStr")
    msg("testStrings DONE")
}


function testNumCollection(): void {
    msg("test num coll")
    let collXYZ: number[] = [];
    assert(collXYZ.length == 0, "");
    collXYZ.push(42);
    msg("#1")
    assert(collXYZ.length == 1, "");
    collXYZ.push(22);
    assert(collXYZ[1] == 22, "");
    msg("#2")
    collXYZ.splice(0, 1);
    msg("#2")
    assert(collXYZ[0] == 22, "");
    msg("#2")
    collXYZ.removeElement(22);
    msg("#2")
    assert(collXYZ.length == 0, "");
    msg("loop")
    for (let i = 0; i < 100; i++) {
        collXYZ.push(i);
    }
    assert(collXYZ.length == 100, "");

    collXYZ = [1, 2, 3];
    assert(collXYZ.length == 3, "cons");
    assert(collXYZ[0] == 1, "cons0");
    assert(collXYZ[1] == 2, "cons1");
    assert(collXYZ[2] == 3, "cons2");
    msg("loop done")
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
    msg("postPref")
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
    lazyAcc = 0
}

function testArrIncr() {
    let arr = [1]
    glb1 = 0
    function getarr() {
        glb1++
        return arr
    }
    getarr()[0]++
    assert(glb1 == 1)
    assert(arr[0] == 2, "t")
    function getarr2() {
        return [1]
    }
    getarr2()[0]++ // make sure it doesn't crash
}

function eqOp() {
    msg("eqOp")
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
    control.runInBackground(() => {
        glb1 = glb1 + 10 + (q - k)
        rec.str = "foo"
    })
    control.runInBackground(() => {
        glb1 = glb1 + 1
    })
    control.pause(50)
    assert(glb1 == 18, "inbg0")
    assert(rec.str == "foo", "inbg1")
    glb1 = 0
}

function runTwice(fn: Action): void {
    msg("r2 start");
    fn();
    fn();
    msg("r2 stop");
}

function iter(max: number, fn: (v: number) => void) {
    for (let i = 0; i < max; ++i) {
        fn(i);
    }
}

function testIter() {
    x = 0
    iter(10, v => {
        x = x + (v + 1)
    })
    assert(x == 55, "55")
    x = 0
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
    x = 0
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
    sum = 0
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
    msg("testing lazy")
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
    lazyAcc = 0

    msg("testing lazy done")
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
        control.runInBackground(() => {
            control.pause(10 * i);
            copy = copy + 10;
        });
        control.runInBackground(() => {
            control.pause(20 * i);
            s = s + copy;
        });
    }
    control.pause(200);
    assert(s == "101112", "reflocals");
}

function byRefParam_0(p: number): void {
    control.runInBackground(() => {
        control.pause(1);
        sum = sum + p;
    });
    p = p + 1;
}

function byRefParam_2(pxx: number): void {
    pxx = pxx + 1;
    control.runInBackground(() => {
        control.pause(1);
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
    control.runInBackground(() => {
        control.pause(1);
        sum = sum + x;
    });
    x = 2;
    byRefParam_0(4);
    byRefParam_2(10);
    control.pause(30);
    assert(sum == 18, "by ref");
    sum = 0
    msg("byref done")
}

function refparamWrite(s: string): void {
    s = s + "c";
    assert(s == "abc", "abc");
}

function refparamWrite2(testrec: Testrec): void {
    testrec = new Testrec();
    if (hasFloat)
        assert(testrec.bool === undefined, "rw2f");
    else
        assert(testrec.bool == false, "rw2");
}

function refparamWrite3(testrecX: Testrec): void {
    control.runInBackground(() => {
        control.pause(1);
        assert(testrecX.str == "foo", "ff");
        testrecX.str = testrecX.str + "x";
    });
    testrecX = new Testrec();
    testrecX.str = "foo";
    control.pause(30);
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

    toString() {
        return `Foo${this.getPin()}`
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
    assert(k == 2, "e0")
    k = En.D as number
    assert(k == 4200, "e1")
    k = En.E as number
    assert(k == 4201, "e43")

    k = En2.D0 as number
    assert(k == 4200, "eX0")
    k = En2.D1 as number
    assert(k == 4201, "eX1")

    msg("enums0")
    assert(switchA(En.A) == 7, "s1")
    assert(switchA(En.B) == 7, "s2")
    assert(switchA((3 - 2) as En) == 7, "s2")
    assert(switchA(En.C) == 12, "s3")
    assert(switchA(En.D) == 13, "s4")
    assert(switchA(En.E) == 12, "s5")
    assert(switchA(-3 as En) == 12, "s6")

    msg("enums1")
    assert(switchB(En.A) == 7, "x1")
    assert(switchB(En.B) == 7, "x2")
    assert(switchB(En.C) == 17, "x3")
    assert(switchB(En.D) == 13, "x4")
    assert(switchB(En.E) == 14, "x5")

    control.pause(3)

    let kk = 1
    if (kk & En2.D2) {
    } else {
        assert(false, "e&")
    }
    kk = 2
    if (kk & En2.D2) {
        assert(false, "e&")
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
        msg("FO:" + e)
        sum += (e - 1)
    }
    assert(sum == 13, "fo1")
    msg("loop1 done")

    // make sure we incr reference count of the array during the loop execution
    for (let q of [3, 4, 12]) {
        sum += (q - 2)
    }
    assert(sum == 26, "fo2")

    // iteration over a string
    let s = "hello, world!"
    let s2 = ""
    for (let c of s) {
        s2 += c
    }
    assert(s == s2, "fo3")

    // mutation of array during iteration
    let fibs = [0, 1]
    for (let x of fibs) {
        if (fibs.length < 10) {
            fibs.push(fibs[fibs.length - 2] + fibs[fibs.length - 1])
        }
    }
    assert(fibs.length == 10, "fo4")

    // mutation of array during iteration
    let xs = [10, 9, 8]
    for (let x of xs) {
        assert(xs.removeElement(x), "fo5")
    }

    // array concatenation
    let yss = [[1, 2, 3], [4, 5], [6, 7, 8], [9, 10]]
    let concat: number[] = []
    for (let ys of yss) {
        for (let y of ys) {
            concat.push(y)
        }
    }
    assert(concat.length == 10, "fo6")

    sum = 0
    for (let y of concat) {
        sum += y
    }
    assert(sum == 55, "fo7")

    msg("for of done")
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


function search_array<T>(a: T[], item: T): number {
    for (let i = 0; i < a.length; i++) {
        if (a[i] == item) {
            return i
        }
    }
    return -1 // NOT FOUND
}

class MyMap<K, V> {

    keys: K[]
    values: V[]

    constructor() {
        this.keys = []
        this.values = []
    }

    push(key: K, value: V) {
        this.keys.push(key)
        this.values.push(value)
    }

    value_for(key: K): V {
        let i = search_array(this.keys, key)
        if (i == -1) {
            return null
        }
        return this.values[i]
    }

    key_for(value: V): K {
        let i = search_array(this.values, value)
        if (i == -1) {
            return null
        }
        return this.keys[i]
    }
    set(key: K, value: V): void {
        let i = search_array(this.keys, key)
        if (i == -1) {
            this.keys.push(key)
            this.values.push(value)
        } else {
            this.values[i] = value
        }
    }

    has_key(key: K): boolean {
        return search_array(this.keys, key) != -1
    }

    has_value(value: V): boolean {
        return search_array(this.values, value) != -1
    }

}


function testMaps() {
    let m = new Map<number>();
    let q = new Map<string>();
    let r = new MyMap<number, string>()

    mapSet(q, "one", "foo" + "bar")
    assert(mapGet(q, "one").length == 6, "")

    mapSet(q, "one", "foo2" + "bar")
    assert(mapGet(q, "one").length == 7, "")
    q.setElt("two", "x" + "y")
    assert(q.getElt("two").length == 2, "")
    q.setElt("two", "x" + "yz")
    assert(q.getElt("two").length == 3, "thr")


    mapSet(m, "one", 1)
    assert(mapGet(m, "one") == 1, "1")

    mapSet(m, "two", 2)
    assert(m.getElt("two") == 2, "2")
    //control.assert(mapGet(m, "zzzz") == null, "0")
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
    assert(s.length == k, "len")
}

function testLambdas() {
    let x = doubleIt(k => {
        return k * 108
    })
    assert(x == -108, "l0")
    x = triple((x, y, z) => {
        return x * y + z
    })
    assert(x == 108, "l1")
    checkLen((s) => {
        return s + "XY1"
    }, 6)
    checkLen((s) => s + "1212", 7)
}

function testLambdaDecrCapture() {
    let x = 6
    function b(s: string) {
        assert(s.length == x)
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
    assert(r == "AX1X2X3", "map")

    let flt = [17, 8, 2, 3, 100].filter((x, i) => x == i)
    assert(flt.length == 2, "flt")
    assert(flt[1] == 3, "flt")

    let sum = [1, 2, 3].reduce((s, v) => s + v, 0)
    assert(sum == 6, "red")

    let x = ["A" + "12", "B" + "3"].map((k, i) => k.length + i).reduce((c, n) => c * n, 1)
    assert(x == 9, "9")
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
    assert(glb1 == 7, "7")
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
    assert(glb1 == 12, "s0")
    StaticCl.bar(13)
    StaticCl.foo()
    assert(glb1 == 25, "s1")
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
    assert(glb1 == 4, "s")
    assert(f.x == 12, "s12")
    function getf() {
        glb1 += 100
        return f
    }
    getf().x++
    assert(glb1 == 110, "s10")
    assert(f.x == 13, "s13")
}

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

function testLazyRef() {
    msg("testLazyRef")
    let x = ("x" + "Y") || "foo"
    let y = "" || "bXr" + "2"
    assert(x.length == 2, "two")
    assert(y.length == 4, "emp")
    y = null || "foo"
    assert(y == "foo", "ln")

    x = "x" + "12x" && "7" + "xx"
    assert(x.length == 3, "and")

    x = "" && "blah"
    assert(x == "", "andemp")
    x = "foo" && "x" + "Y"
    assert(x.length == 2, "twoand")
    x = "x" + "Y" && "bar"
    assert(x.length == 3, "threeand")

    let z = 0 || 12
    assert(z == 12, "12")
    z = 12 || 13
    assert(z == 12, "12.2")
    z = 12 && 13
    assert(z == 13, "13")

    let q = new Testrec()
    let r: Testrec = null
    let qq = q && r
    assert(qq == null, "&n")
    qq = r && q
    assert(qq == null, "&r")
}

function testNullJS() {
    let x: number
    assert(x === undefined, "undef0")
    assert(x == null, "null0")
    x = null
    assert(x === null, "null1")
    assert(x == undefined, "undef1")
    x = 0
    assert(x != null, "null2")
}

function testNull() {
    msg("testNull")
    if (hasFloat) {
        testNullJS()
        return
    }
    let x = 0
    let y = 0
    x = null
    assert(x == y, "null")
    x = undefined
    assert(x == y, "undef")
    y = 1
    assert(x != y, "null")
}

function testToString() {
    msg("testToString")
    let f = new Foo(44, 2)
    let s = "" + f
    assert(s == "Foo42", "ts")
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

    assert(a.f() == 12, "af")
    assert(bar()() == 17, "ff")
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

    class E {
        foo() { }
    }

    class F extends E {
        foo() { }
    }

    function testACall(a: A, v0: number, v1: number) {
        glb1 = 0
        a.foo()
        //console.log("foo is " + glb1)
        assert(glb1 == v0, "v0")
        a.bar(32, "6" + "4")
        //console.log("bar is " + glb1)
        assert(glb1 == v1, "v1")
    }

    export function run() {
        msg("ClassTest.run")
        let f = new F()
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
        assert(a.v == 12, "A12")
        a = new B()
        assert(a.v == 12, "B12")
        // downcasts outlawed for now
        //assert((a as B).q == 17, "B17")
        a = new C()
        assert(a.v == 12, "C12")
        // downcasts outlawed for now
        //assert((a as B).q == 17, "C17")
        let d = new D(33)
        assert(d.v == 33, "D33")
        d = new D()
        assert(d.v == 12, "D12")
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
    assert(v == 3, "v3")
    assert(glb1 == 3, "v3g")
    v = testIt(0)
    assert(v == 1, "v1")
    assert(glb1 == 0, "v1g")

    assert(testStr("foo") == 0, "f0")
    assert(testStr("bar") == 1, "f1")
    assert(testStr(ss()) == 2, "f2")

    for (let i = 0; i <= 6; ++i)
        assert(testQuick(i) == i + 1, "q")
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
        assert(foo(a) + "X" == "12QA42X")
        a = new B()
        assert(foo(a) + "X" == "13QA42X")
        let q = a as IFoo
        q.baz = "Z"
        assert(foo(q) + "X" == "13Z42X")
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
        assert(glb1 == 14)
        foo({
            width: 12,
            height: 13
        })
        assert(glb1 == 17)

        let op: Opts = {}
        op.width = 10
        op.msg = "X" + "Z123"
        foo(op)
        assert(glb1 == 17 + 15)

        glb1 = 0
        let v = new OptImpl()
        v.width = 34
        foo(v)
        assert(glb1 == 9)
    }
}

function testBitSize() {
    msg("testBitSize")

    u8 = 10 * 100
    assert(u8 == 232, "bs0")
    u8 = 255
    assert(u8 == 255, "bs1")
    i8 = -10
    assert(i8 == -10, "bs2")
    i8 = 127
    assert(i8 == 127, "bs3")
    i8 = -130 * 10 - 1
    assert(i8 == -21, "bs4")
    u16 = 0xffff
    assert(u16 == 0xffff, "bs5")
    u16 = -1
    assert(u16 == 0xffff, "bs6")
    i16 = 1000 * 1000
    assert(i16 == 16960, "bs7")
    i16 = -1000 * 1000
    assert(i16 == -16960, "bs8")

    msg("testBitSize DONE")
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

        assert(glb1 === 1)

        testFunction(({a}) => {
            assert(a === 17);
            glb1 = 2;
        })

        assert(glb1 === 2);

        testFunction(({a: hello}) => {
            assert(hello === 17);
            glb1 = 3;
        })

        assert(glb1 === 3);

        testFunction(({a, b, c}) => {
            assert(a === 17);
            assert(b === "okay");
            assert(c);
            glb1 = 4;
        })

        assert(glb1 === 4);

        testFunction(({d: {e, f}}) => {
            assert(e === 18);
            assert(f === 19);
            glb1 = 5;
        })

        assert(glb1 === 5);
    }
}

function testFloat() {
    if (!hasFloat)
        return
    let v = 13/32
    v *= 32
    assert(v == 13, "/")
    for (let i = 0; i < 20; ++i) {
        v *= 10000
    }
    //assert(v > 1e81, "81")
}

function clean() {
    glb1 = 0
    s2 = ""
    x = 0
    action = null
    tot = ""
    lazyAcc = 0
    sum = 0
}

namespace Generics {

    function swap<T>(arr: T[], i : number, j: number) : void {
        let temp : T = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }

    function sortHelper<T>(arr: T[], callbackfn ?: (value1: T, value2: T) => number) : T[] {
        if (arr.length <= 0 || !callbackfn) {
            return arr;
        }
        let len = arr.length; 
        // simple selection sort.     
        for (let i = 0; i < len - 1; ++i) {
            for (let j = i + 1; j < len; ++j)
            {
                if (callbackfn(arr[i], arr[j]) > 0) {
                    swap(arr, i, j);
                }
            }
        }
        return arr;
    }

    export function arraySort<T>(arr: T[], callbackfn?: (value1: T, value2: T) => number): T[] {
        return sortHelper(arr, callbackfn);
    }
}

function testGenerics() {
    msg("testGenerics")
    let inArray = [4,3,4593,23,43,-1]
    Generics.arraySort(inArray, (x: number, y: number) => { return x - y })
    let expectedArray = [-1,3,4,23,43,4593]
    for(let i = 0 ; i < expectedArray.length; i++) {
        assert(inArray[i] == expectedArray[i])
    }
}

namespace AnonymousTypes {

    class Foo {
        a: number;
        private b: number;
        bar() { return this.b; }
        constructor(inp: number){
            this.a = inp
            this.b = inp + 1
        }
    }

    function foo(f: { a: number }) {
       return f.a + 1
    }
    export function test() {
        msg("AnonymousTypes")
        let x = { a: 2, b: "bar" }
        let nested = { a: { b: { c: 3 } } }

        let bar = new Foo(42)
        let baz: {a: number} = bar
        assert(nested.a.b.c == 3)
        assert(x.a == 2);
        assert(x.b == "bar");
        assert(foo(x) == 3)
        assert(foo(bar) == 43);
        assert(bar.bar() == 43)
        assert(foo(baz) == 43)
        // HUH bar(40) - new (expects any)
    }
}

namespace LambdaProperty {

    interface IFoo {
        y: number;
        z: number;
        bar: () => number;
        baz: (i:number) => number;
    }

    let x: IFoo = {
        y: 3, z: 4, bar: () => {
            return 0
        }, baz: (i: number) => i + 1
    }

    x.bar = () => {
        return x.y
    }

    export function test() {
        assert(x.bar() == 3);
        assert(x.baz(42) == 43);
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
testFloat()
testGenerics()
AnonymousTypes.test()
LambdaProperty.test()

msg("test top level code")
let xsum = 0;
let forclean = () => {}
for (let i = 0; i < 11; ++i) {
    xsum = xsum + i;
    forclean = () => { i = 0 }
}
forclean()
forclean = null
assert(xsum == 55, "mainfor")

control.runInBackground(() => {
    xsum = xsum + 10;
})

control.pause(20)
assert(xsum == 65, "mainforBg")
xsum = 0

assert(xyz == 12, "init")

function incrXyz() {
    xyz++;
    return 0;
}
let unusedInit = incrXyz();

assert(xyz == 13, "init2")
xyz = 0


testClass()

clean()
msg("test OK!")
