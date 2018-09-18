class A { 
    toString(): string {
        return "world"
    }
}

class X {
    // no toString
}
let a = new A()

let b = "Hello " + a // ok
let c = "Hello " + a.toString()
let d = (10 + 1) + "" // Should compile fine

let x = new X()
let dd = x + "" // also OK, this is now handled dynamically
