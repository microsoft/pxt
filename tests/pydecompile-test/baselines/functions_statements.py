#/ <reference path="./testBlocks/basic.ts" />

testNamespace.noArgument()
testNamespace.booleanArgument(True)
testNamespace.numberArgument(5)
testNamespace.stringArgument("okay")
testNamespace.enumArgument(TestEnum.testValue1)
testNamespace.enumFunctionArgument(EnumWithValueBlock.testValue2)
testNamespace.multipleArguments(2, False)