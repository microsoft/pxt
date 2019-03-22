/// <reference path="./testBlocks/mb.ts" />
let i = 0;
basic.forever(() => {
    basic.forever(() => {
        i ++;
    });
    i ++;
});