"use strict";
/* global pxt, React, ReactDOM, popup, AssetPopup */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Transform } = require("stream");
const browserify = require("browserify");
const ts = require("typescript");
const less = require("less");
const { launchTestBrowser } = require("./browser");
const root = path.resolve(__dirname, "../..");

// Use today's popup/iframe/helper/driver sources with existing native dependencies.
// Bundle entirely in memory so this suite doesn't require or alter a full build.
async function bundle(entry, standalone) {
    const current = new Set(["webapp/src/components/BackpackAssetEditDialog", "webapp/src/assetEditor",
        "webapp/src/backpackAssetEditor", "pxtservices/assetEditorDriver"]);
    return new Promise((resolve, reject) => {
        browserify(path.join(root, "built", entry + ".js"), { standalone })
            .transform(file => {
                let content = "";
                return new Transform({
                    transform(chunk, encoding, done) { content += chunk; done(); },
                    flush(done) {
                        if (file === require.resolve("react")) content = "module.exports = window.React;";
                        if (file === require.resolve("react-dom")) content = "module.exports = window.ReactDOM;";
                        const id = path.relative(path.join(root, "built"), file).replace(/\\/g, "/").replace(/\.js$/, "");
                        if (current.has(id)) {
                            const source = [".tsx", ".ts"].map(ext => path.join(root, id + ext)).find(fs.existsSync);
                            content = ts.transpileModule(fs.readFileSync(source, "utf8"), { fileName: source,
                                compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
                                    jsx: ts.JsxEmit.React } }).outputText;
                        }
                        if (id === "webapp/src/backpackAssetEditor") {
                            // Target-independent block fixtures; retain real native fields,
                            // serialization, scratch project and ImageFieldEditor UI.
                            content += `
                                for (const [type, Field] of [["image_picker", pxtblockly.FieldSpriteEditor],
                                    ["melody_editor", pxtblockly.FieldCustomMelody]]) {
                                    Blockly.Blocks[type] = { init() {
                                        this.appendDummyInput().appendField(new Field("", {}), "img");
                                        this.setOutput(true);
                                    } };
                                }
                            `;
                        }
                        this.push(content); done();
                    }
                });
            }, { global: true }).bundle((error, data) => error ? reject(error) : resolve(data.toString()));
    });
}

