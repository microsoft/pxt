function testLambdasWithMoreParams() {
    function a(f: (x: number, v: string, y: number) => void) {
        f(1, "a" + "X12b", 7)
    }
    a(() => { })
}

testLambdasWithMoreParams()

namespace Arcade1617 {
    class Foo {
        public handlerxx: () => void;
        run() {
            this.handlerxx()
        }
    }

    function end(win?: boolean) {
        assert(win === undefined, "lp1")
    }

    const f = new Foo()
    f.handlerxx = end
    f.run()
}
