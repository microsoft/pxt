var glb1: number;
var s2: string;
var x: number;
var action: Action;
var tot: string;
var lazyAcc: number;
var sum: number;


export function main(): void {
    console.log("Starting...")


    //lib.print_17(3);
    showDigit(0);
    //assert(lib3.getX() == 17 * 3, "");
    showDigit(3);
    testNums();
    testStrings();
    testNumCollection();
    showDigit(2);
    testStringCollection();
    testStringOps();
    showDigit(4);
    testReccoll();
    showDigit(5);
    inBg();
    testAction(1);
    showDigit(6);
    testAction(7);
    testIter();
    testActionSave();
    testLazyOps();
    testRefLocals();
    testByRefParams();

    /*
    msg("start mem test");
    testMemoryFree();
    msg("start 2nd mem test");
    testMemoryFreeHOF();
    msg("stop mem test");
    assert(enumAdd("two", 2) == 4, "enum");
    let x = enumAdd2("size", 0);
    assert(x == 10, "enum2");
    assert(enumAdd2("pi", 0) == 3, "enum3");
    assert(tdid("two") == 2, "tdid");
    showDigit(9);
    //TD.basic.showLeds("0 1 0 1 0\n0 0 0 0 0\n0 0 1 0 0\n1 0 0 0 1\n0 1 1 1 0", 400);
    */

    showDigit(1);
}

function testNums(): void {
    let x = 40 + 2;
    assert(x == 42, "add");
    x = 40 / 2;
    assert(x == 20, "div");
    showDigit(7);
    let r = fib(15);
    msg("FIB" + r);
    showDigit(8);
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
}



function assert(cond: boolean, msg_: string) {
    if (!cond) {
        msg("ASSERT: " + msg_);
        panic(45);
    }
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

/**
 * Stop the micro:bit program and display given error code.
 * {shim:uBit.panic}
 */
function panic(code2: number): void {
}

/**
 * Show the number
 * {shim:micro_bit::showDigit}
 */
function showDigit(code2: number): void {
}

/**
 * Print message
 */
function msg(s: string): void {
    console.log(s)
    basic.pause(50);
}

function testIf(): void {
    let b = false;
    if (!b) {
        glb1 = 7;
    }
    else {
        assert(false, "b0");
    }
    assert(glb1 == 7, "glb3");
    if (b) {
        assert(false, "b1");
    }
    else {
        glb1 = 8;
    }
    assert(glb1 == 8, "glb3");
}

/**
 * {shim:TD_ID}
 * {enum:s:one=1,two=2,three=3}
 */
function tdid(s: string): number {
    return 0;
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
}


function testNumCollection(): void {
    let coll: number[] = [];
    assert(coll.length == 0, "");
    coll.push(42);
    assert(coll.length == 1, "");
    coll.push(22);
    assert(coll[1] == 22, "");
    coll.splice(0, 1);
    assert(coll[0] == 22, "");
    coll.removeElement(22);
    assert(coll.length == 0, "");
    for (let i = 0; i < 100; i++) {
        coll.push(i);
    }
    assert(coll.length == 100, "");

    coll = [1, 2, 3];
    assert(coll.length == 3, "cons");
    assert(coll[0] == 1, "cons0");
    assert(coll[1] == 2, "cons1");
    assert(coll[2] == 3, "cons2");
}

function testStringCollection(): void {
    let coll = (<string[]>[]);
    coll.push("foobar");
    coll.push((12).toString());
    coll.push(coll[0] + "xx");
    assert(coll.indexOf("12", 0) == 1, "idx");
    coll = [
        "a" + "b",
        coll[2],
    ]
    assert(coll[0] == "ab", "")
    assert(coll[1] == "foobarxx", "")
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
    basic.pause(50)
    assert(glb1 == 17, "inbg0")
    assert(rec.str == "foo", "inbg1")
}

function runTwice(fn: Action): void {
    msg("r2 start");
    fn();
    fn();
}

function iter(max: number, fn: (v: number) => void) {
    for (var i = 0; i < max; ++i)
        fn(i);
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
    let coll = (<number[]>[]);
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
    action = (<Action>null);
}

function testLazyOps(): void {
    lazyAcc = 0;
    if (incrLazyAcc(10, false) && incrLazyAcc(1, true)) {
        assert(false, "");
    }
    else {
        assert(lazyAcc == 10, "lazy1");
    }
    assert(lazyAcc == 10, "lazy2");
    if (incrLazyAcc(100, true) && incrLazyAcc(1, false)) {
        assert(false, "");
    }
    else {
        assert(lazyAcc == 111, "lazy4");
    }
    lazyAcc = 0;
    if (incrLazyAcc(100, true) && incrLazyAcc(8, true)) {
        assert(lazyAcc == 108, "lazy5");
    }
    else {
        assert(false, "");
    }
    lazyAcc = 0;
    if (incrLazyAcc(10, true) || incrLazyAcc(1, true)) {
        assert(lazyAcc == 10, "lazy1b");
    }
    else {
        assert(false, "");
    }
    assert(lazyAcc == 10, "lazy2xx");
    if (incrLazyAcc(100, false) || incrLazyAcc(1, false)) {
        assert(false, "");
    }
    else {
        assert(lazyAcc == 111, "lazy4x");
    }
    lazyAcc = 0;
    if (incrLazyAcc(100, false) || incrLazyAcc(8, true)) {
        assert(lazyAcc == 108, "lazy5");
    }
    else {
        assert(false, "");
    }
    lazyAcc = 0;
    if (incrLazyAcc(10, true) && incrLazyAcc(1, true) && incrLazyAcc(100, false)) {
        assert(false, "");
    }
    else {
        assert(lazyAcc == 111, "lazy10");
    }
    lazyAcc = 0;
    if (incrLazyAcc(10, true) && incrLazyAcc(1, true) || incrLazyAcc(100, false)) {
        assert(lazyAcc == 11, "lazy101");
    }
    else {
        assert(false, "");
    }
}

function incrLazyAcc(delta: number, res: boolean): boolean {
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
    console.log("A0")
    refparamWrite("a" + "b");
    console.log("A1")
    refparamWrite2(new Testrec());
    console.log("A2")
    refparamWrite3(new Testrec());
    console.log("A3")
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

function refparamWrite3(testrec: Testrec): void {
    control.inBackground(() => {
        basic.pause(1);
        assert(testrec.str == "foo", "ff");
        testrec.str = testrec.str + "x";
    });
    testrec = new Testrec();
    testrec.str = "foo";
    basic.pause(30);
    assert(testrec.str == "foox", "ff");
}


/*


function testMemoryFree() : void
{
    for (let i = 0; i < 1000; i++) {
        allocImage();
    }
}

function runOnce(fn:Action) : void
{
    fn();
}

function testMemoryFreeHOF() : void
{
    for (let i = 0; i < 1000; i++) {
        runOnce(() => {
            // let img = image.createImage("0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1\n0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0\n0 0 1 1 0 0 0 1 1 0 0 0 1 1 0 0 0 1 1 0\n0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0\n0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0");
        });
    }
}

function allocImage() : void
{
    // let img = image.createImage("0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1\n0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0\n0 0 1 1 0 0 0 1 1 0 0 0 1 1 0 0 0 1 1 0\n0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0\n0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0");
}

*/
