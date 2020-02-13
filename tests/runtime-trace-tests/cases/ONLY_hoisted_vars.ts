let a = 1
function foo() {
    a = a + 1 // global
    let b = 2
    function bar(a: number) {
        a += 1 // local
        b += 2 // non-local
        return a
    }
    let c = bar(b + 1)
}
foo()
function baz() {
    a = 7 // local
}
baz()
console.log(a)