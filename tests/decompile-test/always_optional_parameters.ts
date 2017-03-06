/// <reference path="./testBlocks/basic.ts" />
testNamespace.defaultArguments(40, 50);

testNamespace.multipleDefaultArguments(40, 50);

testNamespace.optionalArgument(40, 50);

testNamespace.optionalArgumentWithCallback(() => {}, 500);
