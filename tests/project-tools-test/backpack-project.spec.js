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

const authSource = ts.createSourceFile("auth.ts", read("pxtlib/auth.ts"), ts.ScriptTarget.Latest, true);
let assetTypeFunction;
function findAssetTypeFunction(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "isBackpackAssetType") assetTypeFunction = node;
    ts.forEachChild(node, findAssetTypeFunction);
}
findAssetTypeFunction(authSource);
assert(assetTypeFunction, "Expected the current asset allowlist helper");
const assetTypeSource = compile(assetTypeFunction.getText(authSource));

const clone = value => JSON.parse(JSON.stringify(value));
const config = (name, extra = {}) => ({ name, files: ["main.ts"], dependencies: {}, ...extra });
const version = name => `github:owner/${name}#v1.2.3`;
const codeFor = (...blocks) => JSON.stringify({ blocks });
const symbol = (name, packageName = name, extra = {}) => ({
    qName: `${name}.run`, name: "run", namespace: name, pkg: packageName,
    fileName: packageName ? `pxt_modules/${packageName}/main.ts` : "custom.ts",
    attributes: {}, parameters: [], ...extra
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
            bundledpkgs: { core: {} }, appTheme: { backpack: true }, cloud: { packages: true, githubPackages: true } },
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
    pxt.auth = { ...execute(assetTypeSource), hasIdentity: () => true };
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
    const define = (name, sym = symbol(name)) => {
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
        utils: {
            Coordinate: class { constructor(x, y) { this.x = x; this.y = y; } },
            svgMath: { screenToWsCoordinates: (workspace, point) => {
                assert.strictEqual(workspace, host.getWorkspace());
                events.push("coordinates");
                return { x: (point.x - workspace.left) / workspace.scale, y: (point.y - workspace.top) / workspace.scale };
            } }
        },
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
        pasteBackpackBlock: (code, workspace, coordinates) => {
            assert(active);
            primitive.parseBackpackCode(code);
            assert.equal(workspace, host.getWorkspace());
            pastes.push({ workspace, coordinates });
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
    const pastes = [];
    const workspace = { left: 0, top: 0, scale: 1 };
    const target = pxt.appTarget;
    const host = {
        headerId: "project", isCurrent: () => active && pxt.appTarget === target,
        getWorkspace: () => workspace, getBlocksInfo: () => info,
        saveAsync: async () => { await checkpoint(`save:${++saveCount}`); originalSaved = true; },
        reloadAsync: async () => {
            await checkpoint("reload");
            main.config = JSON.parse(file.content);
            for (const [name, ref] of Object.entries(main.config.dependencies)) install(name, ref, configs[name] || config(name));
            for (const cfg of Object.values(configs)) {
                if (cfg) for (const [child, ref] of Object.entries(cfg.dependencies)) install(child, ref);
            }
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
        shared, item, host, events, dialogs, configs, hooks, pxt, main, info, registry, file, editor, define,
        blockly, constants, context, requirePackages, pastes,
        switchAccount: () => { active = false; },
        run: position => api.addBackpackToProjectAsync(item, host, position),
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

    it("accepts resolved bundled requirements and their installed transitive dependencies after reload", async () => {
        const e = environment({ core: "embed:core" });
        e.pxt.appTarget.bundledpkgs.a = {};
        e.configs.a = config("a", { dependencies: { core: "*" } });
        const reload = e.host.reloadAsync;
        e.host.reloadAsync = async () => {
            await reload();
            e.main.deps.a._verspec = "embed:a";
            e.main.deps.core._verspec = "embed:core";
        };
        assert.equal(await e.ensure({ dependencies: { a: "*" } }, ["a_block"]), true);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "preflight:a", "save:1", "write", "reload", "definitions-ready"]);
        assert.equal(JSON.parse(e.file.content).dependencies.a, "*");
    });

    it("never normalizes embed references for absent or mismatched bundled packages", () => {
        for (const ref of ["embed:core", "embed:other"]) {
            const e = environment({ core: ref });
            if (ref === "embed:core") delete e.pxt.appTarget.bundledpkgs.core;
            assert.throws(() => e.captureStates([{ type: "core_block" }]), /Publish it and install/);
        }
    });

    it("captures a native function call's array parameter type without requiring its unselected body", async () => {
        const e = environment({ types: version("types"), unused: version("unused") });
        e.info.apis.byQName.Widget = symbol("Widget", "types");
        const states = [{ type: "function_call", extraState: {
            name: "outsideTheSelection", functionid: "function-id", arguments: [{ name: "x", id: "x", type: "Widget[]" }]
        } }];
        const requirements = e.captureStates(states);
        assert.deepStrictEqual(requirements, { dependencies: { types: version("types") }, projectBlocks: {} });
        assert.equal(await e.ensure(requirements, e.shared.getBlockSnippetTypes(states)), true);
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

    it("captures custom-source, dropdown, field-editor, mutation, and gallery references, but not text", () => {
        const e = environment({ enums: version("enums"), fixed: "pub:fixed", gallery: version("gallery"), unused: version("unused") });
        e.define("custom", symbol("custom", null, { fileName: "helpers.ts", fieldParameters: {
            OPTION: { type: "Choice" }, DEVICE: { type: "Sensor" }, TEXT: { type: "string" }, GALLERY: { type: "string", fieldEditor: "tilemap" }
        } }));
        e.info.apis.byQName["Choices.One"] = symbol("Choices", "enums");
        e.info.apis.byQName["devices.sensor"] = symbol("devices", "fixed");
        e.info.apis.byQName["gallery.tile1"] = symbol("gallery", "gallery");
        const states = [{ type: "custom_block", fields: {
            OPTION: "Choices.One", DEVICE: "devices.sensor", TEXT: "unused.run",
            GALLERY: { assetType: "tilemap", jres: { level1: { tileset: ["gallery.tile1"], data: "BASE64_DATA" } } }
        }, extraState: { reference: "enums.run" }, next: { block: { type: "text", fields: { TEXT: "unused.run" } } } }];
        assert.deepStrictEqual(e.captureStates(states), {
            dependencies: { enums: version("enums"), fixed: "pub:fixed", gallery: version("gallery") }, projectBlocks: { custom_block: "helpers.ts" }
        });
    });

    it("supports metadata-free existing clipboard data with fresh builtin and API availability", async () => {
        const e = environment({ a: version("a") });
        assert.equal(await e.ensure(undefined, ["text", "a_block"]), true);
        assert.deepStrictEqual(e.events, []);
        delete e.info.blocksById.a_block;
        assert.equal(await e.ensure(undefined, ["a_block"]), false);
        assert.deepStrictEqual(e.events, ["popup"]);
        assert.equal(e.dialogs[0].header, "Blocks unavailable");
    });

    it("preserves installed local clipboard references but cannot save or download them for another project", async () => {
        const source = environment({ a: "workspace:local" });
        const states = [{ type: "a_block" }];
        const requirements = source.captureStates(states);
        assert.deepStrictEqual(requirements, { dependencies: { a: "workspace:local" }, projectBlocks: {} });
        assert.equal(await source.ensure(requirements, ["a_block"]), true);
        assert.deepStrictEqual(source.events, []);
        assert.throws(() => source.capture(codeFor(...states)), /Publish it and install/);
        const destination = environment();
        assert.equal(await destination.ensure(requirements, ["a_block"]), false);
        assert.deepStrictEqual(destination.events, ["popup"]);
        assert.match(destination.dialogs[0].body, /Publish it and install/);
    });

    it("allows an already-installed local transitive but never downloads a missing local transitive", async () => {
        for (const installed of [true, false]) {
            const e = environment(installed ? { local: "workspace:local" } : {});
            e.configs.a = config("a", { dependencies: { local: "workspace:local" } });
            assert.equal(await e.ensure({ dependencies: { a: version("a") } }, ["a_block"]), installed);
            assert(!e.events.includes("fetch:local"));
            assert.equal(e.events.includes("write"), installed);
            if (!installed) assert.match(e.dialogs.at(-1).body, /Publish it and install/);
        }
    });

    it("detaches metadata and types before waiting for consent", async () => {
        const e = environment();
        const requirements = { dependencies: { a: version("a") } };
        const types = ["a_block"];
        e.hooks.set("confirm", () => {
            requirements.dependencies.a = "github:other/a#v1";
            requirements.dependencies.b = version("b");
            types.push("not_available");
        });
        assert.equal(await e.ensure(requirements, types), true);
        assert.equal(e.main.deps.a.version(), version("a"));
        assert(!e.events.includes("fetch:b"));
    });

    it("rejects malformed schema, poison keys, unsafe references and excess requirements before side effects", async () => {
        for (const value of [
            { dependencies: [] },
            JSON.parse('{"dependencies":{"__proto__":"workspace:local"}}'),
            { dependencies: { a: "github:owner/../repo" } },
            { dependencies: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`p${i}`, "pub:ok"])) }
        ]) {
            const e = environment();
            await assert.rejects(e.ensure(value, ["text"]), /invalid/i);
            assert.deepStrictEqual(e.events, []);
        }
    });

    it("rejects metadata accessors without invoking them", async () => {
        const e = environment();
        let read = false;
        const value = { get dependencies() { read = true; return {}; } };
        await assert.rejects(e.ensure(value, ["text"]), /invalid/i);
        assert.equal(read, false);
        assert.deepStrictEqual(e.events, []);
    });

    it("rejects poison, sparse and oversized type lists before side effects", async () => {
        for (const types of [["__proto__"], Array(1), Array(501).fill("text")]) {
            const e = environment();
            await assert.rejects(e.ensure(undefined, types), /invalid/i);
            assert.deepStrictEqual(e.events, []);
        }
    });

    it("rejects malformed connections, cycles, oversized fields and deeply nested actual states", () => {
        const e = environment();
        const cyclic = { type: "text" }; cyclic.next = { block: cyclic };
        let deep = { type: "text" };
        for (let i = 0; i < 102; i++) deep = { type: "text", next: { block: deep } };
        for (const states of [
            [{ type: "text", inputs: { X: { unexpected: {} } } }],
            [cyclic], [deep], [{ type: "text", fields: { TEXT: "a".repeat(1000001) } }]
        ]) {
            assert.throws(() => e.shared.getBlockSnippetTypes(states), /invalid/i);
            assert.throws(() => e.captureStates(states), /invalid/i);
        }
        assert.deepStrictEqual(e.events, []);
    });
});

