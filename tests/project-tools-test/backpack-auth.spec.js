"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const compile = source => {
    const result = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
        reportDiagnostics: true
    });
    assert.deepStrictEqual(result.diagnostics, []);
    return result.outputText;
};

// Load the entire current auth module, including its private settingsOnly helper.
// Extract only the production JSON Patch namespace to avoid unrelated util startup.
const authSource = compile(read("pxtlib/auth.ts"));
const utilSource = ts.createSourceFile("util.ts", read("pxtlib/util.ts"), ts.ScriptTarget.Latest, true);
const patchNamespace = utilSource.statements.find(node =>
    ts.isModuleDeclaration(node) && node.name.text === "ts"
    && ts.isModuleDeclaration(node.body) && node.body.name.text === "pxtc"
    && ts.isModuleDeclaration(node.body.body) && node.body.body.name.text === "jsonPatch"
    && ts.isModuleBlock(node.body.body.body));
assert(patchNamespace, "production ts.pxtc.jsonPatch namespace");
const patchSource = compile(patchNamespace.getText(utilSource));

function preferences() {
    return {
        language: "en", highContrast: false, screenReaderMode: true,
        colorThemeIds: { arcade: "dark" },
        simulatorThemes: { arcade: { presetId: "custom", theme: { layout: "default", "background-color": "#123456" } } },
        skillmap: { mapProgress: { lesson: { completed: true } }, completedTags: { tutorial: 1 } },
        badges: { badges: [{ id: "badge", sourceURL: "tutorial" }] }, email: true,
        backpack: { arcade: { old: { name: "Unreleased snippet", code: "private legacy content" } } }
    };
}

function assertSettings(actual, expected) {
    assert(actual);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(actual, "backpack"), false);
    assert.deepStrictEqual(clone(actual), expected);
}

function environment({ loggedIn = true, patchSuccess = true } = {}) {
    const original = { profile: { id: "alice" }, preferences: preferences() };
    let stored = clone(original);
    const remote = preferences();
    const requests = [], reads = [], writes = [], changes = [], pending = [], errors = [];
    const forbidden = () => { throw new Error("Unexpected auth dependency or side effect"); };
    const pxt = {
        appTarget: { id: "arcade", appTheme: { defaultLocale: "en" } },
        Util: { deepCopy: clone },
        reportError: (...args) => errors.push(args),
        storage: { shared: {
            async getAsync(container, key) {
                reads.push([container, key]);
                assert.deepStrictEqual([container, key], ["auth", "user-state"]);
                // Return the actual object so accidental in-place sanitization is visible.
                return stored;
            },
            async setAsync(container, key, value) {
                assert.deepStrictEqual([container, key], ["auth", "user-state"]);
                writes.push(clone(value));
                stored = clone(value);
            },
            delAsync: forbidden
        } }
    };
    const context = vm.createContext({ pxt, U: pxt.Util, setTimeout: forbidden, clearTimeout: () => {} });
    vm.runInContext(patchSource, context);
    context.pxtc = context.ts.pxtc;
    vm.runInContext(authSource, context);
    const auth = pxt.auth;
    const jsonPatch = context.pxtc.jsonPatch;
    const client = new auth.AuthClient();
    // Stub only the login gate and transport; preference reads, writes, filtering,
    // queuing and both local/remote diffs remain production implementations.
    client.loggedInAsync = async () => loggedIn;
    client.onUserPreferencesChanged = async diff => { changes.push(clone(diff)); };
    client.apiAsync = async (url, data, method = "GET") => {
        requests.push({ url, method, data: clone(data) });
        assert.strictEqual(url, "/api/user/preferences");
        assert(["GET", "PATCH"].includes(method));
        if (method === "PATCH" && patchSuccess) jsonPatch.patchInPlace(remote, data);
        return { success: method === "GET" || patchSuccess, resp: clone(remote) };
    };
    // The successful PATCH path deliberately does not await this setter. Track
    // the real operation rather than relying on sleeps or a fixed microtask count.
    const setPreferences = client.setUserPreferencesAsync.bind(client);
    client.setUserPreferencesAsync = value => {
        const promise = setPreferences(value);
        pending.push(promise);
        return promise;
    };
    return {
        auth, client, original, remote, requests, reads, writes, changes, errors,
        stored: () => stored,
        async settle() { await Promise.all(pending); }
    };
}

describe("auth settings-only Backpack cutover (current source)", () => {
    it("excludes legacy captures from local and fetched startup settings without deleting remote data", async () => {
        const env = environment();
        const expected = preferences();
        delete expected.backpack;
        const state = await env.auth.getUserStateAsync();
        assertSettings(state.preferences, expected);
        assert.strictEqual(env.auth.cachedUserState, state);
        assert.deepStrictEqual(clone(state.profile), env.original.profile);
        assert.deepStrictEqual(env.stored(), env.original);
        assert.deepStrictEqual(env.writes, []);
        assert.deepStrictEqual(env.requests, []);
        const fetched = await env.client.initialUserPreferencesAsync();
        await env.settle();
        assertSettings(fetched, expected);
        env.writes.forEach(state => assertSettings(state.preferences, expected));
        assert.deepStrictEqual(env.remote, preferences());
    });

    it("syncs ordinary settings without diff-deleting or modifying the remote legacy map", async () => {
        const env = environment();
        const legacy = clone(env.remote.backpack);
        const result = await env.client.patchUserPreferencesAsync([
            { op: "replace", path: ["language"], value: "fr" },
            { op: "replace", path: ["highContrast"], value: true },
            { op: "add", path: ["backpack"], value: {} },
            { op: "replace", path: ["backpack", "arcade", "old", "name"], value: "Changed" },
            { op: "remove", path: ["backpack"] }
        ], { immediate: true, filter: op => op.path[0] !== "highContrast" });
        await env.settle();
        const expected = preferences();
        delete expected.backpack;
        expected.language = "fr";
        assert.strictEqual(result.success, true);
        assertSettings(result.res, expected);
        assertSettings(await env.client.userPreferencesAsync(), expected);
        assertSettings(env.auth.cachedUserState.preferences, expected);
        assert.deepStrictEqual(env.requests, [
            { url: "/api/user/preferences", method: "GET", data: undefined },
            { url: "/api/user/preferences", method: "PATCH", data: [{ op: "replace", path: ["language"], value: "fr" }] }
        ]);
        assert.deepStrictEqual(env.remote, { ...expected, backpack: legacy });
        assert(env.writes.length > 0);
        env.writes.forEach(state => {
            assertSettings(state.preferences, expected);
            assert.deepStrictEqual(state.profile, env.original.profile);
        });
        assert(env.changes.flat().every(op => op.path[0] !== "backpack"));
        assert.deepStrictEqual(env.errors, []);
    });

    it("also sanitizes preferences returned by an unsuccessful PATCH", async () => {
        const env = environment({ patchSuccess: false });
        const result = await env.client.patchUserPreferencesAsync(
            { op: "replace", path: ["language"], value: "fr" }, { immediate: true });
        const expected = preferences();
        delete expected.backpack;
        assert.strictEqual(result.success, false);
        assertSettings(result.res, expected);
        assert.deepStrictEqual(env.remote, preferences());
        assert.deepStrictEqual(env.errors, [["identity", "failed to patch preferences"]]);
    });
});