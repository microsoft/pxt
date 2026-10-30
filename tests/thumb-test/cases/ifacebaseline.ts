// Exercises interface-typed field reads, interface-dispatched method calls,
// repeated object-literal keys, an overridden toString, and a typed index
// signature. Everything feeds a module-level accumulator so no access site can
// be dropped as unused.

interface Shape {
    size: number
    scale(by: number): number
    toString(): string
}

class Box implements Shape {
    size: number
    label: string
    constructor(size: number, label: string) {
        this.size = size
        this.label = label
    }
    scale(by: number): number {
        this.size = this.size * by
        return this.size
    }
    toString(): string {
        return this.label + this.size
    }
}

class Dot implements Shape {
    size: number
    constructor() {
        this.size = 1
    }
    scale(by: number): number {
        this.size = this.size + by
        return this.size
    }
    toString(): string {
        return "dot"
    }
}

let acc = 0
let shapes: Shape[] = [new Box(2, "b"), new Dot(), new Box(5, "c"), new Dot()]

// checked field loads of one field
acc += shapes[0].size
acc += shapes[1].size
acc += shapes[2].size
acc += shapes[3].size
acc += shapes[0].size + shapes[1].size
acc += shapes[2].size + shapes[3].size

// interface-dispatched calls of one method
acc += shapes[0].scale(2)
acc += shapes[1].scale(3)
acc += shapes[2].scale(4)
acc += shapes[3].scale(5)

// object-literal stores of one key
let recs = [{ size: 1 }, { size: 2 }, { size: 3 }, { size: 4 }]
for (let r of recs) acc += r.size

// overridden toString
acc += shapes[0].toString().length
acc += shapes[1].toString().length

// typed index signature
let table: { [k: string]: number } = {}
table["a"] = acc
table["b"] = acc + 1
acc += table["a"] + table["b"]
