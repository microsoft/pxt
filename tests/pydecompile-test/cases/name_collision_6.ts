/// <reference path="./testBlocks/basic.ts" />

let x: testNamespace.TestClass = null;
x = testNamespace.createTestClass(0);
{
    let x = 1;
    x++;
}
x.testMethod(2);

let y: testNamespace.TestClass = null;
{
    let y = 3;
    y++;
}
y = testNamespace.createTestClass(4);
y.testMethod(5)