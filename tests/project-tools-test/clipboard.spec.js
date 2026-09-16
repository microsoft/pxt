"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");
const { launchTestBrowser } = require("./browser");

const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const compile = text => {
    const result = ts.transpileModule(text, {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
        reportDiagnostics: true
    });
    assert.deepStrictEqual(result.diagnostics, []);
    return result.outputText;
};

// Never import built/webapp or the editor bundle. Extract the current adapter,
// including registration closures, and execute the actual shared module below.
const source = ts.createSourceFile("blocks.tsx", read("webapp/src/blocks.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const editorClass = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === "Editor");
assert(editorClass, "Expected the current Blocks Editor class");
const memberNames = ["pasteInProgress", "initPrompts", "pasteAsync", "pasteCallback", "canPasteData",
    "createSnippetHost", "copyPrecondition", "pastePrecondition"];
const members = memberNames.map(name => {
    const member = editorClass.members.find(node => node.name?.getText(source) === name);
    assert(member, `Missing Editor.${name}`);
    return member.getText(source);
});
const functionNames = ["copy", "cut", "saveCopyData", "getCopyData", "copyDataKey"];
const declarations = ["CopyDataEntry", ...functionNames].map(name => {
    const node = source.statements.find(node => node.name?.getText(source) === name);
    assert(node, `Missing clipboard declaration ${name}`);
    return node.getText(source);
});
const adapterSource = compile(`${declarations.join("\n")}\nclass SourceEditor { ${members.join("\n")} }
    exports.SourceEditor = SourceEditor;
    Object.assign(exports, { ${functionNames.join(", ")} });`);
const sharedSource = compile(read("webapp/src/blockSnippet.ts"));
const validatorSource = compile(read("webapp/src/backpack.ts"));
const clone = value => JSON.parse(JSON.stringify(value));
const version = name => `github:owner/${name}#v1.0.0`;
const config = (name, dependencies = {}) => ({ name, files: ["main.ts"], dependencies });
const symbol = (name, packageName = name) => ({
    pkg: packageName, fileName: packageName ? `pxt_modules/${packageName}/main.ts` : "helpers.ts",
    qName: `${name}.run`, attributes: {}, parameters: []
});
const deferred = () => {
    let resolve;
    const promise = new Promise(yes => { resolve = yes; });
    return { promise, resolve };
};
const forbidden = () => { throw new Error("Clipboard must not use Backpack serialization, auth, or insertion"); };

function environment() {
    const events = [];
    const dialogs = [];
    const pastes = [];
    const reports = [];
    const hooks = {};
    const storage = new Map();
    const configs = {};
    const ensures = [];
    const state = { header: { id: "project" }, user: undefined, readOnly: false, blocksActive: true };
    const step = (name, fallback) => {
        events.push(name);
        return Object.prototype.hasOwnProperty.call(hooks, name) ? hooks[name]() : fallback;
    };
    class Workspace {
        constructor(id = "workspace") {
            this.id = id;
            this.readOnly = false;
            this.view = { left: 0, top: 0, width: 200, height: 100 };
            this.pixels = { width: 400, height: 200 };
            this.bounds = { left: 10, top: 20 };
            this.absolute = { left: 0, top: 0 };
        }
        isReadOnly() { return this.readOnly; }
        hideChaff() { step("chaff"); }
        getAudioManager() { return { play: name => step(`audio:${name}`) }; }
        getMetricsManager() {
            return { getViewMetrics: world => world ? this.view : this.pixels, getAbsoluteMetrics: () => this.absolute };
        }
        getInjectionDiv() { return { getBoundingClientRect: () => this.bounds }; }
    }
    class Block {
        constructor(data, workspace) {
            this.data = data;
            this.workspace = workspace;
            this.coord = { x: 20, y: 30 };
            this.deleted = false;
        }
        toCopyData() { return step("serialize", this.data); }
        getRelativeToSurfaceXY() { return this.coord; }
        checkAndDelete() { this.deleted = true; step("delete"); }
    }
    class KeyboardEvent {
        constructor(type = "copy") { this.type = type; this.prevented = 0; }
        preventDefault() { ++this.prevented; }
    }
    class Coordinate { constructor(x, y) { this.x = x; this.y = y; } }
    class Rect {
        constructor(top, bottom, left, right) { Object.assign(this, { top, bottom, left, right }); }
        contains(x, y) { return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom; }
    }
    const registry = { text: {}, math_number: {}, controls_if: {}, function_call: {} };
    const builtins = { ...registry };
    const Blockly = {
        WorkspaceSvg: Workspace, BlockSvg: Block, Blocks: registry,
        isCopyable: value => !!value?.toCopyData,
        isDraggable: value => !!value?.getRelativeToSurfaceXY,
        isDeletable: value => !!value?.isDeletable,
        dialog: { setAlert() {}, setConfirm() {} },
        utils: { Coordinate, Rect },
        clipboard: {
            BlockPaster: { TYPE: "block" },
            paste: (...args) => { pastes.push(args); return step("native-paste", {}); }
        }
    };
    const pxt = {
        CONFIG_NAME: "pxt.json",
        appTarget: { id: "arcade", versions: { target: "1.0.0" }, appTheme: {}, bundledpkgs: {}, cloud: {} },
        shell: { isReadOnly: () => state.readOnly },
        auth: new Proxy({}, { get: () => forbidden }),
        Util: { isTranslationMode: () => false },
        U: { jsonTryParse: text => { try { return JSON.parse(text); } catch { return undefined; } } },
        github: { parseRepoId: ref => {
            const [owner, project] = ref.slice(7).split("#")[0].split("/");
            return { owner, project };
        } },
        blocks: { compileInfo: sym => ({ definitionNameToParam: sym.fieldParameters || {} }) },
        storage: {
            setLocal: (key, value) => { step("store"); storage.set(key, value); },
            getLocal: key => storage.get(key)
        },
        reportException: error => reports.push(error)
    };
    // Package downloads/conflicts are a deterministic boundary here. Exhaustive
    // real conflict-engine/preflight tests live in backpack-project.spec.js.
    pxt.Package = class {
        constructor(id, ref) { this.id = id; this.ref = ref; }
        version() { return this.ref; }
        targetVersion() { return "1.0.0"; }
        static parseAndValidConfig(text) { return JSON.parse(text); }
        static stringifyConfig(cfg) { return JSON.stringify(cfg); }
        static async getConfigAsync(target, name, ref) {
            assert.strictEqual(target, "1.0.0");
            assert.strictEqual(ref, version(name));
            return step(`fetch:${name}`, configs[name] || config(name));
        }
    };
    const main = new pxt.Package("this", "workspace:project");
    main.deps = {};
    main.sortedDeps = () => Object.values(main.deps);
    main.findConflictsAsync = async cfg => step(`conflicts:${cfg.name}`, []);
    const file = {
        content: JSON.stringify(config("project")),
        setContentAsync: async content => { file.content = content; await step("write"); }
    };
    const editorPackage = { get header() { return state.header; }, files: { "pxt.json": file } };
    const pkg = { mainPkg: main, mainEditorPkg: () => editorPackage };
    let registration;
    const pxtblockly = {
        builtinBlocks: () => builtins,
        external: { setPrompt() {}, setCopyPaste: (...args) => { registration = args; } },
        captureBackpackBlock: forbidden, parseBackpackCode: forbidden, getBackpackBlockTypes: forbidden,
        pasteBackpackBlock: forbidden, isBackpackBlock: forbidden
    };
    const core = { confirmAsync: async options => {
        dialogs.push(clone(options));
        return step(`dialog:${options.header}`, 1);
    } };
    const context = vm.createContext({
        Error, pxt, pkg, Blockly, pxtblockly, core, KeyboardEvent,
        auth: { loggedIn: () => !!state.user, userProfile: () => state.user ? { id: state.user } : undefined },
        lf: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]),
        shouldDuplicateOnDrag: block => !!block.duplicateOnDrag,
        showCopiedHint: () => step("copy-hint"), showCutHint: () => step("cut-hint"),
        clearPasteHints: () => step("clear-hints"),
        addBackpackToProjectAsync: forbidden, getBackpackRequirements: forbidden,
        backpack: new Proxy({}, { get: () => forbidden })
    });
    const execute = (code, imports = {}) => {
        const exports = {};
        vm.runInContext(`(function(exports, require) { ${code}\n})`, context)(exports, id => {
            assert(Object.prototype.hasOwnProperty.call(imports, id), `Unexpected import: ${id}`);
            return imports[id];
        });
        return exports;
    };
    const validator = execute(validatorSource);
    const shared = execute(sharedSource, {
        blockly: Blockly, "../../pxtblocks": pxtblockly, "./core": core, "./package": pkg, "./backpack": validator
    });
    Object.assign(context, {
        getBlockSnippetRequirements: (...args) => {
            step("capture");
            return shared.getBlockSnippetRequirements(...args);
        },
        getBlockSnippetTypes: states => { step("types"); return shared.getBlockSnippetTypes(states); },
        ensureBlockSnippetAsync: (...args) => {
            ensures.push(args);
            if (Object.prototype.hasOwnProperty.call(hooks, "ensure")) return step("ensure");
            step("ensure");
            return shared.ensureBlockSnippetAsync(...args);
        }
    });
    const api = execute(adapterSource);
    const editor = new api.SourceEditor();
    Object.assign(editor, {
        editor: new Workspace(), blockInfo: { blocksById: {}, apis: { byQName: {} } },
        loadingXml: false, delayLoadXml: false, isVisible: true,
        domUpdate: () => step("dom"),
        parent: {
            state, isBlocksActive: () => state.blocksActive, showLoginDialog: forbidden,
            saveProjectAsync: async () => { await step("save-project"); },
            reloadHeaderAsync: async () => {
                await step("reload");
                editor.editor = new Workspace("reloaded-workspace");
                editor.blockInfo = { blocksById: {}, apis: { byQName: {} } };
                for (const [name, ref] of Object.entries(JSON.parse(file.content).dependencies)) install(name, ref);
                editor.loadingXmlPromise = Promise.resolve().then(() => step("definitions-ready"));
            }
        }
    });
    function define(type, sym) {
        registry[type] = {};
        editor.blockInfo.blocksById[type] = sym;
        editor.blockInfo.apis.byQName[sym.qName] = sym;
    }
    function install(name, ref = version(name)) {
        const dep = new pxt.Package(name, ref);
        dep.config = configs[name] || config(name);
        main.deps[name] = dep;
        define(`${name}_block`, symbol(name));
        return dep;
    }
    editor.initPrompts();
    const dataFor = (blockState = { type: "text", fields: { TEXT: "hello" } }) => ({
        paster: "block", blockState, typeCounts: { deliberately_not_a_requirement: 99 }
    });
    const makeBlock = blockState => new Block(dataFor(blockState), editor.editor);
    const entry = (blockState, requirements) => ({
        version: 1, data: dataFor(blockState), coord: { x: 20, y: 30 },
        workspaceId: "workspace", targetVersion: "1.0.0", headerId: "project", requirements
    });
    const copyOrCut = (name, block, event = new KeyboardEvent(name)) => registration[name === "copy" ? 0 : 1](
        editor.editor, event, {}, { focusedNode: block });
    return {
        api, shared, editor, state, main, file, hooks, storage,
        events, dialogs, pastes, ensures, reports, Workspace, KeyboardEvent,
        define, install, makeBlock, entry, copyOrCut,
        read: () => api.getCopyData(),
        put: data => storage.set(api.copyDataKey(), JSON.stringify(data)),
        paste: (data, event) => editor.pasteAsync(data, event),
        hold(name) {
            const gate = deferred();
            const entered = deferred();
            hooks[name] = () => { entered.resolve(); return gate.promise; };
            return { ...gate, entered: entered.promise };
        }
    };
}

