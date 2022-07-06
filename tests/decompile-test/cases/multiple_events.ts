testNamespace.callbackNoMultiple(TestEnum.testValue1, 1, function () {

})

testNamespace.callbackNoMultiple(TestEnum.testValue1, 2, function () {

})

testNamespace.callbackNoMultiple(TestEnum.testValue2, 1, function () {

})

testNamespace.callbackNoMultiple(TestEnum.testValue2, testNamespace.customShadowFieldNoLiterals(1), function () {

})

testNamespace.callbackNoMultiple(TestEnum.testValue2, testNamespace.customShadowFieldNoLiterals(2), function () {

})

testNamespace.callbackNoMultiple(TestEnum.testValue2, testNamespace.customShadowFieldNoLiterals(1), function () {

})

testNamespace.callbackNoMultiple(TestEnum.testValue1, 1, function () {

})