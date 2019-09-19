namespace pxt.blocks {
    export interface DiffResult {
        ws?: Blockly.Workspace;
        deleted: number;
        added: number;
        modified: number;
    }

    export function diff(oldWs: Blockly.Workspace, newWs: Blockly.Workspace): DiffResult {
        const oldXml = pxt.blocks.saveWorkspaceXml(oldWs);
        const newXml = pxt.blocks.saveWorkspaceXml(newWs);

        if (oldXml == newXml) {
            return undefined; // no changes
        }

        const oldBlocks = oldWs.getAllBlocks();
        const oldTopBlocks = oldWs.getTopBlocks(false);
        const newBlocks = newWs.getAllBlocks();
        const newTopBlocks = newWs.getTopBlocks(false);

        // locate deleted and added blocks
        const deletedTopBlocks = oldTopBlocks.filter(b => !newWs.getBlockById(b.id));
        const deletedBlocks = oldBlocks.filter(b => !newWs.getBlockById(b.id));
        const addedTopBlocks = newTopBlocks.filter(b => !oldWs.getBlockById(b.id));
        const addedBlocks = newBlocks.filter(b => !oldWs.getBlockById(b.id));

        // clone new workspace
        const ws = pxt.blocks.loadWorkspaceXml(pxt.blocks.saveWorkspaceXml(newWs), true);

        // 1. topblocks
        // add deleted top blocks and disable them
        deletedTopBlocks.forEach(b => {
            ws.addTopBlock(b);
            b.setDisabled(true);
        });
        // find added top blocks and mark them as added: TODO better marking
        addedTopBlocks.forEach(b => {
            ws.highlightBlock(b.id)
        });

        // and we're done
        return {
            ws,
            deleted: deletedBlocks.length,
            added: addedBlocks.length,
            modified: 0
        }
    }
}