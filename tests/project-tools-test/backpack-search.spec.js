"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");
const Fuse = require("fuse.js");

const filename = path.resolve(__dirname, "../../webapp/src/backpackSearch.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true
});
assert.deepStrictEqual(compiled.diagnostics, []);

// Execute current source, not built/webapp. Only real Fuse is available: no
// Blockly loaders, project packages, DOM, installation, or network services.
const searchModule = {};
vm.runInNewContext(compiled.outputText, {
    exports: searchModule,
    require: id => {
        assert.strictEqual(id, "fuse.js", "Search must remain a local text-only module");
        return Fuse;
    }
}, { filename });
const { createBackpackSearch } = searchModule;

describe("backpack search (fresh source, real Fuse)", () => {
    it("searches cloud summary fields and requires every query term without loading code", () => {
        const cloud = { id: "cloud", source: "cloud", name: "Orchard", createdAt: 1,
            summary: { id: "cloud", name: "Orchard", blockText: "altitude",
                blockTypes: ["radio_sendNumber"], dependencies: { radio: "github:acme/telemetry#v1" },
                searchText: ["wavelength"] } };
        Object.defineProperty(cloud, "code", { get: () => assert.fail("No code on a summary") });
        const other = { id: "other", source: "cloud", name: "Launch rocket" };
        const search = createBackpackSearch([other, cloud], name => name === "radio" ? "Wireless" : undefined);
        assert.deepStrictEqual(Array.from(search("ORCHARD altitude wireless send number wavelength")), [cloud]);
        assert.equal(search("orchard gyroscope").length, 0);
    });
});