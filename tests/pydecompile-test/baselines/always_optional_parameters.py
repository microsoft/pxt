#/ <reference path="./testBlocks/basic.ts" />
testNamespace.defaultArguments(40, 50)

testNamespace.multipleDefaultArguments(40, 50)

testNamespace.optionalArgument(40, 50)

def function_0():
  pass
testNamespace.optionalArgumentWithCallback(function_0, 500)