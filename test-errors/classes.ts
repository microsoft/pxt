class A {
    x: number = 42 // TS9209
}
class B extends A { } // TS9228
interface C { } // Probably should emit some sort of error, just skips it at the moment
class D implements C { } // TS9228
class G<T> { } // TS9227
class S {
    public static x: number 
    public static m() { }
}
S.x = 42 // TS9202 - can be removed if static field support is added
S.m() // TS9202 - can be removed if static method support is added
