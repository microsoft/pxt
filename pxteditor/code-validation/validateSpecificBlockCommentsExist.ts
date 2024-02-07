// validates that all of a specific block type have comments
// returns the blocks that do not have comments for a tutorial validation scenario
export function validateSpecificBlockCommentsExist({ usedBlocks, blockType }: {
    usedBlocks: Blockly.Block[],
    blockType: string,
}): {
    uncommentedBlocks: Blockly.Block[],
    passed: boolean
} {
    const allSpecifcBlocks = usedBlocks.filter((block) => block.type === blockType);
    const uncommentedBlocks = allSpecifcBlocks.filter((block) => !block.getCommentText());
    return { uncommentedBlocks, passed: uncommentedBlocks.length === 0 };
}