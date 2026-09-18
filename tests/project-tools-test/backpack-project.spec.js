"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const compile = source => {
    const result = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true
    });
    assert.deepStrictEqual(result.diagnostics, []);
    return result.outputText;
};
const sources = Object.fromEntries([
    "webapp/src/backpackProject.ts", "webapp/src/blockSnippet.ts", "webapp/src/backpack.ts", "pxtblocks/backpack.ts",
    "pxtblocks/plugins/functions/constants.ts"
].map(file => [file, compile(read(file))]));

// Exercise the production conflict engine, not a mock that always approves. The rest of
// Package performs downloads/builds, so only these pure methods are loaded from fresh source.
const packageSource = ts.createSourceFile("package.ts", read("pxtlib/package.ts"), ts.ScriptTarget.Latest, true);
let packageClass;
function findPackage(node) {
    if (ts.isClassDeclaration(node) && node.name?.text === "Package") packageClass = node;
    ts.forEachChild(node, findPackage);
}
findPackage(packageSource);
const packageMethods = ["findConflictsAsync", "parseAndValidConfig"].map(name => {
    const method = packageClass.members.find(member => member.name?.getText(packageSource) === name);
    assert(method, name);
    return method.getText(packageSource);
}).join("\n");
const conflictSource = compile(`class SourcePackage { ${packageMethods} }; exports.SourcePackage = SourcePackage;`);

const clone = value => JSON.parse(JSON.stringify(value));
const config = (name, extra = {}) => ({ name, files: ["main.ts"], dependencies: {}, ...extra });
const version = name => `github:owner/${name}#v1.2.3`;
const codeFor = (...blocks) => JSON.stringify({ blocks });
const symbol = name => ({
    qName: `${name}.run`, name: "run", namespace: name, pkg: name,
    fileName: `pxt_modules/${name}/main.ts`, attributes: {}, parameters: []
});

