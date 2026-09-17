"use strict";
/* global pxt, React, ReactDOM, popup, AssetPopup, native */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { Transform } = require("stream");
const browserify = require("browserify");
const ts = require("typescript");
const less = require("less");
const { launchTestBrowser } = require("./browser");
const root = path.resolve(__dirname, "../..");

// Real native UI/dependencies, with current context-aware sources compiled only in memory.
async function bundle() {
    const entry = "webapp/src/components/BackpackAssetEditDialog";
    const current = new Set([entry, "webapp/src/backpackAssetEditor", "webapp/src/assets",
        ...["ImageFieldEditor", "ImageEditor/ImageEditor", "ImageEditor/ImageCanvas", "ImageEditor/BottomBar",
            "ImageEditor/store/imageReducer", "ImageEditor/tilemap/TilePalette", "musicEditor/EditControls",
            "pianoRoll/AssetNameModal"].map(id => "webapp/src/components/" + id)]);
    const context = path.join(root, "webapp/src/components/AssetEditorContext.ts");
    return new Promise((resolve, reject) => {
        const build = browserify(path.join(root, "built", entry + ".js"), { standalone: "AssetPopup" });
        // The newly added context module may not be built yet; resolve it to source, not a disk fixture.
        const resolveModule = build._bresolve;
        build._bresolve = (id, options, done) => /\/AssetEditorContext$/.test(id)
            ? done(null, context) : resolveModule(id, options, done);
        build.transform(file => {
            let content = "";
            return new Transform({
                transform(chunk, encoding, done) { content += chunk; done(); },
                flush(done) {
                    if (file === require.resolve("react")) content = "module.exports = window.React;";
                    if (file === require.resolve("react-dom")) content = "module.exports = window.ReactDOM;";
                    const id = path.relative(path.join(root, "built"), file).replace(/\\/g, "/").replace(/\.js$/, "");
                    if (current.has(id) || file === context) {
                        const source = file === context ? context : [".tsx", ".ts"].map(ext => path.join(root, id + ext)).find(fs.existsSync);
                        content = ts.transpileModule(fs.readFileSync(source, "utf8"), { fileName: source,
                            compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
                                jsx: ts.JsxEmit.React } }).outputText;
                    }
                    if (id === entry) {
                        content += `window.native = { Blockly: require("blockly"), fields: require("../../../pxtblocks"),
                            Editor: require("../backpackAssetEditor").BackpackAssetEditor,
                            stores: require("./ImageEditor/store/imageStore"), actions: require("./ImageEditor/actions/dispatch") };`;
                    }
                    this.push(content); done();
                }
            });
        }, { global: true }).bundle((error, data) => error ? reject(error) : resolve(data.toString()));
    });
}

