function foo() {
    let x = 1 +
        2
    let y = 1
        * 2 +
        3

    if (x > 0) {
        x++
        let q = +x
        let z = -x
        z = q + (-z) + (+x)
    } else if (y > 0) {
        basic.showString("hello",
            120)
    } else if (y >= 0) {

    } else if (y <= 0) {

    } else {

    }

    while (x > 10) {
        x++;
    }

    for (let x of tests) {
        x.foo()
    }

    for (let i = 0; i < 100; ++i) {
        i++;
    }

    for (let i = 0; i < 100; i++) {
        i++;
    }

    tests[0] = tests[1]

    let t = new Test()
        .foo()
        .bar(12)
}

function bar() {
    return (1 + 1)
}

function bar1() {
    throw (1)
}

class Test {
    public foo() {
        return this
    }
    public bar(x: number) {
        return this;
    }
}

var tests: Test[];

basic.forever(() => {
    foo()
})
