class A {
    x: number = 42
    foo(x:number) {}
}
class B extends A {  // ok
    foo() { } // TS9255
}
interface C { }
class D implements C { } // OK
class G<T> { } // Generics now supported
class X extends G<number> {} // TS9228 - cannot extend generic type
class S {
    public static x: number
    public static m() { }
}
S.x = 42
S.m()

class G0 {
    set y(v: number) { }
}
new G0().y = 1 // TS9281 - no getter

class G1 {
    set y(v: number) { }
}
let qq = new G1().y // TS9281 - no getter
