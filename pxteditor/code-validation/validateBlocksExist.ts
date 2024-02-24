import * as Blockly from "blockly";

export function validateBlocksExist({ usedBlocks, requiredBlockCounts }: {
    usedBlocks: Blockly.Block[],
    requiredBlockCounts: pxt.Map<number>,
}): {
    missingBlocks: string[],
    disabledBlocks: string[],
    insufficientBlocks: string[],
    successfulBlocks: pxt.Map<Blockly.Block[]>[],
    passed: boolean
} {
    let missingBlocks: string[] = [];
    let disabledBlocks: string[] = [];
    let insufficientBlocks: string[] = [];
    let successfulBlocks: pxt.Map<Blockly.Block[]>[]  = [];
    const userBlocksEnabledByType = usedBlocks?.reduce((acc: pxt.Map<number>, block) => {
        acc[block.type] = (acc[block.type] || 0) + (block.isEnabled() ? 1 : 0);
        return acc;
    }, {});

    for (const [requiredBlockId, requiredCount] of Object.entries(requiredBlockCounts || {})) {
        const countForBlock = userBlocksEnabledByType[requiredBlockId];
        const passedBlocks = usedBlocks.filter((block) => block.type === requiredBlockId);
        if (passedBlocks.length > 0) {
            successfulBlocks.push({ [requiredBlockId]: passedBlocks})
        }

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

    const passed =
        missingBlocks.length === 0 &&
        disabledBlocks.length === 0 &&
        insufficientBlocks.length === 0;

    return {
        missingBlocks,
        disabledBlocks,
        insufficientBlocks,
        successfulBlocks,
        passed
    }
}