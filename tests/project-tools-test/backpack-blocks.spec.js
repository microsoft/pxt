"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const Blockly = require("blockly");
require("blockly/blocks");

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
        this.setPreviousStatement(true);
        this.setNextStatement(true);
    }
};
Blockly.Blocks.backpack_test_statement = {
    init() { this.setPreviousStatement(true); this.setNextStatement(true); }
};

const append = (workspace, state) => Blockly.serialization.blocks.append(state, workspace);
const container = body => ({ type: "backpack_test_container", inputs: body ? { BODY: { block: body } } : {} });
const statement = { type: "backpack_test_statement" };
const codeFor = (...blocks) => JSON.stringify({ blocks });
const flushEvents = () => new Promise(resolve => setTimeout(resolve, 0));

function defineFunction(workspace, name, id) {
    return append(workspace, { type: "function_definition", extraState: { name, functionid: id, arguments: [] } });
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

    it("preserves if mutations and resolves variables in the destination", () => {
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
    });

    it("captures a nested root and its body without ancestors, following siblings or source mutation", () => {
        const parent = append(sourceWorkspace, container(container({
            ...statement, next: { block: statement }
        })));
        const block = parent.getInputTargetBlock("BODY");
        const sibling = append(sourceWorkspace, statement);
        block.nextConnection.connect(sibling.previousConnection);
        const before = Blockly.serialization.workspaces.save(sourceWorkspace);
        const captured = backpack.captureBackpackBlock(block);
        const pasted = backpack.pasteBackpackBlock(captured.code, destination);
        assert.equal(pasted.getDescendants(false).length, 3);
        assert(!pasted.getParent() && !pasted.getNextBlock());
        assert(pasted.getInputTargetBlock("BODY").getNextBlock());
        assert.deepStrictEqual(Blockly.serialization.workspaces.save(sourceWorkspace), before);
        assert.strictEqual(parent.getInputTargetBlock("BODY"), block);
        assert.strictEqual(block.getNextBlock(), sibling);
    });

    it("imports a supporting native function without changing a colliding destination function or caller", async () => {
        const definition = defineFunction(sourceWorkspace, "routine", "routine-id");
        definition.getInput("STACK").connection.connect(append(sourceWorkspace, statement).previousConnection);
        const block = append(sourceWorkspace, container());
        block.getInput("BODY").connection.connect(callFunction(sourceWorkspace, definition).previousConnection);
        const existing = defineFunction(destination, "routine", "routine-id");
        const existingCall = callFunction(destination, existing);
        await flushEvents();
        const before = Blockly.serialization.blocks.save(existing);
        const pasted = backpack.pasteBackpackBlock(backpack.captureBackpackBlock(block).code, destination);
        await flushEvents();
        const call = pasted.getInputTargetBlock("BODY");
        const imported = destination.getTopBlocks(false).find(b => b.type === "function_definition" && b !== existing);
        assert(imported);
        assert.notEqual(imported.getFunctionId(), existing.getFunctionId());
        assert.notEqual(call.getName(), existing.getName());
        assert.equal(call.getFunctionId(), imported.getFunctionId());
        assert.equal(imported.getInputTargetBlock("STACK").type, statement.type);
        assert.equal(existingCall.getFunctionId(), existing.getFunctionId());
        assert.deepStrictEqual(Blockly.serialization.blocks.save(existing), before);
    });

    it("rejects oversized input without changing the destination", () => {
        const existing = append(destination, container());
        const oversized = codeFor({ ...container(), data: "a".repeat(100000) });
        assert.throws(() => backpack.pasteBackpackBlock(oversized, destination), /too large/);
        assert.deepStrictEqual(destination.getAllBlocks(false), [existing]);
    });

    it("groups nested imports and function dependencies into one undo operation and restores an outer group", async () => {
        const definition = defineFunction(sourceWorkspace, "undoMe", "undo-id");
        definition.getInput("STACK").connection.connect(append(sourceWorkspace, statement).previousConnection);
        const block = append(sourceWorkspace, container());
        block.getInput("BODY").connection.connect(callFunction(sourceWorkspace, definition).previousConnection);
        await flushEvents();
        destination.clearUndo();
        Blockly.Events.setGroup("outer-group");
        try {
            const code = backpack.captureBackpackBlock(block).code;
            backpack.pasteBackpackBlock(code, destination);
            assert.equal(Blockly.Events.getGroup(), "outer-group");
        } finally {
            Blockly.Events.setGroup(false);
        }
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