describe("Backpack native asset popup", function () {
    this.timeout(30000);
    let browser, server, origin, page, errors;
    const dialog = ".project-backpack__asset-modal";
    const setup = `
        window.lf = pxt.Util.lf;
        pxt.AssetType = { Image: "image", Tile: "tile", Tilemap: "tilemap", Animation: "animation", Song: "song" };
        pxt.appTarget = { id: "arcade", versions: { target: "1", pxt: "2" }, appTheme: {}, runtime: { palette: [
            "#000000", "#ffffff", "#ff2121", "#ff93c4", "#ff8135", "#fff609", "#249ca3", "#78dc52",
            "#003fad", "#87f2ff", "#8e2ec4", "#a4839f", "#5c406c", "#e5cdc4", "#91463d", "#000000"
        ] } };
        pxt.tickEvent = () => {};
    `;

    before(async () => {
        const [host, iframe, styles] = await Promise.all([
            bundle("webapp/src/components/BackpackAssetEditDialog", "AssetPopup"),
            bundle("webapp/src/assetEditor", "NativeAssetEditor"),
            less.render("@blocklyWidgetDivZIndex: 1000;\n" + fs.readFileSync(path.join(root, "theme/project-backpack.less"), "utf8"))
        ]);
        const files = {
            "/pxtlib.js": fs.readFileSync(path.join(root, "built/pxtlib.js")),
            "/pxtsim.js": fs.readFileSync(path.join(root, "built/pxtsim.js")),
            "/semantic.css": fs.readFileSync(path.join(root, "built/web/semantic.css")),
            "/popup.css": styles.css, "/host.js": host, "/iframe.js": iframe,
            "/react.js": fs.readFileSync(require.resolve("react/umd/react.development.js")),
            "/react-dom.js": fs.readFileSync(require.resolve("react-dom/umd/react-dom.development.js")),
            "/": `<link rel="stylesheet" href="/popup.css"><button id="trigger">Edit</button>
                <div id="root"></div><p id="open-error" role="alert"></p>
                <div id="previous" aria-hidden="false"></div><div id="hidden" aria-hidden="true" inert></div>
                <script src="/pxtlib.js"></script><script>${setup}</script>
                <script src="/react.js"></script><script src="/react-dom.js"></script><script src="/host.js"></script>`,
            "/stale-asseteditor.html": `<script>
                const frameId = new URLSearchParams(location.search).get("frameid");
                const ready = () => parent.postMessage({ type: "iframeclientready", frameId }, "*");
                window.addEventListener("message", event => {
                    if (event.data.type === "iframeclientready") ready();
                    else if (event.data.type === "iframeclientsetmessageport") {
                        const port = event.ports[0];
                        port.onmessage = () => {}; // Old deployed editor silently ignores open-backpack.
                        port.postMessage({ type: "iframeclientsetmessageport" });
                        port.postMessage({ type: "event", kind: "ready" }); // No backpack capability.
                    }
                });
                ready();
                </script>`,
            "/asseteditor.html": `<link rel="stylesheet" href="/semantic.css">
                <style>html,body,#asset-editor-field-div{height:100%;margin:0}.image-editor-wrapper{border-radius:0}.image-editor-confirm{background:darkgreen}</style>
                <div id="asset-editor-field-div"></div><script src="/pxtlib.js"></script><script src="/pxtsim.js"></script>
                <script src="/react.js"></script><script src="/react-dom.js"></script>
                <script>${setup}</script><script src="/iframe.js"></script>`
        };
        server = http.createServer((req, res) => {
            const pathname = new URL(req.url, "http://localhost").pathname;
            const content = files[pathname];
            res.setHeader("Content-Type", pathname.endsWith(".js") ? "application/javascript"
                : pathname.endsWith(".css") ? "text/css" : "text/html");
            res.writeHead(content === undefined ? 404 : 200); res.end(content || "");
        });
        await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
        origin = `http://127.0.0.1:${server.address().port}`;
        browser = await launchTestBrowser();
    });
    after(async () => {
        if (browser) await browser.close();
        if (server) await new Promise(resolve => server.close(resolve));
    });
    beforeEach(async () => {
        page = await browser.newPage(); errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.setViewport({ width: 1000, height: 800 });
        await page.goto(origin);
        await page.evaluate(() => {
            const galleryProject = new pxt.TilemapProject();
            galleryProject.createNewProjectImage(new pxt.sprite.Bitmap(16, 16).data(), "galleryImage");
            const scratch = new pxt.TilemapProject();
            scratch.loadAssetsJRes(galleryProject.getProjectAssetsJRes(), true);
            window.popup = {
                saves: [], closes: 0, openErrors: [], fail: false, hold: false, url: "/asseteditor.html",
                item: { id: "fixed-backpack-id", name: "Backpack label", kind: "asset", createdAt: 1,
                    code: JSON.stringify({ blocks: [{ type: "image_picker", fields: { img: "img`2`" } }] }),
                    blockText: "image", dependencies: {}, versions: { target: "old", pxt: "old" } },
                context: { blocksInfo: { apis: { byQName: {} }, blocks: [], enums: {} },
                    gallery: scratch.saveGallerySnapshot(), palette: pxt.appTarget.runtime.palette }
            };
            popup.unmount = () => ReactDOM.unmountComponentAtNode(document.getElementById("root"));
            popup.mount = () => {
                pxt.webConfig = { asseteditorUrl: popup.url };
                document.getElementById("open-error").textContent = "";
                document.getElementById("trigger").focus();
                ReactDOM.render(React.createElement(AssetPopup.BackpackAssetEditDialog, {
                    item: popup.item, context: popup.context,
                    onClose: () => { popup.closes++; popup.unmount(); },
                    onOpenError: message => {
                        popup.openErrors.push(message);
                        popup.unmount();
                        document.getElementById("open-error").textContent = message;
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
    });
    afterEach(async () => {
        if (page) { await page.evaluate(() => popup.unmount()); await page.close(); }
        assert.deepStrictEqual(errors, []);
    });

    const mount = async () => {
        assert.deepStrictEqual(await page.evaluate(() => {
            popup.mount();
            const overlay = document.querySelector(".project-backpack__asset-modal-overlay");
            const frame = overlay.querySelector("iframe");
            return [getComputedStyle(overlay).visibility, frame.getAttribute("aria-hidden"), frame.tabIndex,
                document.getElementById("root").hasAttribute("inert"), document.activeElement.id,
                overlay.querySelectorAll("button, [role='status'], [role='alert']").length];
        }), ["hidden", "true", -1, false, "trigger", 0]);
    };
    const open = async () => {
        await mount();
        await page.waitForSelector(`${dialog} iframe[aria-busy="false"], #open-error:not(:empty)`);
        assert.equal(await page.$eval("#open-error", node => node.textContent), "", "Native editor failed to open");
        return (await page.$(`${dialog} iframe`)).contentFrame();
    };
    const closed = async () => {
        await page.waitForFunction(() => !document.querySelector(".project-backpack__asset-modal")
            && !document.getElementById("root").hasAttribute("aria-hidden") && document.activeElement.id === "trigger");
    };
    const startupFailed = async pattern => {
        // Real driver/iframe rejection must beat the unchanged 30-second startup timeout.
        await page.waitForFunction(() => popup.openErrors.length === 1, { timeout: 5000 });
        await closed();
        const message = await page.$eval("#open-error", node => node.textContent);
        assert.match(message, pattern);
        assert.deepStrictEqual(await page.evaluate(() => [popup.openErrors, popup.saves, popup.closes]), [[message], [], 0]);
        assert.equal(await page.$(".project-backpack__asset-modal-overlay"), null);
        assert.equal(await page.$('button[title="Retry"], button[title="Close"]'), null);
        assert.equal((await page.accessibility.snapshot({ root: await page.$("#open-error"), interestingOnly: false }))?.role, "alert");
    };

    it("shows native controls without outer chrome, saves a name with Done, and restores modal state", async () => {
        const frame = await open();
        assert.equal(await frame.evaluate(() => { try { localStorage.getItem("test"); return false; } catch { return true; } }), true);
        assert.equal(await page.$eval(`${dialog} iframe`, node => node.getAttribute("sandbox")), "allow-scripts");
        assert.equal(await page.$eval(dialog, node => node.getAttribute("role")), "dialog");
        assert.equal(await page.$eval("#root", node => node.hasAttribute("inert")), true);
        assert.equal(await page.$$eval(`${dialog} button, ${dialog} input, ${dialog} .common-modal-header`, nodes => nodes.length), 0);
        await frame.waitForSelector(".image-editor-change-name input");
        assert(await frame.$(".image-editor-close-button"));
        assert((await frame.$eval(".gallery-editor-header", node => node.textContent)).includes("Gallery"));
        await frame.type(".image-editor-change-name input", "renamedImage");
        await frame.click(".image-editor-confirm");
        await closed();
        const saved = await page.evaluate(() => popup.saves);
        assert.equal(saved.length, 1); assert.equal(saved[0].id, "fixed-backpack-id"); assert.equal(saved[0].name, "renamedImage");
        assert.equal(typeof JSON.parse(saved[0].code).blocks[0].fields.img, "object");
        assert.deepStrictEqual(await page.evaluate(() => [document.getElementById("previous").getAttribute("aria-hidden"),
            document.getElementById("hidden").getAttribute("aria-hidden"), document.getElementById("hidden").hasAttribute("inert")]), ["false", "true", true]);
    });

    it("retains the iframe draft on failure, coalesces native dismissals while pending, and retries", async () => {
        const frame = await open();
        await frame.type(".image-editor-change-name input", "retryImage");
        await page.evaluate(() => { popup.fail = true; popup.hold = true; });
        await frame.click(".image-editor-close-button");
        await page.waitForFunction(() => popup.saves.length === 1);
        await frame.evaluate(() => document.querySelector(".image-editor-confirm").click());
        await frame.evaluate(() => document.querySelector(".image-editor-close-button").click());
        await page.mouse.click(5, 5);
        await page.evaluate(() => popup.release());
        await page.waitForSelector(`${dialog} [role="alert"]`);
        assert.equal(await page.evaluate(() => popup.saves.length), 1);
        assert.equal(await frame.$eval(".image-editor-change-name input", node => node.value), "retryImage");
        await page.evaluate(() => { popup.fail = false; popup.hold = false; });
        await page.click(`${dialog} button[title="Retry"]`);
        await closed();
        assert.deepStrictEqual(await page.evaluate(() => popup.saves.map(item => [item.id, item.name])),
            [["fixed-backpack-id", "retryImage"], ["fixed-backpack-id", "retryImage"]]);
    });

    it("saves on native Escape and backdrop, with responsive native popup bounds", async () => {
        const frame = await open();
        const bounds = () => page.$eval(dialog, node => { const b = node.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; });
        assert.deepStrictEqual(await bounds(), [25, 25, 950, 750]);
        await page.setViewport({ width: 540, height: 800 });
        assert.deepStrictEqual(await bounds(), [0, 0, 540, 800]);
        await page.setViewport({ width: 1000, height: 600 });
        assert.deepStrictEqual(await bounds(), [0, 0, 1000, 600]);
        await frame.focus(".image-editor-confirm"); await page.keyboard.press("Escape");
        await closed();
        await page.setViewport({ width: 1000, height: 800 });
        await open(); await page.mouse.click(5, 5); await closed();
        assert.equal(await page.evaluate(() => popup.saves.length), 2);
    });

    it("reports failed startup to the parent and ignores a save response after unmount", async () => {
        await page.evaluate(() => { popup.item.code = "invalid"; });
        await mount();
        await startupFailed(/saved asset could not be opened.*block definition or required asset data is unavailable/);
        await page.evaluate(() => {
            popup.item.code = JSON.stringify({ blocks: [{ type: "image_picker", fields: { img: "img`2`" } }] });
        });
        await open();
        // Backdrop starts the async request; unmount synchronously before its port response.
        await page.evaluate(() => {
            document.querySelector(".project-backpack__asset-modal-overlay").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            popup.unmount();
        });
        await closed();
        assert.equal(await page.evaluate(() => popup.saves.length), 0);
    });

    it("rejects a stale deployed iframe without Backpack support immediately after its port handshake", async () => {
        await page.evaluate(() => { popup.url = "/stale-asseteditor.html"; });
        await mount();
        await startupFailed(/different build.*cannot open Backpack assets.*matching asset-editor build/);
    });

    it("keeps an iframe Done control after the native scalar melody popup closes", async () => {
        await page.evaluate(() => {
            popup.item.code = JSON.stringify({ blocks: [{ type: "melody_editor", fields: { img: '"C D E F G A B C5"' } }] });
        });
        const frame = await open();
        await frame.waitForSelector("#melody-content-div");
        await frame.click(".melody-confirm-button");
        await frame.click(".image-editor-confirm");
        await closed();
        assert.equal(await page.evaluate(() => popup.saves[0].name), "Backpack label");
    });
});