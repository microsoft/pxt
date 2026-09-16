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

const code = (...blocks) => JSON.stringify({ blocks });
const entry = (id, overrides = {}, source = "local") => {
    const item = {
        id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
        name: "Saved routine", code: code({ type: "pxt-on-start" }), blockText: "",
        dependencies: {}, createdAt: 1, ...overrides
    };
    return { id: item.id, source, name: item.name, createdAt: item.createdAt, item };
};
function freeze(value) {
    if (value && typeof value === "object") {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}
function matches(search, query, expected) {
    const actual = search(query);
    assert(Array.isArray(actual), `Expected an array for ${JSON.stringify(query)}`);
    assert.strictEqual(actual.length, expected.length, `Result count for ${JSON.stringify(query)}`);
    expected.forEach((entry, index) => {
        assert.strictEqual(actual[index], entry, `Original entry/order for ${JSON.stringify(query)} at ${index}`);
    });
}

describe("backpack search (fresh source, real Fuse)", () => {
    it("searches cloud summary fields and requires every query term without loading code", () => {
        const cloud = { id: "cloud", source: "cloud", name: "Orchard", createdAt: 1,
            summary: { id: "cloud", name: "Orchard", blockText: "altitude cumulonimbus 8675309",
                blockTypes: ["radio_sendNumber"], dependencies: { radio: "github:acme/telemetry#v1" },
                searchText: ["launchRocket", "wavelength"],
                version: "etag", createdAt: 1, updatedAt: 1, status: "ready", hasPreview: true } };
        Object.defineProperty(cloud, "code", { get: () => assert.fail("No code on a summary") });
        const search = createBackpackSearch(freeze([entry(2), cloud]), name => name === "radio" ? "Wireless" : undefined);
        matches(search, "ORCHARD altitude wireless send number wavelength", [cloud]);
        matches(search, "8675309 telemetry", [cloud]);
        matches(search, "orchard gyroscope", []);
    });

    it("preserves collection order and distinct same-ID copies for fuzzy and empty queries", () => {
        const first = entry(1, { name: "Collect strawberxy", blockText: "gyroscope" });
        const other = entry(2, { name: "Launch rocket" });
        const last = entry(1, { name: "Strawberry", blockText: "quicksilver" }, "cloud");
        const entries = freeze([first, other, last]);
        const before = JSON.stringify(entries);
        const search = createBackpackSearch(entries);
        matches(search, "strawberry", [first, last]);
        matches(search, "STRAWBER", [first, last]);
        matches(search, "gyroscope", [first]);
        matches(search, "quicksilver", [last]);
        matches(search, "gyroscope quicksilver", []);
        matches(search, "zygomorphic", []);
        matches(search, " \t", entries);
        matches(createBackpackSearch([]), "orchard", []);
        assert.strictEqual(JSON.stringify(entries), before);
    });

    it("indexes captured labels, nested states, parameters and extension references locally", () => {
        const saved = entry(1, { name: "Orchard", blockText: "Calibrate gyroscope",
            dependencies: { animation: "*", vendor: "github:contoso/echolocation#v1" },
            code: code({ type: "pxt-on-start", inputs: {
            HANDLER: { block: { type: "variables_set", fields: { VAR: { id: "internal-id", name: "altitude" } }, inputs: {
                VALUE: {
                    shadow: { type: "text", fields: { TEXT: "saffron" } },
                    block: { type: "math_number", fields: { NUM: 8675309 } }
                }
            }, next: {
                shadow: { type: "text", fields: { TEXT: "marigold" } },
                block: { type: "music_playTone", fields: { TEXT: "telescope" } }
            } } }
        } }, { type: "function_definition", extraState: {
                name: "illuminate", arguments: [{ id: "argument-id", name: "wavelength", type: "number" }]
            }, inputs: {
                STACK: { block: { type: "text", fields: { TEXT: "ultraviolet" } } }
            } }) });
        const search = createBackpackSearch(freeze([entry(2), saved]), name => name === "vendor" ? "Prismatic" : undefined);
        matches(search, "orchard gyroscope altitude 8675309", [saved]);
        matches(search, "saffron marigold telescope play tone", [saved]);
        matches(search, "illuminate wavelength ultraviolet", [saved]);
        matches(search, "animation contoso echolocation prismatic", [saved]);
    });

    it("finds long literal parameter text near the end of a capture", () => {
        const literal = "[calibration]+(wavelength)?{spectrum}.*^$|\\";
        const padding = "ordinary text ".repeat(1000);
        const captured = entry(1, { blockText: padding + literal });
        const parameter = entry(2, { code: code({ type: "text", fields: { TEXT: padding + literal } }) });
        matches(createBackpackSearch([captured, entry(3), parameter]), literal, [captured, parameter]);
    });

    it("does not index binary data, IDs, coordinates, field keys, or unrelated flags", () => {
        const saved = entry(1, {
            previewUri: "data:image/png;base64,thumbnailpayload", createdAt: 975318642,
            projectBlocks: { privateblock: "privatefilename" },
            code: code({ type: "pxt-on-start", id: "quartzidentifier", x: 918273645, y: 564738291,
                data: "opaqueannotation", collapsed: true, enabled: false, inline: true,
                disabledReasons: ["disabledsentinel"], icons: { comment: { text: "hiddenannotation" } },
                fields: { SECRETKEY: { name: "dandelion", id: "velvetidentifier", data: "encodedpayload",
                    jres: "resourcepayload", bitmap: "rasterpayload", pixels: [719346825] }, CHECKBOX: true },
                extraState: { functionid: "functionidentifier", arguments: [{ id: "argumentidentifier" }] }
            })
        });
        const search = createBackpackSearch([saved]);
        matches(search, "dandelion", [saved]);
        for (const query of ["thumbnailpayload", "privatefilename", "quartzidentifier", "918273645",
            "opaqueannotation", "SECRETKEY", "encodedpayload", "rasterpayload", "functionidentifier"]) {
            matches(search, query, []);
        }
    });

    it("keeps malformed captures searchable and inspects only safe names on recovery cards", () => {
        const saved = entry(1, { name: "Orchard", blockText: "gyroscope", dependencies: { neopixel: "*" }, code: "{broken" });
        const invalid = { id: "damaged", source: "cloud", name: "Recovery sketch", error: "invalid" };
        for (const key of ["code", "blockText", "dependencies", "previewUri", "projectBlocks"]) {
            Object.defineProperty(invalid, key, { get: () => assert.fail(`Recovery ${key} must not be read`) });
        }
        const search = createBackpackSearch(Object.freeze([freeze(saved), Object.freeze(invalid)]));
        matches(search, "orchard gyroscope neopixel", [saved]);
        matches(search, "recovery sketch", [invalid]);
        matches(search, "recovery neopixel", []);
    });
});