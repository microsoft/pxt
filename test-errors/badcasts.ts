class Baz {
    a: number;
}

interface Foo {
    a: number
    b?: number
}

let z: Baz = new Baz()
let x: Foo = { a: 1, b: 2 }

// Static TypeScript doesn't allow cast of Interface to Class
let y: Baz = x // TS9203
