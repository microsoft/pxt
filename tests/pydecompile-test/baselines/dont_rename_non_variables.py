interface Foo {
    a: number
    b?: number
}

let x: Foo = { a: 1, b: 2 }
bar(x)

function bar(y: Foo) {
    let z = y.a
}