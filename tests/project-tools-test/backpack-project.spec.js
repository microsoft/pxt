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
        appTarget: { bundledpkgs: { core: {} }, appTheme: {}, cloud: { packages: true, githubPackages: true } },
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
        const result = await checkpoint(options.hideCancel ? "popup" : "confirm");
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
    const host = {
        headerId: "project", isCurrent: () => active,
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
        dependencies: {}, code: codeFor({ type: "container" }), blockText: "Captured container label"
    };
    const requirePackages = (...names) => {
        item.dependencies = Object.fromEntries(names.map(name => [name, version(name)]));
        item.code = codeFor({ type: "container", inputs: Object.fromEntries(names.map(name => [name, { block: { type: `${name}_block` } }])) });
    };
    return {
        api, shared, item, host, events, dialogs, configs, hooks, pxt, main, info, registry, file, editor, pkg, define, install,
        Blockly, blockly, primitive, constants, context, requirePackages,
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

    for (const type of ["plain_statement", "expression", "function_call", "function_call_output"]) {
        it(`captures and prepares an unrestricted ${type} root without pasting or requiring a function body`, async () => {
            const e = environment({ a: version("a"), types: version("types"), unused: version("unused") });
            e.registry[type] = {};
            if (type.startsWith("function_")) e.blockly.builtinBlocks = () => ({ [type]: {} });
            else e.info.blocksById[type] = symbol("a");
            e.info.apis.byQName.Widget = symbol("Widget", "types");
            const states = [{ type, extraState: type.startsWith("function_") ? {
                name: "outsideTheSelection", functionid: "function-id", arguments: [{ name: "x", id: "x", type: "Widget[]" }]
            } : undefined }];
            // Native clipboard states must not go through Backpack's container/closure parser.
            e.blockly.parseBackpackCode = e.blockly.getBackpackBlockTypes = () => { throw new Error("Backpack parser used"); };
            const requirements = e.captureStates(states);
            assert.deepStrictEqual(requirements, {
                dependencies: type.startsWith("function_") ? { types: version("types") } : { a: version("a") }, projectBlocks: {}
            });
            const types = e.shared.getBlockSnippetTypes(states);
            assert.deepStrictEqual(clone(types), [type]);
            delete e.host.getWorkspace;
            assert.equal(await e.ensure(requirements, types), true);
            assert.deepStrictEqual(e.events, []);
        });
    }

    it("follows root next, nested next, both shadows and blocks; never infers requirements from typeCounts", () => {
        const e = environment({ a: version("a"), b: version("b"), c: version("c"), unused: version("unused") });
        const states = [{ type: "a_block", typeCounts: { unused_block: 99 }, inputs: {
            X: { shadow: { type: "b_block" }, block: { type: "text" } }
        }, next: { shadow: { type: "b_block" }, block: { type: "c_block", next: { block: { type: "a_block" } } } } }];
        assert.deepStrictEqual(clone(e.shared.getBlockSnippetTypes(states)), ["a_block", "b_block", "text", "c_block"]);
        assert.deepStrictEqual(e.captureStates(states), {
            dependencies: { a: version("a"), b: version("b"), c: version("c") }, projectBlocks: {}
        });
    });

    it("captures custom-source, dropdown, field-editor, mutation, and gallery references, but not text", () => {
        const e = environment({ enums: version("enums"), gallery: version("gallery"), unused: version("unused") });
        e.define("custom", symbol("custom", null, { fileName: "helpers.ts", fieldParameters: {
            OPTION: { type: "Choice" }, TEXT: { type: "string" }, GALLERY: { type: "string", fieldEditor: "tilemap" }
        } }));
        e.info.apis.byQName["Choices.One"] = symbol("Choices", "enums");
        e.info.apis.byQName["gallery.tile1"] = symbol("gallery", "gallery");
        const states = [{ type: "custom_block", fields: {
            OPTION: "Choices.One", TEXT: "unused.run", GALLERY: { tileset: ["gallery.tile1"] }
        }, extraState: { reference: "enums.run" }, next: { block: { type: "text", fields: { TEXT: "unused.run" } } } }];
        assert.deepStrictEqual(e.captureStates(states), {
            dependencies: { enums: version("enums"), gallery: version("gallery") }, projectBlocks: { custom_block: "helpers.ts" }
        });
    });

    it("installs missing root-next requirements and returns after reload without paste, renders, or final save", async () => {
        const source = environment({ a: version("a"), b: version("b") });
        const states = [{ type: "a_block", next: { block: { type: "b_block" } } }];
        const e = environment();
        const requirements = source.captureStates(states);
        assert.equal(await e.ensure(requirements, source.shared.getBlockSnippetTypes(states)), true);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "fetch:b", "preflight:a", "preflight:b", "save:1", "write", "reload", "definitions-ready"]);
        assert(!e.events.some(event => /paste|renders/.test(event)));
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

    for (const missing of ["registry", "builtin", "api"]) {
        it(`requires fresh ${missing} even without metadata and does not infer an installation`, async () => {
            const e = environment({ a: version("a") });
            if (missing === "registry") delete e.registry.text;
            if (missing === "builtin") e.blockly.builtinBlocks = () => ({});
            if (missing === "api") delete e.info.blocksById.a_block;
            assert.equal(await e.ensure(undefined, ["text", "a_block"]), false);
            assert.deepStrictEqual(e.events, ["popup"]);
        });
    }

    it("does not accept inherited block definitions or registry entries", async () => {
        const e = environment();
        Object.setPrototypeOf(e.registry, { inherited: {} });
        Object.setPrototypeOf(e.info.blocksById, { inherited: symbol("a") });
        assert.equal(await e.ensure(undefined, ["inherited"]), false);
        assert.deepStrictEqual(e.events, ["popup"]);
    });

    for (const ref of ["workspace:local", "file:../local", "file:C:\\src\\local", "pkg:packed"]) {
        it(`preserves installed local reference ${ref} in native copies but refuses Backpack saves`, async () => {
            const e = environment({ a: ref });
            const states = [{ type: "a_block" }];
            const requirements = e.captureStates(states);
            assert.deepStrictEqual(requirements, { dependencies: { a: ref }, projectBlocks: {} });
            assert.equal(await e.ensure(requirements, ["a_block"]), true);
            assert.deepStrictEqual(e.events, []);
            assert.throws(() => e.capture(codeFor(...states)), /Publish it and install/);
        });

        it(`explains missing local reference ${ref} before consent, download, save, or write`, async () => {
            const e = environment();
            assert.equal(await e.ensure({ dependencies: { a: version("a"), local: ref } }, ["a_block"]), false);
            assert.deepStrictEqual(e.events, ["popup"]);
            assert.match(e.dialogs[0].body, /Publish it and install/);
            assert(!/Backpack/.test(e.dialogs[0].body));
        });
    }

    it("does not replace a different local source just because the extension name matches", async () => {
        const e = environment({ a: "workspace:other" });
        assert.equal(await e.ensure({ dependencies: { a: "workspace:local" } }, ["a_block"]), false);
        assert.deepStrictEqual(e.events, ["popup"]);
        assert.equal(e.dialogs[0].header, "Extension conflict");
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

    const malformed = [
        ["null", null], ["array", []], ["missing dependencies", {}],
        ["array dependencies", { dependencies: [] }],
        ["unknown schema field", { dependencies: {}, version: 1 }],
        ["dangerous dependency key", JSON.parse('{"dependencies":{"__proto__":"workspace:local"}}')],
        ["unsafe dependency name", { dependencies: { "bad/name": "workspace:local" } }],
        ["unknown reference", { dependencies: { a: "https://evil.example/a" } }],
        ["empty local reference", { dependencies: { a: "workspace:" } }],
        ["local control characters", { dependencies: { a: "file:../local\n" } }],
        ["oversized reference", { dependencies: { a: `file:${"a".repeat(257)}` } }],
        ["bad GitHub traversal", { dependencies: { a: "github:owner/../repo" } }],
        ["non-bundled wildcard", { dependencies: { a: "*" } }],
        ["nonstring version", { dependencies: { a: 42 } }],
        ["too many dependencies", { dependencies: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`p${i}`, "pub:ok"])) }],
        ["array source map", { dependencies: {}, projectBlocks: [] }],
        ["unsafe source block key", { dependencies: {}, projectBlocks: { constructor: "custom.ts" } }],
        ["nonstring source filename", { dependencies: {}, projectBlocks: { a_block: 42 } }],
        ["control characters in source", { dependencies: {}, projectBlocks: { a_block: "custom.ts\n" } }],
        ["too many source blocks", { dependencies: {}, projectBlocks: Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`b${i}`, "custom.ts"])) }],
        ["inherited dependencies", Object.create({ dependencies: {} })]
    ];
    for (const [label, value] of malformed) {
        it(`rejects untrusted metadata: ${label}, before any UI, network, or writes`, async () => {
            const e = environment();
            await assert.rejects(e.ensure(value, ["text"]), /invalid/i);
            assert.deepStrictEqual(e.events, []);
        });
    }

    it("rejects metadata accessors without invoking them", async () => {
        const e = environment();
        let read = false;
        const value = { get dependencies() { read = true; return {}; } };
        await assert.rejects(e.ensure(value, ["text"]), /invalid/i);
        assert.equal(read, false);
        assert.deepStrictEqual(e.events, []);
    });

    for (const types of [["__proto__"], [""], [42], Array(1), Array(501).fill("text")]) {
        it(`rejects malformed type list ${String(types).slice(0, 40)} before side effects`, async () => {
            const e = environment();
            await assert.rejects(e.ensure(undefined, types), /invalid/i);
            assert.deepStrictEqual(e.events, []);
        });
    }

    it("rejects malformed, cyclic, aliased, oversized, and deeply nested actual states", () => {
        const e = environment();
        const cyclic = { type: "text" }; cyclic.next = { block: cyclic };
        const fieldCycle = {}; fieldCycle.self = fieldCycle;
        let deep = { type: "text" };
        for (let i = 0; i < 102; i++) deep = { type: "text", next: { block: deep } };
        const shared = { type: "text" };
        for (const states of [
            null, {}, [null], [{ type: 42 }], [{ type: "constructor" }], Array(1),
            [{ type: "text", inputs: [] }], [{ type: "text", fields: [] }],
            [{ type: "text", next: {} }], [{ type: "text", next: { block: null } }],
            [{ type: "text", inputs: { X: { unexpected: {} } } }],
            [cyclic], [{ type: "text", fields: fieldCycle }], [shared, shared], [deep],
            [{ type: "text", fields: { TEXT: "a".repeat(1000001) } }],
            Array.from({ length: 501 }, () => ({ type: "text" })),
            JSON.parse('[{"type":"text","fields":{"__proto__":{}}}]')
        ]) {
            assert.throws(() => e.shared.getBlockSnippetTypes(states), /invalid/i);
            assert.throws(() => e.captureStates(states), /invalid/i);
        }
        assert.deepStrictEqual(e.events, []);
    });

    it("reports generic retry guidance on a context change", async () => {
        const e = environment();
        e.hooks.set("confirm", e.switchAccount);
        await assert.rejects(e.ensure({ dependencies: { a: version("a") } }, ["a_block"]), error => {
            assert.match(error.message, /project or account changed.*retry the operation/);
            assert(!/Backpack/.test(error.message));
            return true;
        });
        assert.deepStrictEqual(e.events, ["confirm"]);
    });
});

