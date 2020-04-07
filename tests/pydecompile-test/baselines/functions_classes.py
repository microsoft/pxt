#/ <reference path="./testBlocks/basic.ts" />

var1 = testNamespace.createTestClass(0)

var2: testNamespace.TestClass = None
var2 = testNamespace.createTestClass(5)

var1.testMethod(2)
testNamespace.createTestClass(1).testMethod(3)