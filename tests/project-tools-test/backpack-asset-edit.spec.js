"use strict";
/* global pxt, Blockly, project, Editor, editors, bitmap, fieldState, codeFor */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { launchTestBrowser } = require("./browser");
const root = path.resolve(__dirname, "../..");

// Current scratch helper, already-built native fields and asset runtime; no field parsers mocked.
function sources() {
    const modules = {};
    function collect(id) {
        if (modules[id]) return;
        const code = modules[id] = fs.readFileSync(path.join(root, "built/pxtblocks", id + ".js"), "utf8");
        for (const [, dependency] of code.matchAll(/require\("([^"]+)"\)/g)) {
            if (dependency === "blockly") continue;
            assert(dependency.startsWith("."), dependency);
            collect(path.posix.normalize(path.posix.join(path.posix.dirname(id), dependency)));
        }
    }
    for (const id of ["fields/field_utils", "fields/field_sprite",
        "fields/field_tilemap", "fields/field_tileset", "backpack"]) collect(id);
    modules.backpack = ts.transpileModule(fs.readFileSync(path.join(root, "pxtblocks/backpack.ts"), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
    }).outputText;
    return { modules, helper: ts.transpileModule(fs.readFileSync(path.join(root, "webapp/src/backpackAssetEditor.ts"), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
    }).outputText };
}