describe("Backpack project requirements (fresh source)", () => {
    it("captures only exact used dependencies, nested next chains, and obscured shadows", () => {
        const e = environment({ a: version("a"), b: "pub:12345", unused: version("unused"), core: "*" });
        const result = e.capture(codeFor({ type: "container", inputs: { BODY: {
            shadow: { type: "a_block" }, block: { type: "core_block", next: { block: { type: "b_block" } } }
        } } }));
        assert.deepStrictEqual(result, { dependencies: { a: version("a"), core: "*", b: "pub:12345" }, projectBlocks: {} });
    });

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

    for (const ref of ["workspace:local", "file:../local", "pkg:packed", "invalid:a", "github:owner/repo#bad/ref", "*"]) {
        it(`rejects nonportable extension ${ref} with a publish/install explanation`, () => {
            const e = environment({ a: ref });
            assert.throws(() => e.capture(codeFor({ type: "a_block" })), /Publish it and install/);
        });
    }

    it("collects dropdown enum/fixed instance references using serialized field metadata", () => {
        const e = environment({ a: version("a"), enums: version("enums"), fixed: "pub:fixed" });
        e.info.apis.byQName["Choices.One"] = symbol("Choices", "enums");
        e.info.apis.byQName["devices.sensor"] = symbol("devices", "fixed");
        e.info.blocksById.a_block.fieldParameters = {
            OPTION: { type: "Choices" }, DEVICE: { type: "Sensor" }, TEXT: { type: "string" }
        };
        const result = e.capture(codeFor({ type: "a_block", fields: {
            OPTION: "Choices.One", DEVICE: "devices.sensor", TEXT: "unrelated.run"
        } }));
        assert.deepStrictEqual(result.dependencies, { a: version("a"), enums: version("enums"), fixed: "pub:fixed" });
    });

    it("does not mistake arbitrary text fields or variable names for extension references", () => {
        const e = environment({ a: version("a"), unused: version("unused") });
        e.info.blocksById.a_block.fieldParameters = { TEXT: { type: "string" } };
        const result = e.capture(codeFor({ type: "a_block", fields: { TEXT: "unused.run", UNKNOWN: "unused" },
            inputs: { X: { block: { type: "text", fields: { TEXT: "unused.run" } } } }
        }));
        assert.deepStrictEqual(result.dependencies, { a: version("a") });
    });

    it("uses qualified references when field metadata is unavailable", () => {
        const e = environment({ dropdown: version("dropdown") });
        assert.deepStrictEqual(e.capture(codeFor({ type: "container", fields: { OPTION: "dropdown.run" } })).dependencies,
            { dropdown: version("dropdown") });
    });

    it("captures gallery tile IDs in full asset state without unrelated gallery packages", () => {
        const e = environment({ gallery: version("gallery"), unused: version("unused") });
        e.info.apis.byQName["gallery.tile1"] = symbol("gallery", "gallery");
        const state = { version: 1, assetType: "tilemap", assetId: "level1", jres: { level1: {
            tileset: ["gallery.tile1"], data: "BASE64_DATA"
        } } };
        assert.deepStrictEqual(e.capture(codeFor({ type: "container", fields: { TILEMAP: state } })).dependencies,
            { gallery: version("gallery") });
    });

    it("captures qualified and unqualified function argument types from extraState", () => {
        const e = environment({ types: version("types") });
        e.info.apis.byQName["Types.Widget"] = symbol("Types", "types");
        e.info.apis.byQName["Widget"] = symbol("Types", "types");
        for (const type of ["Types.Widget", "Widget", "Widget[]"]) {
            const extraState = { name: "work", functionid: "function-id", arguments: [{ id: "a", name: "arg", type }] };
            const code = codeFor({ type: "function_definition", extraState }, { type: "container", inputs: {
                BODY: { block: { type: "function_call", extraState } }
            } });
            assert.deepStrictEqual(e.capture(code).dependencies, { types: version("types") });
        }
    });
});

