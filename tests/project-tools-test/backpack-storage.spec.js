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

// Execute the exact current allowlist instead of broadening it in the host stub.
const authSource = ts.createSourceFile("auth.ts", fs.readFileSync(path.join(root, "pxtlib/auth.ts"), "utf8"), ts.ScriptTarget.Latest, true);
let assetTypeFunction;
function findAssetTypeFunction(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "isBackpackAssetType") assetTypeFunction = node;
    ts.forEachChild(node, findAssetTypeFunction);
}
findAssetTypeFunction(authSource);
assert(assetTypeFunction, "Expected the current asset allowlist helper");
const assetTypeSource = ts.transpileModule(assetTypeFunction.getText(authSource), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText;

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
                code: JSON.stringify({ blocks: [{ type: "image_picker", fields: { IMAGE: { data: "pixels" } } }] }), ...overrides });
            const summary = value => ({ id: value.id, name: value.name, createdAt: value.createdAt,
                kind: value.kind, versions: clone(value.versions),
                updatedAt: 10, version: '"v1"', status: "ready", hasPreview: !!value.previewUri,
                ...(value.previewPixelDensity ? { previewPixelDensity: value.previewPixelDensity } : {}),
                blockText: value.blockText, blockTypes: JSON.parse(value.code).blocks.map(block => block.type), dependencies: value.dependencies,
                ...(value.projectBlocks ? { projectBlocks: value.projectBlocks } : {}) });
            const test = window.bt = { id, item, asset, summary, clone, user: "alice", token: "alice-token", requests: [],
                remote: {}, originals: {}, imports: [], positions: [], logouts: 0, pageSize: 20, localDev: false, identityEnabled: true,
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
                appTarget: { id: "arcade", versions: { target: "1.0.0", pxt: "13.2.4" },
                    appTheme: { backpack: true }, bundledpkgs: { core: {} } },
                github: { parseRepoId: version => ({ owner: version.split(":")[1].split("/")[0], project: version.split("/")[1] }) },
                BrowserUtils: { isLocalHostDev: () => test.localDev }, cloud: { DEV_BACKEND: "https://backend.test" },
                storage: { shared: { getAsync: forbidden, setAsync: forbidden } },
                log: forbidden, debug: forbidden, tickEvent: forbidden, reportException: forbidden,
                auth: { client: () => client, cachedHasAuthToken: true, cachedUserState: { profile: { id: "alice" } },
                    hasIdentity: () => test.identityEnabled,
                    getAuthTokenAsync: async () => test.token,
                    getUserStateAsync: async () => ({ profile: test.user ? { id: test.user } : undefined }),
                    getAuthHeadersAsync: async token => ({ authorization: `mkcd ${token}`, "x-pxt-target": pxt.appTarget.id }),
                    AuthClient: { staticLogoutAsync: async () => { ++test.logouts; test.signIn(undefined); } } },
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
                            if (options.data.code !== undefined) {
                                const edited = store.validateBackpackItem(options.data);
                                if (edited.kind !== "asset" || test.remote[key].kind !== "asset" || edited.id !== key)
                                    return test.fail("backpack_invalid_entry", 400);
                                test.originals[key] = { ...edited, createdAt: test.originals[key].createdAt };
                                test.remote[key] = summary(test.originals[key]);
                            }
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
        await page.addScriptTag({ content: `(function(exports) { ${assetTypeSource}\n})(pxt.auth);` });
        await page.addScriptTag({ content: `(function(exports) { ${compiled.outputText}\n})(window.store = {});` });
        await page.evaluate(() => {
            bt.headerId = "project"; bt.canImport = true; bt.canEdit = true; bt.contextLoads = 0;
            bt.assetContext = { blocksInfo: {}, gallery: {}, palette: ["#000000"] };
            bt.assetHost = { headerId: () => bt.headerId, canEdit: () => bt.canEdit,
                contextAsync: async () => { ++bt.contextLoads; return bt.assetContext; } };
            store.setBackpackAssetEditor(bt.assetHost);
            bt.unregisterEditor = store.setBackpackEditor({ headerId: () => bt.headerId, canImport: () => bt.canImport,
                canDrop: target => target === document.body,
                assetEditorContext: () => ({ blocksInfo: {}, gallery: {}, palette: [] }),
                importAsync: async (value, position) => { bt.imports.push(value); bt.positions.push(position); return true; } });
        });
    });
    afterEach(async () => {
        try { assert.deepStrictEqual(errors, []); } finally { await page?.close(); }
    });

    it("loads asset context from the project host without Blocks import eligibility", async () => {
        const result = await page.evaluate(async () => {
            bt.canImport = false;
            const canImport = store.canImportBackpack("project"), canEdit = store.canEditBackpackAsset("project");
            const context = await store.getBackpackAssetEditorContextAsync("project");
            bt.unregisterEditor();
            const withoutBlocks = await store.getBackpackAssetEditorContextAsync("project");
            const wrongHeader = await bt.outcome(() => store.getBackpackAssetEditorContextAsync("other"));
            bt.canEdit = false;
            return { canImport, canEdit, context, sameContext: context === bt.assetContext && withoutBlocks === context,
                wrongHeader, disabled: store.canEditBackpackAsset("project"),
                denied: await bt.outcome(() => store.getBackpackAssetEditorContextAsync("project")),
                loads: bt.contextLoads, requests: bt.requests, imports: bt.imports };
        });
        assert.strictEqual(result.canImport, false); assert.strictEqual(result.canEdit, true);
        assert.deepStrictEqual(result.context, { blocksInfo: {}, gallery: {}, palette: ["#000000"] });
        assert.strictEqual(result.sameContext, true); assert.strictEqual(result.disabled, false);
        assert.match(result.wrongHeader, /editable project/); assert.match(result.denied, /editable project/);
        assert.strictEqual(result.loads, 2, "Ineligible requests must not start loading the host context");
        assert.deepStrictEqual(result.requests, []); assert.deepStrictEqual(result.imports, []);
    });

    for (const transition of ["account away/back", "header"]) it(`rejects asset context completing after ${transition} changes`, async () => {
        const result = await page.evaluate(async transition => {
            bt.canImport = false; bt.hold();
            bt.assetHost.contextAsync = async () => { bt.enter(); await bt.gate; return bt.assetContext; };
            const pending = bt.outcome(() => store.getBackpackAssetEditorContextAsync("project"));
            await bt.entered;
            if (transition === "account away/back") {
                bt.signIn("bob"); store.notifyBackpackEditorChanged();
                bt.signIn("alice"); store.notifyBackpackEditorChanged();
            } else bt.headerId = "other";
            bt.release();
            return { failure: await pending, requests: bt.requests, imports: bt.imports };
        }, transition);
        assert.match(result.failure, transition === "account away/back" ? /account or editor changed/ : /editable project/);
        assert.deepStrictEqual(result.requests, []); assert.deepStrictEqual(result.imports, []);
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
        assert.equal(result.count, 45); assert.equal(result.complete, true); assert.equal(result.bodies, false);
        assert.equal(result.before.length, 3);
        assert.ok(result.before.every(request => request.method === "GET" && request.allowHttpErrors && request.withCredentials
            && request.headers.authorization === "mkcd alice-token" && request.headers["x-pxt-target"] === "arcade"));
        assert.match(result.after.url, /\/content$/); assert.equal(result.imported.length, 1);
        assert.equal(result.summary.kind, "asset"); assert.equal(result.summary.hasPreview, false);
        assert.equal(result.imported[0].kind, "asset");
        assert.deepStrictEqual(result.summary.versions, { target: "1.0.0-beta.2+capture", pxt: "13.2.4-beta.1+build.9" });
        assert.deepStrictEqual(result.imported[0].versions, result.summary.versions);
        assert.deepStrictEqual(result.positions, [{ x: 240, y: 160 }]);
        assert.deepStrictEqual(result.usage, { count: 45, codeCount: 44, assetCount: 1, bytes: 100 });
        assert.equal(result.limits.maxAssets, 200); assert.equal(result.limits.maxAssetCodeBytes, 131072);
    });

    for (const cloud of [false, true]) it(`round-trips ${cloud ? "cloud" : "local"} asset edits and rejects stale writes`, async () => {
        const result = await page.evaluate(async cloud => {
            if (cloud) bt.seed(1, bt.asset(1));
            else { bt.signIn(undefined); await store.saveBackpackItemAsync(bt.asset(1)); }
            await store.refreshBackpackAsync();
            const entry = store.getBackpackState().entries[0], before = bt.clone(bt.requests);
            const original = await store.loadBackpackAssetAsync(entry);
            const edited = bt.asset(1, { name: "Edited", createdAt: 999, blockText: "new pixels",
                versions: { target: "2.0.0-beta.1", pxt: "14.0.0" }, dependencies: {}, code: original.code.replace("pixels", "像素") });
            const oversized = await bt.outcome(() => store.saveBackpackAssetAsync(entry, { ...edited, code: original.code.replace("pixels", "像".repeat(50000)) }));
            const code = await bt.outcome(() => store.saveBackpackAssetAsync(entry, bt.item(1)));
            await store.saveBackpackAssetAsync(entry, edited);
            const current = store.getBackpackState().entries[0], roundtrip = await store.loadBackpackAssetAsync(current);
            const stale = await bt.outcome(() => store.saveBackpackAssetAsync(entry, edited));
            const newer = { ...roundtrip, name: "Another tab/device" };
            if (cloud) { bt.originals[entry.id] = newer; bt.remote[entry.id] = { ...bt.summary(newer), version: '"v3"' }; }
            else await bt.putLocal(entry.id, JSON.stringify(newer));
            const conflict = await bt.outcome(() => store.saveBackpackAssetAsync(current, edited));
            return { original, edited, roundtrip, before, oversized, code, stale, conflict, newer, requests: bt.requests, imports: bt.imports,
                stored: cloud ? bt.originals[entry.id] : JSON.parse((await bt.readLocal())[0].payload), summary: current.summary };
        }, cloud);
        assert.deepStrictEqual(result.roundtrip, { ...result.edited, createdAt: result.original.createdAt });
        assert.deepStrictEqual(result.stored, result.newer); assert.deepStrictEqual(result.imports, []);
        assert.match(result.oversized, /UTF-8 bytes/); assert.notEqual(result.code, "OK");
        assert.match(result.stale, /no longer current/); assert.match(result.conflict, /another device/);
        assert(result.before.every(request => !request.url.endsWith("/content")));
        if (cloud) {
            const patches = result.requests.filter(request => request.method === "PATCH");
            assert.deepStrictEqual(patches.map(request => request.headers["If-Match"]), ['"v1"', '"v2"']);
            assert.deepStrictEqual(patches.map(request => request.data), [result.edited, result.edited]);
            assert.equal(result.summary.version, '"v2"'); assert.equal(result.summary.createdAt, result.original.createdAt);
        } else assert.deepStrictEqual(result.requests, []);
    });

    it("keeps attempted pending asset copies immutable", async () => {
        const result = await page.evaluate(async () => {
            bt.hook = (options, run) => { const result = run(); if (options.method === "PUT") throw new Error("Lost ACK"); return result; };
            await bt.outcome(() => store.saveBackpackItemAsync(bt.asset(1)));
            const entry = store.getBackpackState().entries[0], before = await bt.readLocal("alice"); bt.requests = [];
            return { before, preview: await store.loadBackpackAssetPreviewAsync(entry), load: await bt.outcome(() => store.loadBackpackAssetAsync(entry)),
                save: await bt.outcome(() => store.saveBackpackAssetAsync(entry, bt.asset(1, { name: "Changed" }))),
                after: await bt.readLocal("alice"), requests: bt.requests };
        });
        assert(result.before[0].firstAttemptAt); assert.deepStrictEqual(result.after, result.before);
        assert.deepStrictEqual(result.preview, JSON.parse(result.before[0].payload));
        assert.match(result.load, /Retry syncing/); assert.match(result.save, /Retry syncing/); assert.deepStrictEqual(result.requests, []);
    });

    it("loads cloud and updated guest asset previews on demand without storage writes and rejects late account responses", async () => {
        const result = await page.evaluate(async () => {
            bt.seed(1, bt.asset(1));
            await store.refreshBackpackAsync();
            const entry = store.getBackpackState().entries[0], before = bt.clone(store.getBackpackState());
            const source = bt.clone(bt.originals), localBefore = await bt.readLocal("alice"), listing = bt.clone(bt.requests);
            const preview = await store.loadBackpackAssetPreviewAsync(entry);
            const cloud = { preview, before, after: bt.clone(store.getBackpackState()), source, sourceAfter: bt.clone(bt.originals),
                localBefore, localAfter: await bt.readLocal("alice"), listing, requests: bt.clone(bt.requests) };
            bt.hold();
            bt.hook = async (options, run) => {
                const response = run();
                if (options.url.endsWith("/content")) { bt.enter(); await bt.gate; }
                return response;
            };
            const pending = bt.outcome(() => store.loadBackpackAssetPreviewAsync(entry));
            await bt.entered;
            bt.signIn("bob"); bt.remote = {}; bt.originals = {};
            await store.refreshBackpackAsync();
            const switched = bt.clone(store.getBackpackState());
            bt.release();
            const late = await pending, afterLate = bt.clone(store.getBackpackState());
            bt.hook = undefined; bt.signIn(undefined);
            await store.saveBackpackItemAsync(bt.asset(2));
            await store.refreshBackpackAsync();
            const guestEntry = store.getBackpackState().entries[0], guestBefore = await bt.readLocal();
            const guestPreview = await store.loadBackpackAssetPreviewAsync(guestEntry), guestAfter = await bt.readLocal();
            await store.saveBackpackAssetAsync(guestEntry, { ...guestPreview, code: guestPreview.code.replace("pixels", "updated pixels") });
            const editedEntry = store.getBackpackState().entries[0], editedBefore = await bt.readLocal();
            const guestRequests = bt.requests.length, updated = await store.loadBackpackAssetPreviewAsync(editedEntry);
            return { cloud, late, switched, afterLate, guestPreview, guestBefore, guestAfter, updated, editedBefore,
                editedAfter: await bt.readLocal(), guestRequests, requests: bt.requests, imports: bt.imports };
        });
        const { cloud } = result;
        assert.strictEqual(cloud.listing.length, 1); assert.doesNotMatch(cloud.listing[0].url, /\/content$/);
        assert.strictEqual(cloud.requests.length, 2); assert.match(cloud.requests[1].url, /\/content$/);
        assert.strictEqual(cloud.requests[1].headers.authorization, "mkcd alice-token");
        assert.deepStrictEqual(cloud.preview, Object.values(cloud.source)[0]);
        assert.deepStrictEqual(cloud.after, cloud.before); assert.deepStrictEqual(cloud.sourceAfter, cloud.source);
        assert.deepStrictEqual(cloud.localAfter, cloud.localBefore);
        assert.notStrictEqual(result.late, "OK"); assert.deepStrictEqual(result.afterLate, result.switched);
        assert.deepStrictEqual(result.afterLate.entries, []);
        assert.deepStrictEqual(result.guestPreview, JSON.parse(result.guestBefore[0].payload));
        assert.deepStrictEqual(result.guestAfter, result.guestBefore);
        assert.deepStrictEqual(result.updated, JSON.parse(result.editedBefore[0].payload));
        assert.match(result.updated.code, /updated pixels/); assert.deepStrictEqual(result.editedAfter, result.editedBefore);
        assert.strictEqual(result.requests.length, result.guestRequests);
        assert(result.requests.every(request => request.method === "GET" && !request.url.endsWith("/preview")));
        assert.deepStrictEqual(result.imports, []);
    });

    it("round-trips beta metadata through guest persistence, direct import, upload, and cloud content", async () => {
        const result = await page.evaluate(async () => {
            bt.signIn(undefined);
            const item = bt.item(1, { versions: { target: "1.0.0-beta.2+capture", pxt: "13.2.4-beta.1" } });
            await store.saveBackpackItemAsync(item);
            await store.refreshBackpackAsync();
            const local = store.getBackpackItems()[0];
            await store.importBackpackItemAsync(local, "project");
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
        assert.equal(result.summary.kind, "code"); assert.deepStrictEqual(result.records, []);
    });

    it("keeps separate guest code and asset quotas and never supplies an asset preview", async () => {
        const result = await page.evaluate(async () => {
            bt.signIn(undefined);
            for (let n = 1; n <= 50; n++) await bt.putLocal(bt.id(n), JSON.stringify(bt.item(n)));
            await store.saveBackpackItemAsync(bt.asset(51)); // A full code category must not block assets.
            for (let n = 52; n <= 250; n++) await bt.putLocal(bt.id(n), JSON.stringify(bt.asset(n)));
            const codeFull = await bt.outcome(() => store.saveBackpackItemAsync(bt.item(251)));
            const assetFull = await bt.outcome(() => store.saveBackpackItemAsync(bt.asset(252)));
            await store.refreshBackpackAsync();
            await store.deleteBackpackEntryAsync(store.getBackpackState().entries.find(entry => entry.id === bt.id(1)));
            await store.saveBackpackItemAsync(bt.item(251)); // Full assets must not block code either.
            const items = store.getBackpackItems();
            window.fetch = () => { throw new Error("Asset previews must not be fetched"); };
            const preview = await bt.outcome(() => store.getBackpackPreviewAsync(
                store.getBackpackState().entries.find(entry => entry.item.kind === "asset"), new AbortController().signal));
            return { codeFull, assetFull, preview, codeCount: items.filter(item => item.kind === "code").length,
                assets: items.filter(item => item.kind === "asset"), requests: bt.requests };
        });
        assert.match(result.codeFull, /full/); assert.match(result.assetFull, /full/);
        assert.equal(result.codeCount, 50); assert.equal(result.assets.length, 200);
        assert(result.assets.every(item => !("previewUri" in item) && !("previewPixelDensity" in item)));
        assert.notEqual(result.preview, "OK"); assert.deepStrictEqual(result.requests, []);
    });

    it("missing target flag or identity support disables storage and drop, but signed-out guests remain enabled", async () => {
        const result = await page.evaluate(async () => {
            bt.signIn(undefined); await store.saveBackpackItemAsync(bt.item(1));
            const guest = { enabled: store.isBackpackEnabled(), drop: store.canDropBackpack("project", document.body),
                edit: store.canEditBackpackAsset("project") };
            const disabled = [];
            for (const setting of ["flag", "identity"]) {
                if (setting === "flag") delete pxt.appTarget.appTheme.backpack;
                else bt.identityEnabled = false;
                store.notifyBackpackEditorChanged();
                disabled.push({ enabled: store.isBackpackEnabled(), drop: store.canDropBackpack("project", document.body),
                    edit: store.canEditBackpackAsset("project"),
                    context: await bt.outcome(() => store.getBackpackAssetEditorContextAsync("project")),
                    entries: store.getBackpackState().entries,
                    save: await bt.outcome(() => store.saveBackpackItemAsync(bt.item(2))),
                    refresh: await bt.outcome(() => store.refreshBackpackAsync()),
                    import: await bt.outcome(() => store.importBackpackItemAsync(bt.item(1), "project")) });
                pxt.appTarget.appTheme.backpack = true; bt.identityEnabled = true;
                store.notifyBackpackEditorChanged();
                // Re-enabling must not revive the previous identity's snapshot.
                disabled.at(-1).restoredEntries = store.getBackpackState().entries;
                await store.refreshBackpackAsync();
            }
            return { guest, disabled, records: await bt.readLocal(), requests: bt.requests, imports: bt.imports };
        });
        assert.deepStrictEqual(result.guest, { enabled: true, drop: true, edit: true });
        for (const state of result.disabled) {
            assert.equal(state.enabled, false); assert.equal(state.drop, false); assert.equal(state.edit, false);
            assert.deepStrictEqual(state.entries, []); assert.deepStrictEqual(state.restoredEntries, []);
            for (const action of ["save", "refresh", "import", "context"]) assert.match(state[action], /session/);
        }
        assert.equal(result.records.length, 1);
        assert.deepStrictEqual(result.requests, []); assert.deepStrictEqual(result.imports, []);
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

    for (const transition of ["account", "target", "token", "disabled flag", "disabled identity"]) it(`discards late responses and queued work after ${transition}`, async () => {
        const result = await page.evaluate(async transition => {
            bt.hold(); bt.hook = async (options, run) => { if (options.method === "PUT") { bt.enter(); await bt.gate; } return run(); };
            const first = bt.outcome(() => store.saveBackpackItemAsync(bt.item(1))); await bt.entered;
            const second = bt.outcome(() => store.saveBackpackItemAsync(bt.item(2)));
            if (transition === "account") bt.signIn("bob");
            if (transition === "target") pxt.appTarget.id = "microbit";
            if (transition === "token") bt.signIn("alice", "replacement");
            if (transition === "disabled flag") delete pxt.appTarget.appTheme.backpack;
            if (transition === "disabled identity") bt.identityEnabled = false;
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
            bt.hook = () => bt.fail("backpack_PRIVATE_UNRECOGNIZED", 500);
            const failure = await bt.outcome(() => store.deleteBackpackEntryAsync(entry));
            bt.hook = () => bt.fail("backpack_unsupported_entry", 400);
            const unsupported = await bt.outcome(() => store.deleteBackpackEntryAsync(entry));
            bt.hook = () => ({ statusCode: 204 }); await store.deleteBackpackEntryAsync(entry);
            bt.hook = () => ({ statusCode: 403 });
            const denied = await bt.outcome(() => store.refreshBackpackAsync());
            const deniedState = store.getBackpackState();
            bt.hook = () => ({ statusCode: 503 });
            const unavailable = await bt.outcome(() => store.saveBackpackItemAsync(bt.item(2)));
            const retained = await bt.readLocal("alice");
            bt.hook = () => ({ statusCode: 401, json: { secret: "PRIVATE" } });
            const unauthorized = await bt.outcome(() => store.refreshBackpackAsync());
            return { failure, unsupported, denied, deniedState, unavailable, retained, unauthorized, logouts: bt.logouts };
        });
        assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
        assert.match(result.failure, /Could not sync/); assert.match(result.unsupported, /unsupported Backpack format.*Delete it and save a new copy/);
        assert.equal(result.logouts, 1); assert.match(result.unauthorized, /Sign in/);
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
                ...["kind", "versions"].map(field => { const item = bt.item(1); delete item[field]; return item; }),
                bt.item(1, { kind: "image" }),
                ...[undefined, { target: "1.0.0" }, { pxt: "13.2.4" },
                    { target: "1.0.0", pxt: "13.2.4", extra: "not allowed" },
                    { target: "beta", pxt: "13.2.4" }, ["1.0.0", "13.2.4"]].map(versions => bt.item(1, { versions })),
                bt.item(1, { code: "é".repeat(262145) }), bt.item(1, { name: "bad\nname" }),
                bt.item(1, { dependencies: { ext: "file:private" } }), bt.item(1, { projectBlocks: { type: "bad\nfile" } }),
                bt.item(1, { previewUri: "javascript:bad" }), bt.item(1, { previewPixelDensity: 2 }),
                bt.item(1, { previewUri: "data:image/png;base64,iVBORw0KGgo=", previewPixelDensity: 3 })];
            const rejected = invalid.map(value => { try { store.validateBackpackItem(value); return false; } catch { return true; } });
            const missingSummaries = ["kind", "versions"].map(field => {
                const summary = bt.summary(bt.item(2)); delete summary[field];
                return store.readBackpackSummary(summary);
            });
            const densities = [1, 1.5, 2].map(previewPixelDensity => store.validateBackpackItem(bt.item(1, {
                previewUri: "data:image/png;base64,iVBORw0KGgo=", previewPixelDensity })).previewPixelDensity);
            const recovery = store.readBackpackEntry("bad", { name: "x".repeat(101), code: "PRIVATE", previewUri: "javascript:bad" }, "local");
            const summary = store.readBackpackSummary({ ...bt.summary(bt.item(2)), code: "PRIVATE", previewUri: "javascript:bad" });
            return { rejected, missingSummaries, densities, recovery, summary, requests: bt.requests };
        });
        assert(result.rejected.every(Boolean)); assert.deepStrictEqual(result.densities, [1, 1.5, 2]);
        assert(result.missingSummaries.every(entry => entry.error && !entry.item && entry.summary.status === "invalid"));
        assert.equal(result.recovery.name.length, 100); assert.equal(result.recovery.item, undefined);
        assert.equal(result.summary.item, undefined); assert.doesNotMatch(JSON.stringify(result.summary), /PRIVATE|javascript/);
        assert.deepStrictEqual(result.requests, []);
    });

    it("rejects non-standalone or misclassified assets, previews, and oversized asset bodies before persistence", async () => {
        const result = await page.evaluate(async () => {
            const code = (...blocks) => JSON.stringify({ blocks });
            const root = { type: "image_picker" };
            const invalid = [
                bt.asset(1, { code: code({ type: "not_an_asset_picker" }) }),
                bt.item(1, { code: code(root) }), bt.asset(1, { code: code({ type: "pxt-on-start" }) }),
                bt.asset(1, { code: code(root, root) }),
                bt.asset(1, { code: code({ ...root, next: null }) }),
                bt.asset(1, { code: code({ ...root, inputs: { IMAGE: { shadow: { type: "text" } } } }) }),
                bt.asset(1, { code: code({ ...root, inputs: [] }) }),
                bt.asset(1, { previewUri: "data:image/png;base64,iVBORw0KGgo=" }),
                bt.asset(1, { previewPixelDensity: undefined }),
                bt.asset(1, { code: code({ ...root, fields: { IMAGE: "é".repeat(65536) } }) })
            ];
            const failures = [];
            for (const value of invalid) failures.push(await bt.outcome(() => store.saveBackpackItemAsync(value)));
            const valid = store.validateBackpackItem(bt.asset(2, { code: code({ ...root, inputs: {} }) }));
            const detached = store.validateBackpackItem(valid);
            valid.versions.target = "9.0.0";
            return { failures, detached, records: await bt.readLocal("alice"), requests: bt.requests };
        });
        assert(result.failures.every(failure => failure !== "OK"));
        assert.equal(result.detached.kind, "asset"); assert.equal(result.detached.versions.target, "1.0.0");
        assert.deepStrictEqual(result.records, []); assert.deepStrictEqual(result.requests, []);
    });

});