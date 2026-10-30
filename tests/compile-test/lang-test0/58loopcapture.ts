// Issue #11563: let loop bindings must be distinct between iterations.
const loopCaptureFunctions: (() => number)[] = [];
for (let i = 0; i < 4; i++) {
    loopCaptureFunctions.push(() => i);
}
assert(loopCaptureFunctions.map(f => f()).join(",") === "0,1,2,3", "loopcapture:top-level");

function testLoopCaptureMutations() {
    const readers: (() => number)[] = [];
    const writers: ((n: number) => void)[] = [];
    for (let i = 0; i < 4; ++i) {
        readers.push(() => i);
        writers.push(n => { i += n; });
    }
    writers[0](10);
    writers[2](20);
    assert(readers.map(f => f()).join(",") === "10,1,22,3", "loopcapture:sibling-sharing");

    const values: (() => number)[] = [];
    for (let i = 0; i < 5; i++) {
        const advance = () => { i++; };
        values.push(() => i);
        advance();
    }
    assert(values.map(f => f()).join(",") === "1,3,5", "loopcapture:body-mutation");

    // A variable declared outside the header is intentionally shared by every closure.
    let outer = 0;
    const shared: (() => number)[] = [];
    for (outer = 0; outer < 3; outer++) shared.push(() => outer);
    assert(shared.map(f => f()).join(",") === "3,3,3", "loopcapture:outer-variable");
}

function testLoopCaptureHeader() {
    const initializers: (() => number)[] = [];
    const conditions: (() => number)[] = [];
    const increments: (() => number)[] = [];
    const bodies: (() => number)[] = [];
    function condition(read: () => number) {
        conditions.push(read);
        return read() < 3;
    }
    function increment(read: () => number) { increments.push(read); }
    for (let i = 0, initial = () => i; condition(() => i); increment(() => i), i++) {
        initializers.push(initial);
        bodies.push(() => i);
    }
    assert(initializers.map(f => f()).join(",") === "0,0,0", "loopcapture:initializer");
    assert(conditions.map(f => f()).join(",") === "0,1,2,3", "loopcapture:condition");
    assert(increments.map(f => f()).join(",") === "1,2,3", "loopcapture:incrementor");
    assert(bodies.map(f => f()).join(",") === "0,1,2", "loopcapture:body");

    let initialRead: () => number;
    let initialWrite: (n: number) => void;
    function initialize(read: () => number, write: (n: number) => void) {
        initialRead = read;
        initialWrite = write;
        return 0;
    }
    const firstConditions: (() => number)[] = [];
    function never(read: () => number) {
        firstConditions.push(read);
        return false;
    }
    for (let i = 7, unused = initialize(() => i, n => { i = n; }); never(() => i); i++) {
        assert(false, "loopcapture:zero-iterations-body");
    }
    initialWrite(9);
    assert(initialRead() === 9 && firstConditions[0]() === 7, "loopcapture:zero-iterations");

    const noIncrement: (() => number)[] = [];
    for (let i = 0; i < 3;) {
        noIncrement.push(() => i);
        i++;
    }
    assert(noIncrement.map(f => f()).join(",") === "1,2,3", "loopcapture:no-incrementor");

    const noCondition: (() => number)[] = [];
    for (let i = 0; ; i++) {
        noCondition.push(() => i);
        if (i === 2) break;
    }
    assert(noCondition.map(f => f()).join(",") === "0,1,2", "loopcapture:no-condition");
}

