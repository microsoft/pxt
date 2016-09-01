class A {
    x: number = 42 // TS9209 - field initializers
    foo(x:number) {}
}
class B extends A {  // ok
    foo() { } // TS9255
}
interface C { } // Probably should emit some sort of error, just skips it at the moment
class D implements C { } // TS9228
class G<T> { } // Generics now supported
class X extends G<number> {} // TS9228 - cannot extend generic type
class S {
    public static x: number
    public static m() { }
}
S.x = 42
S.m()
