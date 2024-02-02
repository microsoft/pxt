namespace pxt.blocks {
    // validates that a combination of blocks in the set satisfies the required count
    // returns the blocks that make the validator pass
    export function validateBlocksInSetExist({ usedBlocks, blocks, count }: {
        usedBlocks: Blockly.Block[],
        blocks: string[],
        count: number,
    }): {
        successfulBlocks: Blockly.Block[],
        passed: boolean
    } {
        const successfulBlocks = [];
        const enabledBlocks = usedBlocks.filter((block) => block.isEnabled());
        for (const block of blocks) {
            const blockInstances = enabledBlocks.filter((b) => b.type === block);
            successfulBlocks.push(...blockInstances);
        }
        return { successfulBlocks, passed: successfulBlocks.length >= count };
    }
}