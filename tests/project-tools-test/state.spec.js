"use strict";

const assert = require("assert");
const fs = require("fs");
const ts = require("typescript");
const { launchTestBrowser } = require("./browser");

describe("workspace reset", () => {
    const source = ts.createSourceFile("workspace.ts", fs.readFileSync("webapp/src/workspace.ts", "utf8"),
        ts.ScriptTarget.Latest, true);
    const reset = source.statements.filter(node => ts.isFunctionDeclaration(node) && ["resetAsync", "resetCoreAsync"].includes(node.name?.text));
    const code = ts.transpileModule(`let resetPromise; ${reset.map(node => node.getText(source)).join("\n")}`, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;

    function environment(steps = {}) {
        const exports = {};
        const calls = [];
        const errors = [];
        const run = name => () => { calls.push(name); return steps[name]?.(); };
        const globals = {
            allScripts: [{ id: "before" }], workspaceGeneration: 0, syncAsyncPromise: undefined,
            headerQ: { promises: steps["pending-writes"] ? { project: [] } : {}, enqueue: () => steps["pending-writes"]() },
            impl: { resetAsync: run("workspace") }, cloudsync: { resetAsync: run("cloud") },
            db: { destroyAsync: run("database") },
            pxt: { reportException: (_error, data) => errors.push(data.step),
                BrowserUtils: { clearTranslationDbAsync: run("translations"), clearTutorialInfoDbAsync: run("tutorials") },
                storage: { clearLocal: run("settings"), setLocal: (...args) => { calls.push("local-token"); steps["local-token"]?.(...args); } } },
            compiler: { clearApiInfoDbAsync: run("api") }, data: { clearCache: run("cache") },
            Cloud: { localToken: "keep-this-token" }, syncAsync: run("sync"),
            backpack: { resetBackpackAsync: run("backpack") },
            lf: (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i])
        };
        new Function("exports", ...Object.keys(globals), code)(exports, ...Object.values(globals));
        return { reset: exports.resetAsync, calls, errors };
    }

    it("awaits local cleanup and coalesces overlapping reset requests", async () => {
        let release;
        const pending = new Promise(resolve => release = resolve);
        const e = environment({ backpack: () => pending });
        const resetting = e.reset();
        assert.strictEqual(e.reset(), resetting);
        await new Promise(resolve => setImmediate(resolve));
        assert.deepStrictEqual(e.calls, ["backpack"]);
        release();
        await resetting;
        assert(e.calls.includes("settings"));
        assert(e.calls.includes("sync"));
        assert.deepStrictEqual(e.errors, []);
    });

    for (const step of ["backpack", "workspace", "cloud", "database", "translations", "tutorials", "api", "settings", "cache", "local-token", "sync"]) {
        it(`attempts all cleanup and reports an incomplete reset when ${step} fails`, async () => {
            const token = [];
            const e = environment({ "local-token": (...args) => token.push(args), [step]: () => { throw new Error("failure"); } });
            await assert.rejects(e.reset(), new RegExp(step));
            assert.deepStrictEqual(e.errors, [step]);
            assert.deepStrictEqual(new Set(e.calls), new Set([
                "backpack", "workspace", "cloud", "database", "translations", "tutorials", "api", "settings", "cache", "local-token", "sync"
            ]));
            if (step !== "local-token") assert.deepStrictEqual(token, [["local_token", "keep-this-token"]]);
        });
    }

    it("can retry after an incomplete reset", async () => {
        let first = true;
        const e = environment({ workspace: () => { if (first) { first = false; throw new Error("failed"); } } });
        await assert.rejects(e.reset());
        await e.reset();
    });

    it("drains in-flight project writes before clearing their database", async () => {
        let complete;
        const writing = new Promise(resolve => complete = resolve);
        const e = environment({ "pending-writes": () => writing });
        const resetting = e.reset();
        await new Promise(resolve => setImmediate(resolve));
        assert(!e.calls.includes("workspace"));
        complete();
        await resetting;
        assert(e.calls.includes("workspace"));
    });

    it("reports a stalled provider and continues the rest of reset", async () => {
        const original = global.setTimeout;
        const e = environment({ workspace: () => new Promise(() => {}) });
        global.setTimeout = (action, delay) => original(action, delay === 10000 ? 5 : delay);
        try {
            await assert.rejects(e.reset(), /workspace/);
        } finally {
            global.setTimeout = original;
        }
        assert(e.calls.includes("settings"));
        assert(e.calls.includes("sync"));
        assert.deepStrictEqual(e.errors, ["workspace"]);
    });
});

