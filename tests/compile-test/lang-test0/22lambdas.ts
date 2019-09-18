
function doubleIt(f: (x: number) => number) {
    return f(1) - f(2)
}

function triple(f: (x: number, y: number, z: number) => number) {
    return f(5, 20, 8)
}

function checkLen(f: (x: string) => string, k: number) {
    // make sure strings are GCed
    f("baz")
    let s = f("foo")
    assert(s.length == k, "len")
}

function testLambdas() {
    let x = doubleIt(k => {
        return k * 108
    })
    assert(x == -108, "l0")
    x = triple((x, y, z) => {
        return x * y + z
    })
    assert(x == 108, "l1")
    checkLen((s) => {
        return s + "XY1"
    }, 6)
    checkLen((s) => s + "1212", 7)
}

function testLambdaDecrCapture() {
    let x = 6
    function b(s: string) {
        assert(s.length == x, "dc")
    }
    b("fo0" + "bAr")
}

function testNested() {
    glb1 = 0

    const x = 7
    let y = 1
    bar(1)
    y++
    bar(2)
    bar2()
    assert(glb1 == 12)
    glb1 = 0
    const arr = [1,20,300]
    for (let k of arr) {
        qux()
        function qux() {
            glb1 += k
        }
    }
    assert(glb1 == 321)

    const fns: any[] = []
    for (let k of arr) {
        const kk = k
        fns.push(qux2)
        function qux2() {
            glb1 += kk
        }
    }
    glb1 = 0
    for (let f of fns) f()
    assert(glb1 == 321)

    function bar(v: number) {
        assert(x == 7 && y == v)
        glb1++
    }
    function bar2() {
        glb1 += 10
    }
}

testLambdas();
testLambdaDecrCapture();
testNested()