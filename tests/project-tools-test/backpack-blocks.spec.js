"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const Blockly = require("blockly");
require("blockly/blocks");
const { launchTestBrowser } = require("./browser");

const root = path.resolve(__dirname, "../..");
const lf = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, index) => args[index]);
const pxt = { reportException: error => { throw error; }, warn: () => {}, U: { assert } };
const source = relative => ts.transpileModule(fs.readFileSync(path.join(root, relative), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 }
}).outputText;

// Compile the actual source in memory. Never depend on built/pxtblocks or write a fixture to disk.
// The native functions plugin is also loaded from source; only unrelated editor/drag UI is stubbed.
const modules = new Map();
function load(relative) {
    const file = path.resolve(root, relative);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} };
    modules.set(file, module);
    const localRequire = id => {
        if (id === "blockly") return Blockly;
        const resolved = path.resolve(path.dirname(file), id);
        if (resolved === path.join(root, "pxtblocks/loader")) return { DRAGGABLE_PARAM_INPUT_PREFIX: "HANDLER_DRAG_PARAM_" };
        if (resolved === path.join(root, "pxtblocks/compiler/util")) return { isFunctionDefinition: b => b.type === "function_definition" };
        if (resolved === path.join(root, "pxtblocks/plugins/duplicateOnDrag")) return {
            setDuplicateOnDrag: () => {}, setDuplicateOnDragStrategy: () => {}, updateDuplicateOnDragState: () => {}
        };
        if (resolved === path.join(root, "pxtblocks/utils")) return { maybeMoveFocusFromButton: () => {} };
        return load(resolved + ".ts");
    };
    new Function("require", "module", "exports", "lf", "pxt", source(path.relative(root, file)))(
        localRequire, module, module.exports, lf, pxt);
    return module.exports;
}

const backpack = load("pxtblocks/backpack.ts");
load("pxtblocks/plugins/functions/extensions.ts");
load("pxtblocks/plugins/functions/fields/fieldArgumentReporter.ts");
load("pxtblocks/plugins/functions/blocks/argumentReporterBlocks.ts");
load("pxtblocks/plugins/functions/blocks/functionDefinitionBlock.ts");
load("pxtblocks/plugins/functions/blocks/functionCallBlocks.ts");

Blockly.Blocks.backpack_test_container = {
    init() {
        this.appendStatementInput("BODY");
        this.appendValueInput("VALUE");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
    }
};
Blockly.Blocks.backpack_test_statement = {
    init() { this.setPreviousStatement(true); this.setNextStatement(true); }
};
Blockly.Blocks.backpack_test_values = {
    init() {
        this.appendDummyInput().appendField("visible action")
            .appendField(new Blockly.FieldTextInput("secret message"), "TEXT")
            .appendField(new Blockly.FieldNumber(37), "NUMBER")
            .appendField(new Blockly.FieldDropdown([["Displayed choice", "InternalEnum.Member"]]), "CHOICE");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
    }
};
class AssetField extends Blockly.Field {
    constructor() { super("asset"); this.SERIALIZABLE = true; }
    saveState(full) { return full ? { id: "asset-id", pixels: "FULL_ASSET" } : "asset-id"; }
    loadState(state) { this.loaded = state; }
    getFieldDescription() { return "  Named\n  asset  "; }
}
Blockly.Blocks.backpack_test_asset = {
    init() { this.appendDummyInput().appendField(new AssetField(), "ASSET"); this.setOutput(true); }
};

const append = (workspace, state) => Blockly.serialization.blocks.append(state, workspace);
const container = body => ({ type: "backpack_test_container", inputs: body ? { BODY: { block: body } } : {} });
const statement = { type: "backpack_test_statement" };
const codeFor = (...blocks) => JSON.stringify({ blocks });
const flushEvents = () => new Promise(resolve => setTimeout(resolve, 0));

function defineFunction(workspace, name, id, args = []) {
    return append(workspace, { type: "function_definition", extraState: { name, functionid: id, arguments: args } });
}
function callFunction(workspace, definition) {
    return append(workspace, { type: "function_call", extraState: definition.saveExtraState() });
}

