import * as Blockly from "blockly";

export const DUPLICATE_ON_DRAG_MUTATION_KEY = "duplicateondrag";

// export class DuplicateOnDragBlockDragger extends Blockly.BlockDragger {
//     protected disconnectBlock_(
//         healStack: boolean,
//         currentDragDeltaXY: Blockly.utils.Coordinate,
//     ) {

//         let clone: Blockly.Block;
//         let target: Blockly.Connection;

//         const mutation = this.draggingBlock_.mutationToDom && this.draggingBlock_.mutationToDom();

//         if (mutation?.getAttribute(DUPLICATE_ON_DRAG_MUTATION_KEY)?.toLowerCase() === "true") {
//             const output = this.draggingBlock_.outputConnection;

//             if (!output?.targetConnection) return;

//             clone = Blockly.Xml.domToBlock(Blockly.Xml.blockToDom(this.draggingBlock_, true) as Element, this.workspace_);
//             target = output.targetConnection;
//         }

//         super.disconnectBlock_(healStack, currentDragDeltaXY);

//         if (clone && target) {
//             target.connect(clone.outputConnection);

//             mutation.setAttribute(DUPLICATE_ON_DRAG_MUTATION_KEY, "false");
//             this.draggingBlock_.domToMutation?.(mutation);
//         }
//     }
// }

export function isDuplicateOnDragBlock(block: Blockly.Block) {
    return block.mutationToDom?.()?.getAttribute(DUPLICATE_ON_DRAG_MUTATION_KEY)?.toLowerCase() === "true";
}