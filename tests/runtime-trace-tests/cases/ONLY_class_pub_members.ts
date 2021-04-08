class Foo {
    constructor(public n: number = 0) {
    }

    public change(m: number) {
        this.n += m
    }
}

let rope = new Foo(2)

rope.change(0.1)

console.log(rope.n)