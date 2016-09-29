/// <reference path="./testBlocks/basic.ts" />

// Top level
// testNamespace.noArgumentOutput()
// testNamespace.booleanArgumentOutput(true)
// testNamespace.numberArgumentOutput(5)
// testNamespace.stringArgumentOutput("okay")
// testNamespace.enumArgumentOutput(TestEnum.testValue1)
// testNamespace.enumFunctionArgumentOutput(EnumWithValueBlock.testValue1)
// testNamespace.multipleArgumentsOutput(2, false)

// In expressions
let x1 = testNamespace.noArgumentOutput()
let x2 = false || testNamespace.booleanArgumentOutput(true)
let x3 = 1 + testNamespace.numberArgumentOutput(5)
let x4 = testNamespace.stringArgumentOutput("okay")
let x5 = testNamespace.enumArgumentOutput(TestEnum.testValue1)
let x6 = testNamespace.enumFunctionArgumentOutput(EnumWithValueBlock.testValue2)
let x7 = testNamespace.multipleArgumentsOutput(2, false)

// As function arguments
testNamespace.booleanArgument(testNamespace.booleanArgumentOutput(true))
testNamespace.numberArgument(testNamespace.numberArgumentOutput(5))
testNamespace.stringArgument(testNamespace.stringArgumentOutput("okay"))
// testNamespace.enumArgument(testNamespace.enumArgumentOutput(TestEnum.testValue1))
// testNamespace.enumFunctionArgument(testNamespace.enumFunctionArgumentOutput(EnumWithValueBlock.testValue2))
testNamespace.multipleArguments(testNamespace.multipleArgumentsOutput(2, testNamespace.booleanArgumentOutput(false)), testNamespace.booleanArgumentOutput(true))