function functionsFrom(file, names) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const found = [];
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.push(node.getText(source));
        ts.forEachChild(node, visit);
    }
    visit(source);
    assert.equal(found.length, names.length);
    return "var exports = {};\n" + ts.transpileModule(found.join("\n"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
}

describe("reset workspace providers", () => {
    it("waits for legacy PouchDB destruction, including when it was not opened in this session", async () => {
        const code = ts.transpileModule(fs.readFileSync("webapp/src/db.ts", "utf8"), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
        }).outputText;
        let release;
        let pending = new Promise(resolve => { release = resolve; });
        let creates = 0;
        const db = { destroy: () => pending };
        const PouchDB = function () { creates++; return db; };
        PouchDB.plugin = () => PouchDB;
        const exports = {};
        new Function("exports", "require", "pxt", code)(exports, name => name === "pouchdb" ? PouchDB : {}, { log: () => {}, storage: { storageId: () => "test" } });
        let finished = false;
        const clearing = exports.destroyAsync().then(() => { finished = true; });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(finished, false);
        release();
        await clearing;
        assert.equal(creates, 1);
        pending = Promise.reject(new Error("destroy failed"));
        await assert.rejects(exports.destroyAsync(), /destroy failed/);
        pending = Promise.resolve();
        await exports.destroyAsync();
        assert.equal(creates, 2, "A failed destroy must remain retryable on its existing connection");
    });

    describe("reset cloud sessions", () => {
        const code = functionsFrom("webapp/src/cloudsync.ts", ["resetAsync"]);
        for (const same of [false, true]) {
            it(`clears session state and both providers even when logout fails (same provider=${same})`, async () => {
                const calls = [];
                const github = { hasToken: () => true, logout: () => { calls.push("github"); } };
                const current = same ? github : { logout: () => { calls.push("current"); throw new Error("provider failed"); } };
                const globals = {
                    currentProvider: current, githubProvider: () => github,
                    pxt: { reportException: () => calls.push("reported"), storage: { removeLocal: () => calls.push("cloudId") } },
                    clearOauth: () => calls.push("oauth"), invalidateData: () => calls.push("cache"),
                    lf: text => text
                };
                const reset = new Function(...Object.keys(globals), code + "; return resetAsync;")(...Object.values(globals));
                if (same) await reset();
                else await assert.rejects(reset(), /cloud session/);
                assert.equal(calls.filter(call => call === "github").length, 1);
                assert(calls.includes("cloudId"));
                assert(calls.includes("oauth"));
                assert(calls.includes("cache"));
            });
        }
    });

    describe("workspace reset invalidation", () => {
        it("ignores an old list response rather than restoring cleared headers after reset", async () => {
            const code = functionsFrom("webapp/src/workspace.ts", ["syncAsync"]);
            let release;
            const old = new Promise(resolve => release = resolve);
            let lists = 0, refreshed = 0;
            const globals = {
                impl: { listAsync: () => ++lists === 1 ? old : Promise.resolve([{ id: "after" }]) },
                pxt: { debug: () => {} }, U: { toDictionary: () => ({}), jsonCopyFrom: Object.assign },
                data: {}, cloudsync: { syncAsync: () => {} },
                switchToMemoryWorkspace: () => { throw new Error("Unexpected fallback"); },
                refreshHeadersSession: () => refreshed++
            };
            const environment = new Function(...Object.keys(globals), `
                let allScripts = [], workspaceGeneration = 0, syncAsyncPromise;
                ${code}
                return { sync: syncAsync, reset: () => { workspaceGeneration++; syncAsyncPromise = undefined; },
                    headers: () => allScripts.map(file => file.header.id) };
            `)(...Object.values(globals));
            const before = environment.sync();
            environment.reset();
            await environment.sync();
            release([{ id: "before" }]);
            await before;
            assert.deepStrictEqual(environment.headers(), ["after"]);
            assert.equal(refreshed, 1);
        });
    });

    for (const electron of [false, true]) {
        it(`preserves filesystem workspace semantics (Electron=${electron})`, async () => {
            const calls = [];
            let release;
            const pending = new Promise(resolve => release = resolve);
            const code = functionsFrom("webapp/src/fileworkspace.ts", ["resetAsync"]);
            const reset = new Function("pxt", "apiAsync", code + "; return resetAsync;")(
                { BrowserUtils: { isPxtElectron: () => electron } },
                (...args) => { calls.push(args); return pending; });
            let finished = false;
            const clearing = reset().then(() => { finished = true; });
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(finished, !electron);
            assert.deepStrictEqual(calls, electron ? [["resetworkspace", {}]] : []);
            release();
            await clearing;
        });
    }

    it("waits for the iframe host to acknowledge reset and propagates host failures", async () => {
        const code = functionsFrom("webapp/src/iframeworkspace.ts", ["resetAsync"]);
        let cleared = false, release;
        const pending = new Promise(resolve => release = resolve);
        const reset = new Function("mem", "pxteditor", code + "; return resetAsync;")(
            { provider: { resetAsync: async () => { cleared = true; } } },
            { postHostMessageAsync: request => { assert.equal(request.action, "workspacereset"); return pending; } });
        let finished = false;
        const clearing = reset().then(() => { finished = true; });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(cleared, true);
        assert.equal(finished, false);
        release();
        await clearing;
        const failing = new Function("mem", "pxteditor", code + "; return resetAsync;")(
            { provider: { resetAsync: async () => {} } },
            { postHostMessageAsync: async () => { throw new Error("host failed"); } });
        await assert.rejects(failing(), /host failed/);
    });

    it("clears the in-memory provider's project list", async () => {
        const code = functionsFrom("webapp/src/memoryworkspace.ts", ["resetAsync", "listAsync"]);
        const provider = new Function("U", `let projects = { one: { header: { id: "one" } } }; ${code}; return { resetAsync, listAsync };`)({ values: Object.values });
        assert.equal((await provider.listAsync()).length, 1);
        await provider.resetAsync();
        assert.deepStrictEqual(await provider.listAsync(), []);
    });
});