describe("Backpack project insertion (fresh source, no network or program execution)", () => {
    it("requires bounded block text before preparation, without treating labels as dependencies or executable code", async () => {
        for (const blockText of [undefined, null, 7, "x".repeat(100001)]) {
            const e = environment();
            if (blockText === undefined) delete e.item.blockText;
            else e.item.blockText = blockText;
            await assert.rejects(e.run(), /Backpack block text/);
            assert.deepStrictEqual(e.events, []);
        }
        for (const blockText of ["", "uninstalled.run github:private/repo PRIVATE_LABELS", "x".repeat(100000)]) {
            const e = environment();
            e.item.blockText = blockText;
            const before = clone(e.item);
            assert.equal(await e.run(), true);
            assert.deepStrictEqual(e.events, ["paste:one-undo-group", "renders", "save:1"]);
            assert.deepStrictEqual(e.dialogs, []);
            assert.deepStrictEqual(e.item, before);
        }
    });

    it("delegates capture and preparation to the shared module, leaving paste in the adapter", async () => {
        const e = environment();
        let captures = 0;
        let preparations = 0;
        e.shared.getBlockSnippetRequirements = states => {
            captures++;
            assert.deepStrictEqual(clone(states), [{ type: "container" }]);
            return { dependencies: {}, projectBlocks: {} };
        };
        e.shared.ensureBlockSnippetAsync = async (requirements, types, host) => {
            preparations++;
            assert.deepStrictEqual(clone(requirements), { dependencies: {} });
            assert.deepStrictEqual(clone(types), ["container"]);
            assert.equal(host, e.host);
            return false;
        };
        assert.deepStrictEqual(e.capture(e.item.code), { dependencies: {}, projectBlocks: {} });
        assert.equal(await e.run(), false);
        assert.equal(captures, 1);
        assert.equal(preparations, 1);
        assert.deepStrictEqual(e.events, []);
    });

    it("inserts with no extension confirmation or reload when the exact requirements are installed", async () => {
        const e = environment({ a: version("a"), unused: version("unused") });
        e.requirePackages("a");
        assert.equal(await e.run(), true);
        assert.deepStrictEqual(e.events, ["paste:one-undo-group", "renders", "save:1"]);
    });

    it("prefetches and preflights only required packages, saves code, writes once, then refreshes before paste", async () => {
        const e = environment({ unrelated: version("unrelated") });
        e.requirePackages("a", "b");
        const untouched = clone(e.item);
        assert.equal(await e.run(), true);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "fetch:b", "preflight:a", "preflight:b", "save:1", "write",
            "reload", "definitions-ready", "paste:one-undo-group", "renders", "save:2"]);
        assert.deepStrictEqual(e.item, untouched);
        assert.equal(e.dialogs[0].agreeLbl, "Add extensions and snippet");
        assert(e.dialogs[0].body.includes(`a: ${version("a")}`));
        assert(e.dialogs[0].body.includes(`b: ${version("b")}`));
        assert.equal(JSON.parse(e.file.content).dependencies.unrelated, version("unrelated"));
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
        e.registry.a_block = {}; e.registry.other_block = {};
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["popup"]);
        assert.equal(e.dialogs[0].header, "Project code is required");
        assert.equal(e.dialogs[0].agreeLbl, "OK");
        assert.equal(e.dialogs[0].hideCancel, true);
        assert.match(e.dialogs[0].body, /custom.ts, helpers.ts/);
        assert.match(e.dialogs[0].body, /Copy the required code.*publish it as an extension/);
    });

    it("allows project-local types present in fresh BlocksInfo", async () => {
        const e = environment();
        e.define("custom", symbol("custom", null));
        e.item.code = codeFor({ type: "custom_block" });
        e.item.projectBlocks = { custom_block: "custom.ts" };
        assert.equal(await e.run(), true);
        assert(!e.events.includes("popup"));
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

    it("retains another version of the same case-insensitive GitHub repo", async () => {
        const e = environment({ a: "github:OWNER/A#v9.0.0" }); e.requirePackages("a");
        assert.equal(await e.run(), true);
        assert.equal(e.main.deps.a.version(), "github:OWNER/A#v9.0.0");
        assert(!e.events.includes("confirm"));
    });

    it("does not upgrade the same repo just to make a missing block available", async () => {
        const e = environment({ a: "github:owner/a#v0.1.0" }); e.requirePackages("a");
        delete e.info.blocksById.a_block;
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["popup"]);
    });

    for (const ref of ["github:other/a#v1.2.3", "github:owner/a/subfolder#v1.2.3", "pub:other", "workspace:local"]) {
        it(`refuses an installed package with different source ${ref}`, async () => {
            const e = environment({ a: ref }); e.requirePackages("a");
            assert.equal(await e.run(), false);
            assert.deepStrictEqual(e.events, ["popup"]);
            assert.equal(e.dialogs[0].header, "Extension conflict");
        });
    }

    it("rejects cppOnly instead of treating it as an installed block extension", async () => {
        const e = environment({ core: "*" });
        e.main.deps.core.cppOnly = true;
        e.item.dependencies = { core: "*" };
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["popup"]);
    });

    it("requires real bundled packages and refuses a GitHub package masquerading as bundled", async () => {
        const e = environment({ core: version("core") });
        e.item.dependencies = { core: "*" };
        assert.equal(await e.run(), false);
        const invalid = environment(); invalid.item.dependencies = { absent: "*" };
        await assert.rejects(invalid.run(), /bundled packages/);
        assert.deepStrictEqual(invalid.events, []);
    });

    it("installs a valid bundled dependency through getConfigAsync", async () => {
        const e = environment(); e.item.dependencies = { core: "*" };
        assert.equal(await e.run(), true);
        assert.equal(e.main.deps.core.version(), "*");
        assert(e.events.includes("fetch:core"));
    });

    it("a banned/null config aborts the whole prefetch before any save or mutation", async () => {
        const e = environment(); e.requirePackages("a", "b"); e.configs.b = null;
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["confirm", "fetch:a", "fetch:b", "popup"]);
    });

    for (const bad of [config("wrong-name"), { name: "a" }, config("a", { files: [42] })]) {
        it(`throws for an invalid/mismatched downloaded configuration ${JSON.stringify(bad)}`, async () => {
            const e = environment(); e.requirePackages("a"); e.configs.a = bad;
            await assert.rejects(e.run(), /invalid or mismatched/);
            assert.deepStrictEqual(e.events, ["confirm", "fetch:a"]);
        });
    }

    it("respects explicit GitHub target bans before downloading", async () => {
        const e = environment(); e.requirePackages("a"); e.pxt.appTarget.cloud.githubPackages = false;
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["confirm", "popup"]);
    });

    it("does not confuse ordinary GitHub block packages with editor-extension permission", async () => {
        const e = environment(); e.requirePackages("a"); e.pxt.appTarget.appTheme.allowPackageExtensions = false;
        assert.equal(await e.run(), true);
        const denied = environment(); denied.requirePackages("a");
        denied.configs.a = config("a", { extension: {} });
        assert.equal(await denied.run(), false);
        assert.deepStrictEqual(denied.events, ["confirm", "fetch:a", "popup"]);
        const allowed = environment(); allowed.requirePackages("a");
        allowed.configs.a = config("a", { extension: {} });
        allowed.pxt.appTarget.appTheme.allowPackageExtensions = true;
        assert.equal(await allowed.run(), true);
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

    for (const point of ["fetch:a", "fetch:b", "preflight:b", "save:1"]) {
        it(`does not reload or mutate when ${point} fails before the config write`, async () => {
            const e = environment(); e.requirePackages("a", "b");
            e.hooks.set(point, () => { throw new Error("network/storage failure"); });
            await assert.rejects(e.run(), /network\/storage failure/);
            assert(!e.events.includes("write")); assert(!e.events.includes("reload"));
        });
    }

    it("reloads once after an in-memory dependency edit even if persistence fails, preserving the failure", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("write", () => { throw new Error("storage failure"); });
        e.hooks.set("reload", () => { throw new Error("reload failure"); });
        await assert.rejects(e.run(), /storage failure/);
        assert.equal(e.events.filter(event => event === "reload").length, 1);
        assert(!e.events.includes("paste:one-undo-group"));
        assert.equal(JSON.parse(e.file.content).dependencies.a, version("a"));
    });

    it("does not reload when a write fails before changing config", async () => {
        const e = environment(); e.requirePackages("a");
        e.file.setContentAsync = async () => { throw new Error("write refused"); };
        await assert.rejects(e.run(), /write refused/);
        assert(!e.events.includes("reload"));
    });

    it("propagates reload failure without pasting or retrying the reload", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("reload", () => { throw new Error("reload failure"); });
        await assert.rejects(e.run(), /reload failure/);
        assert.equal(e.events.filter(event => event === "reload").length, 1);
        assert(!e.events.includes("paste:one-undo-group"));
    });

    for (const missing of ["info", "registry", "dependency"]) {
        it(`refuses paste when fresh ${missing} is unavailable after reload`, async () => {
            const e = environment(); e.requirePackages("a");
            e.hooks.set("definitions-ready", () => {
                if (missing === "info") delete e.info.blocksById.a_block;
                if (missing === "registry") delete e.registry.a_block;
                if (missing === "dependency") delete e.main.deps.a;
            });
            assert.equal(await e.run(), false);
            assert(!e.events.includes("paste:one-undo-group"));
            assert.equal(e.events.filter(event => event === "reload").length, 1);
        });
    }

    for (const kind of ["account", "project"]) {
        for (const point of ["confirm", "fetch:a", "fetch:b", "preflight:a", "save:1", "write", "reload", "renders", "save:2"]) {
            it(`stops on ${kind} switch during ${point}, with no subsequent project operation`, async () => {
                const e = environment(); e.requirePackages("a", "b");
                e.hooks.set(point, () => {
                    if (kind === "account") e.switchAccount();
                    else e.editor.header.id = "other-project";
                });
                await assert.rejects(e.run(), /project or account changed/);
                // The mocked reload itself completes its captured work, as a host operation may.
                const tail = e.events.slice(e.events.indexOf(point) + 1);
                assert.deepStrictEqual(tail, point === "reload" ? ["definitions-ready"] : []);
            });
        }
    }

    it("waits for actual deferred consent and rechecks context before beginning downloads", async () => {
        const e = environment(); e.requirePackages("a");
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        e.hooks.set("confirm", () => pending);
        const insertion = e.run();
        // Flush only microtasks; no timer, network, renderer, or user program is involved.
        for (let i = 0; i < 10; i++) await Promise.resolve();
        assert.deepStrictEqual(e.events, ["confirm"]);
        e.switchAccount(); release(1);
        await assert.rejects(insertion, /project or account changed/);
        assert.deepStrictEqual(e.events, ["confirm"]);
    });

    it("does not overwrite concurrent dependency edits while a fetch is pending", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("fetch:a", () => { e.file.content = JSON.stringify(config("user-edited", { dependencies: { b: version("b") } })); });
        await assert.rejects(e.run(), /extensions changed/);
        assert.equal(JSON.parse(e.file.content).name, "user-edited");
        assert(!e.events.includes("write"));
    });

    it("preserves config files generated by saving assets and concurrent project renames", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("save:1", () => {
            const cfg = JSON.parse(e.file.content);
            cfg.files.push("images.g.jres", "images.g.ts"); cfg.name = "renamed project";
            e.file.content = JSON.stringify(cfg);
        });
        assert.equal(await e.run(), true);
        const cfg = JSON.parse(e.file.content);
        assert.equal(cfg.name, "renamed project");
        assert.deepStrictEqual(cfg.files, ["main.ts", "images.g.jres", "images.g.ts"]);
        assert.equal(cfg.dependencies.a, version("a"));
    });

    it("does not reload for an asset-only save when the dependency write never happens", async () => {
        const e = environment(); e.requirePackages("a");
        e.hooks.set("save:1", () => {
            const cfg = JSON.parse(e.file.content); cfg.files.push("images.g.jres");
            e.file.content = JSON.stringify(cfg);
        });
        e.file.setContentAsync = async () => { throw new Error("write refused"); };
        await assert.rejects(e.run(), /write refused/);
        assert(!e.events.includes("reload"));
    });

    it("refuses installed bundled packages whose config identity is wrong", async () => {
        const e = environment({ core: "*" });
        e.item.dependencies = { core: "*" };
        e.main.deps.core.config.name = "not-core";
        assert.equal(await e.run(), false);
        assert.deepStrictEqual(e.events, ["popup"]);
    });

    it("checks context before any popup and after an explanatory popup", async () => {
        const inactive = environment(); inactive.switchAccount();
        await assert.rejects(inactive.run(), /project or account changed/);
        assert.deepStrictEqual(inactive.events, []);
        const e = environment(); e.item.projectBlocks = { custom_block: "custom.ts" };
        e.hooks.set("popup", e.switchAccount);
        await assert.rejects(e.run(), /project or account changed/);
        assert.deepStrictEqual(e.events, ["popup"]);
    });

    for (const bad of ["not json", codeFor({ type: "container", unexpected: true }), '{"blocks":[{"type":"container","fields":{"__proto__":{}}}]}']) {
        it(`rejects invalid serialized data before UI or project operations: ${bad}`, async () => {
            const e = environment(); e.item.code = bad;
            await assert.rejects(e.run(), /invalid or unsupported/);
            assert.deepStrictEqual(e.events, []);
        });
    }

    it("propagates render/final save errors rather than claiming success", async () => {
        for (const point of ["renders", "save:1"]) {
            const e = environment(); e.hooks.set(point, () => { throw new Error("failed to finish"); });
            await assert.rejects(e.run(), /failed to finish/);
            assert(!e.events.includes("reload"));
        }
    });

    it("delegates to the real source paste primitive, whose complete insertion is one undo group", async () => {
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
        try {
            assert.equal(await e.run(), true);
            // Blockly dispatches recorded undo events asynchronously.
            await new Promise(resolve => setTimeout(resolve, 0));
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