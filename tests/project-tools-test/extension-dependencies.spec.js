"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { source, bundleSource } = require("./source");
const { launchTestBrowser } = require("./browser");

const pxtlib = path.resolve(__dirname, "../../built/pxtlib.js");

describe("Gallery dependency lookup", () => {
    const exports = {};
    const context = vm.createContext({ console, exports });
    vm.runInContext(fs.readFileSync(pxtlib, "utf8"), context);
    context.pxt.appTarget = { appTheme: {}, cloud: { sharing: true }, bundledpkgs: {} };
    vm.runInContext(source("webapp/src/extensionDependencies.ts"), context);
    const { InstalledExtensions } = exports;

    function lookup(direct, packages) {
        const main = new context.pxt.MainPackage(undefined);
        main.config = { dependencies: Object.fromEntries(direct.map(name => [name, "*"])) };
        for (const [name, { version = `embed:${name}`, displayName, children = [], cppOnly }] of Object.entries(packages)) {
            const dep = new context.pxt.Package(name, version, main, main, name);
            dep.config = { name, displayName, dependencies: Object.fromEntries(children.map(child => [child, "*"])) };
            dep.cppOnly = cppOnly;
            main.deps[name] = dep;
        }
        return new InstalledExtensions(main);
    }

    it("lists all direct roots through shared and cyclic paths without including unavailable packages", () => {
        const installed = lookup(["builder", "structures", "library"], {
            builder: { displayName: "Builder", children: ["structures", "shapes"] },
            structures: { displayName: "Structures", children: ["shapes", "absent", "broken", "native"] },
            library: {},
            shapes: { children: ["builder"] },
            broken: { version: "invalid:unavailable" },
            native: { cppOnly: true },
            orphan: {}
        });
        const bundled = name => installed.find({ pkgConfig: { name } });

        assert.deepEqual(Array.from(installed.directDependencies, dep => dep.name), ["builder", "structures", "library"]);
        assert.equal(bundled("shapes").direct, false);
        assert.deepEqual(Array.from(bundled("shapes").requiredBy), ["Builder", "Structures"]);
        assert.equal(bundled("builder").direct, true);
        assert.deepEqual(Array.from(bundled("builder").requiredBy), ["Structures"]);
        assert.equal(bundled("library").requiredBy.length, 0);
        for (const name of ["broken", "absent", "native", "orphan"]) {
            assert.equal(bundled(name), undefined);
        }
    });

    it("distinguishes bundled, GitHub monorepo, share, and local cards by source", () => {
        const scriptId = "_ABCD12345678";
        const installed = lookup(["parent"], {
            parent: { children: ["first", "shapes", "local-copy"] },
            first: { version: "github:org/repo/libs/first#v1.0.0" },
            shapes: { version: `makecode.com/${scriptId}` },
            "local-copy": { version: "workspace:project-id" }
        });

        const github = installed.find({ fullRepo: "ORG/repo/libs/first#v2.0.0" });
        assert.equal(github.name, "first");
        assert.equal(github.direct, false);
        assert.equal(installed.find({ fullRepo: "org/repo/libs/second" }), undefined);
        assert.equal(installed.find({ fullRepo: "org/repo" }), undefined);
        assert.equal(installed.find({ fullRepo: "org/parent" }), undefined);
        assert.equal(installed.find({ pkgConfig: { name: "shapes" } }), undefined);
        assert.equal(installed.find({ scriptInfo: { id: scriptId } }).name, "shapes");
        assert.equal(installed.find({ scriptInfo: { id: "_WXYZ12345678" } }), undefined);
        assert.equal(installed.find({ workspaceId: "project-id" }).name, "local-copy");
    });
});

