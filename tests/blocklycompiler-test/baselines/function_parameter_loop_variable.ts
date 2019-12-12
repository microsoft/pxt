function test (index: number) {
    index = 9
    basic.showNumber(index)
    for (let index = 0; index <= 3; index++) {
        basic.showString(String.fromCharCode(index + 65))
    }
}
for (let index = 0; index <= 2; index++) {
    index = 3
    basic.showNumber(index)
}
for (let index of [0, 2]) {
    index = 5 + index
    basic.showNumber(index)
}
test(-1)