function environment(installed = {}) {
    const events = [];
    const dialogs = [];
    const configs = {};
    const hooks = new Map();
    let active = true;
    let saveCount = 0;
    let originalSaved = false;
    const checkpoint = async name => {
        events.push(name);
        if (hooks.has(name)) return hooks.get(name)();
        return undefined;
    };
    const flatten = (value, prefix = "", result = {}) => {
        for (const [key, item] of Object.entries(value || {})) {
            const name = prefix ? `${prefix}.${key}` : key;
            if (item && typeof item === "object") flatten(item, name, result);
            else result[name] = item;
        }
        return result;
    };
    const pxt = {
        CONFIG_NAME: "pxt.json",
        appTarget: { id: "arcade", versions: { target: "1.0.0", pxt: "13.2.4" },
            bundledpkgs: { core: {} }, appTheme: { backpack: true, assetEditor: true }, cloud: { packages: true, githubPackages: true } },
        github: {
            parseRepoId: ref => {
                const [fullName, tag] = ref.replace(/^github:/, "").split("#");
                const [owner, project] = fullName.split("/");
                return { owner, project, fullName, tag };
            }
        },
        semver: { strcmp: (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }) },
        Util: {
            jsonFlatten: flatten,
            jsonTryParse: text => { try { return JSON.parse(text); } catch { return undefined; } }
        },
        blocks: { compileInfo: sym => ({ definitionNameToParam: sym.fieldParameters || {} }) },
        reportException: error => { throw error; }
    };
    const context = vm.createContext({
        pxt, Util: pxt.Util, U: pxt.Util,
        cpp: { PkgConflictError: class extends Error {} },
        lf: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, n) => args[n])
    });
    function execute(source, requireModule = () => { throw new Error("Unexpected import"); }) {
        const exports = {};
        vm.runInContext(`(function(exports, require) { ${source}\n})`, context)(exports, requireModule);
        return exports;
    }
    pxt.auth = { hasIdentity: () => true };
    const SourcePackage = execute(conflictSource).SourcePackage;
    pxt.Package = class extends SourcePackage {
        constructor(id, verspec, parent, addedBy) {
            super();
            this.id = id; this._verspec = verspec; this.parent = parent;
            this.addedBy = [addedBy]; this.cppOnly = false;
        }
        version() { return this._verspec; }
        targetVersion() { return "1.0.0"; }
        async findConflictsAsync(cfg, ref) {
            await checkpoint(`preflight:${cfg.name}`);
            return super.findConflictsAsync(cfg, ref);
        }
        static stringifyConfig(cfg) { return JSON.stringify(cfg); }
        static async getConfigAsync(target, name, ref) {
            assert.equal(target, "1.0.0");
            assert(ref);
            await checkpoint(`fetch:${name}`);
            return Object.hasOwnProperty.call(configs, name) ? configs[name] : config(name);
        }
    };
    const main = new pxt.Package("this", "workspace:project", null, null);
    main.parent = main;
    main.config = config("project");
    main.deps = {};
    main.sortedDeps = () => [main, ...Object.values(main.deps)];
    const info = { blocksById: {}, apis: { byQName: {} } };
    const registry = { container: {}, controls_if: {}, text: {}, function_definition: {}, function_call: {} };
    const builtins = { ...registry };
    const define = name => {
        const sym = symbol(name);
        info.blocksById[`${name}_block`] = sym;
        info.apis.byQName[sym.qName] = sym;
        registry[`${name}_block`] = {};
    };
    const install = (name, ref, cfg = config(name)) => {
        const dep = new pxt.Package(name, ref, main, main);
        dep.config = cfg;
        main.deps[name] = dep;
        define(name);
        return dep;
    };
    for (const [name, ref] of Object.entries(installed)) {
        install(name, ref);
        main.config.dependencies[name] = ref;
    }
    const file = {
        content: JSON.stringify(main.config),
        setContentAsync(content) {
            assert(active, "write to an inactive project");
            assert(originalSaved, "unsaved code would be lost");
            file.content = content;
            return checkpoint("write");
        }
    };
    const editor = { header: { id: "project" }, files: { "pxt.json": file } };
    const pkg = { mainPkg: main, mainEditorPkg: () => editor };
    const Blockly = {
        Blocks: registry,
        DragTarget: class {},
        renderManagement: { finishQueuedRenders: () => checkpoint("renders") }
    };
    const constants = execute(sources["pxtblocks/plugins/functions/constants.ts"]);
    const primitive = execute(sources["pxtblocks/backpack.ts"], id => {
        if (id === "blockly") return Blockly;
        if (id === "./plugins/functions/constants") return constants;
        throw new Error(`Unexpected primitive import: ${id}`);
    });
    const blockly = {
        ...primitive, builtinBlocks: () => builtins,
        pasteBackpackBlock: (code, workspace) => {
            assert(active);
            primitive.parseBackpackCode(code);
            assert.equal(workspace, host.getWorkspace());
            events.push("paste:one-undo-group");
        }
    };
    const store = execute(sources["webapp/src/backpack.ts"]);
    const core = { confirmAsync: async options => {
        dialogs.push(clone(options));
        const result = await checkpoint(options.hideCancel ? "popup"
            : options.header === "Different editor version" ? "version-confirm" : "confirm");
        return result === undefined ? 1 : result;
    } };
    const imports = { "blockly": Blockly, "../../pxtblocks": blockly, "./package": pkg, "./core": core, "./backpack": store };
    const load = id => {
        assert(Object.prototype.hasOwnProperty.call(imports, id), `Unexpected import ${id}`);
        return imports[id];
    };
    const shared = imports["./blockSnippet"] = execute(sources["webapp/src/blockSnippet.ts"], load);
    const api = execute(sources["webapp/src/backpackProject.ts"], load);
    const workspace = {};
    const target = pxt.appTarget;
    const host = {
        headerId: "project", isCurrent: () => active && pxt.appTarget === target,
        getWorkspace: () => workspace, getBlocksInfo: () => info,
        saveAsync: async () => { await checkpoint(`save:${++saveCount}`); originalSaved = true; },
        reloadAsync: async () => {
            await checkpoint("reload");
            main.config = JSON.parse(file.content);
            for (const [name, ref] of Object.entries(main.config.dependencies)) install(name, ref, configs[name] || config(name));
            await checkpoint("definitions-ready");
        }
    };
    const item = {
        id: "00000000-0000-4000-8000-000000000000", name: "Snippet", createdAt: 0,
        kind: "code", versions: { ...pxt.appTarget.versions },
        dependencies: {}, code: codeFor({ type: "container" }), blockText: "Captured container label"
    };
    const requirePackages = (...names) => {
        item.dependencies = Object.fromEntries(names.map(name => [name, version(name)]));
        item.code = codeFor({ type: "container", inputs: Object.fromEntries(names.map(name => [name, { block: { type: `${name}_block` } }])) });
    };
    return {
        shared, item, host, events, dialogs, configs, hooks, main, info, registry, file, editor,
        blockly, constants, context, requirePackages,
        switchAccount: () => { active = false; },
        run: () => api.addBackpackToProjectAsync(item, host),
        ensure: (requirements, types) => shared.ensureBlockSnippetAsync(requirements, types, host),
        captureStates: states => clone(shared.getBlockSnippetRequirements(states, info, main)),
        capture: code => clone(api.getBackpackRequirements(code, info, main))
    };
}

