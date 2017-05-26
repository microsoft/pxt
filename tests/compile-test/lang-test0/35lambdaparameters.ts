function testLambdasWithMoreParams() {
    function a(f: (x: number, v: string, y: number) => void) {
        f(1, "a" + "X12b", 7)
    }
    a(() => { })
}

testLambdasWithMoreParams()
