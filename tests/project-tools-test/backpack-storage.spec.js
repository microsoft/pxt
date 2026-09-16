"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "webapp/src/backpack.ts"), "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true
});
assert.deepStrictEqual(compiled.diagnostics, []);
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const item = (n, extra = {}) => ({ id: id(n), name: `Snippet ${n}`, code: "PRIVATE_CODE",
    blockText: `PRIVATE_BLOCK_TEXT ${n}`, dependencies: { core: "*" }, createdAt: n, ...extra });
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

const guestKey = (n, target = "arcade") => `${target}/backpack/guest/${id(n)}`;
const metadataItem = n => item(n, {
    dependencies: { core: "*", ext: "github:owner/repo/sub#v1.2.3", shared: "pub:_safe-id" },
    projectBlocks: { custom_block: "custom.ts", helper_block: "helpers.ts" },
    previewUri: "data:image/png;base64,iVBORw0KGgo="
});

// Native Storage semantics, including silent failed writes and post-write read
// failures. Sharing this object models tabs/reloads without sharing VM snapshots.
function simulatedStorage(data = new Map()) {
    const hooks = {};
    const calls = [];
    const invoke = (method, args, run) => {
        calls.push({ method, args });
        return hooks[method] ? hooks[method]({ args, run }) : run();
    };
    const storage = {
        get length() { return invoke("length", [], () => data.size); },
        key(index) { return invoke("key", [index], () => Array.from(data.keys())[index] ?? null); },
        getItem(key) { return invoke("getItem", [String(key)], () => data.get(String(key)) ?? null); },
        setItem(key, value) { return invoke("setItem", [String(key), String(value)], () => { data.set(String(key), String(value)); }); },
        removeItem(key) { return invoke("removeItem", [String(key)], () => { data.delete(String(key)); }); },
        clear() { return invoke("clear", [], () => { data.clear(); }); }
    };
    return { data, hooks, calls, get storage() { return invoke("access", [], () => storage); } };
}

// Source is always transpiled here; no stale built backpack/auth exports are used.
// Prefer the real built jsonPatch, falling back to the real source utility.
function environment(remote = new Map([["alice", {}], ["bob", {}]]), local = simulatedStorage()) {
    const requests = [];
    const telemetry = [];
    const context = vm.createContext({ console: { log() { throw new Error("Unexpected log"); } },
        setTimeout, clearTimeout, Uint8Array, Uint16Array, Uint32Array, ArrayBuffer, DataView,
        TextDecoder, TextEncoder, atob: s => Buffer.from(s, "base64").toString("binary"),
        btoa: s => Buffer.from(s, "binary").toString("base64") });
    const built = path.join(root, "built/pxtlib.js");
    if (fs.existsSync(built)) vm.runInContext(fs.readFileSync(built, "utf8"), context);
    else {
        const util = fs.readFileSync(path.join(root, "pxtlib/util.ts"), "utf8");
        vm.runInContext(ts.transpileModule(util, { compilerOptions: { target: ts.ScriptTarget.ES2017 } }).outputText, context);
        context.pxt = {};
    }
    // Exercise the source parser too, not a permissive fake parser.
    const github = fs.readFileSync(path.join(root, "pxtlib/github.ts"), "utf8");
    vm.runInContext(ts.transpileModule(github, { compilerOptions: { target: ts.ScriptTarget.ES2017 } }).outputText, context);
    const pxt = context.pxt;
    context.window = { get localStorage() { return local.storage; } };
    const forbiddenStorage = () => { throw new Error("Backpack must use native Storage, not shared storage or localhost APIs"); };
    Object.defineProperty(pxt, "storage", { configurable: true, get: forbiddenStorage });
    context.fetch = context.window.fetch = context.XMLHttpRequest = forbiddenStorage;
    pxt.appTarget = { id: "arcade", bundledpkgs: { core: {} } };
    let user = "alice";
    let token = "alice-session";
    let hook;
    const authCalls = [];
    const client = {
        async apiAsync(url, data, method, capturedToken) {
            assert.equal(url, "/api/user/preferences");
            assert.ok(method === "GET" || method === "PATCH");
            assert.ok(capturedToken);
            const owner = capturedToken.split("-")[0];
            requests.push({ url, method, data: clone(data), owner });
            const run = () => {
                if (method === "PATCH") {
                    for (const op of data) {
                        assert.equal(op.path[0], "backpack");
                        assert.ok(op.path.length === 3 || (op.op === "add" && JSON.stringify(op.value) === "{}")
                            || (op.op === "replace" && op.path.length === 4 && op.path[1] === pxt.appTarget.id
                                && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(op.path[2])
                                && op.path[3] === "name" && typeof op.value === "string"));
                    }
                    context.ts.pxtc.jsonPatch.patchInPlace(remote.get(owner), clone(data));
                }
                return { success: true, resp: clone(remote.get(owner)) };
            };
            if (hook) return hook({ method, owner, data, run });
            return run();
        }
    };
    pxt.auth = {
        client: () => { authCalls.push("client"); return client; },
        cachedHasAuthToken: true,
        cachedUserState: { profile: { id: user } },
        getAuthTokenAsync: async () => { authCalls.push("token"); return token; },
        getUserStateAsync: async () => { authCalls.push("state"); return { profile: user ? { id: user } : undefined }; }
    };
    pxt.log = pxt.debug = pxt.tickEvent = pxt.reportException = (...args) => {
        telemetry.push(args);
        throw new Error("Unexpected telemetry");
    };
    context.lf = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, n) => args[n]);
    const exports = {};
    vm.runInContext(`(function(exports, require) { ${compiled.outputText}\n})`, context)(exports, () => {
        throw new Error("Backpack must not import project, UI, or Blockly modules");
    });
    return { store: exports, remote, requests, telemetry, pxt, local, authCalls,
        hook: fn => { hook = fn; },
        signIn(next, nextToken = next ? `${next}-session` : undefined) {
            user = next; token = nextToken;
            pxt.auth.cachedHasAuthToken = !!token;
            pxt.auth.cachedUserState = { profile: next ? { id: next } : undefined };
        }
    };
}

function guestEnvironment(local = simulatedStorage(), remote) {
    const env = environment(remote, local);
    env.signIn(undefined);
    return env;
}

const storageWrites = local => local.calls.filter(call => ["setItem", "removeItem", "clear"].includes(call.method));
const patches = env => env.requests.filter(request => request.method === "PATCH");
const storageFailure = () => { throw new Error("sensitive storage details"); };

const recoveryError = "This snippet contains invalid or oversized data and can't be added. You can delete it from your backpack.";
const syncWarning = "Some snippets saved in this browser couldn't be synced. They haven't been removed. Try reopening your backpack, or sign out to manage those local copies.";
const quotaWarning = "Your backpack is over its storage limit. Delete snippets using their trash buttons to make room.";
const recoveryEntry = (store, key, source) => store.getBackpackState().entries.find(entry => entry.id === key && entry.source === source);
function assertRecovery(entry, key, source, name = "Unnamed snippet", createdAt = 0) {
    assert.deepStrictEqual(clone(entry), { id: key, source, name, createdAt, error: recoveryError });
    assert.equal(Object.prototype.hasOwnProperty.call(entry, "item"), false);
}
function assertSyncWarning(env, expected) {
    assert.equal(env.store.getBackpackState().warning, syncWarning);
    assert.deepStrictEqual(clone(env.store.getBackpackItems()), expected);
    assert.deepStrictEqual(env.telemetry, []);
}

