/// <reference path="./testBlocks/basic.ts" />

let x = 0;
testNamespace.withCallbackAndArguments(TestEnum.testValue1, x, () => {
    let x = 0;
    x = x + 1;
});
x++;