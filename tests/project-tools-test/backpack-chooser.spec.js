"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const less = require("less");
const { launchTestBrowser } = require("./browser");
const { bundleSource } = require("./source");
const ts = require("typescript");

describe("Backpack asset chooser", function () {
    this.timeout(30000);
    let browser;
    let page;
    let bundle;
    let css;

    before(async () => {
        bundle = bundleSource(["webapp/src/backpackAssetChooser.tsx"], "assetChooser");
        const imports = [
            "react-common/styles/react-common-variables.less",
            "react-common/styles/controls/Button.less",
            "react-common/styles/controls/Modal.less",
            "theme/project-backpack.less"
        ].map(file => `@import "${path.resolve(file).replace(/\\/g, "/")}";`).join("\n");
        css = (await less.render(imports, { modifyVars: {
            pageFont: "sans-serif", textColor: "#000", white: "#fff",
            modalDimmerZIndex: "1000", modalFullscreenZIndex: "1001", blocklyWidgetDivZIndex: "1002",
            tabletAndBelow: "~'only screen and (max-width: 991px)'"
        } })).css;
        browser = await launchTestBrowser();
    });
    after(async () => { await browser?.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844 });
        await page.setContent('<button id="trigger">Add to Backpack</button><button id="outside">Outside</button>');
        await page.addStyleTag({ content: `:root {
            --pxt-neutral-background1: #fff; --pxt-neutral-foreground1: #000;
            --pxt-neutral-background2: #eee; --pxt-neutral-foreground2: #000;
            --pxt-neutral-foreground3: #666; --pxt-neutral-alpha50: rgba(0,0,0,.5);
            --pxt-focus-border: #0078d4; } ${css}` });
        await page.addScriptTag({ path: require.resolve("react/umd/react.development.js") });
        await page.addScriptTag({ path: require.resolve("react-dom/umd/react-dom.development.js") });
        await page.evaluate(() => {
            window.lf = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, n) => args[n]);
            window.pxt = { Util: { guidGen: () => "test-chooser", isUserLanguageRtl: () => false } };
        });
        await page.addScriptTag({ content: bundle });
        await page.focus("#trigger");
        await page.evaluate(() => {
            window.result = "pending";
            window.options = ["Left image", "Right image", "Third image"].map((label, index) => ({
                fieldName: "ASSET" + index, label, name: "Saved image " + index
            }));
            assetChooser.chooseBackpackAssetAsync(options).then(value => { window.result = value || "cancelled"; });
        });
        await page.waitForSelector(".backpack-asset-chooser", { visible: true });
    });
    afterEach(async () => { await page?.close(); });

    it("selects any asset with the keyboard and restores focus without leaving a modal host", async () => {
        assert.equal(await page.$$eval(".backpack-asset-choice", buttons => buttons.length), 3);
        await page.focus(".backpack-asset-choice");
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Save Right image to Backpack");
        assert.equal(await page.$eval(".backpack-asset-choice:focus", button => getComputedStyle(button).outlineWidth), "3px");
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => result === "ASSET1" && document.activeElement.id === "trigger");
        assert.equal(await page.$(".backpack-asset-chooser"), null);
        assert.equal(await page.$$eval("body > div", elements => elements.length), 0);
    });

    it("cancels on Escape without choosing an asset", async () => {
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => result === "cancelled" && document.activeElement.id === "trigger");
        assert.equal(await page.$(".backpack-asset-chooser"), null);
        assert.equal(await page.$eval("#outside", element => element.hasAttribute("aria-hidden")), false);
    });

    it("traps focus and cancels through the labelled Cancel action", async () => {
        for (let i = 0; i < 8; i++) {
            await page.keyboard.press("Tab");
            assert(await page.evaluate(() => !!document.activeElement.closest(".backpack-asset-chooser")));
        }
        await page.focus(".common-modal-footer button");
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => result === "cancelled");
    });
});

