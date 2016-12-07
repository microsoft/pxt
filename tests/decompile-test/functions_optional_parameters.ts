/// <reference path="./testBlocks/basic.ts" />

testNamespace.defaultArguments(500);
testNamespace.multipleDefaultArguments();
testNamespace.optionalArgument(200);
testNamespace.optionalArgumentWithCallback(() => {});
testNamespace.optionalCallback();