describe("Backpack scratch native asset editing", function () {
    this.timeout(30000);
    let browser, page;
    before(async () => { browser = await launchTestBrowser(); });
    after(async () => { if (browser) await browser.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        const blocklyDirectory = path.dirname(require.resolve("blockly"));
        for (const file of ["blockly_compressed.js", "blocks_compressed.js", "msg/en.js"]) {
            await page.addScriptTag({ path: path.join(blocklyDirectory, file) });
        }
        for (const file of ["pxtlib.js", "pxtsim.js"]) await page.addScriptTag({ path: path.join(root, "built", file) });
        await page.evaluate(({ modules, helper }) => {
            window.lf = pxt.Util.lf;
            pxt.AssetType = { Image: "image", Tile: "tile", Tilemap: "tilemap", Animation: "animation", Song: "song" };
            pxt.appTarget = { id: "arcade", appTheme: {}, runtime: { palette: [
                "#000000", "#ffffff", "#ff2121", "#ff93c4", "#ff8135", "#fff609", "#249ca3", "#78dc52",
                "#003fad", "#87f2ff", "#8e2ec4", "#a4839f", "#5c406c", "#e5cdc4", "#91463d", "#000000"
            ] } };
            const cache = {};
            const load = id => {
                if (cache[id]) return cache[id].exports;
                const module = cache[id] = { exports: {} };
                new Function("require", "module", "exports", modules[id])(dependency => {
                    if (dependency === "blockly") return Blockly;
                    const parts = id.split("/").slice(0, -1);
                    for (const part of dependency.split("/")) {
                        if (part === "..") parts.pop(); else if (part !== ".") parts.push(part);
                    }
                    return load(parts.join("/"));
                }, module, module.exports);
                return module.exports;
            };
            const fields = Object.assign({}, ...Object.keys(modules).filter(id => id.startsWith("fields/")).map(load));
            const backpack = load("backpack");
            // Real native fields in minimal, headless asset blocks.
            for (const [type, Field] of [["extension_portrait", fields.FieldSpriteEditor],
                ["tiles_tilemap_editor", fields.FieldTilemap], ["tileset_tile_picker", fields.FieldTileset]]) {
                Blockly.Blocks[type] = { init() {
                    this.appendDummyInput().appendField(new Field("", {}), "ASSET");
                    this.setOutput(true);
                } };
            }
            const module = { exports: {} };
            new Function("require", "module", "exports", helper)(id => id === "blockly" ? Blockly
                : id === "../../pxtblocks" ? { ...fields, ...backpack }
                : (() => { throw new Error(`Unexpected helper dependency: ${id}`); })(), module, module.exports);
            window.project = new pxt.TilemapProject();
            pxt.react = { getTilemapProject: () => project };
            window.Editor = module.exports.BackpackAssetEditor;
            window.editors = [];
            window.open = (code, gallery = project.saveGallerySnapshot()) => {
                const editor = new Editor(new pxt.TilemapProject());
                editors.push(editor);
                const getter = pxt.react.getTilemapProject, enabled = Blockly.Events.isEnabled();
                const asset = editor.open({ code, gallery });
                if (asset?.then || pxt.react.getTilemapProject !== getter || Blockly.Events.isEnabled() !== enabled) {
                    throw new Error("Open must return synchronously without leaking project/event globals");
                }
                return { editor, asset };
            };
            window.fieldState = fields.getAssetSaveState;
            window.codeFor = (type, value) => JSON.stringify({ blocks: [{ type, fields: { ASSET: value } }] });
            window.bitmap = () => new pxt.sprite.Bitmap(16, 16).data();
        }, sources());
    });
    afterEach(async () => {
        if (!page) return;
        await page.evaluate(() => { for (const editor of editors) editor.dispose(); });
        await page.close();
    });

    it("edits in isolation and restores the live project and event state on save, failure and disposal", async () => {
        const result = await page.evaluate(() => {
            project.createNewProjectImage(bitmap(), "liveImage");
            const before = JSON.stringify(project);
            const getter = pxt.react.getTilemapProject;
            // Preserve an existing disable scope, rather than unconditionally enabling events.
            Blockly.Events.disable();
            try {
                const { editor, asset } = open(codeFor("extension_portrait", "img`2`"));
                asset.bitmap.data[0] = 3;
                asset.jresData = pxt.sprite.base64EncodeBitmap(asset.bitmap);
                const saved = editor.save(asset);
                const restoredAfterSave = pxt.react.getTilemapProject === getter && !Blockly.Events.isEnabled();
                editor.dispose();
                editors.pop();
                const reopened = open(saved.code);
                const pixel = reopened.asset.bitmap.data[0];
                reopened.editor.dispose();
                editors.pop();
                let rejected = false;
                try { open(codeFor("controls_repeat_ext", "")); }
                catch { rejected = true; }
                return {
                    pixel, rejected, restoredAfterSave,
                    unchanged: JSON.stringify(project) === before,
                    restored: pxt.react.getTilemapProject === getter && !Blockly.Events.isEnabled(),
                    workspaces: Blockly.Workspace.getAll().length
                };
            } finally {
                Blockly.Events.enable();
            }
        });
        assert.equal(result.pixel, 3);
        assert(result.rejected && result.restoredAfterSave && result.restored && result.unchanged);
        assert.equal(result.workspaces, 0);
    });

    it("opens a named tile whose pixels match a gallery tile without losing its identity", async () => {
        const result = await page.evaluate(() => {
            const tile = project.createNewTile(bitmap(), undefined, "savedTile");
            const code = codeFor("tileset_tile_picker", fieldState(tile));
            const galleryProject = new pxt.TilemapProject();
            galleryProject.createNewTile(bitmap(), "gallery.samePixels", "galleryTile");
            window.project = new pxt.TilemapProject();
            project.loadTilemapJRes(galleryProject.getProjectTilesetJRes(), false, true);
            const { editor, asset } = open(code);
            const saved = editor.save(asset);
            const reopened = open(saved.code);
            return { id: asset.id, expectedId: tile.id, name: asset.meta.displayName,
                reopenedId: reopened.asset.id, liveTiles: project.getAssets(pxt.AssetType.Tile).length };
        });
        assert.equal(result.id, result.expectedId);
        assert.equal(result.reopenedId, result.expectedId);
        assert.equal(result.name, "savedTile");
        assert.equal(result.liveTiles, 0);
    });

    it("rehydrates transported gallery collections and makes an edited gallery tile portable", async () => {
        const result = await page.evaluate(() => {
            project.createNewTile(bitmap(), "myTiles.galleryTile", "galleryTile");
            const jres = project.getProjectTilesetJRes();
            window.project = new pxt.TilemapProject();
            project.loadTilemapJRes(jres, false, true);
            const { editor, asset } = open(codeFor("tileset_tile_picker", "myTiles.galleryTile"));
            asset.bitmap.data[0] = 0x33;
            asset.jresData = pxt.sprite.base64EncodeBitmap(asset.bitmap);
            asset.isProjectTile = true; // Native ImageEditor.getTile always sets this, even for gallery edits.
            const captured = editor.save(asset);
            editor.dispose();
            editors.pop();
            window.project = new pxt.TilemapProject();
            const reopened = open(captured.code);
            return { pixel: reopened.asset.bitmap.data[0], projectTile: reopened.asset.isProjectTile,
                state: JSON.parse(captured.code).blocks[0].fields.ASSET };
        });
        assert.equal(result.pixel, 0x33);
        assert(result.projectTile);
        assert.equal(result.state.assetType, "tile");
    });

    it("round-trips edited tilemap cells, walls and custom tile pixels without source assets", async () => {
        const result = await page.evaluate(() => {
            const pixels = bitmap();
            pixels.data.fill(0x22);
            const data = project.blankTilemap(16, 2, 2);
            data.tileset.tiles.push(project.createNewTile(pixels, undefined, "savedTile"));
            const [id] = project.createNewTilemapFromData(data, "savedMap");
            const code = codeFor("tiles_tilemap_editor", fieldState(project.getTilemap(id)));
            window.project = new pxt.TilemapProject();
            const { editor, asset } = open(code);
            asset.data.tilemap.set(1, 1, 1);
            const walls = pxt.sprite.Bitmap.fromData(asset.data.layers);
            walls.set(1, 1, 2);
            asset.data.layers = walls.data();
            const saved = editor.save(asset);
            editor.dispose();
            editors.pop();
            window.project = new pxt.TilemapProject();
            const reopened = open(saved.code).asset.data;
            const tile = reopened.tileset.tiles[reopened.tilemap.get(1, 1)];
            return {
                cell: reopened.tilemap.get(1, 1),
                wall: pxt.sprite.Bitmap.fromData(reopened.layers).get(1, 1),
                pixels: Array.from(tile.bitmap.data),
                expected: Array.from(pixels.data)
            };
        });
        assert.equal(result.cell, 1);
        assert.equal(result.wall, 2);
        assert.deepStrictEqual(result.pixels, result.expected);
    });
});