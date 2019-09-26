function foobar() {
    const x = 1
    qux() // TS9278
    const y = 2
    function qux() {
        let a = x + y
    }
}