describe("Extensions gallery cards", function () {
    this.timeout(30000);

    it("keeps indirect installs in order and explains why a search-only dependency is installed", async () => {
        const bundle = bundleSource(["webapp/src/extensionsBrowser.tsx"], "extensionTest", {
            react: "window.React",
            "react-dom": "window.ReactDOM",
            "webapp/src/package": "window.galleryPackage",
            "webapp/src/workspace": "{ getHeaders: () => [] }",
            "webapp/src/data": "{ getAsync: async key => key === 'target-config:' ? window.galleryConfig : [] }",
            "webapp/src/core": "{ dialogAsync: async options => { window.galleryDialog = options; }, handleNetworkError: error => { throw error; } }",
        });
        const browser = await launchTestBrowser();
        try {
            const page = await browser.newPage();
            await page.setContent('<div id="root"></div>');
            await page.addScriptTag({ path: require.resolve("react/umd/react.development.js") });
            await page.addScriptTag({ path: require.resolve("react-dom/umd/react-dom.development.js") });
            await page.addScriptTag({ path: pxtlib });
            await page.evaluate(() => {
                window.lf = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]);
                pxtc.service = { ExtensionType: { Bundled: 1, Github: 2, ShareScript: 3 } };
                pxt.appTarget = { appTheme: {}, cloud: {}, bundledpkgs: {} };
                pxt.packagesConfigAsync = async () => ({});
                window.galleryConfig = { packages: { builtinExtensionsLib: { shapes: { preferred: true, tags: ["Library"] } } } };

                const mainPkg = new pxt.MainPackage(undefined);
                mainPkg.config = { dependencies: { builder: "*", toolbox: "*" } };
                mainPkg.isPackageInUse = () => false;
                for (const config of [
                    { name: "available", weight: 100 },
                    { name: "builder", displayName: "Builder", searchOnly: true, dependencies: { helper: "*", shapes: "*" } },
                    { name: "helper" },
                    { name: "shapes", searchOnly: true },
                    { name: "toolbox", weight: 0 }
                ]) {
                    pxt.appTarget.bundledpkgs[config.name] = { "pxt.json": JSON.stringify(config) };
                    const dep = new pxt.Package(config.name, `embed:${config.name}`, mainPkg, mainPkg, config.name);
                    dep.config = config;
                    mainPkg.deps[config.name] = dep;
                }
                window.galleryPackage = { mainPkg };
            });
            await page.addScriptTag({ content: bundle });
            await page.evaluate(() => ReactDOM.render(
                React.createElement(extensionTest.ExtensionsBrowser, {
                    header: { id: "project" },
                    saveProjectAsync: async () => { window.gallerySaved = true; },
                    hasBlocksFromExtensionAsync: async () => false
                }),
                document.getElementById("root")
            ));

            const titles = ".common-extension-card-title";
            await page.waitForSelector(titles);
            assert.deepEqual(await page.$$eval(titles, els => els.map(el => el.textContent)), ["toolbox", "available", "helper"]);
            assert.equal(await page.$eval(`${titles}[title="helper"]`, el => el.closest(".common-extension-card").classList.contains("installed")), true);

            const search = 'input[placeholder="Search or enter project URL..."]';
            await page.type(search, "shapes");
            await page.keyboard.press("Enter");
            const action = await page.waitForSelector('[aria-labelledby="extensions-search-results"] .common-extension-card.installed .common-card-action');
            assert.equal(await action.evaluate(el => document.getElementById(el.getAttribute("aria-labelledby")).textContent), "shapes");
            assert.ok(await action.evaluate(el => el.getAttribute("aria-describedby").split(" ")
                .some(id => document.getElementById(id)?.textContent === "Installed")));
            await action.press("Enter");
            const dialog = await page.waitForFunction(() => window.galleryDialog);
            assert.deepEqual(await dialog.evaluate(options => ({
                message: options.jsx.props.children, closeLabel: options.disagreeLbl, buttons: options.buttons || []
            })), {
                message: "This extension is installed because Builder needs it. You can't remove it on its own.",
                closeLabel: "Close",
                buttons: []
            });
            assert.equal(await page.evaluate(() => window.gallerySaved), undefined);

            await page.click("#extensions-category-Library");
            assert.deepEqual(await page.$$eval(titles, els => els.map(el => el.textContent)), []);

            await page.evaluate(() => { window.galleryDialog = undefined; });
            await page.click("#extensions-recommended");
            const direct = await page.$(".common-extension-card.installed .common-card-action");
            await direct.press("Enter");
            await page.waitForFunction(() => window.galleryDialog?.buttons?.some(button => button.label === "Remove extension" && !button.disabled));
            assert.equal(await page.evaluate(() => window.gallerySaved), true);
        }
        finally {
            await browser.close();
        }
    });
});
