namespace pxt.blocks {
    export interface DiffResult {
        ws?: Blockly.WorkspaceSvg;
        svg?: Element;
        deleted: number;
        added: number;
        modified: number;
    }

    export function diff(oldWs: Blockly.Workspace, newWs: Blockly.Workspace, options?: BlocksRenderOptions): DiffResult {
        Blockly.Events.disable();
        try {
            return diffNoEvents(oldWs, newWs, options);
        } finally {
            Blockly.Events.enable();
        }
    }

    function diffNoEvents(oldWs: Blockly.Workspace, newWs: Blockly.Workspace, options?: BlocksRenderOptions): DiffResult {
        const oldXml = pxt.blocks.saveWorkspaceXml(oldWs, true);
        const newXml = pxt.blocks.saveWorkspaceXml(newWs, true);

        if (oldXml == newXml) {
            return undefined; // no changes
        }

        const trashWs = new Blockly.Workspace();
        const oldBlocks = oldWs.getAllBlocks();
        const oldTopBlocks = oldWs.getTopBlocks(false);
        const newBlocks = newWs.getAllBlocks();
        console.log(`blocks`, newBlocks.map(b => b.id));
        console.log(newBlocks)

        // locate deleted and added blocks
        const deletedTopBlocks = oldTopBlocks.filter(b => !newWs.getBlockById(b.id));
        const deletedBlocks = oldBlocks.filter(b => !newWs.getBlockById(b.id));
        const addedBlocks = newBlocks.filter(b => !oldWs.getBlockById(b.id));

        // clone new workspace into rendering workspace
        const ws = pxt.blocks.initRenderingWorkspace();
        pxt.blocks.domToWorkspaceNoEvents(Blockly.Xml.textToDom(newXml), ws);
        const todoBlocks = Util.toDictionary(ws.getAllBlocks(), b => b.id);
        log('start')

        // 1. deleted top blocks
        deletedTopBlocks.forEach(b => {
            console.log(`deleted top ${b.id}`)
            done(b);
            const bdom = Blockly.Xml.blockToDom(b, false);
            b.inputList[0].insertFieldAt(0, new Blockly.FieldImage((b as any).REMOVE_IMAGE_DATAURI, 24, 24, false));
            const b2 = Blockly.Xml.domToBlock(bdom, ws);
            col(b2, "#aa0000");
        });
        log('deleted top')

        // 2. added blocks
        addedBlocks.map(b => ws.getBlockById(b.id)).forEach(b => {
            console.log(`added top ${b.id}`)
            b.inputList[0].insertFieldAt(0, new Blockly.FieldImage((b as any).ADD_IMAGE_DATAURI, 24, 24, false));
            done(b);
            col(b, "#00aa00");
        });
        log('added top')

        // 3. delete statement blocks

        // 4. moved blocks
        let modified = 0;
        Util.values(todoBlocks).filter(b => moved(b)).forEach(b => {
            console.log(`moved ${b.id}`)
            b.setColour("#0000aa");
            delete todoBlocks[b.id]
            modified++;
        })
        log('moved')

        // 5. blocks with field properties that changed
        Util.values(todoBlocks).filter(b => changed(b)).forEach(b => {
            console.log(`changed ${b.id}`)
            b.setColour("#aa00aa");
            delete todoBlocks[b.id]
            modified++;
        })
        log('changed')

        // all unmodifed blocks are greyed out
        Util.values(todoBlocks).forEach(b => b.setColour("#c0c0c0"));

        // make sure everything is rendered
        ws.getAllBlocks().forEach(forceRender);

        // final render
        const svg = pxt.blocks.renderWorkspace(options);

        // and we're done
        return {
            ws,
            svg: svg,
            deleted: deletedBlocks.length,
            added: addedBlocks.length,
            modified: modified
        }

        function forceRender(b: Blockly.Block) {
            const a = <any>b;
            a.rendered = false;
            b.inputList.forEach(i => i.fieldRow.forEach(f => {
                delete f.fieldGroup_; // force field rendering
                delete (<any>f).backgroundColour_;
                delete (<any>f).borderColour_;
            }));
        }

        function col(b: Blockly.Block, c: string) {
            vis(b, t => t.setColour(c));
        }

        function done(b: Blockly.Block) {
            vis(b, t => { delete todoBlocks[t.id]; });
        }

        function vis(b: Blockly.Block, f: (b: Blockly.Block) => void) {
            let t = b;
            while (t) {
                f(t);
                t = t.getNextBlock();
            }
        }

        function log(msg: string) {
            console.log(`${msg}:`, Object.keys(todoBlocks))
        }

        function moved(b: Blockly.Block) {
            const oldb = oldWs.getBlockById(b.id); // extra block created in added step
            if (!oldb)
                return false;

            const newPrevious = b.getPreviousBlock();
            // connection already already processed
            if (newPrevious && !todoBlocks[newPrevious.id])
                return false;
            const newNext = b.getNextBlock();
            // already processed
            if (newNext && !todoBlocks[newNext.id])
                return false;

            const oldPrevious = oldb.getPreviousBlock();
            if (!oldPrevious && !newPrevious) return false; // no connection
            if (!!oldPrevious != !!newPrevious // new connection
                || oldPrevious.id != newPrevious.id) // new connected blocks
                return true;
            const oldNext = oldb.getNextBlock();
            if (!oldNext && !newNext) return false; // no connection
            if (!!oldNext != !!newNext // new connection
                || oldNext.id != newNext.id) // new connected blocks
                return true;
            return false;
        }

        function changed(b: Blockly.Block) {
            let oldb = oldWs.getBlockById(b.id); // extra block created in added step
            if (!oldb)
                return false;

            // normalize
            oldb = normalize(oldb);
            b = normalize(b);

            //diff
            const oldText = normalizedDom(oldb);
            const newText = normalizedDom(b);

            return oldText != newText;
        }

        function normalize(b: Blockly.Block): Blockly.Block {
            const dom = Blockly.Xml.blockToDom(b);
            let sb = Blockly.Xml.domToBlock(dom, trashWs);
            const conn = sb.getFirstStatementConnection();
            if (conn) conn.disconnect();
            return sb;
        }

        function normalizedDom(b: Blockly.Block): string {
            const dom = Blockly.Xml.blockToDom(b, true);
            visDom(dom, (e) => {
                e.removeAttribute("deletable");
                e.removeAttribute("editable");
                e.removeAttribute("movable")
            })
            return Blockly.Xml.domToText(dom);
        }

        function visDom(el: Element, f: (e: Element) => void) {
            if (!el) return;
            f(el);
            for (const child of Util.toArray(el.children))
                visDom(child, f);
        }
    }
}