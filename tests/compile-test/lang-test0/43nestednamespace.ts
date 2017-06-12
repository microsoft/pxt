
namespace fooX.bar.baz {
    export class A {
        foo() {
            glb1++
        }
    }
    export function b() {
        glb1++
        glb1++
    }
}

import bz = fooX.bar.baz
import AA = fooX.bar.baz.A
function testImports() {
    glb1 = 0
    bz.b()
    let x = new AA()
    x.foo()
    assert(glb1 == 3, "imports")
}
testImports()
