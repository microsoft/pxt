function sum(a: number, b: number, c: number): number {
    return a + b + c
}

let args = [1, 2, 3]
let s = sum(...args) //TS2556