describe("Clipboard copy/cut integration (fresh source)", () => {
    it("copies and pastes an ordinary function call without Backpack container, closure, or account gates", async () => {
        const e = environment();
        const block = e.makeBlock({ type: "function_call" });
        assert.strictEqual(e.copyOrCut("copy", block), true);
        await e.paste(e.read());
        assert.strictEqual(e.pastes.length, 1);
        assert.strictEqual(e.pastes[0][0].blockState.type, "function_call");
        assert.strictEqual(block.deleted, false);
        assert.deepStrictEqual(e.dialogs, []);
    });

    it("captures only used input, obscured shadow, root-next, field API, and project-source requirements", () => {
        const e = environment();
        for (const name of ["root", "input", "shadow", "following", "gallery", "unused"]) e.install(name);
        e.define("custom_block", symbol("custom", null));
        const block = e.makeBlock({ type: "root_block", fields: { IMAGE: { tiles: ["gallery.run"] } }, inputs: {
            VALUE: { shadow: { type: "shadow_block" }, block: { type: "input_block" } }
        }, next: { block: { type: "following_block", next: { block: { type: "custom_block" } } } } });
        assert.strictEqual(e.copyOrCut("copy", block), true);
        assert.deepStrictEqual(clone(e.read().data.blockState), block.data.blockState);
        assert.deepStrictEqual(clone(e.read().requirements), {
            dependencies: Object.fromEntries(["root", "input", "shadow", "following", "gallery"].map(name => [name, version(name)])),
            projectBlocks: { custom_block: "helpers.ts" }
        });
        assert.deepStrictEqual(clone(e.shared.getBlockSnippetTypes([e.read().data.blockState])),
            ["root_block", "shadow_block", "input_block", "following_block", "custom_block"]);
    });

    for (const failure of ["capture", "store"]) {
        it(`cut: ${failure} failure never consumes the source or replaces the old clipboard`, () => {
            const e = environment();
            e.put(e.entry());
            const original = e.storage.get("copyData");
            const block = e.makeBlock();
            e.hooks[failure] = () => { throw new Error(`${failure} failed`); };
            assert.strictEqual(e.copyOrCut("cut", block), false);
            assert.strictEqual(block.deleted, false);
            assert.strictEqual(e.storage.get("copyData"), original);
            assert(!e.events.includes("copy-hint") && !e.events.includes("cut-hint"));
            assert.strictEqual(e.dialogs.length, 1);
            assert.strictEqual(e.dialogs[0].header, "Copy Error");
        });
    }

    it("cut durably captures the current block requirements before deleting the source", () => {
        const e = environment();
        e.editor.blockInfo = { blocksById: { local: symbol("local", null) }, apis: { byQName: {} } };
        const block = e.makeBlock({ type: "local" });
        e.hooks.delete = () => {
            assert.deepStrictEqual(clone(e.read().data), block.data);
            assert.deepStrictEqual(clone(e.read().requirements.projectBlocks), { local: "helpers.ts" });
        };
        assert.strictEqual(e.copyOrCut("cut", block), true);
        assert.strictEqual(block.deleted, true);
        assert.deepStrictEqual(e.events, ["serialize", "capture", "store", "delete", "cut-hint"]);
    });

    it("native comments bypass metadata capture, cut via dispose, and paste without block preparation", async () => {
        const e = environment();
        e.editor.blockInfo = undefined;
        e.hooks.capture = forbidden;
        e.hooks.ensure = forbidden;
        const comment = {
            workspace: e.editor.editor, toCopyData: () => ({ paster: "comment", text: "native comment", width: 80, height: 40 }),
            isDeletable: () => true, dispose: () => e.events.push("dispose-comment")
        };
        assert(e.copyOrCut("copy", comment));
        assert.strictEqual(e.read().coord, null);
        assert.strictEqual(e.read().requirements, undefined);
        assert(e.copyOrCut("cut", comment));
        assert(e.events.indexOf("store") < e.events.indexOf("dispose-comment"));
        assert(e.events.includes("audio:delete"));
        await e.paste(e.read());
        assert.strictEqual(e.pastes[0][0].text, "native comment");
        assert.deepStrictEqual(e.ensures, []);
        assert(!e.events.includes("types"));
    });
});

