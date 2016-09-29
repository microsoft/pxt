/// <reference path="./testBlocks/basic.ts" />

// With initializer
let var1 = testNamespace.createTestClass(0)

// Initialized to null (should not be emitted)
let var2: testNamespace.TestClass = null;
var2 = testNamespace.createTestClass(5)

// Accessing member functions
var1.testMethod(2)
testNamespace.createTestClass(1).testMethod(3)