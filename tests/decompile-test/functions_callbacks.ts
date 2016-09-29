/// <reference path="./testBlocks/basic.ts" />

// Empty arrow function block
testNamespace.withCallback(() => {})

// Arrow function with single statement instead of block
testNamespace.withCallback(() => testNamespace.noArgument())

// Arrow function with block
testNamespace.withCallback(() => {
    testNamespace.noArgument();
    testNamespace.noArgument();
})

// Additional arguments beyond the callback
testNamespace.withCallbackAndArguments(TestEnum.testValue2, 10, () => {
    testNamespace.noArgument();
})