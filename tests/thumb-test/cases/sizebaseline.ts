// A fixed dispatch-heavy program whose emitted code size is tracked. Keep this
// program stable: changing it invalidates the size baseline in asmchecks.ts.

interface Op {
    apply(v: number): number
}

class AddOp implements Op {
    constructor(public k: number) { }
    apply(v: number) { return v + this.k }
}

class MulOp implements Op {
    constructor(public k: number) { }
    apply(v: number) { return v * this.k }
}

class ClampOp implements Op {
    constructor(public lo: number, public hi: number) { }
    apply(v: number) { return v < this.lo ? this.lo : (v > this.hi ? this.hi : v) }
}

let acc = 0
const ops: Op[] = [new AddOp(3), new MulOp(2), new ClampOp(0, 100), new AddOp(-1), new MulOp(5)]

function runAll(v: number): number {
    for (const o of ops) v = o.apply(v)
    return v
}

for (let i = 0; i < 5; ++i) acc += runAll(i)

const names = ["add", "mul", "clamp"]
let joined = ""
for (const n of names) joined = joined + n + ":"
acc += joined.length

const counts: { [k: string]: number } = {}
for (const n of names) counts[n] = (counts[n] || 0) + acc
for (const n of names) acc += counts[n]

const nums = [5, 3, 9, 1, 7]
nums.sort((a, b) => a - b)
for (const v of nums) acc = acc + v * 2
acc += nums.indexOf(9)
