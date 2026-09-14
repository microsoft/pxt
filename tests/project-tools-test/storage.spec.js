"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

// Run the actual workspace/cloud modules with an in-memory provider and fake
// authenticated API. No project content is sent to a server or shared publicly.
function createEnvironment() {
    const localStorage = new Map();
    const stored = new Map();
    const remote = new Map();
    const requests = [];
    const errors = [];
    let nextId = 0;
    let holdUpload;
    let holdDownload;
    let failStorage = false;
    const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const context = vm.createContext({
        console, Uint8Array, Uint16Array, Uint32Array, ArrayBuffer, DataView, Error, TextDecoder, TextEncoder,
        setTimeout: () => 1, clearTimeout: () => {},
        atob: s => Buffer.from(s, "base64").toString("binary"),
        btoa: s => Buffer.from(s, "binary").toString("base64")
    });
    vm.runInContext(fs.readFileSync("built/pxtlib.js", "utf8"), context);
    const pxt = context.pxt;
    pxt.U.guidGen = () => `project-${++nextId}`;
    pxt.debug = pxt.log = pxt.tickEvent = () => {};
    pxt.reportException = error => errors.push(error);
    pxt.storage.getLocal = key => localStorage.get(key) || "";
    pxt.storage.setLocal = (key, value) => localStorage.set(key, value);
    pxt.storage.removeLocal = key => localStorage.delete(key);
    pxt.appTarget = { id: "arcade", appTheme: {}, simulator: {}, versions: { target: "4.2.1" } };
    pxt.BrowserUtils.isSkillmapEditor = () => false;
    pxt.auth.identityProviderId = () => "test";
    context.lf = pxt.U.lf;
    const provider = {
        getAsync: async header => clone(stored.get(header.id)),
        setAsync: async (header, version, text) => {
            if (failStorage) throw new Error("storage unavailable");
            stored.set(header.id, { header: clone(header), text: clone(text || stored.get(header.id)?.text || {}), version: 1 });
            return 1;
        },
        listAsync: async () => Array.from(stored.values()).map(file => clone(file.header))
    };
    const auth = {
        hasIdentity: () => true, loggedIn: () => true, userProfile: () => ({ id: "owner" }),
        apiAsync: async (url, data) => {
            requests.push({ url, data: clone(data) });
            if (url === "/api/user/project/share") return { success: true, resp: { shareID: "shared", scr: { id: "snapshot", meta: {} } } };
            if (url.startsWith("/api/user/project?") || (url === "/api/user/project" && !data))
                return { success: true, resp: Array.from(remote.values()).map(clone) };
            if (url.startsWith("/api/user/project/")) {
                if (holdDownload) await holdDownload;
                return { success: true, resp: clone(remote.get(url.split("/").pop())) };
            }
            assert.equal(url, "/api/user/project");
            if (holdUpload) await holdUpload;
            const version = `v${requests.length}`;
            remote.set(data.id, { ...clone(data), version });
            return { success: true, resp: version };
        }
    };
    pxt.Cloud.privatePostAsync = async (url, data) => {
        requests.push({ url, data: clone(data) });
        return { id: "snapshot", shortid: "shared", meta: {} };
    };
    const modules = {};
    const load = name => {
        if (modules[name]) return modules[name];
        const exports = {};
        modules[name] = exports;
        const code = fs.readFileSync(path.join("built/webapp/src", name + ".js"), "utf8");
        const run = vm.runInContext(`(function(require, exports) { ${code}\n})`, context);
        run(id => {
            if (id === "./auth") return auth;
            if (id === "./cloud" || id === "./workspace" || id === "./projectNotes") return load(id.slice(2));
            if (id === "./memoryworkspace" || id === "./idbworkspace") return { provider };
            if (id === "./data") return { invalidate: () => {}, invalidateHeader: () => {}, mountVirtualApi: () => {} };
            if (id === "../../pxteditor/history") return { updateShareHistory: () => {} };
            if (id === "../../pxteditor") return { history: { updateShareHistory: () => {} } };
            if (id === "./core") return { errorNotification: () => {} };
            return {};
        }, exports);
        return exports;
    };
    const workspace = load("workspace");
    const cloud = load("cloud");
    workspace.setupWorkspace("idb");
    return { pxt, workspace, cloud, notes: load("projectNotes"), requests, stored, remote, errors,
        holdUpload: promise => holdUpload = promise,
        holdDownload: promise => holdDownload = promise,
        failStorage: value => failStorage = value,
        async install() {
            const header = { id: "original", target: "arcade", name: "test", meta: {}, pubCurrent: true, editor: "tsprj" };
            const text = { "pxt.json": JSON.stringify({ name: "test", dependencies: {}, files: ["main.ts"] }), "main.ts": "let x = 1" };
            await workspace.importAsync(header, text);
            header.pubCurrent = true;
            return { header: workspace.getHeader(header.id), text };
        }
    };
}

