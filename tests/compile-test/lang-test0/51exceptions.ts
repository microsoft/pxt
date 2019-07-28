namespace exceptions {
    function immediate(k: number) {
        try {
            pause(1)
            if (k > 0)
                throw "hl" + k
            pause(1)
            glb1++
        } catch (e) {
            assert(e == "hl" + k)
            glb1 += 10
            if (k >= 10)
                throw e
        } finally {
            x += glb1
        }
    }

    function throwVal(n: number) {
        pause(1)
        if (n > 0)
            throw "hel" + n
        pause(1)
    }


    function higherorder(k: number) {
        try {
            [1].map(() => throwVal(k))
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

    function callingThrowVal(k: number) {
        try {
            pause(1)
            throwVal(k)
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
        try {
            try {
                callingThrowVal(10)
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
        glb1 = x = 0

        callingThrowVal(1)
        assert(glb1 == 10 && x == 10)
        callingThrowVal(0)
        assert(glb1 == 11 && x == 21)
        callingThrowVal(3)
        assert(glb1 == 21 && x == 42)

        glb1 = x = 0
        immediate(1)
        assert(glb1 == 10 && x == 10)
        immediate(0)
        assert(glb1 == 11 && x == 21)
        immediate(3)
        assert(glb1 == 21 && x == 42)

        glb1 = x = 0
        higherorder(1)
        assert(glb1 == 10 && x == 10)
        higherorder(0)
        assert(glb1 == 11 && x == 21)
        higherorder(3)
        assert(glb1 == 21 && x == 42)

        glb1 = x = 0
        nested()
        assert(glb1 == 11)
    }
}

exceptions.run();