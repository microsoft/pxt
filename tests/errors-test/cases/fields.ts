class A {}
let a = new A()
let x = a.x //TS2339


class X {
    prop: () => void;
}

class B2 extends X {
    prop() { // TS2425
    }
}
