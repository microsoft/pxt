
namespace pxt.blocks {
    export function validateBlocksExist({ usedBlocks, requiredBlockCounts }: {
        usedBlocks: Blockly.Block[],
        requiredBlockCounts: pxt.Map<number>,
    }): {
        missingBlocks: string[],
        disabledBlocks: string[],
        insufficientBlocks: string[],
    } {
        let missingBlocks: string[] = [];
        let disabledBlocks: string[] = [];
        let insufficientBlocks: string[] = [];
        const userBlocksEnabledByType = usedBlocks?.reduce((acc: pxt.Map<number>, block) => {
            acc[block.type] = (acc[block.type] || 0) + (block.isEnabled() ? 1 : 0);
            return acc;
        }, {});

        for (const [requiredBlockId, requiredCount] of Object.entries(requiredBlockCounts || {})) {
            const countForBlock = userBlocksEnabledByType[requiredBlockId];
            if (countForBlock === undefined) {
                // user did not use a specific block
                missingBlocks.push(requiredBlockId);
            } else if (!countForBlock) {
                // all instances of block are disabled
                disabledBlocks.push(requiredBlockId);
            } else if (countForBlock < requiredCount) {
                // instances of block exists, but not enough.
                insufficientBlocks.push(requiredBlockId);
            }
        }

        return {
            missingBlocks,
            disabledBlocks,
            insufficientBlocks,
        }
    }
}