namespace ObjLit {
    interface Opts {
        width?: number;
        height?: number;
        msg?: string;
    }
    class OptImpl {
        width: number;
        get height() {
            return 33
        }
        get msg() {
            return "X" + "OptImpl"
        }
    }
    function foo(o: Opts) {
        if (!o.msg) {
            o.msg = "None"
        }
        glb1 += o.width - o.height + o.msg.length
        //console.log(`w=${ o.width } h=${ o.height } m=${ o.msg }`)
    }

    export function run() {
        glb1 = 0
        foo({
            width: 12,
            msg: "h" + "w"
        })
        assert(glb1 == 14)
        foo({
            width: 12,
            height: 13
        })
        assert(glb1 == 17)

        let op: Opts = {}
        op.width = 10
        op.msg = "X" + "Z123"
        foo(op)
        assert(glb1 == 17 + 15)

        glb1 = 0
        let v = new OptImpl()
        v.width = 34
        foo(v)
        assert(glb1 == 9)
    }
}
ObjLit.run()
