// Exercises conditions in if/while, &&, ||, and ! over numbers, booleans,
// strings and arrays. Everything feeds a module-level accumulator so no
// condition site can be dropped as unused.

let acc = 0
let flag = true
let text = "ab"
let n = 3
let arr = [1, 2]

function classify(v: number, on: boolean, txt: string): number {
    let r = 0
    if (v > 2 && on) r += 1
    if (!on || v < 0) r += 2
    while (v > 0) {
        r += v
        v -= 1
    }
    if (txt) r += 4
    if (!txt) r += 8
    return r
}

acc += classify(n, flag, text)
acc += classify(0, !flag, "")
if (arr.length > 1) acc += 16
if (flag && arr.length > 0 && text.length > 1) acc += 32
if (!flag || !text) acc += 64