describe("Shared block snippet preparation (fresh source, ordinary Blockly states)", () => {
    it("normalizes resolved bundled dependencies for both clipboard and Backpack capture", async () => {
        const e = environment({ core: "embed:core" });
        e.info.blocksById.core_block.fileName = ""; // Bundled API caches omit source filenames.
        const states = [{ type: "core_block" }];
        const expected = { dependencies: { core: "*" }, projectBlocks: {} };
        assert.deepStrictEqual(e.captureStates(states), expected);
        assert.deepStrictEqual(e.capture(codeFor(...states)), expected);
        assert.equal(await e.ensure(expected, ["core_block"]), true);
        assert.deepStrictEqual(e.events, []);
    });

    it("follows root next, nested next, both shadows and blocks; never infers requirements from typeCounts", () => {
        const e = environment({ a: version("a"), b: "pub:12345", c: version("c"), unused: version("unused") });
        const states = [{ type: "a_block", typeCounts: { unused_block: 99 }, inputs: {
            X: { shadow: { type: "b_block" }, block: { type: "text" } }
        }, next: { shadow: { type: "b_block" }, block: { type: "c_block", next: { block: { type: "a_block" } } } } }];
        assert.deepStrictEqual(clone(e.shared.getBlockSnippetTypes(states)), ["a_block", "b_block", "text", "c_block"]);
        assert.deepStrictEqual(e.captureStates(states), {
            dependencies: { a: version("a"), b: "pub:12345", c: version("c") }, projectBlocks: {}
        });
    });
});

