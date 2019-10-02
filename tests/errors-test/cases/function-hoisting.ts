function foobar() {
    let x = 1
    qux() // TS9278
    let y = 2
    function qux() {
        let a = x + y
    }
}