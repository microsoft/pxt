#/ <reference path="./testBlocks/basic.ts" />

testNamespace.noArgumentOutput()
testNamespace.booleanArgumentOutput(True)
testNamespace.numberArgumentOutput(5)
testNamespace.stringArgumentOutput("okay")
testNamespace.enumArgumentOutput(TestEnum.testValue1)
testNamespace.enumFunctionArgumentOutput(EnumWithValueBlock.testValue2)
testNamespace.multipleArgumentsOutput(2, False)