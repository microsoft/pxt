import * as Blockly from "blockly";
import { assertMethod } from "./util";


export function monkeyPatchBlockDragStrategy() {
    const proto = Blockly.dragging.BlockDragStrategy.prototype as any;

    assertMethod(proto, "getAllConnections");

    const getAllConnections = function (this: Blockly.dragging.BlockDragStrategy, block: Blockly.BlockSvg): Blockly.RenderedConnection[] {
        // The commented line below is the only change from the stock drag strategy.
        // MakeCode allows nested shadow blocks
        // if (block.isShadow()) return [];

        const connections = [];

        if (block.outputConnection) connections.push(block.outputConnection);
        if (block.previousConnection) connections.push(block.previousConnection);

        if (!block.isCollapsed()) {
            for (const input of block.inputList) {
                if (input.connection && input.isVisible()) {
                    connections.push(input.connection);
                    const target = input.connection.targetBlock() as Blockly.BlockSvg;
                    if (target) {
                        connections.push(...getAllConnections.call(this, target));
                    }
                }
            }
        }
        if (block.nextConnection) {
            connections.push(block.nextConnection);

            const target = block.nextConnection.targetBlock() as Blockly.BlockSvg;
            if (target) {
                connections.push(...getAllConnections.call(this, target));
            }
        }

        return connections as Blockly.RenderedConnection[];
    }
    proto.getAllConnections = getAllConnections;
}