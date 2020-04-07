
testNamespace.withCallback(() => {})

testNamespace.withCallback(() => testNamespace.noArgument())

testNamespace.withCallback(() => {
    testNamespace.noArgument();
    testNamespace.noArgument();
})

testNamespace.withCallbackAndArguments(TestEnum.testValue2, 10, () => {
    testNamespace.noArgument();
})