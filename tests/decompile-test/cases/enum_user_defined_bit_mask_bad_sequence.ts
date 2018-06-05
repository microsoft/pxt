/// <reference path="./testBlocks/enums.ts" />

enum EnumOfFlags {
    W = 1,
    X = 1 << 1,
    Z = 1 << 3
}

let userDefinedTest7 = EnumOfFlags.W