"use strict";

const assert = require("assert");
const fs = require("fs");
const ts = require("typescript");
const compile = text => ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText;

function environment() {
    const reported = [];
    const pxt = {
        reportException: error => reported.push(error),
        appTarget: { bundledpkgs: { core: {} } },
        Util: { jsonTryParse: text => { try { return JSON.parse(text); } catch { return undefined; } } }
    };
    const errors = {};
    new Function("exports", "pxt", compile(fs.readFileSync("webapp/src/backpackErrors.ts", "utf8")))(errors, pxt);
    return { errors, pxt, reported };
}

describe("Backpack user-facing error boundary", () => {
    it("keeps deliberately marked messages, including the existing PXT user-error convention", () => {
        const { errors, reported } = environment();
        const expected = new errors.BackpackUserError("Delete some snippets and try again.");
        const standard = new Error("This snippet is too large.");
        standard.isUserError = true;
        for (const error of [expected, standard]) {
            assert.equal(errors.backpackUserErrorMessage(error, "Try again."), error.message);
        }
        assert.deepStrictEqual(reported, []);
    });

    describe("Backpack validation error classification", () => {
        const validatorSource = compile(fs.readFileSync("webapp/src/backpack.ts", "utf8"));
        const item = () => ({
            id: "00000000-0000-4000-8000-000000000001",
            name: "Jump", kind: "code", versions: { target: "1.0.0", pxt: "13.2.4" },
            code: JSON.stringify({ blocks: [{ type: "pxt-on-start" }] }),
            blockText: "on start", createdAt: 1, dependencies: { core: "*" }
        });
        const previewUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
        const load = () => {
            const context = environment();
            const validator = {};
            new Function("exports", "require", "pxt", "lf", validatorSource)(validator, id => {
                assert.equal(id, "./backpackErrors");
                return context.errors;
            }, context.pxt, (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]));
            return { ...context, validator };
        };

        it("logs malformed metadata without displaying its diagnostic message", () => {
            const { validator, errors, reported } = load();
            const cases = [
                { id: "invalid-id" },
                { createdAt: -1 },
                { createdAt: "not-a-timestamp" },
                { previewUri, previewPixelDensity: 3 },
                { versions: { target: "invalid", pxt: "13.2.4" } },
                { name: 42 },
                { kind: "unknown" },
                { code: {} },
                { kind: "asset" },
                { blockText: {} },
                { previewUri: "not-a-PNG" },
                { dependencies: [] },
                { projectBlocks: { custom: 42 } }
            ];
            for (const overrides of cases) {
                assert.throws(() => validator.validateBackpackItem({ ...item(), ...overrides }), error => {
                    assert(error instanceof Error);
                    assert.equal(errors.isBackpackUserError(error), false, error.message);
                    assert.equal(errors.backpackUserErrorMessage(error, "Could not save this asset. Please try again."),
                        "Could not save this asset. Please try again.");
                    assert.strictEqual(reported[reported.length - 1], error);
                    return true;
                });
            }
            assert.equal(reported.length, cases.length);
        });

        it("preserves actionable name and size-limit messages without changing accepted limits", () => {
            const { validator, errors, reported } = load();
            validator.validateBackpackItem({ ...item(), name: "a".repeat(100) });
            validator.validateBackpackItem({ ...item(), code: item().code.padEnd(validator.MAX_BACKPACK_CODE_LENGTH, " ") });
            for (const overrides of [{ name: "" }, { name: "a".repeat(101) },
                { code: item().code.padEnd(validator.MAX_BACKPACK_CODE_LENGTH + 1, " ") }]) {
                assert.throws(() => validator.validateBackpackItem({ ...item(), ...overrides }), error => {
                    assert.equal(errors.isBackpackUserError(error), true);
                    assert.match(errors.backpackUserErrorMessage(error, "Unexpected fallback"), /names must|too large/);
                    return true;
                });
            }
            assert.deepStrictEqual(reported, []);
        });

        it("retains old and versioned content verbatim, but rejects unsupported formats", () => {
            const { validator, errors } = load();
            const old = item();
            const current = { ...old, code: JSON.stringify({ version: 1, blocks: JSON.parse(old.code).blocks }) };
            for (const saved of [old, current]) {
                assert.deepStrictEqual(validator.validateBackpackItem(saved), saved);
            }
            for (const version of [2, "1", null]) {
                assert.throws(() => validator.validateBackpackItem({
                    ...old, code: JSON.stringify({ version, blocks: JSON.parse(old.code).blocks })
                }), error => errors.isBackpackUserError(error) && /unsupported Backpack format/.test(error.message));
            }
        });
    });

    it("reports unmarked technical errors and non-Error rejections without displaying their details", () => {
        const { errors, reported } = environment();
        const failures = [new TypeError("PRIVATE_DETAILS"), new Error("PRIVATE_DETAILS"),
            "PRIVATE_DETAILS", { message: "PRIVATE_DETAILS", isUserError: true }];
        for (const error of failures) {
            assert.equal(errors.backpackUserErrorMessage(error, "Could not save this asset. Please try again."),
                "Could not save this asset. Please try again.");
        }
        assert.deepStrictEqual(reported, failures);
    });
});