describe("per-item backpack recovery", () => {
    // Missing blockText is damaged current-schema data, not a legacy migration.
    const missingText = n => {
        const value = metadataItem(n);
        delete value.blockText;
        return value;
    };
    const localKey = key => `arcade/backpack/guest/${key}`;
    function fixture(cloud, target) {
        const env = cloud ? environment() : guestEnvironment();
        if (cloud) env.remote.set("alice", { language: "fr", backpack: {
            arcade: clone(target), microbit: { [id(90)]: metadataItem(90) }
        } });
        else for (const [key, value] of Object.entries(target)) env.local.data.set(localKey(key), JSON.stringify(value));
        env.local.data.set(guestKey(90, "microbit"), JSON.stringify(metadataItem(90)));
        env.local.data.set("unrelated", "keep");
        return env;
    }
    const persisted = (env, cloud) => cloud ? clone(env.remote.get("alice").backpack.arcade)
        : Object.fromEntries(Array.from(env.local.data).filter(([key]) => key.startsWith(localKey("")))
            .map(([key, value]) => [key.slice(localKey("").length), JSON.parse(value)]));

    it("salvages bounded names and timestamps without exposing invalid code, previews, metadata or raw errors", () => {
        const env = environment();
        const cases = [
            ["  Recognizable snippet  ", "Recognizable snippet"],
            ["x".repeat(101), "x".repeat(100)],
            ["x".repeat(99) + "\nignored", "x".repeat(99)],
            ["\x00 A\tB\nC\rD\x1fE\x7f ", "A B C D E"],
            ["\n\t\x7f", "Unnamed snippet"],
            ["", "Unnamed snippet"], ["   ", "Unnamed snippet"],
            [undefined, "Unnamed snippet"], [null, "Unnamed snippet"], [42, "Unnamed snippet"],
            [[], "Unnamed snippet"], [{ toString() { throw new Error("PRIVATE_COERCION"); } }, "Unnamed snippet"],
            // Storage returns inert display text; escaping belongs to the renderer.
            ['<img src=x onerror="PRIVATE_HTML">', '<img src=x onerror="PRIVATE_HTML">']
        ];
        for (const source of ["local", "cloud"]) {
            for (const [name, expected] of cases) {
                const raw = { ...missingText(1), name, previewUri: "javascript:PRIVATE_PREVIEW",
                    headerId: "PRIVATE_HEADER", files: { "main.ts": "PRIVATE_FILE" }, error: "PRIVATE_RAW_ERROR" };
                assertRecovery(env.store.readBackpackEntry(id(1), raw, source), id(1), source, expected, 1);
            }
            for (const raw of [undefined, null, false, 7, [], "PRIVATE_RAW", '{"name":"PRIVATE_TRUNCATED"', new Date()]) {
                assertRecovery(env.store.readBackpackEntry(id(1), raw, source), id(1), source);
            }
            for (const createdAt of [undefined, null, "42", -1, NaN, Infinity, -Infinity, {}, []]) {
                assertRecovery(env.store.readBackpackEntry(id(1), { ...missingText(1), createdAt }, source),
                    id(1), source, "Snippet 1");
            }
            const raw = metadataItem(1);
            const entry = env.store.readBackpackEntry(id(1), raw, source);
            assert.deepStrictEqual(clone(entry), { id: id(1), source, name: raw.name, createdAt: 1, item: raw });
            raw.dependencies.core = "file:PRIVATE_CHANGED";
            raw.projectBlocks.custom_block = "changed.ts";
            assert.deepStrictEqual(clone(entry.item), metadataItem(1));
        }
        assert.deepStrictEqual([env.authCalls, env.requests, env.local.calls, env.telemetry], [[], [], [], []]);
    });

    for (const cloud of [false, true]) describe(cloud ? "cloud cards" : "guest cards", () => {
        const source = cloud ? "cloud" : "local";

        it("keeps good snippets visible and importable beside missing-blockText cards without migrating damaged data", async () => {
            const bad = missingText(2);
            const original = { [id(1)]: metadataItem(1), [id(2)]: bad, [id(3)]: item(3) };
            const env = fixture(cloud, original);
            let notifications = 0;
            const off = env.store.subscribeBackpack(() => { notifications++; });
            await env.store.refreshBackpackAsync();
            assert.equal(notifications, 1);
            assert.equal(env.store.getBackpackState().warning, undefined);
            assert.deepStrictEqual(clone(env.store.getBackpackState().entries.map(entry => entry.id)), [id(3), id(2), id(1)]);
            assertRecovery(recoveryEntry(env.store, id(2), source), id(2), source, "Snippet 2", 2);
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(3), metadataItem(1)]);
            assert.deepStrictEqual(persisted(env, cloud), original);
            assert.deepStrictEqual([patches(env), storageWrites(env.local)], [[], []]);

            const detached = env.store.getBackpackState();
            detached.entries[1].name = "Forged display";
            detached.entries[1].item = item(2);
            detached.entries[2].item.dependencies.core = "file:bad";
            detached.entries.pop();
            assertRecovery(recoveryEntry(env.store, id(2), source), id(2), source, "Snippet 2", 2);
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(3), metadataItem(1)]);
            const imported = [];
            const cleanup = env.store.setBackpackEditor({ headerId: () => "header", canImport: () => true,
                importAsync: async value => { imported.push(clone(value)); return true; } });
            try {
                assert.equal(env.store.canImportBackpack("header"), true);
                for (const value of env.store.getBackpackItems()) assert.equal(await env.store.importBackpackItemAsync(value, "header"), true);
                await assert.rejects(env.store.importBackpackItemAsync(bad, "header"), /Backpack block text/);
                await assert.rejects(env.store.importBackpackItemAsync(recoveryEntry(env.store, id(2), source), "header"));
                await assert.rejects(env.store.saveBackpackItemAsync(bad), /Backpack block text/);
                assert.deepStrictEqual(imported, [item(3), metadataItem(1)]);
                await env.store.renameBackpackItemAsync(id(1), "Usable");
                assert.deepStrictEqual(persisted(env, cloud)[id(2)], bad);
                await env.store.deleteBackpackEntryAsync(recoveryEntry(env.store, id(2), source));
                assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(3), { ...metadataItem(1), name: "Usable" }]);
                assert.equal(env.store.getBackpackState().entries.length, 2);
                assert.deepStrictEqual(env.telemetry, []);
            } finally { cleanup(); off(); }
        });

        it("deletes a mismatched embedded ID by observed map key without deleting its valid namesake", async () => {
            const env = fixture(cloud, { [id(1)]: metadataItem(2), [id(2)]: metadataItem(2), [id(3)]: missingText(3) });
            await env.store.refreshBackpackAsync();
            const entry = recoveryEntry(env.store, id(1), source);
            assertRecovery(entry, id(1), source, "Snippet 2", 2);
            await env.store.deleteBackpackEntryAsync(entry);
            assert.deepStrictEqual(persisted(env, cloud), { [id(2)]: metadataItem(2), [id(3)]: missingText(3) });
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [metadataItem(2)]);
            assertRecovery(recoveryEntry(env.store, id(3), source), id(3), source, "Snippet 3", 3);
        });

        it("publishes fresh neighbors after recovery deletion without rewriting another tab's additions or edits", async () => {
            const env = fixture(cloud, { [id(1)]: missingText(1), [id(2)]: metadataItem(2), [id(3)]: missingText(3) });
            await env.store.refreshBackpackAsync();
            const fresh = { ...metadataItem(2), blockText: "PRIVATE_FRESH_LABELS", code: "PRIVATE_FRESH_CODE" };
            const editNeighbors = () => {
                if (cloud) {
                    env.remote.get("alice").backpack.arcade[id(2)] = fresh;
                    env.remote.get("alice").backpack.arcade[id(4)] = item(4);
                    delete env.remote.get("alice").backpack.arcade[id(3)];
                } else {
                    env.local.data.set(guestKey(2), JSON.stringify(fresh));
                    env.local.data.set(guestKey(4), JSON.stringify(item(4)));
                    env.local.data.delete(guestKey(3));
                }
            };
            if (cloud) env.hook(({ method, run }) => { if (method === "PATCH") editNeighbors(); return run(); });
            else env.local.hooks.removeItem = ({ run }) => { editNeighbors(); return run(); };
            await env.store.deleteBackpackEntryAsync(recoveryEntry(env.store, id(1), source));
            assert.deepStrictEqual(persisted(env, cloud), { [id(2)]: fresh, [id(4)]: item(4) });
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(4), fresh]);
            assert.equal(env.store.getBackpackState().entries.length, 2);
            if (cloud) assert.deepStrictEqual(patches(env).map(request => request.data),
                [[{ op: "remove", path: ["backpack", "arcade", id(1)] }]]);
            else assert.deepStrictEqual(storageWrites(env.local).map(call => [call.method, call.args[0]]), [["removeItem", guestKey(1)]]);
        });

        for (const key of ["", "not-a-uuid", "a/b~c.d[0]", "../microbit/backpack/guest/neighbor", "__proto__", "constructor", "prototype"]) {
            it(`removes observed literal key ${JSON.stringify(key)} without touching neighbors or prototypes`, async () => {
                const target = Object.fromEntries([[key, missingText(1)], [id(2), metadataItem(2)],
                    [key + "/neighbor", { name: "Keep neighbor" }], ["a", { b: { keep: true } }]]);
                const env = fixture(cloud, target);
                const originalRemote = clone(env.remote.get("alice"));
                const prototypes = Object.getOwnPropertyDescriptors(Object.prototype);
                const cloudPrototype = cloud ? Object.getPrototypeOf(env.remote.get("alice").backpack.arcade) : undefined;
                await env.store.refreshBackpackAsync();
                assertRecovery(recoveryEntry(env.store, key, source), key, source, "Snippet 1", 1);
                // The UUID-only API must not become a route for arbitrary keys.
                await assert.rejects(env.store.deleteBackpackItemAsync(key), /Invalid backpack item ID/);
                assert.deepStrictEqual([patches(env), storageWrites(env.local)], [[], []]);
                await env.store.deleteBackpackEntryAsync(recoveryEntry(env.store, key, source));
                const expected = clone(target);
                delete expected[key];
                assert.deepStrictEqual(persisted(env, cloud), expected);
                assert.deepStrictEqual(Object.getOwnPropertyDescriptors(Object.prototype), prototypes);
                if (cloud) {
                    assert.strictEqual(Object.getPrototypeOf(env.remote.get("alice").backpack.arcade), cloudPrototype);
                    assert.deepStrictEqual(patches(env).map(request => request.data),
                        [[{ op: "remove", path: ["backpack", "arcade", key] }]]);
                    assert.deepStrictEqual(env.requests.map(request => request.method), ["GET", "GET", "PATCH"]);
                    assert.deepStrictEqual(env.remote.get("alice").backpack.microbit, originalRemote.backpack.microbit);
                    assert.equal(env.remote.get("alice").language, "fr");
                    assert.deepStrictEqual(storageWrites(env.local), []);
                } else {
                    assert.deepStrictEqual(storageWrites(env.local).map(call => [call.method, call.args[0]]), [["removeItem", localKey(key)]]);
                    assert.deepStrictEqual([env.requests, env.authCalls], [[], []]);
                }
                assert.equal(env.local.data.get(guestKey(90, "microbit")), JSON.stringify(metadataItem(90)));
                assert.equal(env.local.data.get("unrelated"), "keep");
                const reopened = cloud ? environment(env.remote, env.local) : guestEnvironment(env.local);
                await reopened.store.refreshBackpackAsync();
                assert.equal(recoveryEntry(reopened.store, key, source), undefined);
                assert.deepStrictEqual(clone(reopened.store.getBackpackItems()), [metadataItem(2)]);
                assert.deepStrictEqual([env.telemetry, reopened.telemetry], [[], []]);
            });
        }

        it("rejects forged, wrong-source, unobserved and stale descriptors before auth, storage or network", async () => {
            const env = fixture(cloud, { [id(1)]: missingText(1) });
            await assert.rejects(env.store.deleteBackpackEntryAsync({ id: id(1), source }), /no longer/);
            await env.store.refreshBackpackAsync();
            const observed = recoveryEntry(env.store, id(1), source);
            const before = persisted(env, cloud);
            // A persisted but not yet observed key is not deletion authority.
            if (cloud) env.remote.get("alice").backpack.arcade[id(2)] = missingText(2);
            else env.local.data.set(guestKey(2), JSON.stringify(missingText(2)));
            env.requests.length = env.local.calls.length = env.authCalls.length = 0;
            for (const forged of [undefined, null, {}, { ...observed, id: id(2) }, { ...observed, id: "__proto__" },
                { ...observed, source: cloud ? "local" : "cloud" }, { ...observed, source: "unknown" },
                { ...observed, id: [id(1)] }]) {
                await assert.rejects(env.store.deleteBackpackEntryAsync(forged), /no longer/);
            }
            assert.deepStrictEqual([env.requests, env.local.calls, env.authCalls], [[], [], []]);
            assert.deepStrictEqual(persisted(env, cloud), { ...before, [id(2)]: missingText(2) });
            // Descriptors are matched by key/source, never trusted for their item payload.
            await env.store.deleteBackpackEntryAsync({ ...observed, item: metadataItem(2), name: "Forged", error: "PRIVATE_ERROR" });
            env.requests.length = env.local.calls.length = env.authCalls.length = 0;
            await assert.rejects(env.store.deleteBackpackEntryAsync(observed), /no longer/);
            assert.deepStrictEqual([env.requests, env.local.calls, env.authCalls, env.telemetry], [[], [], [], []]);
            assert.deepStrictEqual(persisted(env, cloud), { [id(2)]: missingText(2) });
        });

        for (const quota of ["count", "JSON"]) {
            it(`keeps over-${quota}-quota cards reachable through successive recovery deletes while blocking writes`, async () => {
                const target = quota === "count" ? Object.fromEntries(Array.from({ length: 52 }, (_, n) =>
                    [id(n), n === 51 ? missingText(n) : item(n)]))
                    : { [id(1)]: item(1), [id(2)]: item(2, { code: "PRIVATE_OVERSIZED".padEnd(500001, "x") }), [id(3)]: missingText(3) };
                const env = fixture(cloud, target);
                await env.store.refreshBackpackAsync();
                assert.equal(env.store.getBackpackState().warning, quotaWarning);
                assert.equal(env.store.getBackpackState().entries.length, Object.keys(target).length);
                assert.equal(env.store.getBackpackItems().length, quota === "count" ? 51 : 1);
                await assert.rejects(env.store.saveBackpackItemAsync(item(99)), quota === "count" ? /50/ : /500000/);
                await assert.rejects(env.store.renameBackpackItemAsync(id(1), "Renamed"), quota === "count" ? /50/ : /500000/);
                assert.deepStrictEqual([patches(env), storageWrites(env.local)], [[], []]);
                for (const [index, n] of (quota === "count" ? [51, 50] : [1, 2]).entries()) {
                    await env.store.deleteBackpackEntryAsync(recoveryEntry(env.store, id(n), source));
                    assert.equal(env.store.getBackpackState().warning, index === 0 ? quotaWarning : undefined);
                    assert.equal(recoveryEntry(env.store, id(n), source), undefined);
                }
                if (quota === "JSON") assertRecovery(recoveryEntry(env.store, id(3), source), id(3), source, "Snippet 3", 3);
                await env.store.saveBackpackItemAsync(item(quota === "count" ? 1 : 99));
                assert.deepStrictEqual(env.telemetry, []);
            });
        }

        for (const failure of cloud ? ["GET throw", "PATCH throw", "failed", "noop", "lost ACK", "present ACK", "malformed ACK"]
            : ["throw", "noop", "readback"]) {
            it(`retains recovery controls after delete ${failure}, retries and confirms persistence on a fresh page`, async () => {
                const original = { [id(1)]: missingText(1), [id(2)]: metadataItem(2), [id(3)]: missingText(3) };
                const env = fixture(cloud, original);
                await env.store.refreshBackpackAsync();
                const entry = recoveryEntry(env.store, id(1), source);
                const before = clone(env.store.getBackpackState());
                let notifications = 0;
                env.store.subscribeBackpack(() => { notifications++; });
                if (cloud) env.hook(({ method, run }) => {
                    if (method === "GET") {
                        if (failure === "GET throw") throw new Error("PRIVATE_CODE PRIVATE_PREVIEW alice-session");
                        return run();
                    }
                    if (failure === "PATCH throw") throw new Error("PRIVATE_CODE PRIVATE_PREVIEW alice-session");
                    if (failure === "failed") return { success: false };
                    if (failure === "noop") return { success: true, resp: clone(env.remote.get("alice")) };
                    const result = run();
                    if (failure === "lost ACK") return { success: false };
                    if (failure === "present ACK") result.resp.backpack.arcade[id(1)] = missingText(1);
                    if (failure === "malformed ACK") result.resp.backpack.arcade = [];
                    return result;
                });
                else env.local.hooks.removeItem = ({ run }) => {
                    if (failure === "throw") return storageFailure();
                    if (failure === "noop") return;
                    run(); env.local.hooks.getItem = storageFailure;
                };
                await assert.rejects(env.store.deleteBackpackEntryAsync(entry), error =>
                    /backpack/.test(error.message) && !/PRIVATE_|alice-session|sensitive/.test(error.message));
                assert.equal(notifications, 0);
                assert.deepStrictEqual(clone(env.store.getBackpackState()), before);
                const removed = ["lost ACK", "present ACK", "malformed ACK", "readback"].includes(failure);
                const expected = clone(original);
                if (removed) delete expected[id(1)];
                assert.deepStrictEqual(persisted(env, cloud), expected);
                env.hook(undefined);
                delete env.local.hooks.removeItem;
                delete env.local.hooks.getItem;
                const fresh = cloud ? environment(env.remote, env.local) : guestEnvironment(env.local);
                await fresh.store.refreshBackpackAsync();
                assert.equal(!!recoveryEntry(fresh.store, id(1), source), !removed);
                const writes = patches(env).length;
                await env.store.deleteBackpackEntryAsync(entry);
                assert.equal(notifications, 1);
                if (cloud) assert.equal(patches(env).length - writes, removed ? 0 : 1);
                delete expected[id(1)];
                assert.deepStrictEqual(persisted(env, cloud), expected);
                assertRecovery(recoveryEntry(env.store, id(3), source), id(3), source, "Snippet 3", 3);
                assert.deepStrictEqual(clone(env.store.getBackpackItems()), [metadataItem(2)]);
                const reopened = cloud ? environment(env.remote, env.local) : guestEnvironment(env.local);
                await reopened.store.refreshBackpackAsync();
                assert.deepStrictEqual(clone(reopened.store.getBackpackState()), clone(env.store.getBackpackState()));
                assert.deepStrictEqual([env.telemetry, fresh.telemetry, reopened.telemetry], [[], [], []]);
            });
        }
    });

    it("keeps an invalid card visible until delete ACK and accepts an already-absent key on fresh GET without PATCH", async () => {
        const env = fixture(true, { [id(1)]: missingText(1), [id(2)]: missingText(2), [id(3)]: item(3) });
        await env.store.refreshBackpackAsync();
        const first = recoveryEntry(env.store, id(1), "cloud");
        const second = recoveryEntry(env.store, id(2), "cloud");
        const before = clone(env.store.getBackpackState());
        const entered = deferred(), release = deferred();
        let notifications = 0;
        env.store.subscribeBackpack(() => { notifications++; });
        env.hook(async ({ method, run }) => {
            if (method === "PATCH") { entered.resolve(); await release.promise; }
            return run();
        });
        const pending = env.store.deleteBackpackEntryAsync(first);
        await entered.promise;
        try {
            assert.deepStrictEqual(clone(env.store.getBackpackState()), before);
            assert.deepStrictEqual(env.remote.get("alice").backpack.arcade[id(1)], missingText(1));
            assert.equal(notifications, 0);
        } finally { release.resolve(); }
        await pending;
        assert.equal(notifications, 1);
        assertRecovery(recoveryEntry(env.store, id(2), "cloud"), id(2), "cloud", "Snippet 2", 2);
        env.hook(undefined);
        delete env.remote.get("alice").backpack.arcade[id(2)];
        const count = env.requests.length;
        await env.store.deleteBackpackEntryAsync(second);
        assert.deepStrictEqual(env.requests.slice(count).map(request => request.method), ["GET"]);
        assert.equal(notifications, 2);
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(3)]);
        assert.equal(env.store.getBackpackState().entries.length, 1);
    });

    it("keeps cloud recovery controls and invalid local cards available through a conflicting promotion", async () => {
        const env = environment();
        const conflict = { ...metadataItem(1), blockText: "PRIVATE_CLOUD_LABELS" };
        env.local.data.set(guestKey(1), JSON.stringify(metadataItem(1)));
        env.local.data.set(guestKey(2), JSON.stringify(missingText(2)));
        env.remote.set("alice", { backpack: { arcade: { [id(1)]: conflict, [id(3)]: missingText(3), [id(4)]: item(4) } } });
        const before = Array.from(env.local.data);
        await env.store.refreshBackpackAsync();
        assertSyncWarning(env, [item(4), conflict]);
        assertRecovery(recoveryEntry(env.store, id(2), "local"), id(2), "local", "Snippet 2", 2);
        assertRecovery(recoveryEntry(env.store, id(3), "cloud"), id(3), "cloud", "Snippet 3", 3);
        assert.equal(recoveryEntry(env.store, id(1), "local"), undefined, "Valid unpromoted guest content is not a cloud item");
        assert.deepStrictEqual([patches(env), storageWrites(env.local)], [[], []]);
        assert.deepStrictEqual(Array.from(env.local.data), before);
        await assert.rejects(env.store.saveBackpackItemAsync(item(5)), /conflicts/);
        await env.store.deleteBackpackEntryAsync(recoveryEntry(env.store, id(3), "cloud"));
        assert.deepStrictEqual(Array.from(env.local.data), before);
        assertRecovery(recoveryEntry(env.store, id(2), "local"), id(2), "local", "Snippet 2", 2);
        await env.store.deleteBackpackEntryAsync(recoveryEntry(env.store, id(2), "local"));
        assert.equal(env.local.data.get(guestKey(1)), before[0][1]);
        assert.deepStrictEqual(env.remote.get("alice").backpack.arcade, { [id(1)]: conflict, [id(4)]: item(4) });
        assert.deepStrictEqual(patches(env).map(request => request.data), [[{ op: "remove", path: ["backpack", "arcade", id(3)] }]]);
        assert.deepStrictEqual(env.telemetry, []);
    });

    for (const failure of ["failed", "thrown", "lost ACK", "missing blockText ACK", "cleanup"]) {
        it(`still rejects save promotion ${failure} without publishing the requested item or leaking raw errors`, async () => {
            const env = environment();
            env.remote.set("alice", { backpack: { arcade: { [id(3)]: missingText(3), [id(4)]: item(4) } } });
            await env.store.refreshBackpackAsync();
            const before = clone(env.store.getBackpackState());
            env.local.data.set(guestKey(1), JSON.stringify(metadataItem(1)));
            const localBefore = Array.from(env.local.data);
            let notifications = 0;
            env.store.subscribeBackpack(() => { notifications++; });
            env.hook(({ method, run }) => {
                if (method !== "PATCH") return run();
                if (failure === "failed") return { success: false };
                if (failure === "thrown") throw new Error("PRIVATE_CODE PRIVATE_BLOCK_TEXT alice-session");
                const result = run();
                if (failure === "lost ACK") return { success: false };
                if (failure === "missing blockText ACK") delete result.resp.backpack.arcade[id(1)].blockText;
                if (failure === "cleanup") env.local.hooks.removeItem = storageFailure;
                return result;
            });
            await assert.rejects(env.store.saveBackpackItemAsync(item(2)), error =>
                /backpack|local copies|Backpack block text/.test(error.message) && !/PRIVATE_|alice-session|sensitive/.test(error.message));
            assert.equal(notifications, 0);
            assert.deepStrictEqual(clone(env.store.getBackpackState()), before);
            assert.deepStrictEqual(Array.from(env.local.data), localBefore);
            assert.equal(env.remote.get("alice").backpack.arcade[id(2)], undefined);
            assert.equal(patches(env).length, 1, "Do not continue to the requested save after failed promotion");
            assert.deepStrictEqual(patches(env)[0].data.slice(2).map(op => op.path), [["backpack", "arcade", id(1)]]);
            env.hook(undefined);
            delete env.local.hooks.removeItem;
            await env.store.saveBackpackItemAsync(item(2));
            assert.equal(env.local.data.has(guestKey(1)), false);
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(4), item(2), metadataItem(1)]);
            assertRecovery(recoveryEntry(env.store, id(3), "cloud"), id(3), "cloud", "Snippet 3", 3);
            assert.deepStrictEqual(env.telemetry, []);
        });
    }

    for (const firstSource of ["local", "cloud"]) {
        it(`deletes ${firstSource} first without touching a signed-in recovery card with the same key in the other source`, async () => {
            const env = environment();
            env.local.data.set(guestKey(1), JSON.stringify(missingText(1)));
            env.local.data.set(guestKey(3), '{"name":"PRIVATE_TRUNCATED');
            env.remote.set("alice", { backpack: { arcade: { [id(1)]: missingText(1), [id(2)]: metadataItem(2) } } });
            await env.store.refreshBackpackAsync();
            assert.equal(env.store.getBackpackState().entries.length, 4);
            assertRecovery(recoveryEntry(env.store, id(3), "local"), id(3), "local");
            assert.deepStrictEqual([patches(env), storageWrites(env.local)], [[], []]);
            const secondSource = firstSource === "local" ? "cloud" : "local";
            await env.store.deleteBackpackEntryAsync(recoveryEntry(env.store, id(1), firstSource));
            assert.equal(env.local.data.has(guestKey(1)), firstSource !== "local");
            assert.equal(Object.prototype.hasOwnProperty.call(env.remote.get("alice").backpack.arcade, id(1)), firstSource !== "cloud");
            assertRecovery(recoveryEntry(env.store, id(1), secondSource), id(1), secondSource, "Snippet 1", 1);
            assert.equal(patches(env).length, firstSource === "cloud" ? 1 : 0);
            assert.equal(storageWrites(env.local).length, firstSource === "local" ? 1 : 0);
            await env.store.deleteBackpackEntryAsync(recoveryEntry(env.store, id(1), secondSource));
            assert.deepStrictEqual(patches(env).map(request => request.data), [[{ op: "remove", path: ["backpack", "arcade", id(1)] }]]);
            assert.deepStrictEqual(storageWrites(env.local).map(call => [call.method, call.args[0]]), [["removeItem", guestKey(1)]]);
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [metadataItem(2)]);
            assert.equal(env.local.data.get(guestKey(3)), '{"name":"PRIVATE_TRUNCATED');
            const reopened = environment(env.remote, env.local);
            await reopened.store.refreshBackpackAsync();
            assert.deepStrictEqual(clone(reopened.store.getBackpackState()), clone(env.store.getBackpackState()));
            assert.deepStrictEqual([env.telemetry, reopened.telemetry], [[], []]);
        });
    }

    for (const source of ["local", "cloud"]) {
        for (const stage of source === "cloud" ? ["queued", "GET", "PATCH"] : ["queued", "GET"]) {
            for (const change of ["account", "target", "token", "signout", "client"]) {
                it(`guards ${source} recovery deletion and its queue on ${change} during ${stage}`, async () => {
                    const env = environment();
                    const original = { backpack: { arcade: { [id(1)]: missingText(1), [id(2)]: missingText(2) },
                        microbit: { [id(1)]: metadataItem(1), [id(2)]: metadataItem(2) } } };
                    env.remote.set("alice", clone(original));
                    env.remote.set("bob", clone(original));
                    env.local.data.set(guestKey(1), JSON.stringify(missingText(1)));
                    env.local.data.set(guestKey(2), JSON.stringify(missingText(2)));
                    await env.store.refreshBackpackAsync();
                    const before = Array.from(env.local.data);
                    let notifications = 0;
                    env.store.subscribeBackpack(() => { notifications++; });
                    const entered = deferred(), release = deferred();
                    env.hook(async ({ method, run }) => {
                        if (method === (stage === "queued" ? "GET" : stage)) { entered.resolve(); await release.promise; }
                        return run();
                    });
                    // For queued-only coverage, hold an unrelated refresh ahead of both deletes.
                    const pending = stage === "queued" ? env.store.refreshBackpackAsync()
                        : env.store.deleteBackpackEntryAsync(recoveryEntry(env.store, id(1), source));
                    const rejected = [assert.rejects(pending, /account|editor changed|session/)];
                    await entered.promise;
                    if (stage === "queued") rejected.push(assert.rejects(
                        env.store.deleteBackpackEntryAsync(recoveryEntry(env.store, id(1), source)), /account|editor changed|session/));
                    rejected.push(assert.rejects(env.store.deleteBackpackEntryAsync(recoveryEntry(env.store, id(2), source)),
                        /account|editor changed|session/));
                    if (change === "account") env.signIn("bob");
                    if (change === "target") env.pxt.appTarget.id = "microbit";
                    if (change === "token") env.signIn("alice", "alice-new-session");
                    if (change === "signout") env.signIn(undefined);
                    if (change === "client") env.pxt.auth.client = () => ({ apiAsync() { throw new Error("Wrong client"); } });
                    release.resolve();
                    await Promise.all(rejected);
                    assert.equal(notifications, 0);
                    assert.deepStrictEqual(Array.from(env.local.data), before);
                    assert.deepStrictEqual(env.remote.get("bob"), original);
                    const expected = clone(original);
                    // A request already sent may complete for its captured owner, never the new one.
                    if (stage === "PATCH") delete expected.backpack.arcade[id(1)];
                    assert.deepStrictEqual(env.remote.get("alice"), expected);
                    assert.equal(patches(env).length, stage === "PATCH" ? 1 : 0);
                    assert.ok(env.requests.every(request => request.owner === "alice"));
                    if (change !== "token") assert.deepStrictEqual(clone(env.store.getBackpackState()), { entries: [] });
                    else assertRecovery(recoveryEntry(env.store, id(1), source), id(1), source, "Snippet 1", 1);
                    assert.deepStrictEqual(env.telemetry, []);
                });
            }
        }
    }

    for (const change of ["signin", "target"]) {
        it(`blocks observed guest deletion queued across ${change}`, async () => {
            const env = guestEnvironment();
            env.local.data.set(guestKey(1), JSON.stringify(missingText(1)));
            await env.store.refreshBackpackAsync();
            const entry = recoveryEntry(env.store, id(1), "local");
            const pending = assert.rejects(env.store.deleteBackpackEntryAsync(entry), /account|editor changed/);
            if (change === "signin") env.signIn("bob");
            else env.pxt.appTarget.id = "microbit";
            await pending;
            await assert.rejects(env.store.deleteBackpackEntryAsync(entry), /no longer/);
            assert.equal(env.local.data.get(guestKey(1)), JSON.stringify(missingText(1)));
            assert.deepStrictEqual([storageWrites(env.local), env.requests, env.telemetry], [[], [], []]);
        });
    }
});

