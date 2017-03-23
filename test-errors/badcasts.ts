class BazParent {
   a: number
}

class Baz extends BazParent {
    a: number;
}

class UnrelatedToBaz {
    a: number;
}

interface Foo {
    a: number
    b?: number
}

let v = new BazParent()
let z: Baz = new Baz()
let x: Foo = { a: 1, b: 2 }

// Static TypeScript (STS) doesn't permit cast of Interface to Class
let y: Baz = x // TS9203

y = x  // TS9203

// STS doesn't permit downcasts
z = v  // TS9203

v = z // this is OK

// STS doesn't permit casts between unrelated casts
let z2 : UnrelatedToBaz = v // TS9203

// can't cast primitive to objects (yet)

let z3 : Object = 3 // TS9203

