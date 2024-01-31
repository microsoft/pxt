
namespace pxt.blocks {
    export function validateCommentsExist(usedBlocks: Blockly.Block[]): boolean {
        const commentBlocks = usedBlocks.filter((block) => !!block.comment);
        return commentBlocks.length > 0;
    }
}