describe("required private Backpack block text", () => {
    for (const cloud of [false, true]) {
        const mode = cloud ? "cloud" : "guest";
        it(`${mode} rejects missing, nonstring and oversized text before auth, storage, network or import`, async () => {
            const env = cloud ? environment() : guestEnvironment();
            let imports = 0;
            const cleanup = env.store.setBackpackEditor({ headerId: () => "header", canImport: () => true,
                importAsync: async () => { imports++; return true; } });
            try {
                const missing = item(1);
                delete missing.blockText;
                const invalid = [missing, ...[undefined, null, 7, false, [], {},
                    "x".repeat(env.store.MAX_BACKPACK_CODE_LENGTH + 1)].map(blockText => item(1, { blockText }))];
                for (const entry of invalid) {
                    await assert.rejects(env.store.saveBackpackItemAsync(entry), /Backpack block text/);
                    await assert.rejects(env.store.importBackpackItemAsync(entry, "header"), /Backpack block text/);
                }
                assert.equal(imports, 0);
                assert.deepStrictEqual([env.authCalls, env.local.calls, env.requests, env.telemetry], [[], [], [], []]);
            } finally { cleanup(); }
        });

        it(`${mode} preserves empty and maximum-length text on reopen with only the intended private persistence`, async () => {
            const env = cloud ? environment() : guestEnvironment();
            const entries = [item(1, { blockText: "" }), item(2, {
                blockText: "PRIVATE_BLOCK_TEXT ".padEnd(env.store.MAX_BACKPACK_CODE_LENGTH, "x")
            })];
            for (const entry of entries) await env.store.saveBackpackItemAsync(entry);
            const reopened = cloud ? environment(env.remote) : guestEnvironment(env.local);
            await reopened.store.refreshBackpackAsync();
            assert.deepStrictEqual(clone(reopened.store.getBackpackItems()), entries.slice().reverse());
            assert.deepStrictEqual([env.telemetry, reopened.telemetry], [[], []]);
            if (cloud) {
                assert.deepStrictEqual(storageWrites(env.local), []);
                assert.deepStrictEqual(patches(env).map(request => request.data[2].value), entries);
                assert.ok([...env.requests, ...reopened.requests].every(request =>
                    request.url === "/api/user/preferences" && request.owner === "alice"
                    && (request.method === "PATCH" || request.data === undefined)));
            } else {
                assert.deepStrictEqual([env.requests, reopened.requests, env.authCalls, reopened.authCalls], [[], [], [], []]);
            }
        });

        for (const blockText of [undefined, "", "PRIVATE_CHANGED_LABELS"]) {
            it(`${mode} refuses a save acknowledgement with ${blockText === undefined ? "missing" : JSON.stringify(blockText)} text and permits retry`, async () => {
                const env = cloud ? environment() : guestEnvironment();
                await env.store.saveBackpackItemAsync(item(1));
                const updated = item(1, { blockText: "PRIVATE_UPDATED_LABELS" });
                let notifications = 0;
                const off = env.store.subscribeBackpack(() => { notifications++; });
                if (cloud) env.hook(({ method, run }) => {
                    const result = run();
                    if (method === "PATCH") result.resp.backpack.arcade[id(1)].blockText = blockText;
                    return result;
                });
                else env.local.hooks.setItem = ({ args, run }) => {
                    run();
                    env.local.data.set(args[0], JSON.stringify({ ...JSON.parse(args[1]), blockText }));
                };
                try {
                    await assert.rejects(env.store.saveBackpackItemAsync(updated), error =>
                        /another device|Backpack block text|Could not save your local backpack/.test(error.message)
                        && !/PRIVATE_/.test(error.message));
                    assert.equal(notifications, 0);
                    assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(1)]);
                    env.hook(undefined);
                    delete env.local.hooks.setItem;
                    await env.store.saveBackpackItemAsync(updated);
                    assert.equal(notifications, 1);
                    assert.deepStrictEqual(clone(env.store.getBackpackItems()), [updated]);
                    assert.deepStrictEqual(env.telemetry, []);
                    if (!cloud) assert.deepStrictEqual(env.requests, []);
                } finally { off(); }
            });
        }
    }
});

