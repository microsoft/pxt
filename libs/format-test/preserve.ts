function foo() {
    let x = 1 +
        2
    let y = 1
        * 2 +
        3

    if (x > 0) {
        x++
    } else if (y > 0) {
        basic.showString("hello",
            120)
    }

    let t = new Test()
        .foo()
        .bar(12)
}

class Test {
    public foo() {
        return this
    }
    public bar(x: number) {
        return this;
    }
}

basic.forever(() => {
    foo()
})