describe("Backpack block serialization (current source, installed Blockly)", () => {
    let sourceWorkspace;
    let destination;
    beforeEach(() => { sourceWorkspace = new Blockly.Workspace(); destination = new Blockly.Workspace(); });
    afterEach(async () => {
        await flushEvents();
        sourceWorkspace.dispose(); destination.dispose();
        await flushEvents();
    });

    it("accepts only real editable movable statement containers", () => {
        const block = append(sourceWorkspace, container());
        assert(backpack.isBackpackContainer(block));
        assert(!backpack.isBackpackContainer(append(sourceWorkspace, statement)));
        block.setEditable(false); assert(!backpack.isBackpackContainer(block)); block.setEditable(true);
        block.setMovable(false); assert(!backpack.isBackpackContainer(block)); block.setMovable(true);
        block.setShadow(true); assert(!backpack.isBackpackContainer(block)); block.setShadow(false);
        block.isInFlyout = true; assert(!backpack.isBackpackContainer(block)); block.isInFlyout = false;
        sourceWorkspace.options.readOnly = true; assert(!backpack.isBackpackContainer(block));
        sourceWorkspace.options.readOnly = false;
        block.dispose(); assert(!backpack.isBackpackContainer(block));
    });

    it("isolates a nested root, retaining all input statements but no ancestors or following siblings", () => {
        const parent = append(sourceWorkspace, container(container({ ...statement, next: { block: statement } })));
        const nested = parent.getInputTargetBlock("BODY");
        nested.nextConnection.connect(append(sourceWorkspace, statement).previousConnection);
        const code = backpack.captureBackpackBlock(nested).code;
        const state = JSON.parse(code).blocks[0];
        assert(!state.next && !state.id && state.x === undefined && state.y === undefined);
        assert(state.inputs.BODY.block.next.block);
        assert.equal(backpack.pasteBackpackBlock(code, destination).getDescendants(false).length, 3);
        assert.equal(parent.getInputTargetBlock("BODY"), nested);
        assert(nested.getNextBlock());
    });

    it("preserves if mutations, full variable state, and full asset field state", () => {
        const block = append(sourceWorkspace, {
            type: "controls_if", extraState: { elseIfCount: 1, hasElse: true },
            inputs: {
                DO0: { block: { type: "variables_set", fields: { VAR: { name: "score", type: "", id: "source-var" } } } },
                DO1: { block: container() }, ELSE: { block: statement }
            }
        });
        const variable = destination.getVariableMap().createVariable("score", "", "destination-var");
        const code = backpack.captureBackpackBlock(block).code;
        const pasted = backpack.pasteBackpackBlock(code, destination);
        assert.deepStrictEqual(pasted.saveExtraState(), block.saveExtraState());
        assert.equal(pasted.getInputTargetBlock("DO0").getFieldValue("VAR"), variable.getId());
        assert(pasted.getInputTargetBlock("DO1") && pasted.getInputTargetBlock("ELSE"));
        const assetContainer = append(sourceWorkspace, { ...container(), inputs: { VALUE: { block: { type: "backpack_test_asset" } } } });
        const assetCode = backpack.captureBackpackBlock(assetContainer).code;
        assert(assetCode.includes("FULL_ASSET"));
        const asset = backpack.pasteBackpackBlock(assetCode, destination).getInputTargetBlock("VALUE").getField("ASSET");
        assert.deepStrictEqual(asset.loaded, { id: "asset-id", pixels: "FULL_ASSET" });
    });

    it("captures displayed labels and field values from only the saved graph without mutating the workspace", async () => {
        const parent = append(sourceWorkspace, container(container({ type: "backpack_test_values",
            next: { block: { type: "backpack_test_values", fields: { TEXT: "second body statement" } } } })));
        const block = parent.getInputTargetBlock("BODY");
        parent.appendDummyInput().appendField("EXCLUDED_ANCESTOR");
        block.appendDummyInput().appendField("saved container");
        const sibling = append(sourceWorkspace, { type: "backpack_test_values", fields: { TEXT: "EXCLUDED_SIBLING" } });
        block.nextConnection.connect(sibling.previousConnection);
        block.getInput("VALUE").connection.connect(append(sourceWorkspace, { type: "backpack_test_asset" }).outputConnection);
        await flushEvents();
        sourceWorkspace.clearUndo();
        const before = Blockly.serialization.workspaces.save(sourceWorkspace);
        const blocks = sourceWorkspace.getAllBlocks(false);
        const events = [];
        const listener = event => events.push(event);
        sourceWorkspace.addChangeListener(listener);
        try {
            const captured = backpack.captureBackpackBlock(block);
            for (const text of ["saved container", "visible action", "secret message", "37", "Displayed choice",
                "second body statement", "Named asset"]) assert(captured.blockText.includes(text), text);
            for (const text of ["InternalEnum.Member", "EXCLUDED_ANCESTOR", "EXCLUDED_SIBLING", "FULL_ASSET", "asset-id"])
                assert(!captured.blockText.includes(text), text);
            const state = JSON.parse(captured.code).blocks[0];
            assert.equal(state.inputs.BODY.block.fields.CHOICE, "InternalEnum.Member");
            assert(!state.next);
            assert(!/EXCLUDED_/.test(captured.code));
            assert.deepStrictEqual(backpack.captureBackpackBlock(block), captured);
            await flushEvents();
            assert.deepStrictEqual(Blockly.serialization.workspaces.save(sourceWorkspace), before);
            assert.deepStrictEqual(sourceWorkspace.getAllBlocks(false), blocks);
            assert.strictEqual(parent.getInputTargetBlock("BODY"), block);
            assert.strictEqual(block.getNextBlock(), sibling);
            assert.deepStrictEqual(sourceWorkspace.getUndoStack(), []);
            assert.deepStrictEqual(events, []);
        } finally { sourceWorkspace.removeChangeListener(listener); }
    });

    it("allows empty captured text and bounds descriptions independently of serialized code", () => {
        const block = append(sourceWorkspace, container());
        assert.strictEqual(backpack.captureBackpackBlock(block).blockText, "");
        block.appendDummyInput().appendField("x".repeat(100001));
        const captured = backpack.captureBackpackBlock(block);
        assert.strictEqual(captured.blockText, "x".repeat(100000));
        assert(captured.code.length < 100000);
    });

    it("collects transitive and recursive native functions and remaps collisions without changing existing calls", async () => {
        const args = [{ id: "arg-id", name: "amount", type: "number" }];
        const first = defineFunction(sourceWorkspace, "first", "first-id", args);
        const second = defineFunction(sourceWorkspace, "second", "second-id");
        first.getInput("STACK").connection.connect(callFunction(sourceWorkspace, second).previousConnection);
        second.getInput("STACK").connection.connect(callFunction(sourceWorkspace, first).previousConnection);
        first.getInputTargetBlock("STACK").nextConnection.connect(append(sourceWorkspace,
            { type: "backpack_test_values", fields: { TEXT: "first function body" } }).previousConnection);
        second.getInputTargetBlock("STACK").nextConnection.connect(append(sourceWorkspace,
            { type: "backpack_test_values", fields: { TEXT: "transitive function body" } }).previousConnection);
        const unrelated = defineFunction(sourceWorkspace, "unrelated", "unrelated-id");
        unrelated.getInput("STACK").connection.connect(append(sourceWorkspace,
            { type: "backpack_test_values", fields: { TEXT: "EXCLUDED_FUNCTION" } }).previousConnection);
        const block = append(sourceWorkspace, container());
        block.getInput("BODY").connection.connect(callFunction(sourceWorkspace, first).previousConnection);
        await flushEvents();
        const sourceBefore = Blockly.serialization.workspaces.save(sourceWorkspace);
        const { code, blockText } = backpack.captureBackpackBlock(block);
        for (const text of ["first", "second", "amount", "first function body", "transitive function body"])
            assert(blockText.includes(text), text);
        assert(!blockText.includes("EXCLUDED_FUNCTION"));
        assert.deepStrictEqual(Blockly.serialization.workspaces.save(sourceWorkspace), sourceBefore);
        assert.equal(JSON.parse(code).blocks.length, 3);
        const existing = defineFunction(destination, "first", "first-id", args);
        existing.getInput("STACK").connection.connect(append(destination, statement).previousConnection);
        const existingCall = callFunction(destination, existing);
        await flushEvents();
        const before = JSON.stringify(Blockly.serialization.blocks.save(existing));
        const pasted = backpack.pasteBackpackBlock(code, destination);
        await flushEvents();
        const call = pasted.getInputTargetBlock("BODY");
        assert.equal(call.getName(), "first2");
        const definitions = destination.getTopBlocks(false).filter(b => b.type === "function_definition");
        assert.equal(definitions.length, 3);
        const importedFirst = definitions.find(b => b.getName() === "first2");
        const importedSecond = definitions.find(b => b.getName() === "second");
        assert.notEqual(importedFirst.getFunctionId(), existing.getFunctionId());
        assert.equal(call.getFunctionId(), importedFirst.getFunctionId());
        assert.notEqual(importedFirst.getArguments()[0].id, "arg-id");
        assert(importedFirst.getInput(importedFirst.getArguments()[0].id).connection.targetBlock());
        assert(call.getInput(importedFirst.getArguments()[0].id).connection.targetBlock());
        assert.equal(importedSecond.getInputTargetBlock("STACK").getName(), "first2");
        assert.equal(importedFirst.getInputTargetBlock("STACK").getName(), "second");
        assert.equal(existingCall.getName(), "first");
        assert.equal(JSON.stringify(Blockly.serialization.blocks.save(existing)), before);
        assert.equal(backpack.captureBackpackBlock(block).code, code);
        const definitionCode = backpack.captureBackpackBlock(first).code;
        assert.equal(JSON.parse(definitionCode).blocks.at(-1).extraState.name, "first");
    });

    it("retains supported native output calls and remaps their arguments", async () => {
        const args = [{ id: "value-id", name: "value", type: "number" }];
        const definition = defineFunction(sourceWorkspace, "result", "result-id", args);
        const block = append(sourceWorkspace, { ...container(), inputs: { VALUE: { block: {
            type: "function_call_output", extraState: definition.saveExtraState(),
            inputs: { "value-id": { block: { type: "math_number", fields: { NUM: 42 } } } }
        } } } });
        defineFunction(destination, "result", "result-id", args);
        await flushEvents();
        const pasted = backpack.pasteBackpackBlock(backpack.captureBackpackBlock(block).code, destination);
        await flushEvents();
        const call = pasted.getInputTargetBlock("VALUE");
        const imported = destination.getTopBlocks(false).find(b => b.type === "function_definition" && b.getName() === "result2");
        assert.equal(call.type, "function_call_output");
        assert.equal(call.getName(), "result2");
        assert.equal(call.getFunctionId(), imported.getFunctionId());
        assert.notEqual(call.getArguments()[0].id, "value-id");
        assert.equal(call.getArguments()[0].id, imported.getArguments()[0].id);
        assert.equal(call.getInputTargetBlock(call.getArguments()[0].id).getFieldValue("NUM"), 42);
    });

    it("rejects stock return procedures even when Blockly registers them", () => {
        for (const type of ["procedures_defreturn", "procedures_callreturn"]) {
            assert(Blockly.Blocks[type]);
            const state = { type, fields: { NAME: "unsupported" }, extraState: { name: "unsupported" } };
            assert.throws(() => backpack.pasteBackpackBlock(codeFor(state), destination), /invalid or unsupported/);
            assert.throws(() => backpack.pasteBackpackBlock(codeFor(container(state)), destination), /invalid or unsupported/);
        }
        assert.equal(destination.getAllBlocks(false).length, 0);
    });

    it("traverses shadow, overridden block, and nested next types; rejects unknown types before mutation", () => {
        const state = container({ ...statement, next: { block: { type: "unavailable_extension" } } });
        state.inputs.VALUE = { shadow: { type: "math_number" }, block: { type: "math_arithmetic" } };
        const code = codeFor(state);
        assert.deepStrictEqual(new Set(backpack.getBackpackBlockTypes(code)), new Set([
            "backpack_test_container", "backpack_test_statement", "unavailable_extension", "math_number", "math_arithmetic"
        ]));
        const old = append(destination, container());
        destination.clearUndo();
        assert.throws(() => backpack.pasteBackpackBlock(code, destination), /unavailable_extension.*extension/);
        assert.deepStrictEqual(destination.getAllBlocks(false), [old]);
        assert.equal(destination.getUndoStack().length, 0);
    });

    it("rejects malformed, oversized, excessive-depth/count, unsafe-key and missing-definition payloads", () => {
        const bad = ["null", "[]", "{}", "{", codeFor(), codeFor({}), codeFor({ type: 1 }),
            codeFor({ ...container(), extraState: [] }), codeFor({ ...container(), inputs: [] }),
            codeFor({ ...container(), next: { block: statement } }),
            codeFor({ ...container(), inputs: { BODY: { block: null } } }),
            codeFor({ ...container(), movable: "true" }), codeFor({ ...container(), x: "0" }),
            codeFor({ ...container(), extra: true }), codeFor({ ...container(), disabledReasons: [1] }),
            codeFor({ ...container(), data: "a".repeat(100000) }),
            '{"blocks":[{"type":"backpack_test_container","fields":{"__proto__":{}}}]}',
            '{"blocks":[{"type":"backpack_test_container","extraState":{"constructor":{}}}]}',
            codeFor(container({ type: "function_call", extraState: { name: "missing", functionid: "id", arguments: [] } }))
        ];
        let deep = container();
        for (let i = 0; i < 101; i++) deep = container(deep);
        bad.push(codeFor(deep));
        const wide = container();
        for (let i = 0; i < 500; i++) wide.inputs["I" + i] = { block: statement };
        bad.push(codeFor(wide));
        for (const code of bad) assert.throws(() => backpack.getBackpackBlockTypes(code), /invalid or unsupported/);
        assert.equal(destination.getAllBlocks(false).length, 0);
    });

    it("groups nested imports and function dependencies into one undo operation and restores an outer group", async () => {
        const definition = defineFunction(sourceWorkspace, "undoMe", "undo-id");
        definition.getInput("STACK").connection.connect(append(sourceWorkspace, statement).previousConnection);
        const block = append(sourceWorkspace, container());
        block.getInput("BODY").connection.connect(callFunction(sourceWorkspace, definition).previousConnection);
        await flushEvents();
        destination.clearUndo();
        Blockly.Events.setGroup("outer-group");
        const code = backpack.captureBackpackBlock(block).code;
        backpack.pasteBackpackBlock(code, destination);
        assert.equal(Blockly.Events.getGroup(), "outer-group");
        Blockly.Events.setGroup(false);
        await flushEvents();
        const count = destination.getAllBlocks(false).length;
        assert(count >= 4);
        assert(destination.getUndoStack().every(event => event.group === "outer-group"));
        destination.undo(false);
        assert.equal(destination.getAllBlocks(false).length, 0);
        destination.undo(true);
        assert.equal(destination.getAllBlocks(false).length, count);
    });
});