describe("Backpack preview pixel density", () => {
    it("accepts only 1, 1.5 and 2 with a valid PNG, preserving optional preview semantics", () => {
        const env = environment();
        for (const value of [item(1), metadataItem(1), ...[1, 1.5, 2].map(previewPixelDensity =>
            ({ ...metadataItem(1), previewPixelDensity }))]) {
            const validated = env.store.validateBackpackItem(value);
            assert.deepStrictEqual(clone(validated), value);
            assert.notStrictEqual(validated, value);
            assert.strictEqual(Object.prototype.hasOwnProperty.call(validated, "previewPixelDensity"),
                Object.prototype.hasOwnProperty.call(value, "previewPixelDensity"));
        }
        const withoutDensity = env.store.validateBackpackItem({ ...metadataItem(1), previewPixelDensity: undefined });
        assert.deepStrictEqual(clone(withoutDensity), metadataItem(1));
        assert.strictEqual(Object.prototype.hasOwnProperty.call(withoutDensity, "previewPixelDensity"), false);
        assert.deepStrictEqual([env.authCalls, env.local.calls, env.requests, env.telemetry], [[], [], [], []]);
    });

    it("accepts PNG data above the former budget and rejects the first base64-aligned size above 64000", () => {
        const { store } = environment();
        assert.strictEqual(store.MAX_BACKPACK_PREVIEW_LENGTH, 64000);
        // The 22-character URI prefix plus a multiple-of-four payload cannot total exactly 64000.
        const largest = store.MAX_BACKPACK_PREVIEW_LENGTH - 2;
        const previewUri = "data:image/png;base64,iVBORw0KGgo".padEnd(largest, "A");
        for (const previewPixelDensity of [undefined, 1, 1.5, 2]) {
            const value = { ...metadataItem(1), previewUri,
                ...(previewPixelDensity === undefined ? {} : { previewPixelDensity }) };
            assert.deepStrictEqual(clone(store.validateBackpackItem(value)), value);
            assert.throws(() => store.validateBackpackItem({ ...value, previewUri: previewUri + "AAAA" }), /64000/);
        }
    });

    for (const cloud of [false, true]) {
        const mode = cloud ? "cloud" : "guest";
        it(`${mode} rejects invalid densities and densities without valid previews before side effects`, async () => {
            const env = cloud ? environment() : guestEnvironment();
            const invalid = [null, false, true, "1", "1.5", "2", 0, -1, 1.25, 2.5, 3, NaN, Infinity, -Infinity, [], {}]
                .map(previewPixelDensity => ({ ...metadataItem(1), previewPixelDensity }));
            for (const previewPixelDensity of [1, 1.5, 2]) {
                for (const previewUri of [undefined, null, "", "https://private/image.png",
                    "data:image/svg+xml;base64,AAAA", "data:image/png;base64,AAAA",
                    "data:image/png;base64,iVBORw0KGgo"])
                    invalid.push({ ...metadataItem(1), previewPixelDensity, previewUri });
            }
            let imports = 0;
            const cleanup = env.store.setBackpackEditor({ headerId: () => "header", canImport: () => true,
                importAsync: async () => { imports++; return true; } });
            try {
                for (const value of invalid) {
                    assert.throws(() => env.store.validateBackpackItem(value), /preview/i);
                    await assert.rejects(env.store.saveBackpackItemAsync(value), /preview/i);
                    await assert.rejects(env.store.importBackpackItemAsync(value, "header"), /preview/i);
                }
                assert.strictEqual(imports, 0);
                assert.deepStrictEqual([env.authCalls, env.local.calls, env.requests, env.telemetry], [[], [], [], []]);
            } finally { cleanup(); }
        });

        it(`${mode} preserves previews and densities through save, rename, reopen and guest promotion`, async () => {
            const env = cloud ? environment() : guestEnvironment();
            const entries = [item(1), metadataItem(2), ...[1, 1.5, 2].map((previewPixelDensity, index) =>
                ({ ...metadataItem(index + 3), previewPixelDensity }))];
            for (const entry of entries) await env.store.saveBackpackItemAsync(entry);
            const persisted = () => cloud ? env.remote.get("alice").backpack.arcade
                : Object.fromEntries(entries.map(entry => [entry.id,
                    JSON.parse(env.local.data.get(`arcade/backpack/guest/${entry.id}`))]));
            assert.deepStrictEqual(persisted(), Object.fromEntries(entries.map(entry => [entry.id, entry])));
            for (const entry of entries) await env.store.renameBackpackItemAsync(entry.id, `Renamed ${entry.name}`);
            const expected = entries.map(entry => ({ ...entry, name: `Renamed ${entry.name}` })).reverse();
            assert.deepStrictEqual(persisted(), Object.fromEntries(expected.map(entry => [entry.id, entry])));
            const reopened = cloud ? environment(env.remote, env.local) : guestEnvironment(env.local, env.remote);
            await reopened.store.refreshBackpackAsync();
            assert.deepStrictEqual(clone(reopened.store.getBackpackItems()), expected);
            if (!cloud) {
                assert.deepStrictEqual([env.requests, reopened.requests, env.authCalls, reopened.authCalls], [[], [], [], []]);
                reopened.signIn("alice");
                await reopened.store.refreshBackpackAsync();
                assert.deepStrictEqual(clone(reopened.store.getBackpackItems()), expected);
                assert.deepStrictEqual(env.remote.get("alice").backpack.arcade,
                    Object.fromEntries(expected.map(entry => [entry.id, entry])));
                assert.strictEqual(env.local.data.size, 0);
                const device = environment(env.remote);
                await device.store.refreshBackpackAsync();
                assert.deepStrictEqual(clone(device.store.getBackpackItems()), expected);
                assert.deepStrictEqual(device.telemetry, []);
            }
            assert.deepStrictEqual([env.telemetry, reopened.telemetry], [[], []]);
        });

        for (const [sent, acknowledged] of [[2, undefined], [2, 1], [2, 1.5], [undefined, 2]]) {
            it(`${mode} rejects a density-only save acknowledgement mismatch (${sent} -> ${acknowledged}) and permits retry`, async () => {
                const env = cloud ? environment() : guestEnvironment();
                const original = metadataItem(1);
                await env.store.saveBackpackItemAsync(original);
                const updated = { ...original, ...(sent === undefined ? {} : { previewPixelDensity: sent }) };
                let notifications = 0;
                const off = env.store.subscribeBackpack(() => { notifications++; });
                const corrupt = value => {
                    if (acknowledged === undefined) delete value.previewPixelDensity;
                    else value.previewPixelDensity = acknowledged;
                    return value;
                };
                if (cloud) env.hook(({ method, run }) => {
                    const result = run();
                    if (method === "PATCH") corrupt(result.resp.backpack.arcade[id(1)]);
                    return result;
                });
                else env.local.hooks.setItem = ({ args, run }) => {
                    run();
                    env.local.data.set(args[0], JSON.stringify(corrupt(JSON.parse(args[1]))));
                };
                try {
                    await assert.rejects(env.store.saveBackpackItemAsync(updated), /another device|Could not save your local backpack/);
                    assert.strictEqual(notifications, 0);
                    assert.deepStrictEqual(clone(env.store.getBackpackItems()), [original]);
                    env.hook(undefined);
                    delete env.local.hooks.setItem;
                    await env.store.saveBackpackItemAsync(updated);
                    assert.strictEqual(notifications, 1);
                    assert.deepStrictEqual(clone(env.store.getBackpackItems()), [updated]);
                    const reopened = cloud ? environment(env.remote) : guestEnvironment(env.local);
                    await reopened.store.refreshBackpackAsync();
                    assert.deepStrictEqual(clone(reopened.store.getBackpackItems()), [updated]);
                    assert.deepStrictEqual([env.telemetry, reopened.telemetry], [[], []]);
                } finally { off(); }
            });
        }
    }
});

describe("name-only backpack renames", () => {
    for (const cloud of [false, true]) describe(cloud ? "cloud" : "guest", () => {
        function fixture() {
            const env = cloud ? environment() : guestEnvironment();
            env.remote.set("alice", { language: "fr", backpack: { arcade: {}, microbit: { [id(9)]: item(9) } } });
            env.local.data.set(guestKey(9, "microbit"), JSON.stringify(item(9)));
            const put = (n, value) => {
                if (cloud) {
                    if (value === undefined) delete env.remote.get("alice").backpack.arcade[id(n)];
                    else env.remote.get("alice").backpack.arcade[id(n)] = clone(value);
                } else if (value === undefined) env.local.data.delete(guestKey(n));
                else env.local.data.set(guestKey(n), JSON.stringify(value));
            };
            const get = () => cloud ? clone(env.remote.get("alice").backpack.arcade)
                : Object.fromEntries(Array.from(env.local.data).filter(([key]) => key.startsWith("arcade/backpack/guest/"))
                    .map(([key, value]) => [key.slice("arcade/backpack/guest/".length), JSON.parse(value)]));
            [1, 2, 3].forEach(n => put(n, metadataItem(n)));
            return { ...env, put, get, writes: () => cloud ? patches(env) : storageWrites(env.local) };
        }

        it("trims and persists only the name, preserving fresh same-item edits, metadata, order and neighbors on reopen", async () => {
            const env = fixture();
            await env.store.refreshBackpackAsync();
            const fresh = { ...metadataItem(2), code: "fresh blocks", blockText: "fresh displayed labels", dependencies: { core: "*", ext: "pub:new" },
                projectBlocks: { custom_block: "fresh.ts" }, previewPixelDensity: 1.5, createdAt: 2.5 };
            env.put(2, fresh);
            if (cloud) env.hook(({ method, run }) => {
                if (method === "PATCH") {
                    fresh.code = "edited between GET and PATCH";
                    fresh.blockText = "labels edited between GET and PATCH";
                    fresh.previewPixelDensity = 2;
                    env.put(2, fresh);
                }
                return run();
            });
            await env.store.renameBackpackItemAsync(id(2), "  Renamed  ");
            const expected = [metadataItem(3), { ...fresh, name: "Renamed" }, metadataItem(1)];
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), expected);
            assert.deepStrictEqual(env.get(), Object.fromEntries(expected.map(entry => [entry.id, entry])));
            if (cloud) assert.deepStrictEqual(patches(env).map(request => request.data),
                [[{ op: "replace", path: ["backpack", "arcade", id(2), "name"], value: "Renamed" }]]);
            else assert.deepStrictEqual(storageWrites(env.local).map(call => [call.method, call.args[0]]), [["setItem", guestKey(2)]]);
            assert.equal(env.remote.get("alice").language, "fr");
            assert.deepStrictEqual(env.remote.get("alice").backpack.microbit, { [id(9)]: item(9) });
            assert.equal(env.local.data.get(guestKey(9, "microbit")), JSON.stringify(item(9)));
            const reopened = cloud ? environment(env.remote) : guestEnvironment(env.local);
            await reopened.store.refreshBackpackAsync();
            assert.deepStrictEqual(clone(reopened.store.getBackpackItems()), expected);
        });

        for (const state of ["deleted", "mismatched ID", ...(cloud ? ["deleted before PATCH"] : [])]) {
            it(`refuses ${state} without resurrection or neighbor changes`, async () => {
                const env = fixture();
                await env.store.refreshBackpackAsync();
                if (state === "deleted before PATCH") env.hook(({ method, run }) => {
                    if (method === "PATCH") env.put(2, undefined);
                    return run();
                });
                else env.put(2, state === "deleted" ? undefined : metadataItem(8));
                await assert.rejects(env.store.renameBackpackItemAsync(id(2), "Renamed"), /no longer|mismatched|sync|Invalid/);
                assert.deepStrictEqual(env.get(), { [id(1)]: metadataItem(1), [id(3)]: metadataItem(3),
                    ...(state === "mismatched ID" ? { [id(2)]: metadataItem(8) } : {}) });
                if (state !== "deleted before PATCH") assert.equal(env.writes().length, 0);
            });
        }

        it("rejects invalid IDs and names before auth, storage or network; unchanged trimmed names never write", async () => {
            const env = fixture();
            for (const invalid of [undefined, null, 7, {}, "", " ", "x".repeat(101), "bad\nname", "bad\x00name", "bad\x7fname"]) {
                await assert.rejects(env.store.renameBackpackItemAsync(id(2), invalid), /names/);
            }
            for (const invalid of [undefined, null, 7, {}, "", "constructor", "__proto__", "../bad", id(2) + "/name"]) {
                await assert.rejects(env.store.renameBackpackItemAsync(invalid, "Valid"), /ID/);
            }
            assert.deepStrictEqual([env.authCalls, env.local.calls, env.requests], [[], [], []]);
            env.put(2, { ...metadataItem(2), code: "fresh no-op" });
            await env.store.renameBackpackItemAsync(id(2), "  Snippet 2  ");
            assert.equal(env.writes().length, 0);
            assert.equal(env.store.getBackpackItems()[1].code, "fresh no-op");
            for (const name of ["X", "x".repeat(100)]) await env.store.renameBackpackItemAsync(id(2), name);
            assert.equal(env.get()[id(2)].name.length, 100);
        });

        for (const failure of ["read", "write", "silent", "lost ACK", ...(cloud ? ["ACK ID", "ACK name"] : [])]) {
            it(`rejects ${failure}, preserves the snapshot, sanitizes errors and retries`, async () => {
                const env = fixture();
                await env.store.refreshBackpackAsync();
                let notifications = 0;
                env.store.subscribeBackpack(() => { notifications++; });
                if (cloud) env.hook(({ method, run }) => {
                    if (method === "GET") return failure === "read" ? storageFailure() : run();
                    if (failure === "write") return storageFailure();
                    if (failure === "silent") return { success: true, resp: clone(env.remote.get("alice")) };
                    const result = run();
                    if (failure === "lost ACK") return { success: false };
                    result.resp.backpack.arcade[id(2)][failure === "ACK ID" ? "id" : "name"] = failure === "ACK ID" ? id(8) : "Wrong";
                    return result;
                });
                else if (failure === "read") env.local.hooks.access = storageFailure;
                else env.local.hooks.setItem = ({ run }) => {
                    if (failure === "write") return storageFailure();
                    if (failure === "silent") return;
                    run(); env.local.hooks.getItem = storageFailure;
                };
                await assert.rejects(env.store.renameBackpackItemAsync(id(2), "Renamed"),
                    error => /backpack|another device/.test(error.message) && !/sensitive/.test(error.message));
                assert.equal(notifications, 0);
                assert.deepStrictEqual(clone(env.store.getBackpackItems()), [metadataItem(3), metadataItem(2), metadataItem(1)]);
                env.hook(undefined);
                for (const key of Object.keys(env.local.hooks)) delete env.local.hooks[key];
                const writes = env.writes().length;
                await env.store.renameBackpackItemAsync(id(2), "Renamed");
                assert.equal(env.get()[id(2)].name, "Renamed");
                assert.equal(env.store.getBackpackItems()[1].name, "Renamed");
                assert.equal(notifications, 1);
                assert.equal(env.writes().length - writes, ["lost ACK", "ACK ID", "ACK name"].includes(failure) ? 0 : 1);
            });
        }

        it("renames at 50 items and exact total JSON capacity, rejecting growth before writes", async () => {
            const env = fixture();
            await env.store.refreshBackpackAsync();
            for (let n = 0; n < 50; n++) env.put(n, metadataItem(n));
            await env.store.renameBackpackItemAsync(id(2), "At capacity");
            assert.equal(Object.keys(env.get()).length, 50);
            env.put(50, item(50));
            let writes = env.writes().length;
            await assert.rejects(env.store.renameBackpackItemAsync(id(2), "Over capacity"), /50/);
            assert.equal(env.writes().length, writes);
            for (let n = 0; n <= 50; n++) env.put(n, undefined);
            const target = Object.fromEntries(Array.from({ length: 5 }, (_, n) => [id(n), metadataItem(n)]));
            Object.values(target).forEach(entry => { entry.code = "x".repeat(100000); });
            const backpack = cloud ? { ...env.remote.get("alice").backpack, arcade: target } : { arcade: target };
            target[id(4)].code = target[id(4)].code.slice(JSON.stringify(backpack).length - 500000);
            assert.equal(JSON.stringify(backpack).length, 500000);
            Object.values(target).forEach((entry, n) => env.put(n, entry));
            await env.store.renameBackpackItemAsync(id(2), "Renamed 2");
            writes = env.writes().length;
            const before = env.get();
            await assert.rejects(env.store.renameBackpackItemAsync(id(2), "Renamed 2!"), /500000/);
            assert.equal(env.writes().length, writes);
            assert.deepStrictEqual(env.get(), before);
            await env.store.renameBackpackItemAsync(id(2), "X");
            assert.equal(env.get()[id(2)].name, "X");
        });

        for (const stage of cloud ? ["GET", "PATCH"] : ["queued", "write"]) {
            it(`rejects account switches while ${stage} and queued, without exposing or writing to the new account`, async () => {
                const env = fixture(), entered = deferred(), release = deferred();
                await env.store.refreshBackpackAsync();
                if (cloud) env.hook(async ({ method, run }) => {
                    if (method === stage) { entered.resolve(); await release.promise; }
                    return run();
                });
                if (stage === "write") env.local.hooks.setItem = ({ run }) => { run(); env.signIn("bob"); };
                const pending = env.store.renameBackpackItemAsync(id(2), "Renamed");
                const rejected = assert.rejects(pending, /account|editor changed|session/);
                if (cloud) await entered.promise;
                const queued = assert.rejects(env.store.renameBackpackItemAsync(id(1), "Queued"), /account|editor changed|session/);
                if (stage !== "write") env.signIn("bob");
                release.resolve();
                await Promise.all([rejected, queued]);
                assert.deepStrictEqual(env.remote.get("bob"), {});
                assert.deepStrictEqual(clone(env.store.getBackpackItems()), []);
                assert.equal(env.get()[id(1)].name, "Snippet 1");
                assert.equal(env.writes().length, ["PATCH", "write"].includes(stage) ? 1 : 0);
                assert.ok(env.requests.every(request => request.owner === "alice"));
            });
        }
    });
});

