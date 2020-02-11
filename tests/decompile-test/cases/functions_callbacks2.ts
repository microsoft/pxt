
testNamespace.withCallback(function () {})

testNamespace.withCallback(function () { testNamespace.noArgument() })

testNamespace.withCallback(function() {
    testNamespace.noArgument();
    testNamespace.noArgument();
})

testNamespace.withCallbackAndArguments(TestEnum.testValue2, 10, function() {
    testNamespace.noArgument();
})