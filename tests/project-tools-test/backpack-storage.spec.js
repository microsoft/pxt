"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { launchTestBrowser } = require("./browser");
const root = path.resolve(__dirname, "../..");
const source = fs.readFileSync(path.join(root, "webapp/src/backpack.ts"), "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true
});
assert.deepStrictEqual(compiled.diagnostics, []);

// The production adapter uses Chromium transactions on an intercepted test origin;
// only the transport is mocked. Backend tests cover the actual HTTP handlers.
describe("dedicated Backpack API and durable IndexedDB (current source)", function () {
    this.timeout(30000);
    let browser, page, errors;
    before(async () => { browser = await launchTestBrowser(); });
    after(async () => { await browser?.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.setRequestInterception(true);
        page.on("request", request => request.respond({ status: 200, contentType: "text/html", body: "<html></html>" }));
        await page.goto("https://backpack.test/");
        await page.evaluate(async () => {
            await new Promise((resolve, reject) => {
                const request = indexedDB.deleteDatabase("pxt-backpack");
                request.onsuccess = resolve; request.onerror = reject;
            });
            window.lf = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, n) => args[n]);
            const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
            const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
            const item = (n, overrides = {}) => ({ id: id(n), name: `Snippet ${n}`, createdAt: n,
                code: JSON.stringify({ blocks: [{ type: "pxt-on-start" }] }), blockText: `captured labels ${n}`,
                dependencies: { core: "*" }, ...overrides });
            const summary = value => ({ id: value.id, name: value.name, createdAt: value.createdAt,
                updatedAt: 10, version: '"v1"', status: "ready", hasPreview: !!value.previewUri,
                ...(value.previewPixelDensity ? { previewPixelDensity: value.previewPixelDensity } : {}),
                blockText: value.blockText, blockTypes: ["pxt-on-start"], dependencies: value.dependencies,
                ...(value.projectBlocks ? { projectBlocks: value.projectBlocks } : {}) });
            const test = window.bt = { id, item, summary, clone, user: "alice", token: "alice-token", requests: [],
                remote: {}, originals: {}, imports: [], logouts: 0, pageSize: 20, localDev: false,
                limits: { maxItems: 50, maxCodeBytes: 524288, maxMetadataBytes: 65536, maxPreviewBytes: 131072,
                    maxRequestBytes: 1048576, maxTotalBytes: 52428800, maxPageBytes: 1048576 },
                signIn(user, token = user ? user + "-token" : undefined) {
                    test.user = user; test.token = token;
                    pxt.auth.cachedHasAuthToken = !!token;
                    pxt.auth.cachedUserState = { profile: user ? { id: user } : undefined };
                },
                fail(code, statusCode = 409) { return { statusCode, json: { error: { code, raw: "PRIVATE_DETAILS" } } }; },
                seed(n, overrides) {
                    const value = item(n, overrides); test.remote[value.id] = summary(value); test.originals[value.id] = value;
                },
                hold() { test.entered = new Promise(resolve => { test.enter = resolve; });
                    test.gate = new Promise(resolve => { test.release = resolve; }); },
                async readLocal(user) {
                    return store.createBackpackLocalStorage(indexedDB).listAsync(store.backpackLocalNamespace(pxt.appTarget.id, user));
                },
                async putLocal(key, payload, user, extra = {}) {
                    const namespace = store.backpackLocalNamespace(pxt.appTarget.id, user);
                    const adapter = store.createBackpackLocalStorage(indexedDB);
                    const current = (await adapter.listAsync(namespace)).find(record => record.key === key);
                    return adapter.changeAsync(namespace, key, current, { namespace, key, payload, ...extra });
                },
                async outcome(action) {
                    try { await action(); return "OK"; } catch (error) { return error.message; }
                }
            };
            const forbidden = () => { throw new Error("Unexpected private storage/API/logging"); };
            const client = { apiAsync: forbidden };
            window.pxt = {
                appTarget: { id: "arcade", bundledpkgs: { core: {} } },
                github: { parseRepoId: version => ({ owner: version.split(":")[1].split("/")[0], project: version.split("/")[1] }) },
                BrowserUtils: { isLocalHostDev: () => test.localDev }, cloud: { DEV_BACKEND: "https://backend.test" },
                storage: { shared: { getAsync: forbidden, setAsync: forbidden } },
                log: forbidden, debug: forbidden, tickEvent: forbidden, reportException: forbidden,
                auth: { client: () => client, cachedHasAuthToken: true, cachedUserState: { profile: { id: "alice" } },
                    getAuthTokenAsync: async () => test.token,
                    getUserStateAsync: async () => ({ profile: test.user ? { id: test.user } : undefined }),
                    getAuthHeadersAsync: async token => ({ authorization: `mkcd ${token}`, "x-pxt-target": pxt.appTarget.id }),
                    AuthClient: { staticLogoutAsync: async () => { ++test.logouts; test.signIn(undefined); } } },
                Util: { async requestAsync(options) {
                    test.requests.push(clone(options));
                    const run = () => {
                        const url = new URL(options.url, "https://backpack.test");
                        if (!url.pathname.startsWith("/api/user/backpack")) throw new Error("Normal storage accessed preferences");
                        const key = url.pathname.split("/")[4];
                        if (url.pathname.endsWith("/content")) return test.remote[key]
                            ? { statusCode: 200, json: { id: key, code: test.originals[key].code, version: test.remote[key].version } }
                            : test.fail("backpack_not_found", 404);
                        if (options.method === "GET") {
                            const entries = Object.values(test.remote);
                            const start = Number(url.searchParams.get("cursor") || 0);
                            return { statusCode: 200, json: { entries: clone(entries.slice(start, start + test.pageSize)),
                                ...(start + test.pageSize < entries.length ? { cursor: String(start + test.pageSize) } : {}),
                                usage: { count: entries.length, bytes: 100 }, limits: test.limits } };
                        }
                        if (options.method === "PUT") {
                            if (test.originals[key] && JSON.stringify(test.originals[key]) !== JSON.stringify(options.data))
                                return test.fail("backpack_id_conflict");
                            if (!test.remote[key]) { test.originals[key] = clone(options.data); test.remote[key] = summary(options.data); }
                            return { statusCode: 200, json: { entry: clone(test.remote[key]) } };
                        }
                        if (!test.remote[key]) return options.method === "DELETE"
                            ? { statusCode: 200, json: { id: key, deleted: true } } : test.fail("backpack_not_found", 404);
                        if (options.headers["If-Match"] !== test.remote[key].version) return test.fail("backpack_version_conflict", 412);
                        if (options.method === "PATCH") {
                            test.remote[key].name = options.data.name;
                            test.remote[key].version = '"v2"';
                            return { statusCode: 200, json: { entry: clone(test.remote[key]) } };
                        }
                        delete test.remote[key];
                        return { statusCode: 200, json: { id: key, deleted: true } };
                    };
                    return test.hook ? test.hook(options, run) : run();
                } }
            };
            Object.defineProperty(window, "localStorage", { configurable: true, get: forbidden });
        });
        await page.addScriptTag({ content: `(function(exports) { ${compiled.outputText}\n})(window.store = {});` });
        await page.evaluate(() => store.setBackpackEditor({ headerId: () => "project", canImport: () => true,
            importAsync: async value => { bt.imports.push(value); return true; } }));
    });
    afterEach(async () => {
        try { assert.deepStrictEqual(errors, []); } finally { await page?.close(); }
    });

    it("pages metadata completely without fetching bodies; Add alone loads content", async () => {
        const result = await page.evaluate(async () => {
            for (let n = 1; n <= 45; n++) bt.seed(n);
            await store.refreshBackpackAsync();
            const state = store.getBackpackState();
            const before = bt.clone(bt.requests);
            await store.importBackpackEntryAsync(state.entries[0], "project");
            return { count: state.entries.length, complete: state.complete, bodies: state.entries.some(entry => !!entry.item),
                before, after: bt.requests.at(-1), imported: bt.imports.length };
        });
        assert.equal(result.count, 45); assert.equal(result.complete, true); assert.equal(result.bodies, false);
        assert.equal(result.before.length, 3);
        assert.ok(result.before.every(request => request.method === "GET" && request.allowHttpErrors && request.withCredentials
            && request.headers.authorization === "mkcd alice-token" && request.headers["x-pxt-target"] === "arcade"));
        assert.match(result.after.url, /\/content$/); assert.equal(result.imported, 1);
    });

    it("saves above the old 64 KiB preferences limit, changes summaries in place, and uses If-Match", async () => {
        const result = await page.evaluate(async () => {
            await store.refreshBackpackAsync(); bt.requests = []; bt.localDev = true;
            const value = bt.item(1, { code: JSON.stringify({ blocks: [{ type: "text", fields: { TEXT: "a".repeat(90000) } }] }) });
            await store.saveBackpackItemAsync(value);
            await store.renameBackpackItemAsync(value.id, "  Renamed  ");
            const renamed = store.getBackpackState().entries[0];
            await store.deleteBackpackEntryAsync(renamed);
            return { methods: bt.requests.map(request => request.method), requests: bt.requests,
                local: await bt.readLocal("alice"), entries: store.getBackpackState().entries };
        });
        assert.deepStrictEqual(result.methods, ["PUT", "PATCH", "DELETE"]);
        assert.deepStrictEqual(result.requests[1].data, { name: "Renamed" });
        assert.equal(result.requests[1].headers["If-Match"], '"v1"');
        assert.equal(result.requests[2].headers["If-Match"], '"v2"');
        assert.ok(result.requests.every(request => request.url.startsWith("https://backend.test/api/user/backpack/")));
        assert.deepStrictEqual(result.local, []); assert.deepStrictEqual(result.entries, []);
    });

    it("retains a named account-only pending save after a lost ACK and retries the same UUID after a remote rename", async () => {
        const result = await page.evaluate(async () => {
            bt.hook = (options, run) => { const result = run(); if (options.method === "PUT") throw new Error("PRIVATE_PAYLOAD token"); return result; };
            const failure = await bt.outcome(() => store.saveBackpackItemAsync(bt.item(1)));
            const pending = store.getBackpackState().entries[0];
            const retained = await bt.readLocal("alice");
            bt.signIn(undefined); const guest = store.getBackpackState().entries;
            bt.signIn("bob"); await store.refreshBackpackAsync();
            const bobLocal = store.getBackpackState().entries.filter(entry => entry.source === "local");
            bt.signIn("alice"); bt.hook = undefined;
            bt.remote[bt.id(1)].name = "Remote rename"; bt.remote[bt.id(1)].version = '"v2"';
            await store.refreshBackpackAsync();
            return { failure, pending, retained, guest, bobLocal, final: store.getBackpackState().entries, local: await bt.readLocal("alice") };
        });
        assert.doesNotMatch(result.failure, /PRIVATE|token/); assert.equal(result.pending.name, "Snippet 1");
        assert.equal(result.pending.source, "local"); assert.equal(result.retained.length, 1);
        assert.deepStrictEqual(result.guest, []); assert.deepStrictEqual(result.bobLocal, []);
        assert.equal(result.final.length, 1); assert.equal(result.final[0].name, "Remote rename"); assert.deepStrictEqual(result.local, []);
    });

    it("promotes guests independently, preserves invalid/conflicting records and hides claimed uploads from other identities", async () => {
        const result = await page.evaluate(async () => {
            bt.signIn(undefined);
            await store.saveBackpackItemAsync(bt.item(1)); await store.saveBackpackItemAsync(bt.item(2));
            await bt.putLocal("../literal-key", JSON.stringify({ name: "Damaged", code: "PRIVATE", previewUri: "javascript:bad" }));
            bt.signIn("alice"); bt.seed(1, { name: "Different" });
            await store.refreshBackpackAsync();
            const entries = store.getBackpackState().entries;
            const records = await bt.readLocal();
            bt.signIn(undefined); await store.refreshBackpackAsync();
            return { entries, records, guest: store.getBackpackState().entries, uploaded: Object.keys(bt.remote) };
        });
        assert.equal(result.uploaded.length, 2);
        assert.ok(result.entries.some(entry => entry.name === "Snippet 1" && entry.pendingError));
        assert.ok(result.entries.some(entry => entry.name === "Damaged" && entry.error && !entry.item));
        assert.equal(result.records.length, 2);
        assert.deepStrictEqual(result.guest.map(entry => entry.name), ["Damaged"]);
    });

    it("uses atomic payload comparisons for cleanup and does not lose another tab's edit", async () => {
        const result = await page.evaluate(async () => {
            bt.hook = async (options, run) => {
                if (options.method === "PUT") {
                    const records = await bt.readLocal("alice");
                    const record = records[0];
                    const next = { ...record, payload: JSON.stringify(bt.item(1, { name: "Newer local edit" })) };
                    await store.createBackpackLocalStorage(indexedDB).changeAsync(record.namespace, record.key, record, next);
                }
                return run();
            };
            const result = await bt.outcome(() => store.saveBackpackItemAsync(bt.item(1)));
            return { result, records: await bt.readLocal("alice") };
        });
        assert.notEqual(result.result, "OK"); assert.equal(result.records.length, 1);
        assert.equal(JSON.parse(result.records[0].payload).name, "Newer local edit");
    });

    it("rejects stale rename/delete without fetching a fresh ETag or overwriting", async () => {
        const result = await page.evaluate(async () => {
            bt.seed(1); await store.refreshBackpackAsync();
            const entry = store.getBackpackState().entries[0]; bt.requests = [];
            bt.remote[entry.id].version = '"changed"'; bt.remote[entry.id].name = "Keep this";
            return { rename: await bt.outcome(() => store.renameBackpackItemAsync(entry.id, "Wrong", entry)),
                remove: await bt.outcome(() => store.deleteBackpackEntryAsync(entry)), methods: bt.requests.map(request => request.method),
                remote: bt.remote[entry.id], visible: store.getBackpackState().entries.length };
        });
        assert.match(result.rename, /another device/); assert.match(result.remove, /another device/);
        assert.deepStrictEqual(result.methods, ["PATCH", "DELETE"]); assert.equal(result.remote.name, "Keep this"); assert.equal(result.visible, 1);
    });

    it("keeps a missing-content recovery card deletable using its observed summary version", async () => {
        const result = await page.evaluate(async () => {
            bt.seed(1); await store.refreshBackpackAsync();
            bt.hook = (options, run) => options.url.endsWith("/content") ? bt.fail("backpack_not_found", 404) : run();
            const failure = await bt.outcome(() => store.importBackpackEntryAsync(store.getBackpackState().entries[0], "project"));
            const invalid = store.getBackpackState().entries[0];
            bt.hook = undefined;
            await store.deleteBackpackEntryAsync(invalid);
            return { failure, invalid, remaining: store.getBackpackState().entries, imports: bt.imports };
        });
        assert.ok(result.invalid.error);
        assert.deepStrictEqual(result.remaining, []); assert.deepStrictEqual(result.imports, []);
    });

    it("deletes corrupt local entries by literal key without touching embedded-ID neighbors", async () => {
        const result = await page.evaluate(async () => {
            bt.signIn(undefined); await store.saveBackpackItemAsync(bt.item(2));
            for (const key of ["../bad", "__proto__", "constructor", ""]) await bt.putLocal(key, JSON.stringify(bt.item(2)));
            await store.refreshBackpackAsync();
            for (const entry of store.getBackpackState().entries.filter(entry => entry.error)) await store.deleteBackpackEntryAsync(entry);
            const adapter = store.createBackpackLocalStorage(indexedDB);
            return { records: await adapter.listAsync(store.backpackLocalNamespace("arcade")), requests: bt.requests };
        });
        assert.equal(result.records.length, 1); assert.match(result.records[0].key, /000002$/); assert.deepStrictEqual(result.requests, []);
    });

    for (const transition of ["account", "target", "token"]) it(`discards late responses and queued work after ${transition}`, async () => {
        const result = await page.evaluate(async transition => {
            bt.hold(); bt.hook = async (options, run) => { if (options.method === "PUT") { bt.enter(); await bt.gate; } return run(); };
            const first = bt.outcome(() => store.saveBackpackItemAsync(bt.item(1))); await bt.entered;
            const second = bt.outcome(() => store.saveBackpackItemAsync(bt.item(2)));
            if (transition === "account") bt.signIn("bob");
            if (transition === "target") pxt.appTarget.id = "microbit";
            if (transition === "token") bt.signIn("alice", "replacement");
            bt.release();
            return { results: await Promise.all([first, second]), requests: bt.requests, entries: store.getBackpackState().entries };
        }, transition);
        assert.ok(result.results.every(message => /account|session|editor/.test(message)));
        assert.equal(result.requests.length, 1);
        if (transition !== "token") assert.deepStrictEqual(result.entries, []);
    });

    it("does not claim complete search when a later page fails", async () => {
        const result = await page.evaluate(async () => {
            for (let n = 1; n <= 25; n++) bt.seed(n);
            bt.hook = (options, run) => options.url.includes("cursor=") ? bt.fail("backpack_unavailable", 503) : run();
            const failure = await bt.outcome(() => store.refreshBackpackAsync());
            return { failure, state: store.getBackpackState() };
        });
        assert.notEqual(result.failure, "OK"); assert.equal(result.state.complete, false); assert.equal(result.state.entries.length, 20);
        assert.equal(result.state.warning, result.failure);
    });

    it("rejects unavailable IndexedDB before upload without fallback", async () => {
        const result = await page.evaluate(async () => {
            Object.defineProperty(window, "indexedDB", { configurable: true, get: () => { throw new Error("PRIVATE_QUOTA"); } });
            return { failure: await bt.outcome(() => store.saveBackpackItemAsync(bt.item(1))), requests: bt.requests };
        });
        assert.match(result.failure, /browser storage/); assert.doesNotMatch(result.failure, /PRIVATE/); assert.deepStrictEqual(result.requests, []);
    });

    it("rejects transaction aborts even after put succeeds, and persists successful commits across adapter instances", async () => {
        const result = await page.evaluate(async () => {
            const adapter = store.createBackpackLocalStorage(indexedDB);
            const namespace = store.backpackLocalNamespace("arcade");
            const record = { namespace, key: bt.id(1), payload: JSON.stringify(bt.item(1)) };
            const put = IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put = function (...args) {
                const request = put.apply(this, args);
                request.addEventListener("success", () => this.transaction.abort());
                return request;
            };
            const aborted = await bt.outcome(() => adapter.changeAsync(namespace, record.key, undefined, record));
            IDBObjectStore.prototype.put = put;
            const afterAbort = await adapter.listAsync(namespace);
            const committed = await adapter.changeAsync(namespace, record.key, undefined, record);
            const reopened = await store.createBackpackLocalStorage(indexedDB).listAsync(namespace);
            const stale = await adapter.changeAsync(namespace, record.key, undefined, undefined);
            return { aborted, afterAbort, committed, reopened, stale };
        });
        assert.match(result.aborted, /browser storage/); assert.deepStrictEqual(result.afterAbort, []);
        assert.equal(result.committed, true); assert.equal(result.reopened.length, 1); assert.equal(result.stale, false);
    });

    it("preserves original pending payloads after 24 hours and rejects oversized UTF-8 metadata before writes", async () => {
        const result = await page.evaluate(async () => {
            const namespace = store.backpackLocalNamespace("arcade", "alice");
            await bt.putLocal(bt.id(1), JSON.stringify(bt.item(1)), "alice", { owner: "alice", firstAttemptAt: Date.now() - 86400001 });
            await store.refreshBackpackAsync();
            const pending = store.getBackpackState().entries[0];
            const oversized = await bt.outcome(() => store.saveBackpackItemAsync(bt.item(2, { blockText: "é".repeat(32769) })));
            return { pending, oversized, methods: bt.requests.map(request => request.method),
                records: await store.createBackpackLocalStorage(indexedDB).listAsync(namespace) };
        });
        assert.match(result.pending.pendingError, /more than a day/); assert.match(result.oversized, /too large/);
        assert.deepStrictEqual(result.methods, ["GET"]); assert.equal(result.records.length, 1);
    });

    it("does not reactivate an abandoned operation when the same account is selected again", async () => {
        const result = await page.evaluate(async () => {
            bt.hold(); bt.hook = async (options, run) => { bt.enter(); await bt.gate; return run(); };
            const saving = bt.outcome(() => store.saveBackpackItemAsync(bt.item(1))); await bt.entered;
            bt.signIn("bob"); store.notifyBackpackEditorChanged();
            bt.signIn("alice"); store.notifyBackpackEditorChanged();
            bt.release();
            return { failure: await saving, entries: store.getBackpackState().entries, records: await bt.readLocal("alice") };
        });
        assert.match(result.failure, /account|editor/); assert.deepStrictEqual(result.entries, []); assert.equal(result.records.length, 1);
    });

    it("handles safe errors and empty 403/503 responses, accepts 204 deletion and guards 401 logout", async () => {
        const result = await page.evaluate(async () => {
            bt.seed(1); await store.refreshBackpackAsync();
            const entry = store.getBackpackState().entries[0];
            bt.hook = () => bt.fail("PRIVATE_UNRECOGNIZED", 500);
            const failure = await bt.outcome(() => store.deleteBackpackEntryAsync(entry));
            bt.hook = () => ({ statusCode: 204 }); await store.deleteBackpackEntryAsync(entry);
            bt.hook = () => ({ statusCode: 403 });
            const denied = await bt.outcome(() => store.refreshBackpackAsync());
            const deniedState = store.getBackpackState();
            bt.hook = () => ({ statusCode: 503 });
            const unavailable = await bt.outcome(() => store.saveBackpackItemAsync(bt.item(2)));
            const retained = await bt.readLocal("alice");
            bt.hook = () => ({ statusCode: 401, json: { secret: "PRIVATE" } });
            const unauthorized = await bt.outcome(() => store.refreshBackpackAsync());
            return { failure, denied, deniedState, unavailable, retained, unauthorized, logouts: bt.logouts };
        });
        assert.doesNotMatch(result.failure, /PRIVATE/); assert.equal(result.logouts, 1); assert.match(result.unauthorized, /Sign in/);
        assert.match(result.denied, /access was denied/);
        assert.equal(result.deniedState.warning, result.denied); assert.equal(result.deniedState.complete, false);
        assert.match(result.unavailable, /temporarily unavailable.*remain in this browser/);
        assert.equal(result.retained.length, 1);
    });

    it("fetches binary previews privately and rejects late/oversized responses", async () => {
        const result = await page.evaluate(async () => {
            bt.seed(1, { previewUri: "data:image/png;base64,iVBORw0KGgo=", previewPixelDensity: 2 });
            await store.refreshBackpackAsync(); const entry = store.getBackpackState().entries[0];
            const requests = [];
            window.fetch = async (url, options) => {
                requests.push({ url, credentials: options.credentials, headers: options.headers, signal: !!options.signal });
                return new Response(new Blob(["png"], { type: "image/png" }), { status: 200, headers: { "content-type": "image/png" } });
            };
            const blob = await store.getBackpackPreviewAsync(entry, new AbortController().signal);
            window.fetch = async () => new Response(new Blob([new Uint8Array(131073)]), { headers: { "content-type": "image/png" } });
            const oversized = await bt.outcome(() => store.getBackpackPreviewAsync(entry, new AbortController().signal));
            return { size: blob.size, requests, oversized };
        });
        assert.equal(result.size, 3); assert.equal(result.requests[0].credentials, "include"); assert.equal(result.requests[0].signal, true);
        assert.equal(result.requests[0].headers.authorization, "mkcd alice-token"); assert.match(result.oversized, /unavailable/);
    });

    it("validates UTF-8, dependencies, project metadata, PNG density and bounded recovery names without side effects", async () => {
        const result = await page.evaluate(() => {
            const invalid = [bt.item(1, { blockText: undefined }), bt.item(1, { blockText: "é".repeat(100001) }),
                bt.item(1, { code: "é".repeat(262145) }), bt.item(1, { name: "bad\nname" }),
                bt.item(1, { dependencies: { ext: "file:private" } }), bt.item(1, { projectBlocks: { type: "bad\nfile" } }),
                bt.item(1, { previewUri: "javascript:bad" }), bt.item(1, { previewPixelDensity: 2 }),
                bt.item(1, { previewUri: "data:image/png;base64,iVBORw0KGgo=", previewPixelDensity: 3 })];
            const rejected = invalid.every(value => { try { store.validateBackpackItem(value); return false; } catch { return true; } });
            const densities = [1, 1.5, 2].map(previewPixelDensity => store.validateBackpackItem(bt.item(1, {
                previewUri: "data:image/png;base64,iVBORw0KGgo=", previewPixelDensity })).previewPixelDensity);
            const recovery = store.readBackpackEntry("bad", { name: "x".repeat(101), code: "PRIVATE", previewUri: "javascript:bad" }, "local");
            const summary = store.readBackpackSummary({ ...bt.summary(bt.item(2)), code: "PRIVATE", previewUri: "javascript:bad" });
            return { rejected, densities, recovery, summary, requests: bt.requests };
        });
        assert.equal(result.rejected, true); assert.deepStrictEqual(result.densities, [1, 1.5, 2]);
        assert.equal(result.recovery.name.length, 100); assert.equal(result.recovery.item, undefined);
        assert.equal(result.summary.item, undefined); assert.doesNotMatch(JSON.stringify(result.summary), /PRIVATE|javascript/);
        assert.deepStrictEqual(result.requests, []);
    });

});