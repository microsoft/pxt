#/ <reference path="./testBlocks/basic.ts" />

def function_10():
  pass
testNamespace.withCallback(function_10)

def function_11():
  testNamespace.noArgument()
testNamespace.withCallback(function_11)

def function_12():
  testNamespace.noArgument()
  testNamespace.noArgument()
testNamespace.withCallback(function_12)

def function_13():
  testNamespace.noArgument()
testNamespace.withCallbackAndArguments(TestEnum.testValue2, 10, function_13)