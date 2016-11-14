/// <reference path="./testBlocks/basic.ts" />

testNamespace.objectDestructuringTest(() => {});
testNamespace.objectDestructuringTest(({}) => {});
testNamespace.objectDestructuringTest(({ n }) => {});
testNamespace.objectDestructuringTest(({ n, text: data, }) => {});