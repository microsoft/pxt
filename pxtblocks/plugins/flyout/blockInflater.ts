import * as Blockly from "blockly";

export const HIDDEN_CLASS_NAME = "pxtFlyoutHidden";

export class MultiFlyoutRecyclableBlockInflater extends Blockly.BlockFlyoutInflater {
    protected keyToBlock: Map<string, Blockly.BlockSvg> = new Map();
    protected blockToKey: Map<Blockly.BlockSvg, string> = new Map();

    static register() {
        Blockly.registry.register(
            Blockly.registry.Type.FLYOUT_INFLATER,
            "block",
            MultiFlyoutRecyclableBlockInflater,
            true,
        );
    }

    protected isBlockRecycleable(block: Blockly.BlockSvg): boolean {
        switch (block.type) {
            case "variables_get":
            case "variables_set":
            case "variables_change":
                return false;
        }

        return true;
    }

    override createBlock(blockDefinition: Blockly.utils.toolbox.BlockInfo, workspace: Blockly.WorkspaceSvg): Blockly.BlockSvg {
        const key = getKeyForBlock(blockDefinition);

        if (!key) {
            return super.createBlock(blockDefinition, workspace);
        }

        let block: Blockly.BlockSvg;
        if (this.keyToBlock.has(key)) {
            block = this.keyToBlock.get(key);
            this.keyToBlock.delete(key);
        }

        block = block ?? super.createBlock(blockDefinition, workspace);
        this.blockToKey.set(block, key);

        block.removeClass(HIDDEN_CLASS_NAME);
        block.setDisabledReason(false, HIDDEN_CLASS_NAME);
        return block;
    }

    override disposeItem(item: Blockly.FlyoutItem): void {
        const element = item.getElement();
        if (element instanceof Blockly.BlockSvg) {
            if (this.blockToKey.has(element)) {
                if (this.isBlockRecycleable(element)) {
                    this.recycleBlock(element);

                    return;
                }

                this.blockToKey.delete(element);
            }
        }

        super.disposeItem(item);
    }

    clearCache() {
        this.blockToKey = new Map();
        this.keyToBlock = new Map();
    }

    protected recycleBlock(block: Blockly.BlockSvg) {
        const xy = block.getRelativeToSurfaceXY();
        block.moveBy(-xy.x, -xy.y);
        block.addClass(HIDDEN_CLASS_NAME);
        block.setDisabledReason(true, HIDDEN_CLASS_NAME);
        const key = this.blockToKey.get(block);
        this.keyToBlock.set(key, block);
        this.removeListeners(block.id);
    }
}

function getKeyForBlock(blockDefinition: Blockly.utils.toolbox.BlockInfo) {
    // all of pxt's flyouts use blockxml
    if (blockDefinition.blockxml) {
        if (typeof blockDefinition.blockxml === "string") {
            return blockDefinition.blockxml;
        }
        else {
            return Blockly.Xml.domToText(blockDefinition.blockxml);
        }
    }

    return blockDefinition.type;
}

Blockly.Css.register(`
.${HIDDEN_CLASS_NAME} {
    display: none;
}
`);