describe("Backpack native asset popup", function () {
    this.timeout(30000);
    let browser, page, errors, requests, script, styles;
    const dialog = ".project-backpack__asset-modal";
    before(async () => {
        [script, styles] = await Promise.all([
            bundle(),
            less.render("@blocklyWidgetDivZIndex: 1000;\n" + fs.readFileSync(path.join(root, "theme/project-backpack.less"), "utf8"))
        ]);
        browser = await launchTestBrowser();
    });
    after(async () => { if (browser) await browser.close(); });
    beforeEach(async () => {
        page = await browser.newPage(); errors = []; requests = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.setViewport({ width: 1000, height: 800 });
        await page.setContent('<button id="trigger">Edit</button><div id="root"></div><p id="open-error" role="alert"></p>'
            + '<div id="previous" aria-hidden="false"></div><div id="hidden" aria-hidden="true" inert></div>');
        await page.addStyleTag({ path: path.join(root, "built/web/semantic.css") });
        await page.addStyleTag({ content: styles.css });
        for (const file of ["pxtlib.js", "pxtsim.js"]) await page.addScriptTag({ path: path.join(root, "built", file) });
        for (const file of ["react/umd/react.development.js", "react-dom/umd/react-dom.development.js"])
            await page.addScriptTag({ path: require.resolve(file) });
        await page.evaluate(() => {
            window.lf = pxt.Util.lf;
            pxt.AssetType = { Image: "image", Tile: "tile", Tilemap: "tilemap", Animation: "animation", Song: "song" };
            pxt.appTarget = { id: "arcade", versions: { target: "1", pxt: "2" }, appTheme: { assetEditor: true }, runtime: { palette: [
                "#000000", "#ffffff", "#ff2121", "#ff93c4", "#ff8135", "#fff609", "#249ca3", "#78dc52",
                "#003fad", "#87f2ff", "#8e2ec4", "#a4839f", "#5c406c", "#e5cdc4", "#91463d", "#000000"
            ] } };
            pxt.tickEvent = () => {};
        });
        await page.addScriptTag({ content: script });
        await page.evaluate(() => {
            const { Blockly, fields, stores, actions } = native;
            for (const [type, Field] of [["image_picker", fields.FieldSpriteEditor], ["animation_editor", fields.FieldAnimationEditor],
                ["music_song_field_editor", fields.FieldMusicEditor], ["tiles_tilemap_editor", fields.FieldTilemap],
                ["melody_editor", fields.FieldCustomMelody]]) {
                Blockly.Blocks[type] = { init() {
                    this.appendDummyInput().appendField(new Field("", {}), "img"); this.setOutput(true);
                } };
            }
            const source = new pxt.TilemapProject(), gallery = new pxt.TilemapProject(), live = new pxt.TilemapProject();
            const pixels = new pxt.sprite.Bitmap(16, 16); pixels.set(0, 0, 7);
            source.createNewProjectImage(pixels.data(), "galleryImage");
            const data = source.blankTilemap(16, 2, 2);
            data.tileset.tiles.push(source.createNewTile(pixels.data(), undefined, "templateTile")); data.tilemap.set(1, 1, 1);
            source.createNewTilemapFromData(data, "galleryMap");
            const forest = new pxt.sprite.Bitmap(16, 16); forest.set(0, 0, 8);
            const tile = source.createNewTile(forest.data(), "gallery.forest", "forest");
            tile.meta.tags = ["tile", "forest"]; source.updateTile(tile);
            gallery.loadAssetsJRes(source.getProjectAssetsJRes(), true);
            gallery.loadTilemapJRes(source.getProjectTilesetJRes(), false, true);
            const liveAsset = live.createNewProjectImage(pixels.data(), "renamedImage");
            pxt.react.getTilemapProject = () => live;
            for (const store of [stores.mainStore, stores.tileEditorStore]) {
                store.dispatch(actions.dispatchOpenAsset(liveAsset, false));
                store.dispatch(actions.dispatchChangeAssetName("liveUndoHistory"));
            }
            window.popup = {
                saves: [], openErrors: [], fail: false, hold: false, live, getter: pxt.react.getTilemapProject,
                item: { id: "fixed-backpack-id", name: "Backpack label", kind: "asset", createdAt: 1,
                    code: JSON.stringify({ blocks: [{ type: "image_picker", fields: { img: "img`2`" } }] }),
                    blockText: "image", dependencies: {}, versions: { target: "old", pxt: "old" } },
                context: { blocksInfo: { apis: { byQName: { "gallery.forest": {
                    kind: 4, retType: "Image", namespace: "gallery", qName: "gallery.forest",
                    attributes: { fixedInstance: true, tags: "tile forest", jresURL: "data:image/x-mkcd-f4;base64," + tile.jresData }
                } } }, blocks: [], enums: {} },
                    gallery: gallery.saveGallerySnapshot(), palette: pxt.appTarget.runtime.palette }
            };
            popup.fieldState = (project, asset) => {
                const getter = pxt.react.getTilemapProject;
                try { pxt.react.getTilemapProject = () => project; return native.fields.getAssetSaveState(asset); }
                finally { pxt.react.getTilemapProject = getter; }
            };
            popup.snapshot = () => JSON.stringify([live, popup.context.gallery, stores.mainStore.getState(), stores.tileEditorStore.getState()]);
            popup.before = popup.snapshot();
            // Inspect real mounted instances/stores, without replacing editor methods or React rendering.
            popup.instance = (selector, name) => {
                const node = document.querySelector(selector);
                let fiber = node[Object.keys(node).find(key => /^__react(Fiber|InternalInstance)\$/.test(key))];
                for (; fiber; fiber = fiber.return) if (fiber.stateNode?.constructor.name === name) return fiber.stateNode;
                throw new Error(`Missing native ${name}`);
            };
            popup.image = () => popup.instance(".image-editor-outer", "ImageEditor");
            popup.read = code => {
                const editor = new native.Editor(new pxt.TilemapProject());
                try { return editor.open({ code, gallery: popup.context.gallery }); } finally { editor.dispose(); }
            };
            popup.unmount = () => ReactDOM.unmountComponentAtNode(document.getElementById("root"));
            popup.mount = () => {
                document.getElementById("open-error").textContent = "";
                document.getElementById("trigger").focus();
                ReactDOM.render(React.createElement(AssetPopup.BackpackAssetEditDialog, {
                    item: popup.item, context: popup.context,
                    onClose: popup.unmount,
                    onOpenError: message => {
                        popup.openErrors.push(message);
                        document.getElementById("open-error").textContent = message;
                        queueMicrotask(popup.unmount);
                    },
                    onSave: async item => {
                        popup.saves.push(item);
                        if (popup.hold) await new Promise(resolve => { popup.release = resolve; });
                        if (popup.fail) throw new Error("Save failed; draft retained");
                        popup.unmount();
                    }
                }), document.getElementById("root"));
            };
        });
        page.on("request", request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    });
    afterEach(async () => {
        if (page) {
            try {
                assert(await page.evaluate(() => {
                    if (!window.popup) return true; // Do not mask a failed setup hook.
                    popup.unmount();
                    return popup.snapshot() === popup.before && pxt.react.getTilemapProject === popup.getter
                        && native.Blockly.Events.isEnabled() && native.Blockly.Workspace.getAll().length === 0;
                }), "Changed live project/gallery/undo or leaked a scratch workspace/global");
            } finally { await page.close(); }
        }
        assert.deepStrictEqual(errors, []);
        assert.deepStrictEqual(requests, [], "Opening/editing must not load an iframe or contact a server");
    });

    const open = async () => {
        assert.deepStrictEqual(await page.evaluate(() => {
            popup.mount();
            const overlay = document.querySelector(".project-backpack__asset-modal-overlay");
            return [getComputedStyle(overlay).visibility, !!overlay.querySelector("button[title='Done']"),
                document.querySelectorAll("iframe").length,
                overlay.querySelectorAll(".common-modal-header, .project-backpack__asset-modal-status").length + popup.openErrors.length,
                document.getElementById("root").hasAttribute("inert"), pxt.react.getTilemapProject === popup.getter];
        }), ["visible", true, 0, 0, true, true], "Native controls must be ready in the opening turn");
    };
    const closed = async () => {
        await page.waitForFunction(() => !document.querySelector(".project-backpack__asset-modal")
            && !document.getElementById("root").hasAttribute("aria-hidden"));
    };
    it("retains the native draft on failure, coalesces dismissals while pending, and retries", async () => {
        await open();
        await page.evaluate(() => {
            const pixels = new pxt.sprite.Bitmap(16, 16); pixels.set(0, 0, 3);
            popup.image().setCurrentFrame(pixels, true);
        });
        await page.type(".image-editor-change-name input", "retryImage");
        await page.evaluate(() => { popup.fail = true; popup.hold = true; });
        await page.click(".image-editor-close-button");
        await page.waitForFunction(() => popup.saves.length === 1);
        await page.evaluate(() => document.querySelector(".image-editor-confirm").click());
        await page.keyboard.press("Escape");
        await page.mouse.click(5, 5);
        await page.evaluate(() => popup.release());
        await page.waitForSelector(`${dialog} [role="alert"]`);
        assert.equal(await page.evaluate(() => popup.saves.length), 1);
        assert.equal(await page.$eval(".image-editor-change-name input", node => node.value), "retryImage");
        assert(await page.evaluate(() => popup.snapshot() === popup.before && pxt.react.getTilemapProject === popup.getter));
        await page.evaluate(() => { popup.fail = false; popup.hold = false; });
        await page.click(`${dialog} button[title="Retry"]`);
        await closed();
        assert.deepStrictEqual(await page.evaluate(() => popup.saves.map(item => [item.id, item.name])),
            [["fixed-backpack-id", "retryImage"], ["fixed-backpack-id", "retryImage"]]);
        assert.equal(await page.evaluate(() => popup.read(popup.saves[1].code).bitmap.data[0]), 3);
    });

    it("creates/edits tiles with independent private stores and applies gallery templates only to scratch", async () => {
        await page.evaluate(() => {
            const project = new pxt.TilemapProject();
            const [id] = project.createNewTilemapFromData(project.blankTilemap(16, 2, 2), "savedMap");
            popup.item.code = JSON.stringify({ blocks: [{ type: "tiles_tilemap_editor",
                fields: { img: popup.fieldState(project, project.getTilemap(id)) } }] });
        });
        await open();
        await page.click(".tile-palette .image-editor-pivot-option:first-child");
        await page.click('button[title="Create a new tile"]');
        assert(await page.evaluate(() => {
            const main = popup.image(), tile = main.refs["nested-image-editor"];
            popup.parentState = main.props.store.getState().store;
            const pixels = new pxt.sprite.Bitmap(16, 16); pixels.set(0, 0, 4);
            tile.setCurrentFrame(pixels, true);
            return main.context !== popup.live && main.context === tile.context
                && new Set([main.props.store, tile.props.store, native.stores.mainStore, native.stores.tileEditorStore]).size === 4
                && main.props.store.getState().store === popup.parentState;
        }));
        await page.click(".image-editor-outer .image-editor-outer .image-editor-confirm");
        await page.click('button[title="Edit the selected tile"]');
        assert.equal(await page.evaluate(() => popup.image().refs["nested-image-editor"].getAsset().bitmap.data[0]), 4);
        await page.evaluate(() => {
            const pixels = new pxt.sprite.Bitmap(16, 16); pixels.set(0, 0, 5);
            popup.image().refs["nested-image-editor"].setCurrentFrame(pixels, true);
        });
        await page.click(".image-editor-outer .image-editor-outer .image-editor-confirm");
        await page.click('.common-editor-toggle [title="Gallery"]');
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".image-editor-gallery")).marginTop === "0px");
        await page.click(".asset-editor-card");
        assert.deepStrictEqual(await page.evaluate(() => {
            const editor = popup.image(), asset = editor.getAsset();
            return [asset.data.tilemap.get(1, 1), asset.data.tileset.tiles.some(t => t.bitmap.data[0] === 5),
                editor.context.getAssets(pxt.AssetType.Tile).some(t => t.bitmap.data[0] === 7),
                popup.snapshot() === popup.before, native.Blockly.Workspace.getAll().every(ws => !ws.rendered)];
        }), [1, true, true, true, true]);
        await page.evaluate(() => {
            // Use the edited tile: native serialization intentionally trims unused tiles.
            const store = popup.image().props.store, state = store.getState().store.present;
            const map = pxt.sprite.Tilemap.fromData(state.tilemap.bitmap).copy();
            map.set(0, 0, state.tileset.tiles.findIndex(t => t.bitmap.data[0] === 5));
            store.dispatch(native.actions.dispatchImageEdit({ ...state.tilemap, bitmap: map.data() }));
        });
        await page.click(".image-editor-confirm"); await closed();
        assert(await page.evaluate(() => popup.read(popup.saves[0].code).data.tileset.tiles.some(t => t.bitmap.data[0] === 5)));
    });

    it("supports consecutive image, animation and song native sessions without shared undo", async () => {
        for (const type of ["image", "animation", "song"]) {
            await page.evaluate(type => {
                const project = new pxt.TilemapProject(), pixels = new pxt.sprite.Bitmap(16, 16).data();
                const asset = type === "image" ? project.createNewProjectImage(pixels, "before")
                    : type === "animation" ? project.createNewAnimationFromData([pixels, pixels], 175, "before")
                    : project.createNewSong(pxt.assets.music.getEmptySong(2), "before");
                const block = { image: "image_picker", animation: "animation_editor", song: "music_song_field_editor" }[type];
                popup.item.code = JSON.stringify({ blocks: [{ type: block, fields: { img: popup.fieldState(project, asset) } }] });
            }, type);
            await open();
            assert.equal(await page.$eval(dialog, node => node.getAttribute("role")), "dialog");
            assert(await page.$(".image-editor-close-button"));
            if (type !== "song") await page.evaluate(() => {
                const pixels = new pxt.sprite.Bitmap(16, 16); pixels.set(0, 0, 6);
                popup.image().setCurrentFrame(pixels, true);
            });
            const selector = type === "song" ? ".music-editor-edit-controls input" : ".image-editor-change-name input";
            await page.click(selector, { clickCount: 3 });
            await page.type(selector, "renamedImage"); // Collides with live project, not scratch.
            if (type === "animation") {
                await page.focus(`${dialog} button[title="Done"]`); await page.keyboard.press("Escape");
            } else await page.click(`${dialog} button[title="Done"]`);
            await closed();
            assert.deepStrictEqual(await page.evaluate(() => {
                const saved = popup.saves[popup.saves.length - 1], asset = popup.read(saved.code);
                return [saved.id, saved.name, asset.type, asset.type === "animation" ? asset.frames[0].data[0]
                    : asset.type === "image" ? asset.bitmap.data[0] : asset.song.measures, document.activeElement.id];
            }), ["fixed-backpack-id", "renamedImage", type, type === "song" ? 2 : 6, "trigger"]);
        }
        assert.deepStrictEqual(await page.evaluate(() => [document.getElementById("previous").getAttribute("aria-hidden"),
            document.getElementById("hidden").getAttribute("aria-hidden"), document.getElementById("hidden").hasAttribute("inert")]), ["false", "true", true]);
    });

    it("keeps Done available after the native scalar melody dropdown closes", async () => {
        await page.evaluate(() => {
            popup.item.code = JSON.stringify({ blocks: [{ type: "melody_editor", fields: { img: '"C D E F G A B C5"' } }] });
        });
        await open();
        assert(await page.$("#melody-content-div"));
        await page.click(".melody-confirm-button");
        await page.click(".image-editor-confirm");
        await closed();
        assert.equal(await page.evaluate(() => popup.saves[0].name), "Backpack label");
    });
});