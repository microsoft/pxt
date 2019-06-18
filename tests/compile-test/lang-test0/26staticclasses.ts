class StaticCl {
    static x = 12;
    static foo() {
        glb1 += StaticCl.x
    }
    static bar(k: number) {
        StaticCl.x = k
    }

    static doSomething: (v:number) => void;
}

function testStatic() {
    msg("testStatic");
    glb1 = 0
    StaticCl.foo()
    assert(glb1 == 12, "s0")
    StaticCl.bar(13)
    StaticCl.foo()
    assert(glb1 == 25, "s1")

    StaticCl.doSomething = (x) => {
        assert(x == 42, "s42")
    }
    StaticCl.doSomething(42)
}
testStatic()
