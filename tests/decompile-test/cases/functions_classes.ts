/// <reference path="./testBlocks/basic.ts" />

let var1 = testNamespace.createTestClass(0)

let var2: testNamespace.TestClass = null;
var2 = testNamespace.createTestClass(5)

let var3: testNamespace.TestClass = null //pxtGenerated
var3 = testNamespace.createTestClass(10)

var1.testMethod(2)
testNamespace.createTestClass(1).testMethod(3)