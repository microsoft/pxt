"use strict";
/* global pxt, Blockly, project, Editor, editors, bitmap, fieldState, codeFor */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { launchTestBrowser } = require("./browser");
const root = path.resolve(__dirname, "../..");

// Current iframe helper, already-built native fields and asset runtime; no field parsers mocked.
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
    for (const id of ["fields/field_utils", "fields/field_sprite", "fields/field_animation",
        "fields/field_musiceditor", "fields/field_tilemap", "fields/field_tileset",
        "fields/field_melodySandbox", "fields/field_gridpicker", "backpack"]) collect(id);
    modules.backpack = ts.transpileModule(fs.readFileSync(path.join(root, "pxtblocks/backpack.ts"), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
    }).outputText;
    return { modules, helper: ts.transpileModule(fs.readFileSync(path.join(root, "webapp/src/backpackAssetEditor.ts"), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
    }).outputText };
}

describe("Backpack iframe native asset editing", function () {
    this.timeout(30000);
    let browser, page;
    before(async () => { browser = await launchTestBrowser(); });
    after(async () => { if (browser) await browser.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        await page.setContent("<div></div>");
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
            pxt.auth.isBackpackAssetType = type => ["image_picker", "animation_editor", "music_song_field_editor",
                "tiles_tilemap_editor", "tileset_tile_picker", "melody_editor", "music_sounds"].includes(type);
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
            // Target-independent harness: real fields, minimal block definitions and stock renderer.
            Blockly.registry.register(Blockly.registry.Type.RENDERER, "pxt", Blockly.zelos.Renderer);
            const initializeAndInject = () => {
                for (const [type, Field] of [["image_picker", fields.FieldSpriteEditor],
                    ["animation_editor", fields.FieldAnimationEditor], ["music_song_field_editor", fields.FieldMusicEditor],
                    ["tiles_tilemap_editor", fields.FieldTilemap], ["tileset_tile_picker", fields.FieldTileset],
                    ["melody_editor", fields.FieldCustomMelody], ["music_sounds", fields.FieldGridPicker]]) {
                    Blockly.Blocks[type] = { init() {
                        const options = type === "music_sounds" ? { colour: "#ffffff", data: [["one", "one"], ["two", "two"]] } : {};
                        this.appendDummyInput().appendField(new Field("", options), "ASSET");
                        this.setOutput(true);
                    } };
                }
            };
            const module = { exports: {} };
            new Function("require", "module", "exports", helper)(id => id === "blockly" ? Blockly
                : id === "../../pxtblocks" ? { ...fields, ...backpack, initializeAndInject }
                : { dismissIfVisible() {}, setEditorBounds() {} }, module, module.exports);
            window.project = new pxt.TilemapProject();
            pxt.react = { getTilemapProject: () => project };
            window.Editor = module.exports.BackpackAssetEditor;
            window.editors = [];
            window.open = async (code, gallery = project.saveGallerySnapshot()) => {
                const editor = new Editor(project);
                editors.push(editor);
                const asset = await editor.open({ code, gallery: structuredClone(gallery), blocksInfo: {} });
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

    it("starts the standalone editor bundle without importing the full app", async () => {
        const standalone = await browser.newPage();
        const errors = [];
        standalone.on("pageerror", error => errors.push(error.message));
        try {
            await standalone.setContent('<div id="asset-editor-field-div"></div>');
            await standalone.addScriptTag({ path: path.join(root, "built/pxtlib.js") });
            await standalone.evaluate(() => {
                pxt.appTarget = { id: "arcade", appTheme: {}, runtime: {} };
                window.lf = pxt.Util.lf;
            });
            await standalone.addScriptTag({ path: path.join(root, "built/web/pxtasseteditor.js") });
            await standalone.evaluate(() => document.dispatchEvent(new Event("DOMContentLoaded")));
            assert.deepStrictEqual(errors, []);
            assert(await standalone.evaluate(() => typeof pxt.react.getTilemapProject === "function"));
        } finally { await standalone.close(); }
    });

    it("preserves inline versus named fields, saves pixels, and disposes prior scratch workspaces", async () => {
        const result = await page.evaluate(async () => {
            const outputs = [];
            for (const named of [false, true]) {
                const image = project.createNewProjectImage(bitmap(), "savedImage");
                const value = named ? fieldState(image) : pxt.sprite.bitmapToImageLiteral(pxt.sprite.Bitmap.fromData(image.bitmap), "typescript");
                const code = codeFor("image_picker", value);
                window.project = new pxt.TilemapProject();
                const { editor, asset } = await open(code);
                asset.bitmap.data[0] = 0x22;
                asset.jresData = pxt.sprite.base64EncodeBitmap(asset.bitmap); // Native ImageEditor.getAsset result.
                const captured = editor.save(asset);
                if (JSON.parse(captured.code).blocks[0].deletable === false) throw new Error("Saved asset inherited scratch-only restrictions");
                editor.dispose(); editors.pop();
                window.project = new pxt.TilemapProject();
                const reopened = await open(captured.code);
                outputs.push({ pixel: reopened.asset.bitmap.data[0], fieldType: typeof JSON.parse(captured.code).blocks[0].fields.ASSET,
                    text: captured.blockText, workspaces: document.querySelectorAll(".blocklySvg").length });
                reopened.editor.dispose(); editors.pop();
            }
            return outputs;
        });
        assert.deepStrictEqual(result.map(r => r.pixel), [0x22, 0x22]);
        assert.deepStrictEqual(result.map(r => r.fieldType), ["string", "object"]);
        assert(result[1].text.includes("savedImage"));
        assert(result.every(r => r.workspaces === 1));
    });

    it("rehydrates transported gallery collections and makes an edited gallery tile portable", async () => {
        const result = await page.evaluate(async () => {
            project.createNewTile(bitmap(), "myTiles.galleryTile", "galleryTile");
            const jres = project.getProjectTilesetJRes();
            window.project = new pxt.TilemapProject();
            project.loadTilemapJRes(jres, false, true);
            const { editor, asset } = await open(codeFor("tileset_tile_picker", "myTiles.galleryTile"));
            asset.bitmap.data[0] = 0x33;
            asset.jresData = pxt.sprite.base64EncodeBitmap(asset.bitmap);
            asset.isProjectTile = true; // Native ImageEditor.getTile always sets this, even for gallery edits.
            const captured = editor.save(asset);
            editor.dispose(); editors.pop();
            window.project = new pxt.TilemapProject();
            const reopened = await open(captured.code);
            return { pixel: reopened.asset.bitmap.data[0], projectTile: reopened.asset.isProjectTile,
                state: JSON.parse(captured.code).blocks[0].fields.ASSET };
        });
        assert.equal(result.pixel, 0x33);
        assert(result.projectTile);
        assert.equal(result.state.assetType, "tile");
        assert.equal(result.state.version, 1);
    });

    it("round-trips native animation, song and tilemap save states after editing", async () => {
        const result = await page.evaluate(async () => {
            const outputs = [];
            for (const type of ["animation", "song", "tilemap"]) {
                window.project = new pxt.TilemapProject();
                let asset, blockType;
                if (type === "animation") {
                    asset = project.createNewAnimationFromData([bitmap()], 200, "savedAnimation");
                    blockType = "animation_editor";
                }
                else if (type === "song") {
                    asset = project.createNewSong(pxt.assets.music.getEmptySong(2), "savedSong");
                    blockType = "music_song_field_editor";
                }
                else {
                    const data = project.blankTilemap(16, 2, 2);
                    data.tileset.tiles.push(project.createNewTile(bitmap(), undefined, "savedTile"));
                    const [id] = project.createNewTilemapFromData(data, "savedMap");
                    asset = project.getTilemap(id);
                    blockType = "tiles_tilemap_editor";
                }
                const code = codeFor(blockType, fieldState(asset));
                window.project = new pxt.TilemapProject();
                const opened = await open(code);
                if (type === "animation") opened.asset.frames[0].data[0] = 0x44;
                else if (type === "song") opened.asset.song.beatsPerMinute = 173;
                else opened.asset.data.tilemap.set(1, 1, 1);
                const captured = opened.editor.save(opened.asset);
                opened.editor.dispose(); editors.pop();
                window.project = new pxt.TilemapProject();
                const reopened = await open(captured.code);
                outputs.push(type === "animation" ? reopened.asset.frames[0].data[0]
                    : type === "song" ? reopened.asset.song.beatsPerMinute : reopened.asset.data.tilemap.get(1, 1));
                reopened.editor.dispose(); editors.pop();
            }
            return outputs;
        });
        assert.deepStrictEqual(result, [0x44, 173, 1]);
    });

    it("rejects non-asset roots before creating a workspace", async () => {
        const result = await page.evaluate(async () => {
            try { await open(codeFor("controls_repeat_ext", "")); return false; }
            catch { return document.querySelectorAll(".blocklySvg").length === 0; }
        });
        assert(result);
    });

    it("opens the actual native melody field and captures edits without an asset conversion", async () => {
        const result = await page.evaluate(async () => {
            const { editor, asset } = await open(codeFor("melody_editor", '"C D E F G A B C5"'));
            const workspace = Blockly.Workspace.getAll().find(ws => ws.rendered);
            const field = workspace.getTopBlocks(false)[0].getField("ASSET");
            const visible = document.getElementById("melody-content-div")?.getAttribute("role") === "dialog";
            field.setValue('"C C C C C C C C"');
            const captured = editor.save();
            return { noAsset: !asset, visible, field: JSON.parse(captured.code).blocks[0].fields.ASSET };
        });
        assert(result.noAsset);
        assert(result.visible);
        assert.equal(result.field, '"C C C C C C C C "'); // Native melody serialization includes trailing space.
    });

    it("uses the native music_sounds gridpicker and captures its selected value", async () => {
        const result = await page.evaluate(async () => {
            const { editor, asset } = await open(codeFor("music_sounds", "one"));
            const workspace = Blockly.Workspace.getAll().find(ws => ws.rendered);
            workspace.getTopBlocks(false)[0].setFieldValue("two", "ASSET");
            return { noAsset: !asset, state: JSON.parse(editor.save().code).blocks[0].fields.ASSET };
        });
        assert(result.noAsset);
        assert.equal(result.state, "two");
    });
});