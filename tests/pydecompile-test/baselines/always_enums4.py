#/ <reference path="./testBlocks/basic.ts" />

x = testNamespace.createTestClass(5)

x.testMethodWithEnum(TestEnum.testValue2)
x.testMethodWithEnum(58)