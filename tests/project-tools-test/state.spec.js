"use strict";

const assert = require("assert");
const fs = require("fs");
const ts = require("typescript");

describe("workspace reset", () => {
    const source = ts.createSourceFile("workspace.ts", fs.readFileSync("webapp/src/workspace.ts", "utf8"),
        ts.ScriptTarget.Latest, true);
    const reset = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "resetAsync");
    const code = ts.transpileModule(reset.getText(source), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;

    it("awaits backpack cleanup before clearing settings and resyncing", async () => {
        const exports = {};
        const calls = [];
        let release;
        const pending = new Promise(resolve => release = resolve);
        const resetAsync = async () => {};
        const clearDb = { clearTranslationDbAsync: resetAsync, clearTutorialInfoDbAsync: resetAsync };
        new Function("exports", "allScripts", "impl", "cloudsync", "db", "pxt", "compiler", "data", "Cloud",
            "syncAsync", "backpack", code)(exports, [], { resetAsync }, { resetAsync }, { destroyAsync: resetAsync },
            { BrowserUtils: clearDb, storage: { clearLocal: () => calls.push("settings") } },
            { clearApiInfoDbAsync: resetAsync }, { clearCache: () => {} }, {},
            async () => calls.push("sync"),
            { resetBackpackAsync: async () => { calls.push("backpack"); await pending; } });

        const resetting = exports.resetAsync();
        await new Promise(resolve => setImmediate(resolve));
        assert.deepStrictEqual(calls, ["backpack"]);
        release();
        await resetting;
        assert.deepStrictEqual(calls, ["backpack", "settings", "sync"]);
    });
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
                new Function("exports", "pxt", "cmds", "workspace", "simulator", code)(exports,
                    { BrowserUtils: { changeHash: () => {} } },
                    { disconnectAsync: () => Promise.resolve() },
                    { syncAsync: () => Promise.resolve() },
                    { closeSimxProject: () => {}, setFullscreen: () => {} });
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
