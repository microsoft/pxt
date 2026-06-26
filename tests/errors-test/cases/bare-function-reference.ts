// enhancedErrors

function doSomething() {
}

doSomething // TS9284

let handler = doSomething
handler // TS9284

// @ts-ignore
doSomething

function runCallback(cb: () => void) {
    cb()
}

runCallback(doSomething)
let stored = doSomething