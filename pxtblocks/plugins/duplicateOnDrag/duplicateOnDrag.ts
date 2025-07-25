import * as Blockly from "blockly";
import { PathObject } from "../renderer/pathObject";

let draggableShadowAllowlist: string[];
let duplicateRefs: DuplicateOnDragRef[];

interface DuplicateOnDragRef {
    parentBlockType: string;
    inputName?: string;
    childBlockType?: string;
}

export function setDraggableShadowBlocks(ids: string[]) {
    draggableShadowAllowlist = ids;
}

/**
 * Configures duplicate on drag for a block's child inputs
 *
 * @param parentBlockType   The type of the parent block
 * @param inputName         The value input to duplicate blocks on when dragged. If not
 *                          specified, all child value inputs will be duplicated
 * @param childBlockType    The type of the child block to be duplicated. If not specified,
 *                          any block attached to the input will be duplicated on drag
 *                          regardless of type
 */
export function setDuplicateOnDrag(parentBlockType: string, inputName?: string, childBlockType?: string) {
    if (!duplicateRefs) {
        duplicateRefs = [];
    }

    const existing = duplicateRefs.some(ref => ref.parentBlockType === parentBlockType && ref.inputName === inputName && ref.childBlockType === childBlockType);
    if (existing) {
        return;
    }

    duplicateRefs.push({
        parentBlockType,
        inputName,
        childBlockType
    });
}

export function isAllowlistedShadow(block: Blockly.Block) {
    if (draggableShadowAllowlist) {
        if (draggableShadowAllowlist.indexOf(block.type) !== -1) {
            return true;
        }
    }
    return false;
}

export function shouldDuplicateOnDrag(block: Blockly.Block) {
    if (block.isShadow() && isAllowlistedShadow(block)) {
        return true;
    }

    if (duplicateRefs) {
        const parent = block.outputConnection?.targetBlock();

        if (parent) {
            const refs = duplicateRefs.filter(r => r.parentBlockType === parent.type);

            for (const ref of refs) {
                if (ref && (!ref.childBlockType || ref.childBlockType === block.type)) {
                    if (ref.inputName) {
                        const targetConnection = block.outputConnection.targetConnection;
                        if (targetConnection.getParentInput().name === ref.inputName) {
                            return true;
                        }
                    }
                    else {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

export function updateDuplicateOnDragState(block: Blockly.BlockSvg) {
    // run this in a timeout to ensure that the block's parent has been intialized
    // in case this is called during block initialization
    setTimeout(() => {
        const shouldDuplicate = shouldDuplicateOnDrag(block);
        if (block.pathObject) {
            (block.pathObject as PathObject).setHasDottedOutlineOnHover(shouldDuplicate);
        }
        block.setDeletable(!shouldDuplicate);
    });
}