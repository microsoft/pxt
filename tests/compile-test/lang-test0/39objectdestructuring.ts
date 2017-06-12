namespace ObjectDestructuring {
    class X {
        public a: number;
        public b: string;
        public c: boolean;
        public d: Y;
    }

    class Y {
        public e: number;
        public f: number;
    }

    function testFunction(callBack: (x: X) => void) {
        const test = new X();
        test.a = 17;
        test.b = "okay";
        test.c = true;

        const subTest = new Y();
        subTest.e = 18;
        subTest.f = 19;

        test.d = subTest;

        callBack(test);
    }

    export function run() {
        glb1 = 0;

        testFunction(({}) => {
            glb1 = 1;
        });

        assert(glb1 === 1)

        testFunction(({a}) => {
            assert(a === 17);
            glb1 = 2;
        })

        assert(glb1 === 2);

        testFunction(({a: hello}) => {
            assert(hello === 17);
            glb1 = 3;
        })

        assert(glb1 === 3);

        testFunction(({a, b, c}) => {
            assert(a === 17);
            assert(b === "okay");
            assert(c);
            glb1 = 4;
        })

        assert(glb1 === 4);

        testFunction(({d: {e, f}}) => {
            assert(e === 18);
            assert(f === 19);
            glb1 = 5;
        })

        assert(glb1 === 5);
    }
}

ObjectDestructuring.run();