describe("Backpack project insertion (fresh source, no network or program execution)", () => {
    it("after version consent saves unsaved code/assets, merges config, and refreshes packages before paste", async () => {
        const e = environment({ unrelated: version("unrelated") });
        e.requirePackages("a", "b");
        e.item.versions.target = "1.0.0-beta.2+capture";
        e.hooks.set("save:1", () => {
            const cfg = JSON.parse(e.file.content);
            cfg.files.push("images.g.jres", "images.g.ts");
            cfg.name = "renamed project";
            e.file.content = JSON.stringify(cfg);
        });
        const untouched = clone(e.item);
        assert.equal(await e.run(), true);
        assert.deepStrictEqual(e.events, ["version-confirm", "confirm", "fetch:a", "fetch:b", "preflight:a", "preflight:b", "save:1", "write",
            "reload", "definitions-ready", "paste:one-undo-group", "renders", "save:2"]);
        assert.deepStrictEqual(e.item, untouched);
        assert.equal(e.dialogs[0].agreeLbl, "Add anyway");
        assert.equal(e.dialogs[1].agreeLbl, "Add extensions and snippet");
        assert(e.dialogs[1].body.includes(`a: ${version("a")}`));
        assert(e.dialogs[1].body.includes(`b: ${version("b")}`));
        const cfg = JSON.parse(e.file.content);
        assert.equal(cfg.name, "renamed project");
        assert.deepStrictEqual(cfg.files, ["main.ts", "images.g.jres", "images.g.ts"]);
        assert.deepStrictEqual(cfg.dependencies, { unrelated: version("unrelated"), a: version("a"), b: version("b") });
    });

    it("captures extension asset requirements and installs them only after consent", async () => {
        const source = environment({ a: version("a"), gallery: version("gallery") });
        source.info.apis.byQName["gallery.tile"] = { ...symbol("gallery"), qName: "gallery.tile" };
        const code = codeFor({ type: "a_block", fields: { ASSET: "gallery.tile" } });
        const requirements = source.capture(code);
        assert.deepStrictEqual(requirements.dependencies, { a: version("a"), gallery: version("gallery") });
        const e = environment();
        Object.assign(e.item, { kind: "asset", code, ...requirements });
        e.hooks.set("confirm", () => 0);
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["confirm"]);
        e.hooks.delete("confirm");
        e.events.length = 0;
        assert.equal(await e.run(), true);
        assert.deepStrictEqual(JSON.parse(e.file.content).dependencies, requirements.dependencies);
        assert(e.events.indexOf("reload") < e.events.indexOf("paste:one-undo-group"));
    });

    it("missing local source takes precedence over extensions and stale global Blockly registration", async () => {
        const e = environment(); e.requirePackages("a");
        e.item.projectBlocks = { a_block: "custom.ts", other_block: "helpers.ts" };
        e.item.blockText = "PRIVATE_LABELS";
        e.item.code = codeFor({ type: "container", fields: { PRIVATE_CODE: "SECRET_SOURCE" } });
        e.registry.a_block = {}; e.registry.other_block = {};
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["popup"]);
        assert.equal(e.dialogs[0].header, "Project code is required");
        assert.equal(e.dialogs[0].agreeLbl, "OK");
        assert.equal(e.dialogs[0].hideCancel, true);
        assert.match(e.dialogs[0].body, /custom.ts, helpers.ts/);
        assert.match(e.dialogs[0].body, /Copy the required code.*publish it as an extension/);
        assert(!/PRIVATE_LABELS|PRIVATE_CODE|SECRET_SOURCE/.test(JSON.stringify(e.dialogs)));
    });

    it("preflights core replacement with the real conflict engine, never removing in-use code", async () => {
        const e = environment({ core: "*" }); e.requirePackages("a");
        e.main.deps.core.config.core = true; e.configs.a = config("a", { core: true });
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "preflight:a", "popup"]);
        assert.equal(e.main.deps.core.version(), "*");
    });

    it("does not write config or reload when saving unsaved code fails", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("save:1", () => { throw new Error("storage failure"); });
        await assert.rejects(e.run(), /storage failure/);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "preflight:a", "save:1"]);
        assert.deepStrictEqual(JSON.parse(e.file.content).dependencies, {});
    });

    it("never reloads the new project when switching projects during config persistence", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("write", () => { e.editor.header.id = "other-project"; });
        await assert.rejects(e.run(), /project or account changed/);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "preflight:a", "save:1", "write"]);
    });

    it("waits for actual deferred consent and rechecks context before beginning downloads", async () => {
        const e = environment(); e.requirePackages("a");
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        let entered;
        const confirming = new Promise(resolve => { entered = resolve; });
        e.hooks.set("confirm", () => { entered(); return pending; });
        const insertion = e.run();
        await confirming;
        assert.deepStrictEqual(e.events, ["confirm"]);
        e.switchAccount(); release(1);
        await assert.rejects(insertion, /project or account changed/);
        assert.deepStrictEqual(e.events, ["confirm"]);
    });

    it("does not overwrite concurrent dependency edits while a fetch is pending", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("fetch:a", () => { e.file.content = JSON.stringify(config("user-edited", { dependencies: { b: version("b") } })); });
        await assert.rejects(e.run(), /extensions changed/);
        assert.deepStrictEqual(JSON.parse(e.file.content), config("user-edited", { dependencies: { b: version("b") } }));
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a"]);
    });

    it("retries saving real Blockly imports without duplicating their single undo group", async function () {
        this.timeout(10000); // Includes cold-loading Blockly and its native render/event setup.
        const e = environment();
        const Blockly = require("blockly");
        require("blockly/blocks");
        const workspace = new Blockly.Workspace();
        const exports = {};
        vm.runInContext(`(function(exports, require) { ${sources["pxtblocks/backpack.ts"]}\n})`, e.context)(exports, id => {
            if (id === "blockly") return Blockly;
            if (id === "./plugins/functions/constants") return e.constants;
            throw new Error(`Unexpected import ${id}`);
        });
        e.host.getWorkspace = () => workspace;
        e.blockly.pasteBackpackBlock = (code, ws) => {
            e.events.push("paste:one-undo-group");
            return exports.pasteBackpackBlock(code, ws);
        };
        e.item.code = codeFor({ type: "controls_if", inputs: { IF0: { block: { type: "logic_boolean", fields: { BOOL: "TRUE" } } } } });
        e.registry.logic_boolean = {};
        e.blockly.builtinBlocks = () => ({ controls_if: {}, logic_boolean: {} });
        e.hooks.set("save:1", () => { throw new Error("storage failure"); });
        const recorded = new Promise(resolve => {
            const listener = event => {
                if (event.type !== Blockly.Events.CREATE) return;
                workspace.removeChangeListener(listener);
                resolve();
            };
            workspace.addChangeListener(listener);
        });
        try {
            assert.equal(await e.run(), true);
            await recorded;
            assert.equal(workspace.getAllBlocks(false).length, 2);
            const undo = workspace.getUndoStack();
            assert(undo.length);
            assert(undo.every(event => event.group && event.group === undo[0].group));
            workspace.undo(false);
            assert.equal(workspace.getAllBlocks(false).length, 0);
            assert.deepStrictEqual(e.events, ["paste:one-undo-group", "renders", "save:1", "confirm", "save:2"]);
            assert.equal(e.dialogs[0].agreeLbl, "Retry save");

            // Dismissing a repeated persistence error also retains a successful import.
            e.hooks.set("save:3", () => { throw new Error("storage failure"); });
            e.hooks.set("confirm", () => 0);
            assert.equal(await e.run(), true);
            assert.equal(workspace.getAllBlocks(false).length, 2);
            assert.equal(e.events.filter(event => event === "paste:one-undo-group").length, 2);
            assert.equal(e.dialogs[1].disagreeLbl, "Keep editing");
        } finally {
            workspace.dispose();
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    });
});