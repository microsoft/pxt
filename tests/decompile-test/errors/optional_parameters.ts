// @case: default param not supported in block
/// <reference path="../testBlocks/basic.ts" />
testNamespace.defaultArguments(40, 50);

// @case: multiple default params not supported in block
testNamespace.multipleDefaultArguments(40, 50);

// @case: optional param not supported in block
testNamespace.optionalArgument(40, 50);

// @case: optional param after callback
testNamespace.optionalArgumentWithCallback(() => {}, 500);

// @case: optional callback
testNamespace.optionalCallback(() => {});
