/// <reference path="..\..\built\pxtlib.d.ts" />
/// <reference path="..\..\built\pxtblocks.d.ts" />

describe("field user enum (when picking new enum values)", () => {
    it("should start at 0 if no flag is set", () => {
        basicEnumTest([], 0);
        basicEnumTest([-2], 0);
    });

    it("should choose the first available value", () => {
        basicEnumTest([1, 2], 0);
        basicEnumTest([0, 1, 2, 3], 4);
        basicEnumTest([0, 1, 4, 3], 2);
    });

    it("should respect the start value if specified", () => {
        startValueEnumTest([], 3);
        startValueEnumTest([1], 3);
        startValueEnumTest([3, 5], 4);
    });

    describe("when the bit mask flag is set", () => {
        it("should start at 1", () => {
            bitmaskEnumTest([], 1);
            bitmaskEnumTest([-1], 1);
        });

        it("should pick the first available power of 2", () => {
            bitmaskEnumTest([1, 2], 4);
            bitmaskEnumTest([1, 2, 4, 16], 8);
        });

        it("should ignore invalid values", () => {
            bitmaskEnumTest([0, 5], 1);
            bitmaskEnumTest([1, 2, -4, 0, 9], 4);
        });
    });
});

function enumTest(opts: pxtc.EnumInfo, existing: number[], expected: number) {
    const fakeVars = existing.map(n => [n.toString(), n] as [string, number]);
    chai.expect(pxtblockly.getNextValue(fakeVars, opts)).to.equal(expected);
}

function basicEnumTest(existing: number[], expected: number) {
    enumTest({
        name: "TestEnum",
        memberName: "",
        promptHint: "",
        initialMembers: ["does", "not", "matter"],
        blockId: "",
        isBitMask: false,
        isHash: false,
    }, existing, expected);
}

function bitmaskEnumTest(existing: number[], expected: number) {
    enumTest({
        name: "BitMaskEnum",
        memberName: "",
        promptHint: "",
        initialMembers: ["does", "not", "matter"],
        blockId: "",
        isBitMask: true,
        isHash: false,
    }, existing, expected);
}

function startValueEnumTest(existing: number[], expected: number) {
    enumTest({
        name: "StartValueEnum",
        memberName: "",
        promptHint: "",
        initialMembers: ["does", "not", "matter"],
        blockId: "",
        isBitMask: false,
        isHash: false,
        firstValue: 3
    }, existing, expected);
}