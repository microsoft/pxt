"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");
const { launchTestBrowser } = require("./browser");

const root = path.resolve(__dirname, "../..");

describe("Backpack gallery preparation", () => {
    it("detaches metadata and pixels and repairs native prototypes without loading either project", () => {
        const context = vm.createContext({
            console, structuredClone,
            atob: value => Buffer.from(value, "base64").toString("binary"),
            btoa: value => Buffer.from(value, "binary").toString("base64")
        });
        vm.runInContext(fs.readFileSync(path.join(root, "built/pxtlib.js"), "utf8"), context);
        const pxt = context.pxt;
        pxt.AssetType = { Tilemap: "tilemap" };
        const compiled = ts.transpileModule(fs.readFileSync(path.join(root, "webapp/src/backpackAssetGallery.ts"), "utf8"), {
            compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
            reportDiagnostics: true
        });
        assert.deepStrictEqual(compiled.diagnostics, []);
        const exports = {};
        vm.runInContext(`(function(exports) { ${compiled.outputText}\n})`, context)(exports);

        const source = new pxt.TilemapProject();
        const pixels = new pxt.sprite.Bitmap(16, 16);
        pixels.set(1, 1, 5);
        const tile = source.createNewTile(pixels.data(), "myTiles.galleryTile", "Gallery tile");
        const data = source.blankTilemap(16, 2, 2);
        data.tileset.tiles.push(tile);
        data.tilemap.set(1, 1, 1);
        const walls = pxt.sprite.Bitmap.fromData(data.layers);
        walls.set(1, 1, 2);
        data.layers = walls.data();
        const [id] = source.createNewTilemapFromData(data, "Gallery map");
        const tilemap = source.getTilemap(id);
        tilemap.meta.tags = ["terrain"];
        tilemap.meta.blockIDs = ["source-block"];
        const gallery = source.saveGallerySnapshot();
        gallery.revision = 7;
        gallery.assets.tile.add(tile);
        gallery.assets.tilemap.add(tilemap);
        const scratch = new pxt.TilemapProject();
        const projectGallery = scratch.saveGallerySnapshot();
        projectGallery.revision = 3;
        const sourceBefore = JSON.stringify(source);
        const scratchBefore = JSON.stringify(scratch);

        const prepared = exports.prepareBackpackAssetGallery(gallery, scratch);
        assert.strictEqual(prepared.projectGallery, projectGallery);
        assert.strictEqual(prepared.snapshot.revision, 7);
        assert.strictEqual(prepared.projectGallery.revision, 3);
        for (const type of Object.keys(prepared.snapshot.assets)) {
            assert.strictEqual(Object.getPrototypeOf(prepared.snapshot.assets[type]), Object.getPrototypeOf(projectGallery.assets[type]));
        }
        const repaired = prepared.snapshot.assets.tilemap.assets[0];
        assert(repaired.data instanceof pxt.sprite.TilemapData);
        assert(repaired.data.tilemap instanceof pxt.sprite.Tilemap);
        assert.strictEqual(repaired.data.tilemap.get(1, 1), 1);
        assert.strictEqual(pxt.sprite.Bitmap.fromData(repaired.data.layers).get(1, 1), 2);
        assert.strictEqual(pxt.sprite.Bitmap.fromData(repaired.data.tileset.tiles[1].bitmap).get(1, 1), 5);
        repaired.meta.tags.push("scratch-only");
        repaired.meta.blockIDs.push("scratch-block");
        repaired.data.tilemap.set(1, 1, 0);
        repaired.data.layers.data[0] ^= 0xff;
        repaired.data.tileset.tiles[1].bitmap.data[0] ^= 0xff;
        prepared.snapshot.assets.tile.assets[0].bitmap.data[0] ^= 0xff;
        assert.strictEqual(JSON.stringify(source), sourceBefore);
        assert.strictEqual(JSON.stringify(scratch), scratchBefore);
    });
});

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
                if (backpack.getBackpackAssetField(block)) throw new Error("A statement containing assets is not an asset literal");
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

    for (const defaultFirst of [true, false]) {
        it(`preserves gallery and external tiles sharing a short id with a ${defaultFirst ? "preceding" : "following"} default-namespace tile`, async () => {
            const result = await page.evaluate(defaultFirst => {
                const { getAssetSaveState, loadAssetFromSaveState } = load("fields/field_utils");
                const projectTile = project.createNewTile(bitmap(16, 16, 2), "myTiles.shared", "Project tile");
                const externalTile = project.createNewTile(bitmap(16, 16, 4), "extension.tiles.shared", "External tile");
                const galleryTile = {
                    ...projectTile, id: "gallery.shared", isProjectTile: false,
                    bitmap: bitmap(16, 16, 6), meta: { displayName: "Gallery tile", tags: ["gallery", "terrain"] }
                };
                galleryTile.jresData = pxt.sprite.base64EncodeBitmap(galleryTile.bitmap);
                project.saveGallerySnapshot().assets.tile.add(galleryTile);
                projectTile.meta.tags = ["project", "terrain"];
                externalTile.meta.tags = ["external", "terrain"];
                const tiles = defaultFirst ? [projectTile, galleryTile, externalTile] : [externalTile, galleryTile, projectTile];
                const data = project.blankTilemap(16, 3, 1);
                data.tileset.tiles.push(...tiles);
                tiles.forEach((tile, index) => data.tilemap.set(index, 0, index + 1));
                const [id] = project.createNewTilemapFromData(data, "portableLevel");
                const tilemap = project.getTilemap(id);
                const expected = snapshot(tilemap);

                // The shared helper must keep its existing short-key convention.
                const helperJres = {};
                for (const tile of tiles) pxt.addAssetToJRes(tile, helperJres);
                const lastTile = tiles[tiles.length - 1];
                const helperExpected = {
                    shared: {
                        data: lastTile.jresData, mimeType: pxt.IMAGE_MIME_TYPE,
                        tilemapTile: true, displayName: lastTile.meta.displayName, tags: lastTile.meta.tags
                    }
                };
                const expectedEntries = tiles.map(tile => ({
                    key: tile.id === projectTile.id ? "shared" : tile.id,
                    id: tile.id, data: tile.jresData, displayName: tile.meta.displayName, tags: tile.meta.tags.slice()
                }));
                const sourceBefore = JSON.stringify(tilemap);
                const saved = getAssetSaveState(tilemap);
                const sourceUnchanged = sourceBefore === JSON.stringify(tilemap);
                const entries = expectedEntries.map(tile => ({ key: tile.key, ...saved.jres[tile.key] }));
                const inflatedIds = Object.values(pxt.inflateJRes(JSON.parse(JSON.stringify(saved.jres))))
                    .filter(entry => entry.tilemapTile).map(entry => entry.id).sort();
                const tagsDetached = expectedEntries.every(tile => {
                    const tags = saved.jres[tile.key].tags;
                    tags.push("saved-only");
                    const detached = !tilemap.data.tileset.tiles.find(t => t.id === tile.id).meta.tags.includes("saved-only");
                    tags.pop();
                    return detached;
                });

                // Gallery tiles can carry pixels without a cached JRES encoding.
                const bitmapOnly = project.getTilemap(id);
                bitmapOnly.data.tileset.tiles.find(tile => tile.id === galleryTile.id).jresData = "";
                const fallback = getAssetSaveState(bitmapOnly).jres[galleryTile.id];
                const fallbackUnchanged = bitmapOnly.data.tileset.tiles.find(tile => tile.id === galleryTile.id).jresData === "";

                const roundTrips = [false, true].map(collidingDestination => {
                    window.project = new pxt.TilemapProject();
                    if (collidingDestination) {
                        project.createNewTile(bitmap(16, 16, 9), projectTile.id, "Destination tile");
                        project.createNewTile(projectTile.bitmap, "myTiles.existing", "Matching pixels");
                        project.createNewTilemap("portableLevel", 16, 1, 1);
                    }
                    const loadSaved = () => loadAssetFromSaveState(JSON.parse(JSON.stringify(saved)));
                    const first = loadSaved();
                    const afterFirst = JSON.stringify(project.getProjectTilesetJRes());
                    const second = loadSaved();
                    return {
                        pixels: snapshot(first),
                        ids: first.data.tileset.tiles.map(tile => tile.id),
                        tilemapId: first.id,
                        repeatedId: second.id,
                        unchanged: afterFirst === JSON.stringify(project.getProjectTilesetJRes())
                    };
                });
                return {
                    helperJres, helperExpected, expectedEntries, entries, inflatedIds, sourceUnchanged, tagsDetached,
                    fallback, fallbackUnchanged, expected, sourceId: id, roundTrips, errors
                };
            }, defaultFirst);
            assert.deepStrictEqual(result.helperJres, result.helperExpected);
            assert(result.sourceUnchanged);
            assert(result.tagsDetached);
            assert(result.fallbackUnchanged);
            for (const expected of result.expectedEntries) {
                const entry = result.entries.find(entry => entry.key === expected.key);
                assert.strictEqual(entry.data, expected.data);
                assert.strictEqual(entry.mimeType, "image/x-mkcd-f4");
                assert.strictEqual(entry.tilemapTile, true);
                assert.strictEqual(entry.displayName, expected.displayName);
                assert.deepStrictEqual(entry.tags, expected.tags);
                if (expected.key === "shared") {
                    assert.strictEqual(entry.id, undefined);
                    assert.strictEqual(entry.namespace, undefined);
                }
                else {
                    assert.strictEqual(entry.id, expected.id);
                    assert.strictEqual(entry.namespace, expected.id.slice(0, expected.id.lastIndexOf(".") + 1));
                    assert.strictEqual(entry.dataEncoding, "base64");
                }
            }
            const expectedIds = ["myTiles.transparency16", ...result.expectedEntries.map(tile => tile.id)].sort();
            assert.deepStrictEqual(result.inflatedIds, expectedIds);
            assert.deepStrictEqual(result.roundTrips[0].ids.slice().sort(), expectedIds);
            assert.strictEqual(result.roundTrips[0].tilemapId, result.sourceId);
            assert.notStrictEqual(result.roundTrips[1].tilemapId, result.sourceId);
            assert(result.roundTrips[1].ids.includes("myTiles.existing"));
            const galleryEntry = result.entries.find(entry => entry.key === "gallery.shared");
            const { key, ...expectedFallback } = galleryEntry;
            assert.deepStrictEqual(result.fallback, expectedFallback);
            for (const restored of result.roundTrips) {
                assert.deepStrictEqual(restored.pixels, result.expected);
                assert.strictEqual(restored.repeatedId, restored.tilemapId);
                assert(restored.unchanged);
            }
            assert.deepStrictEqual(result.errors, []);
        });
    }

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