describe("Backpack native drag targets (current source, real browser Blockly)", function () {
    this.timeout(30000);
    let browser;
    let page;
    before(async () => { browser = await launchTestBrowser(); });
    after(async () => { if (browser) await browser.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        await page.setViewport({ width: 1000, height: 700 });
        await page.setContent(`<div id="workspace" style="position:absolute;left:0;top:0;width:700px;height:650px"></div>
            <button id="focus">Keep focus</button>
            <button id="project-tools-tab-backpack" style="position:absolute;left:800px;top:100px;width:60px;height:40px">Backpack</button>
            <button id="project-tools-launcher" style="position:absolute;left:800px;top:160px;width:60px;height:40px">More</button>
            <div id="project-tools-backpack" style="display:none;position:absolute;left:720px;top:220px;width:250px;height:250px">Backpack panel</div>`);
        const blocklyDirectory = path.dirname(require.resolve("blockly"));
        await page.addScriptTag({ path: path.join(blocklyDirectory, "blockly_compressed.js") });
        await page.addScriptTag({ path: path.join(blocklyDirectory, "blocks_compressed.js") });
        await page.addScriptTag({ path: path.join(blocklyDirectory, "msg/en.js") });
        await page.evaluate(({ constants, backpackSource, draggerSource }) => {
            window.lf = text => text;
            window.errors = [];
            window.pxt = { reportException: error => errors.push(String(error)), BrowserUtils: { addClass() {}, removeClass() {} } };
            const run = (code, dependencies) => {
                const exports = {};
                new Function("require", "exports", code)(id => dependencies[id], exports);
                return exports;
            };
            const functionConstants = run(constants, {});
            window.backpack = run(backpackSource, { blockly: Blockly, "./plugins/functions/constants": functionConstants });
            window.BlockDragger = run(draggerSource, { blockly: Blockly, "./backpack": backpack }).BlockDragger;
            Blockly.Blocks.backpack_test_container = {
                init() { this.appendStatementInput("BODY"); this.setPreviousStatement(true); this.setNextStatement(true); }
            };
            Blockly.Blocks.backpack_test_statement = {
                init() { this.setPreviousStatement(true); this.setNextStatement(true); }
            };
            window.workspace = Blockly.inject("workspace", { scrollbars: true, renderer: "zelos" });
            window.saved = [];
            window.opened = 0;
            window.enabled = true;
            window.disposeBackpack = backpack.registerBackpackWorkspace(workspace, {
                isEnabled: () => enabled,
                save: block => saved.push(backpack.captureBackpackBlock(block).code),
                open: () => { opened++; document.getElementById("project-tools-backpack").style.display = "block"; }
            });
            window.makeBlock = type => Blockly.serialization.blocks.append({ type }, workspace);
            window.pointer = (x, y) => new PointerEvent("pointermove", { clientX: x, clientY: y });
            window.start = block => {
                const dragger = new BlockDragger(block);
                dragger.onDragStart(pointer(100, 100));
                return dragger;
            };
            // Deterministic dwell clock; no real sleeps and no native dragger monkey-patches.
            const nativeSetTimeout = window.setTimeout;
            const nativeClearTimeout = window.clearTimeout;
            window.dwellTimers = new Map();
            let nextTimer = -1;
            window.setTimeout = (callback, delay, ...args) => {
                if (delay === 500) { const id = nextTimer--; dwellTimers.set(id, callback); return id; }
                return nativeSetTimeout(callback, delay, ...args);
            };
            window.clearTimeout = id => { if (!dwellTimers.delete(id)) nativeClearTimeout(id); };
            window.fireDwell = () => {
                const timers = Array.from(dwellTimers.values()); dwellTimers.clear(); timers.forEach(timer => timer());
            };
        }, { constants: source("pxtblocks/plugins/functions/constants.ts"), backpackSource: source("pxtblocks/backpack.ts"),
            draggerSource: source("pxtblocks/blockDragger.ts") });
    });
    afterEach(async () => {
        if (!page) return;
        await page.evaluate(() => {
            if (window.disposeBackpack) disposeBackpack();
            if (window.workspace?.dispose) workspace.dispose();
        });
        await page.close(); page = undefined;
    });

    it("captures labels inside collapsed containers and hidden inputs without expanding or changing them", async () => {
        const result = await page.evaluate(async () => {
            const block = Blockly.serialization.blocks.append({ type: "controls_repeat_ext", inputs: {
                TIMES: { block: { type: "math_number", fields: { NUM: 73 } } },
                DO: { block: { type: "text_print", inputs: { TEXT: { block: { type: "text",
                    fields: { TEXT: "hidden contained message" } } } } } }
            } }, workspace);
            await Blockly.renderManagement.finishQueuedRenders();
            const expanded = backpack.captureBackpackBlock(block);
            block.getInput("DO").setVisible(false);
            const hidden = backpack.captureBackpackBlock(block);
            block.setCollapsed(true);
            await Blockly.renderManagement.finishQueuedRenders();
            await new Promise(resolve => setTimeout(resolve, 0));
            workspace.clearUndo();
            const before = Blockly.serialization.workspaces.save(workspace);
            const captured = backpack.captureBackpackBlock(block);
            await new Promise(resolve => setTimeout(resolve, 0));
            return { expanded, hidden, captured, before, after: Blockly.serialization.workspaces.save(workspace),
                collapsed: block.isCollapsed(), visible: block.getInput("DO").isVisible(),
                undo: workspace.getUndoStack().length, errors };
        });
        for (const capture of [result.expanded, result.hidden, result.captured]) {
            for (const text of ["repeat", "print", "73", "hidden contained message"])
                assert(capture.blockText.includes(text), text);
        }
        assert(result.collapsed && !result.visible);
        assert.deepStrictEqual(result.after, result.before);
        assert.equal(result.undo, 0);
        assert.deepStrictEqual(result.errors, []);
    });

    it("uses native revertDrag to restore connections/location and never registers DELETE_AREA", async () => {
        const result = await page.evaluate(async () => {
            const parent = makeBlock("backpack_test_container");
            const block = makeBlock("backpack_test_container");
            const body = makeBlock("backpack_test_statement");
            const sibling = makeBlock("backpack_test_statement");
            parent.getInput("BODY").connection.connect(block.previousConnection);
            block.getInput("BODY").connection.connect(body.previousConnection);
            block.nextConnection.connect(sibling.previousConnection);
            await Blockly.renderManagement.finishQueuedRenders();
            const before = { ...block.getRelativeToSurfaceXY() };
            const dragger = start(block);
            dragger.onDrag(pointer(820, 120), new Blockly.utils.Coordinate(500, 0));
            const target = workspace.getDragTarget(new Blockly.utils.Coordinate(820, 120));
            const deletes = workspace.getComponentManager().hasCapability(target.id, Blockly.ComponentManager.Capability.DELETE_AREA);
            dragger.onDragEnd(pointer(820, 120));
            await Blockly.renderManagement.finishQueuedRenders();
            return { native: target instanceof Blockly.DragTarget, deletes, before, after: { ...block.getRelativeToSurfaceXY() },
                parent: block.getParent() === parent, body: block.getInputTargetBlock("BODY") === body,
                sibling: block.getNextBlock() === sibling, saved, pending: dwellTimers.size,
                hover: !!document.querySelector(".project-backpack--drag-over"), errors };
        });
        assert(result.native && !result.deletes);
        assert(result.parent && result.body && result.sibling);
        assert.deepStrictEqual(result.after, result.before);
        assert.equal(result.saved.length, 1);
        assert(!JSON.parse(result.saved[0]).blocks[0].next);
        assert.equal(result.pending, 0); assert(!result.hover); assert.deepStrictEqual(result.errors, []);
    });

    it("dwells without focus changes and refreshes moved panel bounds at drop time", async () => {
        const result = await page.evaluate(async () => {
            const block = makeBlock("backpack_test_container");
            const dragger = start(block);
            document.getElementById("focus").focus();
            dragger.onDrag(pointer(820, 120), new Blockly.utils.Coordinate(500, 0));
            fireDwell();
            await new Promise(requestAnimationFrame);
            const focus = document.activeElement.id;
            const panel = document.getElementById("project-tools-backpack");
            panel.style.top = "300px";
            // No intermediate pointer move: onDragEnd must refresh and resolve the actual panel.
            dragger.onDragEnd(pointer(800, 350));
            return { focus, opened, saved: saved.length, hover: panel.classList.contains("project-backpack--drag-over"), pending: dwellTimers.size };
        });
        assert.equal(result.focus, "focus"); assert.equal(result.opened, 1); assert.equal(result.saved, 1);
        assert(!result.hover); assert.equal(result.pending, 0);
    });

    it("cancels dwell on exit, native revert, Escape, pointercancel and disposal; scopes context menus", async () => {
        const result = await page.evaluate(() => {
            const block = makeBlock("backpack_test_container");
            const plain = makeBlock("backpack_test_statement");
            const menu = Blockly.ContextMenuRegistry.registry.getItem("pxtBackpackSave");
            const conditions = [menu.preconditionFn({ block }), menu.preconditionFn({ block: plain })];
            enabled = false; conditions.push(menu.preconditionFn({ block })); enabled = true;
            const foreign = new Blockly.Workspace();
            conditions.push(menu.preconditionFn({ block: foreign.newBlock("backpack_test_container") }));
            foreign.dispose();
            for (const cancel of ["exit", "revert", "escape", "pointercancel", "dispose"]) {
                const dragger = start(block);
                dragger.onDrag(pointer(820, 120), new Blockly.utils.Coordinate(500, 0));
                if (cancel === "exit") dragger.onDrag(pointer(500, 300), new Blockly.utils.Coordinate(100, 0));
                if (cancel === "revert") dragger.onDragRevert();
                if (cancel === "escape") document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
                if (cancel === "pointercancel") document.dispatchEvent(new PointerEvent("pointercancel"));
                if (cancel === "dispose") disposeBackpack();
                fireDwell();
                if (cancel !== "revert") dragger.onDragRevert();
                dragger.onDragEnd(undefined);
            }
            return { conditions, opened, saved: saved.length, pending: dwellTimers.size,
                hover: !!document.querySelector(".project-backpack--drag-over"), after: menu.preconditionFn({ block }),
                targets: workspace.getComponentManager().getComponents(Blockly.ComponentManager.Capability.DRAG_TARGET, false).length };
        });
        assert.deepStrictEqual(result.conditions, ["enabled", "disabled", "hidden", "hidden"]);
        assert.equal(result.opened, 0); assert.equal(result.saved, 0); assert.equal(result.pending, 0);
        assert(!result.hover); assert.equal(result.after, "hidden"); assert.equal(result.targets, 0);
    });

    it("uses the launcher only when the tab is invisible, and rejects foreign/non-container draggables", async () => {
        const result = await page.evaluate(() => {
            const manager = workspace.getComponentManager();
            const plain = makeBlock("backpack_test_statement");
            const dragger = start(plain);
            dragger.onDrag(pointer(820, 120), new Blockly.utils.Coordinate(500, 0));
            fireDwell();
            dragger.onDragEnd(pointer(820, 120));
            const visibleLauncher = !!workspace.getDragTarget(new Blockly.utils.Coordinate(820, 180));
            document.getElementById("project-tools-tab-backpack").style.display = "none";
            backpack.refreshBackpackDragTargets(workspace);
            const launcher = workspace.getDragTarget(new Blockly.utils.Coordinate(820, 180));
            const foreign = new Blockly.Workspace();
            const foreignBlock = foreign.newBlock("backpack_test_container");
            launcher.onDragEnter(foreignBlock); launcher.onDrop(foreignBlock);
            const preventsForeign = launcher.shouldPreventMove(foreignBlock);
            foreign.dispose();
            const block = makeBlock("backpack_test_container");
            const second = start(block);
            second.onDrag(pointer(820, 180), new Blockly.utils.Coordinate(500, 0));
            fireDwell();
            second.onDragEnd(pointer(820, 180));
            return { visibleLauncher, hasLauncher: !!launcher, preventsForeign, opened, saved: saved.length,
                targets: manager.getComponents(Blockly.ComponentManager.Capability.DRAG_TARGET, false).length };
        });
        assert(!result.visibleLauncher && result.hasLauncher && !result.preventsForeign);
        assert.equal(result.opened, 1); assert.equal(result.saved, 1); assert.equal(result.targets, 3);
    });
});