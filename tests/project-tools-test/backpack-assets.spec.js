"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchTestBrowser } = require("./browser");

const root = path.resolve(__dirname, "../..");

// Load the already-built real field implementations and their relative dependencies.
// Recompile pxtblocks before running this suite after source changes. No asset
// serializer, field lifecycle, or TilemapProject method is mocked; only the host's
// current-project accessor is supplied.
function fieldModules() {
    const modules = {};
    function collect(id) {
        if (modules[id]) return;
        const code = fs.readFileSync(path.join(root, "built/pxtblocks", id + ".js"), "utf8");
        modules[id] = code;
        for (const match of code.matchAll(/require\("([^"]+)"\)/g)) {
            if (match[1] === "blockly") continue;
            assert(match[1].startsWith("."), "Unexpected external field dependency: " + match[1]);
            collect(path.posix.normalize(path.posix.join(path.posix.dirname(id), match[1])));
        }
    }
    for (const id of ["fields/field_sprite", "fields/field_tilemap", "fields/field_procedure", "backpack"]) collect(id);
    return modules;
}

describe("Backpack real asset fields (full Blockly JSON, fresh destination project)", function () {
    this.timeout(30000);
    let browser;
    let page;
    before(async () => { browser = await launchTestBrowser(); });
    after(async () => { if (browser) await browser.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        await page.setContent('<div id="workspace" style="width:900px;height:650px"></div>');
        const blocklyDirectory = path.dirname(require.resolve("blockly"));
        for (const file of ["blockly_compressed.js", "blocks_compressed.js", "msg/en.js"]) {
            await page.addScriptTag({ path: path.join(blocklyDirectory, file) });
        }
        await page.addScriptTag({ path: path.join(root, "built/pxtlib.js") });
        await page.addScriptTag({ path: path.join(root, "built/pxtsim.js") });
        await page.evaluate(({ modules, functionsSource }) => {
            window.lf = pxt.Util.lf;
            window.errors = [];
            pxt.reportException = error => errors.push(String(error));
            pxt.appTarget = { id: "arcade", appTheme: {}, runtime: { palette: [
                "#000000", "#ffffff", "#ff2121", "#ff93c4", "#ff8135", "#fff609", "#249ca3", "#78dc52",
                "#003fad", "#87f2ff", "#8e2ec4", "#a4839f", "#5c406c", "#e5cdc4", "#91463d", "#000000"
            ] } };
            window.project = new pxt.TilemapProject();
            pxt.react = { getTilemapProject: () => project };
            const cache = {};
            window.load = id => {
                if (cache[id]) return cache[id].exports;
                const module = cache[id] = { exports: {} };
                const require = dependency => {
                    if (dependency === "blockly") return Blockly;
                    const parts = id.split("/").slice(0, -1);
                    for (const part of dependency.split("/")) {
                        if (part === "..") parts.pop();
                        else if (part !== ".") parts.push(part);
                    }
                    return load(parts.join("/"));
                };
                new Function("require", "module", "exports", modules[id])(require, module, module.exports);
                return module.exports;
            };
            window.backpack = load("backpack");
            // Enter through the utilities module, as the app does, so the fields'
            // CommonJS cycle does not evaluate a subclass before FieldAssetEditor.
            load("fields/field_utils");
            const { FieldSpriteEditor } = load("fields/field_sprite");
            const { FieldTilemap } = load("fields/field_tilemap");
            window.FieldBase = load("fields/field_base").FieldBase;
            Blockly.Blocks.backpack_real_assets = {
                init() {
                    this.appendStatementInput("BODY");
                    this.appendDummyInput().appendField(new FieldSpriteEditor("", {}), "IMAGE");
                    this.appendDummyInput().appendField(new FieldTilemap("", {}), "TILEMAP");
                }
            };
            window.workspace = Blockly.inject("workspace", { renderer: "zelos", scrollbars: true });
            window.settle = async () => {
                FieldBase.flushInitQueue();
                await Blockly.renderManagement.finishQueuedRenders();
                await new Promise(resolve => setTimeout(resolve, 0));
            };
            window.bitmap = (width, height, color) => {
                const bmp = new pxt.sprite.Bitmap(width, height);
                for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) bmp.set(x, y, (x + y + color) % 15 + 1);
                return bmp.data();
            };
            window.seed = color => {
                const image = project.createNewProjectImage(bitmap(8, 8, color), "backpackImage");
                const tile = project.createNewTile(bitmap(16, 16, color), "myTiles.tile1", "backpackTile");
                const data = project.blankTilemap(16, 3, 2);
                data.tileset.tiles.push(tile);
                data.tilemap.set(0, 0, 1);
                data.tilemap.set(2, 1, 1);
                const walls = pxt.sprite.Bitmap.fromData(data.layers);
                walls.set(2, 1, 2);
                data.layers = walls.data();
                const [id] = project.createNewTilemapFromData(data, "backpackLevel");
                return { image, tile, tilemap: project.getTilemap(id) };
            };
            // AssetType is a const enum, erased from the browser runtime.
            window.snapshot = asset => asset.type === "tilemap" ? {
                map: Array.from(asset.data.tilemap.data().data),
                width: asset.data.tilemap.width, height: asset.data.tilemap.height,
                walls: Array.from(asset.data.layers.data),
                tileWidth: asset.data.tileset.tileWidth,
                tiles: asset.data.tileset.tiles.map(tile => ({
                    width: tile.bitmap.width, height: tile.bitmap.height, pixels: Array.from(tile.bitmap.data)
                }))
            } : { width: asset.bitmap.width, height: asset.bitmap.height, pixels: Array.from(asset.bitmap.data) };
            window.makeSource = async changeMap => {
                const assets = seed(2);
                if (changeMap) {
                    changeMap(assets.tilemap.data);
                    project.updateTilemap(assets.tilemap.id, assets.tilemap.data);
                }
                const block = Blockly.serialization.blocks.append({ type: "backpack_real_assets", fields: {
                    IMAGE: pxt.getTSReferenceForAsset(assets.image), TILEMAP: pxt.getTSReferenceForAsset(assets.tilemap)
                } }, workspace);
                await settle();
                const { code, blockText } = backpack.captureBackpackBlock(block);
                const expected = { image: snapshot(block.getField("IMAGE").getAsset()), tilemap: snapshot(block.getField("TILEMAP").getAsset()) };
                // Dispose against the SOURCE asset project, then replace the whole global
                // project, not just the workspace. Retaining the source would hide data loss.
                workspace.clear();
                await settle();
                window.project = new pxt.TilemapProject();
                return { code, blockText, expected, ids: { image: assets.image.id, tilemap: assets.tilemap.id, tile: assets.tile.id } };
            };
            window.inspectPasted = async code => {
                const block = backpack.pasteBackpackBlock(code, workspace);
                await settle();
                const image = block.getField("IMAGE").getAsset();
                const tilemap = block.getField("TILEMAP").getAsset();
                return { image: snapshot(image), tilemap: snapshot(tilemap),
                    ids: { image: image.id, tilemap: tilemap.id },
                    tileIds: tilemap.data.tileset.tiles.map(tile => tile.id),
                    counts: ["image", "tilemap", "tile"].map(type => project.getAssets(type).length),
                    registered: !!project.lookupAsset("image", image.id)
                        && !!project.getTilemap(tilemap.id)
                        && tilemap.data.tileset.tiles.every(tile => !!project.resolveTile(tile.id)),
                    references: [block.getFieldValue("IMAGE"), block.getFieldValue("TILEMAP")],
                    expectedReferences: [pxt.getTSReferenceForAsset(image), pxt.getTSReferenceForAsset(tilemap)] };
            };
            // Execute production registration, not stock Blockly procedure blocks.
            // Stub only unrelated help decoration and function-editor configuration.
            const dependencies = {
                blockly: Blockly,
                "../help": { installBuiltinHelpInfo() {} },
                "../plugins/functions": { FunctionManager: { getInstance: () => ({ setIconForType() {}, setArgumentNameForType() {} }) } },
                "../fields": load("fields/field_procedure"),
                "../loader": {},
                "../importer": { domToWorkspaceNoEvents: (xml, ws) => Blockly.Xml.domToWorkspace(xml, ws) },
                "../fields/field_imagenotext": {},
                "../utils": {}
            };
            Blockly.Blocks.function_definition = { makeCallOption() {} };
            const exports = {};
            new Function("require", "exports", functionsSource)(id => dependencies[id], exports);
            exports.initFunctions();
            window.defineProcedure = (ws, name) => {
                const definition = ws.newBlock("procedures_defnoreturn");
                definition.setFieldValue(name, "NAME");
                return definition;
            };
            window.callProcedure = (ws, name) => {
                const call = ws.newBlock("procedures_callnoreturn");
                call.setFieldValue(name, "NAME");
                return call;
            };
        }, { modules: fieldModules(), functionsSource: fs.readFileSync(path.join(root, "built/pxtblocks/builtins/functions.js"), "utf8") });
    });
    afterEach(async () => {
        if (!page) return;
        await page.evaluate(async () => {
            if (window.workspace?.dispose) { await settle(); workspace.dispose(); }
        });
        await page.close();
        page = undefined;
    });

    it("restores named image pixels, tilemap cells/walls, and custom tile pixels with no source assets", async () => {
        const result = await page.evaluate(async () => {
            const source = await makeSource();
            const empty = !project.lookupAsset("image", source.ids.image)
                && !project.getTilemap(source.ids.tilemap) && !project.resolveTile(source.ids.tile);
            const pasted = await inspectPasted(source.code);
            return { source, empty, pasted, errors };
        });
        assert(result.empty);
        assert(result.source.blockText.includes("backpackImage"));
        assert(result.source.blockText.includes("backpackLevel"));
        const fields = JSON.parse(result.source.code).blocks[0].fields;
        for (const name of ["IMAGE", "TILEMAP"]) {
            assert.equal(fields[name].version, 1);
            assert(Object.values(fields[name].jres).some(entry => entry.data), name + " must carry JRES data, not just an id");
        }
        assert.deepStrictEqual(result.pasted.image, result.source.expected.image);
        assert.deepStrictEqual(result.pasted.tilemap, result.source.expected.tilemap);
        assert(result.pasted.registered);
        assert.deepStrictEqual(result.pasted.references, result.pasted.expectedReferences);
        assert.deepStrictEqual(result.errors, []);
    });

    it("remaps conflicting image/tilemap/tile ids, preserves destination assets, and deduplicates repeated paste", async () => {
        const result = await page.evaluate(async () => {
            const source = await makeSource();
            const existing = seed(8);
            const before = { image: snapshot(existing.image), tile: snapshot(existing.tile), tilemap: snapshot(existing.tilemap) };
            const collided = existing.image.id === source.ids.image && existing.tilemap.id === source.ids.tilemap && existing.tile.id === source.ids.tile;
            const first = await inspectPasted(source.code);
            const second = await inspectPasted(source.code);
            const after = { image: snapshot(project.lookupAsset("image", existing.image.id)),
                tile: snapshot(project.resolveTile(existing.tile.id)), tilemap: snapshot(project.getTilemap(existing.tilemap.id)) };
            return { source, collided, before, after, first, second, errors };
        });
        assert(result.collided, "The destination must actually reuse all three source ids");
        assert.deepStrictEqual(result.first.image, result.source.expected.image);
        assert.deepStrictEqual(result.first.tilemap, result.source.expected.tilemap);
        assert.notEqual(result.first.ids.image, result.source.ids.image);
        assert.notEqual(result.first.ids.tilemap, result.source.ids.tilemap);
        assert.deepStrictEqual(result.before, result.after);
        assert.deepStrictEqual(result.second.image, result.source.expected.image);
        assert.deepStrictEqual(result.second.tilemap, result.source.expected.tilemap);
        assert(result.first.registered && result.second.registered);
        assert.deepStrictEqual(result.first.references, result.first.expectedReferences);
        assert.deepStrictEqual(result.second.references, result.second.expectedReferences);
        assert.deepStrictEqual(result.errors, []);
        assert.deepStrictEqual(result.second.ids, result.first.ids, "Repeated paste must reuse the already-imported asset values");
        assert.deepStrictEqual(result.second.tileIds, result.first.tileIds);
        assert.deepStrictEqual(result.second.counts, result.first.counts, "Repeated paste must not create extra images, maps, or tiles");
    });

    for (const difference of ["cells", "walls", "dimensions"]) {
        it("does not deduplicate maps with identical tiles but different " + difference, async () => {
            const result = await page.evaluate(async difference => {
                const source = await makeSource(data => {
                    if (difference === "cells") data.tilemap.set(1, 0, 1);
                    if (difference === "walls") {
                        const walls = pxt.sprite.Bitmap.fromData(data.layers);
                        walls.set(1, 0, 2);
                        data.layers = walls.data();
                    }
                    if (difference === "dimensions") {
                        data.tilemap = new pxt.sprite.Tilemap(4, 2);
                        data.layers = new pxt.sprite.Bitmap(4, 2).data();
                    }
                });
                const existing = seed(2);
                const before = snapshot(existing.tilemap);
                const first = await inspectPasted(source.code);
                const second = await inspectPasted(source.code);
                return { source, before, after: snapshot(project.getTilemap(existing.tilemap.id)), first, second, errors };
            }, difference);
            assert.notEqual(result.first.ids.tilemap, result.source.ids.tilemap);
            assert.deepStrictEqual(result.first.tilemap, result.source.expected.tilemap);
            assert.deepStrictEqual(result.second.tilemap, result.source.expected.tilemap);
            assert.deepStrictEqual(result.before, result.after);
            assert.deepStrictEqual(result.first.ids, result.second.ids);
            assert.deepStrictEqual(result.first.counts, result.second.counts);
            assert.deepStrictEqual(result.errors, []);
        });
    }

    it("round-trips an inline temporary image through the real string-state fallback", async () => {
        const result = await page.evaluate(async () => {
            const source = await makeSource();
            const state = JSON.parse(source.code);
            const pixels = bitmap(5, 7, 4);
            state.blocks[0].fields.IMAGE = pxt.sprite.bitmapToImageLiteral(pxt.sprite.Bitmap.fromData(pixels), "typescript");
            // A temporary image must not inherit the named source image's block-data id.
            delete state.blocks[0].data;
            const block = backpack.pasteBackpackBlock(JSON.stringify(state), workspace);
            await settle();
            const code = backpack.captureBackpackBlock(block).code;
            const expected = snapshot(block.getField("IMAGE").getAsset());
            const temporary = block.getField("IMAGE").isTemporaryAsset();
            workspace.clear();
            await settle();
            window.project = new pxt.TilemapProject();
            const pasted = await inspectPasted(code);
            return { code, expected, pasted, temporary, errors };
        });
        assert(result.temporary);
        assert.equal(typeof JSON.parse(result.code).blocks[0].fields.IMAGE, "string");
        assert.deepStrictEqual(result.pasted.image, result.expected);
        assert.deepStrictEqual(result.errors, []);
    });

    it("round-trips registered PXT procedure XML, transitive recursion, and colliding names without changing existing callers", async () => {
        const result = await page.evaluate(async () => {
            const ws = new Blockly.Workspace();
            const destination = new Blockly.Workspace();
            try {
                const name = 'current & "Procedure"';
                const definition = defineProcedure(ws, name);
                const second = defineProcedure(ws, "secondProcedure");
                definition.getInput("STACK").connection.connect(callProcedure(ws, "secondProcedure").previousConnection);
                second.getInput("STACK").connection.connect(callProcedure(ws, name).previousConnection);
                const call = callProcedure(ws, name);
                const root = ws.newBlock("controls_repeat_ext");
                root.getInput("DO").connection.connect(call.previousConnection);
                const existing = defineProcedure(destination, name);
                existing.getInput("STACK").connection.connect(destination.newBlock("controls_repeat_ext").previousConnection);
                const existingCall = callProcedure(destination, name);
                destination.getVariableMap().createVariable(name + "2");
                await new Promise(resolve => setTimeout(resolve, 0));
                const state = Blockly.serialization.blocks.save(call, { doFullSerialization: true, saveIds: false });
                const code = backpack.captureBackpackBlock(root).code;
                const before = JSON.stringify(Blockly.serialization.blocks.save(existing));
                destination.clearUndo();
                let pasted;
                // Browser Blockly dispatches create events after queued rendering,
                // not necessarily on the next timeout. Wait for the actual root event.
                const recorded = new Promise(resolve => {
                    const listener = event => {
                        if (event.type === Blockly.Events.CREATE && event.ids?.includes(pasted?.id)) {
                            destination.removeChangeListener(listener);
                            resolve();
                        }
                    };
                    destination.addChangeListener(listener);
                });
                pasted = backpack.pasteBackpackBlock(code, destination);
                await recorded;
                const imported = destination.getTopBlocks(false).filter(block => block.type === "procedures_defnoreturn" && block !== existing);
                const names = imported.map(block => block.getFieldValue("NAME"));
                const bodies = imported.map(block => block.getInputTargetBlock("STACK").getProcedureCall());
                const pastedState = Blockly.serialization.blocks.save(pasted.getInputTargetBlock("DO"));
                const pastedName = pasted.getInputTargetBlock("DO").getProcedureCall();
                const reserialized = backpack.captureBackpackBlock(pasted).code;
                const definitionCode = backpack.captureBackpackBlock(definition).code;
                const after = JSON.stringify(Blockly.serialization.blocks.save(existing));
                const sourceUnchanged = backpack.captureBackpackBlock(root).code === code;
                const count = destination.getAllBlocks(false).length;
                destination.undo(false);
                await new Promise(resolve => setTimeout(resolve, 0));
                const undoCount = destination.getAllBlocks(false).length;
                destination.undo(true);
                await new Promise(resolve => setTimeout(resolve, 0));
                return { name, state, code, names, bodies, pastedState, pastedName, reserialized, definitionCode,
                    before, after, sourceUnchanged, existingName: existingCall.getProcedureCall(),
                    count, undoCount, redoCount: destination.getAllBlocks(false).length,
                    jsonHook: typeof call.saveExtraState, xmlHook: typeof call.mutationToDom, errors };
            }
            finally { ws.dispose(); destination.dispose(); }
        });
        assert.equal(result.xmlHook, "function");
        assert.equal(result.jsonHook, "undefined");
        assert.equal(typeof result.state.extraState, "string", "Blockly falls back to XML mutation text for this real PXT block");
        assert.equal(result.state.fields.NAME, result.name);
        assert.equal(JSON.parse(result.code).blocks.length, 3);
        assert.deepStrictEqual(result.names, [result.name + "3", "secondProcedure"]);
        assert.deepStrictEqual(result.bodies, ["secondProcedure", result.name + "3"]);
        assert.equal(result.pastedName, result.name + "3");
        assert.equal(result.pastedState.fields.NAME, result.name + "3");
        assert(result.pastedState.extraState.includes('&amp; &quot;Procedure&quot;3'));
        assert.equal(JSON.parse(result.reserialized).blocks.length, 3);
        const definitions = JSON.parse(result.definitionCode).blocks;
        assert.equal(definitions.length, 2);
        assert.equal(definitions.at(-1).fields.NAME, result.name);
        assert.equal(result.before, result.after);
        assert.equal(result.existingName, result.name);
        assert(result.sourceUnchanged);
        assert.equal(result.undoCount, 3, "One undo removes only the imported procedure graph");
        assert.equal(result.redoCount, result.count);
        assert.deepStrictEqual(result.errors, []);
    });

    it("rejects invalid PXT procedure mutations and missing bodies before loading any blocks", async () => {
        const result = await page.evaluate(async () => {
            const ws = new Blockly.Workspace();
            try {
                defineProcedure(ws, "procedure");
                const root = ws.newBlock("controls_repeat_ext");
                root.getInput("DO").connection.connect(callProcedure(ws, "procedure").previousConnection);
                await new Promise(resolve => setTimeout(resolve, 0));
                const code = backpack.captureBackpackBlock(root).code;
                const mutations = [null, { name: "procedure" }, "<mutation", '<block name="procedure"/>',
                    "<mutation/>", '<mutation name="prototype"/>', '<mutation name="different"/>',
                    '<mutation name="procedure"><arg name="unsupported"/></mutation>'];
                const payloads = mutations.map(extraState => {
                    const payload = JSON.parse(code);
                    payload.blocks.at(-1).inputs.DO.block.extraState = extraState;
                    return payload;
                });
                const missing = JSON.parse(code);
                missing.blocks.shift();
                payloads.push(missing);
                const mismatchedField = JSON.parse(code);
                mismatchedField.blocks.at(-1).inputs.DO.block.fields.NAME = "different";
                payloads.push(mismatchedField);
                const rejected = payloads.map(payload => {
                    try { backpack.pasteBackpackBlock(JSON.stringify(payload), workspace); return false; }
                    catch (error) { return /invalid or unsupported/.test(String(error)); }
                });
                await settle();
                return { rejected, count: workspace.getAllBlocks(false).length, undo: workspace.getUndoStack().length, errors };
            }
            finally { ws.dispose(); }
        });
        assert(result.rejected.every(Boolean));
        assert.equal(result.rejected.length, 10);
        assert.equal(result.count, 0);
        assert.equal(result.undo, 0);
        assert.deepStrictEqual(result.errors, []);
    });
});