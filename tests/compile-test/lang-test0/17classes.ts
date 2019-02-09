class XFoo {
    pin: number;
    buf: number[];

    constructor(k: number, l: number) {
        this.pin = k - l
    }

    setPin(p: number) {
        this.pin = p
    }

    getPin() {
        return this.pin
    }

    init() {
        this.buf = [1, 2]
    }

    toString() {
        return `Foo${this.getPin()}`
    }
}

function testClass() {
    let f = new XFoo(272, 100);
    assert(f.getPin() == 172, "ctor")
    f.setPin(42)
    assert(f.getPin() == 42, "getpin")
}

function testToString() {
    msg("testToString")
    let f = new XFoo(44, 2)
    let s = "" + f
    assert(s == "Foo42", "ts")
}

testToString()
testClass()

namespace ClassInit {
    const seven = 7
    class FooInit {
        baz: number
        qux = seven
        constructor(public foo: number, public bar: string) {
            this.baz = this.foo + 1
        }
        semicolonTest() { };
    }

    export function classInit() {
        let f = new FooInit(13, "blah" + "baz")
        assert(f.foo == 13, "i0")
        assert(f.bar == "blahbaz", "i1")
        assert(f.baz == 14, "i2")
        assert(f.qux == 7, "i3")
    }
}

ClassInit.classInit()