describe("Clipboard paste integration and shared preparation (fresh source)", () => {
    const missingEntry = e => e.entry({ type: "extension_block" }, { dependencies: { extension: version("extension") } });
    const assertNoChanges = e => {
        assert.deepStrictEqual(e.pastes, []);
        assert(!e.events.some(event => ["save-project", "write", "reload"].includes(event)), e.events.join(", "));
        assert.deepStrictEqual(JSON.parse(e.file.content).dependencies, {});
    };

    it("missing extensions remain enabled; approval ensures, installs, reloads definitions, then native-pastes in the fresh workspace", async () => {
        const e = environment();
        const data = missingEntry(e);
        e.put(data);
        assert.strictEqual(e.editor.pastePrecondition({ workspace: e.editor.editor }), "enabled");
        const oldWorkspace = e.editor.editor;
        const gate = e.hold("definitions-ready");
        const pending = e.paste(e.read());
        await gate.entered;
        assert.deepStrictEqual(e.pastes, []);
        gate.resolve();
        await pending;
        assert.deepStrictEqual(e.events, ["clear-hints", "types", "ensure", "dialog:Add required extensions?",
            "fetch:extension", "conflicts:extension", "save-project", "write", "reload", "definitions-ready", "dom", "native-paste"]);
        assert.strictEqual(e.pastes.length, 1);
        assert.notStrictEqual(e.pastes[0][1], oldWorkspace);
        assert.strictEqual(e.pastes[0][1], e.editor.editor);
        assert.deepStrictEqual(clone(e.pastes[0][0]), data.data);
        assert.deepStrictEqual(JSON.parse(e.file.content).dependencies, { extension: version("extension") });
        assert.strictEqual(e.dialogs[0].agreeLbl, "Add extensions and snippet");
    });

    it("missing project-source popup aborts before downloading, saving, replacing extensions, or pasting", async () => {
        const e = environment();
        const data = missingEntry(e);
        data.requirements.projectBlocks = { custom: "helpers.ts" };
        await e.paste(data);
        assert.strictEqual(e.dialogs[0].header, "Project code is required");
        assert.match(e.dialogs[0].body, /helpers\.ts/);
        assert.deepStrictEqual(e.events, ["clear-hints", "types", "ensure", "dialog:Project code is required"]);
        assertNoChanges(e);
    });

    it("preflight conflicts are explained without quietly replacing dependencies", async () => {
        const e = environment();
        e.hooks["conflicts:extension"] = () => [{ pkg0: "core", pkg1: "extension" }];
        await e.paste(missingEntry(e));
        assert.strictEqual(e.dialogs[e.dialogs.length - 1].header, "Extension conflict");
        assertNoChanges(e);
    });

    it("metadata-free paste rejects an extension absent from current APIs despite its stale global registration", async () => {
        const e = environment();
        e.install("extension");
        delete e.editor.blockInfo.blocksById.extension_block;
        const data = e.entry({ type: "extension_block" });
        data.data.typeCounts = { text: 1 };
        e.put(data);
        assert.strictEqual(e.editor.pastePrecondition({ workspace: e.editor.editor }), "enabled");
        await e.paste(e.read());
        assert.strictEqual(e.dialogs[0].header, "Blocks unavailable");
        assertNoChanges(e);
    });

    it("version-1 metadata-free builtin paste succeeds without inferring extensions from stale typeCounts", async () => {
        const e = environment();
        const data = e.entry();
        delete data.requirements;
        await e.paste(data);
        assert.strictEqual(e.pastes.length, 1);
        assert.deepStrictEqual(e.dialogs, []);
        assert(!e.events.some(event => event.startsWith("fetch:")));
    });

    for (const position of ["same visible", "other workspace"]) {
        it(`keyboard positioning: ${position} uses native default only for a visible same-workspace copy`, async () => {
            const e = environment();
            const data = e.entry();
            if (position === "other workspace") data.workspaceId = "different";
            await e.paste(data);
            assert.strictEqual(e.pastes[0].length, position === "same visible" ? 2 : 3);
            if (position !== "same visible") assert.deepStrictEqual(clone(e.pastes[0][2]), { x: 100, y: 50 });
        });
    }

    it("pointer position is captured before await, but bounds, scale and workspace are resolved after ensure", async () => {
        const e = environment();
        const gate = e.hold("ensure");
        const pointer = { clientX: 240, clientY: 160 };
        const pending = e.paste(e.entry(), pointer);
        await gate.entered;
        pointer.clientX = pointer.clientY = 9999;
        const fresh = e.editor.editor = new e.Workspace("fresh");
        fresh.view = { left: 100, top: 200, width: 400, height: 200 };
        fresh.pixels = { width: 800, height: 400 };
        fresh.bounds = { left: 30, top: 40 };
        fresh.absolute = { left: 10, top: 20 };
        gate.resolve(true);
        await pending;
        assert.strictEqual(e.pastes[0][1], fresh);
        assert.deepStrictEqual(clone(e.pastes[0][2]), { x: 200, y: 250 });
    });

    it("guards readonly/loading paste and permits only same-project unfinished tutorial clipboard data", async () => {
        for (const change of [
            e => { e.state.readOnly = true; },
            e => { e.editor.editor.readOnly = true; },
            e => { e.editor.loadingXml = true; }
        ]) {
            const e = environment();
            change(e);
            await e.paste(e.entry());
            assert.deepStrictEqual(e.ensures, []);
            assert.deepStrictEqual(e.pastes, []);
        }
        const e = environment();
        e.put(e.entry());
        e.state.header = { id: "other", tutorial: {} };
        const event = new e.KeyboardEvent("paste");
        assert.strictEqual(e.editor.pasteCallback(e.editor.editor, event), false);
        assert.strictEqual(event.prevented, 0);
        await e.paste(e.read());
        assert.deepStrictEqual(e.ensures, []);
        assert.deepStrictEqual(e.pastes, []);
        e.state.header = { id: "project", tutorial: {} };
        await e.paste(e.read());
        assert.strictEqual(e.pastes.length, 1);
    });

    for (const [label, stage, change] of [
        ["project switch", "dialog:Add required extensions?", e => { e.state.header = { id: "other" }; }],
        ["direct account A to B switch", "fetch:extension", e => { e.state.user = "account-B"; }]
    ]) {
        it(`${label} during ${stage} aborts without stale writes or native paste`, async () => {
            const e = environment();
            e.state.user = "account-A";
            const gate = e.hold(stage);
            const pending = e.paste(missingEntry(e));
            await gate.entered;
            change(e);
            gate.resolve(stage === "fetch:extension" ? config("extension") : 1);
            await pending;
            assertNoChanges(e);
            assert.strictEqual(e.editor.pasteInProgress, false);
            assert(!e.dialogs.some(dialog => dialog.header === "Paste Error"));
        });
    }

    it("suppresses concurrent paste during consent and allows retry after cancellation", async () => {
        const e = environment();
        e.put(missingEntry(e));
        const original = e.storage.get("copyData");
        const gate = e.hold("dialog:Add required extensions?");
        const pending = e.paste(e.read());
        await gate.entered;
        await e.paste(missingEntry(e));
        assert.strictEqual(e.ensures.length, 1);
        assert.strictEqual(e.dialogs.length, 1);
        assert.strictEqual(e.editor.pasteInProgress, true);
        gate.resolve(0);
        await pending;
        assertNoChanges(e);
        assert(!e.events.includes("fetch:extension"));
        assert.strictEqual(e.storage.get("copyData"), original);
        assert.strictEqual(e.editor.pasteInProgress, false);
        delete e.hooks["dialog:Add required extensions?"];
        await e.paste(missingEntry(e));
        assert.strictEqual(e.pastes.length, 1);
    });

    it("native paste errors through the fire-and-forget callback are visible without rejecting", async () => {
        const e = environment();
        e.put(e.entry());
        e.hooks["native-paste"] = () => { throw new Error("Visible failure"); };
        let pending;
        const original = e.editor.pasteAsync.bind(e.editor);
        // Observe the real operation's promise, without replacing its behavior.
        e.editor.pasteAsync = (...args) => { pending = original(...args); pending.catch(() => {}); return pending; };
        const event = new e.KeyboardEvent("paste");
        assert(e.editor.pasteCallback(e.editor.editor, event));
        assert.strictEqual(event.prevented, 1);
        await assert.doesNotReject(pending);
        assert.strictEqual(e.dialogs[0].header, "Paste Error");
        assert.strictEqual(e.dialogs[0].body, "Visible failure");
        assert.strictEqual(e.editor.pasteInProgress, false);
    });

    it("a failing error dialog cannot reject the fire-and-forget paste operation", async () => {
        const e = environment();
        e.hooks.ensure = () => { throw new Error("Preparation failed"); };
        e.hooks["dialog:Paste Error"] = () => { throw new Error("Dialog failed"); };
        // Observe the promise explicitly so a regression is a normal test failure,
        // not a process-level unhandledRejection that interferes with other suites.
        await assert.doesNotReject(e.paste(e.entry()));
        assert.strictEqual(e.editor.pasteInProgress, false);
        assert.deepStrictEqual(e.reports.map(error => error.message), ["Dialog failed"]);
    });
});

