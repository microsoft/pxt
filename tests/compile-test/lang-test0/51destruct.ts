namespace destructuring {
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
    
    arrayAssignment()
    objectAssignment()
}