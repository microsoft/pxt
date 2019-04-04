#/ <reference path="./testBlocks/basic.ts" />

testNamespace.numberWithEnumShadow(5)
testNamespace.numberWithEnumShadow(EnumWithValueBlock.testValue1)
testNamespace.numberWithEnumShadow(testNamespace.enumWithValue(EnumWithValueBlock.testValue1))