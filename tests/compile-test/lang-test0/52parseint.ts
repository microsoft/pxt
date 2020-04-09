function testParseInt(str: string, output: number, radix?: number) {
    const res = parseInt(str, radix);
    const correct = isNaN(output) ? isNaN(res) : res === output;
    assert(
        correct,
        `parseInt(${str}): expected ${output}, got ${res}`
    );
}

testParseInt("0012", 12);
testParseInt("1234abcd", 1234);
testParseInt("abcde", NaN)

testParseInt("1", NaN, 0);
testParseInt("1", NaN, 37);

testParseInt("0x12", 18);
testParseInt("0x12", 18, 16);

testParseInt("foobar", 948437811, 36);
testParseInt("+DEADBEEF", 3735928559, 16);
testParseInt("+DEADBEEF?", 3735928559, 16);
testParseInt("+DEADBEEFG!", 3735928559, 16);
testParseInt("-DEADBEEF", -1049836114599, 36);

testParseInt("10", 8, 8);

testParseInt("\r\n \t\v\f-123\r\n \t", -123);
testParseInt("x100\r\n".substr(1), 100); // https://github.com/microsoft/pxt-microbit/issues/2664