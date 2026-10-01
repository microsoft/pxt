"use strict";

const assert = require("assert");
const path = require("path");
const { launchTestBrowser } = require("./browser");
const { bundleSource } = require("./source");

describe("Backpack native clipboard serialization", function () {
    this.timeout(30000);
    let browser;
    let page;
    let bundle;
    let pageErrors;

    before(async () => {
        bundle = bundleSource([
            "pxtblocks/backpack.ts",
            "pxtblocks/clipboard.ts",
            "pxtblocks/plugins/functions/extensions.ts",
            "pxtblocks/plugins/functions/fields/fieldArgumentReporter.ts",
            "pxtblocks/plugins/functions/blocks/argumentReporterBlocks.ts",
            "pxtblocks/plugins/functions/blocks/functionDefinitionBlock.ts",
            "pxtblocks/plugins/functions/blocks/functionCallBlocks.ts"
        ], "backpack", {
            blockly: "window.Blockly",
            "pxtblocks/loader": "({ DRAGGABLE_PARAM_INPUT_PREFIX: 'HANDLER_DRAG_PARAM_' })",
            "pxtblocks/compiler/util": "({ isFunctionDefinition: block => block.type === 'function_definition' })",
            "pxtblocks/plugins/duplicateOnDrag": "({ setDuplicateOnDrag() {}, setDuplicateOnDragStrategy() {}, updateDuplicateOnDragState() {} })",
            "pxtblocks/utils": "({ maybeMoveFocusFromButton() {} })"
        });
        browser = await launchTestBrowser();
    });
    after(async () => { await browser?.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.setContent('<div id="source" style="width:600px;height:300px"></div><div id="destination" style="width:600px;height:300px"></div>');
        const directory = path.dirname(require.resolve("blockly"));
        for (const file of ["blockly_compressed.js", "blocks_compressed.js", "msg/en.js"]) {
            await page.addScriptTag({ path: path.join(directory, file) });
        }
        await page.evaluate(() => {
            window.lf = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, index) => args[index]);
            window.pxt = {
                reportException: error => { throw error; },
                warn: () => {},
                U: {
                    assert: value => { if (!value) throw new Error("Assertion failed"); },
                    userError: message => { throw Object.assign(new Error(message), { isUserError: true }); }
                }
            };
        });
        await page.addScriptTag({ content: bundle });
        await page.evaluate(() => {
            Blockly.Blocks.backpack_test_container = { init() {
                this.appendStatementInput("BODY");
                this.setPreviousStatement(true);
                this.setNextStatement(true);
            } };
            Blockly.Blocks.backpack_test_statement = { init() {
                this.setPreviousStatement(true);
                this.setNextStatement(true);
            } };
            window.sourceWorkspace = Blockly.inject("source", { scrollbars: true, sounds: false });
            window.destination = Blockly.inject("destination", { scrollbars: true, sounds: false });
            window.append = (workspace, state) => Blockly.serialization.blocks.append(state, workspace);
            window.container = body => ({ type: "backpack_test_container", inputs: body ? { BODY: { block: body } } : {} });
            window.statement = { type: "backpack_test_statement" };
            window.defineFunction = (workspace, name, id) => append(workspace, {
                type: "function_definition", extraState: { name, functionid: id, arguments: [] }
            });
            window.callFunction = (workspace, definition) => append(workspace, {
                type: "function_call", extraState: definition.saveExtraState()
            });
            window.flush = async () => {
                await Blockly.renderManagement.finishQueuedRenders();
                await new Promise(resolve => setTimeout(resolve, 0));
            };
        });
    });
    afterEach(async () => {
        try {
            await page.evaluate(async () => {
                await flush();
                sourceWorkspace.dispose();
                destination.dispose();
            });
            assert.deepStrictEqual(pageErrors, [], "No late clipboard focus or rendering errors");
        } finally { await page.close(); }
    });

    it("uses the native copy state and keeps nested bodies without following siblings", async () => {
        const result = await page.evaluate(async () => {
            const parent = append(sourceWorkspace, container(container({ ...statement, next: { block: statement } })));
            const block = parent.getInputTargetBlock("BODY");
            const sibling = append(sourceWorkspace, statement);
            block.nextConnection.connect(sibling.previousConnection);
            await flush();
            const before = JSON.stringify(Blockly.serialization.workspaces.save(sourceWorkspace));
            const payload = JSON.parse(backpack.captureBackpackBlock(block).code);
            const sameState = JSON.stringify(payload.blocks[0]) === JSON.stringify(block.toCopyData().blockState);
            const root = backpack.pasteBackpackBlock(JSON.stringify(payload), destination);
            await flush();
            return {
                version: payload.version, sameState, count: root.getDescendants(false).length,
                parent: !!root.getParent(), next: !!root.getNextBlock(),
                unchanged: before === JSON.stringify(Blockly.serialization.workspaces.save(sourceWorkspace))
            };
        });
        assert.deepStrictEqual(result, { version: 1, sameState: true, count: 3, parent: false, next: false, unchanged: true });
    });

    it("preserves mutations and resolves variables through the native clipboard paster", async () => {
        const result = await page.evaluate(async () => {
            const block = append(sourceWorkspace, {
                type: "controls_if", extraState: { elseIfCount: 1, else: true },
                inputs: {
                    DO0: { block: { type: "variables_set", fields: { VAR: { name: "score", type: "", id: "source-var" } } } },
                    DO1: { block: container() }
                }
            });
            const variable = destination.getVariableMap().createVariable("score", "", "destination-var");
            await flush();
            const pasted = backpack.pasteBackpackBlock(backpack.captureBackpackBlock(block).code, destination);
            await flush();
            return {
                mutation: pasted.saveExtraState(), expected: block.saveExtraState(),
                variable: pasted.getInputTargetBlock("DO0").getFieldValue("VAR"), expectedVariable: variable.getId(),
                nested: pasted.getInputTargetBlock("DO1").type
            };
        });
        assert.deepStrictEqual(result.mutation, result.expected);
        assert.equal(result.variable, result.expectedVariable);
        assert.equal(result.nested, "backpack_test_container");
    });

    it("remaps supporting functions without changing existing callers and groups native pastes into one undo", async () => {
        const result = await page.evaluate(async () => {
            const definition = defineFunction(sourceWorkspace, "routine", "routine-id");
            definition.getInput("STACK").connection.connect(append(sourceWorkspace, statement).previousConnection);
            const block = append(sourceWorkspace, container());
            block.getInput("BODY").connection.connect(callFunction(sourceWorkspace, definition).previousConnection);
            const existing = defineFunction(destination, "routine", "routine-id");
            const existingCall = callFunction(destination, existing);
            await flush();
            const before = JSON.stringify(Blockly.serialization.blocks.save(existing));
            destination.clearUndo();
            Blockly.Events.setGroup("outer-paste");
            const pasted = backpack.pasteBackpackBlock(backpack.captureBackpackBlock(block).code, destination);
            const restored = Blockly.Events.getGroup();
            Blockly.Events.setGroup(false);
            await flush();
            const call = pasted.getInputTargetBlock("BODY");
            const imported = destination.getTopBlocks(false).find(b => b.type === "function_definition" && b !== existing);
            const compatible = call.getFunctionId() === imported.getFunctionId()
                && call.getName() !== existing.getName() && imported.getFunctionId() !== existing.getFunctionId();
            const untouched = existingCall.getFunctionId() === existing.getFunctionId()
                && before === JSON.stringify(Blockly.serialization.blocks.save(existing));
            const groups = destination.getUndoStack().map(event => event.group);
            destination.undo(false);
            await flush();
            return { restored, compatible, untouched, groups, remaining: destination.getTopBlocks(false).length };
        });
        assert.equal(result.restored, "outer-paste");
        assert(result.compatible && result.untouched);
        assert(result.groups.length && result.groups.every(group => group === "outer-paste"));
        assert.equal(result.remaining, 2);
    });

    it("reads existing unversioned captures, rejects future versions and excludes legacy procedures", async () => {
        const result = await page.evaluate(() => {
            const code = JSON.stringify({ blocks: [container()] });
            const legacy = backpack.parseBackpackCode(code);
            const rejected = input => {
                try { backpack.parseBackpackCode(JSON.stringify(input)); return false; }
                catch (error) { return !!error.isUserError; }
            };
            return {
                version: legacy.version,
                future: rejected({ version: 2, blocks: [container()] }),
                invalidVersion: rejected({ version: "1", blocks: [container()] }),
                procedures: ["procedures_defnoreturn", "procedures_callnoreturn", "procedures_defreturn", "procedures_callreturn"]
                    .map(type => rejected({ version: 1, blocks: [{ type }] })),
                nested: rejected({ version: 1, blocks: [container({ type: "procedures_callnoreturn" })] })
            };
        });
        assert.deepStrictEqual(result, { version: 1, future: true, invalidVersion: true, procedures: [true, true, true, true], nested: true });
    });

    it("leaves new Blockly field/mutation properties to their registered loaders", async () => {
        const result = await page.evaluate(async () => {
            Blockly.Blocks.extension_container = {
                init() { this.appendStatementInput("BODY"); },
                saveExtraState() { return { extensionProperty: [1, 2, 3] }; },
                loadExtraState(value) { this.saved = value; }
            };
            const code = JSON.stringify({ version: 1, blocks: [{
                type: "extension_container", futureBlocklyProperty: true,
                extraState: { extensionProperty: [1, 2, 3] }
            }] });
            const parsed = backpack.parseBackpackCode(code);
            const root = backpack.pasteBackpackBlock(code, destination);
            await flush();
            return { property: parsed.blocks[0].futureBlocklyProperty, saved: root.saved };
        });
        assert.deepStrictEqual(result, { property: true, saved: { extensionProperty: [1, 2, 3] } });
    });

    it("rebuilds native capacity counts without counting obscured shadows", async () => {
        const result = await page.evaluate(async () => {
            const block = append(sourceWorkspace, {
                type: "controls_repeat_ext", inputs: { TIMES: {
                    shadow: { type: "math_number", fields: { NUM: 10 } },
                    block: { type: "math_number", fields: { NUM: 3 } }
                } }
            });
            await flush();
            const native = block.toCopyData();
            const restored = backpack.blockCopyData(native.blockState);
            destination.options.maxBlocks = 2;
            const pasted = backpack.pasteBackpackBlock(backpack.captureBackpackBlock(block).code, destination);
            await flush();
            const types = backpack.getBackpackBlockTypes(backpack.captureBackpackBlock(block).code);
            return { native: native.typeCounts, restored: restored.typeCounts, count: pasted.getDescendants(false).length, types };
        });
        assert.deepStrictEqual(result.restored, result.native);
        assert.equal(result.count, 2);
        assert(result.types.includes("math_number"));
    });

    it("reports capacity failures without leaving supporting definitions behind", async () => {
        const result = await page.evaluate(async () => {
            const definition = defineFunction(sourceWorkspace, "helper", "helper-id");
            const block = append(sourceWorkspace, container());
            block.getInput("BODY").connection.connect(callFunction(sourceWorkspace, definition).previousConnection);
            await flush();
            destination.options.maxBlocks = 1;
            let message;
            try { backpack.pasteBackpackBlock(backpack.captureBackpackBlock(block).code, destination); }
            catch (error) { message = error.message; }
            await flush();
            return { message, remaining: destination.getAllBlocks(false).length, group: Blockly.Events.getGroup() };
        });
        assert.match(result.message, /not enough room/);
        assert.equal(result.remaining, 0);
        assert.equal(result.group, "");
    });

    it("enforces the shared block-count and nesting-depth limits at their boundaries", async () => {
        const result = await page.evaluate(() => {
            const chain = count => {
                let state = { type: "backpack_test_statement" };
                for (let i = 1; i < count; i++) state = { type: "backpack_test_statement", next: { block: state } };
                return state;
            };
            const accepted = states => {
                try { backpack.visitBlockStates(states, () => {}); return true; }
                catch (error) { if (!error.isUserError) throw error; return false; }
            };
            return {
                maxCount: accepted(Array.from({ length: 500 }, () => ({ ...statement }))),
                excessiveCount: accepted(Array.from({ length: 501 }, () => ({ ...statement }))),
                maxDepth: accepted([chain(101)]),
                excessiveDepth: accepted([chain(102)])
            };
        });
        assert.deepStrictEqual(result, { maxCount: true, excessiveCount: false, maxDepth: true, excessiveDepth: false });
    });

    it("keeps loops eligible and asset shadows separate from their parents", async () => {
        const result = await page.evaluate(() => {
            const loop = append(sourceWorkspace, { type: "controls_repeat_ext" });
            Blockly.Blocks.asset_field_test = { init() {
                const field = new Blockly.FieldTextInput("pixels");
                field.isBackpackAsset = true;
                this.appendDummyInput().appendField(field, "ASSET");
                this.setOutput(true);
            } };
            const asset = append(sourceWorkspace, { type: "asset_field_test" });
            asset.setShadow(true);
            asset.setMovable(false);
            const acceptedShadow = backpack.isBackpackBlock(asset);
            asset.setEditable(false);
            return { loop: backpack.isBackpackBlock(loop), acceptedShadow, readOnly: backpack.isBackpackBlock(asset) };
        });
        assert.deepStrictEqual(result, { loop: true, acceptedShadow: true, readOnly: false });
    });

    it("rejects oversized data before pasting and rolls back failed native loads", async () => {
        const result = await page.evaluate(async () => {
            const existing = append(destination, container());
            await flush();
            const failed = [];
            for (const code of [
                JSON.stringify({ version: 1, blocks: [{ ...container(), data: "a".repeat(100000) }] }),
                JSON.stringify({ version: 1, blocks: [{ type: "broken_container", extraState: {} }] })
            ]) {
                Blockly.Blocks.broken_container = {
                    init() { this.appendStatementInput("BODY"); },
                    loadExtraState() { throw new Error("Native loader failure"); }
                };
                try { backpack.pasteBackpackBlock(code, destination); failed.push(false); }
                catch { failed.push(true); }
            }
            await flush();
            return { failed, unchanged: destination.getAllBlocks(false).length === 1 && !existing.isDisposed() };
        });
        assert.deepStrictEqual(result, { failed: [true, true], unchanged: true });
    });
});
