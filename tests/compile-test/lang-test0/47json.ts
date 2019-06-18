function testDeflUndefinedForNumber(f:number, g?:number) {
    assert(f == 3, "t3")
    assert(g == null, "n3")
    assert(g === undefined, "n3")
}

function checkJSON() {
    msg("JSON")


    testDeflUndefinedForNumber(3)

        /*
    let strings = ["foo", "foo\n", "\"", "\b\t\r\n", ""]
    for (let s of strings) {
        assert(JSON.parse(JSON.stringify(s)) === s, s)
    }
    
    assert(JSON.parse("\"\\u000A\\u0058\\u004C\\u004d\"") == "\nXLM", "uni")
    */

    let ss = "12" + "34"
    assert(ss.slice(1) == "234", "sl0")
    assert(ss.slice(1, 2) == "2", "sl1")
    assert(ss.slice(-2) == "34", "sl2")
    assert(ss.slice(1, 0) == "", "sl3")
    assert(ss.slice(1, -1) == "23", "sl4")

    let v: any = {
        foo: 1,
        bar: "foo",
        baz: [1,2]
    }

    /*
    let s0 = JSON.stringify(v)
    assert(s0 == `{"foo":1,"bar":"foo","baz":[1,2]}`, "S0")
    assert(s0 == JSON.stringify(JSON.parse(s0)), "PP")
    */
}

checkJSON()
