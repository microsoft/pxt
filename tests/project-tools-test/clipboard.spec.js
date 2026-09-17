"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { launchTestBrowser } = require("./browser");

const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const compile = text => {
    const result = ts.transpileModule(text, {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
        reportDiagnostics: true
    });
    assert.deepStrictEqual(result.diagnostics, []);
    return result.outputText;
};

// Load only the current copy/paste adapter; dependency consent/conflicts are
// covered by backpack-project.spec.js through the same shared preparation module.
const source = ts.createSourceFile("blocks.tsx", read("webapp/src/blocks.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const editorClass = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === "Editor");
assert(editorClass, "Expected the current Blocks Editor class");
const memberNames = ["pasteInProgress", "pasteAsync", "canPasteData", "createSnippetHost"];
const members = memberNames.map(name => {
    const member = editorClass.members.find(node => node.name?.getText(source) === name);
    assert(member, `Missing Editor.${name}`);
    return member.getText(source);
});
const functionNames = ["copy", "saveCopyData", "getCopyData", "copyDataKey"];
const declarations = ["CopyDataEntry", ...functionNames].map(name => {
    const node = source.statements.find(node => node.name?.getText(source) === name);
    assert(node, `Missing clipboard declaration ${name}`);
    return node.getText(source);
});
const adapterSource = compile(`${declarations.join("\n")}\nclass SourceEditor { ${members.join("\n")} }
    exports.SourceEditor = SourceEditor;
    Object.assign(exports, { ${functionNames.join(", ")} });`);
const sharedSource = compile(read("webapp/src/blockSnippet.ts"));
const validatorSource = compile(read("webapp/src/backpack.ts"));

describe("Clipboard native Blockly round trip (isolated browser, no PXT build)", function () {
    this.timeout(30000);
    let browser;
    let page;
    before(async () => { browser = await launchTestBrowser(); });
    after(async () => { if (browser) await browser.close(); });
    afterEach(async () => { if (page) { await page.close(); page = undefined; } });

    it("native full field serialization restores an ordinary expression into a fresh workspace using the real adapter and shared pipeline", async () => {
        page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on("request", request => request.abort());
        await page.setContent('<div id="source" style="width:600px;height:300px"></div><div id="destination" style="width:600px;height:300px"></div>');
        const directory = path.dirname(require.resolve("blockly"));
        for (const file of ["blockly_compressed.js", "blocks_compressed.js", "msg/en.js"]) {
            await page.addScriptTag({ path: path.join(directory, file) });
        }
        const result = await page.evaluate(({ adapterSource, sharedSource, validatorSource }) => {
            return (async () => {
                const B = window.Blockly;
                const fail = () => { throw new Error("Unexpected clipboard dependency"); };
                const payload = { id: "source-only", pixels: [1, 4, 8], tiles: { cells: [2, 3], walls: [0, 1] } };
                class FullField extends B.Field {
                    constructor() { super("image"); this.state = JSON.parse(JSON.stringify(payload)); this.SERIALIZABLE = true; }
                    saveState(full) { return full ? this.state : this.state.id; }
                    loadState(value) {
                        if (typeof value === "string") throw new Error("Source asset lookup is forbidden");
                        this.state = value;
                    }
                }
                B.Blocks.clipboard_expression = { init() {
                    this.appendDummyInput().appendField(new FullField(), "IMAGE");
                    this.setOutput(true);
                } };
                const sourceWorkspace = B.inject("source", { scrollbars: true });
                const destination = B.inject("destination", { scrollbars: true });
                try {
                    const block = sourceWorkspace.newBlock("clipboard_expression");
                    block.initSvg(); block.render(); block.moveBy(30, 40);
                    await B.renderManagement.finishQueuedRenders();
                    const storage = new Map();
                    const dialogs = [];
                    const header = { id: "browser-project" };
                    const pxt = {
                        CONFIG_NAME: "pxt.json", appTarget: { id: "arcade", versions: { target: "1.0.0", pxt: "13.2.4" } },
                        shell: { isReadOnly: () => false }, U: { jsonTryParse: JSON.parse },
                        Util: { jsonTryParse: text => { try { return JSON.parse(text); } catch { return undefined; } } },
                        blocks: { compileInfo: () => ({ definitionNameToParam: {} }) },
                        Package: { parseAndValidConfig: JSON.parse },
                        storage: { setLocal: (key, value) => storage.set(key, value), getLocal: key => storage.get(key) }
                    };
                    const pkg = {
                        mainPkg: { id: "this", deps: {} },
                        mainEditorPkg: () => ({ header, files: { "pxt.json": { content: '{"dependencies":{}}' } } })
                    };
                    const core = { confirmAsync: async options => { dialogs.push(options); return 1; } };
                    const pxtblockly = { builtinBlocks: () => ({}), captureBackpackBlock: fail, pasteBackpackBlock: fail };
                    const globals = {
                        pxt, pkg, core, Blockly: B, pxtblockly, lf: text => text,
                        auth: { loggedIn: () => false, userProfile: () => undefined },
                        showCopiedHint() {}, showCutHint() {}, clearPasteHints() {}, shouldDuplicateOnDrag: () => false
                    };
                    const execute = (code, imports = {}) => {
                        const exports = {};
                        const module = new Function(...Object.keys(globals), `return function(exports, require) { ${code}\n}`)(...Object.values(globals));
                        module(exports, id => {
                            if (!(id in imports)) return fail();
                            return imports[id];
                        });
                        return exports;
                    };
                    const validator = execute(validatorSource);
                    Object.assign(globals, execute(sharedSource, {
                        blockly: B, "../../pxtblocks": pxtblockly, "./package": pkg, "./core": core, "./backpack": validator
                    }));
                    const api = execute(adapterSource);
                    const editor = new api.SourceEditor();
                    editor.blockInfo = { blocksById: { clipboard_expression: { pkg: "main", fileName: "main.ts" } }, apis: { byQName: {} } };
                    editor.editor = sourceWorkspace;
                    editor.parent = { state: { header }, isBlocksActive: () => true, saveProjectAsync: fail, reloadHeaderAsync: fail };
                    const copied = api.copy(sourceWorkspace, new KeyboardEvent("copy"), {}, { focusedNode: block }, editor.blockInfo);
                    const entry = api.getCopyData();
                    block.dispose(); // No original block/asset registry is available when loading full state.
                    editor.editor = destination;
                    await editor.pasteAsync(entry);
                    await B.renderManagement.finishQueuedRenders();
                    const pasted = destination.getTopBlocks(false);
                    return {
                        copied, stored: entry.data.blockState.fields.IMAGE,
                        restored: pasted[0]?.getField("IMAGE").state,
                        types: pasted.map(block => block.type), typeCounts: entry.data.typeCounts,
                        requirements: entry.requirements, dialogs, sourceCount: sourceWorkspace.getAllBlocks(false).length
                    };
                } finally {
                    sourceWorkspace.dispose(); destination.dispose();
                }
            })();
        }, { adapterSource, sharedSource, validatorSource });
        assert.strictEqual(result.copied, true);
        assert.deepStrictEqual(result.types, ["clipboard_expression"]);
        assert.deepStrictEqual(result.stored, { id: "source-only", pixels: [1, 4, 8], tiles: { cells: [2, 3], walls: [0, 1] } });
        assert.deepStrictEqual(result.restored, result.stored);
        assert.deepStrictEqual(result.typeCounts, { clipboard_expression: 1 });
        assert.deepStrictEqual(result.requirements, { dependencies: {}, projectBlocks: { clipboard_expression: "main.ts" } });
        assert.deepStrictEqual(result.dialogs, []);
        assert.strictEqual(result.sourceCount, 0);
    });
});