
namespace pxt.blocks {
    // validates that one or more blocks comments are in the project
    // returns the blocks that have comments for teacher tool scenario
    export function validateBlockCommentsExist({ usedBlocks, numRequired }: {
        usedBlocks: Blockly.Block[],
        numRequired: number,
    }): {
        commentedBlocks: Blockly.Block[],
        passed: boolean
    } {
        const commentedBlocks = usedBlocks.filter((block) => !!block.getCommentText());
        return { commentedBlocks, passed: commentedBlocks.length >= numRequired };
    }
}