namespace exceptions {
    function bar(n: number) {
        pause(1)
        if (n > 0)
            throw "hel" + n
        pause(1)
    }

    function foo(k: number) {
        try {
            pause(1)
            bar(k)
            pause(1)
            glb1++
        } catch (e) {
            assert(e == "hel" + k)
            glb1 += 10
            if (k >= 10)
                throw e
        } finally {
            x += glb1
        }
    }

    function nested() {
        glb1 = x = 0
        try {
            try {
                foo(10)
            } catch (e) {
                assert(glb1 == 10 && x == 10)
                glb1++
                throw e
            }
        } catch (ee) {
            assert(glb1 == 11)
        }
    }

    export function run() {
        glb1 = 0
        x = 0
        foo(1)
        assert(glb1 == 10 && x == 10)
        foo(0)
        assert(glb1 == 11 && x == 21)
        foo(3)
        assert(glb1 == 21 && x == 42)
        nested()
        assert(glb1 == 11)
    }
}

exceptions.run();