function testLoopCaptureControlFlow() {
    const reads: (() => number)[] = [];
    for (let i = 0; i < 5; i++) {
        reads.push(() => i);
        if (i === 1) continue;
        if (i === 3) break;
    }
    assert(reads.map(f => f()).join(",") === "0,1,2,3", "loopcapture:continue-break");

    const nested: (() => number)[] = [];
    outerLoop: for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            nested.push(() => 10 * i + j);
            if (j === 1) continue outerLoop;
        }
    }
    assert(nested.map(f => f()).join(",") === "0,1,10,11,20,21", "loopcapture:labeled-continue");

    const broken: (() => number)[] = [];
    outerBreak: for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            broken.push(() => 10 * i + j);
            if (i === 1 && j === 1) break outerBreak;
        }
    }
    assert(broken.map(f => f()).join(",") === "0,1,2,10,11", "loopcapture:labeled-break");

    function returnClosures() {
        const result: (() => number)[] = [];
        for (let i = 0; i < 3; i++) {
            result.push(() => i);
            if (i === 1) return result;
        }
        return result;
    }
    assert(returnClosures().map(f => f()).join(",") === "0,1", "loopcapture:return");

    const thrown: (() => number)[] = [];
    try {
        for (let i = 0; i < 3; i++) {
            thrown.push(() => i);
            if (i === 1) throw "stop";
        }
    } catch (e) {
        assert(e === "stop", "loopcapture:throw-value");
    }
    assert(thrown.map(f => f()).join(",") === "0,1", "loopcapture:throw");

    // Labeled loop/switch emitters define their own break target; a labeled
    // block still needs one from the label wrapper. Check both native paths.
    let visits = 0;
    labeledBlock: {
        labeledWhile: while (visits < 3) {
            visits++;
            break labeledWhile;
        }
        labeledDo: do {
            visits++;
            break labeledDo;
        } while (visits < 3);
        labeledSwitch: switch (visits) {
            case 2: break labeledSwitch;
            default: assert(false, "loopcapture:labeled-switch");
        }
        break labeledBlock;
        visits++;
    }
    assert(visits === 2, "loopcapture:labeled-statements");
}

function testLoopCaptureBindings() {
    const multiple: (() => number)[] = [];
    for (let i = 0, j = 10; i < 3; i++, j += 10) multiple.push(() => i + j);
    assert(multiple.map(f => f()).join(",") === "10,21,32", "loopcapture:multiple-bindings");

    const destructured: (() => number)[] = [];
    for (let { x, y } = { x: 0, y: 10 }; x < 3; x++, y += 10) destructured.push(() => x + y);
    assert(destructured.map(f => f()).join(",") === "10,21,32", "loopcapture:destructuring");

    const factories: (() => () => number)[] = [];
    for (let i = 0; i < 3; i++) factories.push(() => () => i);
    assert(factories.map(f => f()()).join(",") === "0,1,2", "loopcapture:nested-closures");

    const declarations: (() => number)[] = [];
    for (let i = 0; i < 3; i++) {
        function read() { return i; }
        declarations.push(read);
    }
    assert(declarations.map(f => f()).join(",") === "0,1,2", "loopcapture:function-declarations");

    const hoisted: (() => number)[] = [];
    for (let i = 0, initial = () => i; i < 3; i++) {
        hoisted.push(readHoisted);
        function readHoisted() { return i + initial(); }
    }
    assert(hoisted.map(f => f()).join(",") === "0,1,2", "loopcapture:hoisted-declarations");

    const innerHoisted: (() => number)[] = [];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
            innerHoisted.push(readInner);
            function readInner() { return i; }
        }
    }
    assert(innerHoisted.map(f => f()).join(",") === "0,0,1,1,2,2", "loopcapture:nested-hoisting");

    const bodyHoisted: (() => number)[] = [];
    for (let i = 0; i < 3; i++) {
        let value = i * 10;
        bodyHoisted.push(readBody);
        value++;
        function readBody() { return i + value; }
    }
    assert(bodyHoisted.map(f => f()).join(",") === "1,12,23", "loopcapture:body-local-hoisting");
}

function testForOfCapture() {
    const readers: (() => number)[] = [];
    const writers: ((n: number) => void)[] = [];
    for (let value of [1, 12, 23]) {
        readers.push(() => value);
        writers.push(n => { value = n; });
        value++;
        if (value === 13) continue;
    }
    assert(readers.map(f => f()).join(",") === "2,13,24", "loopcapture:forof-mutable");
    writers[0](99);
    assert(readers.map(f => f()).join(",") === "99,13,24", "loopcapture:forof-siblings");

    const constReaders: (() => number)[] = [];
    for (const value of [1, 12, 23]) constReaders.push(() => value);
    assert(constReaders.map(f => f()).join(",") === "1,12,23", "loopcapture:forof-const");

    const hoisted: (() => number)[] = [];
    for (let value of [1, 12, 23]) {
        hoisted.push(readElement);
        value++;
        function readElement() { return value; }
    }
    assert(hoisted.map(f => f()).join(",") === "2,13,24", "loopcapture:forof-hoisting");

    const strings: (() => string)[] = [];
    for (let value of "abc") {
        strings.push(() => value);
        value += "!";
    }
    assert(strings.map(f => f()).join(",") === "a!,b!,c!", "loopcapture:forof-string");

    const referenceReaders: (() => number[])[] = [];
    const referenceWriters: ((v: number[]) => void)[] = [];
    for (let value of [[1], [2], [3]]) {
        referenceReaders.push(() => value);
        referenceWriters.push(v => { value = v; });
    }
    referenceWriters[1]([20]);
    assert(referenceReaders.map(f => f()[0]).join(",") === "1,20,3", "loopcapture:forof-reference");

    const referenceLoop: (() => number[])[] = [];
    for (let value = [0]; value[0] < 3; value = [value[0] + 1]) referenceLoop.push(() => value);
    assert(referenceLoop.map(f => f()[0]).join(",") === "0,1,2", "loopcapture:for-reference");
}

