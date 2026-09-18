import * as Blockly from "blockly";
import { clearBackpackDragState, refreshBackpackDragTargets } from "./backpack";

export class BlockDragger extends Blockly.dragging.Dragger {
    onDrag(e: PointerEvent, totalDelta: Blockly.utils.Coordinate): void {
        refreshBackpackDragTargets(this.draggable.workspace);
        super.onDrag(e, totalDelta);

        const blocklyToolboxDiv = document.getElementsByClassName('blocklyToolbox')[0] as HTMLElement;
        const blocklyTreeRoot = document.getElementsByClassName('blocklyTreeRoot')[0] as HTMLElement
            || document.getElementsByClassName('blocklyFlyout')[0] as HTMLElement;
        const trashIcon = document.getElementById("blocklyTrashIcon");
        if (blocklyTreeRoot && trashIcon) {
            const rect = blocklyTreeRoot.getBoundingClientRect()
            const distance = calculateDistance(blocklyTreeRoot.getBoundingClientRect(), e.clientX);
            const isMouseDrag = Blockly.Gesture.inProgress();
            if ((isMouseDrag && distance < 200) || (!isMouseDrag && isOverlappingRect(rect, e.clientX))) {
                const opacity = distance / 200;
                trashIcon.style.opacity = `${1 - opacity}`;
                trashIcon.style.display = 'block';
                if (blocklyToolboxDiv) {
                    blocklyTreeRoot.style.opacity = `${opacity}`;
                    if (distance < 50) {
                        pxt.BrowserUtils.addClass(blocklyToolboxDiv, 'blocklyToolboxDeleting');
                    }
                }
            } else {
                trashIcon.style.display = 'none';
                blocklyTreeRoot.style.opacity = '1';
                if (blocklyToolboxDiv) pxt.BrowserUtils.removeClass(blocklyToolboxDiv, 'blocklyToolboxDeleting');
            }
        }
    }

    onDragEnd(e: PointerEvent): void {
        try {
            if (refreshBackpackDragTargets(this.draggable.workspace) && e instanceof PointerEvent) {
                this.updateDragTarget(new Blockly.utils.Coordinate(e.clientX, e.clientY));
            }
            super.onDragEnd(e);
        } finally {
            clearBackpackDragState(this.draggable.workspace);
        }

        const blocklyToolboxDiv = document.getElementsByClassName('blocklyToolbox')[0] as HTMLElement;
        const blocklyTreeRoot = document.getElementsByClassName('blocklyTreeRoot')[0] as HTMLElement
            || document.getElementsByClassName('blocklyFlyout')[0] as HTMLElement;
        const trashIcon = document.getElementById("blocklyTrashIcon");
        if (trashIcon && blocklyTreeRoot) {
            trashIcon.style.display = 'none';
            blocklyTreeRoot.style.opacity = '1';
            if (blocklyToolboxDiv) pxt.BrowserUtils.removeClass(blocklyToolboxDiv, 'blocklyToolboxDeleting');
        }
    }

    onDragRevert(): void {
        try {
            super.onDragRevert();
        } finally {
            clearBackpackDragState(this.draggable.workspace);
        }
    }
}

function calculateDistance(elemBounds: DOMRect, mouseX: number) {
    return Math.abs(mouseX - (elemBounds.left + (elemBounds.width / 2)));
}

function isOverlappingRect(elemBounds: DOMRect, mouseX: number) {
    return (mouseX - (elemBounds.left + (elemBounds.width))) < 0;
}