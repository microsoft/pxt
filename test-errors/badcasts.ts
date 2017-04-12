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

// an interface can't extend a class in STS
interface Foo2 extends Baz {    // TS9262
    c: string;
}

let v = new BazParent()
let z: Baz = new Baz()
let x: Foo = { a: 1, b: 2 }

// Static TypeScript (STS) doesn't permit cast of Interface to Class
let y: Baz = x // TS9263

y = x  // TS9263

// STS doesn't permit downcasts
z = v  // TS9263

v = z // this is OK

// STS doesn't permit casts between unrelated casts
let z2 : UnrelatedToBaz = v // TS9263

// can't cast primitive to objects (yet)

let z3 : Object = 3 // TS9263

interface Foo2 {
    b: Baz;
}

interface Foo3 {
    b: UnrelatedToBaz;
}

let x2 : Foo2 = null
let x3 : Foo3 = null

x3 = x2 // TS9263

interface Opt extends Baz { // TS9262
    b?: string
}

class DerivesFromNull extends null { // TS9228 

}