describe("Backpack asset capture routing", () => {
    const file = ts.createSourceFile("blocks.tsx", fs.readFileSync("webapp/src/blocks.tsx", "utf8"),
        ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const editorClass = file.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "Editor");
    const method = editorClass.members.find(node => node.name?.getText(file) === "saveBlockToBackpackAsync");
    assert(method);
    const code = ts.transpileModule(`class Editor { ${method.getText(file)} } exports.Editor = Editor;`, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;

    function environment(kind = "asset") {
        const saved = [];
        const captures = [];
        const dialogs = [];
        const state = { kind, standalone: false, eligible: true, user: "alice", selected: "RIGHT", choices: [],
            chooser: undefined, captureError: undefined, previews: 0 };
        class AssetField {
            constructor(name) { this.name = name; }
            getAsset() { return { meta: { displayName: this.name + " image" } }; }
        }
        const fields = [new AssetField("LEFT"), new AssetField("RIGHT")];
        const pxt = {
            appTarget: { id: "arcade", versions: { target: "1.0.0", pxt: "13.2.5" } },
            U: { guidGen: () => "capture-id" },
            cloneAsset: asset => asset,
            blocks: { compileInfo: () => ({ definitionNameToParam: {
                LEFT: { label: "Left image" }, RIGHT: { label: "Right image" }
            } }) }
        };
        const globals = {
            pxt, pxtc: {}, pkg: { mainPkg: {} },
            lf: text => text, assetToGalleryItem: () => ({ previewURI: "data:image/png;base64,preview" }),
            auth: { loggedIn: () => true, userProfile: () => ({ id: state.user }) },
            pxtblockly: {
                FieldAssetEditor: AssetField,
                getBackpackCaptureKind: () => state.kind,
                getBackpackAssetField: () => state.standalone ? fields[0] : undefined,
                getBackpackAssetFields: () => fields,
                getBlockText: () => "Two asset block",
                captureBackpackBlock: () => { captures.push("block"); return { code: "entire-block", blockText: "block" }; },
                captureBackpackAsset: field => { captures.push(field.name); return { code: field.name, blockText: field.name, name: field.name }; }
            },
            backpack: {
                validateBackpackItem: () => {},
                saveBackpackItemAsync: async item => saved.push(item),
                requestBackpackOpen: () => {}
            },
            getBackpackRequirements: () => {
                if (state.captureError) throw state.captureError;
                return { dependencies: {} };
            },
            backpackPreviewAsync: async () => { ++state.previews; return {}; },
            backpackUserErrorMessage: error => error.message,
            core: { infoNotification: () => {}, confirmAsync: async options => {
                if (!state.captureError) throw new Error(options.body);
                dialogs.push(options);
                return 0;
            } },
            chooseBackpackAssetAsync: async choices => {
                state.choices = choices;
                if (state.chooser) return state.chooser();
                return state.selected;
            }
        };
        const exports = {};
        new Function("exports", ...Object.keys(globals), code)(exports, ...Object.values(globals));
        const editor = new exports.Editor();
        editor.parent = { state: { header: { id: "project" } } };
        editor.blockInfo = { blocksById: { pair: {} } };
        editor.editor = {};
        editor.backpackAvailable = () => state.eligible;
        const block = { type: "pair", workspace: editor.editor, isDisposed: () => false };
        return { state, editor, block, saved, captures, dialogs, run: () => editor.saveBlockToBackpackAsync(block) };
    }

    it("keeps a container's complete Code capture even when it has two assets", async () => {
        const e = environment("code");
        await e.run();
        assert.deepStrictEqual(e.state.choices, []);
        assert.deepStrictEqual(e.captures, ["block"]);
        assert.equal(e.saved[0].kind, "code");
    });

    it("shows capture guidance without creating a preview or saving a nonportable code capture", async () => {
        const e = environment("code");
        e.state.captureError = Object.assign(new Error("Publish the blocks from custom.ts as an extension first."), {
            isUserError: true
        });
        await e.run();
        assert.deepStrictEqual(e.saved, []);
        assert.equal(e.state.previews, 0);
        assert.equal(e.dialogs.length, 1);
        assert.equal(e.dialogs[0].header, "Cannot save this snippet");
        assert.equal(e.dialogs[0].body, e.state.captureError.message);
        assert.equal(e.dialogs[0].hideCancel, true);
    });

    it("saves only the selected field and supplies both labels and previews", async () => {
        const e = environment();
        await e.run();
        assert.deepStrictEqual(e.state.choices.map(choice => choice.label), ["Left image", "Right image"]);
        assert(e.state.choices.every(choice => choice.previewURI));
        assert.deepStrictEqual(e.captures, ["RIGHT"]);
        assert.equal(e.saved.length, 1);
        assert.equal(e.saved[0].kind, "asset");
        assert.equal(e.saved[0].code, "RIGHT");
        assert.equal(e.editor.choosingBackpackAsset, false);
    });

    it("cancels without saving and keeps standalone asset capture unchanged", async () => {
        const e = environment();
        e.state.selected = undefined;
        await e.run();
        assert.deepStrictEqual(e.saved, []);
        assert.deepStrictEqual(e.captures, []);
        e.state.standalone = true;
        await e.run();
        assert.deepStrictEqual(e.captures, ["block"]);
        assert.equal(e.saved[0].kind, "asset");
    });

    it("abandons the selection after a project/account change and ignores overlapping chooser requests", async () => {
        const e = environment();
        let resolve;
        e.state.chooser = () => new Promise(done => { resolve = done; });
        const pending = e.run();
        assert.equal(e.editor.choosingBackpackAsset, true);
        await e.run();
        assert.deepStrictEqual(e.saved, []);
        e.editor.parent.state.header.id = "different-project";
        e.state.user = "bob";
        resolve("LEFT");
        await pending;
        assert.deepStrictEqual(e.captures, []);
        assert.deepStrictEqual(e.saved, []);
        assert.equal(e.editor.choosingBackpackAsset, false);
    });
});
