
namespace pxt.blocks {
    // validates that one or more blocks comments are in the project
    // returns the blocks that have comments for teacher tool scenario
    export function validateBlockCommentsExist({ usedBlocks }: { usedBlocks: Blockly.Block[] }): Blockly.Block[] {
        const commentBlocks = usedBlocks.filter((block) => !!block.getCommentText());
        return commentBlocks;
    }

    // validates that all of a specific block type have comments
    // returns the blocks that do not have comments for a tutorial validation scenario
    export function validateCommentsOnSpecificBlocksExist({ usedBlocks, blockType }: {
            usedBlocks: Blockly.Block[],
            blockType: string,
        }): Blockly.Block[] {
        const allSpecifcBlocks = usedBlocks.filter((block) => block.type === blockType);
        const noncommentBlocks = allSpecifcBlocks.filter((block) => !block.getCommentText());
        return noncommentBlocks;
    }
}