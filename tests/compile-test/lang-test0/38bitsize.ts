function testBitSize() {
    msg("testBitSize")

    let ten = 10
    u8 = ten * 100
    assert(u8 == 232, "bs0")
    u8 = 255
    assert(u8 == 255, "bs1")
    i8 = -ten
    assert(i8 == -10, "bs2")
    i8 = 127
    assert(i8 == 127, "bs3")
    i8 = -130 * ten - 1
    assert(i8 == -21, "bs4")
    u16 = 0xffff
    assert(u16 == 0xffff, "bs5")
    u16 = -1
    assert(u16 == 0xffff, "bs6")
    i16 = 1000 * 100 * ten
    assert(i16 == 16960, "bs7")
    i16 = -1000 * 100 * ten
    assert(i16 == -16960, "bs8")

    msg("testBitSize DONE")
}

testBitSize()
