import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";

describe("block definition reinjection", () => {
    const id = "test_managed_definition_refresh";
    const emptyInfo: pxtc.BlocksInfo = {
        apis: { byQName: {}, jres: {} },
        blocks: [],
        blocksById: {},
        enumsByName: {},
        kindsByName: {}
    };
    let previousInfo: pxtc.BlocksInfo;
    let originalError: typeof pxt.error;
    let errors: string[];

    beforeEach(() => {
        previousInfo = pxtblockly.cachedBlockInfo;
        pxtblockly.initialize(emptyInfo);
        pxtblockly.builtinBlocks();
        chai.assert.isUndefined(Blockly.Blocks[id]);
        errors = [];
        originalError = pxt.error;
        pxt.error = message => { errors.push(message); };
    });

    afterEach(() => {
        pxt.error = originalError;
        pxtblockly.cleanBlocks();
        delete Blockly.Blocks[id];
        pxtblockly.injectBlocks(previousInfo || emptyInfo);
    });

    function symbol(qName = "test.refresh", label = "test block"): pxtc.SymbolInfo {
        return {
            qName,
            name: "refresh",
            namespace: "test",
            fileName: "main.ts",
            kind: pxtc.SymbolKind.Function,
            retType: "void",
            parameters: [],
            attributes: {
                blockId: id,
                block: label,
                _def: pxtc.parseBlockDefinition(label),
                paramDefl: {},
                callingConvention: pxtc.ir.CallingConvention.Plain
            }
        };
    }

    function inject(fn: pxtc.SymbolInfo): void {
        pxtblockly.injectBlocks({
            ...emptyInfo,
            apis: { ...emptyInfo.apis, byQName: { [fn.qName]: fn } },
            blocks: [fn],
            blocksById: { [id]: fn }
        });
    }

    it("reuses an unchanged owned definition", () => {
        const fn = symbol();
        inject(fn);
        const definition = Blockly.Blocks[id];

        inject(fn);

        chai.assert.strictEqual(Blockly.Blocks[id], definition);
        chai.assert.deepEqual(errors, []);
    });

    it("refreshes an owned symbol when project metadata changes", () => {
        const first = symbol();
        inject(first);
        const refreshed = { ...first, fileName: "pxt_modules/test/main.ts", isReadOnly: true };

        inject(refreshed);

        chai.assert.strictEqual(pxtblockly.blockSymbol(id), refreshed);
        chai.assert.deepEqual(errors, []);
    });

    it("updates an owned symbol's block definition", () => {
        inject(symbol());
        const original = Blockly.Blocks[id];
        const refreshed = symbol("test.refresh", "updated block");
        refreshed.attributes.jsDoc = "Updated documentation";

        inject(refreshed);

        chai.assert.notStrictEqual(Blockly.Blocks[id], original);
        chai.assert.strictEqual(pxtblockly.blockSymbol(id), refreshed);
        chai.assert.deepEqual(errors, []);
    });

    it("still reports different symbols claiming the same ID", () => {
        const first = symbol();
        inject(first);
        const definition = Blockly.Blocks[id];

        inject(symbol("other.refresh"));

        chai.assert.strictEqual(Blockly.Blocks[id], definition);
        chai.assert.strictEqual(pxtblockly.blockSymbol(id), first);
        chai.assert.deepEqual(errors, ["duplicate block definition: " + id]);
    });

    it("does not overwrite a foreign replacement even when the cached hash matches", () => {
        const fn = symbol();
        inject(fn);
        const foreign = { init() { } };
        Blockly.Blocks[id] = foreign;

        inject(fn);

        chai.assert.strictEqual(Blockly.Blocks[id], foreign);
        chai.assert.deepEqual(errors, ["duplicate block definition: " + id]);
    });

    it("recreates an owned definition removed from the registry", () => {
        const fn = symbol();
        inject(fn);
        delete Blockly.Blocks[id];

        inject(fn);

        chai.assert.isDefined(Blockly.Blocks[id]);
        chai.assert.strictEqual(pxtblockly.blockSymbol(id), fn);
        chai.assert.deepEqual(errors, []);
    });
});
