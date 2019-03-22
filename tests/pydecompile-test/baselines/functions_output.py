#/ <reference path="./testBlocks/basic.ts" />

x1 = testNamespace.noArgumentOutput()
x2 = False or testNamespace.booleanArgumentOutput(True)
x3 = 1 + testNamespace.numberArgumentOutput(5)
x4 = testNamespace.stringArgumentOutput("okay")
x5 = testNamespace.enumArgumentOutput(TestEnum.testValue1)
x6 = testNamespace.enumFunctionArgumentOutput(EnumWithValueBlock.testValue2)
x7 = testNamespace.multipleArgumentsOutput(2, False)

testNamespace.booleanArgument(testNamespace.booleanArgumentOutput(True))
testNamespace.numberArgument(testNamespace.numberArgumentOutput(5))
testNamespace.stringArgument(testNamespace.stringArgumentOutput("okay"))
testNamespace.multipleArguments(testNamespace.multipleArgumentsOutput(2, testNamespace.booleanArgumentOutput(False)), testNamespace.booleanArgumentOutput(True))