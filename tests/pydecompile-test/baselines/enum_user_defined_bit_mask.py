/// <reference path="./testBlocks/enums.ts" />

enum EnumOfFlags {
    Q = 1,
    T = 1 << 1,
    R = 1 << 2,
    S = 1 << 3
}

let userDefinedTest6 = EnumOfFlags.R