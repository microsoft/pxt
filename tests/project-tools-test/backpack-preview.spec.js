"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { launchTestBrowser } = require("./browser");

const root = path.resolve(__dirname, "../..");
const source = file => ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018 }
}).outputText;

describe("Backpack high-density previews", function () {
    this.timeout(30000);
    let browser;
    let page;
    before(async () => { browser = await launchTestBrowser(); });
    after(async () => { await browser?.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        await page.setContent('<div id="workspace" style="width:900px;height:650px"></div>');
        const blocklyDirectory = path.dirname(require.resolve("blockly"));
        for (const file of ["blockly_compressed.js", "blocks_compressed.js", "msg/en.js"]) {
            await page.addScriptTag({ path: path.join(blocklyDirectory, file) });
        }
        await page.addScriptTag({ path: path.join(root, "built/pxtlib.js") });
        await page.evaluate(({ layoutSource, previewSource, storageSource }) => {
            window.lf = pxt.Util.lf;
            const load = (code, dependencies) => {
                const exports = {};
                new Function("require", "exports", code)(id => dependencies[id] || {}, exports);
                return exports;
            };
            const storage = load(storageSource, {});
            const layout = load(layoutSource, { blockly: Blockly });
            const preview = load(previewSource, { "../../pxtblocks": layout, "./backpack": storage });
            pxt.appTarget = { id: "arcade", appTheme: {} };
            const workspace = Blockly.inject("workspace", { renderer: "zelos" });
            const block = Blockly.serialization.blocks.append({ type: "controls_repeat_ext", inputs: {
                TIMES: { shadow: { type: "math_number", fields: { NUM: 37 } } },
                DO: { block: { type: "text_print", inputs: { TEXT: { block: { type: "text", fields: { TEXT: "Hello sharp text" } } } } } }
            } }, workspace);
            const next = Blockly.serialization.blocks.append({ type: "text_print", inputs: {
                TEXT: { block: { type: "text", fields: { TEXT: "EXCLUDED_FOLLOWING_BLOCK" } } }
            } }, workspace);
            block.nextConnection.connect(next.previousConnection);
            const originalEncode = pxt.BrowserUtils.encodeToPngAsync;
            const originalRender = layout.blocklyToSvgAsync;
            window.previewTest = { workspace, block, next, storage, layout, originalEncode, originalRender,
                capture: () => preview.backpackPreviewAsync(block),
                dimensions: async uri => {
                    const image = new Image();
                    image.src = uri;
                    await image.decode();
                    return { width: image.naturalWidth, height: image.naturalHeight };
                },
                settle: () => Blockly.renderManagement.finishQueuedRenders()
            };
        }, { layoutSource: source("pxtblocks/layout.ts"), previewSource: source("webapp/src/backpackPreview.ts"),
            storageSource: source("webapp/src/backpack.ts") });
        await page.evaluate(() => window.previewTest.settle());
    });
    afterEach(async () => {
        if (!page || page.isClosed()) return;
        await page.evaluate(() => window.previewTest.workspace.dispose());
        await page.close();
    });

    it("rasterizes at 2x within the byte budget without source mutation or following blocks", async () => {
        const result = await page.evaluate(async () => {
            const test = window.previewTest;
            const before = test.block.getSvgRoot().outerHTML;
            const blocks = test.workspace.getAllBlocks(false).map(block => block.id);
            let logicalSize;
            let renderedSvg;
            test.layout.blocklyToSvgAsync = async (...args) => {
                const result = await test.originalRender(...args);
                logicalSize = { width: result.width, height: result.height };
                renderedSvg = result.svg;
                return result;
            };
            const preview = await test.capture();
            return { density: preview.previewPixelDensity, length: preview.previewUri.length,
                dimensions: await test.dimensions(preview.previewUri), logicalSize,
                png: preview.previewUri.startsWith("data:image/png;base64,iVBORw0KGgo"),
                unchanged: before === test.block.getSvgRoot().outerHTML,
                sameBlocks: JSON.stringify(blocks) === JSON.stringify(test.workspace.getAllBlocks(false).map(block => block.id)),
                containsBody: renderedSvg.includes("Hello sharp text"), containsNext: renderedSvg.includes("EXCLUDED_FOLLOWING_BLOCK"),
                leakedCopies: document.querySelectorAll('body > svg[aria-hidden="true"]').length,
                max: test.storage.MAX_BACKPACK_PREVIEW_LENGTH };
        });
        assert.equal(result.density, 2);
        assert(result.png && result.length <= result.max);
        assert(result.logicalSize.width <= 320 && result.logicalSize.height <= 160);
        assert.deepStrictEqual(result.dimensions, { width: result.logicalSize.width * 2, height: result.logicalSize.height * 2 });
        assert(result.unchanged && result.sameBlocks && result.containsBody);
        assert.equal(result.containsNext, false);
        assert.equal(result.leakedCopies, 0);
    });

    for (const acceptedDensity of [1.5, 1]) {
        it(`redraws from the SVG at ${acceptedDensity}x when a denser PNG exceeds the budget`, async () => {
            const result = await page.evaluate(async acceptedDensity => {
                const test = window.previewTest;
                const calls = [];
                pxt.BrowserUtils.encodeToPngAsync = async (uri, options) => {
                    calls.push({ uri, density: options.pixelDensity });
                    return options.pixelDensity > acceptedDensity ? "x".repeat(test.storage.MAX_BACKPACK_PREVIEW_LENGTH + 1)
                        : test.originalEncode(uri, options);
                };
                const preview = await test.capture();
                return { density: preview.previewPixelDensity, length: preview.previewUri.length,
                    calls: calls.map(call => call.density), sameSvg: new Set(calls.map(call => call.uri)).size === 1,
                    max: test.storage.MAX_BACKPACK_PREVIEW_LENGTH };
            }, acceptedDensity);
            assert.equal(result.density, acceptedDensity);
            assert.deepStrictEqual(result.calls, acceptedDensity === 1.5 ? [2, 1.5] : [2, 1.5, 1]);
            assert(result.sameSvg && result.length <= result.max);
        });
    }

    for (const failure of ["missing SVG", "empty SVG", "SVG failure", "PNG failure", "PNG unavailable", "all oversized"]) {
        it(`leaves capture optional and cleans up detached SVGs after ${failure}`, async () => {
            assert.deepStrictEqual(await page.evaluate(async failure => {
                const test = window.previewTest;
                const getSvgRoot = test.block.getSvgRoot;
                const before = test.block.getSvgRoot().outerHTML;
                let result;
                try {
                    if (failure === "missing SVG") test.block.getSvgRoot = () => null;
                    if (failure === "empty SVG") test.block.getSvgRoot = () => document.createElementNS("http://www.w3.org/2000/svg", "g");
                    if (failure === "SVG failure") test.layout.blocklyToSvgAsync = async () => { throw new Error("SVG failed"); };
                    if (failure === "PNG failure") pxt.BrowserUtils.encodeToPngAsync = async () => { throw new Error("PNG failed"); };
                    if (failure === "PNG unavailable") pxt.BrowserUtils.encodeToPngAsync = async () => undefined;
                    if (failure === "all oversized") pxt.BrowserUtils.encodeToPngAsync = async () => "x".repeat(test.storage.MAX_BACKPACK_PREVIEW_LENGTH + 1);
                    result = await test.capture();
                } finally { test.block.getSvgRoot = getSvgRoot; }
                return { omitted: result === undefined, leakedCopies: document.querySelectorAll('body > svg[aria-hidden="true"]').length,
                    unchanged: test.block.getSvgRoot().outerHTML === before };
            }, failure), { omitted: true, leakedCopies: 0, unchanged: true });
        });
    }
});