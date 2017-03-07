/// <reference path="./testBlocks/basic.ts" />

let x = 1;
testNamespace.withCallbackAndArguments(TestEnum.testValue1, x, () => {
    let x = 1;
    x = x + 1;
});
x++;