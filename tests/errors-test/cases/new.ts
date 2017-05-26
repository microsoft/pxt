class A {
    x: number
    constructor(x: number) {
        this.x = x
    }
}

let B = 0

// This seems to get caught by the TypeScript type checker, might not be
// necessary
// Needs TS* prefix if you actually want to test these
//let x = new B() // 9221
//let y = new A() // 9222
