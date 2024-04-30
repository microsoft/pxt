import * as Blockly from "blockly";

// validates that a combination of blocks in the set satisfies the required count
// returns the blocks that make the validator pass
export function validateBlocksInSetExist({ usedBlocks, blockIdsToCheck, count, requireUnique }: {
    usedBlocks: Blockly.Block[],
    blockIdsToCheck: string[],
    count: number,
    requireUnique?: boolean
}): {
    successfulBlocks: Blockly.Block[],
    passed: boolean
} {
    const successfulBlocks = [];
    const enabledBlocks = usedBlocks.filter((block) => block.isEnabled());
    for (const block of blockIdsToCheck) {
        const blockInstances = enabledBlocks.filter((b) => b.type === block);
        if (requireUnique && blockInstances.length >= 1) {
            successfulBlocks.push(blockInstances[0]);
        } else {
            successfulBlocks.push(...blockInstances);
        }
    }
    return { successfulBlocks, passed: successfulBlocks.length >= count };
}
