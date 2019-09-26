class X {
    prop: () => void;
}

class B extends X {
    get prop() { // TS9279
        return null;
    }
    set prop(v: () => void) { // TS9279
    }
}
