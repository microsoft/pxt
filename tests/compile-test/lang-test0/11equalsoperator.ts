function eqOp() {
    msg("eqOp")
    let x = 12
    assert((x += 10) == 22, "Y0")
    assert(x == 22, "Y1")
    x /= 2
    assert(x == 11, "Y2")

    let s = ("fo" + 1)
    let t = ("ba" + 2)
    s += t
    assert(s == "fo1b" + "a2", "fb")
}

eqOp()
