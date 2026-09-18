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
                kind: "code", versions: { target: "1.0.0", pxt: "13.2.4" },
                code: JSON.stringify({ blocks: [{ type: "pxt-on-start" }] }), blockText: `captured labels ${n}`,
                dependencies: { core: "*" }, ...overrides });
            const asset = (n, overrides = {}) => item(n, { kind: "asset",
                code: JSON.stringify({ blocks: [{ type: "extension_portrait", fields: { IMAGE: { data: "pixels" } } }] }), ...overrides });
            const summary = value => ({ id: value.id, name: value.name, createdAt: value.createdAt,
                kind: value.kind, versions: clone(value.versions),
                updatedAt: 10, version: '"v1"', status: "ready", hasPreview: false,
                blockText: value.blockText, blockTypes: JSON.parse(value.code).blocks.map(block => block.type), dependencies: value.dependencies });
            const test = window.bt = { id, item, asset, clone, user: "alice", token: "alice-token", requests: [],
                remote: {}, originals: {}, imports: [], positions: [], pageSize: 20, localDev: false,
                limits: { maxItems: 50, maxAssets: 200, maxAssetCodeBytes: 131072, maxCodeBytes: 524288, maxMetadataBytes: 65536, maxPreviewBytes: 131072,
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
                async outcome(action) {
                    try { await action(); return "OK"; } catch (error) { return error.message; }
                }
            };
            const forbidden = () => { throw new Error("Unexpected private storage/API/logging"); };
            const client = { apiAsync: forbidden };
            window.pxt = {
                appTarget: { id: "arcade", versions: { target: "1.0.0", pxt: "13.2.4" },
                    appTheme: { backpack: true, assetEditor: true }, bundledpkgs: { core: {} } },
                github: { parseRepoId: version => ({ owner: version.split(":")[1].split("/")[0], project: version.split("/")[1] }) },
                BrowserUtils: { isLocalHostDev: () => test.localDev }, cloud: { DEV_BACKEND: "https://backend.test" },
                storage: { shared: { getAsync: forbidden, setAsync: forbidden } },
                log: forbidden, debug: forbidden, tickEvent: forbidden, reportException: forbidden,
                auth: { client: () => client, cachedHasAuthToken: true, cachedUserState: { profile: { id: "alice" } },
                    hasIdentity: () => true,
                    getAuthTokenAsync: async () => test.token,
                    getUserStateAsync: async () => ({ profile: test.user ? { id: test.user } : undefined }),
                    getAuthHeadersAsync: async token => ({ authorization: `mkcd ${token}`, "x-pxt-target": pxt.appTarget.id }),
                    AuthClient: { staticLogoutAsync: forbidden } },
                Util: { jsonTryParse: text => { try { return JSON.parse(text); } catch { return undefined; } },
                    async requestAsync(options) {
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
                                usage: { count: entries.length, codeCount: entries.filter(entry => entry.kind === "code").length,
                                    assetCount: entries.filter(entry => entry.kind === "asset").length, bytes: 100 }, limits: test.limits } };
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
        await page.evaluate(() => {
            store.setBackpackEditor({ headerId: () => "project",
                canImport: () => true,
                importAsync: async (value, position) => { bt.imports.push(value); bt.positions.push(position); return true; } });
        });
    });
    afterEach(async () => {
        try { assert.deepStrictEqual(errors, []); } finally { await page?.close(); }
    });

    it("pages metadata completely without fetching bodies; explicit Add loads content", async () => {
        const result = await page.evaluate(async () => {
            for (let n = 1; n <= 45; n++) bt.seed(n);
            bt.seed(45, bt.asset(45, { versions: { target: "1.0.0-beta.2+capture", pxt: "13.2.4-beta.1+build.9" } }));
            await store.refreshBackpackAsync();
            const state = store.getBackpackState();
            const before = bt.clone(bt.requests);
            await store.importBackpackEntryAsync(state.entries[0], "project", { x: 240, y: 160 });
            return { count: state.entries.length, complete: state.complete, bodies: state.entries.some(entry => !!entry.item),
                before, after: bt.requests.at(-1), imported: bt.imports, positions: bt.positions,
                summary: state.entries[0].summary, usage: state.usage, limits: state.limits };
        });
        assert.equal(result.count, 45);
        assert.equal(result.complete, true);
        assert.equal(result.bodies, false);
        assert.equal(result.before.length, 3);
        assert.ok(result.before.every(request => request.method === "GET" && request.allowHttpErrors && request.withCredentials
            && request.headers.authorization === "mkcd alice-token" && request.headers["x-pxt-target"] === "arcade"));
        assert.match(result.after.url, /\/content$/);
        assert.equal(result.imported.length, 1);
        assert.equal(result.summary.kind, "asset");
        assert.equal(result.summary.hasPreview, false);
        assert.equal(result.imported[0].kind, "asset");
        assert.deepStrictEqual(result.summary.versions, { target: "1.0.0-beta.2+capture", pxt: "13.2.4-beta.1+build.9" });
        assert.deepStrictEqual(result.imported[0].versions, result.summary.versions);
        assert.deepStrictEqual(result.positions, [{ x: 240, y: 160 }]);
        assert.deepStrictEqual(result.usage, { count: 45, codeCount: 44, assetCount: 1, bytes: 100 });
        assert.equal(result.limits.maxAssets, 200);
        assert.equal(result.limits.maxAssetCodeBytes, 131072);
    });

    it("round-trips beta metadata through guest persistence, direct import, upload, and cloud content", async () => {
        const result = await page.evaluate(async () => {
            // Disabled identity must stay local even if a previous login is cached.
            pxt.auth.hasIdentity = () => false;
            const item = bt.item(1, { versions: { target: "1.0.0-beta.2+capture", pxt: "13.2.4-beta.1" } });
            await store.saveBackpackItemAsync(item);
            await store.refreshBackpackAsync();
            const local = store.getBackpackItems()[0];
            await store.importBackpackItemAsync(local, "project");
            if (bt.requests.length) throw new Error("Login-disabled Backpack must not access the cloud");
            pxt.auth.hasIdentity = () => true;
            bt.signIn("alice"); await store.refreshBackpackAsync();
            const entry = store.getBackpackState().entries[0];
            await store.importBackpackEntryAsync(entry, "project");
            return { item, local, summary: entry.summary, imports: bt.imports,
                uploaded: bt.requests.find(request => request.method === "PUT").data, records: await bt.readLocal() };
        });
        assert.deepStrictEqual(result.local, result.item);
        assert.deepStrictEqual(result.uploaded, result.item);
        assert.deepStrictEqual(result.imports, [result.item, result.item]);
        assert.deepStrictEqual(result.summary.versions, result.item.versions);
        assert.equal(result.summary.kind, "code");
        assert.deepStrictEqual(result.records, []);
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
        assert.deepStrictEqual(result.local, []);
        assert.deepStrictEqual(result.entries, []);
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
        assert.doesNotMatch(result.failure, /PRIVATE|token/);
        assert.equal(result.pending.name, "Snippet 1");
        assert.equal(result.pending.source, "local");
        assert.equal(result.retained.length, 1);
        assert.deepStrictEqual(result.guest, []);
        assert.deepStrictEqual(result.bobLocal, []);
        assert.equal(result.final.length, 1);
        assert.equal(result.final[0].name, "Remote rename");
        assert.deepStrictEqual(result.local, []);
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
        assert.notEqual(result.result, "OK");
        assert.equal(result.records.length, 1);
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
        assert.match(result.rename, /another device/);
        assert.match(result.remove, /another device/);
        assert.deepStrictEqual(result.methods, ["PATCH", "DELETE"]);
        assert.equal(result.remote.name, "Keep this");
        assert.equal(result.visible, 1);
    });

    it("discards late responses and queued saves after an account switch", async () => {
        const result = await page.evaluate(async () => {
            bt.hold(); bt.hook = async (options, run) => { if (options.method === "PUT") { bt.enter(); await bt.gate; } return run(); };
            const first = bt.outcome(() => store.saveBackpackItemAsync(bt.item(1))); await bt.entered;
            const second = bt.outcome(() => store.saveBackpackItemAsync(bt.item(2)));
            bt.signIn("bob");
            bt.release();
            return { results: await Promise.all([first, second]), requests: bt.requests, entries: store.getBackpackState().entries };
        });
        assert.ok(result.results.every(message => /account|session|editor/.test(message)));
        assert.equal(result.requests.length, 1);
        assert.deepStrictEqual(result.entries, []);
    });

    it("does not claim complete search when a later page fails", async () => {
        const result = await page.evaluate(async () => {
            for (let n = 1; n <= 25; n++) bt.seed(n);
            bt.hook = (options, run) => options.url.includes("cursor=") ? bt.fail("backpack_unavailable", 503) : run();
            const failure = await bt.outcome(() => store.refreshBackpackAsync());
            return { failure, state: store.getBackpackState() };
        });
        assert.notEqual(result.failure, "OK");
        assert.equal(result.state.complete, false);
        assert.equal(result.state.entries.length, 20);
        assert.equal(result.state.warning, result.failure);
    });

    it("rejects unavailable IndexedDB before upload without fallback", async () => {
        const result = await page.evaluate(async () => {
            Object.defineProperty(window, "indexedDB", { configurable: true, get: () => { throw new Error("PRIVATE_QUOTA"); } });
            return { failure: await bt.outcome(() => store.saveBackpackItemAsync(bt.item(1))), requests: bt.requests };
        });
        assert.match(result.failure, /browser storage/);
        assert.doesNotMatch(result.failure, /PRIVATE/);
        assert.deepStrictEqual(result.requests, []);
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
        assert.match(result.aborted, /browser storage/);
        assert.deepStrictEqual(result.afterAbort, []);
        assert.equal(result.committed, true);
        assert.equal(result.reopened.length, 1);
        assert.equal(result.stale, false);
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
        assert.match(result.failure, /account|editor/);
        assert.deepStrictEqual(result.entries, []);
        assert.equal(result.records.length, 1);
    });

    it("revalidates metadata in place and fetches only changed asset previews, leaving Add/Edit fresh", async () => {
        const result = await page.evaluate(async () => {
            bt.seed(1, bt.asset(1)); bt.seed(2, bt.asset(2));
            await store.refreshBackpackAsync();
            const find = n => store.getBackpackState().entries.find(entry => entry.id === bt.id(n));
            const previews = await Promise.all([store.loadBackpackAssetPreviewAsync(find(1)), store.loadBackpackAssetPreviewAsync(find(1)),
                store.loadBackpackAssetPreviewAsync(find(2))]);
            previews[0].name = "Changed by renderer";
            const detached = await store.loadBackpackAssetPreviewAsync(find(1));
            bt.hold(); bt.hook = async (options, run) => {
                const response = run();
                if (options.url.includes("?limit=")) { bt.enter(); await bt.gate; }
                return response;
            };
            const refresh = store.refreshBackpackAsync(); await bt.entered;
            const during = store.getBackpackState(); bt.release(); await refresh;
            bt.hook = undefined;
            await store.loadBackpackAssetPreviewAsync(find(1)); await store.loadBackpackAssetPreviewAsync(find(2));
            const beforeChange = bt.requests.filter(r => r.url.endsWith("/content")).length;
            bt.remote[bt.id(2)].version = '"v2"'; bt.originals[bt.id(2)].code = bt.asset(2).code.replace("pixels", "new pixels");
            await store.refreshBackpackAsync();
            await store.loadBackpackAssetPreviewAsync(find(1));
            const changed = await store.loadBackpackAssetPreviewAsync(find(2));
            const afterChange = bt.requests.filter(r => r.url.endsWith("/content")).length;
            await store.loadBackpackAssetAsync(find(1));
            await store.importBackpackEntryAsync(find(1), "project");
            const afterActions = bt.requests.filter(r => r.url.endsWith("/content")).length;
            const deleted = find(1); await store.deleteBackpackEntryAsync(deleted);
            const stale = await bt.outcome(() => store.loadBackpackAssetPreviewAsync(deleted));
            bt.signIn("bob"); store.notifyBackpackEditorChanged();
            bt.signIn("alice"); store.notifyBackpackEditorChanged();
            const switched = store.getBackpackState(); await store.refreshBackpackAsync();
            await store.loadBackpackAssetPreviewAsync(find(2));
            return { during, detached, changed, beforeChange, afterChange, afterActions, stale, switched,
                finalReads: bt.requests.filter(r => r.url.endsWith("/content")).length };
        });
        assert.equal(result.during.complete, true);
        assert.equal(result.during.entries.length, 2);
        assert.equal(result.detached.name, "Snippet 1");
        assert.match(result.changed.code, /new pixels/);
        assert.deepStrictEqual([result.beforeChange, result.afterChange, result.afterActions, result.finalReads], [2, 3, 5, 6]);
        assert.notEqual(result.stale, "OK");
        assert.deepStrictEqual(result.switched.entries, []);
    });
});