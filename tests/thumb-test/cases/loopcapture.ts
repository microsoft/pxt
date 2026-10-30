let loopCaptureTotal = 0;

function captureFor() {
    const readers: (() => number)[] = [];
    for (let i = 0; i < 4; i++) {
        readers.push(() => i);
        if (i === 1) continue;
        loopCaptureTotal += i;
    }
    return readers[0]() + readers[3]();
}

function captureForOf() {
    const readers: (() => number[])[] = [];
    for (let value of [[0], [1], [2]]) {
        readers.push(() => value);
        value = [value[0] + 10];
    }
    return readers[0]()[0] + readers[2]()[0];
}

function plainLoop() {
    let sum = 0;
    for (let i = 0; i < 4; i++) sum += i;
    for (let value of [1, 2]) sum += value;
    return sum;
}

function constCapture() {
    const readers: (() => number)[] = [];
    for (const value of [1, 2, 3]) readers.push(() => value);
    return readers[0]() + readers[2]();
}

function captureHoisted() {
    const readers: (() => number)[] = [];
    for (let i = 0; i < 3; i++) {
        readers.push(readIteration);
        function readIteration() { return i; }
    }
    return readers[0]() + readers[2]();
}

// Calls remain observable and separate from the generated loop bodies.
loopCaptureTotal = captureFor() + captureForOf() + plainLoop() + constCapture() + captureHoisted();
console.log(loopCaptureTotal);