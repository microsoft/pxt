// Exercises checked field loads through class-typed receivers. A field read
// takes the checked path whenever its receiver is not `this`, and the
// count-gated checked-field-load specialization keys on how many static read
// sites one class field has, so `qzTally` sits above a plausible gate and
// `qzSpare` below it. Everything feeds a module-level accumulator so no read
// site can be dropped as unused.
//
// Constraints this program must keep, or the case stops testing what it names:
//
// - The class implements no interface and has no subclass, so neither field is
//   treated as overridden. An overridden field routes its reads through
//   interface dispatch instead of the checked field path -- that is the shape
//   `ifacebaseline.ts` covers, and it would make this case vacuous.
// - No receiver is `this`. A `this`-receiver read is unchecked and is not
//   counted, so moving a read into a method silently drops it from the count.
// - The field names are unique to this program. Adding or removing one read of
//   either name moves it relative to the gate.

class QzCell {
    qzTally: number
    qzSpare: number
    constructor(tally: number, spare: number) {
        this.qzTally = tally
        this.qzSpare = spare
    }
}

let acc = 0
let cellA = new QzCell(1, 2)
let cellB = new QzCell(3, 4)
let cellC = new QzCell(5, 6)

function addTally(cell: QzCell) {
    acc += cell.qzTally
}

// qzTally: 6 checked read sites, above the gate.
acc += cellA.qzTally
acc += cellB.qzTally
acc += cellC.qzTally
acc += cellA.qzTally + cellB.qzTally
addTally(cellC)

// qzSpare: 4 checked read sites, below the gate.
acc += cellA.qzSpare
acc += cellB.qzSpare
acc += cellC.qzSpare
acc += cellA.qzSpare