// Run the actual save handler with only the editor, storage and React-state boundaries supplied.
const source = ts.createSourceFile("BackpackAssetEditDialog.tsx",
    fs.readFileSync("webapp/src/components/projectTools/BackpackAssetEditDialog.tsx", "utf8"),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "BackpackAssetEditDialog");
const declaration = component.body.statements.filter(ts.isVariableStatement)
    .flatMap(statement => statement.declarationList.declarations).find(node => node.name.getText(source) === "save");
assert(declaration, "The native asset dialog must expose its save handler.");
const handlerSource = compile(`exports.create = function() { const ${declaration.getText(source)}; return save; };`);

describe("Backpack asset dialog save errors", () => {
    async function saveWith(reason, stage = "persist") {
        const { errors, pxt, reported } = environment();
        const messages = [];
        const pending = [];
        const current = { save: () => {
            if (stage === "native") throw reason;
            return { code: "asset-code", blockText: "asset", name: "Asset" };
        } };
        const session = { current };
        const saving = { current: false };
        const props = {
            item: { name: "Asset" }, context: { blocksInfo: {} },
            onSave: async () => { throw reason; }
        };
        pxt.appTarget = { versions: { target: "1.0.0", pxt: "13.2.4" } };
        const globals = {
            pxt, props, session, saving, editor: { current: undefined },
            pkg: { mainPkg: {} }, lf: text => text,
            getBackpackRequirements: () => {
                if (stage === "requirements") throw reason;
                return { dependencies: {}, projectBlocks: {} };
            },
            setPending: value => pending.push(value),
            setError: value => messages.push(value),
            backpackUserErrorMessage: errors.backpackUserErrorMessage
        };
        const module = {};
        new Function("exports", ...Object.keys(globals), handlerSource)(module, ...Object.values(globals));
        await module.create()();
        assert.equal(saving.current, false);
        assert.deepStrictEqual(pending, [true, false]);
        return { errors, reported, messages };
    }

    it("shows an expected user message and preserves retry readiness", async () => {
        const { errors } = environment();
        const error = new errors.BackpackUserError("Your backpack is full.");
        const result = await saveWith(error);
        assert.deepStrictEqual(result.messages, [undefined, "Your backpack is full."]);
        assert.deepStrictEqual(result.reported, []);
    });

    it("shows a generic failure and logs the original technical exception", async () => {
        for (const stage of ["native", "requirements", "persist"]) {
            const error = new Error("PRIVATE_DETAILS");
            const result = await saveWith(error, stage);
            assert.deepStrictEqual(result.messages, [undefined, "Could not save this asset. Please try again."]);
            assert.deepStrictEqual(result.reported, [error]);
        }
    });
});

describe("Backpack asset dialog open errors", () => {
    it("logs a technical open failure without telling the user to delete their asset", () => {
        const { errors, pxt, reported } = environment();
        const effects = component.body.statements.filter(ts.isExpressionStatement)
            .map(statement => statement.expression).filter(expression =>
                ts.isCallExpression(expression) && expression.expression.getText(source) === "React.useLayoutEffect");
        assert.equal(effects.length, 2);
        const openSource = compile(`exports.open = ${effects[1].arguments[0].getText(source)};`);
        const reason = new TypeError("PRIVATE_LOADER_DETAILS");
        const messages = [];
        let disposed = false;
        pxt.TilemapProject = class {};
        const globals = {
            pxt, lf: text => text, session: {}, store: {}, scalarHost: {},
            props: {
                item: { code: "", name: "Asset" }, context: { gallery: {} },
                onOpenError: message => messages.push(message)
            },
            BackpackAssetEditor: class {
                open() { throw reason; }
                dispose() { disposed = true; }
            },
            createStore: () => ({}),
            setAsset: () => assert.fail("Failed asset should not be opened"),
            backpackUserErrorMessage: errors.backpackUserErrorMessage
        };
        const module = {};
        new Function("exports", ...Object.keys(globals), openSource)(module, ...Object.values(globals));
        const dispose = module.open();
        assert.deepStrictEqual(messages, ["Could not open this asset. Please try again."]);
        assert.deepStrictEqual(reported, [reason]);
        dispose();
        assert.equal(disposed, true);
    });
});
