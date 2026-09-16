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
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function environment(user) {
    const events = [];
    const hooks = {};
    const saves = [];
    const dialogs = [];
    const notifications = [];
    const opens = [];
    const imports = [];
    const logins = [];
    const state = { user, readOnly: false, blocksActive: true, tab: true, guidCount: 0 };
    const block = { id: "source-block", data: { text: "unchanged" } };
    const code = '{"blocks":[{"type":"controls_repeat_ext"}]}';
    const blockText = "repeat four times PRIVATE_BODY_TEXT Displayed choice backpackImage";
    const requirements = { dependencies: { extension: "github:owner/extension#v1.0.0" }, projectBlocks: {} };
    const previewUri = "data:image/png;base64,iVBORw0KGgo=";
    const preview = { previewUri, previewPixelDensity: 2 };
    const importedItem = { id: "00000000-0000-4000-8000-000000000001", name: "Imported snippet",
        code, blockText, ...requirements, createdAt: 1 };
    const mainPkg = {};
    const step = (name, fallback) => {
        events.push(name);
        return hooks[name] ? hooks[name]() : fallback;
    };
    const exports = {};
    const pxt = {
        shell: { isReadOnly: () => state.readOnly },
        appTarget: { appTheme: {} },
        U: { guidGen: () => `snippet-${++state.guidCount}` }
    };
    const context = vm.createContext({
        exports, Error, pxt,
        lf: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]),
        document: { getElementById: id => {
            assert.strictEqual(id, "project-tools-tab-backpack");
            return state.tab ? {} : null;
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
        addBackpackToProjectAsync: async (item, host) => {
            imports.push({ item, host });
            return step("import", true);
        }
    });
    vm.runInContext(compiled.outputText, context, { filename: "backpack-editor.extracted.js" });
    const editor = new exports.SourceEditor();
    Object.assign(editor, {
        isVisible: true, blockInfo: {}, editor: {}, loadingXml: false, delayLoadXml: false,
        domUpdate: () => step("dom"),
        parent: {
            state: { header: { id: "source-project" } },
            isBlocksActive: () => state.blocksActive,
            showLoginDialog: (...args) => logins.push(args),
            saveProjectAsync: async () => step("project-save"),
            reloadHeaderAsync: async () => step("reload")
        }
    });
    return {
        editor, state, pxt, block, code, blockText, importedItem, requirements, preview, events, hooks, saves,
        dialogs, notifications, opens, imports, logins,
        save: () => editor.saveBlockToBackpackAsync(block),
        import: item => editor.importFromBackpackAsync(item),
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
                ...e.requirements, createdAt: item.createdAt, ...e.preview
            });
            assert(Number.isFinite(item.createdAt));
            gate.resolve();
            await pending;
            assert.deepStrictEqual(e.notifications, ["Added repeat four times to Backpack."]);
            assert.deepStrictEqual(e.opens, [["source-project", false]]);
            assert.deepStrictEqual(e.block, original);
            assert.deepStrictEqual(e.events.slice(-2), ["notify", "open"]);
        });

        it(`${mode} storage retry reuses the exact item and ID without recapturing`, async () => {
            const e = environment(user);
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

        for (const failure of [false, true]) {
            it(`${mode} saves and imports usable code when preview capture ${failure ? "fails" : "is unavailable"}`, async () => {
                const e = environment(user);
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
                e.hooks.preview = () => exports.backpackPreviewAsync({ getSvgRoot: () => failure ? {
                    cloneNode: () => { throw new Error("Thumbnail capture failed"); }
                } : undefined });
                await e.save();
                assert.strictEqual(e.saves.length, 1);
                const saved = e.saves[0].item;
                assert.deepStrictEqual(clone(saved), {
                    id: "snippet-1", name: "repeat four times", code: e.code, blockText: e.blockText,
                    ...e.requirements, createdAt: saved.createdAt
                });
                assert.strictEqual(Object.prototype.hasOwnProperty.call(saved, "previewUri"), false);
                assert.strictEqual(Object.prototype.hasOwnProperty.call(saved, "previewPixelDensity"), false);
                assert.strictEqual(await e.import(saved), true);
                assert.strictEqual(e.imports[0].item, saved);
                assert.deepStrictEqual(e.dialogs, []);
                assert.deepStrictEqual(e.notifications, ["Added repeat four times to Backpack."]);
                assert.deepStrictEqual(e.opens, [["source-project", false]]);
                assert.deepStrictEqual(e.block, original);
                assert.strictEqual(removed, failure ? 1 : 0);
            });
        }
    }

    const unavailable = {
        "missing project": e => { e.editor.parent.state.header = undefined; },
        "temporary project": e => { e.editor.parent.state.header.temporary = true; },
        "unfinished tutorial": e => { e.editor.parent.state.header.tutorial = {}; },
        "read-only shell": e => { e.state.readOnly = true; },
        "locked target editor": e => { e.pxt.appTarget.appTheme.lockedEditor = true; },
        "hidden editor": e => { e.editor.isVisible = false; },
        "non-Blocks editor": e => { e.state.blocksActive = false; },
        "missing block info": e => { e.editor.blockInfo = undefined; },
        "loading XML": e => { e.editor.loadingXml = true; },
        "delayed XML": e => { e.editor.delayLoadXml = "<xml/>"; },
        "unavailable backpack tab": e => { e.state.tab = false; }
    };
    for (const [reason, change] of Object.entries(unavailable)) {
        it(`guards save and import for ${reason}`, async () => {
            const e = environment();
            change(e);
            assert.strictEqual(e.editor.backpackAvailable(), false);
            await e.save();
            await assert.rejects(e.import({}), /Open an editable Blocks project/);
            assert.deepStrictEqual(e.events, []);
            assert.deepStrictEqual(e.logins, []);
        });
    }

    it("allows completed tutorial projects without an account", () => {
        const e = environment();
        Object.assign(e.editor.parent.state.header, { tutorial: {}, tutorialCompleted: true });
        assert.strictEqual(e.editor.backpackAvailable(), true);
    });

    const transitions = [
        ["guest sign-in", undefined, "account-A"],
        ["cloud sign-out", "account-A", undefined],
        ["cloud account switch", "account-A", "account-B"]
    ];
    for (const [label, before, after] of transitions) {
        for (const stage of ["preview", "store"]) {
            for (const fails of [false, true]) {
                it(`${label} during ${stage} ${fails ? "failure" : "success"} stops routing, retry, and notification`, async () => {
                    const e = environment(before);
                    const gate = e.hold(stage);
                    const pending = e.save();
                    await gate.entered;
                    e.state.user = after;
                    if (fails) gate.reject(new Error("Operation failed"));
                    else gate.resolve(stage === "preview" ? e.preview : undefined);
                    await pending;
                    assert.strictEqual(e.saves.length, stage === "store" ? 1 : 0);
                    for (const save of e.saves) {
                        assert.strictEqual(save.user, before);
                        assert.strictEqual(save.item.blockText, e.blockText);
                    }
                    assert.strictEqual(e.events.filter(event => event === "capture").length, 1);
                    assert.deepStrictEqual(e.dialogs, []);
                    assert.deepStrictEqual(e.notifications, []);
                    assert.deepStrictEqual(e.opens, []);
                    assert.deepStrictEqual(e.logins, []);
                });
            }
        }

        it(`${label} while the retry dialog is pending prevents another store operation`, async () => {
            const e = environment(before);
            e.hooks.store = () => { throw new Error("Save failed"); };
            const gate = e.hold("confirm");
            const pending = e.save();
            await gate.entered;
            e.state.user = after;
            gate.resolve(1);
            await pending;
            assert.strictEqual(e.saves.length, 1);
            assert.strictEqual(e.dialogs.length, 1);
            assert.strictEqual(e.saves[0].item.blockText, e.blockText);
            assert.strictEqual(e.events.filter(event => event === "capture").length, 1);
            assert.deepStrictEqual(e.notifications, []);
            assert.deepStrictEqual(e.opens, []);
        });

        it(`captured import host invalidates on ${label}`, async () => {
            const e = environment(before);
            await e.import(e.importedItem);
            const host = e.imports[0].host;
            assert.strictEqual(host.isCurrent(), true);
            e.state.user = after;
            assert.strictEqual(host.isCurrent(), false);
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

    for (const user of [undefined, "account-A"]) {
        it(`${user ? "cloud" : "guest"} import delegates its item/result and captures a live project host`, async () => {
            const e = environment(user);
            const item = e.importedItem;
            e.hooks.import = () => false;
            assert.strictEqual(await e.import(item), false);
            assert.strictEqual(e.imports[0].item, item);
            assert.strictEqual(e.imports[0].item.blockText, e.blockText);
            const host = e.imports[0].host;
            assert.strictEqual(host.headerId, "source-project");
            assert.strictEqual(host.isCurrent(), true);
            assert.strictEqual(host.getWorkspace(), e.editor.editor);
            assert.strictEqual(host.getBlocksInfo(), e.editor.blockInfo);
            e.editor.editor = {};
            e.editor.blockInfo = {};
            assert.strictEqual(host.getWorkspace(), e.editor.editor);
            assert.strictEqual(host.getBlocksInfo(), e.editor.blockInfo);
            e.editor.parent.state.header = { id: "source-project" };
            e.editor.loadingXml = true;
            assert.strictEqual(host.isCurrent(), true, "same-project extension reload remains valid");
            e.editor.parent.state.header = { id: "other-project" };
            assert.strictEqual(host.isCurrent(), false);
            e.editor.parent.state.header = undefined;
            assert.strictEqual(host.isCurrent(), false);
            e.editor.parent.state.header = { id: "source-project" };
            e.state.blocksActive = false;
            assert.strictEqual(host.isCurrent(), false);
            e.state.blocksActive = true;
            e.state.readOnly = true;
            assert.strictEqual(host.isCurrent(), false);
            assert.deepStrictEqual(e.logins, []);
        });
    }

    it("host saves and awaits header reload, DOM update, and pending XML load in order", async () => {
        const e = environment();
        assert.strictEqual(await e.import(e.importedItem), true);
        const host = e.imports[0].host;
        await host.saveAsync();
        const reload = e.hold("reload");
        const xml = deferred();
        const dom = deferred();
        e.hooks.dom = () => { e.editor.loadingXmlPromise = xml.promise; dom.resolve(); };
        let finished = false;
        const pending = host.reloadAsync().then(() => { finished = true; });
        await reload.entered;
        assert.deepStrictEqual(e.events, ["import", "project-save", "reload"]);
        reload.resolve();
        await dom.promise;
        assert.strictEqual(finished, false);
        xml.resolve();
        await pending;
        assert.strictEqual(finished, true);
        assert.deepStrictEqual(e.events, ["import", "project-save", "reload", "dom"]);
    });
});