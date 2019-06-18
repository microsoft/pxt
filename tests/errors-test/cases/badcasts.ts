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

class Blap {
    bar(a: BazParent) { }
}

class Blap2 extends Blap {
    bar(a: UnrelatedToBaz) { }
}

// an interface can't extend a class in STS
interface Foo2 extends Baz {    // TS9262
    c: string;
}

let v = new BazParent()
let z: Baz = new Baz()
let x: Foo = { a: 1, b: 2 }

let y: Baz = x
y = x
z = v
v = z // this is OK

let z2 : UnrelatedToBaz = v

let z3: Object = 3

interface Foo2 {
    b: Baz;
}

interface Foo3 {
    b: UnrelatedToBaz;
}

let x2 : Foo2 = null
let x3 : Foo3 = null

x3 = x2

interface Opt extends Baz { // TS9262
    b?: string
}

class DerivesFromNull extends null { // TS9228 

}
