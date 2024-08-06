import * as Blockly from "blockly";

export const DUPLICATE_ON_DRAG_MUTATION_KEY = "duplicateondrag";

let draggableShadowAllowlist: string[];

export function isDuplicateOnDragBlock(block: Blockly.Block) {
    return block.mutationToDom?.()?.getAttribute(DUPLICATE_ON_DRAG_MUTATION_KEY)?.toLowerCase() === "true";
}

export function setDraggableShadowBlocks(ids: string[]) {
    draggableShadowAllowlist = ids;
}

export function isAllowlistedShadow(block: Blockly.Block) {
    if (draggableShadowAllowlist && block.isShadow()) {
        if (draggableShadowAllowlist.indexOf(block.type) !== -1) {
            return true;
        }
    }

    return false;
}