describe("Clipboard native Blockly round trip (isolated browser, no PXT build)", function () {
    this.timeout(30000);
    let browser;
    let page;
    before(async () => { browser = await launchTestBrowser(); });
    after(async () => { if (browser) await browser.close(); });
    afterEach(async () => { if (page) { await page.close(); page = undefined; } });

    it("native full field serialization restores an ordinary expression into a fresh workspace using the real adapter and shared pipeline", async () => {
        page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on("request", request => request.abort());
        await page.setContent('<div id="source" style="width:600px;height:300px"></div><div id="destination" style="width:600px;height:300px"></div>');
        const directory = path.dirname(require.resolve("blockly"));
        for (const file of ["blockly_compressed.js", "blocks_compressed.js", "msg/en.js"]) {
            await page.addScriptTag({ path: path.join(directory, file) });
        }
        const result = await page.evaluate(({ adapterSource, sharedSource, validatorSource }) => {
            return (async () => {
                const B = window.Blockly;
                const fail = () => { throw new Error("Unexpected clipboard dependency"); };
                const payload = { id: "source-only", pixels: [1, 4, 8], tiles: { cells: [2, 3], walls: [0, 1] } };
                class FullField extends B.Field {
                    constructor() { super("image"); this.state = JSON.parse(JSON.stringify(payload)); this.SERIALIZABLE = true; }
                    saveState(full) { return full ? this.state : this.state.id; }
                    loadState(value) {
                        if (typeof value === "string") throw new Error("Source asset lookup is forbidden");
                        this.state = value;
                    }
                }
                B.Blocks.clipboard_expression = { init() {
                    this.appendDummyInput().appendField(new FullField(), "IMAGE");
                    this.setOutput(true);
                } };
                const sourceWorkspace = B.inject("source", { scrollbars: true });
                const destination = B.inject("destination", { scrollbars: true });
                try {
                    const block = sourceWorkspace.newBlock("clipboard_expression");
                    block.initSvg(); block.render(); block.moveBy(30, 40);
                    await B.renderManagement.finishQueuedRenders();
                    const storage = new Map();
                    const dialogs = [];
                    const header = { id: "browser-project" };
                    const pxt = {
                        CONFIG_NAME: "pxt.json", appTarget: { id: "arcade", versions: { target: "1" } },
                        shell: { isReadOnly: () => false }, U: { jsonTryParse: JSON.parse },
                        blocks: { compileInfo: () => ({ definitionNameToParam: {} }) },
                        Package: { parseAndValidConfig: JSON.parse },
                        storage: { setLocal: (key, value) => storage.set(key, value), getLocal: key => storage.get(key) }
                    };
                    const pkg = {
                        mainPkg: { id: "this", deps: {} },
                        mainEditorPkg: () => ({ header, files: { "pxt.json": { content: '{"dependencies":{}}' } } })
                    };
                    const core = { confirmAsync: async options => { dialogs.push(options); return 1; } };
                    const pxtblockly = { builtinBlocks: () => ({}), captureBackpackBlock: fail, pasteBackpackBlock: fail };
                    const globals = {
                        pxt, pkg, core, Blockly: B, pxtblockly, lf: text => text,
                        auth: { loggedIn: () => false, userProfile: () => undefined },
                        showCopiedHint() {}, showCutHint() {}, clearPasteHints() {}, shouldDuplicateOnDrag: () => false
                    };
                    const execute = (code, imports = {}) => {
                        const exports = {};
                        const module = new Function(...Object.keys(globals), `return function(exports, require) { ${code}\n}`)(...Object.values(globals));
                        module(exports, id => {
                            if (!(id in imports)) return fail();
                            return imports[id];
                        });
                        return exports;
                    };
                    const validator = execute(validatorSource);
                    Object.assign(globals, execute(sharedSource, {
                        blockly: B, "../../pxtblocks": pxtblockly, "./package": pkg, "./core": core, "./backpack": validator
                    }));
                    const api = execute(adapterSource);
                    const editor = new api.SourceEditor();
                    editor.blockInfo = { blocksById: { clipboard_expression: { pkg: "main", fileName: "main.ts" } }, apis: { byQName: {} } };
                    editor.editor = sourceWorkspace;
                    editor.parent = { state: { header }, isBlocksActive: () => true, saveProjectAsync: fail, reloadHeaderAsync: fail };
                    const copied = api.copy(sourceWorkspace, new KeyboardEvent("copy"), {}, { focusedNode: block }, editor.blockInfo);
                    const entry = api.getCopyData();
                    block.dispose(); // No original block/asset registry is available when loading full state.
                    editor.editor = destination;
                    await editor.pasteAsync(entry);
                    await B.renderManagement.finishQueuedRenders();
                    const pasted = destination.getTopBlocks(false);
                    return {
                        copied, stored: entry.data.blockState.fields.IMAGE,
                        restored: pasted[0]?.getField("IMAGE").state,
                        types: pasted.map(block => block.type), typeCounts: entry.data.typeCounts,
                        requirements: entry.requirements, dialogs, sourceCount: sourceWorkspace.getAllBlocks(false).length
                    };
                } finally {
                    sourceWorkspace.dispose(); destination.dispose();
                }
            })();
        }, { adapterSource, sharedSource, validatorSource });
        assert.strictEqual(result.copied, true);
        assert.deepStrictEqual(result.types, ["clipboard_expression"]);
        assert.deepStrictEqual(result.stored, { id: "source-only", pixels: [1, 4, 8], tiles: { cells: [2, 3], walls: [0, 1] } });
        assert.deepStrictEqual(result.restored, result.stored);
        assert.deepStrictEqual(result.typeCounts, { clipboard_expression: 1 });
        assert.deepStrictEqual(result.requirements, { dependencies: {}, projectBlocks: { clipboard_expression: "main.ts" } });
        assert.deepStrictEqual(result.dialogs, []);
        assert.strictEqual(result.sourceCount, 0);
    });
});