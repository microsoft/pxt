let a = 1
function glb1() {
    a = 71 // global (explicit)
}
glb1()
function glb2() {
    console.log(a) // global (implicit)
}
glb2()
function glb3() {
    a = 19 // global (explicit)
    console.log(a)
}
glb3()
function glb4() {
    console.log(a) // global (explicit)
    a = 13
}
glb4()
function glb5() {
    a *= 7 // global (explicit)
}
console.log(1111) // marker
glb5()
function glb6(a: number) {
    a += 57 // local (param)
    console.log(a)
}
glb6(14)
function glb7() {
    let a = 73 // local (implicit)
    console.log(a)
}
glb7()
function foo() {
    let b = 23
    function nonlcl1() {
        b = 19 // nonlocal (explicit)
        console.log(b)
    }
    nonlcl1()
    function nonlcl2() {
        console.log(b) // nonlocal (explicit)
        b = 13
    }
    nonlcl2()
    function glb8() {
        a += 47 // global (explicit)
    }
    glb8()
    console.log(a) // global (implicit)
    console.log(b) // local (implicit)
}
foo()
console.log(2222) // marker
function foo2() {
    let a = 77 // local (implicit)
    function nonlcl3() {
        console.log(a) // nonlocal (implicit)
    }
    nonlcl3()
    function nonlcl4() {
        a += 31 // global or nonlocal (explicit)
        console.log(a)
    }
    nonlcl4()
    console.log(a)
}
foo2()
console.log(a)