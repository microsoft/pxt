"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

// Extract only the integration methods from current source: no editor bundle,
// React/Blockly runtime, real requirement engine, storage, or network is needed.
const filename = path.resolve(__dirname, "../../webapp/src/blocks.tsx");
const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["backpackAvailable", "saveBlockToBackpackAsync", "importFromBackpackAsync", "createSnippetHost"];
const classes = [];
function visit(node) {
    if (ts.isClassDeclaration(node) && names.every(name => node.members.some(member =>
        ts.isMethodDeclaration(member) && member.name.getText(source) === name))) classes.push(node);
    ts.forEachChild(node, visit);
}
visit(source);
assert.strictEqual(classes.length, 1, "Expected one editor class containing the backpack methods");
const methods = names.map(name => classes[0].members.find(member =>
    ts.isMethodDeclaration(member) && member.name.getText(source) === name).getText(source));
const compiled = ts.transpileModule(`class SourceEditor { ${methods.join("\n")} } exports.SourceEditor = SourceEditor;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true
});
assert.deepStrictEqual(compiled.diagnostics, []);

const previewSource = fs.readFileSync(path.resolve(__dirname, "../../webapp/src/backpackPreview.ts"), "utf8");
const compiledPreview = ts.transpileModule(previewSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true
});
assert.deepStrictEqual(compiledPreview.diagnostics, []);

const clone = value => JSON.parse(JSON.stringify(value));
const enabledSource = ts.createSourceFile("backpack.ts", fs.readFileSync(path.resolve(__dirname, "../../webapp/src/backpack.ts"), "utf8"), ts.ScriptTarget.Latest, true);
const enabledFunction = enabledSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "isBackpackEnabled");
const compiledEnabled = ts.transpileModule(enabledFunction.getText(enabledSource), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function environment(user, type = "controls_repeat_ext") {
    const events = [];
    const hooks = {};
    const saves = [];
    const dialogs = [];
    const notifications = [];
    const opens = [];
    const imports = [];
    const logins = [];
    const state = { user, readOnly: false, blocksActive: true, guidCount: 0, identity: true, tutorial: false };
    const block = { id: "source-block", type, data: { text: "unchanged" } };
    const versions = { target: "2.0.1-beta.2+target", pxt: "12.0.3-dev.4+pxt" };
    const code = JSON.stringify({ blocks: [{ type }] });
    const blockText = "repeat four times PRIVATE_BODY_TEXT Displayed choice backpackImage";
    const requirements = { dependencies: { extension: "github:owner/extension#v1.0.0" }, projectBlocks: {} };
    const previewUri = "data:image/png;base64,iVBORw0KGgo=";
    const preview = { previewUri, previewPixelDensity: 2 };
    const importedItem = { id: "00000000-0000-4000-8000-000000000001", name: "Imported snippet",
        kind: "code", versions, code, blockText, ...requirements, createdAt: 1 };
    const mainPkg = {};
    const step = (name, fallback) => {
        events.push(name);
        return hooks[name] ? hooks[name]() : fallback;
    };
    const exports = {};
    const pxt = {
        shell: { isReadOnly: () => state.readOnly },
        appTarget: { id: "arcade", appTheme: { backpack: true }, versions },
        auth: { hasIdentity: () => state.identity,
            isBackpackAssetType: type => ["image_picker", "animation_editor", "music_song_field_editor"].includes(type) },
        U: { guidGen: () => `snippet-${++state.guidCount}` }
    };
    const context = vm.createContext({
        exports, Error, pxt,
        lf: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]),
        document: { getElementById: id => {
            assert.strictEqual(id, "project-tools-tab-backpack");
            return {};
        } },
        auth: { loggedIn: () => !!state.user, userProfile: () => state.user ? { id: state.user } : undefined },
        pkg: { mainPkg },
        pxtblockly: {
            captureBackpackBlock: actual => { assert.strictEqual(actual, block); return step("capture", { code, blockText }); },
            getBlockText: actual => { assert.strictEqual(actual, block); return "  repeat\n  four times  "; }
        },
        getBackpackRequirements: (actual, info, pkg) => {
            assert.strictEqual(actual, code);
            assert.strictEqual(info, editor.blockInfo);
            assert.strictEqual(pkg, mainPkg);
            return step("requirements", requirements);
        },
        backpackPreviewAsync: async actual => {
            assert.strictEqual(actual, block);
            return step("preview", preview);
        },
        backpack: {
            isBackpackEnabled: () => exports.isBackpackEnabled(),
            validateBackpackItem: item => {
                assert.strictEqual(item.code, code);
                assert.strictEqual(item.blockText, blockText);
                step("validate");
            },
            saveBackpackItemAsync: async item => {
                saves.push({ item, user: state.user });
                return step("store");
            },
            requestBackpackOpen: (...args) => { opens.push(args); step("open"); }
        },
        core: {
            confirmAsync: async options => { dialogs.push(options); return step("confirm", 0); },
            infoNotification: message => { notifications.push(message); step("notify"); }
        },
        addBackpackToProjectAsync: async (item, host, position) => {
            imports.push({ item, host, position });
            return step("import", true);
        }
    });
    vm.runInContext(compiledEnabled, context);
    vm.runInContext(compiled.outputText, context, { filename: "backpack-editor.extracted.js" });
    const editor = new exports.SourceEditor();
    Object.assign(editor, {
        isVisible: true, blockInfo: {}, editor: {}, loadingXml: false, delayLoadXml: false,
        domUpdate: () => step("dom"),
        parent: {
            state: { header: { id: "source-project" } },
            isBlocksActive: () => state.blocksActive,
            isTutorial: () => state.tutorial,
            showLoginDialog: (...args) => logins.push(args),
            saveProjectAsync: async () => step("project-save"),
            reloadHeaderAsync: async () => step("reload")
        }
    });
    return {
        editor, state, block, code, blockText, importedItem, requirements, preview, events, hooks, saves, pxt, versions,
        dialogs, notifications, opens, imports, logins,
        save: () => editor.saveBlockToBackpackAsync(block),
        import: (item, position) => editor.importFromBackpackAsync(item, position),
        hold(name) {
            const gate = deferred();
            const entered = deferred();
            hooks[name] = () => { entered.resolve(); return gate.promise; };
            return { ...gate, entered: entered.promise };
        }
    };
}

describe("backpack editor integration (fresh source)", () => {
    for (const user of [undefined, "account-A"]) {
        const mode = user ? "signed-in" : "guest";
        it(`${mode} context save captures the snippet, awaits durable storage, and opens without consuming its source`, async () => {
            const e = environment(user);
            const original = clone(e.block);
            const gate = e.hold("store");
            const pending = e.save();
            await gate.entered;
            assert.deepStrictEqual(e.events, ["capture", "requirements", "preview", "validate", "store"]);
            assert.deepStrictEqual(e.logins, []);
            assert.deepStrictEqual(e.dialogs, []);
            assert.deepStrictEqual(e.notifications, []);
            assert.deepStrictEqual(e.opens, []);
            assert.strictEqual(e.saves[0].user, user);
            const item = e.saves[0].item;
            assert.deepStrictEqual(clone(item), {
                id: "snippet-1", name: "repeat four times", code: e.code, blockText: e.blockText,
                kind: "code", versions: e.versions,
                ...e.requirements, createdAt: item.createdAt, ...e.preview
            });
            assert(Number.isFinite(item.createdAt));
            gate.resolve();
            await pending;
            assert.deepStrictEqual(e.notifications, ["Added repeat four times to Backpack."]);
            assert.deepStrictEqual(e.opens, [["source-project", false, "code"]]);
            assert.deepStrictEqual(e.block, original);
            assert.deepStrictEqual(e.events.slice(-2), ["notify", "open"]);
        });
    }

    it("storage retry reuses the exact captured item and UUID without recapturing", async () => {
        const e = environment("account-A");
        e.hooks.store = () => {
            if (e.saves.length === 1) throw new Error("Durable save failed");
        };
        e.hooks.confirm = () => {
            e.block.data.text = "edited while retrying";
            e.hooks.capture = () => { throw new Error("Must reuse the original capture"); };
            return 1;
        };
        await e.save();
        assert.strictEqual(e.saves.length, 2);
        assert.strictEqual(e.saves[0].item, e.saves[1].item);
        assert.strictEqual(e.saves[1].item.blockText, e.blockText);
        assert.strictEqual(e.state.guidCount, 1);
        assert.deepStrictEqual(e.events, ["capture", "requirements", "preview", "validate", "store", "confirm", "store", "notify", "open"]);
        assert.strictEqual(e.dialogs[0].header, "Backpack was not saved");
        assert.strictEqual(e.dialogs[0].body, "Durable save failed");
        assert.strictEqual(e.dialogs[0].agreeLbl, "Retry");
    });

    it("saves and imports usable code when optional preview capture fails", async () => {
        const e = environment();
        const original = clone(e.block);
        const exports = {};
        let removed = 0;
        const context = vm.createContext({ exports,
            require: name => {
                assert.ok(["blockly", "../../pxtblocks", "./backpack"].includes(name));
                return {};
            },
            document: { createElementNS: () => ({ remove: () => { removed++; } }) }
        });
        vm.runInContext(compiledPreview.outputText, context);
        // Exercise the real helper's undefined contract, including its caught failure path.
        e.hooks.preview = () => exports.backpackPreviewAsync({ getSvgRoot: () => ({
            cloneNode: () => { throw new Error("Thumbnail capture failed"); }
        }) });
        await e.save();
        assert.strictEqual(e.saves.length, 1);
        const saved = e.saves[0].item;
        assert.deepStrictEqual(clone(saved), {
            id: "snippet-1", name: "repeat four times", code: e.code, blockText: e.blockText,
            kind: "code", versions: e.versions,
            ...e.requirements, createdAt: saved.createdAt
        });
        assert.strictEqual(Object.prototype.hasOwnProperty.call(saved, "previewUri"), false);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(saved, "previewPixelDensity"), false);
        assert.strictEqual(await e.import(saved), true);
        assert.strictEqual(e.imports[0].item, saved);
        assert.deepStrictEqual(e.dialogs, []);
        assert.deepStrictEqual(e.notifications, ["Added repeat four times to Backpack."]);
        assert.deepStrictEqual(e.opens, [["source-project", false, "code"]]);
        assert.deepStrictEqual(e.block, original);
        assert.strictEqual(removed, 1);
    });

    it("guards save/import for project, tutorial, read-only and editor mode restrictions", async () => {
        for (const change of [
            e => { e.editor.parent.state.header = undefined; },
            e => { e.editor.parent.state.header.tutorial = {}; },
            e => { Object.assign(e.editor.parent.state.header, { tutorial: {}, tutorialCompleted: true }); },
            e => { e.state.tutorial = true; },
            e => { e.pxt.appTarget.appTheme.backpack = false; },
            e => { e.state.identity = false; },
            e => { e.state.readOnly = true; },
            e => { e.state.blocksActive = false; }
        ]) {
            const e = environment();
            change(e);
            assert.strictEqual(e.editor.backpackAvailable(), false);
            await e.save();
            await assert.rejects(e.import({}), /Open an editable Blocks project/);
            assert.deepStrictEqual(e.events, []);
            assert.deepStrictEqual(e.logins, []);
        }
    });

    it("stores standalone assets as raw code with build metadata, no PNG, and opens the asset tab", async () => {
        const e = environment(undefined, "image_picker");
        await e.save();
        assert.deepStrictEqual(e.events, ["capture", "requirements", "validate", "store", "notify", "open"]);
        assert.deepStrictEqual(clone(e.saves[0].item), { id: "snippet-1", name: "repeat four times",
            kind: "asset", versions: e.versions, code: e.code, blockText: e.blockText,
            ...e.requirements, createdAt: e.saves[0].item.createdAt });
        assert.deepStrictEqual(e.opens, [["source-project", false, "asset"]]);
    });

    it("allows asset capture and insertion in tutorials while rejecting code, including late transitions", async () => {
        for (const mode of ["header", "active"]) {
            const e = environment("account-A", "image_picker");
            if (mode === "header") e.editor.parent.state.header.tutorial = {};
            else e.state.tutorial = true;
            assert.equal(e.editor.backpackAvailable("asset"), true);
            assert.equal(e.editor.backpackAvailable("code"), false);
            await e.save();
            assert.equal(e.saves[0].item.kind, "asset");
            assert.equal(await e.import(e.saves[0].item), true);
            assert.equal(e.imports[0].host.isCurrent(), true);
            await assert.rejects(e.import(e.importedItem), /editable Blocks project/);
            e.state.readOnly = true;
            assert.equal(e.editor.backpackAvailable("asset"), false);
        }
    });

    // Storage owns away-and-back generation invalidation; backpack-storage.spec.js
    // exercises A -> B -> A against the real store. These are the editor's identity checks.
    for (const stage of ["preview", "store"]) {
        it(`direct account A to B switch during ${stage} stops routing, retry and notification`, async () => {
            const e = environment("account-A");
            const gate = e.hold(stage);
            const pending = e.save();
            await gate.entered;
            e.state.user = "account-B";
            if (stage === "store") gate.reject(new Error("Operation failed"));
            else gate.resolve(e.preview);
            await pending;
            assert.strictEqual(e.saves.length, stage === "store" ? 1 : 0);
            if (e.saves.length) assert.strictEqual(e.saves[0].user, "account-A");
            assert.strictEqual(e.events.filter(event => event === "capture").length, 1);
            assert.deepStrictEqual(e.dialogs, []);
            assert.deepStrictEqual(e.notifications, []);
            assert.deepStrictEqual(e.opens, []);
            assert.deepStrictEqual(e.logins, []);
        });
    }

    it("canceling a failed save does not retry or announce success", async () => {
        const e = environment();
        e.hooks.store = () => { throw new Error("Save failed"); };
        await e.save();
        assert.strictEqual(e.saves.length, 1);
        assert.strictEqual(e.dialogs.length, 1);
        assert.deepStrictEqual(e.notifications, []);
        assert.deepStrictEqual(e.opens, []);
    });

    it("does not open the backpack in a different project after storage completes", async () => {
        const e = environment();
        const gate = e.hold("store");
        const pending = e.save();
        await gate.entered;
        e.editor.parent.state.header = { id: "other-project" };
        gate.resolve();
        await pending;
        assert.strictEqual(e.saves.length, 1);
        assert.deepStrictEqual(e.opens, []);
    });

    it("captured import hosts invalidate on project or identity changes, but allow same-project reload", async () => {
        for (const change of [
            e => { e.editor.parent.state.header = { id: "other-project" }; },
            e => { e.state.user = "account-B"; },
            e => { e.editor.parent.state.header.tutorial = {}; },
            e => { e.state.tutorial = true; },
            e => { e.pxt.appTarget.appTheme.backpack = false; },
            e => { e.state.identity = false; }
        ]) {
            const e = environment("account-A");
            const gate = e.hold("import");
            const position = { x: 321, y: 234 };
            const pending = e.import(e.importedItem, position);
            await gate.entered;
            assert.strictEqual(e.imports[0].position, position);
            const host = e.imports[0].host;
            e.editor.parent.state.header = { id: "source-project" };
            e.editor.loadingXml = true;
            assert.strictEqual(host.isCurrent(), true, "same-project extension reload remains valid");
            change(e);
            assert.strictEqual(host.isCurrent(), false);
            gate.resolve(false);
            await pending;
        }
    });
});