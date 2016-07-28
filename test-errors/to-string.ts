class A { 
    toString(): string {
        return "world"
    }
}

let a = new A()

let b = "Hello " + a // TS9225
let c = "Hello " + a.toString()
let d = (10 + 1) + "" // Should compile fine
