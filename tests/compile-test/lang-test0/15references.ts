

function testRefLocals(): void {
    msg("start test ref locals");
    let s = "";
    // For 4 or more it runs out of memory
    for (let i = 0; i < 3; i++) {
        msg(i + "");
        let copy = i;
        control.runInBackground(() => {
            pause(10 * i);
            copy = copy + 10;
        });
        control.runInBackground(() => {
            pause(20 * i);
            s = s + copy;
        });
    }
    pause(200);
    assert(s == "101112", "reflocals");
}

function byRefParam_0(p: number): void {
    control.runInBackground(() => {
        pause(1);
        sum = sum + p;
    });
    p = p + 1;
}

function byRefParam_2(pxx: number): void {
    pxx = pxx + 1;
    control.runInBackground(() => {
        pause(1);
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
        pause(1);
        sum = sum + x;
    });
    x = 2;
    byRefParam_0(4);
    byRefParam_2(10);
    pause(330);
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
        pause(1);
        assert(testrecX.str == "foo", "ff");
        testrecX.str = testrecX.str + "x";
    });
    testrecX = new Testrec();
    testrecX.str = "foo";
    pause(130);
    assert(testrecX.str == "foox", "ff2");
}

function allocImage(): void {
    let tmp = createObj();
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

testMemoryFreeHOF();


function testMemoryFree(): void {
    msg("testMemoryFree");
    for (let i = 0; i < 1000; i++) {
        allocImage();
    }
}


testRefLocals();
testByRefParams();
testMemoryFree();