describe("private project-note storage boundaries", () => {
    it("saves to project metadata and preserves published-code status", async () => {
        const env = createEnvironment(); const { header, text } = await env.install();
        await env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "PRIVATE_SENTINEL" });
        assert.equal(header.pubCurrent, true);
        assert.equal(header.cloudCurrent, false);
        assert.equal(env.stored.get(header.id).header.projectNotes.text, "PRIVATE_SENTINEL");
        assert.equal(JSON.stringify(env.stored.get(header.id).text), JSON.stringify(text));
    });

    for (const method of ["anonymousPublishAsync", "persistentPublishAsync"]) {
        it(`excludes notes from ${method} without deleting private data`, async () => {
            const env = createEnvironment(); const { header, text } = await env.install();
            await env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "PRIVATE_SENTINEL" });
            await env.workspace[method](header, text, { description: "test" });
            const request = env.requests.find(r => r.url === "scripts" || r.url === "/api/user/project/share");
            assert.ok(request);
            assert.ok(!JSON.stringify(request.data).includes("PRIVATE_SENTINEL"));
            assert.equal(JSON.parse(request.data.header).projectNotes, undefined);
            assert.equal(header.projectNotes.text, "PRIVATE_SENTINEL");
        });
    }

    it("keeps notes in a duplicate owned by the same user", async () => {
        const env = createEnvironment(); const { header } = await env.install();
        await env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "private" });
        const duplicate = await env.workspace.duplicateAsync(header, "copy");
        assert.notEqual(duplicate.id, header.id);
        assert.equal(duplicate.projectNotes.text, "private");
        await env.workspace.saveProjectNotesAsync(duplicate.id, { version: 1, text: "changed copy" });
        assert.equal(header.projectNotes.text, "private");
    });

    it("retains notes in authenticated cloud upload and download", async () => {
        const env = createEnvironment(); const { header } = await env.install();
        await env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "private upload" });
        await env.cloud.syncAsync({ hdrs: [header], direction: "up" });
        assert.equal(env.errors.length, 0);
        const uploaded = env.remote.get(header.id);
        assert.equal(JSON.parse(uploaded.header).projectNotes.text, "private upload");
        const remoteHeader = JSON.parse(uploaded.header);
        remoteHeader.projectNotes = { version: 1, text: "private download" };
        env.remote.set(header.id, { ...uploaded, header: JSON.stringify(remoteHeader), version: "remote-new" });
        await env.cloud.syncAsync({ hdrs: [header], direction: "down" });
        assert.equal(env.workspace.getHeader(header.id).projectNotes.text, "private download");
        assert.equal(env.errors.length, 0);
    });

    it("does not acknowledge notes edited during an in-flight upload", async () => {
        const env = createEnvironment(); const { header } = await env.install();
        await env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "A" });
        let finish;
        env.holdUpload(new Promise(resolve => finish = resolve));
        const upload = env.cloud.syncAsync({ hdrs: [header], direction: "up" });
        for (let i = 0; i < 100; ++i) await Promise.resolve();
        assert.ok(env.requests.some(request => request.url === "/api/user/project" && request.data));
        await env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "B" });
        finish(); await upload;
        assert.equal(header.cloudCurrent, false);
        env.holdUpload(undefined);
        await env.cloud.syncAsync({ hdrs: [header], direction: "up" });
        assert.equal(JSON.parse(env.remote.get(header.id).header).projectNotes.text, "B");
        assert.equal(header.cloudCurrent, true);
    });

    it("rejects invalid notes without overwriting saved data", async () => {
        const env = createEnvironment(); const { header } = await env.install();
        await env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "saved" });
        await assert.rejects(env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "changed", image: "invalid" }));
        assert.equal(header.projectNotes.text, "saved");
    });

    it("does not overwrite notes edited during an in-flight cloud download", async () => {
        const env = createEnvironment(); const { header } = await env.install();
        await env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "A" });
        await env.cloud.syncAsync({ hdrs: [header], direction: "up" });
        const uploaded = env.remote.get(header.id);
        const remoteHeader = JSON.parse(uploaded.header);
        remoteHeader.projectNotes = { version: 1, text: "B" };
        env.remote.set(header.id, { ...uploaded, header: JSON.stringify(remoteHeader), version: "remote-new" });
        let finish;
        env.holdDownload(new Promise(resolve => finish = resolve));
        const download = env.cloud.syncAsync({ hdrs: [header], direction: "down" });
        for (let i = 0; i < 100; ++i) await Promise.resolve();
        assert.ok(env.requests.some(request => request.url === "/api/user/project/original"));
        await env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "C" });
        finish(); await download;
        assert.equal(header.projectNotes.text, "C");
        assert.equal(env.stored.get(header.id).header.projectNotes.text, "C");
        assert.equal(header.cloudCurrent, false);
        assert.notEqual(header.cloudVersion, "remote-new");
    });

    it("reports non-durable note saves and permits retry", async () => {
        const env = createEnvironment(); const { header } = await env.install();
        await env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "saved" });
        env.failStorage(true);
        await assert.rejects(env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "retry me" }), /storage unavailable/);
        assert.equal(env.workspace.getWorkspaceType(), "idb");
        assert.equal(env.stored.get(header.id).header.projectNotes.text, "saved");
        env.failStorage(false);
        await env.workspace.saveProjectNotesAsync(header.id, { version: 1, text: "retry me" });
        assert.equal(env.stored.get(header.id).header.projectNotes.text, "retry me");
    });

    it("persists all named boards and the selection through cloud sync and duplication", async () => {
        const env = createEnvironment(); const { header, text } = await env.install();
        let notes = env.notes.normalizeProjectNotes({ version: 1, text: "original private sketch notes" });
        notes = env.notes.addProjectWhiteboard(notes, "Second board");
        notes.whiteboards[1].text = "second private notes";
        notes = env.notes.renameProjectWhiteboard(notes, notes.whiteboards[0].id, "First board");
        await env.workspace.saveProjectNotesAsync(header.id, notes);
        assert.deepEqual(env.stored.get(header.id).header.projectNotes, JSON.parse(JSON.stringify(notes)));
        assert.equal(JSON.stringify(env.stored.get(header.id).text), JSON.stringify(text));
        await env.cloud.syncAsync({ hdrs: [header], direction: "up" });
        const uploaded = env.remote.get(header.id);
        assert.deepEqual(JSON.parse(uploaded.header).projectNotes, JSON.parse(JSON.stringify(notes)));
        const remoteHeader = JSON.parse(uploaded.header);
        remoteHeader.projectNotes.whiteboards[0].name = "Renamed remotely";
        remoteHeader.projectNotes.whiteboards[1].text = "updated on another device";
        env.remote.set(header.id, { ...uploaded, header: JSON.stringify(remoteHeader), version: "remote-boards" });
        await env.cloud.syncAsync({ hdrs: [header], direction: "down" });
        assert.equal(header.projectNotes.whiteboards[0].name, "Renamed remotely");
        assert.equal(header.projectNotes.whiteboards[1].text, "updated on another device");
        assert.equal(header.projectNotes.activeWhiteboardId, notes.activeWhiteboardId);
        const duplicate = await env.workspace.duplicateAsync(header, "copy");
        const renamed = env.notes.renameProjectWhiteboard(duplicate.projectNotes, notes.activeWhiteboardId, "Copy only");
        await env.workspace.saveProjectNotesAsync(duplicate.id, renamed);
        assert.equal(header.projectNotes.whiteboards[1].name, "Second board");
        assert.equal(env.errors.length, 0);
    });

    it("persists whiteboard deletion and syncs only the remaining boards", async () => {
        const env = createEnvironment(); const { header, text } = await env.install();
        const notes = env.notes.addProjectWhiteboard(env.notes.normalizeProjectNotes({ version: 1, text: "Retained notes" }), "Delete me");
        notes.whiteboards[1].text = "REMOVED_WHITEBOARD_TEXT";
        await env.workspace.saveProjectNotesAsync(header.id, notes);
        await env.cloud.syncAsync({ hdrs: [header], direction: "up" });
        const remaining = env.notes.deleteProjectWhiteboard(notes, notes.activeWhiteboardId);
        await env.workspace.saveProjectNotesAsync(header.id, remaining);
        assert.deepEqual(env.stored.get(header.id).header.projectNotes, JSON.parse(JSON.stringify(remaining)));
        assert.equal(JSON.stringify(env.stored.get(header.id).text), JSON.stringify(text));
        assert.equal(header.pubCurrent, true);
        await env.cloud.syncAsync({ hdrs: [header], direction: "up" });
        const remote = JSON.parse(env.remote.get(header.id).header).projectNotes;
        assert.deepEqual(remote, JSON.parse(JSON.stringify(remaining)));
        assert.ok(!JSON.stringify(remote).includes("REMOVED_WHITEBOARD_TEXT"));
        assert.equal(env.errors.length, 0);
    });

    for (const method of ["anonymousPublishAsync", "persistentPublishAsync"]) {
        it(`excludes every whiteboard and its name from ${method}`, async () => {
            const env = createEnvironment(); const { header, text } = await env.install();
            let notes = env.notes.normalizeProjectNotes({ version: 1, text: "PRIVATE_FIRST_BOARD" });
            notes = env.notes.addProjectWhiteboard(notes, "PRIVATE_BOARD_NAME");
            notes.whiteboards[1].text = "PRIVATE_SECOND_BOARD";
            await env.workspace.saveProjectNotesAsync(header.id, notes);
            await env.workspace[method](header, text, { description: "test" });
            const request = env.requests.find(r => r.url === "scripts" || r.url === "/api/user/project/share");
            assert.ok(request);
            assert.ok(!JSON.stringify(request.data).includes("PRIVATE_"));
            assert.equal(JSON.parse(request.data.header).projectNotes, undefined);
            assert.equal(header.projectNotes.whiteboards[1].text, "PRIVATE_SECOND_BOARD");
        });
    }
});