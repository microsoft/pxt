let xs = [13, 42, 73]

for (let x in xs) {} // TS9202 0, 1, 2
for (let x of xs) {} // Now supported!

for (let c of "hello") {} // Only arrays or strings can be iterated over

for (let x of xs) {
    //The array can be mutated during iteration
    if (x == 73) {
        xs.push(0)
    }
}

//This segment can be verified on the micro:bit (uncomment the basic.showNumber line) and simulator
let fib = [0, 1]
for (let x of fib) {
    if (fib.length < 10) {
        fib.push(fib[fib.length - 2] + fib[fib.length - 1])
    }
    //basic.showNumber(x)
}