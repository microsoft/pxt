"use strict";

const assert = require("assert");
const fs = require("fs");
const ts = require("typescript");

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
