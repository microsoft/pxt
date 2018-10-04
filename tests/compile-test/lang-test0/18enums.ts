enum En {
    A,
    B,
    C,
    D = 4200,
    E,
}

enum En2 {
    D0 = En.D,
    D1,
    D2 = 1,
}


function testEnums() {
    msg("enums")

    let k = En.C as number
    assert(k == 2, "e0")
    k = En.D as number
    assert(k == 4200, "e1")
    k = En.E as number
    assert(k == 4201, "e43")

    k = En2.D0 as number
    assert(k == 4200, "eX0")
    k = En2.D1 as number
    assert(k == 4201, "eX1")

    msg("enums0")
    assert(switchA(En.A) == 7, "s1")
    assert(switchA(En.B) == 7, "s2")
    assert(switchA((3 - 2) as En) == 7, "s2")
    assert(switchA(En.C) == 12, "s3")
    assert(switchA(En.D) == 13, "s4")
    assert(switchA(En.E) == 12, "s5")
    assert(switchA(-3 as En) == 12, "s6")

    msg("enums1")
    assert(switchB(En.A) == 7, "x1")
    assert(switchB(En.B) == 7, "x2")
    assert(switchB(En.C) == 17, "x3")
    assert(switchB(En.D) == 13, "x4")
    assert(switchB(En.E) == 14, "x5")

    pause(3)

    let kk = 1
    if (kk & En2.D2) {
    } else {
        assert(false, "e&")
    }
    kk = 2
    if (kk & En2.D2) {
        assert(false, "e&")
    }
}


function switchA(e: En) {
    let r = 12;
    switch (e) {
        case En.A:
        case En.B: return 7;
        case En.D: r = 13; break;
    }
    return r
}

function switchB(e: En) {
    let r = 33;
    switch (e) {
        case En.A:
        case En.B: return 7;
        case En.D: r = 13; break;
        case En.E: r = 14; break;
        default: return 17;
    }
    return r;
}

testEnums()