describe("reset completion UI", () => {
    const source = ts.createSourceFile("app.tsx", fs.readFileSync("webapp/src/app.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const view = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "ProjectView");
    const reset = view.members.find(node => node.name?.getText(source) === "resetWorkspace");
    const code = ts.transpileModule(`class View { ${reset.getText(source)} } return View;`, {
        compilerOptions: { target: ts.ScriptTarget.ES2020 }
    }).outputText;
    for (const fail of [false, true]) {
        it(`reloads only after cleanup and any incomplete-reset warning (failure=${fail})`, async () => {
            let reloaded = 0, warned = 0, stopped = 0, acknowledge;
            const warning = new Promise(resolve => acknowledge = resolve);
            const View = new Function("workspace", "core", "lf", code)(
                { resetAsync: async () => { if (fail) throw new Error("failed"); } },
                { confirmAsync: () => { warned++; return warning; } }, text => text);
            const view = new View();
            view.stopSimulator = () => { stopped++; };
            view.reloadEditor = () => { reloaded++; };
            const resetting = view.resetWorkspace();
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(stopped, 1);
            assert.equal(reloaded, fail ? 0 : 1);
            assert.equal(warned, fail ? 1 : 0);
            acknowledge();
            await resetting;
            assert.equal(reloaded, 1);
        });

        describe("browser reset persistence and cancellation", function () {
            this.timeout(30000);
            let browser, page;
            const source = ts.createSourceFile("browserutils.ts", fs.readFileSync("pxtlib/browserutils.ts", "utf8"), ts.ScriptTarget.Latest, true);
            let wrapper;
            function find(node) {
                if (ts.isClassDeclaration(node) && node.name?.text === "IDBWrapper") wrapper = node;
                ts.forEachChild(node, find);
            }
            find(source);
            const code = ts.transpileModule(wrapper.getText(source), {
                compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
            }).outputText;
            before(async () => { browser = await launchTestBrowser(); });
            after(async () => { await browser?.close(); });
            beforeEach(async () => {
                page = await browser.newPage();
                await page.setRequestInterception(true);
                page.on("request", request => {
                    if (request.isNavigationRequest()) request.respond({ status: 200, contentType: "text/html", body: "<html></html>" });
                });
                await page.goto("https://reset.test/");
                await page.evaluate(() => {
                    window.pxt = { error: () => {}, log: () => {}, tickEvent: () => {} };
                });
                await page.addScriptTag({ content: `var exports = {}; ${code}; window.ResetDb = exports.IDBWrapper;` });
            });
            afterEach(async () => { await page?.close(); });

            it("commits or rolls back all project tables together, including transaction aborts after clear succeeds", async () => {
                const result = await page.evaluate(async () => {
                    const db = new ResetDb("reset-test", 1, (_event, request) => {
                        for (const name of ["headers", "texts", "cache"]) request.result.createObjectStore(name, { keyPath: "id" });
                    });
                    await db.openAsync();
                    for (const name of ["headers", "texts", "cache"]) await db.setAsync(name, { id: "one", value: name });
                    const original = IDBObjectStore.prototype.clear;
                    IDBObjectStore.prototype.clear = function () {
                        const request = original.call(this);
                        request.addEventListener("success", () => this.transaction.abort());
                        return request;
                    };
                    let rejected = false;
                    try { await db.deleteAllAsync(["headers", "texts", "cache"]); }
                    catch { rejected = true; }
                    finally { IDBObjectStore.prototype.clear = original; }
                    const preserved = await Promise.all(["headers", "texts", "cache"].map(name => db.getAllAsync(name)));
                    await db.deleteAllAsync(["headers", "texts", "cache"]);
                    return { rejected, preserved: preserved.map(records => records.length),
                        cleared: await Promise.all(["headers", "texts", "cache"].map(name => db.getAllAsync(name))) };
                });
                assert.equal(result.rejected, true);
                assert.deepStrictEqual(result.preserved, [1, 1, 1]);
                assert.deepStrictEqual(result.cleared, [[], [], []]);
            });

            it("reports blocked deletion instead of hanging indefinitely", async () => {
                const result = await page.evaluate(async () => {
                    const existing = await new Promise(resolve => {
                        const request = indexedDB.open("blocked-reset", 1);
                        request.onsuccess = () => resolve(request.result);
                    });
                    let rejected = false;
                    try { await ResetDb.deleteDatabaseAsync("blocked-reset"); }
                    catch { rejected = true; }
                    finally { existing.close(); }
                    return rejected;
                });
                assert.equal(result, true);
            });

            it("cancels the actual browser HTTP transport for reset-invalidated requests", async () => {
                const http = functionsFrom("pxtlib/util.ts", ["httpRequestCoreAsync"]);
                await page.addScriptTag({ content: `const Util = { clone: value => value && {...value} }; ${http}; window.resetRequest = httpRequestCoreAsync;` });
                const result = await page.evaluate(async () => {
                    const controller = new AbortController();
                    const requested = resetRequest({ url: "https://reset.test/stalled", signal: controller.signal })
                        .then(() => false, () => true);
                    controller.abort();
                    const rejected = await requested;
                    const alreadyCancelled = await resetRequest({ url: "https://reset.test/stalled", signal: controller.signal })
                        .then(() => false, () => true);
                    return { rejected, alreadyCancelled };
                });
                assert.deepStrictEqual(result, { rejected: true, alreadyCancelled: true });
            });
        });
    }
});

describe("project-tools state on project unload", () => {
    const source = ts.createSourceFile("app.tsx", fs.readFileSync("webapp/src/app.tsx", "utf8"),
        ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const projectView = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "ProjectView");
    const method = projectView.members.find(node => node.name?.getText(source) === "unloadProjectAsync");
    assert(method);
    const code = ts.transpileModule(`class ProjectView { ${method.getText(source)} } exports.ProjectView = ProjectView;`, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;

    for (const pinned of [false, true]) {
        for (const collapsed of [false, true]) {
            it(`clears the pin and collapses tools on returning home (pinned=${pinned}, collapsed=${collapsed})`, async () => {
                const exports = {};
                new Function("exports", "pxt", "cmds", "workspace", code)(exports,
                    { BrowserUtils: { changeHash: () => {} } },
                    { disconnectAsync: () => Promise.resolve() },
                    { syncAsync: () => Promise.resolve() });
                const view = new exports.ProjectView();
                view.state = {
                    home: false,
                    header: { id: "project" },
                    sideDocsPinned: pinned,
                    sideDocsCollapsed: collapsed
                };
                view.stopSimulator = () => {};
                view.showKeymap = () => {};
                view.editor = { unloadFileAsync: () => Promise.resolve() };
                view.extensions = { unload: () => {} };
                view.allEditors = [{ setVisible: () => {} }];
                view.homeLoaded = () => {};
                view.showPackageErrorsOnNextTypecheck = () => {};
                view.setStateAsync = state => {
                    Object.assign(view.state, state);
                    return Promise.resolve();
                };

                await view.unloadProjectAsync(true);

                assert.strictEqual(view.state.home, true);
                assert.strictEqual(view.state.header, undefined);
                assert.strictEqual(view.state.sideDocsPinned, false);
                assert.strictEqual(view.state.sideDocsCollapsed, true);
            });
        }
    }
});
