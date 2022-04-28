enum TestEnum {
    Six = 6,
    Seven = 7,
    Eight = 8
}

const SIX = TestEnum.Six
const SEVEN = TestEnum.Seven
const EIGHT = TestEnum.Eight

function foo(num: TestEnum) {
    return num
}

function bar() {
    let sixteen = 16;
    foo(s    // sixteen
    foo(S    // SEVEN; SIX
}