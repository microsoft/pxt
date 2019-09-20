namespace pxt.blocks {
    export interface DiffResult {
        ws?: Blockly.WorkspaceSvg;
        svg?: Element;
        deleted: number;
        added: number;
        modified: number;
    }

    export function diff(oldWs: Blockly.Workspace, newWs: Blockly.Workspace, options?: BlocksRenderOptions): DiffResult {
        const oldXml = pxt.blocks.saveWorkspaceXml(oldWs, true);
        const newXml = pxt.blocks.saveWorkspaceXml(newWs, true);

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

        // clone new workspace into rendering workspace
        const ws = pxt.blocks.initRenderingWorkspace();
        pxt.blocks.domToWorkspaceNoEvents(Blockly.Xml.textToDom(newXml), ws);

        //const ws = pxt.blocks.loadWorkspaceXml(pxt.blocks.saveWorkspaceXml(newWs), true);

        // all blocks are disabled
        ws.getAllBlocks().forEach(b => disable(b, true));

        // 1. topblocks
        // add deleted top blocks and disable them
        deletedTopBlocks.forEach(b => {
            const bdom = Blockly.Xml.blockToDom(b, false);
            const b2 = Blockly.Xml.domToBlock(bdom, ws);
            disable(b2, false);
            col(b2, "#aa0000");
        });
        // find added top blocks and mark them as added: TODO better marking
        addedTopBlocks.map(b => ws.getBlockById(b.id)).forEach(b => {
            disable(b, false);
            col(b, "#00aa00");
        });

        // final render
        const svg = pxt.blocks.renderWorkspace(options);

        // and we're done
        return {
            ws,
            svg: svg,
            deleted: deletedBlocks.length,
            added: addedBlocks.length,
            modified: 0
        }

        function col(b: Blockly.Block, c: string) {
            vis(b, t => t.setColour(c));
        }

        function disable(b: Blockly.Block, v: boolean) {
            vis(b, t => {
                t.setDeletable(false);
                t.setEditable(false);
                t.setDisabled(v);
            });
        }

        function vis(b: Blockly.Block, f: (b: Blockly.Block) => void) {
            let t = b;
            while (t) {
                f(t);
                t = t.getNextBlock();
            }
        }
    }
}