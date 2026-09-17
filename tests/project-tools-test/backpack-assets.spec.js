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
    for (const id of ["fields/field_utils", "fields/field_sprite", "fields/field_tilemap", "backpack"]) collect(id);
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
        await page.evaluate(modules => {
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
            window.makeSource = async () => {
                const assets = seed(2);
                const block = Blockly.serialization.blocks.append({ type: "backpack_real_assets", fields: {
                    IMAGE: pxt.getTSReferenceForAsset(assets.image), TILEMAP: pxt.getTSReferenceForAsset(assets.tilemap)
                } }, workspace);
                await settle();
                const { code } = backpack.captureBackpackBlock(block);
                const expected = { image: snapshot(block.getField("IMAGE").getAsset()), tilemap: snapshot(block.getField("TILEMAP").getAsset()) };
                // Dispose against the SOURCE asset project, then replace the whole global
                // project, not just the workspace. Retaining the source would hide data loss.
                workspace.clear();
                await settle();
                window.project = new pxt.TilemapProject();
                return { code, expected, ids: { image: assets.image.id, tilemap: assets.tilemap.id, tile: assets.tile.id } };
            };
            window.inspectPasted = async code => {
                const block = backpack.pasteBackpackBlock(code, workspace);
                await settle();
                const image = block.getField("IMAGE").getAsset();
                const tilemap = block.getField("TILEMAP").getAsset();
                return { image: snapshot(image), tilemap: snapshot(tilemap),
                    registered: !!project.lookupAsset("image", image.id)
                        && !!project.getTilemap(tilemap.id)
                        && tilemap.data.tileset.tiles.every(tile => !!project.resolveTile(tile.id)) };
            };
        }, fieldModules());
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
        assert.deepStrictEqual(result.pasted.image, result.source.expected.image);
        assert.deepStrictEqual(result.pasted.tilemap, result.source.expected.tilemap);
        assert(result.pasted.registered);
        assert.deepStrictEqual(result.errors, []);
    });
});