describe("durable guest backpack storage", () => {
    it("adds, updates, deletes and reloads native per-entry keys without network or auth calls", async () => {
        const first = guestEnvironment();
        await first.store.refreshBackpackAsync();
        assert.deepStrictEqual(clone(first.store.getBackpackItems()), []);
        await first.store.saveBackpackItemAsync(item(1));
        await first.store.saveBackpackItemAsync(item(2));
        await first.store.saveBackpackItemAsync(item(1, { name: "Updated" }));
        assert.deepStrictEqual(Array.from(first.local.data.keys()).sort(), [guestKey(1), guestKey(2)]);
        assert.deepStrictEqual(JSON.parse(first.local.data.get(guestKey(1))), item(1, { name: "Updated" }));
        const second = guestEnvironment(first.local);
        assert.deepStrictEqual(clone(second.store.getBackpackItems()), []);
        await second.store.refreshBackpackAsync();
        assert.deepStrictEqual(clone(second.store.getBackpackItems()), [item(2), item(1, { name: "Updated" })]);
        await second.store.deleteBackpackItemAsync(id(1));
        await second.store.deleteBackpackItemAsync(id(1));
        const third = guestEnvironment(first.local);
        await third.store.refreshBackpackAsync();
        assert.deepStrictEqual(clone(third.store.getBackpackItems()), [item(2)]);
        await first.store.refreshBackpackAsync();
        assert.deepStrictEqual(clone(first.store.getBackpackItems()), [item(2)]);
        for (const env of [first, second, third]) {
            assert.deepStrictEqual(env.requests, []);
            assert.deepStrictEqual(env.authCalls, []);
        }
    });

    it("clones invocation data, snapshots and imports including source metadata", async () => {
        const env = guestEnvironment();
        const entry = metadataItem(1), expected = clone(entry);
        const saving = env.store.saveBackpackItemAsync(entry);
        entry.code = "changed";
        entry.blockText = "changed after invocation";
        entry.dependencies.ext = "pub:changed";
        entry.projectBlocks.custom_block = "changed.ts";
        await saving;
        await env.store.saveBackpackItemAsync(item(2));
        assert.deepStrictEqual(JSON.parse(env.local.data.get(guestKey(1))), expected);
        const snapshot = env.store.getBackpackItems();
        assert.deepStrictEqual(clone(snapshot), [item(2), expected]);
        snapshot[1].blockText = "changed snapshot";
        snapshot[1].dependencies.core = "file:bad";
        snapshot[1].projectBlocks.custom_block = "bad.ts";
        snapshot.pop();
        let imports = 0;
        const cleanup = env.store.setBackpackEditor({ headerId: () => "header", canImport: () => true,
            importAsync: async imported => {
                imports++;
                assert.deepStrictEqual(clone(imported), expected);
                imported.blockText = "changed by editor";
                imported.dependencies.core = "file:bad";
                imported.projectBlocks.custom_block = "edited.ts";
                return true;
            } });
        try {
            assert.equal(env.store.canImportBackpack("header"), true);
            const input = clone(expected);
            const importing = env.store.importBackpackItemAsync(input, "header");
            input.blockText = "mutated during await";
            input.projectBlocks.custom_block = "mutated during await.ts";
            assert.equal(await importing, true);
            assert.equal(imports, 1);
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(2), expected]);
            assert.deepStrictEqual(JSON.parse(env.local.data.get(guestKey(1))), expected);
        } finally { cleanup(); }
        await env.store.saveBackpackItemAsync(item(1));
        assert.deepStrictEqual(JSON.parse(env.local.data.get(guestKey(1))), item(1));
        assert.deepStrictEqual(env.requests, []);
        assert.deepStrictEqual(env.authCalls, []);
    });

    it("preserves other targets, unrelated keys and interleaved other-tab additions/deletions", async () => {
        const env = guestEnvironment();
        const other = guestEnvironment(env.local);
        const untouched = new Map([[guestKey(9, "microbit"), JSON.stringify(metadataItem(9))],
            ["arcade/project", "private project"], ["arcade/backpack/guestish/keep", "keep"]]);
        untouched.forEach((value, key) => env.local.data.set(key, value));
        await env.store.saveBackpackItemAsync(item(1));
        await other.store.saveBackpackItemAsync(item(2));
        await other.store.deleteBackpackItemAsync(id(1));
        env.local.hooks.setItem = ({ run }) => {
            // Another tab adds a key after this operation's read but before its write.
            env.local.data.set(guestKey(3), JSON.stringify(item(3)));
            return run();
        };
        await env.store.saveBackpackItemAsync(item(2, { name: "updated" }));
        delete env.local.hooks.setItem;
        assert.equal(env.local.data.has(guestKey(1)), false);
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(3), item(2, { name: "updated" })]);
        await env.store.deleteBackpackItemAsync(id(2));
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(3)]);
        untouched.forEach((value, key) => assert.equal(env.local.data.get(key), value));
        assert.ok(storageWrites(env.local).every(call => call.method !== "clear" && call.args[0].startsWith("arcade/backpack/guest/")));
    });

    for (const method of ["access", "length", "key", "getItem"]) {
        it(`rejects unavailable guest reads (${method}) without fallback or false publication`, async () => {
            const env = guestEnvironment();
            await env.store.saveBackpackItemAsync(item(1));
            let notifications = 0;
            env.store.subscribeBackpack(() => { notifications++; });
            const before = Array.from(env.local.data);
            env.local.calls.length = 0;
            env.local.hooks[method] = storageFailure;
            await assert.rejects(env.store.refreshBackpackAsync(), /Could not read your local backpack/);
            await assert.rejects(env.store.saveBackpackItemAsync(item(2)), /Could not read your local backpack/);
            assert.equal(notifications, 0);
            assert.deepStrictEqual(Array.from(env.local.data), before);
            assert.deepStrictEqual(storageWrites(env.local), []);
            delete env.local.hooks[method];
            await env.store.saveBackpackItemAsync(item(2));
            assert.equal(notifications, 1);
            assert.equal(env.store.getBackpackItems().length, 2);
            assert.deepStrictEqual(env.requests, []);
            assert.deepStrictEqual(env.authCalls, []);
        });
    }

    for (const deleting of [false, true]) {
        for (const failure of ["throw", "noop", "readback"]) {
            it(`does not acknowledge guest ${deleting ? "delete" : "save"} after ${failure}, and permits retry`, async () => {
                const env = guestEnvironment();
                await env.store.saveBackpackItemAsync(item(1));
                let notifications = 0;
                env.store.subscribeBackpack(() => { notifications++; });
                const method = deleting ? "removeItem" : "setItem";
                env.local.hooks[method] = ({ run }) => {
                    if (failure === "throw") {
                        const error = new Error("quota exceeded: sensitive contents");
                        error.name = "QuotaExceededError";
                        throw error;
                    }
                    if (failure === "noop") return;
                    run();
                    env.local.hooks.getItem = storageFailure;
                };
                const mutate = () => deleting ? env.store.deleteBackpackItemAsync(id(1))
                    : env.store.saveBackpackItemAsync(item(1, { name: "updated" }));
                await assert.rejects(mutate(), /Could not save your local backpack/);
                assert.equal(notifications, 0);
                assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(1)]);
                if (failure !== "readback") assert.equal(env.local.data.get(guestKey(1)), JSON.stringify(item(1)));
                delete env.local.hooks[method];
                delete env.local.hooks.getItem;
                await mutate();
                assert.equal(notifications, 1);
                assert.deepStrictEqual(clone(env.store.getBackpackItems()), deleting ? [] : [item(1, { name: "updated" })]);
                assert.equal(env.local.data.has(guestKey(1)), !deleting);
                assert.deepStrictEqual(env.requests, []);
            });
        }
    }

    it("fails guest deletion when native Storage is inaccessible and retries durably", async () => {
        const env = guestEnvironment();
        await env.store.saveBackpackItemAsync(item(1));
        env.local.hooks.access = storageFailure;
        await assert.rejects(env.store.deleteBackpackItemAsync(id(1)), /Could not save your local backpack/);
        assert.equal(env.local.data.get(guestKey(1)), JSON.stringify(item(1)));
        delete env.local.hooks.access;
        await env.store.deleteBackpackItemAsync(id(1));
        assert.equal(env.local.data.size, 0);
    });

    for (const corrupt of ["{not JSON", "null", "[]", JSON.stringify(item(2)),
        JSON.stringify(item(1, { blockText: undefined })),
        JSON.stringify(item(1, { projectBlocks: { custom_block: 7 } })),
        JSON.stringify(item(1, { dependencies: { core: "workspace:private" } }))]) {
        it(`preserves corrupt local data (${corrupt.slice(0, 45)}) and permits recovery by key ID`, async () => {
            const env = guestEnvironment();
            env.local.data.set(guestKey(1), corrupt);
            env.local.data.set(guestKey(3), JSON.stringify(item(3)));
            await env.store.refreshBackpackAsync();
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(3)]);
            const recovery = recoveryEntry(env.store, id(1), "local");
            assert.equal(recovery.error, recoveryError);
            assert.equal(recovery.item, undefined);
            await env.store.saveBackpackItemAsync(item(4));
            assert.equal(env.local.data.get(guestKey(1)), corrupt);
            await env.store.deleteBackpackItemAsync(id(3));
            assert.equal(env.local.data.get(guestKey(1)), corrupt);
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(4)]);
            assert.deepStrictEqual(clone(recoveryEntry(env.store, id(1), "local")), clone(recovery));
            await env.store.deleteBackpackItemAsync(id(1));
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(4)]);
            assert.equal(env.store.getBackpackState().entries.length, 1);
        });
    }

    it("validates the same item schema before guest writes/imports without dropping private metadata into storage", async () => {
        const env = guestEnvironment();
        let imports = 0;
        const cleanup = env.store.setBackpackEditor({ headerId: () => "header", canImport: () => true,
            importAsync: async () => { imports++; return true; } });
        try {
            for (const invalid of [item(1, { id: "../bad" }), item(1, { name: "bad\nname" }),
                item(1, { code: "x".repeat(100001) }), item(1, { createdAt: -1 }),
                item(1, { dependencies: { core: "file:private" } }), item(1, { previewUri: "https://private" }),
                item(1, { projectBlocks: { custom_block: "bad\nfile.ts" } })]) {
                await assert.rejects(env.store.saveBackpackItemAsync(invalid));
                await assert.rejects(env.store.importBackpackItemAsync(invalid, "header"));
            }
            await assert.rejects(env.store.deleteBackpackItemAsync("../bad"), /Invalid/);
            assert.equal(imports, 0);
            assert.deepStrictEqual(storageWrites(env.local), []);
            await env.store.saveBackpackItemAsync({ ...metadataItem(1), headerId: "private-header", files: { "main.ts": "private" } });
            assert.deepStrictEqual(JSON.parse(env.local.data.get(guestKey(1))), metadataItem(1));
            assert.deepStrictEqual(env.authCalls, []);
        } finally { cleanup(); }
    });

    it("enforces 50 items from fresh tab data per target, allows updates at capacity and recovery deletes", async () => {
        const env = guestEnvironment();
        await env.store.refreshBackpackAsync();
        for (let i = 0; i < 50; i++) env.local.data.set(guestKey(i), JSON.stringify(item(i)));
        env.local.data.set(guestKey(99, "microbit"), JSON.stringify(item(99)));
        await assert.rejects(env.store.saveBackpackItemAsync(item(50)), /50/);
        assert.deepStrictEqual(storageWrites(env.local), []);
        await env.store.saveBackpackItemAsync(item(1, { name: "updated at capacity" }));
        await env.store.deleteBackpackItemAsync(id(2));
        await env.store.saveBackpackItemAsync(item(50));
        assert.equal(env.store.getBackpackItems().length, 50);
        env.local.data.set(guestKey(51), JSON.stringify(item(51)));
        await env.store.refreshBackpackAsync();
        assert.equal(env.store.getBackpackState().warning, quotaWarning);
        assert.equal(env.store.getBackpackState().entries.length, 51);
        assert.equal(env.store.getBackpackItems().length, 51);
        await env.store.deleteBackpackItemAsync(id(51));
        assert.equal(env.store.getBackpackItems().length, 50);
        assert.equal(env.store.getBackpackState().warning, undefined);
        assert.equal(env.local.data.get(guestKey(99, "microbit")), JSON.stringify(item(99)));
    });

    it("counts JSON/source metadata at the exact 500000-character boundary independently per target", async () => {
        const env = guestEnvironment();
        const entries = Array.from({ length: 5 }, (_, i) => metadataItem(i));
        entries.forEach(entry => { entry.code = "x".repeat(100000); });
        const target = Object.fromEntries(entries.map(entry => [entry.id, entry]));
        const overflow = JSON.stringify({ arcade: target }).length - 500000;
        entries[4].code = entries[4].code.slice(overflow);
        assert.equal(JSON.stringify({ arcade: target }).length, 500000);
        // Other editors and unrelated origin data do not consume this target's quota.
        env.local.data.set(guestKey(99, "microbit"), "x".repeat(500001));
        for (const entry of entries) await env.store.saveBackpackItemAsync(entry);
        const before = Array.from(env.local.data);
        env.local.calls.length = 0;
        await assert.rejects(env.store.saveBackpackItemAsync({ ...entries[4], code: entries[4].code + "x" }), /500000/);
        await assert.rejects(env.store.saveBackpackItemAsync({ ...entries[4], blockText: entries[4].blockText + "x" }), /500000/);
        await assert.rejects(env.store.saveBackpackItemAsync({ ...entries[4], projectBlocks: { ...entries[4].projectBlocks, extra: "source.ts" } }), /500000/);
        assert.deepStrictEqual(storageWrites(env.local), []);
        assert.deepStrictEqual(Array.from(env.local.data), before);
        // Recovery must still work for data externally pushed over quota.
        env.local.data.set(guestKey(4), JSON.stringify({ ...entries[4], code: entries[4].code + "x" }));
        await env.store.refreshBackpackAsync();
        assert.equal(env.store.getBackpackState().warning, quotaWarning);
        assert.equal(env.store.getBackpackItems().length, 5);
        await env.store.deleteBackpackItemAsync(id(4));
        assert.equal(env.store.getBackpackItems().length, 4);
        assert.equal(env.store.getBackpackState().warning, undefined);
    });

    for (const change of ["signin", "target"]) {
        it(`captures identity before queued guest writes and imports on ${change}`, async () => {
            const env = guestEnvironment();
            let imports = 0;
            const cleanup = env.store.setBackpackEditor({ headerId: () => "header", canImport: () => true,
                importAsync: async () => { imports++; return true; } });
            try {
                const pending = [env.store.saveBackpackItemAsync(item(1)), env.store.saveBackpackItemAsync(item(2)),
                    env.store.deleteBackpackItemAsync(id(3)), env.store.importBackpackItemAsync(item(4), "header")];
                const rejected = pending.map(operation => assert.rejects(operation, /account|editor changed/));
                if (change === "signin") env.signIn("alice");
                else env.pxt.appTarget.id = "microbit";
                await Promise.all(rejected);
                assert.equal(imports, 0);
                assert.deepStrictEqual(storageWrites(env.local), []);
                assert.deepStrictEqual(env.requests, []);
                assert.deepStrictEqual(clone(env.store.getBackpackItems()), []);
                if (change === "signin") env.signIn(undefined);
                else env.pxt.appTarget.id = "arcade";
                await env.store.saveBackpackItemAsync(item(5));
                assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(5)]);
            } finally { cleanup(); }
        });
    }

    for (const missing of ["user", "client"]) {
        it(`does not fall back to guest storage with a token but missing ${missing}`, async () => {
            const env = guestEnvironment();
            await env.store.saveBackpackItemAsync(item(1));
            const before = Array.from(env.local.data);
            env.signIn("alice");
            if (missing === "user") env.pxt.auth.cachedUserState = {};
            else env.pxt.auth.client = () => undefined;
            env.local.calls.length = 0;
            let imports = 0;
            const cleanup = env.store.setBackpackEditor({ headerId: () => "header", canImport: () => true,
                importAsync: async () => { imports++; return true; } });
            try {
                assert.deepStrictEqual(clone(env.store.getBackpackItems()), []);
                assert.equal(env.store.canImportBackpack("header"), false);
                await assert.rejects(env.store.saveBackpackItemAsync(item(2)), /session is not ready/);
                await assert.rejects(env.store.deleteBackpackItemAsync(id(1)), /session is not ready/);
                await assert.rejects(env.store.importBackpackItemAsync(item(1), "header"), /session is not ready/);
                await env.store.refreshBackpackAsync();
                assert.equal(imports, 0);
                assert.deepStrictEqual(env.local.calls, []);
                assert.deepStrictEqual(Array.from(env.local.data), before);
                assert.deepStrictEqual(env.requests, []);
            } finally { cleanup(); }
        });
    }

    it("never exposes or persists a cloud snapshot on signout or target switch", async () => {
        const env = environment();
        await env.store.saveBackpackItemAsync(metadataItem(1));
        env.local.data.set(guestKey(2), JSON.stringify(item(2)));
        env.local.data.set(guestKey(3, "microbit"), JSON.stringify(item(3)));
        env.signIn(undefined);
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), []);
        await env.store.refreshBackpackAsync();
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(2)]);
        assert.equal(env.local.data.has(guestKey(1)), false);
        env.pxt.appTarget.id = "microbit";
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), []);
        await env.store.refreshBackpackAsync();
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(3)]);
        assert.deepStrictEqual(env.remote.get("alice").backpack.arcade, { [id(1)]: metadataItem(1) });
    });
});

