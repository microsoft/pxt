"use strict";
/* global pxt, Blockly, project, Editor, editors, bitmap, fieldState, codeFor, preview, galleryItem, nativeFields */

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
    for (const id of ["fields/field_utils", "fields/field_sprite", "fields/field_animation",
        "fields/field_musiceditor", "fields/field_tilemap", "fields/field_tileset",
        "fields/field_melodySandbox", "fields/field_gridpicker", "backpack"]) collect(id);
    modules.backpack = ts.transpileModule(fs.readFileSync(path.join(root, "pxtblocks/backpack.ts"), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
    }).outputText;
    return { modules, helper: ts.transpileModule(fs.readFileSync(path.join(root, "webapp/src/backpackAssetEditor.ts"), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
    }).outputText, previewModules: Object.fromEntries(["assets", "backpackAssetPreview"].map(id => [id,
        ts.transpileModule(fs.readFileSync(path.join(root, "webapp/src", id + ".ts"), "utf8"), {
            compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
        }).outputText])) };
}

describe("Backpack scratch native asset editing", function () {
    this.timeout(30000);
    let browser, page;
    before(async () => { browser = await launchTestBrowser(); });
    after(async () => { if (browser) await browser.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        await page.setContent('<div id="scalar-host" style="width:800px;height:600px"></div>');
        const blocklyDirectory = path.dirname(require.resolve("blockly"));
        for (const file of ["blockly_compressed.js", "blocks_compressed.js", "msg/en.js"]) {
            await page.addScriptTag({ path: path.join(blocklyDirectory, file) });
        }
        for (const file of ["pxtlib.js", "pxtsim.js"]) await page.addScriptTag({ path: path.join(root, "built", file) });
        await page.evaluate(({ modules, helper, previewModules }) => {
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
                : (() => { throw new Error(`Unexpected helper dependency: ${id}`); })(), module, module.exports);
            window.project = new pxt.TilemapProject();
            pxt.react = { getTilemapProject: () => project };
            window.Editor = module.exports.BackpackAssetEditor;
            window.editors = [];
            window.open = (code, gallery = project.saveGallerySnapshot(), name) => {
                const editor = new Editor(new pxt.TilemapProject());
                editors.push(editor);
                const getter = pxt.react.getTilemapProject, enabled = Blockly.Events.isEnabled();
                const asset = editor.open({ code, gallery, name }, document.getElementById("scalar-host"));
                if (asset?.then || pxt.react.getTilemapProject !== getter || Blockly.Events.isEnabled() !== enabled) {
                    throw new Error("Open must return synchronously without leaking project/event globals");
                }
                return { editor, asset };
            };
            window.fieldState = fields.getAssetSaveState;
            window.codeFor = (type, value) => JSON.stringify({ blocks: [{ type, fields: { ASSET: value } }] });
            window.bitmap = () => new pxt.sprite.Bitmap(16, 16).data();
            // Preview uses the same native registration as the active editor, not initializeAndInject.
            initializeAndInject();
            window.nativeFields = fields;
            const previewCache = {};
            const loadPreview = id => {
                if (previewCache[id]) return previewCache[id].exports;
                const module = previewCache[id] = { exports: {} };
                new Function("require", "module", "exports", previewModules[id])(dependency => {
                    if (dependency === "blockly") return Blockly;
                    if (dependency === "../../pxtblocks") return { ...fields, ...backpack,
                        initializeAndInject() { throw new Error("Preview must not reinject editor blocks"); } };
                    return loadPreview(dependency.slice(2));
                }, module, module.exports);
                return module.exports;
            };
            window.preview = loadPreview("backpackAssetPreview").backpackAssetPreview;
            window.galleryItem = loadPreview("assets").assetToGalleryItem;
        }, sources());
    });
    afterEach(async () => {
        if (!page) return;
        await page.evaluate(() => { for (const editor of editors) editor.dispose(); });
        await page.close();
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
                    text: captured.blockText, workspaces: Blockly.Workspace.getAll().length,
                    headless: Blockly.Workspace.getAll().every(ws => !ws.rendered) });
                reopened.editor.dispose(); editors.pop();
            }
            return outputs;
        });
        assert.deepStrictEqual(result.map(r => r.pixel), [0x22, 0x22]);
        assert.deepStrictEqual(result.map(r => r.fieldType), ["string", "object"]);
        assert(result[1].text.includes("savedImage"));
        assert(result.every(r => r.workspaces === 1 && r.headless));
    });

    it("returns native edited names and promotes a named temporary image to full portable state", async () => {
        const result = await page.evaluate(async () => {
            const outputs = [];
            for (const named of [false, true]) {
                const image = project.createNewProjectImage(bitmap(), "beforeRename");
                const value = named ? fieldState(image) : "img`2`";
                window.project = new pxt.TilemapProject();
                const { editor, asset } = await open(codeFor("image_picker", value), undefined, "Backpack label");
                const oldId = asset.id;
                asset.meta.displayName = "afterRename";
                const saved = editor.save(asset);
                // A failed parent save leaves this same native draft open for another save.
                const retried = editor.save(asset);
                const state = JSON.parse(retried.code).blocks[0].fields.ASSET;
                editor.dispose(); editors.pop();
                window.project = new pxt.TilemapProject();
                const reopened = await open(retried.code);
                outputs.push({ name: saved.name, retryName: retried.name, displayName: reopened.asset.meta.displayName,
                    portable: typeof state === "object" && !!state.jres, changedId: state.assetId !== oldId,
                    internalId: reopened.asset.internalID, pixel: reopened.asset.bitmap.data[0] });
                reopened.editor.dispose(); editors.pop();
            }
            return outputs;
        });
        for (const output of result) {
            assert.equal(output.name, "afterRename");
            assert.equal(output.retryName, "afterRename");
            assert.equal(output.displayName, "afterRename");
            assert(output.portable);
            assert.notEqual(output.internalId, -1);
        }
        assert(result[0].changedId);
        assert.equal(result[0].pixel, 2);
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

    it("previews native JRES, inline and gallery assets without changing live state or persisting PNGs", async () => {
        const result = await page.evaluate(async () => {
            const check = (value, message) => { if (!value) throw new Error(message); };
            const pixels = color => { const data = bitmap(); data.data.fill(color * 17); return data; };
            const literal = data => pxt.sprite.bitmapToImageLiteral(pxt.sprite.Bitmap.fromData(data), "typescript");
            const image = project.createNewProjectImage(pixels(2), "previewImage");
            const animation = project.createNewAnimationFromData([pixels(2), pixels(3)], 175, "previewAnimation");
            const songData = pxt.assets.music.getEmptySong(2);
            songData.tracks[0].notes = [{ startTick: 0, endTick: 6, notes: [{ note: 28, enharmonicSpelling: 0 }] }];
            const song = project.createNewSong(songData, "previewSong");
            const tile = project.createNewTile(pixels(2), undefined, "previewTile");
            const mapData = project.blankTilemap(16, 2, 2);
            mapData.tileset.tiles.push(tile); mapData.tilemap.set(1, 1, 1);
            const [mapId] = project.createNewTilemapFromData(mapData, "previewMap");
            const map = project.getTilemap(mapId);
            const assets = [["image_picker", image, literal(image.bitmap)],
                ["animation_editor", animation, `[${animation.frames.map(literal).join(",")}]`],
                ["music_song_field_editor", song, `hex\`${pxt.assets.music.encodeSongToHex(songData)}\``],
                ["tiles_tilemap_editor", map, pxt.sprite.encodeTilemap(mapData, "typescript", { [tile.id]: literal(tile.bitmap) })],
                ["tileset_tile_picker", tile]];
            const galleryProject = new pxt.TilemapProject();
            galleryProject.loadAssetsJRes(project.getProjectAssetsJRes(), true);
            galleryProject.loadTilemapJRes(project.getProjectTilesetJRes(), false, true);
            const emptyGallery = project.saveGallerySnapshot(), gallery = galleryProject.saveGallerySnapshot();
            const cases = assets.flatMap(([type, asset, inline]) => [
                { type, asset, value: fieldState(asset), gallery: emptyGallery },
                ...(inline ? [{ type, asset, value: inline, gallery: emptyGallery, inline: true }] : []),
                // Native gallery lookup uses tilemap ids; other named assets travel as full field state.
                { type, asset, value: type === "tiles_tilemap_editor" ? `tilemap\`${asset.id}\`` : fieldState(asset), gallery },
                ...(type === "image_picker" || type === "tileset_tile_picker" ? [{ type, asset, value: asset.id, gallery }] : [])
            ]);
            // Include a real live native field with colliding names/ids and queued unrelated initialization.
            window.project = new pxt.TilemapProject();
            project.createNewProjectImage(pixels(9), "previewImage");
            await open(codeFor("image_picker", literal(pixels(8))));
            const getter = pxt.react.getTilemapProject, workspaces = Blockly.Workspace.getAll();
            const snapshot = () => JSON.stringify([project, gallery, emptyGallery,
                workspaces.map(ws => Blockly.serialization.workspaces.save(ws))]);
            const before = snapshot(), pending = nativeFields.FieldBase.pendingInit;
            const timeout = nativeFields.FieldBase.pendingTimeout;
            const sentinel = { onLoadedIntoWorkspace() { throw new Error("Flushed live init queue"); } };
            pending.push(sentinel);
            const originalInit = nativeFields.FieldAssetEditor.prototype.onLoadedIntoWorkspace;
            const originalRemove = pxt.TilemapProject.prototype.removeChangeListener;
            const originalTimeout = window.setTimeout, originalAnimation = window.requestAnimationFrame;
            const scratchProjects = new Set();
            nativeFields.FieldAssetEditor.prototype.onLoadedIntoWorkspace = function () {
                const scratch = pxt.react.getTilemapProject();
                check(scratch !== project && !this.getSourceBlock().workspace.rendered && !Blockly.Events.isEnabled(), "Unsafe scratch initialization");
                scratchProjects.add(scratch);
                return originalInit.call(this);
            };
            pxt.TilemapProject.prototype.removeChangeListener = function (...args) {
                check(this !== project && this === pxt.react.getTilemapProject() && !Blockly.Events.isEnabled(), "Unsafe listener cleanup");
                scratchProjects.add(this); // Includes FieldTileset, which is not a FieldAssetEditor.
                return originalRemove.apply(this, args);
            };
            window.setTimeout = window.requestAnimationFrame = () => { throw new Error("Preview scheduled asynchronous work"); };
            const outputs = [];
            try {
                for (const c of cases) {
                    const item = { kind: "asset", code: codeFor(c.type, c.value) }, saved = JSON.stringify(item);
                    const actual = preview(item, { gallery: c.gallery, blocksInfo: {} });
                    const expected = galleryItem(pxt.cloneAsset(c.asset, true));
                    check(actual?.previewURI === expected.previewURI, `Wrong gallery preview: ${c.type}/${typeof c.value}`);
                    if (c.type === "animation_editor") {
                        check(JSON.stringify(actual.framePreviewURIs) === JSON.stringify(expected.framePreviewURIs), "Wrong frames");
                        check(actual.interval === (c.inline ? 100 : 175), "Wrong native interval");
                    }
                    check(Object.keys(actual).every(key => ["previewURI", "framePreviewURIs", "interval"].includes(key)), "Leaked asset data");
                    check(JSON.stringify(item) === saved && pxt.react.getTilemapProject === getter && Blockly.Events.isEnabled(), "Leaked item/global state");
                    check(Blockly.Workspace.getAll().length === workspaces.length && snapshot() === before, "Changed live workspace/project/gallery");
                    outputs.push({ type: c.type, ...actual });
                }
                for (const scratch of scratchProjects) {
                    check(Object.values(scratch.state.assets).every(collection => !collection.listeners.length), "Scratch listener leaked");
                    check(!JSON.stringify(scratch).includes("data:image/png"), "Persisted preview on native asset");
                }
                check(nativeFields.FieldBase.pendingInit === pending && pending.includes(sentinel)
                    && nativeFields.FieldBase.pendingTimeout === timeout, "Changed live init queue");
            } finally {
                nativeFields.FieldAssetEditor.prototype.onLoadedIntoWorkspace = originalInit;
                pxt.TilemapProject.prototype.removeChangeListener = originalRemove;
                window.setTimeout = originalTimeout; window.requestAnimationFrame = originalAnimation;
                pending.splice(pending.indexOf(sentinel), 1);
            }
            const pixel = async (uri, x, y) => {
                const img = new Image(); img.src = uri; await img.decode();
                const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0);
                return Array.from(ctx.getImageData(x, y, 1, 1).data);
            };
            return Promise.all(outputs.map(async output => ({ type: output.type,
                pixel: await pixel(output.previewURI, output.type === "tiles_tilemap_editor" ? 1 : 0,
                    output.type === "music_song_field_editor" ? 16 : output.type === "tiles_tilemap_editor" ? 1 : 0),
                second: output.framePreviewURIs && await pixel(output.framePreviewURIs[1], 0, 0) })));
        });
        assert.equal(result.length, 16);
        for (const output of result) {
            assert.deepStrictEqual(output.pixel, output.type === "music_song_field_editor" ? [255, 246, 9, 255] : [255, 33, 33, 255]);
            if (output.second) assert.deepStrictEqual(output.second, [255, 147, 196, 255]);
        }
    });

    it("preview fallback and partial-load failures restore the getter, workspace registry and prior event state", async () => {
        const result = await page.evaluate(() => {
            const getter = pxt.react.getTilemapProject, count = Blockly.Workspace.getAll().length;
            const context = { gallery: project.saveGallerySnapshot(), blocksInfo: {} };
            const before = JSON.stringify(project);
            const cases = [{ kind: "code", code: codeFor("image_picker", "") }, { kind: "asset", code: "{" },
                ...[["controls_repeat_ext", ""], ["melody_editor", '"C D E F G A B C5"'], ["music_sounds", "one"],
                    ["music_song_field_editor", "invalid song"], ["image_picker", { version: 1, assetType: "image", assetId: "missing", jres: {} }]
                ].map(([type, value]) => ({ kind: "asset", code: codeFor(type, value) }))];
            const outcomes = [];
            for (const disabled of [false, true]) {
                if (disabled) { Blockly.Events.disable(); Blockly.Events.disable(); }
                try {
                    for (const item of cases) outcomes.push(preview(item, context) === undefined
                        && pxt.react.getTilemapProject === getter && Blockly.Events.isEnabled() === !disabled
                        && Blockly.Workspace.getAll().length === count && JSON.stringify(project) === before);
                    outcomes.push(!!preview({ kind: "asset", code: codeFor("image_picker", "img`2`") }, context)?.previewURI
                        && Blockly.Events.isEnabled() === !disabled && pxt.react.getTilemapProject === getter
                        && Blockly.Workspace.getAll().length === count && JSON.stringify(project) === before);
                } finally {
                    if (disabled) {
                        Blockly.Events.enable(); outcomes.push(!Blockly.Events.isEnabled()); Blockly.Events.enable();
                    }
                }
            }
            // Fail after a listener has been registered, during gallery rasterization.
            const asset = project.createNewProjectImage(bitmap(), "badPreview");
            const item = { kind: "asset", code: codeFor("image_picker", fieldState(asset)) };
            const convert = pxt.ImageConverter.prototype.convert;
            let scratch;
            pxt.ImageConverter.prototype.convert = () => { scratch = pxt.react.getTilemapProject(); throw new Error("canvas failed"); };
            try {
                outcomes.push(preview(item, context) === undefined && scratch !== project && !!scratch
                    && Object.values(scratch.state.assets).every(collection => !collection.listeners.length)
                    && Blockly.Workspace.getAll().length === count && pxt.react.getTilemapProject === getter && Blockly.Events.isEnabled());
            } finally { pxt.ImageConverter.prototype.convert = convert; }
            return outcomes;
        });
        assert(result.every(Boolean));
    });

    it("rejects non-asset roots before creating a workspace", async () => {
        const result = await page.evaluate(() => {
            const getter = pxt.react.getTilemapProject;
            try { open(codeFor("controls_repeat_ext", "")); return false; }
            catch { return Blockly.Workspace.getAll().length === 0 && pxt.react.getTilemapProject === getter; }
        });
        assert(result);
    });

    it("opens the actual native melody field and captures edits without an asset conversion", async () => {
        const result = await page.evaluate(async () => {
            const { editor, asset } = await open(codeFor("melody_editor", '"C D E F G A B C5"'), undefined, "My melody");
            const workspace = Blockly.Workspace.getAll().find(ws => ws.rendered);
            const field = workspace.getTopBlocks(false)[0].getField("ASSET");
            const visible = document.getElementById("melody-content-div")?.getAttribute("role") === "dialog";
            field.setValue('"C C C C C C C C"');
            const captured = editor.save();
            return { noAsset: !asset, visible, field: JSON.parse(captured.code).blocks[0].fields.ASSET, name: captured.name };
        });
        assert(result.noAsset);
        assert(result.visible);
        assert.equal(result.name, "My melody");
        assert.equal(result.field, '"C C C C C C C C "'); // Native melody serialization includes trailing space.
    });

    it("uses the native music_sounds gridpicker and captures its selected value", async () => {
        const result = await page.evaluate(async () => {
            const { editor, asset } = await open(codeFor("music_sounds", "one"), undefined, "My sound");
            const workspace = Blockly.Workspace.getAll().find(ws => ws.rendered);
            workspace.getTopBlocks(false)[0].setFieldValue("two", "ASSET");
            const captured = editor.save();
            return { noAsset: !asset, state: JSON.parse(captured.code).blocks[0].fields.ASSET, name: captured.name };
        });
        assert(result.noAsset);
        assert.equal(result.state, "two");
        assert.equal(result.name, "My sound");
    });
});