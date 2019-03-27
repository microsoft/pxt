#/ <reference path="./testBlocks/basic.ts" />

def function_0():
  pass
testNamespace.withCallback(function_0)

def function_1():
  testNamespace.noArgument()
testNamespace.withCallback(function_1)

def function_2():
  testNamespace.noArgument()
  testNamespace.noArgument()
testNamespace.withCallback(function_2)

def function_3():
  testNamespace.noArgument()
testNamespace.withCallbackAndArguments(TestEnum.testValue2, 10, function_3)