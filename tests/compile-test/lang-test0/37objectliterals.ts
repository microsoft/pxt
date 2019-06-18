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
        if (!o.height)
            o.height = 0
        //msg(`w=${ o.width } h=${ o.height } m=${ o.msg }`)
        glb1 += o.width - o.height + o.msg.length
    }

    export function run() {
        msg("Objlit")
        glb1 = 0
        foo({
            width: 12,
            msg: "h" + "w"
        })
        assert(glb1 == 14, "g14")
        foo({
            width: 12,
            height: 13
        })
        assert(glb1 == 17, "g17")

        let op: Opts = {}
        op.width = 10
        op.msg = "X" + "Z123"
        foo(op)
        assert(glb1 == 17 + 15, "g+")

        glb1 = 0
        let v = new OptImpl()
        v.width = 34
        foo(v)
        assert(glb1 == 9)
        msg("Objlit done")
    }
}
ObjLit.run()
