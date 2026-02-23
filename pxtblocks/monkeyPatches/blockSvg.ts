import * as Blockly from "blockly";
import { FieldImageNoText } from "../fields/field_imagenotext";
import { ConstantProvider } from "../plugins/renderer/constants";

export function monkeyPatchBlockSvg() {
    const oldSetCollapsed = Blockly.BlockSvg.prototype.setCollapsed;

    Blockly.BlockSvg.prototype.setCollapsed = function (this: Blockly.BlockSvg, collapsed: boolean) {
        if (collapsed === this.isCollapsed()) return;
        oldSetCollapsed.call(this, collapsed);

        if (this.isCollapsed()) {
            const input = this.getInput(Blockly.constants.COLLAPSED_INPUT_NAME);

            const image = ConstantProvider.EXPAND_IMAGE_DATAURI;
            if (image) {
                input.appendField(new FieldImageNoText(image, 24, 24, "", () => {
                    this.setCollapsed(false)
                }, false));
            }
        }
    }

    // This is duplicated exactly from Blockly.BlockSvg.prototype.dispose,
    // except the part that searches for the closest top level block
    // after the connection check, which was added to prevent the workspace
    // from scrolling to whatever is in the top-left whenever a block with
    // no parent is disposed.
    // See https://github.com/RaspberryPiFoundation/blockly/issues/9585
    Blockly.BlockSvg.prototype.dispose = function (this: Blockly.BlockSvg, healStack: boolean, animate: boolean) {
        this.disposing = true;

        Blockly.Tooltip.dispose();
        Blockly.ContextMenu.hide();

        // If this block (or a descendant) was focused, focus its parent or
        // workspace instead.
        const focusManager = Blockly.getFocusManager();
        if (
            this.getSvgRoot().contains(
                focusManager.getFocusedNode()?.getFocusableElement() ?? null,
            )
        ) {
            let parent: Blockly.BlockSvg | undefined | null = this.getParent();
            if (!parent) {
                // In some cases, blocks are disconnected from their parents before
                // being deleted. Attempt to infer if there was a parent by checking
                // for a connection within a radius of 0. Even if this wasn't a parent,
                // it must be adjacent to this block and so is as good an option as any
                // to focus after deleting.
                const connection = this.outputConnection ?? this.previousConnection;
                if (connection) {
                    const targetConnection = connection.closest(
                        0,
                        new Blockly.utils.Coordinate(0, 0),
                    ).connection;
                    parent = targetConnection?.getSourceBlock();
                }

                // If we didn't find a good match, search for the closest top-level block
                const workspace = this.workspace;
                if (workspace && !workspace.isFlyout) {
                    const topLevelBlocks = workspace.getTopBlocks(false);
                    let bestCandidate: Blockly.BlockSvg = undefined;
                    let bestDistance = 0;

                    for (const block of topLevelBlocks) {
                        if (block === this) continue;
                        const distance = Blockly.utils.Coordinate.distance(
                            this.getRelativeToSurfaceXY(),
                            block.getRelativeToSurfaceXY()
                        );

                        if (bestCandidate === undefined || distance < bestDistance) {
                            bestCandidate = block;
                            bestDistance = distance;
                        }
                    }
                    parent = bestCandidate;
                }

            }
            if (parent) {
                focusManager.focusNode(parent);
            } else {
                setTimeout(() => focusManager.focusTree(this.workspace), 0);
            }
        }

        if (animate) {
            this.unplug(healStack);
            Blockly.blockAnimations.disposeUiEffect(this);
        }

        Blockly.Block.prototype.dispose.call(this, !!healStack);
        Blockly.utils.dom.removeNode(this.getSvgRoot());
    }
}