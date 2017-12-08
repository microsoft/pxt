/// <reference path="./testBlocks/mb.ts" />
pauseUntil(() => true)
pauseUntil(undefined);
pauseUntil(function () { return false; })
pauseUntil(function() { let x = 0; return x > 7 });