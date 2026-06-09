// enhancedErrors

function doSomething() {
}

doSomething // TS9284

let handler = doSomething
handler // TS9284

function runCallback(cb: () => void) {
    cb()
}

runCallback(doSomething)
let stored = doSomething