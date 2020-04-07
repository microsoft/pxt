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

    function arrayAssignment() {
        let [a, b, c] = [1, "foo", 3];
        assert(a == 1, "[]")
        assert(c == 3, "[]");
        assert(b == "foo", "[1]");
        [a, c] = [c, a];
        assert(a == 3, "[2]");
        assert(c == 1, "[]")
    
        const q = [4, 7];
        let p = 0;
        [a, c, p] = q;
        assert(a == 4, "[]");
        assert(c == 7, "[]");
        assert(p === undefined, "[]");
    
        let [aa, [bb, cc]] = [4, [3, [1]]]
        assert(aa == 4, "[[]]")
        assert(bb == 3, "[[]]")
        assert(cc.length == 1, "[[]]")
    
        msg("arrayAssignment done")
    }
    
    class ObjF {
        constructor(public x: number, public y: string) { }
    }
    
    function objectAssignment() {
        //let {aa,bb} = {aa:10,bb:20}
        //console.log(aa + bb)
    
        let { aa, bb: { q, r } } = { aa: 10, bb: { q: 1, r: 2 } }
        assert(aa == 10, "{}")
        assert(q == 1, "{}")
        assert(r == 2, "{}")
    
        let { x, y } = new ObjF(1, "foo")
        assert(x == 1, "{}")
        assert(y == "foo", "{}")
    
        msg("objectAssignment done")
    
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

        arrayAssignment()
        objectAssignment()    
    }
}

ObjectDestructuring.run();