describe("guest to cloud backpack promotion", () => {
    for (const operation of ["refresh", "save"]) {
        it(`automatically appends guests on cloud ${operation} without replacing existing data or other targets`, async () => {
            const env = guestEnvironment();
            await env.store.saveBackpackItemAsync(metadataItem(1));
            await env.store.saveBackpackItemAsync(item(2));
            const otherTarget = JSON.stringify(metadataItem(9));
            env.local.data.set(guestKey(9, "microbit"), otherTarget);
            env.local.data.set("unrelated", "keep");
            const original = { language: "fr", badges: { keep: true }, backpack: {
                arcade: { [id(3)]: item(3) }, microbit: { [id(8)]: item(8) }
            } };
            env.remote.set("alice", clone(original));
            env.signIn("alice");
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), []);
            if (operation === "refresh") await env.store.refreshBackpackAsync();
            else await env.store.saveBackpackItemAsync(item(4));
            const expected = { [id(1)]: metadataItem(1), [id(2)]: item(2), [id(3)]: item(3) };
            if (operation === "save") expected[id(4)] = item(4);
            assert.deepStrictEqual(env.remote.get("alice"), { ...original, backpack: { ...original.backpack, arcade: expected } });
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), Object.values(expected).reverse());
            assert.deepStrictEqual(Array.from(env.local.data), [[guestKey(9, "microbit"), otherTarget], ["unrelated", "keep"]]);
            const promotion = patches(env)[0].data;
            assert.ok(promotion.every(op => op.op === "add"));
            assert.deepStrictEqual(promotion.slice(0, 2).map(op => op.path), [["backpack"], ["backpack", "arcade"]]);
            assert.deepStrictEqual(promotion.slice(2).map(op => op.path).sort(),
                [["backpack", "arcade", id(1)], ["backpack", "arcade", id(2)]]);
            assert.deepStrictEqual(promotion.slice(2).map(op => op.value.blockText).sort(),
                [metadataItem(1).blockText, item(2).blockText].sort());
            assert.equal(patches(env).length, operation === "refresh" ? 1 : 2);
            assert.deepStrictEqual(env.telemetry, []);
            const reopened = environment(env.remote, env.local);
            await reopened.store.refreshBackpackAsync();
            assert.deepStrictEqual(clone(reopened.store.getBackpackItems()), Object.values(expected).reverse());
            assert.deepStrictEqual(patches(reopened), []);
            assert.deepStrictEqual(reopened.telemetry, []);
        });
    }

    for (const failure of ["failed", "thrown", "lost ACK"]) {
        it(`retains guests after ${failure} and retries promotion idempotently`, async () => {
            const env = guestEnvironment();
            await env.store.saveBackpackItemAsync(metadataItem(1));
            const before = Array.from(env.local.data);
            env.remote.set("alice", { backpack: { arcade: { [id(2)]: item(2) } } });
            env.signIn("alice");
            let notifications = 0;
            env.store.subscribeBackpack(() => { notifications++; });
            env.hook(({ method, run }) => {
                if (method !== "PATCH") return run();
                if (failure === "lost ACK") run();
                if (failure === "thrown") throw new Error("PRIVATE_CODE alice-session");
                return { success: false };
            });
            await env.store.refreshBackpackAsync();
            assert.deepStrictEqual(Array.from(env.local.data), before);
            assert.equal(notifications, 1);
            assertSyncWarning(env, [item(2)]);
            assert.equal(env.store.getBackpackState().entries.length, 1, "Never publish an unacknowledged upload");
            assert.deepStrictEqual(env.remote.get("alice").backpack.arcade[id(2)], item(2));
            env.hook(undefined);
            await env.store.refreshBackpackAsync();
            assert.equal(env.local.data.size, 0);
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(2), metadataItem(1)]);
            assert.equal(env.store.getBackpackState().warning, undefined);
            assert.equal(patches(env).length, failure === "lost ACK" ? 1 : 2);
            await env.store.refreshBackpackAsync();
            assert.equal(patches(env).length, failure === "lost ACK" ? 1 : 2);
            assert.deepStrictEqual(env.remote.get("alice").backpack.arcade, { [id(2)]: item(2), [id(1)]: metadataItem(1) });
        });
    }

    it("cleans identical acknowledged items without PATCH regardless of map/property ordering", async () => {
        const env = guestEnvironment();
        await env.store.saveBackpackItemAsync(metadataItem(1));
        const reordered = Object.fromEntries(Object.entries(metadataItem(1)).reverse());
        reordered.dependencies = Object.fromEntries(Object.entries(reordered.dependencies).reverse());
        reordered.projectBlocks = Object.fromEntries(Object.entries(reordered.projectBlocks).reverse());
        env.remote.set("alice", { backpack: { arcade: { [id(1)]: reordered } } });
        env.signIn("alice");
        await env.store.refreshBackpackAsync();
        assert.equal(env.local.data.size, 0);
        assert.deepStrictEqual(patches(env), []);
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), [metadataItem(1)]);
    });

    for (const field of ["code", "blockText", "dependencies", "projectBlocks", "previewUri", "previewPixelDensity", "createdAt"]) {
        it(`refuses differing ID collision (${field}) before any promotion writes`, async () => {
            const env = guestEnvironment();
            await env.store.saveBackpackItemAsync(item(2));
            await env.store.saveBackpackItemAsync(metadataItem(1));
            const differing = { ...metadataItem(1), [field]: {
                code: "different", blockText: "different labels", dependencies: { core: "*" }, projectBlocks: { custom_block: "different.ts" },
                previewUri: undefined, previewPixelDensity: 2, createdAt: 42
            }[field] };
            env.remote.set("alice", { backpack: { arcade: { [id(1)]: differing } } });
            const original = clone(env.remote.get("alice")), before = Array.from(env.local.data);
            env.local.calls.length = 0;
            env.signIn("alice");
            await env.store.refreshBackpackAsync();
            assertSyncWarning(env, [clone(differing)]);
            await assert.rejects(env.store.saveBackpackItemAsync(item(3)), /conflicts/);
            assert.deepStrictEqual(patches(env), []);
            assert.deepStrictEqual(storageWrites(env.local), []);
            assert.deepStrictEqual(Array.from(env.local.data), before);
            assert.deepStrictEqual(clone(env.remote.get("alice")), original);
        });
    }

    for (const quota of ["items", "JSON", "metadata"]) {
        it(`refuses combined promotion ${quota} overcapacity before cloud writes or local cleanup`, async () => {
            const env = guestEnvironment();
            await env.store.saveBackpackItemAsync(metadataItem(99));
            let target;
            if (quota === "items") target = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [id(i), item(i)]));
            else {
                target = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [id(i), item(i, { code: "x".repeat(100000) })]));
                const size = JSON.stringify({ arcade: target }).length;
                const guestSize = JSON.stringify({ arcade: { ...target, [id(99)]: metadataItem(99) } }).length - size;
                const desired = quota === "metadata" ? 500000 - guestSize + 1 : 499999;
                target[id(4)].code = target[id(4)].code.slice(size - desired);
                assert.ok(JSON.stringify({ arcade: target }).length <= 500000);
                assert.ok(JSON.stringify({ arcade: { ...target, [id(99)]: metadataItem(99) } }).length > 500000);
                if (quota === "metadata") {
                    assert.ok(JSON.stringify({ arcade: { ...target, [id(99)]: item(99) } }).length < 500000);
                }
            }
            env.remote.set("alice", { backpack: { arcade: target } });
            const original = clone(env.remote.get("alice")), before = Array.from(env.local.data);
            env.local.calls.length = 0;
            env.signIn("alice");
            await env.store.refreshBackpackAsync();
            assertSyncWarning(env, Object.values(target).reverse());
            await assert.rejects(env.store.saveBackpackItemAsync(item(100)), quota === "items" ? /50/ : /500000/);
            assert.deepStrictEqual(patches(env), []);
            assert.deepStrictEqual(storageWrites(env.local), []);
            assert.deepStrictEqual(Array.from(env.local.data), before);
            assert.deepStrictEqual(env.remote.get("alice"), original);
        });
    }

    it("preflights a new cloud save together with guest promotion before any overcapacity writes", async () => {
        const env = guestEnvironment();
        await env.store.saveBackpackItemAsync(item(99));
        const target = Object.fromEntries(Array.from({ length: 49 }, (_, i) => [id(i), item(i)]));
        env.remote.set("alice", { backpack: { arcade: target } });
        const original = clone(env.remote.get("alice")), before = Array.from(env.local.data);
        env.local.calls.length = 0;
        env.signIn("alice");
        // Both the guest snippet and the requested new snippet fit individually,
        // but the complete save would contain 51 items. Refuse before writing.
        await assert.rejects(env.store.saveBackpackItemAsync(item(100)), /50/);
        assert.deepStrictEqual(patches(env), [], "An overcapacity save must not PATCH guest items first");
        assert.deepStrictEqual(storageWrites(env.local), []);
        assert.deepStrictEqual(Array.from(env.local.data), before);
        assert.deepStrictEqual(env.remote.get("alice"), original);
    });

    for (const response of ["missing", "code", "blockText", "missing blockText", "metadata", "missing density", "changed density", "race collision"]) {
        it(`keeps all local copies when promotion acknowledgement has ${response}`, async () => {
            const env = guestEnvironment();
            await env.store.saveBackpackItemAsync({ ...metadataItem(1), previewPixelDensity: 2 });
            await env.store.saveBackpackItemAsync(item(2));
            const before = Array.from(env.local.data);
            env.signIn("alice");
            env.hook(({ method, run }) => {
                if (method !== "PATCH") return run();
                if (response === "race collision") {
                    env.remote.set("alice", { backpack: { arcade: { [id(1)]: item(1, { code: "other device" }) } } });
                }
                const result = run();
                if (response === "missing") delete result.resp.backpack.arcade[id(1)];
                if (response === "code") result.resp.backpack.arcade[id(1)].code = "not identical";
                if (response === "blockText") result.resp.backpack.arcade[id(1)].blockText = "not identical";
                if (response === "missing blockText") delete result.resp.backpack.arcade[id(1)].blockText;
                if (response === "metadata") delete result.resp.backpack.arcade[id(1)].projectBlocks;
                if (response === "missing density") delete result.resp.backpack.arcade[id(1)].previewPixelDensity;
                if (response === "changed density") result.resp.backpack.arcade[id(1)].previewPixelDensity = 1.5;
                return result;
            });
            let notifications = 0;
            env.store.subscribeBackpack(() => { notifications++; });
            await env.store.refreshBackpackAsync();
            assert.deepStrictEqual(Array.from(env.local.data), before);
            assert.equal(notifications, 1);
            assertSyncWarning(env, []);
            assert.equal(env.store.getBackpackState().entries.length, 0, "Publish the original GET, not a damaged ACK");
            if (response === "race collision") assert.equal(env.remote.get("alice").backpack.arcade[id(1)].code, "other device");
        });
    }

    it("retains guest edits and other-tab additions made during upload instead of deleting newer local data", async () => {
        const env = guestEnvironment();
        const tab = guestEnvironment(env.local);
        await env.store.saveBackpackItemAsync(metadataItem(1));
        await env.store.saveBackpackItemAsync(item(2));
        env.signIn("alice");
        const entered = deferred(), release = deferred();
        env.hook(async ({ method, run }) => {
            if (method === "PATCH") { entered.resolve(); await release.promise; }
            return run();
        });
        const uploading = env.store.refreshBackpackAsync();
        await entered.promise;
        try {
            assert.equal(env.local.data.size, 2);
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), []);
            await tab.store.saveBackpackItemAsync({ ...metadataItem(1), projectBlocks: { custom_block: "edited.ts" } });
            await tab.store.saveBackpackItemAsync(item(3));
        } finally { release.resolve(); }
        await uploading;
        assert.deepStrictEqual(env.remote.get("alice").backpack.arcade, { [id(1)]: metadataItem(1), [id(2)]: item(2) });
        assert.deepStrictEqual(Array.from(env.local.data.keys()).sort(), [guestKey(1), guestKey(3)]);
        assert.equal(JSON.parse(env.local.data.get(guestKey(1))).projectBlocks.custom_block, "edited.ts");
        env.hook(undefined);
        await env.store.refreshBackpackAsync();
        assertSyncWarning(env, [item(2), metadataItem(1)]);
        assert.equal(patches(env).length, 1);
        assert.equal(env.local.data.has(guestKey(3)), true);
    });

    it("retains text-only guest edits during promotion and detects the resulting cloud conflict", async () => {
        const env = guestEnvironment();
        const tab = guestEnvironment(env.local);
        await env.store.saveBackpackItemAsync(metadataItem(1));
        env.signIn("alice");
        const entered = deferred(), release = deferred();
        env.hook(async ({ method, run }) => {
            if (method === "PATCH") { entered.resolve(); await release.promise; }
            return run();
        });
        const uploading = env.store.refreshBackpackAsync();
        await entered.promise;
        const edited = { ...metadataItem(1), blockText: "PRIVATE_NEW_LOCAL_LABELS" };
        try { await tab.store.saveBackpackItemAsync(edited); }
        finally { release.resolve(); }
        await uploading;
        assert.deepStrictEqual(env.remote.get("alice").backpack.arcade[id(1)], metadataItem(1));
        assert.deepStrictEqual(JSON.parse(env.local.data.get(guestKey(1))), edited);
        env.hook(undefined);
        await env.store.refreshBackpackAsync();
        assertSyncWarning(env, [metadataItem(1)]);
        assert.equal(patches(env).length, 1);
        assert.deepStrictEqual(JSON.parse(env.local.data.get(guestKey(1))), edited);
        assert.deepStrictEqual([env.telemetry, tab.telemetry, tab.requests], [[], [], []]);
    });

    for (const failure of ["throw", "noop", "read"]) {
        it(`retains local copies on cleanup ${failure} and retries without reuploading`, async () => {
            const env = guestEnvironment();
            await env.store.saveBackpackItemAsync(metadataItem(1));
            await env.store.saveBackpackItemAsync(item(2));
            const before = Array.from(env.local.data);
            env.signIn("alice");
            env.hook(({ method, run }) => {
                const result = run();
                if (method === "PATCH") {
                    if (failure === "read") env.local.hooks.getItem = storageFailure;
                    else env.local.hooks.removeItem = failure === "throw" ? storageFailure : () => {};
                }
                return result;
            });
            let notifications = 0;
            env.store.subscribeBackpack(() => { notifications++; });
            await env.store.refreshBackpackAsync();
            assert.deepStrictEqual(Array.from(env.local.data), before);
            assert.equal(notifications, 1);
            assertSyncWarning(env, []);
            assert.deepStrictEqual(env.remote.get("alice").backpack.arcade, { [id(1)]: metadataItem(1), [id(2)]: item(2) });
            env.hook(undefined);
            delete env.local.hooks.getItem;
            delete env.local.hooks.removeItem;
            await env.store.refreshBackpackAsync();
            assert.equal(env.local.data.size, 0);
            assert.equal(patches(env).length, 1);
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(2), metadataItem(1)]);
        });
    }

    it("retries partially completed cleanup without losing the remaining confirmed copy", async () => {
        const env = guestEnvironment();
        await env.store.saveBackpackItemAsync(item(1));
        await env.store.saveBackpackItemAsync(item(2));
        let removed;
        env.local.hooks.removeItem = ({ args, run }) => {
            if (removed) return storageFailure();
            removed = args[0];
            return run();
        };
        env.signIn("alice");
        await env.store.refreshBackpackAsync();
        assertSyncWarning(env, []);
        const remaining = removed === guestKey(1) ? 2 : 1;
        assert.deepStrictEqual(Array.from(env.local.data), [[guestKey(remaining), JSON.stringify(item(remaining))]]);
        assert.deepStrictEqual(env.remote.get("alice").backpack.arcade, { [id(1)]: item(1), [id(2)]: item(2) });
        delete env.local.hooks.removeItem;
        await env.store.refreshBackpackAsync();
        assert.equal(env.local.data.size, 0);
        assert.equal(patches(env).length, 1);
    });

    for (const method of ["access", "length", "key", "getItem"]) {
        it(`allows cloud-only refresh/save/delete with blocked local ${method} but guest operations fail`, async () => {
            const env = environment();
            env.local.data.set(guestKey(9), JSON.stringify(item(9)));
            env.local.hooks[method] = storageFailure;
            await env.store.refreshBackpackAsync();
            await env.store.saveBackpackItemAsync(item(1));
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(1)]);
            await env.store.deleteBackpackItemAsync(id(1));
            assert.deepStrictEqual(env.remote.get("alice").backpack.arcade, {});
            assert.equal(env.local.data.get(guestKey(9)), JSON.stringify(item(9)));
            assert.deepStrictEqual(storageWrites(env.local), []);
            env.signIn(undefined);
            await assert.rejects(env.store.refreshBackpackAsync(), /local backpack/);
            await assert.rejects(env.store.saveBackpackItemAsync(item(2)), /local backpack/);
            assert.equal(env.local.data.has(guestKey(2)), false);
        });
    }

    for (const stage of ["GET", "PATCH"]) {
        for (const change of ["account", "signout", "target", "client", "token"]) {
            it(`does not clean guests or contaminate another account after ${change} during promotion ${stage}`, async () => {
                const env = guestEnvironment();
                await env.store.saveBackpackItemAsync(metadataItem(1));
                const before = Array.from(env.local.data);
                env.signIn("alice");
                const entered = deferred(), release = deferred();
                env.hook(async ({ method, run }) => {
                    if (method === stage) { entered.resolve(); await release.promise; }
                    return run();
                });
                const pending = env.store.refreshBackpackAsync();
                const rejected = assert.rejects(pending, /account|editor changed|session/);
                await entered.promise;
                if (change === "account") env.signIn("bob");
                if (change === "signout") env.signIn(undefined);
                if (change === "target") env.pxt.appTarget.id = "microbit";
                if (change === "client") env.pxt.auth.client = () => ({ apiAsync: () => { throw new Error("Wrong client"); } });
                if (change === "token") env.signIn("alice", "alice-new-session");
                release.resolve();
                await rejected;
                assert.deepStrictEqual(Array.from(env.local.data), before);
                assert.deepStrictEqual(env.remote.get("bob"), {});
                assert.ok(env.requests.every(request => request.owner === "alice"));
                assert.equal(patches(env).length, stage === "GET" ? 0 : 1);
                // A guest snapshot from before sign-in belongs to this same
                // browser/target; it is not data leaked from a cloud account.
                assert.deepStrictEqual(clone(env.store.getBackpackItems()), change === "signout" ? [metadataItem(1)] : []);
                if (stage === "PATCH") assert.deepStrictEqual(env.remote.get("alice").backpack.arcade[id(1)], metadataItem(1));
            });
        }
    }

    it("keeps malformed guest recovery cards local while promoting valid neighbors and saving", async () => {
        const env = environment();
        env.local.data.set(guestKey(1), "{bad JSON");
        env.local.data.set(guestKey(2), JSON.stringify(item(2)));
        await env.store.refreshBackpackAsync();
        assertRecovery(recoveryEntry(env.store, id(1), "local"), id(1), "local");
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(2)]);
        await env.store.saveBackpackItemAsync(item(3));
        assertRecovery(recoveryEntry(env.store, id(1), "local"), id(1), "local");
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(3), item(2)]);
        assert.deepStrictEqual(patches(env).map(request => request.data[2].path),
            [["backpack", "arcade", id(2)], ["backpack", "arcade", id(3)]]);
        assert.deepStrictEqual(storageWrites(env.local).map(call => [call.method, call.args[0]]), [["removeItem", guestKey(2)]]);
        assert.equal(env.local.data.get(guestKey(1)), "{bad JSON");
        assert.equal(env.local.data.has(guestKey(2)), false);
        assert.deepStrictEqual(env.remote.get("alice").backpack.arcade, { [id(2)]: item(2), [id(3)]: item(3) });
        assert.equal(env.store.getBackpackState().warning, undefined);
    });
});

