import * as Blockly from "blockly";

export class BlockDragger extends Blockly.dragging.Dragger {
    onDrag(e: PointerEvent, totalDelta: Blockly.utils.Coordinate): void {
        super.onDrag(e, totalDelta);

        const blocklyToolboxDiv = document.getElementsByClassName('blocklyToolboxDiv')[0] as HTMLElement;
        const blocklyTreeRoot = document.getElementsByClassName('blocklyTreeRoot')[0] as HTMLElement
            || document.getElementsByClassName('blocklyFlyout')[0] as HTMLElement;
        const trashIcon = document.getElementById("blocklyTrashIcon");
        if (blocklyTreeRoot && trashIcon) {
            const distance = calculateDistance(blocklyTreeRoot.getBoundingClientRect(), e.clientX);
            if (distance < 200) {
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
        super.onDragEnd(e);

        const blocklyToolboxDiv = document.getElementsByClassName('blocklyToolboxDiv')[0] as HTMLElement;
        const blocklyTreeRoot = document.getElementsByClassName('blocklyTreeRoot')[0] as HTMLElement
            || document.getElementsByClassName('blocklyFlyout')[0] as HTMLElement;
        const trashIcon = document.getElementById("blocklyTrashIcon");
        if (trashIcon && blocklyTreeRoot) {
            trashIcon.style.display = 'none';
            blocklyTreeRoot.style.opacity = '1';
            if (blocklyToolboxDiv) pxt.BrowserUtils.removeClass(blocklyToolboxDiv, 'blocklyToolboxDeleting');
        }
    }
}

function calculateDistance(elemBounds: DOMRect, mouseX: number) {
    return Math.abs(mouseX - (elemBounds.left + (elemBounds.width / 2)));
}