import * as Blockly from "blockly";
// import { DuplicateOnDragBlockDragger } from "./plugins/duplicateOnDrag";

// /**
//  * The following patch to blockly is to add the Trash icon on top of the toolbox,
//  * the trash icon should only show when a user drags a block that is already in the workspace.
//  */
// export class BlockDragger extends DuplicateOnDragBlockDragger {
//     drag(e: PointerEvent, currentDragDeltaXY: Blockly.utils.Coordinate): void {
//         const blocklyToolboxDiv = document.getElementsByClassName('blocklyToolboxDiv')[0] as HTMLElement;
//         const blocklyTreeRoot = document.getElementsByClassName('blocklyTreeRoot')[0] as HTMLElement
//             || document.getElementsByClassName('blocklyFlyout')[0] as HTMLElement;
//         const trashIcon = document.getElementById("blocklyTrashIcon");
//         if (blocklyTreeRoot && trashIcon) {
//             const distance = calculateDistance(blocklyTreeRoot.getBoundingClientRect(), e.clientX);
//             if (distance < 200) {
//                 const opacity = distance / 200;
//                 trashIcon.style.opacity = `${1 - opacity}`;
//                 trashIcon.style.display = 'block';
//                 if (blocklyToolboxDiv) {
//                     blocklyTreeRoot.style.opacity = `${opacity}`;
//                     if (distance < 50) {
//                         pxt.BrowserUtils.addClass(blocklyToolboxDiv, 'blocklyToolboxDeleting');
//                     }
//                 }
//             } else {
//                 trashIcon.style.display = 'none';
//                 blocklyTreeRoot.style.opacity = '1';
//                 if (blocklyToolboxDiv) pxt.BrowserUtils.removeClass(blocklyToolboxDiv, 'blocklyToolboxDeleting');
//             }
//         }
//         return super.drag(e, currentDragDeltaXY);
//     }

//     endDrag(e: PointerEvent, currentDragDeltaXY: Blockly.utils.Coordinate): void {
//         super.endDrag(e, currentDragDeltaXY);
//         const blocklyToolboxDiv = document.getElementsByClassName('blocklyToolboxDiv')[0] as HTMLElement;
//         const blocklyTreeRoot = document.getElementsByClassName('blocklyTreeRoot')[0] as HTMLElement
//             || document.getElementsByClassName('blocklyFlyout')[0] as HTMLElement;
//         const trashIcon = document.getElementById("blocklyTrashIcon");
//         if (trashIcon && blocklyTreeRoot) {
//             trashIcon.style.display = 'none';
//             blocklyTreeRoot.style.opacity = '1';
//             if (blocklyToolboxDiv) pxt.BrowserUtils.removeClass(blocklyToolboxDiv, 'blocklyToolboxDeleting');
//         }
//     }
// }

function calculateDistance(elemBounds: DOMRect, mouseX: number) {
    return Math.abs(mouseX - (elemBounds.left + (elemBounds.width / 2)));
}