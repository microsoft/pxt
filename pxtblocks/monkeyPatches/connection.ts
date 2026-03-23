import * as Blockly from "blockly";

export function monkeyPatchConnection() {
    const oldConnectionForOrphanedConnection = Blockly.Connection.getConnectionForOrphanedConnection;
    Blockly.Connection.getConnectionForOrphanedConnection = function (startBlock: Blockly.Block, orphanConnection: Blockly.Connection) {
        // When a block is dragged into an input that already has a non-shadow block connected, Blockly has
        // some logic that checks to see if the block you just dragged has a single input and, if so, connects
        // the previously connected block to the input of the block you just dragged. Presumably this is to make
        // it easier to wrap blocks with a new block (for example, dragging an absolute value block onto a number
        // in an equation will wrap it theoretically saving you an extra drag). However, nobody ever expects this
        // behavior and only the most powerful of power users would use it to their advantage. It also can cause
        // type errors when the displaced block is a variable since variables can be connected to any input regardless
        // of what type they actually hold. It's better to just disable it entirely.
        if (orphanConnection.type === Blockly.ConnectionType.OUTPUT_VALUE) {
            return null;
        }

        return oldConnectionForOrphanedConnection(startBlock, orphanConnection);
    }
}