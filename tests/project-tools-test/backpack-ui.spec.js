"use strict";
/* global pxt */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const less = require("less");
const { launchTestBrowser } = require("./browser");

// No build output or ProjectTools integration: exercise today's source with
// real React 17, Fuse and shared controls. Native asset editing and project/storage
// behavior belong to their own suites; this harness covers the panel lifecycle.
describe("project backpack UI", function () {
    this.timeout(30000);
    let browser;
    let page;
    let css;
    let controls;
    let pageErrors;
    const root = path.resolve(__dirname, "../..");
    const source = file => ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React }
    }).outputText;
    // Resolve the real control dependency graph, including directory barrels, in
    // memory. No compiled output, synthetic modal, or substitute focus behavior.
    const controlBundle = () => {
        const modules = new Map();
        const visit = file => {
            if (modules.has(file)) return;
            const code = source(file);
            const imports = {};
            modules.set(file, { code, imports });
            for (const [, id] of code.matchAll(/require\("([^"]+)"\)/g)) {
                if (!id.startsWith(".")) {
                    assert.ok(["react", "react-dom"].includes(id), `Unexpected control import ${id}`);
                    continue;
                }
                const base = path.posix.join(path.posix.dirname(file), id);
                const dependency = [".ts", ".tsx", "/index.ts", "/index.tsx"]
                    .map(extension => base + extension).find(candidate => fs.existsSync(path.join(root, candidate)));
                assert.ok(dependency, `Cannot resolve ${id} from ${file}`);
                imports[id] = dependency;
                visit(dependency);
            }
        };
        const entries = ["react-common/components/controls/Modal.tsx", "react-common/components/controls/Input.tsx"];
        entries.forEach(visit);
        return `(function() {
            const modules = {${Array.from(modules, ([file, { code, imports }]) =>
                `${JSON.stringify(file)}: [function(require, exports, module) {\n${code}\n}, ${JSON.stringify(imports)}]`).join(",\n")}};
            const cache = { react: { exports: window.React }, "react-dom": { exports: window.ReactDOM } };
            function load(id) {
                if (cache[id]) return cache[id].exports;
                const [factory, imports] = modules[id];
                const module = cache[id] = { exports: {} };
                factory(name => load(imports[name] || name), module.exports, module);
                return module.exports;
            }
            window.backpackControls = Object.assign({}, ...${JSON.stringify(entries)}.map(load));
        })();`;
    };
    const item = (name = "Jump", id = "00000000-0000-0000-0000-000000000001") => ({
        id, name, kind: "code", versions: { target: "1.2.3", pxt: "4.5.6" },
        code: JSON.stringify({ blocks: [{ type: "pxt-on-start" }] }), blockText: "", createdAt: 1, dependencies: {}
    });
    const asset = (type, index) => ({ ...item(type, `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`),
        kind: "asset", code: JSON.stringify({ blocks: [{ type, fields: { ASSET: "pixels" } }] }) });
    const assetPreviewURI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
    const assetPreview = ".project-backpack__preview--asset";
    const add = ".project-backpack__add";
    const rename = ".project-backpack__rename";
    const assetModal = ".project-backpack__asset-modal";
    const body = ".project-backpack__body";
    const searchBox = "#project-backpack-search";
    const visibleNames = () => page.$$eval(".project-backpack__name", headings => headings.map(heading => heading.textContent));
    const text = () => page.$eval("#root", element => element.textContent);
    const idle = async () => {
        await page.waitForFunction(() => {
            return document.querySelector(".project-backpack__body")?.getAttribute("aria-busy") === "false";
        });
    };
    const modalClosed = async () => {
        await page.waitForFunction(() => !document.querySelector(".project-backpack__asset-modal")
            && !document.getElementById("root").hasAttribute("aria-hidden") && !backpackTest.modalOpen);
    };
    const reopen = async () => {
        await page.evaluate(() => backpackTest.setActive(false));
        await page.evaluate(() => backpackTest.setActive(true));
    };
    const returnToTab = async () => {
        const other = await browser.newPage();
        try {
            await other.bringToFront();
            await page.waitForFunction(() => document.hidden, { polling: 50 });
            await page.bringToFront();
            await page.waitForFunction(() => !document.hidden);
        } finally { await other.close(); }
    };
    const signIn = async (items = []) => {
        await page.evaluate(items => {
            backpackTest.remote.A = items;
            backpackTest.account("A");
        }, items);
        await idle();
    };

    before(async () => {
        controls = controlBundle();
        css = (await less.render(`
            @modalDimmerZIndex: 1000; @modalFullscreenZIndex: 1001;
            @blocklyWidgetDivZIndex: 1002;
            @tabletAndBelow: ~"only screen and (max-width: 991px)";
            @modalSeparatorBorder: 1px solid #ccc; @pageFont: sans-serif; @textColor: #000;
            @buttonFocusOutlineLightBackground: 2px solid #000;
            @buttonFocusOutlineDarkBackground: 2px solid #fff;
            @highContrastBackgroundColor: #000; @highContrastTextColor: #fff;
            @highContrastFocusOutline: 2px solid #fff; @highContrastFocusZIndex: 1002; @highContrastHighlightColor: #ff0;
            ${["theme/project-backpack.less", "react-common/styles/controls/Button.less", "react-common/styles/controls/Input.less", "react-common/styles/controls/Modal.less"]
                .map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n")}`)).css;
        browser = await launchTestBrowser();
    });
    after(async () => { await browser?.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.setViewport({ width: 390, height: 700 });
        await page.setContent('<div id="root"></div><button id="outside">Outside</button>');
        await page.addStyleTag({ content: `
            * { box-sizing: border-box; }
            :root { --pxt-neutral-alpha50: rgba(0, 0, 0, .5);
                --pxt-neutral-background1: white; --pxt-neutral-foreground1: black;
                --pxt-neutral-background2: #eee; --pxt-neutral-foreground2: black;
                --pxt-neutral-background3: #ddd; --pxt-neutral-foreground3: #666;
                --pxt-focus-border: black; }
            #root { width: 320px; height: 500px; }
            section { height: 100%; --tools-surface: Canvas; --tools-foreground: CanvasText;
                --tools-border: GrayText; --tools-accent: Highlight; --tools-on-accent: HighlightText;
                --tools-surface-hover: Canvas; --tools-foreground-hover: CanvasText; }
            header { display: flex; align-items: center; justify-content: space-between; }
            ${css}` });
        await page.addScriptTag({ path: require.resolve("react/umd/react.development.js") });
        await page.addScriptTag({ path: require.resolve("react-dom/umd/react-dom.development.js") });
        await page.addScriptTag({ path: require.resolve("fuse.js") });
        await page.evaluate(assetPreviewURI => {
            window.lf = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]);
            window.pxt = {
                BLOCKS_PROJECT_NAME: "blocksprj",
                shell: { isReadOnly: () => false },
                appTarget: { appTheme: { backpack: true }, bundledpkgs: { core: {} } },
                Util: { jsonTryParse: text => { try { return JSON.parse(text); } catch { return undefined; } } }
            };
            const subscribers = new Set();
            const listeners = new Set();
            const test = window.backpackTest = {
                user: undefined, remote: {}, snapshots: {},
                refreshes: 0, adds: [], assetSaves: [], failAdd: false,
                modalOpen: false, collapses: 0,
                assetPreviewURI, assetPreviewLoads: 0,
                assetContext: { blocksInfo: {}, gallery: {}, palette: ["#000000"] },
                modalChanged(open) { test.modalOpen = open; },
                header: { id: "project" },
                account(user) {
                    test.user = user;
                    test.complete = undefined;
                    for (const subscriber of subscribers) subscriber.onDataChanged("auth:profile");
                },
                notify() { for (const listener of listeners) listener(); },
                hold() { test.gate = new Promise(resolve => { test.release = resolve; }); },
                storeKey: () => test.user || "__guest__",
                subscriberCount: () => subscribers.size,
                listenerCount: () => listeners.size
            };
            const auth = {
                USER_PROFILE: "auth:profile", LOGGED_IN: "auth:logged-in",
                loggedIn: () => !!test.user, userProfile: () => test.user ? { id: test.user } : undefined,
                hasIdentity: () => true
            };
            pxt.auth = auth;
            const data = {
                subscribe(subscriber, path) { subscribers.add(subscriber); subscriber.subscriptions.push(path); },
                unsubscribe(subscriber) { subscribers.delete(subscriber); subscriber.subscriptions = []; }
            };
            test.pkg = {
                mainEditorPkg: () => ({ header: test.header }),
                mainPkg: { deps: {}, getPreferredEditor: () => "blocksprj" }
            };
            const backpack = {
                isBackpackEnabled: () => window.backpackValidation.isBackpackEnabled(),
                backpackEntryKey: entry => JSON.stringify([entry.source, entry.id]),
                getBackpackState: () => ({
                    entries: (test.snapshots[test.storeKey()] || []).map(item => {
                        const validated = window.backpackValidation.readBackpackEntry(item.id, item, test.user ? "cloud" : "local");
                        if (!test.user || validated.error) return validated;
                        // Supply summary fields directly; indexing matrices belong to search tests.
                        return window.backpackValidation.readBackpackSummary({ id: item.id, name: item.name, kind: item.kind, versions: item.versions,
                            createdAt: item.createdAt, updatedAt: item.createdAt, version: '"v1"', status: "ready", hasPreview: false,
                            blockTypes: JSON.parse(item.code).blocks.map(block => block.type), blockText: item.blockText,
                            dependencies: item.dependencies });
                    }),
                    complete: test.complete
                }),
                subscribeBackpack(listener) { listeners.add(listener); return () => listeners.delete(listener); },
                notifyBackpackEditorChanged: () => test.notify(),
                canImportBackpack: () => true,
                canEditBackpackAsset: () => true,
                async refreshBackpackAsync() {
                    const user = test.storeKey();
                    ++test.refreshes;
                    await test.gate;
                    test.snapshots[user] = JSON.parse(JSON.stringify(test.remote[user] || []));
                    test.complete = true;
                    test.notify();
                },
                async importBackpackEntryAsync(entry, headerId) {
                    const item = entry.item || (test.snapshots[test.storeKey()] || []).find(item => item.id === entry.id);
                    const fail = test.failAdd;
                    test.adds.push({ item, headerId });
                    await test.gate;
                    if (fail) throw new Error("Import failed. Try again.");
                    return true;
                },
                async loadBackpackAssetAsync(entry) {
                    await test.assetLoadGate;
                    return JSON.parse(JSON.stringify((test.snapshots[test.storeKey()] || []).find(item => item.id === entry.id)));
                },
                async loadBackpackAssetPreviewAsync(entry) {
                    ++test.assetPreviewLoads;
                    return entry.item || (test.snapshots[test.storeKey()] || []).find(item => item.id === entry.id);
                },
                getBackpackAssetPreviewContext: () => test.assetContext,
                getBackpackAssetEditorContextAsync: async () => test.assetContext,
                async saveBackpackAssetAsync(entry, item) {
                    test.assetSaves.push({ id: entry.id, item });
                    test.remote[test.storeKey()] = test.snapshots[test.storeKey()] = test.remote[test.storeKey()].map(saved => saved.id === item.id ? item : saved);
                    test.notify();
                }
            };
            window.require = id => {
                const modules = { react: React, "fuse.js": window.Fuse, "../auth": auth, "../data": data,
                    "../backpack": backpack, "../backpackSearch": window.backpackSearch, "../package": test.pkg };
                modules["./BackpackPreview"] = window.backpackPreviewUI;
                // Native rendering is exercised with real fields in backpack-asset-edit.
                modules["../backpackAssetPreview"] = { backpackAssetPreview: item => ({
                    previewURI: test.assetPreviewURI + "#" + encodeURIComponent(item.code),
                    framePreviewURIs: test.previewFrames
                }) };
                // Native editor behavior lives in backpack-asset-edit; keep the real portal/focus controls here.
                modules["./BackpackAssetEditDialog"] = { BackpackAssetEditDialog: props => {
                    const [code, setCode] = React.useState(props.item.code);
                    return React.createElement(window.backpackControls.Modal, {
                        title: "Edit Backpack asset", className: "project-backpack__asset-modal", fullscreen: true, onClose: props.onClose,
                        actions: [{ label: "Cancel", onClick: props.onClose },
                            { label: "Save", onClick: () => props.onSave({ ...props.item, code }) }]
                    }, React.createElement("input", { "aria-label": "Asset field", value: code, onChange: event => setCode(event.target.value) }));
                } };
                modules["../../../react-common/components/controls/Modal"] = window.backpackControls;
                modules["../../../react-common/components/controls/Input"] = window.backpackControls;
                if (!(id in modules)) throw new Error(`Unexpected import ${id}`);
                return modules[id];
            };
        }, assetPreviewURI);
        await page.addScriptTag({ content: controls });
        // Reuse the actual storage validator without exercising network/auth storage.
        await page.addScriptTag({ content: `(function(exports) { ${source("webapp/src/backpack.ts")}\n})(window.backpackValidation = {});` });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/backpackSearch.ts")}\n})(window.require, window.backpackSearch = {});` });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/components/BackpackPreview.tsx")}\n})(window.require, window.backpackPreviewUI = {});` });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/components/ProjectBackpack.tsx")}\n})(window.require, window.backpackUI = {});` });
        await page.evaluate(() => {
            function Harness() {
                const [active, setActive] = React.useState(true);
                const [, rerender] = React.useReducer(value => value + 1, 0);
                backpackTest.setActive = setActive;
                backpackTest.rerender = rerender;
                return React.createElement("section", {
                    className: "project-backpack", hidden: !active,
                    onBlurCapture: event => {
                        const root = event.currentTarget;
                        const dismiss = target => {
                            if (!root.contains(target) && !backpackTest.modalOpen) {
                                ++backpackTest.collapses;
                                setActive(false);
                            }
                        };
                        if (event.relatedTarget) dismiss(event.relatedTarget);
                        else if (backpackTest.dismissNullBlur) requestAnimationFrame(() => dismiss(document.activeElement));
                    }
                }, React.createElement(backpackUI.ProjectBackpack, {
                    headerId: backpackTest.header.id, active,
                    tutorial: backpackTest.tutorial,
                    renderHeader: (title, actions) => React.createElement("header", null, React.createElement("h2", null, title), actions),
                    onSignIn: () => {},
                    onModalOpenChange: backpackTest.modalChanged
                }));
            }
            ReactDOM.render(React.createElement(Harness), document.getElementById("root"));
        });
        await idle();
    });
    afterEach(async () => {
        if (!page || page.isClosed()) return;
        try {
            await page.evaluate(() => ReactDOM.unmountComponentAtNode(document.getElementById("root")));
            // React subscription cleanup runs in a passive effect after unmount.
            await page.waitForFunction(() => backpackTest.subscriberCount() === 0 && backpackTest.listenerCount() === 0);
            assert.deepStrictEqual(await page.evaluate(() => [backpackTest.subscriberCount(), backpackTest.listenerCount()]), [0, 0]);
            assert.deepStrictEqual(pageErrors, [], "Unexpected browser error or unhandled rejection");
        } finally { await page.close(); }
    });

    it("defaults tutorials to usable assets and shows only an unavailable message on Code", async () => {
        const saved = asset("image_picker", 2);
        await signIn([item(), saved]);
        await page.evaluate(() => {
            backpackTest.tutorial = true;
            backpackTest.rerender();
        });
        await idle();
        assert.equal(await page.$eval("#project-backpack-tab-asset", tab => tab.getAttribute("aria-selected")), "true");
        assert.deepStrictEqual(await visibleNames(), [saved.name]);
        await page.click(add);
        await idle();
        await page.click(rename);
        await page.waitForSelector(`${assetModal} input`);
        await page.click(`${assetModal} .common-modal-footer button:last-child`);
        await modalClosed();
        await page.click("#project-backpack-tab-code");
        assert.match(await text(), /Code snippets aren't available during tutorials/);
        assert.deepStrictEqual(await visibleNames(), []);
        assert.equal(await page.$(add), null);
        assert.equal(await page.$(searchBox), null);
        await page.keyboard.press("ArrowRight");
        assert.deepStrictEqual(await visibleNames(), [saved.name]);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds.map(add => add.item.id)), [saved.id]);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.assetSaves), [{ id: saved.id, item: saved }]);
    });

    it("keeps unchanged card nodes and preview URLs through reopen while updating changed metadata inline", async () => {
        const saved = asset("image_picker", 2), removed = asset("image_picker", 3);
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
        await page.evaluate(() => { backpackTest.previewFrames = [backpackTest.assetPreviewURI + "#frame1", backpackTest.assetPreviewURI + "#frame2"]; });
        await signIn([saved, removed]);
        await page.click("#project-backpack-tab-asset");
        await page.waitForSelector(assetPreview);
        await page.evaluate(() => {
            const set = window.setInterval, clear = window.clearInterval;
            backpackTest.timers = new Set();
            window.setInterval = (...args) => { const id = set(...args); backpackTest.timers.add(id); return id; };
            window.clearInterval = id => { backpackTest.timers.delete(id); clear(id); };
            backpackTest.motionChanges = 0;
            matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => ++backpackTest.motionChanges);
        });
        await page.$eval(assetPreview, image => image.dispatchEvent(new MouseEvent("mouseenter")));
        assert.equal(await page.evaluate(() => backpackTest.timers.size), 0);
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
        await page.waitForFunction(() => backpackTest.motionChanges === 1);
        await page.$eval(assetPreview, image => image.dispatchEvent(new MouseEvent("mouseenter")));
        assert.equal(await page.evaluate(() => backpackTest.timers.size), 1);
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
        await page.waitForFunction(() => backpackTest.motionChanges === 2);
        assert.equal(await page.evaluate(() => backpackTest.timers.size), 0);
        await page.evaluate(id => {
            const row = document.querySelector(`[data-backpack-id="${id}"]`);
            backpackTest.previousRow = row;
            backpackTest.previousImage = row.querySelector("img");
            backpackTest.previousURI = row.querySelector("img").src;
            backpackTest.previousRefreshes = backpackTest.refreshes;
            backpackTest.hold();
        }, saved.id);
        const added = asset("animation_editor", 4);
        await page.evaluate(({ saved, added }) => { backpackTest.remote.A = [{ ...saved, name: "New name" }, added]; }, { saved, added });
        await reopen();
        assert.doesNotMatch(await text(), /Loading backpack/);
        assert.deepStrictEqual(await visibleNames(), [saved.name, removed.name]);
        assert.equal(await page.evaluate(() => backpackTest.assetPreviewLoads), 2);
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.deepStrictEqual(await visibleNames(), ["New name", added.name]);
        assert.deepStrictEqual(await page.evaluate(id => {
            const row = document.querySelector(`[data-backpack-id="${id}"]`);
            return [row === backpackTest.previousRow, row.querySelector("img") === backpackTest.previousImage,
                row.querySelector("img").src === backpackTest.previousURI, backpackTest.refreshes === backpackTest.previousRefreshes + 1];
        }, saved.id), [true, true, true, true]);
    });

    it("hides cached cards until fresh metadata arrives on tab return", async () => {
        await signIn([item()]);
        await page.focus("#project-backpack-tab-code");
        const before = await page.evaluate(saved => {
            backpackTest.dismissNullBlur = true;
            backpackTest.remote.A = [saved];
            backpackTest.hold();
            return backpackTest.refreshes;
        }, item("Other device"));
        await returnToTab();
        await page.waitForFunction(count => backpackTest.refreshes === count + 1, {}, before);
        assert.match(await text(), /Loading backpack/);
        assert.deepStrictEqual(await visibleNames(), []);
        assert.equal(await page.evaluate(() => backpackTest.collapses), 0);
        assert.equal(await page.$eval(body, element => element === document.activeElement), true);
        await page.evaluate(() => backpackTest.notify());
        assert.deepStrictEqual(await visibleNames(), [], "Subscriptions must not restore an unacknowledged list");
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.deepStrictEqual(await visibleNames(), ["Other device"]);
        assert.equal(await page.evaluate(() => backpackTest.refreshes), before + 1, "Focus and visibility return share one refresh");
    });

    it("requires fresh metadata for a new project before importing into that project", async () => {
        await signIn([item()]);
        await page.evaluate(() => {
            backpackTest.hold();
            backpackTest.header = { id: "another-project" };
            backpackTest.rerender();
        });
        assert.match(await text(), /Loading backpack/);
        assert.deepStrictEqual(await visibleNames(), []);
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.deepStrictEqual(await visibleNames(), ["Jump"]);
        await page.click(add);
        await idle();
        assert.equal(await page.evaluate(() => backpackTest.adds[0].headerId), "another-project");
    });

    it("guards cloud-edit blur, keeps the draft on tab return, and refreshes after close", async () => {
        const saved = asset("image_picker", 2);
        await signIn([saved]);
        await page.click("#project-backpack-tab-asset");
        await page.evaluate(() => {
            backpackTest.dismissNullBlur = true;
            backpackTest.assetLoadGate = new Promise(resolve => { backpackTest.finishAssetLoad = resolve; });
        });
        await page.focus(rename);
        await page.click(rename);
        await page.waitForFunction(() => document.querySelector(".project-backpack__rename").disabled);
        // Edge blurs a focused button when React disables it. Reproduce that
        // event on older Chromium so the parent's deferred blur guard is tested.
        await page.$eval(rename, button => button.blur());
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.modalOpen, backpackTest.collapses]), [true, 0]);
        assert.equal(await page.$(assetModal), null, "The cloud read is still pending");
        await page.evaluate(() => backpackTest.finishAssetLoad());
        await page.waitForSelector(`${assetModal} input`);
        await page.$eval(`${assetModal} input`, input => { input.focus(); input.select(); });
        await page.keyboard.type("unsaved asset draft");
        const before = await page.evaluate(() => { backpackTest.hold(); return backpackTest.refreshes; });
        await returnToTab();
        assert.equal(await page.$eval(`${assetModal} input`, input => input.value), "unsaved asset draft");
        assert.equal(await page.evaluate(() => backpackTest.refreshes), before);
        await page.click(`${assetModal} .common-modal-footer button:first-child`);
        await page.waitForFunction(count => backpackTest.refreshes === count + 1, {}, before);
        assert.match(await text(), /Loading backpack/);
        assert.deepStrictEqual(await visibleNames(), []);
        await modalClosed();
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.deepStrictEqual(await visibleNames(), ["image_picker"]);
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.assetSaves, backpackTest.remote.A]), [[], [saved]]);
        await page.focus(searchBox);
        await page.click("#outside");
        assert.equal(await page.$eval("section", section => section.hidden), true, "Closing the dialog releases the blur guard");
    });

    it("resets pending imports on A-to-B account change and ignores A's late failure", async () => {
        await signIn([item("Old contents")]);
        await page.evaluate(() => { backpackTest.failAdd = true; backpackTest.hold(); });
        await page.click(add);
        assert.strictEqual(await page.$eval(add, button => button.disabled), true);
        await page.evaluate(snippet => {
            backpackTest.gate = undefined;
            backpackTest.failAdd = false;
            backpackTest.remote.B = [snippet];
            backpackTest.account("B");
        }, item("New contents"));
        assert.doesNotMatch(await text(), /Old contents/);
        await idle();
        assert.deepStrictEqual(await visibleNames(), ["New contents"]);
        assert.strictEqual(await page.$eval(add, button => button.disabled), false);
        // B remains usable without waiting for A's operation.
        await page.click(add);
        await idle();
        await page.evaluate(() => backpackTest.release());
        assert.strictEqual(await page.$('[role="alert"]'), null);
        assert.strictEqual(await page.$eval(add, button => button.disabled), false);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds.map(add => add.item.name)), ["Old contents", "New contents"]);
    });
});