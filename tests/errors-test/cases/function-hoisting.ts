function one() { return 1 }

function foobar() {
    const x = one()
    qux() // TS9278
    const y = one() + one()
    function qux() {
        let a = x + y
    }
}