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
const item = (id, overrides = {}) => ({
    id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    name: "Saved routine", code: code({ type: "pxt-on-start" }), blockText: "",
    dependencies: {}, createdAt: 1, ...overrides
});
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
        assert.strictEqual(actual[index], entry, `Original item/order for ${JSON.stringify(query)} at ${index}`);
    });
}

describe("backpack search (fresh source, real Fuse)", () => {
    it("uses the installed Fuse 3.2.0", () => {
        assert.strictEqual(require("fuse.js/package.json").version, "3.2.0");
    });

    it("matches name substrings, modest typos, and case without sorting by relevance", () => {
        const first = item(1, { name: "Collect strawberxy" });
        const other = item(2, { name: "Launch rocket" });
        const last = item(3, { name: "Strawberry" });
        const search = createBackpackSearch([first, other, last]);
        matches(search, "strawberry", [first, last]);
        matches(search, "STRAWBER", [first, last]);
        matches(search, "strawbery", [first, last]);
        matches(search, "stxxxxxxry", []);
        matches(search, "rocket", [other]);
    });

    it("returns every original item in order for blank queries, and an empty array for misses", () => {
        const items = freeze([item(9), item(2), item(7)]);
        const search = createBackpackSearch(items);
        for (const query of ["", " ", "\t\r\n  "]) matches(search, query, items);
        matches(search, "zygomorphic", []);
        matches(search, "", items);
        for (const query of ["", " \n", "strawberry"]) matches(createBackpackSearch([]), query, []);
    });

    it("combines a name with nested block types, including split identifiers", () => {
        const saved = item(1, {
            name: "Orchard",
            code: code({ type: "controls_repeat_ext", inputs: {
                DO: { block: { type: "radio_sendNumber" } }
            } })
        });
        const other = item(2, { name: "Orchard" });
        const search = createBackpackSearch([other, saved]);
        for (const query of ["radio_sendNumber", "send number", "ORCHARD radio", "orchard repeat"]) {
            matches(search, query, [saved]);
        }
    });

    it("finds captured displayed labels even when their extension is absent from the project", () => {
        const saved = item(1, {
            code: code({ type: "vendor_action" }),
            blockText: "Calibrate gyroscope anticlockwise",
            dependencies: { vendor: "github:acme/device#v1.0.0" }
        });
        const search = createBackpackSearch([item(2), saved]);
        for (const query of ["gyroscope", "ANTICLOCKWISE", "calibrate gyroscope"]) {
            matches(search, query, [saved]);
        }
    });

    it("indexes numeric and text fields and serialized variable names", () => {
        const saved = item(1, { code: code({ type: "pxt-on-start", inputs: {
            HANDLER: { block: { type: "variables_set", fields: {
                VAR: { id: "internal-variable-id", name: "altitude" }
            }, inputs: {
                VALUE: { block: { type: "text", fields: { TEXT: "cumulonimbus" } } }
            }, next: { block: { type: "math_number", fields: { NUM: 8675309 } } } } }
        } }) });
        const search = createBackpackSearch([item(2), saved]);
        for (const query of ["8675309", "cumulonimbus", "altitude", "altitude cumulonimbus"]) {
            matches(search, query, [saved]);
        }
    });

    it("walks nested inputs, obscured shadows, and both kinds of next connection", () => {
        const saved = item(1, { code: code({ type: "pxt-on-start", inputs: {
            HANDLER: { block: { type: "variables_set", inputs: {
                VALUE: {
                    shadow: { type: "text", fields: { TEXT: "saffron" } },
                    block: { type: "text_join", inputs: {
                        ADD0: { block: { type: "text", fields: { TEXT: "telescope" } } }
                    } }
                }
            }, next: {
                shadow: { type: "text", fields: { TEXT: "marigold" } },
                block: { type: "music_playTone", next: {
                    block: { type: "text", fields: { TEXT: "quicksilver" } }
                } }
            } } }
        } }) });
        const search = createBackpackSearch([saved, item(2)]);
        for (const query of ["saffron", "telescope", "marigold", "quicksilver", "music_playTone"]) {
            matches(search, query, [saved]);
        }
    });

    it("searches included function definitions, their arguments, and their bodies", () => {
        const extraState = {
            name: "illuminate", functionid: "internal-function-id",
            arguments: [{ id: "internal-argument-id", name: "wavelength", type: "number" }]
        };
        const saved = item(1, { code: code(
            { type: "function_definition", extraState, inputs: {
                STACK: { block: { type: "text", fields: { TEXT: "ultraviolet" } } }
            } },
            { type: "pxt-on-start", inputs: {
                HANDLER: { block: { type: "function_call", extraState } }
            } }
        ) });
        const search = createBackpackSearch([item(2), saved]);
        for (const query of ["illuminate", "wavelength", "ultraviolet", "definition", "illuminate wavelength ultraviolet"]) {
            matches(search, query, [saved]);
        }
    });

    it("searches every dependency key, GitHub owner/repository, and locally supplied display name", () => {
        const saved = item(1, { dependencies: {
            animation: "*", neopixel: "github:adafruit/chromatic#v1.0.0", sonar: "github:contoso/echolocation#v2.0.0"
        } });
        const items = [item(2), saved];
        const search = createBackpackSearch(items);
        for (const query of ["animation", "neopixel", "sonar", "adafruit", "chromatic", "contoso", "echolocation", "adafruit/chromatic"]) {
            matches(search, query, [saved]);
        }
        const calls = [];
        const installed = { neopixel: "Prismatic illumination" };
        const namedSearch = createBackpackSearch(items, name => {
            calls.push(name);
            return installed[name];
        });
        const indexedCalls = calls.slice();
        assert.deepStrictEqual([...new Set(calls)].sort(), Object.keys(saved.dependencies).sort());
        matches(namedSearch, "prismatic illumination", [saved]);
        matches(namedSearch, "sonar", [saved]);
        matches(search, "prismatic", []);
        assert.deepStrictEqual(calls, indexedCalls, "Queries must not resolve packages again");
    });

    it("requires every word, allowing words to match across name, block, and extension fields", () => {
        const saved = item(1, { name: "Orchard", blockText: "gyroscope", dependencies: { neopixel: "*" } });
        const noBlock = item(2, { name: "Orchard", dependencies: { neopixel: "*" } });
        const noExtension = item(3, { name: "Orchard", blockText: "gyroscope" });
        const noName = item(4, { blockText: "gyroscope", dependencies: { neopixel: "*" } });
        const search = createBackpackSearch([noBlock, saved, noExtension, noName]);
        matches(search, "orchard gyroscope neopixel", [saved]);
        matches(search, "  NEOPIXEL\tOrchard\nGyroscope orchard  ", [saved]);
        matches(search, "orchard gyroscope", [saved, noExtension]);
        matches(search, "orchard gyroscope neopixel zygomorphic", []);
    });

    it("handles literal punctuation and regex characters, including long parameter queries", () => {
        const values = ["[](){}.*+?^$|\\", "https://example.org/device#status", "[calibration]+(wavelength)?{spectrum}.*^$|\\"];
        for (const value of values) {
            const saved = item(1, { code: code({ type: "text", fields: { TEXT: `prefix ${value} suffix` } }) });
            const search = createBackpackSearch([item(2), saved]);
            matches(search, value, [saved]);
        }
    });

    it("matches text near the end of long captured snippets and serialized parameters", () => {
        const padding = "ordinary text ".repeat(1000);
        const captured = item(1, { blockText: padding + "quicksilver" });
        const parameter = item(2, { code: code({ type: "text", fields: { TEXT: padding + "quicksilver" } }) });
        matches(createBackpackSearch([captured, item(3), parameter]), "quicksilver", [captured, parameter]);
    });

    it("does not index binary data, IDs, coordinates, field keys, or unrelated flags", () => {
        const saved = item(1, {
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
        for (const query of [saved.id, "thumbnailpayload", "975318642", "privateblock", "privatefilename",
            "quartzidentifier", "918273645", "564738291", "opaqueannotation", "disabledsentinel", "hiddenannotation",
            "SECRETKEY", "velvetidentifier", "encodedpayload", "resourcepayload", "rasterpayload", "719346825",
            "functionidentifier", "argumentidentifier", "collapsed", "enabled", "CHECKBOX", "true", "false"]) {
            matches(search, query, []);
        }
    });

    it("fails soft on malformed code while retaining names, captured labels, and extensions", () => {
        for (const malformed of ["", "{broken", "<xml><block/></xml>", "null", "[]", "{}", '{"blocks":{}}',
            '{"blocks":[null,42,[],{"inputs":{"VALUE":null},"next":false,"fields":null}]}']) {
            const saved = item(1, { name: "Orchard", blockText: "gyroscope",
                dependencies: { neopixel: "*" }, code: malformed });
            const search = createBackpackSearch([saved, item(2)]);
            for (const query of ["orchard", "gyroscope", "neopixel", "orchard gyroscope neopixel"]) {
                matches(search, query, [saved]);
            }
            matches(search, "zygomorphic", []);
        }
    });

    it("never mutates the input collection or items while indexing or repeatedly searching", () => {
        const items = freeze([item(8, {
            name: "Orchard", blockText: "gyroscope", dependencies: { neopixel: "*" },
            projectBlocks: { custom_action: "custom.ts" }, previewUri: "data:image/png;base64,preview",
            code: code({ type: "variables_get", fields: { VAR: { id: "original", name: "altitude" } } })
        }), item(3, { code: "{broken", blockText: "quicksilver" })]);
        const before = JSON.stringify(items);
        const search = createBackpackSearch(items, name => name === "neopixel" ? "Prismatic" : undefined);
        for (let repeat = 0; repeat < 2; repeat++) {
            matches(search, "orchard altitude prismatic", [items[0]]);
            matches(search, "quicksilver", [items[1]]);
            matches(search, "zygomorphic", []);
            matches(search, "", items);
        }
        assert.strictEqual(JSON.stringify(items), before);
    });
});