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
    it("indexes all cloud summary text/types/dependencies without fetching or inventing code", () => {
        const cloud = { id: "cloud", source: "cloud", name: "Orchard", createdAt: 1,
            summary: { id: "cloud", name: "Orchard", blockText: "altitude cumulonimbus 8675309",
                blockTypes: ["radio_sendNumber"], dependencies: { radio: "github:acme/telemetry#v1" },
                version: "etag", createdAt: 1, updatedAt: 1, status: "ready", hasPreview: true } };
        Object.defineProperty(cloud, "code", { get: () => assert.fail("No code on a summary") });
        const search = createBackpackSearch(freeze([entry(2), cloud]), name => name === "radio" ? "Wireless" : undefined);
        for (const query of ["orchard", "altitude", "cumulonimbus", "8675309", "radio", "send number",
            "telemetry", "wireless", "orchard altitude telemetry"]) matches(search, query, [cloud]);
        const invalid = { ...cloud, error: "invalid" };
        matches(createBackpackSearch([invalid]), "orchard", [invalid]);
        matches(createBackpackSearch([invalid]), "telemetry", []);
    });

    it("uses the installed Fuse 3.2.0", () => {
        assert.strictEqual(require("fuse.js/package.json").version, "3.2.0");
    });

    it("matches name substrings, modest typos, and case without sorting by relevance", () => {
        const first = entry(1, { name: "Collect strawberxy" });
        const other = entry(2, { name: "Launch rocket" });
        const last = entry(3, { name: "Strawberry" });
        const search = createBackpackSearch([first, other, last]);
        matches(search, "strawberry", [first, last]);
        matches(search, "STRAWBER", [first, last]);
        matches(search, "strawbery", [first, last]);
        matches(search, "stxxxxxxry", []);
        matches(search, "rocket", [other]);
    });

    it("returns every original entry in order for blank queries, and an empty array for misses", () => {
        const entries = freeze([entry(9), entry(2), entry(7)]);
        const search = createBackpackSearch(entries);
        for (const query of ["", " ", "\t\r\n  "]) {
            matches(search, query, entries);
            assert.strictEqual(search(query), entries, "Blank queries preserve collection identity");
        }
        matches(search, "zygomorphic", []);
        matches(search, "", entries);
        for (const query of ["", " \n", "strawberry"]) matches(createBackpackSearch([]), query, []);
    });

    it("combines a name with nested block types, including split identifiers", () => {
        const saved = entry(1, {
            name: "Orchard",
            code: code({ type: "controls_repeat_ext", inputs: {
                DO: { block: { type: "radio_sendNumber" } }
            } })
        });
        const other = entry(2, { name: "Orchard" });
        const search = createBackpackSearch([other, saved]);
        for (const query of ["radio_sendNumber", "send number", "ORCHARD radio", "orchard repeat"]) {
            matches(search, query, [saved]);
        }
    });

    it("finds captured displayed labels even when their extension is absent from the project", () => {
        const saved = entry(1, {
            code: code({ type: "vendor_action" }),
            blockText: "Calibrate gyroscope anticlockwise",
            dependencies: { vendor: "github:acme/device#v1.0.0" }
        });
        const search = createBackpackSearch([entry(2), saved]);
        for (const query of ["gyroscope", "ANTICLOCKWISE", "calibrate gyroscope"]) {
            matches(search, query, [saved]);
        }
    });

    it("indexes numeric and text fields and serialized variable names", () => {
        const saved = entry(1, { code: code({ type: "pxt-on-start", inputs: {
            HANDLER: { block: { type: "variables_set", fields: {
                VAR: { id: "internal-variable-id", name: "altitude" }
            }, inputs: {
                VALUE: { block: { type: "text", fields: { TEXT: "cumulonimbus" } } }
            }, next: { block: { type: "math_number", fields: { NUM: 8675309 } } } } }
        } }) });
        const search = createBackpackSearch([entry(2), saved]);
        for (const query of ["8675309", "cumulonimbus", "altitude", "altitude cumulonimbus"]) {
            matches(search, query, [saved]);
        }
    });

    it("walks nested inputs, obscured shadows, and both kinds of next connection", () => {
        const saved = entry(1, { code: code({ type: "pxt-on-start", inputs: {
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
        const search = createBackpackSearch([saved, entry(2)]);
        for (const query of ["saffron", "telescope", "marigold", "quicksilver", "music_playTone"]) {
            matches(search, query, [saved]);
        }
    });

    it("searches included function definitions, their arguments, and their bodies", () => {
        const extraState = {
            name: "illuminate", functionid: "internal-function-id",
            arguments: [{ id: "internal-argument-id", name: "wavelength", type: "number" }]
        };
        const saved = entry(1, { code: code(
            { type: "function_definition", extraState, inputs: {
                STACK: { block: { type: "text", fields: { TEXT: "ultraviolet" } } }
            } },
            { type: "pxt-on-start", inputs: {
                HANDLER: { block: { type: "function_call", extraState } }
            } }
        ) });
        const search = createBackpackSearch([entry(2), saved]);
        for (const query of ["illuminate", "wavelength", "ultraviolet", "definition", "illuminate wavelength ultraviolet"]) {
            matches(search, query, [saved]);
        }
    });

    it("searches every dependency key, GitHub owner/repository, and locally supplied display name", () => {
        const saved = entry(1, { dependencies: {
            animation: "*", neopixel: "github:adafruit/chromatic#v1.0.0", sonar: "github:contoso/echolocation#v2.0.0"
        } });
        const entries = [entry(2), saved];
        const search = createBackpackSearch(entries);
        for (const query of ["animation", "neopixel", "sonar", "adafruit", "chromatic", "contoso", "echolocation", "adafruit/chromatic"]) {
            matches(search, query, [saved]);
        }
        const calls = [];
        const installed = { neopixel: "Prismatic illumination" };
        const namedSearch = createBackpackSearch(entries, name => {
            calls.push(name);
            return installed[name];
        });
        const indexedCalls = calls.slice();
        assert.deepStrictEqual([...new Set(calls)].sort(), Object.keys(saved.item.dependencies).sort());
        matches(namedSearch, "prismatic illumination", [saved]);
        matches(namedSearch, "sonar", [saved]);
        matches(search, "prismatic", []);
        assert.deepStrictEqual(calls, indexedCalls, "Queries must not resolve packages again");
    });

    it("requires every word, allowing words to match across name, block, and extension fields", () => {
        const saved = entry(1, { name: "Orchard", blockText: "gyroscope", dependencies: { neopixel: "*" } });
        const noBlock = entry(2, { name: "Orchard", dependencies: { neopixel: "*" } });
        const noExtension = entry(3, { name: "Orchard", blockText: "gyroscope" });
        const noName = entry(4, { blockText: "gyroscope", dependencies: { neopixel: "*" } });
        const search = createBackpackSearch([noBlock, saved, noExtension, noName]);
        matches(search, "orchard gyroscope neopixel", [saved]);
        matches(search, "  NEOPIXEL\tOrchard\nGyroscope orchard  ", [saved]);
        matches(search, "orchard gyroscope", [saved, noExtension]);
        matches(search, "orchard gyroscope neopixel zygomorphic", []);
    });

    it("handles literal punctuation and regex characters, including long parameter queries", () => {
        const values = ["[](){}.*+?^$|\\", "https://example.org/device#status", "[calibration]+(wavelength)?{spectrum}.*^$|\\"];
        for (const value of values) {
            const saved = entry(1, { code: code({ type: "text", fields: { TEXT: `prefix ${value} suffix` } }) });
            const search = createBackpackSearch([entry(2), saved]);
            matches(search, value, [saved]);
        }
    });

    it("matches text near the end of long captured snippets and serialized parameters", () => {
        const padding = "ordinary text ".repeat(1000);
        const captured = entry(1, { blockText: padding + "quicksilver" });
        const parameter = entry(2, { code: code({ type: "text", fields: { TEXT: padding + "quicksilver" } }) });
        matches(createBackpackSearch([captured, entry(3), parameter]), "quicksilver", [captured, parameter]);
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
            const saved = entry(1, { name: "Orchard", blockText: "gyroscope",
                dependencies: { neopixel: "*" }, code: malformed });
            const search = createBackpackSearch([saved, entry(2)]);
            for (const query of ["orchard", "gyroscope", "neopixel", "orchard gyroscope neopixel"]) {
                matches(search, query, [saved]);
            }
            matches(search, "zygomorphic", []);
        }
    });

    it("searches invalid recovery cards by safe name only without evaluating code or metadata", () => {
        for (const source of ["local", "cloud"]) {
            const invalid = {
                id: "quartzidentifier", source, name: "Orchard recovery",
                createdAt: 975318642, error: "zygomorphic"
            };
            // These traps stand in for unsafe raw data: recovery cards have no
            // validated item, so indexing must never attempt to inspect it.
            for (const key of ["code", "blockText", "dependencies", "previewUri", "projectBlocks"]) {
                Object.defineProperty(invalid, key, {
                    enumerable: true,
                    get: () => assert.fail(`Invalid entry ${key} must not be evaluated`)
                });
            }
            Object.freeze(invalid);
            assert.strictEqual(Object.prototype.hasOwnProperty.call(invalid, "item"), false);
            const other = freeze(entry(2));
            const entries = Object.freeze([other, invalid]);
            const search = createBackpackSearch(entries, () => {
                assert.fail("Invalid entries must not resolve extension metadata");
            });
            for (let repeat = 0; repeat < 2; repeat++) {
                for (const query of ["orchard", "RECOVERY", "orchard recovery"]) {
                    matches(search, query, [invalid]);
                }
                for (const query of [invalid.id, invalid.error, String(invalid.createdAt), source,
                    "gyroscope", "neopixel", "orchard zygomorphic"]) {
                    matches(search, query, []);
                }
                matches(search, "pxt-on-start", [other]);
                matches(search, "", entries);
                assert.strictEqual(search(""), entries);
            }
        }
    });

    it("keeps same-ID local and cloud matches independent and in collection order", () => {
        const local = freeze(entry(1, {
            name: "Orchard strawberxy", blockText: "gyroscope", dependencies: { neopixel: "*" }
        }, "local"));
        const cloud = freeze(entry(1, {
            name: "Orchard strawberry",
            code: code({ type: "text", fields: { TEXT: "quicksilver" } }),
            dependencies: { animation: "*" }
        }, "cloud"));
        const other = freeze(entry(2, { name: "Launch rocket" }));
        assert.strictEqual(local.id, cloud.id);
        assert.notStrictEqual(local.source, cloud.source);
        for (const entries of [freeze([local, other, cloud]), freeze([cloud, other, local])]) {
            const before = JSON.stringify(entries);
            const search = createBackpackSearch(entries);
            const shared = entries.filter(entry => entry !== other);
            for (let repeat = 0; repeat < 2; repeat++) {
                for (const query of ["orchard", "strawberry", "orchard strawberry"]) {
                    matches(search, query, shared);
                }
                for (const query of ["gyroscope", "neopixel", "orchard gyroscope neopixel"]) {
                    matches(search, query, [local]);
                }
                for (const query of ["quicksilver", "animation", "orchard quicksilver animation"]) {
                    matches(search, query, [cloud]);
                }
                for (const query of ["gyroscope quicksilver", "neopixel animation",
                    "gyroscope animation", "quicksilver neopixel"]) {
                    matches(search, query, []);
                }
                matches(search, "rocket", [other]);
                matches(search, "", entries);
                assert.strictEqual(search(""), entries);
            }
            assert.strictEqual(JSON.stringify(entries), before);
        }
    });

    it("never mutates the input collection, entries, or nested items while indexing or repeatedly searching", () => {
        const entries = freeze([entry(8, {
            name: "Orchard", blockText: "gyroscope", dependencies: { neopixel: "*" },
            projectBlocks: { custom_action: "custom.ts" }, previewUri: "data:image/png;base64,preview",
            code: code({ type: "variables_get", fields: { VAR: { id: "original", name: "altitude" } } })
        }), entry(3, { code: "{broken", blockText: "quicksilver" }, "cloud")]);
        const before = JSON.stringify(entries);
        const originalItems = entries.map(entry => entry.item);
        const search = createBackpackSearch(entries, name => name === "neopixel" ? "Prismatic" : undefined);
        for (let repeat = 0; repeat < 2; repeat++) {
            matches(search, "orchard altitude prismatic", [entries[0]]);
            matches(search, "quicksilver", [entries[1]]);
            matches(search, "zygomorphic", []);
            matches(search, "", entries);
            assert.strictEqual(search(""), entries);
        }
        entries.forEach((entry, index) => assert.strictEqual(entry.item, originalItems[index]));
        assert.strictEqual(JSON.stringify(entries), before);
    });
});