describe("private profile backpack storage", () => {
    it("uses actual parent-add NOOP semantics and preserves other targets/preferences/entries", async () => {
        const env = environment();
        const original = { language: "fr", badges: { keep: true }, backpack: { microbit: { [id(9)]: item(9) }, arcade: { [id(1)]: item(1) } } };
        env.remote.set("alice", clone(original));
        await env.store.saveBackpackItemAsync(item(2));
        const saved = env.remote.get("alice");
        assert.deepStrictEqual(saved.backpack.microbit, original.backpack.microbit);
        assert.deepStrictEqual(saved.backpack.arcade[id(1)], item(1));
        assert.equal(saved.language, "fr");
        assert.deepStrictEqual(saved.badges, original.badges);
        const patch = env.requests.find(r => r.method === "PATCH").data;
        assert.deepStrictEqual(patch.map(op => op.path), [["backpack"], ["backpack", "arcade"], ["backpack", "arcade", id(2)]]);
    });

    it("persists across devices and deletes persist after reopening", async () => {
        const first = environment();
        const second = environment(first.remote);
        await first.store.saveBackpackItemAsync(item(1));
        await second.store.refreshBackpackAsync();
        assert.deepStrictEqual(clone(second.store.getBackpackItems()), [item(1)]);
        await second.store.deleteBackpackItemAsync(id(1));
        await first.store.refreshBackpackAsync();
        assert.equal(first.store.getBackpackItems().length, 0);
        await environment(first.remote).store.refreshBackpackAsync();
        assert.deepStrictEqual(first.remote.get("alice").backpack.arcade, {});
    });

    it("serializes concurrent adds, updates, and removes and clones invocation data", async () => {
        const env = environment();
        const entry = item(1);
        const saving = env.store.saveBackpackItemAsync(entry);
        entry.code = "changed outside store";
        entry.blockText = "changed outside store";
        await Promise.all([saving, env.store.saveBackpackItemAsync(item(2)), env.store.deleteBackpackItemAsync(id(1)),
            env.store.saveBackpackItemAsync(item(2, { name: "updated" }))]);
        assert.deepStrictEqual(env.requests.map(r => r.method), ["GET", "PATCH", "GET", "PATCH", "GET", "PATCH", "GET", "PATCH"]);
        assert.equal(env.requests[1].data[2].value.code, "PRIVATE_CODE");
        assert.equal(env.requests[1].data[2].value.blockText, item(1).blockText);
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(2, { name: "updated" })]);
    });

    it("returns newest-first detached snapshots and notifies only after acknowledgement", async () => {
        const env = environment();
        let notifications = 0;
        const off = env.store.subscribeBackpack(() => { notifications++; });
        const entered = deferred(), release = deferred();
        env.hook(async ({ method, run }) => {
            if (method === "PATCH") { entered.resolve(); await release.promise; }
            return run();
        });
        const pending = env.store.saveBackpackItemAsync(item(1));
        await entered.promise;
        assert.equal(notifications, 0);
        assert.equal(env.store.getBackpackItems().length, 0);
        release.resolve(); await pending;
        env.hook(undefined);
        await env.store.saveBackpackItemAsync(item(2));
        const items = env.store.getBackpackItems();
        assert.equal(items[0].id, id(2));
        items[0].dependencies.core = "file:bad"; items.pop();
        assert.equal(env.store.getBackpackItems().length, 2);
        assert.equal(env.store.getBackpackItems()[0].dependencies.core, "*");
        assert.equal(notifications, 2);
        off(); await env.store.refreshBackpackAsync(); assert.equal(notifications, 2);
    });

    for (const uncertain of [false, true]) {
        for (const deleting of [false, true]) {
            it(`retries ${deleting ? "delete" : "add"} after ${uncertain ? "lost acknowledgement" : "failed PATCH"}`, async () => {
                const env = environment();
                if (deleting) await env.store.saveBackpackItemAsync(item(1));
                env.hook(({ method, run }) => {
                    if (method === "PATCH") {
                        if (uncertain) run();
                        return { success: false };
                    }
                    return run();
                });
                const mutate = () => deleting ? env.store.deleteBackpackItemAsync(id(1)) : env.store.saveBackpackItemAsync(item(1));
                await assert.rejects(mutate(), /sync/);
                assert.equal(env.store.getBackpackItems().length, deleting ? 1 : 0);
                env.hook(undefined);
                await mutate();
                assert.equal(env.store.getBackpackItems().length, deleting ? 0 : 1);
                assert.equal(Object.keys(env.remote.get("alice").backpack.arcade).length, deleting ? 0 : 1);
            });
        }
    }

    it("preserves the visible item during a pending delete", async () => {
        const env = environment(); await env.store.saveBackpackItemAsync(item(1));
        const entered = deferred(), release = deferred();
        env.hook(async ({ method, run }) => {
            if (method === "PATCH") { entered.resolve(); await release.promise; }
            return run();
        });
        const pending = env.store.deleteBackpackItemAsync(id(1));
        await entered.promise;
        assert.equal(env.store.getBackpackItems().length, 1);
        release.resolve(); await pending;
        assert.equal(env.store.getBackpackItems().length, 0);
    });

    for (const stage of ["GET", "PATCH"]) {
        for (const nextUser of [undefined, "bob"]) {
            it(`rejects ${stage} in flight on ${nextUser ? "account switch" : "signout"} without exposing old data`, async () => {
                const env = environment(); await env.store.saveBackpackItemAsync(item(1));
                const entered = deferred(), release = deferred();
                env.hook(async ({ method, run }) => {
                    if (method === stage) { entered.resolve(); await release.promise; }
                    return run();
                });
                const pending = env.store.saveBackpackItemAsync(item(2));
                const rejected = assert.rejects(pending, /account|session|Sign in/);
                await entered.promise;
                env.signIn(nextUser);
                assert.equal(env.store.getBackpackItems().length, 0);
                release.resolve(); await rejected;
                assert.equal(env.store.getBackpackItems().length, 0);
                assert.deepStrictEqual(env.remote.get("bob"), {});
                env.hook(undefined); await env.store.refreshBackpackAsync();
                assert.equal(env.store.getBackpackItems().length, 0);
            });
        }
    }

    it("captures queued identity before it runs, and rejects changed tokens and targets", async () => {
        const env = environment();
        const entered = deferred(), release = deferred();
        env.hook(async ({ run }) => { entered.resolve(); await release.promise; return run(); });
        const first = env.store.saveBackpackItemAsync(item(1));
        await entered.promise;
        const queued = env.store.saveBackpackItemAsync(item(2));
        const rejected = Promise.all([assert.rejects(first), assert.rejects(queued)]);
        env.signIn("bob"); release.resolve(); await rejected;
        assert.equal(env.requests.length, 1);
        env.hook(undefined);
        await env.store.saveBackpackItemAsync(item(3));
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(3)]);
        env.pxt.appTarget.id = "microbit";
        assert.equal(env.store.getBackpackItems().length, 0);
        env.hook(({ run }) => { env.signIn("bob", "bob-new-session"); return run(); });
        await assert.rejects(env.store.saveBackpackItemAsync(item(4)), /session/);
    });

    it("preserves entries concurrently written by another device after GET", async () => {
        const env = environment();
        env.hook(({ method, run }) => {
            if (method === "PATCH") env.remote.set("alice", { language: "de", backpack: { arcade: { [id(9)]: item(9) }, microbit: {} } });
            return run();
        });
        await env.store.saveBackpackItemAsync(item(1));
        assert.equal(env.remote.get("alice").language, "de");
        assert.equal(env.store.getBackpackItems().length, 2);
    });

    it("does not report an add NOOP conflict as a successful save", async () => {
        const env = environment();
        env.hook(({ method, run }) => {
            if (method === "PATCH") env.remote.set("alice", { backpack: { arcade: { [id(1)]: item(1, { code: "other device" }) } } });
            return run();
        });
        await assert.rejects(env.store.saveBackpackItemAsync(item(1)), /another device/);
        assert.equal(env.store.getBackpackItems().length, 0);
    });

    it("never hides or rewrites malformed neighbors and allows deleting corrupted IDs", async () => {
        const env = environment();
        const corrupt = { code: 7, dependencies: { core: "workspace:private" } };
        env.remote.set("alice", { backpack: { arcade: { [id(1)]: item(1), [id(2)]: corrupt } } });
        await env.store.refreshBackpackAsync();
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), [item(1)]);
        assertRecovery(recoveryEntry(env.store, id(2), "cloud"), id(2), "cloud");
        await env.store.deleteBackpackItemAsync(id(1));
        assert.deepStrictEqual(env.remote.get("alice").backpack.arcade[id(2)], corrupt);
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), []);
        assertRecovery(recoveryEntry(env.store, id(2), "cloud"), id(2), "cloud");
        await env.store.deleteBackpackItemAsync(id(2));
        assert.equal(env.store.getBackpackItems().length, 0);
        assert.deepStrictEqual(patches(env).map(request => request.data), [1, 2].map(n =>
            [{ op: "remove", path: ["backpack", "arcade", id(n)] }]));
    });

    it("rejects malformed collections without replacing them", async () => {
        for (const backpack of [null, [], { arcade: [] }, { arcade: null }, { arcade: "bad" }]) {
            const env = environment(); env.remote.set("alice", { backpack });
            await assert.rejects(env.store.refreshBackpackAsync());
            assert.throws(() => env.store.getBackpackState(), /could not be read/);
            assert.throws(() => env.store.getBackpackItems(), /could not be read/);
            await assert.rejects(env.store.saveBackpackItemAsync(item(1)), /malformed/);
            await assert.rejects(env.store.deleteBackpackItemAsync(id(1)), /malformed/);
            assert.ok(env.requests.every(r => r.method === "GET"));
        }
    });

    it("validates cloud key/ID agreement before exposing items", async () => {
        const env = environment(); env.remote.set("alice", { backpack: { arcade: { [id(1)]: item(2) } } });
        await env.store.refreshBackpackAsync();
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), []);
        assertRecovery(recoveryEntry(env.store, id(1), "cloud"), id(1), "cloud", "Snippet 2", 2);
        await env.store.deleteBackpackItemAsync(id(1));
        assert.equal(env.store.getBackpackItems().length, 0);
    });

    it("checks names, IDs, code, required block text, timestamps, dependencies, and previews", () => {
        const { store } = environment();
        const invalid = [null, [], item(1, { id: "constructor" }), item(1, { id: "../x" }), item(1, { name: " " }),
            item(1, { name: "x".repeat(101) }), item(1, { name: "bad\nname" }), item(1, { code: 7 }),
            item(1, { code: "x".repeat(100001) }), item(1, { createdAt: Infinity }), item(1, { createdAt: -1 }),
            item(1, { dependencies: [] }), item(1, { dependencies: JSON.parse('{"__proto__":"*"}') }),
            item(1, { dependencies: { constructor: "*" } }), item(1, { dependencies: { prototype: "*" } }),
            item(1, { previewUri: "https://example.com/image.png" }), item(1, { previewUri: "data:image/svg+xml;base64,AAAA" }),
            item(1, { previewUri: "data:image/png;base64,AAAA" }),
            item(1, { previewUri: "data:image/png;base64,iVBORw0KGgo".padEnd(store.MAX_BACKPACK_PREVIEW_LENGTH + 2, "A") })];
        for (const version of ["workspace:x", "file:x", "pkg:x", "https://github.com/a/b", "github:a", "github:a/b/../c", "github:a/b#x:y", "pub:../x", "pub:", "*"]) {
            invalid.push(item(1, { dependencies: { unknown: version } }));
        }
        for (const value of invalid) assert.throws(() => store.validateBackpackItem(value));
        for (const blockText of [undefined, null, 7, false, [], {}, "x".repeat(store.MAX_BACKPACK_CODE_LENGTH + 1)]) {
            assert.throws(() => store.validateBackpackItem(item(1, { blockText })), /Backpack block text/);
        }
        const missing = item(1);
        delete missing.blockText;
        assert.throws(() => store.validateBackpackItem(missing), /Backpack block text/);
        const valid = item(1, { code: "", dependencies: { core: "*", ext: "github:owner/repo/sub#v1.2.3", shared: "pub:_safe-id" } });
        valid.previewUri = "data:image/png;base64,iVBORw0KGgo=";
        assert.deepStrictEqual(clone(store.validateBackpackItem(valid)), valid);
        assert.equal(store.validateBackpackItem(item(1, { code: "x".repeat(100000) })).code.length, 100000);
        for (const blockText of ["", "  Exact\n displayed labels  ", "x".repeat(store.MAX_BACKPACK_CODE_LENGTH)]) {
            assert.strictEqual(store.validateBackpackItem(item(1, { blockText })).blockText, blockText);
        }
    });

    it("accepts optional projectBlocks, bounded plain/null-prototype maps, and detached metadata", () => {
        const { store } = environment();
        for (const entry of [item(1), item(1, { projectBlocks: undefined })]) {
            assert.equal(Object.prototype.hasOwnProperty.call(store.validateBackpackItem(entry), "projectBlocks"), false);
        }
        const bounded = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`block_${i}`, "custom.ts"]));
        bounded["x".repeat(256)] = "y".repeat(256);
        delete bounded.block_0;
        for (const projectBlocks of [{}, Object.create(null), bounded]) {
            const validated = store.validateBackpackItem(item(1, { projectBlocks }));
            assert.deepStrictEqual(clone(validated.projectBlocks), clone(projectBlocks));
            assert.notStrictEqual(validated.projectBlocks, projectBlocks);
        }
        const projectBlocks = { custom_block: "custom.ts" };
        const validated = store.validateBackpackItem(item(1, { projectBlocks }));
        projectBlocks.custom_block = "changed.ts";
        assert.equal(validated.projectBlocks.custom_block, "custom.ts");
        validated.projectBlocks.other_block = "helpers.ts";
        assert.deepStrictEqual(projectBlocks, { custom_block: "changed.ts" });
    });

    it("rejects malformed projectBlocks maps, unsafe types, invalid filenames, and excess entries", () => {
        const { store } = environment();
        const invalid = [null, [], "custom.ts", 1, true, new Date(), Object.create({ inherited: "custom.ts" }),
            Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`block_${i}`, "custom.ts"]))];
        for (const type of ["__proto__", "constructor", "prototype", "", "x".repeat(257), "bad\nblock", "bad\x00block", "bad\x7fblock"]) {
            invalid.push({ [type]: "custom.ts" });
        }
        for (const file of [undefined, null, 42, false, [], {}, "", "x".repeat(257), "bad\nfile.ts", "bad\x00file.ts", "bad\x7ffile.ts"]) {
            invalid.push({ custom_block: file });
        }
        invalid.forEach((projectBlocks, index) => {
            assert.throws(() => store.validateBackpackItem(item(1, { projectBlocks })), /Invalid project-defined blocks/, `case ${index}`);
        });
    });

    it("round-trips projectBlocks across devices, detaches saves/snapshots/imports, and can remove metadata", async () => {
        const first = environment();
        const second = environment(first.remote);
        const entry = item(1, { projectBlocks: { custom_block: "custom.ts", helper_block: "helpers.ts" } });
        const expected = clone(entry);
        const saving = first.store.saveBackpackItemAsync(entry);
        entry.projectBlocks.custom_block = "changed after invocation.ts";
        await saving;
        assert.deepStrictEqual(first.requests.find(request => request.method === "PATCH").data[2].value, expected);
        assert.deepStrictEqual(first.remote.get("alice").backpack.arcade[id(1)], expected);
        await second.store.refreshBackpackAsync();
        const snapshot = second.store.getBackpackItems()[0];
        assert.deepStrictEqual(clone(snapshot), expected);
        snapshot.projectBlocks.custom_block = "changed snapshot.ts";
        assert.deepStrictEqual(clone(second.store.getBackpackItems()), [expected]);
        const cleanup = second.store.setBackpackEditor({ headerId: () => "header", canImport: () => true,
            importAsync: async imported => {
                assert.deepStrictEqual(clone(imported), expected);
                imported.projectBlocks.custom_block = "changed by editor.ts";
                return true;
            } });
        try {
            assert.equal(await second.store.importBackpackItemAsync(expected, "header"), true);
            assert.equal(expected.projectBlocks.custom_block, "custom.ts");
            assert.deepStrictEqual(clone(second.store.getBackpackItems()), [expected]);
        } finally { cleanup(); }
        await second.store.saveBackpackItemAsync(item(1));
        await first.store.refreshBackpackAsync();
        assert.deepStrictEqual(clone(first.store.getBackpackItems()), [item(1)]);
        assert.deepStrictEqual(first.remote.get("alice").backpack.arcade[id(1)], item(1));
    });

    it("rejects invalid projectBlocks before writes/imports and permits corrupted cloud metadata recovery", async () => {
        const env = environment();
        const invalid = item(1, { projectBlocks: { custom_block: 7 } });
        let imports = 0;
        const cleanup = env.store.setBackpackEditor({ headerId: () => "header", canImport: () => true,
            importAsync: async () => { imports++; return true; } });
        try {
            await assert.rejects(env.store.saveBackpackItemAsync(invalid), /project-defined blocks/);
            await assert.rejects(env.store.importBackpackItemAsync(invalid, "header"), /project-defined blocks/);
            assert.equal(imports, 0);
            assert.equal(env.requests.length, 0);
            env.remote.set("alice", { backpack: { arcade: { [id(1)]: invalid } } });
            await env.store.refreshBackpackAsync();
            assert.deepStrictEqual(clone(env.store.getBackpackItems()), []);
            assertRecovery(recoveryEntry(env.store, id(1), "cloud"), id(1), "cloud", "Snippet 1", 1);
            await env.store.deleteBackpackItemAsync(id(1));
            assert.equal(env.store.getBackpackItems().length, 0);
        } finally { cleanup(); }
    });

    it("rejects acknowledgements that change or omit projectBlocks without publishing success", async () => {
        for (const projectBlocks of [undefined, {}, { custom_block: "other.ts" }, { different_block: "custom.ts" }]) {
            const env = environment();
            let notifications = 0;
            const off = env.store.subscribeBackpack(() => { notifications++; });
            env.hook(({ method, run }) => {
                const result = run();
                if (method === "PATCH") result.resp.backpack.arcade[id(1)].projectBlocks = projectBlocks;
                return result;
            });
            await assert.rejects(env.store.saveBackpackItemAsync(item(1, { projectBlocks: { custom_block: "custom.ts" } })), /another device/);
            assert.equal(env.store.getBackpackItems().length, 0);
            assert.equal(notifications, 0);
            off();
        }
    });

    it("enforces item and total JSON quotas from fresh cloud data, but permits recovery deletes", async () => {
        const env = environment();
        const full = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [id(i), item(i)]));
        env.remote.set("alice", { backpack: { arcade: full } });
        await assert.rejects(env.store.saveBackpackItemAsync(item(51)), /50/);
        await env.store.saveBackpackItemAsync(item(1, { name: "updated at capacity" }));
        await env.store.deleteBackpackItemAsync(id(2));
        await env.store.saveBackpackItemAsync(item(51));
        const huge = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [id(i), item(i, { code: "x".repeat(100000) })]));
        env.remote.set("alice", { backpack: { arcade: { [id(9)]: item(9) }, microbit: huge } });
        await assert.rejects(env.store.saveBackpackItemAsync(item(1)), /500000/);
        await env.store.deleteBackpackItemAsync(id(9));
        assert.deepStrictEqual(env.remote.get("alice").backpack.microbit, huge);
    });

    it("sanitizes thrown transport errors and continues the queue", async () => {
        const env = environment();
        env.hook(() => { throw new Error(`sensitive request contents ${item(1).blockText}`); });
        await assert.rejects(env.store.saveBackpackItemAsync(item(1)), error =>
            !/sensitive|PRIVATE_BLOCK_TEXT/.test(error.message) && /sync/.test(error.message));
        env.hook(undefined); await env.store.saveBackpackItemAsync(item(1));
        assert.equal(env.store.getBackpackItems().length, 1);
    });

    it("accepts reordered acknowledgement fields without treating them as a conflict", async () => {
        const env = environment();
        env.hook(({ method, run }) => {
            const result = run();
            if (method === "PATCH") {
                const entry = result.resp.backpack.arcade[id(1)];
                entry.dependencies = Object.fromEntries(Object.entries(entry.dependencies).reverse());
                result.resp.backpack.arcade[id(1)] = Object.fromEntries(Object.entries(entry).reverse());
            }
            return result;
        });
        await env.store.saveBackpackItemAsync(item(1, { dependencies: { core: "*", ext: "pub:_safe" } }));
        assert.equal(env.store.getBackpackItems().length, 1);
    });

    it("rejects target switches during network awaits and account switches during token capture", async () => {
        const env = environment();
        env.hook(({ run }) => { env.pxt.appTarget.id = "microbit"; return run(); });
        await assert.rejects(env.store.saveBackpackItemAsync(item(1)), /editor changed/);
        assert.equal(env.requests.length, 1);
        env.hook(undefined);
        env.pxt.auth.getAuthTokenAsync = async () => { env.signIn("bob"); return "bob-session"; };
        await assert.rejects(env.store.saveBackpackItemAsync(item(2)), /account/);
        assert.equal(env.requests.length, 1);
        assert.equal(env.store.getBackpackItems().length, 0);
    });

    it("validates unsafe cloud dependencies before exposure or import", async () => {
        const env = environment();
        const unsafe = item(1, { dependencies: { core: "workspace:private-project" } });
        env.remote.set("alice", { backpack: { arcade: { [id(1)]: unsafe } } });
        await env.store.refreshBackpackAsync();
        assert.deepStrictEqual(clone(env.store.getBackpackItems()), []);
        assertRecovery(recoveryEntry(env.store, id(1), "cloud"), id(1), "cloud", "Snippet 1", 1);
        let imported = false;
        env.store.setBackpackEditor({ headerId: () => "header", canImport: () => true,
            importAsync: async () => { imported = true; } });
        await assert.rejects(env.store.importBackpackItemAsync(unsafe, "header"), /dependencies/);
        assert.equal(imported, false);
        await env.store.deleteBackpackItemAsync(id(1));
        assert.equal(env.store.getBackpackItems().length, 0);
    });

    it("routes open requests, editor capability changes, and validated imports with safe cleanup", async () => {
        const env = environment(); const { store } = env;
        const opened = [], imported = [];
        let notifications = 0, enabled = true;
        const off = store.subscribeBackpack(() => { notifications++; });
        const stopOpen = store.subscribeBackpackOpen(request => opened.push(clone(request)));
        store.requestBackpackOpen("header", true); stopOpen(); store.requestBackpackOpen("ignored", false);
        assert.deepStrictEqual(opened, [{ headerId: "header", focus: true }]);
        const editor = { headerId: () => "header", canImport: () => enabled, importAsync: async entry => { imported.push(clone(entry)); entry.code = "edited"; } };
        const oldCleanup = store.setBackpackEditor(editor);
        const cleanup = store.setBackpackEditor(editor); oldCleanup();
        assert.equal(store.canImportBackpack("header"), true);
        assert.equal(store.canImportBackpack("other"), false);
        const entry = item(1); await store.importBackpackItemAsync(entry, "header");
        assert.equal(entry.code, "PRIVATE_CODE"); assert.deepStrictEqual(imported, [item(1)]);
        enabled = false; store.notifyBackpackEditorChanged();
        await assert.rejects(store.importBackpackItemAsync(item(1), "header"), /compatible/);
        cleanup(); assert.equal(store.canImportBackpack("header"), false);
        assert.equal(notifications, 4); off();
        assert.equal(env.requests.length, 0);
    });

    it("rechecks editor registration after async auth and isolates observer errors", async () => {
        const env = environment(); let imports = 0;
        const editor = { headerId: () => "header", canImport: () => true, importAsync: async () => { imports++; } };
        env.store.setBackpackEditor(editor);
        const pending = env.store.importBackpackItemAsync(item(1), "header");
        env.store.setBackpackEditor(editor);
        await assert.rejects(pending, /compatible/); assert.equal(imports, 0);
        env.store.subscribeBackpack(() => { throw new Error("observer failure"); });
        await env.store.saveBackpackItemAsync(item(1));
        assert.equal(env.store.getBackpackItems().length, 1);
    });
});