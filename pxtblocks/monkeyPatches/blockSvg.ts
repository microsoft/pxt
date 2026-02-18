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
    // except the radius of the connection search is increased to make
    // it more likely to focus a nearby block instead of the workspace
    // when a block is deleted. See https://github.com/RaspberryPiFoundation/blockly/issues/9585
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
                const connection = this.outputConnection ?? this.previousConnection;
                if (connection) {
                    // By default, Blockly searches for nearby connections within a radius of 0
                    // to only get blocks that are touching. As a result, it usually returns nothing
                    // and focuses the root of the workspace. Instead, we use the workspace dimensions
                    // to try and find a block that's on screen
                    const workspace = this.workspace;
                    const viewMetrics = workspace?.getMetrics();
                    const radius = viewMetrics ? Math.max(viewMetrics.viewWidth, viewMetrics.viewHeight) / 2: 0;

                    const targetConnection = connection.closest(
                        radius,
                        new Blockly.utils.Coordinate(0, 0),
                    ).connection;
                    parent = targetConnection?.getSourceBlock();
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