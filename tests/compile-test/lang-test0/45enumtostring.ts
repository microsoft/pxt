msg("test enum to string")

function getABoolean() {
    return !!true;
}

enum SomeEnum {
    One = 1,
    Two = 2
}

let enumTest = getABoolean() ? SomeEnum.One : SomeEnum.Two;

assert(`${enumTest}` === "1", "enum tostring in template")
assert(enumTest + "" === "1", "enum tostring in concatenation")