function testLoopBodyCapture() {
    const readers: (() => number)[] = [];
    const writers: ((n: number) => void)[] = [];
    let index = 0;
    while (index < 3) {
        let value = index++;
        readers.push(() => value);
        writers.push(n => { value = n; });
    }
    writers[1](10);
    assert(readers.map(f => f()).join(",") === "0,10,2", "loopcapture:while-body");
    do {
        let value = index++;
        readers.push(() => value);
        writers.push(n => { value = n; });
    } while (index < 5);
    writers[3](30);
    assert(readers.map(f => f()).join(",") === "0,10,2,30,4", "loopcapture:do-body");
}

class LoopCaptureMethod {
    constructor(public value: number) { }

    collectThisFirst(): (() => number)[] {
        const readers: (() => number)[] = [];
        for (let i = 0; i < 3; i++) {
            readers.push(read);
            // The synthetic thisParameter is captured before the loop variable.
            // @ts-ignore: The ES5 checker rejects block functions in class methods (TS1251).
            function read() { return this.value + i; }
        }
        return readers;
    }

    collectIndexFirst(): (() => number)[] {
        const readers: (() => number)[] = [];
        for (let i = 0; i < 3; i++) {
            readers.push(read);
            // @ts-ignore: The ES5 checker rejects block functions in class methods (TS1251).
            function read() { return i + this.value; }
        }
        return readers;
    }

    collectBodyLocal(): (() => number)[] {
        const readers: (() => number)[] = [];
        for (let i = 0; i < 3; i++) {
            let value = i * 10;
            readers.push(read);
            value++;
            // This capture is inside the block, so wait for its declaration.
            // @ts-ignore: The ES5 checker rejects block functions in class methods (TS1251).
            function read() { return this.value + i + value; }
        }
        return readers;
    }

    collectThisOnly(): (() => number)[] {
        const readers: (() => number)[] = [];
        for (let i = 0; i < 3; i++) {
            readers.push(read);
            // @ts-ignore: The ES5 checker rejects block functions in class methods (TS1251).
            function read() { return this.value; }
        }
        return readers;
    }
}

function testLoopCaptureMethods() {
    const instance = new LoopCaptureMethod(10);
    const thisFirst = instance.collectThisFirst();
    const indexFirst = instance.collectIndexFirst();
    const thisValues = thisFirst.map(f => f()).join(",");
    const indexValues = indexFirst.map(f => f()).join(",");
    assert(thisValues === "10,11,12", "loopcapture:method-this-first " + thisValues);
    assert(indexValues === "10,11,12", "loopcapture:method-index-first " + indexValues);
    assert(instance.collectBodyLocal().map(f => f()).join(",") === "11,22,33", "loopcapture:method-body-local");
    const thisOnly = instance.collectThisOnly();
    assert(thisOnly[0] !== thisOnly[1] && thisOnly[1] !== thisOnly[2], "loopcapture:method-this-only");
    instance.value = 20;
    assert(thisFirst.map(f => f()).join(",") === "20,21,22", "loopcapture:method-live-this");
}

testLoopCaptureMutations();
testLoopCaptureHeader();
testLoopCaptureControlFlow();
testLoopCaptureBindings();
testForOfCapture();
testLoopBodyCapture();
testLoopCaptureMethods();
msg("loop capture passed");