describe("Backpack project requirements (fresh source)", () => {
    it("records local custom.ts/other files, but never classifies a symbol-less builtin as local", () => {
        const e = environment();
        e.define("custom", symbol("custom", null));
        e.define("other", symbol("other", "this", { fileName: "helpers.ts" }));
        e.define("source", symbol("source", "misleading-package", { fileName: "source.ts" }));
        const result = e.capture(codeFor({ type: "container", inputs: {
            A: { block: { type: "custom_block" } }, B: { block: { type: "other_block" } }, C: { block: { type: "source_block" } }
        } }));
        assert.deepStrictEqual(result, { dependencies: {}, projectBlocks: {
            custom_block: "custom.ts", other_block: "helpers.ts", source_block: "source.ts"
        } });
    });
});

describe("Backpack project insertion (fresh source, no network or program execution)", () => {
    it("cancels either target or PXT version mismatch before dependency checks or mutations", async () => {
        for (const field of ["target", "pxt"]) {
            const e = environment(); e.requirePackages("a");
            e.item.versions[field] += "-beta.2+capture";
            e.item.projectBlocks = { missing: "helpers.ts" };
            e.hooks.set("version-confirm", () => 0);
            assert.equal(await e.run(), false);
            assert.deepStrictEqual(e.events, ["version-confirm"]);
            assert.equal(e.dialogs[0].agreeLbl, "Add anyway");
            assert(e.dialogs[0].body.includes(e.item.versions[field]));
            assert(e.dialogs[0].body.includes(e.pxt.appTarget.versions[field]));
            assert.deepStrictEqual(JSON.parse(e.file.content).dependencies, {});
        }
    });

    it("checks common dependency requirements only after version consent", async () => {
        const e = environment(); e.requirePackages("a");
        e.item.versions.target = "1.0.0-beta.2";
        e.hooks.set("confirm", () => 0);
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["version-confirm", "confirm"]);
        assert.deepStrictEqual(JSON.parse(e.file.content).dependencies, {});
    });

    it("rechecks account and project identity when deferred version consent resolves", async () => {
        for (const change of [e => e.switchAccount(), e => { e.editor.header.id = "other-project"; }]) {
            const e = environment(); e.requirePackages("a");
            e.item.versions.pxt = "13.2.4-beta.1";
            let release, entered;
            const pending = new Promise(resolve => { release = resolve; });
            const confirming = new Promise(resolve => { entered = resolve; });
            e.hooks.set("version-confirm", () => { entered(); return pending; });
            const insertion = e.run();
            await confirming;
            assert.deepStrictEqual(e.events, ["version-confirm"]);
            change(e); release(1);
            await assert.rejects(insertion, /project or account changed/);
            assert.deepStrictEqual(e.events, ["version-confirm"]);
            assert.deepStrictEqual(JSON.parse(e.file.content).dependencies, {});
        }
    });

    it("matching versions need no warning and drop coordinates use the workspace after extension reload", async () => {
        const e = environment(); e.requirePackages("a");
        const fresh = { left: 40, top: 60, scale: 2 };
        e.hooks.set("definitions-ready", () => { e.host.getWorkspace = () => fresh; });
        assert.equal(await e.run({ x: 240, y: 160 }), true);
        assert.deepStrictEqual(e.dialogs.map(dialog => dialog.header), ["Add required extensions?"]);
        assert.deepStrictEqual(e.events.slice(-5), ["definitions-ready", "coordinates", "paste:one-undo-group", "renders", "save:2"]);
        assert.strictEqual(e.pastes[0].workspace, fresh);
        assert.deepStrictEqual(e.pastes[0].coordinates, { x: 100, y: 50 });
    });

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

    it("cancel performs no downloads, saves, config writes, reloads, or paste", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("confirm", () => 0);
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["confirm"]);
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

    it("rechecks local source after reload even if the old registry still contains its type", async () => {
        const e = environment(); e.requirePackages("a");
        e.define("custom", symbol("custom", null));
        e.item.projectBlocks = { custom_block: "custom.ts" };
        e.hooks.set("definitions-ready", () => { delete e.info.blocksById.custom_block; });
        assert.equal(await e.run(), false);
        assert.equal(e.dialogs.at(-1).header, "Project code is required");
        assert.equal(e.events.filter(event => event === "reload").length, 1);
        assert(!e.events.includes("paste:one-undo-group"));
    });

    it("retains another version of the same GitHub repo, but never upgrades it to recover a missing API", async () => {
        const e = environment({ a: "github:OWNER/A#v9.0.0" }); e.requirePackages("a");
        assert.equal(await e.run(), true);
        assert.equal(e.main.deps.a.version(), "github:OWNER/A#v9.0.0");
        assert.deepStrictEqual(e.events, ["paste:one-undo-group", "renders", "save:1"]);
        e.events.length = 0;
        delete e.info.blocksById.a_block;
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["popup"]);
    });

    it("distinguishes GitHub paths, published IDs and bundled sources rather than matching only names", async () => {
        for (const [name, installed, required] of [
            ["a", "github:owner/a/subfolder#v1.2.3", version("a")],
            ["a", "pub:old", "pub:new"],
            ["core", version("core"), "*"]
        ]) {
            const e = environment({ [name]: installed });
            e.item.dependencies = { [name]: required };
            assert.equal(await e.run(), false);
            assert.deepStrictEqual(e.events, ["popup"]);
            assert.equal(e.dialogs[0].header, "Extension conflict");
        }
    });

    it("a banned/null config aborts the whole prefetch before any save or mutation", async () => {
        const e = environment(); e.requirePackages("a", "b"); e.configs.b = null;
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "fetch:b", "popup"]);
    });

    it("rejects a downloaded configuration with the wrong package identity", async () => {
        const e = environment(); e.requirePackages("a"); e.configs.a = config("wrong-name");
        await assert.rejects(e.run(), /invalid or mismatched/);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a"]);
    });

    it("respects explicit GitHub target bans before downloading", async () => {
        const e = environment(); e.requirePackages("a"); e.pxt.appTarget.cloud.githubPackages = false;
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["confirm", "popup"]);
    });

    it("allows ordinary GitHub blocks but applies editor-extension restrictions to transitive packages", async () => {
        const e = environment(); e.requirePackages("a"); e.pxt.appTarget.appTheme.allowPackageExtensions = false;
        assert.equal(await e.run(), true);
        const denied = environment(); denied.requirePackages("a");
        denied.configs.a = config("a", { dependencies: { b: version("b") } });
        denied.configs.b = config("b", { extension: {} });
        assert.equal(await denied.run(), false);
        assert.deepStrictEqual(denied.events, ["confirm", "fetch:a", "fetch:b", "popup"]);
    });

    it("prefetches transitive dependencies, bounds cycles, and refuses banned transitives", async () => {
        const e = environment(); e.requirePackages("a");
        e.configs.a = config("a", { dependencies: { b: version("b") } });
        e.configs.b = config("b", { dependencies: { a: version("a") } });
        assert.equal(await e.run(), true);
        assert.equal(e.events.filter(event => event === "fetch:a").length, 1);
        assert(e.events.indexOf("fetch:b") < e.events.indexOf("write"));
        const denied = environment(); denied.requirePackages("a");
        denied.configs.a = config("a", { dependencies: { b: version("b") } }); denied.configs.b = null;
        assert.equal(await denied.run(), false);
        assert(!denied.events.includes("write"));
    });

    it("rejects incompatible sources within the new graph before writing", async () => {
        const e = environment(); e.requirePackages("a", "b");
        e.configs.a = config("a", { dependencies: { shared: version("shared") } });
        e.configs.b = config("b", { dependencies: { shared: "github:other/shared#v1" } });
        assert.equal(await e.run(), false);
        assert(!e.events.includes("write"));
        assert.equal(e.dialogs.at(-1).header, "Extension conflict");
    });

    it("preflights core replacement with the real conflict engine, never removing in-use code", async () => {
        const e = environment({ core: "*" }); e.requirePackages("a");
        e.main.deps.core.config.core = true; e.configs.a = config("a", { core: true });
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "preflight:a", "popup"]);
        assert.equal(e.main.deps.core.version(), "*");
    });

    it("detects conflicts between proposed extensions, not just installed ones", async () => {
        const e = environment(); e.requirePackages("a", "b");
        e.configs.a = config("a", { yotta: { config: { option: 1 } } });
        e.configs.b = config("b", { yotta: { config: { option: 2 } } });
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "fetch:b", "preflight:a", "preflight:b", "popup"]);
    });

    it("does not write config or reload when saving unsaved code fails", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("save:1", () => { throw new Error("storage failure"); });
        await assert.rejects(e.run(), /storage failure/);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "preflight:a", "save:1"]);
        assert.deepStrictEqual(JSON.parse(e.file.content).dependencies, {});
    });

    it("reloads once after an in-memory dependency edit even if persistence fails, preserving the failure", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("write", () => { throw new Error("storage failure"); });
        e.hooks.set("reload", () => { throw new Error("reload failure"); });
        await assert.rejects(e.run(), /storage failure/);
        assert.equal(e.events.filter(event => event === "reload").length, 1);
        assert(!e.events.includes("paste:one-undo-group"));
        assert.equal(JSON.parse(e.file.content).dependencies.a, version("a"));
    });

    it("refuses paste when the fresh Blockly registry lacks a reloaded API block", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("definitions-ready", () => { delete e.registry.a_block; });
        assert.equal(await e.run(), false);
        assert(!e.events.includes("paste:one-undo-group"));
        assert.equal(e.events.filter(event => event === "reload").length, 1);
        assert.equal(e.dialogs.at(-1).header, "Blocks unavailable");
    });

    it("never reloads the new project when switching projects during config persistence", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("write", () => { e.editor.header.id = "other-project"; });
        await assert.rejects(e.run(), /project or account changed/);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "preflight:a", "save:1", "write"]);
    });

    it("honors host target invalidation after reload and before paste", async () => {
        const e = environment(); e.requirePackages("a");
        // The editor host owns target identity; preparation must honor its invalidation.
        e.hooks.set("definitions-ready", () => { e.pxt.appTarget = { ...e.pxt.appTarget, id: "other-target" }; });
        await assert.rejects(e.run(), /project or account changed/);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "preflight:a", "save:1", "write", "reload", "definitions-ready"]);
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

    it("inserts real Blockly blocks and removes the complete insertion in one undo", async function () {
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
            assert.deepStrictEqual(e.events, ["paste:one-undo-group", "renders", "save:1"]);
        } finally {
            workspace.dispose();
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    });
});