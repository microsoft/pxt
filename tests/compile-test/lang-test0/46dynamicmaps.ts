namespace DynamicMaps {
    interface V {
        foo: number;
        bar: string;
    }

    class Blah {
        foo: number;
        bar: string;
    }

    function check(v: V) {
        return `${v.foo + 1}/${v.bar}`
    }

    function checkA(v: any) {
        return `${v.foo + 1}/${v.bar}`
    }

    function upd(v: V) {
        v.foo += 1
        v.bar += "a"
    }

    function updA(v: any) {
        v.foo = v.foo + 1
        v.bar = v.bar + "a"
    }

    function updI(v: any) {
        v["foo"] = v["foo"] + 1
        v["bar"] = v["bar"] + "a"
    }

    function updIP(v: any, foo: string, bar: string) {
        v[foo] = v[foo] + 1
        v[bar] = v[bar] + "a"
    }

    function allChecks(v: V) {
        assert(check(v) == "2/foo", ".v")

        msg(checkA(v))
        msg(check(v))

        assert(checkA(v) == check(v), ".z2")
        upd(v)
        assert(check(v) == "3/fooa", ".v2")
        updA(v)
        assert(check(v) == "4/fooaa", ".v3")
        updI(v)
        assert(check(v) == "5/fooaaa", ".v4")
        updIP(v, "foo", "bar")
        assert(check(v) == "6/fooaaaa", ".v6")
        assert(checkA(v) == check(v), ".z3")
    }

    export function run() {
        msg("dynamicMaps")
        
        let v: any = {
            foo: 1,
            bar: "foo"
        }

        let z = new Blah()
        z.foo = 12
        z.bar = "blah"

        assert(check(z) == "13/blah", ".z")

        z.foo = 1
        z.bar = "foo"

        allChecks(v)
        msg("dynamic class")
        allChecks(z)
    }
}

DynamicMaps.run()
