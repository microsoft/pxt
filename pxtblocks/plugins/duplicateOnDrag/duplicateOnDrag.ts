import * as Blockly from "blockly";

export const DUPLICATE_ON_DRAG_MUTATION_KEY = "duplicateondrag";

export function isDuplicateOnDragBlock(block: Blockly.Block) {
    return block.mutationToDom?.()?.getAttribute(DUPLICATE_ON_DRAG_MUTATION_KEY)?.toLowerCase() === "true";
}