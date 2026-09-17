"use strict";
/* global pxt */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const less = require("less");
const rtlcss = require("rtlcss");
const { launchTestBrowser } = require("./browser");

// No build output or ProjectTools integration: exercise today's source with
// real React 17 and Fuse, the shared portal/FocusTrap/Input/Button sources, and their Less.
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
        kind: "asset", code: JSON.stringify({ blocks: [{ type }] }) });
    const assetPreviewURI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
    const assetPreview = ".project-backpack__preview--asset";
    const controlIntersections = () => page.evaluate(() => {
        const observers = new Set();
        window.IntersectionObserver = class {
            constructor(callback) { this.callback = callback; }
            observe() { observers.add(this); }
            disconnect() { observers.delete(this); }
        };
        backpackTest.intersect = isIntersecting => {
            for (const observer of Array.from(observers)) observer.callback([{ isIntersecting }]);
        };
        backpackTest.observerCount = () => observers.size;
    });
    const entry = ".project-backpack__item";
    const add = ".project-backpack__add";
    const rename = ".project-backpack__rename";
    const renameModal = ".project-backpack__rename-modal";
    const nameInput = "#project-backpack-name";
    const saveName = `${renameModal} .common-modal-footer button:last-child`;
    const cancelName = `${renameModal} .common-modal-footer button:first-child`;
    const closeName = `${renameModal} .common-modal-close button`;
    const assetModal = ".project-backpack__asset-modal";
    const remove = ".project-backpack__delete";
    const confirm = ".project-backpack__delete-modal";
    const dialog = `${confirm} [role="dialog"]`;
    const confirmDelete = `${confirm} .common-modal-footer button:last-child`;
    const cancel = `${confirm} .common-modal-footer button:first-child`;
    const close = `${confirm} .common-modal-close button`;
    const body = ".project-backpack__body";
    const retry = ".project-backpack__retry";
    const signInPrompt = ".project-backpack__sign-in";
    const searchBox = "#project-backpack-search";
    const clearSearch = '.project-backpack__search button[aria-label="Clear backpack search"]';
    const searchFor = async query => {
        await page.click(searchBox);
        await page.keyboard.down("Control");
        await page.keyboard.press("KeyA");
        await page.keyboard.up("Control");
        await page.keyboard.press("Backspace");
        if (query) await page.keyboard.type(query);
    };
    const visibleNames = () => page.$$eval(".project-backpack__name", headings => headings.map(heading => heading.textContent));
    const text = () => page.$eval("#root", element => element.textContent);
    const modalText = () => page.$eval(dialog, element => element.innerText);
    const idle = async () => {
        await page.waitForFunction(() => {
            return document.querySelector(".project-backpack__body")?.getAttribute("aria-busy") === "false";
        });
    };
    const modalClosed = async () => {
        // Portal removal is synchronous; shared Modal's aria-hidden restoration
        // and the owner's false notification are passive-effect cleanups.
        await page.waitForFunction(() => !document.querySelector(".project-backpack__delete-modal, .project-backpack__rename-modal, .project-backpack__asset-modal")
            && !document.getElementById("root").hasAttribute("aria-hidden") && !backpackTest.modalOpen);
        assert.strictEqual(await page.$(confirm), null);
        assert.strictEqual(await page.$(renameModal), null);
        assert.deepStrictEqual(await page.evaluate(() => ({
            hidden: document.getElementById("root").getAttribute("aria-hidden"),
            outsideHidden: document.getElementById("outside").getAttribute("aria-hidden"),
            modalOpen: backpackTest.modalOpen,
            lastEvent: backpackTest.modalEvents.filter(event => event.type === "change").slice(-1)[0],
            escapes: backpackTest.escapes, collapses: backpackTest.collapses
        })), { hidden: null, outsideHidden: null, modalOpen: false,
            lastEvent: { type: "change", open: false }, escapes: 0, collapses: 0 });
    };
    const reopen = async () => {
        await page.evaluate(() => backpackTest.setActive(false));
        await page.evaluate(() => backpackTest.setActive(true));
    };
    const signIn = async (items = []) => {
        await page.evaluate(items => {
            backpackTest.remote.A = items;
            backpackTest.account("A");
        }, items);
        await idle();
    };
    const loadGuest = async (items = []) => {
        await page.evaluate(items => { backpackTest.remote.__guest__ = items; }, items);
        await reopen();
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
                shell: { isReadOnly: () => backpackTest.readOnly },
                appTarget: { appTheme: { backpack: true }, bundledpkgs: { core: {} } },
                Util: { jsonTryParse: text => { try { return JSON.parse(text); } catch { return undefined; } } },
                github: { parseRepoId: version => ({ owner: version.split(":")[1].split("/")[0], project: version.split("/")[1] }) }
            };
            const subscribers = new Set();
            const listeners = new Set();
            const test = window.backpackTest = {
                user: undefined, identity: true, remote: {}, snapshots: {},
                recovery: [], deletedEntries: [], warning: undefined,
                refreshes: 0, adds: [], positions: [], deletes: [], renames: [], signIns: 0, escapes: 0,
                failRefresh: false, failDelete: false, failRename: false, failAdd: false, importResult: true,
                modalOpen: false, modalEvents: [], collapses: 0,
                assetPreviewURI, assetPreviewLoads: 0, assetPreviewRenders: [], previewHeaders: [], versions: {},
                previewContext: { blocksInfo: {}, gallery: {}, palette: ["#000000"] },
                modalChanged(open) {
                    test.modalOpen = open;
                    test.modalEvents.push({ type: "change", open });
                },
                canImport: true, readOnly: false, editor: "blocksprj",
                header: { id: "project" },
                canEdit: headerId => !!headerId && test.header?.id === headerId && !test.header.temporary
                    && !test.readOnly && !pxt.appTarget.appTheme.lockedEditor
                    && window.backpackValidation.isBackpackEnabled(),
                account(user) {
                    test.user = user;
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
                hasIdentity: () => test.identity
            };
            pxt.auth = auth;
            const data = {
                subscribe(subscriber, path) { subscribers.add(subscriber); subscriber.subscriptions.push(path); },
                unsubscribe(subscriber) { subscribers.delete(subscriber); subscriber.subscriptions = []; }
            };
            test.paths = () => Array.from(subscribers).flatMap(subscriber => subscriber.subscriptions);
            test.pkg = {
                mainEditorPkg: () => ({ header: test.header }),
                mainPkg: { deps: {}, getPreferredEditor: () => test.editor }
            };
            const backpack = {
                isBackpackEnabled: () => window.backpackValidation.isBackpackEnabled(),
                backpackEntryKey: entry => JSON.stringify([entry.source, entry.local?.namespace || "", entry.id]),
                get MAX_BACKPACK_NAME_LENGTH() { return window.backpackValidation.MAX_BACKPACK_NAME_LENGTH; },
                validateBackpackItem: value => window.backpackValidation.validateBackpackItem(value),
                getBackpackState: () => ({
                    entries: (test.snapshots[test.storeKey()] || []).map(item => {
                        const validated = window.backpackValidation.readBackpackEntry(item.id, item, test.user ? "cloud" : "local");
                        if (!test.user || validated.error) return validated;
                        // Supply summary fields directly; indexing matrices belong to search tests.
                        return window.backpackValidation.readBackpackSummary({ id: item.id, name: item.name, kind: item.kind, versions: item.versions,
                            createdAt: item.createdAt, updatedAt: item.createdAt, version: test.versions[item.id] || '"v1"', status: "ready",
                            hasPreview: !!item.previewUri, previewPixelDensity: item.previewPixelDensity,
                            blockTypes: JSON.parse(item.code).blocks.map(block => block.type), blockText: item.blockText, functionCount: test.functionCount,
                            dependencies: item.dependencies, projectBlocks: item.projectBlocks });
                    }).concat(test.recovery
                        .filter(entry => !!test.user || entry.source === "local")
                        .map(entry => window.backpackValidation.readBackpackEntry(entry.id, entry.value, entry.source))),
                    warning: test.warning, complete: test.complete
                }),
                subscribeBackpack(listener) { listeners.add(listener); return () => listeners.delete(listener); },
                notifyBackpackEditorChanged: () => test.notify(),
                canImportBackpack: (_headerId, kind = "code") => test.canImport
                    && (kind === "asset" || !test.tutorial && !test.header.tutorial),
                canEditBackpackAsset: headerId => test.canEdit(headerId),
                canDropBackpack: (headerId, target, kind = "code") => headerId === test.header.id && test.canImport
                    && (kind === "asset" || !test.tutorial && !test.header.tutorial)
                    && window.backpackCanDrop.call({ editor: { getSvgGroup: () => document.getElementById("workspace") } }, target),
                async getBackpackPreviewAsync(entry, signal) {
                    test.previewRequests = (test.previewRequests || 0) + 1;
                    const item = (test.snapshots[test.storeKey()] || []).find(item => item.id === entry.id);
                    const response = await fetch(item.previewUri, { signal });
                    return response.blob();
                },
                async refreshBackpackAsync() {
                    const user = test.storeKey();
                    const fail = test.failRefresh;
                    ++test.refreshes;
                    await test.gate;
                    if (fail) throw new Error("Sync failed. Try again.");
                    test.snapshots[user] = JSON.parse(JSON.stringify(test.remote[user] || []));
                    test.notify();
                },
                async importBackpackEntryAsync(entry, headerId, position) {
                    const item = entry.item || (test.snapshots[test.storeKey()] || []).find(item => item.id === entry.id);
                    const fail = test.failAdd;
                    const result = test.importResult;
                    test.adds.push({ item, headerId });
                    if (position) test.positions.push(position);
                    await test.gate;
                    if (fail) throw new Error("Import failed. Try again.");
                    return result;
                },
                async renameBackpackItemAsync(id, name) {
                    const user = test.storeKey();
                    const fail = test.failRename;
                    const item = test.remote[user].find(item => item.id === id);
                    const renamed = window.backpackValidation.validateBackpackItem({ ...item, name });
                    renamed.name = renamed.name.trim();
                    test.renames.push({ id, name });
                    await test.gate;
                    if (fail) throw new Error("Rename failed. Try again.");
                    test.remote[user] = test.remote[user].map(item => item.id === id ? renamed : item);
                    test.snapshots[user] = test.remote[user];
                    test.notify();
                },
                async loadBackpackAssetAsync(entry) {
                    test.observedAsset = entry;
                    await test.assetLoadGate;
                    if (test.failAssetLoad) throw new Error(test.failAssetLoad);
                    return JSON.parse(JSON.stringify((test.snapshots[test.storeKey()] || []).find(item => item.id === entry.id)));
                },
                async loadBackpackAssetPreviewAsync(entry) {
                    ++test.assetPreviewLoads;
                    const item = JSON.parse(JSON.stringify(entry.item || (test.snapshots[test.storeKey()] || []).find(item => item.id === entry.id)));
                    const fail = test.failAssetPreview;
                    await test.gate;
                    if (fail) throw new Error("Asset preview unavailable");
                    return item;
                },
                getBackpackAssetPreviewContext(headerId) { test.previewHeaders.push(headerId); return test.previewContext; },
                async getBackpackAssetEditorContextAsync(headerId) {
                    if (!test.canEdit(headerId)) throw new Error("Open an editable project outside a tutorial to edit this asset.");
                    test.contextHeader = headerId;
                    return test.assetContext = { blocksInfo: {}, gallery: {}, palette: ["#000000"] };
                },
                async saveBackpackAssetAsync(entry, item) {
                    test.assetSaves = (test.assetSaves || []).concat({ sameEntry: entry === test.observedAsset, item });
                    if (test.failAssetSave) throw new Error("Asset save failed");
                    test.remote[test.storeKey()] = test.snapshots[test.storeKey()] = test.remote[test.storeKey()].map(saved => saved.id === item.id ? item : saved);
                    if (test.user) test.versions[item.id] = '"v2"';
                    test.notify();
                },
                async deleteBackpackEntryAsync(entry) {
                    const { id, source } = entry;
                    const user = source === "local" ? "__guest__" : test.user;
                    const fail = test.failDelete;
                    test.deletes.push(id);
                    test.deletedEntries.push({ id, source });
                    await test.gate;
                    if (fail) throw new Error("Delete failed. Try again.");
                    test.remote[user] = (test.remote[user] || []).filter(item => item.id !== id);
                    test.recovery = test.recovery.filter(entry => entry.id !== id || entry.source !== source);
                    test.snapshots[user] = test.remote[user];
                    test.notify();
                }
            };
            window.require = id => {
                const modules = { react: React, "fuse.js": window.Fuse, "../auth": auth, "../data": data,
                    "../backpack": backpack, "../backpackSearch": window.backpackSearch, "../package": test.pkg };
                modules["./BackpackPreview"] = window.backpackPreviewUI;
                // Native rendering is exercised with real fields in backpack-asset-edit.
                modules["../backpackAssetPreview"] = { backpackAssetPreview: (item, context) => {
                    test.assetPreviewRenders.push({ item: JSON.parse(JSON.stringify(item)), sameContext: context === test.previewContext });
                    return test.previewResult === null ? undefined : test.previewResult
                        || { previewURI: test.assetPreviewURI + "#" + encodeURIComponent(item.code) };
                } };
                // Native editor behavior lives in backpack-asset-edit; keep the real portal/focus controls here.
                modules["./BackpackAssetEditDialog"] = { BackpackAssetEditDialog: props => {
                    test.assetDialog = props;
                    const [code, setCode] = React.useState(props.item.code);
                    const [error, setError] = React.useState("");
                    React.useEffect(() => { if (test.failAssetOpen) props.onOpenError(test.failAssetOpen); }, []);
                    if (test.failAssetOpen) return null;
                    return React.createElement(window.backpackControls.Modal, {
                        title: "Edit Backpack asset", className: "project-backpack__asset-modal", fullscreen: true, onClose: props.onClose,
                        actions: [{ label: "Cancel", onClick: props.onClose }, { label: "Save", onClick: async () => {
                            try { await props.onSave({ ...props.item, code }); } catch (error) { setError(error.message); }
                        } }]
                    }, React.createElement("input", { "aria-label": "Asset field", value: code, onChange: event => setCode(event.target.value) }),
                    error && React.createElement("p", { role: "alert" }, error));
                } };
                modules["../../../react-common/components/controls/Modal"] = window.backpackControls;
                modules["../../../react-common/components/controls/Input"] = window.backpackControls;
                if (!(id in modules)) throw new Error(`Unexpected import ${id}`);
                return modules[id];
            };
            document.addEventListener("focusin", event => {
                if (event.target.closest(".common-modal-container")) {
                    test.modalEvents.push({ type: "focus", open: test.modalOpen });
                }
            });
        }, assetPreviewURI);
        await page.addScriptTag({ content: controls });
        // Extract the exact current predicates; never use stale pxtlib/editor build output.
        const helper = fs.readFileSync(path.join(root, "pxtlib/auth.ts"), "utf8")
            .match(/ {4}export function isBackpackAssetType\(type: string\): boolean \{[\s\S]*?\n {4}\}/);
        const canDrop = fs.readFileSync(path.join(root, "webapp/src/blocks.tsx"), "utf8")
            .match(/canDrop: (target =>[\s\S]*?),\r?\n\s*assetEditorContext:/);
        assert.ok(helper && canDrop, "Current asset helper and editor drop predicate must be extractable");
        await page.addScriptTag({ content: ts.transpileModule(`${helper[0].replace("export ", "")}
            pxt.auth.isBackpackAssetType = isBackpackAssetType;
            window.backpackCanDrop = function(target) { return (${canDrop[1]})(target); };`,
        { compilerOptions: { target: ts.ScriptTarget.ES2018 } }).outputText });
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
                    },
                    onKeyDown: event => { if (event.key === "Escape") ++backpackTest.escapes; }
                }, React.createElement(backpackUI.ProjectBackpack, {
                    headerId: "project", active, openRequest: backpackTest.openRequest,
                    tutorial: backpackTest.tutorial,
                    renderHeader: (title, actions) => React.createElement("header", null, React.createElement("h2", null, title), actions),
                    onSignIn: () => ++backpackTest.signIns,
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

    it("filters live without mutating data and supports accessible clear, keyboard import and Escape", async () => {
        const saved = { ...item("Orchard"), blockText: "anticlockwise" };
        const other = item("Rocket", "00000000-0000-0000-0000-000000000002");
        await signIn([saved, other]);
        const refreshes = await page.evaluate(() => backpackTest.refreshes);
        assert.strictEqual(await page.$eval(searchBox, input => input === document.activeElement), false);
        const accessibility = await page.accessibility.snapshot({ interestingOnly: false });
        const find = node => node.role === "searchbox" ? node : (node.children || []).map(find).find(Boolean);
        assert.strictEqual(find(accessibility)?.name, "Search backpack");
        await searchFor("orchad");
        assert.deepStrictEqual(await visibleNames(), [saved.name]);
        await searchFor("anticlockwise");
        assert.deepStrictEqual(await visibleNames(), [saved.name]);
        await page.keyboard.press("Tab");
        assert.strictEqual(await page.$eval(clearSearch, button => button === document.activeElement), true);
        for (const selector of [rename, remove, add]) {
            await page.keyboard.press("Tab");
            assert.strictEqual(await page.$eval(selector, button => button === document.activeElement), true);
        }
        await page.keyboard.press("Enter");
        await idle();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds), [{ item: saved, headerId: "project" }]);
        await searchFor("zygomorphic");
        assert.deepStrictEqual(await visibleNames(), []);
        assert.match(await text(), /No matching snippets/);
        assert.doesNotMatch(await text(), /Your backpack is empty/);
        await page.click(clearSearch);
        await page.waitForFunction(() => document.getElementById("project-backpack-search").value === "");
        assert.strictEqual(await page.$eval(searchBox, input => input.value === "" && input === document.activeElement), true);
        assert.deepStrictEqual(await visibleNames(), ["Orchard", "Rocket"]);
        await searchFor("rocket");
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => document.getElementById("project-backpack-search").value === "");
        assert.strictEqual(await page.$eval(searchBox, input => input.value === "" && input === document.activeElement), true);
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.escapes, backpackTest.collapses]), [0, 0]);
        assert.deepStrictEqual(await page.evaluate(() => ({ refreshes: backpackTest.refreshes,
            renames: backpackTest.renames, deletes: backpackTest.deletes, remote: backpackTest.remote.A })),
        { refreshes, renames: [], deletes: [], remote: [saved, other] });
        await page.keyboard.press("Escape");
        assert.strictEqual(await page.evaluate(() => backpackTest.escapes), 1, "Empty search keeps the panel's existing Escape behavior");
    });

    it("reindexes after rename and restores focus when a renamed result no longer matches", async () => {
        await signIn([item("Orchard"), item("Rocket", "00000000-0000-0000-0000-000000000002")]);
        await searchFor("orchard");
        await page.click(rename);
        await page.keyboard.type("Telescope");
        await page.keyboard.press("Enter");
        await idle();
        await modalClosed();
        assert.deepStrictEqual(await visibleNames(), []);
        assert.strictEqual(await page.$eval(searchBox, input => input === document.activeElement), true);
        await searchFor("telescope");
        assert.deepStrictEqual(await visibleNames(), ["Telescope"]);
        await page.click(rename);
        await page.keyboard.type("Telescope setup");
        await page.keyboard.press("Enter");
        await idle();
        await modalClosed();
        assert.deepStrictEqual(await visibleNames(), ["Telescope setup"]);
        assert.strictEqual(await page.$eval(rename, button => button === document.activeElement), true);
    });

    it("deletes only a matching result and focuses the next visible card or search box", async () => {
        await signIn([item("Orchard one"), item("Rocket", "00000000-0000-0000-0000-000000000002"),
            item("Orchard two", "00000000-0000-0000-0000-000000000003")]);
        await searchFor("orchard");
        await page.click(remove);
        await page.click(confirmDelete);
        await idle();
        await modalClosed();
        assert.deepStrictEqual(await visibleNames(), ["Orchard two"]);
        assert.strictEqual(await page.$eval(rename, button => button === document.activeElement), true);
        await page.click(remove);
        await page.click(confirmDelete);
        await idle();
        await modalClosed();
        assert.strictEqual(await page.$eval(searchBox, input => input === document.activeElement), true);
        await page.click(clearSearch);
        assert.deepStrictEqual(await visibleNames(), ["Rocket"]);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.remote.A.map(item => item.name)), ["Rocket"]);
    });

    it("retains live search on reopen and resets it across optional sign-in and sign-out", async () => {
        await loadGuest([item("Orchard")]);
        await searchFor("gyroscope");
        await page.evaluate(() => {
            backpackTest.snapshots.__guest__[0].blockText = "gyroscope";
            backpackTest.remote.__guest__[0].blockText = "gyroscope";
            backpackTest.notify();
        });
        assert.deepStrictEqual(await visibleNames(), ["Orchard"]);
        await reopen();
        await idle();
        assert.strictEqual(await page.$eval(searchBox, input => input.value), "gyroscope");
        assert.deepStrictEqual(await visibleNames(), ["Orchard"]);
        await page.click(signInPrompt);
        assert.strictEqual(await page.evaluate(() => backpackTest.signIns), 1);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.paths()), ["auth:profile", "auth:logged-in"]);
        await signIn([item("Rocket")]);
        assert.strictEqual(await page.$(signInPrompt), null);
        assert.strictEqual(await page.$eval(searchBox, input => input.value), "");
        assert.deepStrictEqual(await visibleNames(), ["Rocket"]);
        await searchFor("rocket");
        await page.evaluate(() => backpackTest.account(undefined));
        await idle();
        assert.strictEqual(await page.$eval(searchBox, input => input.value), "");
        assert.deepStrictEqual(await visibleNames(), ["Orchard"]);
    });

    it("keeps narrow RTL content usable with touch targets and forced-colors keyboard focus", async () => {
        await signIn(Array.from({ length: 8 }, (_, i) => item("Orchard " + "x".repeat(80), `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`)));
        await page.addStyleTag({ content: rtlcss.process(css) });
        await page.evaluate(() => {
            document.getElementById("root").style.width = "180px";
            document.querySelector("section").dir = "rtl";
        });
        await searchFor("orchard");
        assert.deepStrictEqual(await page.$eval(body, list => ({
            scrolls: list.scrollHeight > list.clientHeight,
            fits: list.scrollWidth <= list.clientWidth,
            touch: Array.from(document.querySelectorAll("#root button, #root input")).every(control => {
                const rect = control.getBoundingClientRect();
                return rect.width >= 44 && rect.height >= 44;
            })
        })), { scrolls: true, fits: true, touch: true });
        const session = await page.createCDPSession();
        await session.send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
        await page.focus(searchBox);
        assert.strictEqual(await page.$eval(".project-backpack__search .common-input-group",
            group => getComputedStyle(group, "::after").borderTopStyle), "solid");
        await page.focus(body);
        await page.keyboard.press("Tab");
        for (const selector of [rename, remove, add]) {
            if (selector !== rename) await page.keyboard.press("Tab");
            assert.strictEqual(await page.$eval(selector, button => button === document.activeElement
                && getComputedStyle(button).outlineStyle === "solid"), true);
        }
        assert.deepStrictEqual(await page.$eval(add, button => ({ title: button.title,
            label: button.getAttribute("aria-label"), icon: button.querySelector(".icon.plus").getAttribute("aria-hidden") })),
        { title: "Add to project", label: "Add Orchard " + "x".repeat(80) + " to project", icon: "true" });
        await session.detach();
    });

    it("hides backpack without fetching when identity or target flag disallows it", async () => {
        for (const gate of ["identity", "target"]) {
            await page.evaluate(gate => {
                backpackTest.identity = gate !== "identity";
                pxt.appTarget.appTheme.backpack = gate !== "target";
                backpackTest.rerender();
            }, gate);
            const refreshes = await page.evaluate(() => backpackTest.refreshes);
            await reopen();
            assert.strictEqual(await page.$(body), null);
            assert.strictEqual(await text(), "");
            assert.strictEqual(await page.evaluate(() => backpackTest.refreshes), refreshes);
        }
    });

    it("defaults tutorials to usable assets and shows only an unavailable message on Code", async () => {
        const saved = asset("image_picker", 2);
        await signIn([item(), saved]);
        for (const mode of ["header", "active"]) {
            await page.evaluate(mode => {
                backpackTest.header.tutorial = mode === "header" ? {} : undefined;
                backpackTest.tutorial = mode === "active";
                backpackTest.rerender();
            }, mode);
            await idle();
            assert.equal(await page.$eval("#project-backpack-tab-asset", tab => tab.getAttribute("aria-selected")), "true");
            assert.deepStrictEqual(await visibleNames(), [saved.name]);
            assert.equal(await page.$eval(add, button => button.disabled), false);
            await page.click(add); await idle();
            await page.click(rename); await page.waitForSelector(`${assetModal} input`);
            await page.click(`${assetModal} .common-modal-footer button:last-child`);
            await modalClosed();
            await page.click("#project-backpack-tab-code");
            assert.match(await text(), /Code snippets aren't available during tutorials/);
            assert.deepStrictEqual(await visibleNames(), []);
            assert.equal(await page.$(add), null);
            assert.equal(await page.$(searchBox), null);
            await page.keyboard.press("ArrowRight");
            assert.deepStrictEqual(await visibleNames(), [saved.name]);
            await page.evaluate(() => {
                backpackTest.header.tutorial = undefined; backpackTest.tutorial = false; backpackTest.rerender();
            });
            await idle();
        }
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds.map(add => add.item.id)), [saved.id, saved.id]);
        assert.equal(await page.evaluate(() => backpackTest.assetSaves.length), 2);
    });

    it("routes code, assets and invalid recovery through searchable keyboard tabs and capture requests without asset PNG GETs", async () => {
        const assets = ["image_picker", "animation_editor", "tiles_tilemap_editor", "music_song_field_editor"].map((type, i) => asset(type, i + 10));
        await signIn([item(), ...assets, { ...item("Damaged", "00000000-0000-0000-0000-000000000099"), kind: undefined }]);
        await page.evaluate(() => { window.fetch = () => { throw new Error("Unexpected asset PNG GET"); }; });
        assert.strictEqual(await page.evaluate(() => backpackTest.assetPreviewLoads), 0, "The hidden asset tab must not load content");
        assert.deepStrictEqual(await visibleNames(), ["Jump", "Damaged"]);
        await page.focus("#project-backpack-tab-code");
        await page.keyboard.press("ArrowRight");
        assert.deepStrictEqual(await visibleNames(), assets.map(item => item.name));
        const labels = await page.$$eval(entry, nodes => nodes.map(node =>
            node.querySelector("img")?.alt || node.querySelector(".project-backpack__asset span")?.textContent));
        labels.forEach((label, i) => assert.ok(label === ["Image", "Animation", "Tilemap", "Music"][i]
            || label === `Preview of ${assets[i].name}`));
        assert.strictEqual(await page.$eval(body, node => node.getAttribute("aria-labelledby")), "project-backpack-tab-asset");
        await searchFor("animation");
        assert.deepStrictEqual(await visibleNames(), ["animation_editor"]);
        await page.focus("#project-backpack-tab-asset");
        await page.keyboard.press("Home");
        await page.waitForFunction(() => document.getElementById("project-backpack-search").value === "");
        assert.deepStrictEqual(await visibleNames(), ["Jump", "Damaged"]);
        for (const [key, kind] of [["End", "asset"], ["ArrowLeft", "code"]]) {
            await page.keyboard.press(key);
            assert.strictEqual(await page.$eval(`#project-backpack-tab-${kind}`, button =>
                button === document.activeElement && button.getAttribute("aria-selected") === "true"), true);
            assert.strictEqual(await page.$$eval('.project-backpack__tabs [tabindex="0"]', buttons => buttons.length), 1);
        }
        await page.evaluate(() => { backpackTest.openRequest = { kind: "asset" }; backpackTest.rerender(); });
        await page.waitForFunction(() => document.getElementById("project-backpack-tab-asset").getAttribute("aria-selected") === "true");
        assert.deepStrictEqual(await visibleNames(), assets.map(item => item.name));
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.adds.length, backpackTest.previewRequests || 0]), [0, 0]);
    });

    for (const action of ["Cancel", "Save"]) it(`edits asset content, not its title: ${action}, failures and pencil focus`, async () => {
        const saved = asset("image_picker", 2);
        const edited = { ...saved, code: JSON.stringify({ blocks: [{ type: "image_picker", fields: { IMAGE: { data: "edited pixels" } } }] }) };
        await signIn([item(), saved]);
        assert.equal(await page.$eval(rename, button => button.getAttribute("aria-label")), "Rename Jump");
        await page.click("#project-backpack-tab-asset");
        assert.equal(await page.$eval(rename, button => button.getAttribute("aria-label")), "Edit image_picker");
        assert.equal(await page.evaluate(() => backpackTest.observedAsset), undefined, "Preview loading must not open an editing draft");
        await page.click(rename);
        await page.waitForSelector(`${assetModal}.fullscreen input`);
        assert.equal(await page.$(renameModal), null);
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.contextHeader,
            backpackTest.assetDialog.context === backpackTest.assetContext, backpackTest.modalOpen,
            backpackTest.modalEvents.filter(event => event.type === "focus").every(event => event.open)]), ["project", true, true, true]);
        await page.click(`${assetModal} input`); await page.keyboard.down("Control");
        await page.keyboard.press("KeyA"); await page.keyboard.up("Control"); await page.keyboard.type(edited.code);
        if (action === "Save") {
            await page.evaluate(() => { backpackTest.failAssetSave = true; });
            await page.click(`${assetModal} .common-modal-footer button:last-child`);
            await page.waitForSelector(`${assetModal} [role="alert"]`);
            assert.equal(await page.$eval(`${assetModal} input`, input => input.value), edited.code);
            assert.deepStrictEqual(await page.evaluate(() => backpackTest.remote.A), [item(), saved]);
            await page.evaluate(() => { backpackTest.failAssetSave = false; });
        }
        await page.click(`${assetModal} .common-modal-footer button:${action === "Save" ? "last" : "first"}-child`);
        await modalClosed();
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.adds, backpackTest.renames]), [[], []]);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.assetSaves || []), action === "Cancel" ? []
            : Array(2).fill({ sameEntry: true, item: edited }));
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.remote.A), [item(), action === "Cancel" ? saved : edited]);
        assert.equal(await page.$eval(rename, button => button === document.activeElement), true, `${action} must restore focus to the asset pencil`);
    });

    it("keeps the panel open when a disabled pencil blurs during a cloud read, then releases on close or failure", async () => {
        await signIn([asset("image_picker", 2)]);
        await page.click("#project-backpack-tab-asset");
        for (const fail of [false, true]) {
            await page.evaluate(fail => {
                backpackTest.dismissNullBlur = true;
                backpackTest.failAssetLoad = fail ? "Could not load asset content." : undefined;
                backpackTest.assetLoadGate = new Promise(resolve => { backpackTest.finishAssetLoad = resolve; });
            }, fail);
            await page.focus(rename);
            await page.click(rename);
            await page.waitForFunction(() => document.querySelector(".project-backpack__rename").disabled);
            // Current Edge blurs a focused button when React disables it. Reproduce
            // that event explicitly on older Chromium used by the test runner.
            await page.$eval(rename, button => button.blur());
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert.deepStrictEqual(await page.evaluate(() => [backpackTest.modalOpen, backpackTest.collapses]), [true, 0]);
            assert.equal(await page.$(assetModal), null, "The cloud read is still pending");
            await page.evaluate(() => backpackTest.finishAssetLoad());
            await idle();
            if (fail) {
                await page.waitForSelector(`${entry} [role="alert"]`);
                assert.equal(await page.$eval(rename, button => button === document.activeElement), true);
            } else {
                await page.waitForSelector(`${assetModal} input`);
                await page.click(`${assetModal} .common-modal-footer button:first-child`);
            }
            await modalClosed();
        }
        await page.evaluate(() => {
            backpackTest.failAssetLoad = undefined;
            backpackTest.assetLoadGate = new Promise(resolve => { backpackTest.finishAssetLoad = resolve; });
        });
        await page.click(rename);
        await page.evaluate(() => backpackTest.setActive(false));
        await page.waitForFunction(() => !backpackTest.modalOpen);
        await page.evaluate(() => backpackTest.finishAssetLoad());
        await idle();
        assert.equal(await page.$(assetModal), null, "Explicit collapse must still cancel the pending opening");
    });

    it("opens and saves an asset in Assets with Add disabled, but still rejects read-only edits", async () => {
        const saved = asset("image_picker", 2);
        const edited = { ...saved, code: JSON.stringify({ blocks: [{ type: "image_picker", fields: { IMAGE: { data: "edited pixels" } } }] }) };
        await page.evaluate(() => { backpackTest.editor = "assets"; backpackTest.canImport = false; });
        await loadGuest([saved]);
        await page.click("#project-backpack-tab-asset");
        assert.strictEqual(await page.$eval(rename, button => button.disabled), false);
        assert.strictEqual(await page.$eval(add, button => button.disabled), true);
        await page.click(add);
        await page.click(rename);
        await page.waitForSelector(`${assetModal} input`);
        assert.strictEqual(await page.evaluate(() => backpackTest.assetDialog.context === backpackTest.assetContext), true,
            "The dialog receives the resolved context, not a function or promise");
        await page.click(`${assetModal} input`); await page.keyboard.down("Control");
        await page.keyboard.press("KeyA"); await page.keyboard.up("Control"); await page.keyboard.type(edited.code);
        await page.evaluate(() => { backpackTest.readOnly = true; backpackTest.notify(); });
        await page.click(`${assetModal} .common-modal-footer button:last-child`);
        await page.waitForSelector(`${assetModal} [role="alert"]`);
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.assetSaves || [], backpackTest.remote.__guest__]), [[], [saved]]);
        await page.evaluate(() => { backpackTest.readOnly = false; backpackTest.notify(); });
        await page.click(`${assetModal} .common-modal-footer button:last-child`);
        await modalClosed();
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.assetSaves, backpackTest.remote.__guest__, backpackTest.adds]),
            [[{ sameEntry: true, item: edited }], [edited], []]);
        assert.strictEqual(await page.$eval(add, button => button.disabled), true);
        await page.evaluate(() => { backpackTest.readOnly = true; backpackTest.notify(); });
        assert.strictEqual(await page.$eval(rename, button => button.disabled), true);
    });

    it("shows asset startup errors on a scrolled card, closes the dialog and restores pencil focus", async () => {
        const saved = asset("image_picker", 2);
        const message = "This saved asset could not be opened.";
        const entries = [...Array.from({ length: 8 }, (_, index) => asset("image_picker", index + 10)), saved];
        await signIn(entries);
        await page.addStyleTag({ content: ".project-backpack__body { height: 260px; overflow: auto; }" });
        await page.evaluate(message => { backpackTest.failAssetOpen = message; }, message);
        const pencil = `[data-backpack-id="${saved.id}"] .project-backpack__rename`;
        await page.click("#project-backpack-tab-asset"); await page.click(pencil);
        await page.waitForSelector(`${body} [role="alert"]`);
        await modalClosed();
        assert.equal(await page.$(assetModal), null);
        assert.equal(await page.$eval(`${body} [role="alert"]`, node => node.textContent), message);
        assert.equal((await page.accessibility.snapshot({ root: await page.$(`${body} [role="alert"]`), interestingOnly: false }))?.role, "alert");
        assert.equal(await page.$eval(pencil, button => button === document.activeElement), true);
        assert.equal(await page.$eval(`${body} [role="alert"]`, node => node.closest("[data-backpack-id]")?.dataset.backpackId), saved.id);
        await page.waitForFunction(() => {
            const body = document.querySelector(".project-backpack__body").getBoundingClientRect();
            const error = document.querySelector('.project-backpack__body [role="alert"]').getBoundingClientRect();
            return error.top >= body.top && error.bottom <= body.bottom;
        });
        await page.evaluate(() => {
            backpackTest.failAssetOpen = undefined;
            backpackTest.failAssetLoad = "Could not load asset content.";
        });
        await page.click(pencil); await idle();
        assert.equal(await page.$eval(`[data-backpack-id="${saved.id}"] [role="alert"]`, node => node.textContent), "Could not load asset content.");
        await page.evaluate(() => { backpackTest.failAssetLoad = undefined; });
        await page.click(pencil);
        await page.waitForSelector(`${assetModal} input`);
        await page.click(`${assetModal} .common-modal-footer button:first-child`);
        await modalClosed();
        assert.equal(await page.$(`${body} [role="alert"]`), null, "Retry clears the old card error");
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.assetSaves || [], backpackTest.adds, backpackTest.remote.A]), [[], [], entries]);
    });

    it("unmounts a guest asset draft on sign-in without saving", async () => {
        await loadGuest([asset("image_picker", 2)]);
        await page.click("#project-backpack-tab-asset"); await page.click(rename);
        await page.waitForSelector(`${assetModal} input`); await page.type(`${assetModal} input`, " ");
        await signIn(); await modalClosed();
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.assetSaves || [], backpackTest.remote.__guest__]), [[], [asset("image_picker", 2)]]);
    });

    it("routes native preview/tile drags once through Add, rejects stale or ineligible drags and leaves external drops alone", async () => {
        const snippet = { ...item(), previewUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" };
        await loadGuest([snippet, asset("image_picker", 2)]);
        await page.evaluate(() => {
            document.body.insertAdjacentHTML("beforeend", '<div id="workspace" class="blocklyWorkspace"><span id="canvas"></span><div class="blocklyFlyout"><span id="flyout"></span></div><div class="blocklyWorkspace" id="mutator"></div></div>');
            backpackTest.globalDrops = [];
            document.addEventListener("drop", event => backpackTest.globalDrops.push([...event.dataTransfer.types]));
            backpackTest.drag = (type, target, fresh = false) => {
                if (fresh) {
                    backpackTest.transfer = new DataTransfer();
                    backpackTest.transfer.setData("text/uri-list", "https://external/preview.png");
                }
                const event = new DragEvent(type, { bubbles: true, cancelable: true,
                    dataTransfer: backpackTest.transfer, clientX: 123, clientY: 234 });
                document.querySelector(target).dispatchEvent(event);
                return event.defaultPrevented;
            };
        });
        const drag = (type, target, fresh = false) => page.evaluate((...args) => backpackTest.drag(...args), type, target, fresh);
        const preview = ".project-backpack__preview";
        await drag("dragstart", preview, true);
        assert.deepStrictEqual(await page.evaluate(() => [...backpackTest.transfer.types]), ["application/x-makecode-backpack"]);
        assert.strictEqual(await page.evaluate(() => backpackTest.transfer.getData("application/x-makecode-backpack")),
            await page.$eval(entry, node => node.dataset.backpackKey));
        assert.strictEqual(await drag("dragover", "#canvas"), true);
        await drag("drop", "#canvas");
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.globalDrops), [], "Internal drops must not reach the global handler");
        await drag("drop", "#canvas");
        await idle();
        await page.click(add);
        await idle();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds), [{ item: snippet, headerId: "project" }, { item: snippet, headerId: "project" }]);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.positions), [{ x: 123, y: 234 }]);
        for (const target of ["#outside", "#flyout", "#mutator"]) {
            await drag("dragstart", preview, true);
            await drag("drop", target);
        }
        for (const action of ["cancel", "mismatch", "pending", "disabled", "inactive", "account"]) {
            await drag("dragstart", preview, true);
            await page.evaluate(action => {
                if (action === "cancel") backpackTest.drag("dragend", ".project-backpack__preview");
                if (action === "mismatch") backpackTest.transfer.setData("application/x-makecode-backpack", "wrong-entry");
                if (action === "pending") { backpackTest.hold(); document.querySelector(".project-backpack__add").click(); }
                if (action === "disabled") { backpackTest.canImport = false; backpackTest.notify(); }
                if (action === "inactive") backpackTest.setActive(false);
                if (action === "account") backpackTest.account("B");
            }, action);
            await drag("drop", "#canvas");
            if (action === "pending") { await page.evaluate(() => backpackTest.release()); await idle(); }
            if (action === "disabled") await page.evaluate(() => { backpackTest.canImport = true; backpackTest.notify(); });
            if (action === "inactive") { await reopen(); await idle(); }
        }
        await idle();
        assert.strictEqual(await page.evaluate(() => backpackTest.adds.length), 3, "Only the explicit pending Add may import");
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.positions), [{ x: 123, y: 234 }]);
        await page.evaluate(() => { backpackTest.failAssetPreview = true; backpackTest.account(undefined); });
        await idle();
        await page.click("#project-backpack-tab-asset");
        await page.waitForFunction(() => document.querySelector(".project-backpack__item").textContent.includes("Preview unavailable"));
        assert.strictEqual(await page.$(assetPreview), null);
        assert.strictEqual(await page.$$eval(`${rename}, ${add}`, buttons => buttons.length === 2 && buttons.every(button => !button.disabled)), true);
        await page.click(rename);
        await page.waitForSelector(`${assetModal} input`);
        await page.click(`${assetModal} .common-modal-footer button:first-child`);
        await modalClosed();
        await drag("dragstart", ".project-backpack__asset", true);
        await drag("drop", "#canvas");
        await idle();
        assert.strictEqual(await page.evaluate(() => backpackTest.adds[3].item.kind), "asset");
        for (const type of ["text/uri-list", "Files"]) {
            const count = await page.evaluate(() => backpackTest.globalDrops.length);
            await page.evaluate(type => {
                backpackTest.transfer = new DataTransfer();
                if (type === "Files") backpackTest.transfer.items.add(new File(["png"], "external.png", { type: "image/png" }));
                else backpackTest.transfer.setData(type, "https://external/preview.png");
            }, type);
            assert.strictEqual(await drag("drop", "#canvas"), false);
            assert.deepStrictEqual(await page.evaluate(() => backpackTest.globalDrops.slice(-1)), [[type]]);
            assert.strictEqual(await page.evaluate(() => backpackTest.globalDrops.length), count + 1);
        }
        assert.strictEqual(await page.evaluate(() => backpackTest.adds.length), 4);
        await drag("dragstart", ".project-backpack__asset", true);
        await page.evaluate(() => ReactDOM.unmountComponentAtNode(document.getElementById("root")));
        await page.waitForFunction(() => backpackTest.listenerCount() === 0);
        assert.strictEqual(await drag("drop", "#canvas"), false, "Unmount removes capture handlers and abandons the drag");
        assert.strictEqual(await page.evaluate(() => backpackTest.adds.length), 4);
    });

    it("updates missing-only extensions, warns about source files, and imports literal names and intact metadata", async () => {
        const snippet = { ...item("<b>Jump</b>"),
            dependencies: { core: "*", radio: "github:owner/radio#v1", other: "github:owner/other#v2" },
            projectBlocks: { custom: "custom.ts", another: "custom.ts", helper: "<b>helpers</b>.ts" } };
        await page.evaluate(() => {
            backpackTest.pkg.mainPkg.deps = {
                core: { config: { name: "Core" }, version: () => "embed:core", verProtocol: () => "embed" },
                radio: { config: { name: "Radio extension" }, version: () => "github:OWNER/RADIO#v9", verProtocol: () => "github" },
                other: { config: { name: "Other extension" }, version: () => "github:unrelated/repository#v2", verProtocol: () => "github" }
            };
        });
        await signIn([snippet]);
        assert.strictEqual(await page.$("h3 b"), null);
        assert.deepStrictEqual(await visibleNames(), [snippet.name]);
        const requirements = await page.$$eval(".project-backpack__requirements li", elements => elements.map(el => el.textContent));
        assert.strictEqual(requirements.length, 1);
        assert.match(requirements[0], /github:owner\/other#v2/);
        const warning = await page.$eval("p.project-backpack__requirements", element => element.textContent);
        assert.match(warning, /custom.ts, <b>helpers<\/b>.ts/);
        assert.strictEqual(warning.match(/custom\.ts/g).length, 1);
        assert.match(warning, /source code is not included/);
        assert.strictEqual(await page.$(".project-backpack__requirements b"), null);
        const refreshes = await page.evaluate(() => backpackTest.refreshes);
        await page.evaluate(() => {
            backpackTest.pkg.mainPkg.deps.other = {
                config: { name: "Other extension" }, version: () => "github:owner/other#v2", verProtocol: () => "github"
            };
            backpackTest.notify();
        });
        assert.strictEqual(await page.$(".project-backpack__requirements li"), null);
        assert.match(await text(), /source code is not included/);
        await page.evaluate(() => { delete backpackTest.pkg.mainPkg.deps.core; backpackTest.notify(); });
        assert.match(await page.$eval(".project-backpack__requirements li", element => element.textContent), /core/);
        assert.strictEqual(await page.evaluate(() => backpackTest.refreshes), refreshes);
        await page.click(add);
        await idle();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds), [{ item: snippet, headerId: "project" }]);
    });

    it("displays previews at their original CSS size and labels supporting functions, excluding the root", async () => {
        const previewUri = await page.evaluate(() => {
            const canvas = document.createElement("canvas");
            canvas.width = 400;
            canvas.height = 200;
            const context = canvas.getContext("2d");
            context.fillStyle = "#2196f3";
            context.fillRect(0, 0, canvas.width, canvas.height);
            return canvas.toDataURL("image/png");
        });
        const code = JSON.stringify({ blocks: [{ type: "procedures_defnoreturn" }, { type: "function_definition" }] });
        await loadGuest([{ ...item(), code, previewUri, previewPixelDensity: 2 }]);
        assert.ok(await page.$$eval(`${entry} p`, paragraphs => paragraphs.some(p => p.textContent === "+ 1 other function")));
        assert.doesNotMatch(await text(), /\+ 2 other functions/);
        await page.$eval("img", image => image.decode());
        const metrics = await page.$eval("img", image => ({
            width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height,
            source: image.currentSrc, alt: image.alt
        }));
        assert.ok(Math.abs(metrics.width - 200) < 1);
        assert.ok(Math.abs(metrics.height - 100) < 1);
        assert.strictEqual(metrics.source, previewUri);
        assert.strictEqual(metrics.alt, "Blocks in Jump");
        await page.evaluate(() => { document.getElementById("root").style.width = "180px"; });
        assert.strictEqual(await page.$eval("img", image => image.getBoundingClientRect().width <= image.parentElement.clientWidth), true);
        // The note is still useful for captures without a preview.
        await loadGuest([{ ...item(), code }]);
        assert.strictEqual(await page.$("img"), null);
        assert.ok(await page.$$eval(`${entry} p`, paragraphs => paragraphs.some(p => p.textContent === "+ 1 other function")));
        await loadGuest([item()]);
        assert.doesNotMatch(await text(), /other function/);
    });

    it("loads cloud code PNGs and asset content only on intersection, invalidates versions and ignores late account responses", async () => {
        await controlIntersections();
        await page.evaluate(() => {
            const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
            backpackTest.urls = []; backpackTest.revoked = [];
            URL.createObjectURL = blob => { const url = create(blob); backpackTest.urls.push(url); return url; };
            URL.revokeObjectURL = url => { backpackTest.revoked.push(url); revoke(url); };
            backpackTest.functionCount = 2;
        });
        const saved = asset("image_picker", 2);
        await signIn([{ ...item(), previewPixelDensity: 2,
            previewUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" }, saved]);
        assert.equal(await page.evaluate(() => backpackTest.previewRequests || 0), 0);
        assert.match(await text(), /\+ 2 other functions/);
        await page.evaluate(() => backpackTest.intersect(true));
        await page.waitForSelector("img");
        await page.$eval("img", image => image.decode());
        assert.strictEqual(await page.evaluate(() => backpackTest.previewRequests), 1);
        assert.strictEqual(await page.evaluate(() => backpackTest.urls.length), 1);
        await page.click("#project-backpack-tab-asset");
        await page.waitForFunction(() => backpackTest.observerCount() === 1);
        assert.strictEqual(await page.evaluate(() => backpackTest.assetPreviewLoads), 0);
        await page.evaluate(() => backpackTest.intersect(false));
        assert.strictEqual(await page.evaluate(() => backpackTest.assetPreviewLoads), 0);
        await page.evaluate(() => { backpackTest.hold(); backpackTest.intersect(true); backpackTest.intersect(true); });
        assert.strictEqual(await page.evaluate(() => backpackTest.assetPreviewLoads), 1);
        assert.strictEqual(await page.$(assetPreview), null, "Held asset content must not render early");
        await page.evaluate(() => backpackTest.release());
        await page.waitForSelector(assetPreview);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.assetPreviewRenders), [{ item: saved, sameContext: true }]);
        assert.strictEqual(await page.$eval(assetPreview, image => image.alt), "Preview of image_picker");
        assert.strictEqual(await page.$(".project-backpack__asset"), null);
        const originalURI = await page.$eval(assetPreview, image => image.src);
        await page.evaluate(() => {
            const saved = backpackTest.remote.A[1];
            backpackTest.remote.A[1] = { ...saved, code: saved.code.replace('"image_picker"', '"image_picker","fields":{"IMAGE":"updated"}') };
            backpackTest.snapshots.A = backpackTest.remote.A;
            backpackTest.versions[saved.id] = '"v2"';
            backpackTest.notify();
        });
        await page.waitForFunction(() => backpackTest.observerCount() === 1);
        assert.strictEqual(await page.$(assetPreview), null, "Old-version pixels must disappear before replacement content loads");
        await page.evaluate(() => backpackTest.intersect(true));
        await page.waitForSelector(assetPreview);
        assert.notStrictEqual(await page.$eval(assetPreview, image => image.src), originalURI);
        assert.strictEqual(await page.evaluate(() => backpackTest.assetPreviewLoads), 2);
        await page.evaluate(() => { backpackTest.versions[backpackTest.remote.A[1].id] = '"v3"'; backpackTest.notify(); });
        await page.waitForFunction(() => backpackTest.observerCount() === 1);
        await page.evaluate(() => { backpackTest.hold(); backpackTest.intersect(true); backpackTest.gate = undefined; });
        assert.strictEqual(await page.evaluate(() => backpackTest.assetPreviewLoads), 3);
        await page.evaluate(() => backpackTest.account("B"));
        await idle();
        await page.evaluate(async () => { backpackTest.release(); await new Promise(resolve => requestAnimationFrame(resolve)); });
        assert.strictEqual(await page.evaluate(() => backpackTest.assetPreviewRenders.length), 2, "Late content must not reach the renderer or editor context");
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.previewHeaders), ["project", "project"]);
        assert.strictEqual(await page.evaluate(() => backpackTest.previewRequests), 1, "Assets never use the code PNG route");
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.revoked), await page.evaluate(() => backpackTest.urls));
        assert.strictEqual(await page.$("img"), null);
    });

    it("updates guest previews on code changes without mutating source data and abandons inactive loads", async () => {
        const saved = asset("image_picker", 2);
        await controlIntersections();
        await loadGuest([saved]);
        await page.click("#project-backpack-tab-asset");
        await page.waitForFunction(() => backpackTest.observerCount() === 1);
        await page.evaluate(() => backpackTest.intersect(true));
        await page.waitForSelector(assetPreview);
        assert.strictEqual(await page.$eval(assetPreview, image => image.draggable), true);
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.remote.__guest__, backpackTest.snapshots.__guest__]), [[saved], [saved]]);
        const edited = { ...saved, code: JSON.stringify({ blocks: [{ type: "image_picker", fields: { IMAGE: "edited" } }] }) };
        await page.evaluate(edited => {
            backpackTest.remote.__guest__ = backpackTest.snapshots.__guest__ = [edited]; backpackTest.notify();
        }, edited);
        await page.waitForFunction(() => backpackTest.observerCount() === 1);
        assert.strictEqual(await page.$(assetPreview), null);
        await page.evaluate(() => backpackTest.intersect(true));
        await page.waitForSelector(assetPreview);
        assert.strictEqual(await page.$eval(assetPreview, image => image.src), assetPreviewURI + "#" + encodeURIComponent(edited.code));
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.assetPreviewRenders), [saved, edited].map(item => ({ item, sameContext: true })));
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.remote.__guest__, backpackTest.snapshots.__guest__,
            backpackTest.adds, backpackTest.renames, backpackTest.assetSaves || [], backpackTest.previewRequests || 0]), [[edited], [edited], [], [], [], 0]);
        await page.evaluate(saved => { backpackTest.hold(); backpackTest.snapshots.__guest__ = [saved]; backpackTest.notify(); }, saved);
        await page.waitForFunction(() => backpackTest.observerCount() === 1);
        await page.evaluate(() => backpackTest.intersect(true));
        await page.evaluate(() => backpackTest.setActive(false));
        await page.waitForFunction(() => backpackTest.observerCount() === 0);
        await page.evaluate(async () => {
            backpackTest.notify(); backpackTest.intersect(true); backpackTest.release();
            await new Promise(resolve => requestAnimationFrame(resolve));
        });
        assert.strictEqual(await page.$(assetPreview), null);
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.assetPreviewLoads, backpackTest.assetPreviewRenders.length, backpackTest.observerCount()]), [3, 2, 0]);
    });

    it("animates asset previews only while hovered, using the supplied interval and restoring the still on leave", async () => {
        await page.evaluate(() => {
            const uri = backpackTest.assetPreviewURI;
            backpackTest.previewResult = { previewURI: uri, framePreviewURIs: [uri + "#first", uri + "#second"], interval: 180 };
            backpackTest.timers = new Map();
            let next = 0;
            window.setInterval = (callback, delay) => { const id = ++next; backpackTest.timers.set(id, { callback, delay }); return id; };
            window.clearInterval = id => backpackTest.timers.delete(id);
            backpackTest.tick = () => { for (const timer of backpackTest.timers.values()) timer.callback(); };
        });
        await loadGuest([asset("animation_editor", 2)]);
        await page.click("#project-backpack-tab-asset");
        await page.waitForSelector(assetPreview);
        assert.strictEqual(await page.evaluate(() => backpackTest.timers.size), 0);
        await page.hover(assetPreview);
        assert.deepStrictEqual(await page.evaluate(() => Array.from(backpackTest.timers.values(), timer => timer.delay)), [180]);
        await page.evaluate(() => backpackTest.tick());
        assert.strictEqual(await page.$eval(assetPreview, image => image.src), assetPreviewURI + "#first");
        await page.evaluate(() => backpackTest.tick());
        assert.strictEqual(await page.$eval(assetPreview, image => image.src), assetPreviewURI + "#second");
        await page.hover("header");
        assert.strictEqual(await page.$eval(assetPreview, image => image.src), assetPreviewURI);
        assert.strictEqual(await page.evaluate(() => backpackTest.timers.size), 0);
        await page.hover(assetPreview);
        await page.evaluate(() => backpackTest.setActive(false));
        await page.waitForFunction(() => backpackTest.timers.size === 0);
    });

    it("discards a rename draft with Escape and restores focus without closing the Backpack", async () => {
        await loadGuest([item("on start")]);
        await page.click(rename);
        assert.strictEqual(await page.$eval(nameInput, input => input === document.activeElement), true);
        await page.keyboard.type("discard this name");
        const accessibility = await page.accessibility.snapshot({ interestingOnly: false });
        const find = (node, role) => node.role === role ? node : (node.children || []).map(child => find(child, role)).find(Boolean);
        assert.strictEqual(find(accessibility, "dialog")?.name, "Rename snippet");
        assert.strictEqual(find(accessibility, "textbox")?.name, "Snippet name");
        await page.keyboard.press("Escape");
        await modalClosed();
        assert.strictEqual(await page.$eval(rename, button => button === document.activeElement), true);
        assert.deepStrictEqual(await visibleNames(), ["on start"]);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.renames), []);
    });

    it("validates names, retains failed drafts, and retries without changing blocks or import metadata", async () => {
        const snippet = { ...item(), dependencies: { core: "*" }, projectBlocks: { custom: "custom.ts" } };
        await signIn([snippet]);
        await page.click(add);
        await idle();
        assert.strictEqual(await page.$(renameModal), null);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.renames), []);
        await page.click(rename);
        await page.keyboard.type("   ");
        await page.click(saveName);
        await idle();
        assert.match(await page.$eval(`${renameModal} [role="alert"]`, element => element.textContent), /1 to 100/);
        assert.strictEqual(await page.$eval(nameInput, input => input.getAttribute("aria-invalid")), "true");
        assert.strictEqual(await page.$eval(nameInput, input => input.getAttribute("aria-describedby")), "project-backpack-name-error");
        assert.strictEqual(await page.$('#root [role="alert"]'), null);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.renames), []);
        await page.focus(nameInput);
        await page.keyboard.down("Control"); await page.keyboard.press("a"); await page.keyboard.up("Control");
        await page.keyboard.type("x".repeat(101));
        assert.strictEqual(await page.$eval(nameInput, input => input.value.length), 100);
        assert.strictEqual(await page.$('[role="alert"]'), null);
        await page.keyboard.down("Control"); await page.keyboard.press("a"); await page.keyboard.up("Control");
        await page.keyboard.type("  <b>character setup</b>  ");
        await page.evaluate(() => { backpackTest.failRename = true; backpackTest.hold(); });
        await page.click(saveName);
        assert.strictEqual(await page.$eval(nameInput, input => input.disabled), true);
        assert.strictEqual(await page.$$eval("#root button", buttons => buttons.every(button => button.disabled)), true);
        assert.strictEqual(await page.$(closeName), null);
        for (const selector of [cancelName, saveName]) await page.click(selector);
        await page.keyboard.press("Escape");
        assert.ok(await page.$(renameModal));
        assert.strictEqual(await page.evaluate(() => backpackTest.renames.length), 1);
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.strictEqual(await page.$eval(nameInput, input => input.value), "  <b>character setup</b>  ");
        assert.match(await page.$eval(`${renameModal} [role="alert"]`, element => element.textContent), /Rename failed/);
        assert.strictEqual(await page.$eval("h3", element => element.textContent), "Jump");
        await page.evaluate(() => { backpackTest.failRename = false; });
        await page.click(saveName);
        await idle();
        await modalClosed();
        assert.strictEqual(await page.$eval("h3", element => element.textContent), "<b>character setup</b>");
        assert.strictEqual(await page.$("h3 b"), null);
        assert.strictEqual(await page.$eval(rename, button => button === document.activeElement), true);
        const renamed = { ...snippet, name: "<b>character setup</b>" };
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.remote.A), [renamed]);
        await page.click(add);
        await idle();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds),
            [{ item: snippet, headerId: "project" }, { item: renamed, headerId: "project" }]);
    });

    it("keeps a valid neighbor usable beside a named trash-only recovery card without exposing its payload", async () => {
        const valid = item("Character setup");
        const invalid = { ...item("Damaged startup", "00000000-0000-0000-0000-000000000002"),
            previewUri: "data:image/svg+xml,<svg onload='alert(1)'/>", code: "PRIVATE_INVALID_CODE" };
        await signIn([invalid, valid]);
        const card = '.project-backpack__item--invalid';
        assert.deepStrictEqual(await visibleNames(), [invalid.name, valid.name]);
        assert.doesNotMatch(await text(), /PRIVATE_INVALID_CODE|onload/);
        assert.strictEqual(await page.$(`${card} img, ${card} svg, ${card} ${add}, ${card} ${rename}`), null);
        assert.strictEqual(await page.$eval(`${card} ${remove}`, button => button.getAttribute("aria-label")), "Delete Damaged startup");
        await page.click(add);
        await idle();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds.map(add => add.item)), [valid]);
        await searchFor("damaged");
        assert.deepStrictEqual(await visibleNames(), [invalid.name]);
        await page.click(remove);
        await page.click(confirmDelete);
        await idle();
        await modalClosed();
        await page.click(clearSearch);
        await reopen();
        await idle();
        assert.deepStrictEqual(await visibleNames(), [valid.name]);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.deletedEntries), [{ id: invalid.id, source: "cloud" }]);
    });

    it("recovers unnamed, mismatched-ID and long literal-name entries by storage key without rendering their payloads", async () => {
        await signIn([item("Working")]);
        const key = 'broken/key"[literal]';
        const literalName = '<img src=x onerror=alert(1)>\n' + "x".repeat(120);
        await page.evaluate(({ key, literalName }) => {
            backpackTest.recovery = [
                { id: key, source: "cloud", value: { id: "wrong", name: literalName, previewUri: "https://private", code: "PRIVATE" } },
                { id: "no-name", source: "cloud", value: null }
            ];
            backpackTest.notify();
        }, { key, literalName });
        const names = await visibleNames();
        assert.strictEqual(names[1], literalName.slice(0, 100).replace(/\n/g, " ").trim());
        assert.strictEqual(names[2], "Unnamed snippet");
        assert.strictEqual(await page.$("h3 img, h3 script, .project-backpack__item--invalid img"), null);
        await searchFor("img");
        await page.click(remove);
        assert.strictEqual(await page.$(`${confirm} img, ${confirm} script`), null);
        await page.click(confirmDelete);
        await idle();
        await modalClosed();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.deletedEntries), [{ id: key, source: "cloud" }]);
        await page.click(clearSearch);
        assert.deepStrictEqual(await visibleNames(), ["Working", "Unnamed snippet"]);
        await searchFor("unnamed");
        assert.strictEqual(await page.$(add), null);
        assert.strictEqual(await page.$(rename), null);
        await page.click(remove);
        await page.click(confirmDelete);
        await idle();
        await modalClosed();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.deletedEntries),
            [{ id: key, source: "cloud" }, { id: "no-name", source: "cloud" }]);
        await page.click(clearSearch);
        assert.deepStrictEqual(await visibleNames(), ["Working"]);
    });

    it("distinguishes local and synced recovery cards sharing a key and retains controls while over quota", async () => {
        await signIn([item("Working")]);
        await page.evaluate(() => {
            backpackTest.warning = "Your backpack is over its storage limit. Delete snippets using their trash buttons to make room.";
            backpackTest.recovery = [
                { id: "same-key", source: "cloud", value: { name: "Cloud damaged" } },
                { id: "same-key", source: "local", value: { name: "Local damaged" } }
            ];
            backpackTest.notify();
        });
        assert.match(await text(), /storage limit/);
        assert.strictEqual(await page.$(retry), null);
        assert.strictEqual(await page.$eval(add, button => button.disabled), false);
        await searchFor("local damaged");
        assert.deepStrictEqual(await visibleNames(), ["Local damaged"]);
        assert.match(await text(), /Saved in this browser only/);
        await page.click(remove);
        assert.match(await modalText(), /in this browser/);
        assert.doesNotMatch(await modalText(), /all devices/);
        await page.click(confirmDelete);
        await idle();
        await modalClosed();
        await searchFor("cloud damaged");
        assert.deepStrictEqual(await visibleNames(), ["Cloud damaged"]);
        await page.click(remove);
        assert.match(await modalText(), /on all devices/);
        await page.click(confirmDelete);
        await idle();
        await modalClosed();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.deletedEntries), [
            { id: "same-key", source: "local" }, { id: "same-key", source: "cloud" }
        ]);
        await page.click(clearSearch);
        assert.deepStrictEqual(await visibleNames(), ["Working"]);
    });

    it("imports into the captured project, disables operations while pending, and retries errors", async () => {
        const snippet = item();
        await signIn([snippet]);
        await page.evaluate(() => { backpackTest.failAdd = true; backpackTest.hold(); });
        await page.click(add);
        assert.strictEqual(await page.$$eval("#root button", elements => elements.every(button => button.disabled)), true);
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.match(await text(), /Import failed/);
        await page.evaluate(() => { backpackTest.failAdd = false; });
        await page.click(add);
        await idle();
        assert.strictEqual(await page.$('[role="alert"]'), null);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds), [{ item: snippet, headerId: "project" }, { item: snippet, headerId: "project" }]);
    });

    it("responds to import eligibility changes and leaves a cancelled import usable", async () => {
        await loadGuest([item()]);
        await page.evaluate(() => { backpackTest.canImport = false; backpackTest.editor = "tsprj"; backpackTest.notify(); });
        assert.match(await text(), /Switch to Blocks/);
        assert.strictEqual(await page.$eval(add, button => button.disabled), true);
        await page.click(add);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds), []);
        await page.evaluate(() => { backpackTest.readOnly = true; backpackTest.notify(); });
        assert.match(await text(), /editable Blocks project/);
        await page.evaluate(() => {
            backpackTest.readOnly = false;
            backpackTest.editor = "blocksprj";
            backpackTest.canImport = true;
            backpackTest.notify();
        });
        await page.evaluate(() => { backpackTest.importResult = false; backpackTest.hold(); });
        await page.click(add);
        assert.strictEqual(await page.$eval(add, button => button.disabled), true);
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.strictEqual(await page.$('[role="alert"]'), null);
        assert.strictEqual(await page.$(confirm), null);
        assert.strictEqual((await page.$$(entry)).length, 1);
        assert.strictEqual(await page.$eval(add, button => button.disabled), false);
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.adds.length, backpackTest.deletes.length]), [1, 0]);
        await page.evaluate(() => { backpackTest.importResult = true; });
        await page.focus(add);
        await page.keyboard.press("Enter");
        await idle();
        assert.strictEqual(await page.evaluate(() => backpackTest.adds.length), 2);
        assert.strictEqual(await page.$('[role="alert"]'), null);
    });

    it("clears cached entries on refresh failure and loads remote changes on retry and reopen", async () => {
        await signIn([item()]);
        await page.evaluate(() => { backpackTest.failRefresh = true; backpackTest.hold(); });
        await reopen();
        assert.strictEqual(await page.$(entry), null);
        assert.match(await text(), /Loading backpack/);
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.match(await text(), /Sync failed/);
        assert.doesNotMatch(await text(), /Loading backpack/);
        assert.strictEqual(await page.$eval(retry, button => button.disabled), false);
        assert.strictEqual(await page.$(entry), null);
        // Clearing an action error must not turn an incomplete warning back into loading.
        await page.evaluate(() => {
            backpackTest.warning = "Sync failed. Try again.";
            backpackTest.complete = false;
            backpackTest.recovery = [{ id: "damaged", source: "cloud", value: { name: "Recoverable" } }];
            backpackTest.notify();
        });
        assert.strictEqual((await text()).split("Sync failed. Try again.").length - 1, 1);
        await page.click(remove);
        await page.click(cancel);
        await modalClosed();
        assert.doesNotMatch(await text(), /Loading backpack/);
        assert.strictEqual(await page.$eval(retry, button => button.disabled), false);
        await page.evaluate(snippet => {
            backpackTest.failRefresh = false; backpackTest.remote.A = [snippet];
            backpackTest.warning = undefined; backpackTest.complete = true; backpackTest.recovery = [];
        }, item("Other device"));
        await page.click(retry);
        await idle();
        assert.strictEqual((await page.$$(entry)).length, 1);
        assert.strictEqual(await page.$('[role="alert"]'), null);
        assert.strictEqual(await page.$(retry), null);
        assert.strictEqual(await page.$eval(body, element => element === document.activeElement), true);
        assert.deepStrictEqual(await visibleNames(), ["Other device"]);
        await page.evaluate(() => { backpackTest.remote.A = []; });
        await reopen();
        await idle();
        assert.match(await text(), /Your backpack is empty/);
    });

    it("traps focus in the accessible delete portal and restores it on cancel", async () => {
        await signIn([item()]);
        assert.strictEqual(await page.$eval(remove, button => button.getAttribute("aria-haspopup")), "dialog");
        await page.evaluate(() => { backpackTest.modalEvents = []; });
        await page.focus(remove);
        await page.keyboard.press("Enter");
        assert.strictEqual(await page.$eval(confirm, element => element === document.activeElement), true);
        assert.deepStrictEqual(await page.$eval(dialog, element => ({
            inRoot: document.getElementById("root").contains(element),
            hidden: document.getElementById("root").getAttribute("aria-hidden"),
            outsideHidden: document.getElementById("outside").getAttribute("aria-hidden")
        })), { inRoot: false, hidden: "true", outsideHidden: "true" });
        const accessibility = await page.accessibility.snapshot({ interestingOnly: false });
        const accessibleDialog = node => node.role === "dialog" ? node : (node.children || []).map(accessibleDialog).find(Boolean);
        assert.strictEqual(accessibleDialog(accessibility)?.name, "Delete snippet?");
        assert.match(accessibleDialog(accessibility)?.description, /Jump.*on all devices/);
        const events = await page.evaluate(() => backpackTest.modalEvents);
        assert.deepStrictEqual(events[0], { type: "change", open: true });
        assert.ok(events.some(event => event.type === "focus"));
        assert.ok(events.filter(event => event.type === "focus").every(event => event.open));
        // Exercise the shared FocusTrap's forward wrap and reverse wrap.
        for (const selector of [close, cancel, confirmDelete, close]) {
            await page.keyboard.press("Tab");
            assert.strictEqual(await page.$eval(selector, element => element === document.activeElement), true);
        }
        await page.keyboard.down("Shift");
        await page.keyboard.press("Tab");
        await page.keyboard.up("Shift");
        assert.strictEqual(await page.$eval(confirmDelete, element => element === document.activeElement), true);
        await page.focus(cancel);
        await page.keyboard.press("Enter");
        await modalClosed();
        assert.strictEqual(await page.$eval(remove, element => element === document.activeElement), true);
        assert.deepStrictEqual(await visibleNames(), ["Jump"]);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.deletes), []);
    });

    it("retains the entry and confirmation after delete failure, then retries and focuses the next entry", async () => {
        await signIn([item(), item("Run", "00000000-0000-0000-0000-000000000002")]);
        await page.click(remove);
        await page.evaluate(() => { backpackTest.failDelete = true; backpackTest.hold(); });
        await page.click(confirmDelete);
        assert.strictEqual((await page.$$(entry)).length, 2);
        assert.strictEqual(await page.$$eval("#root button", elements => elements.every(button => button.disabled)), true);
        assert.strictEqual(await page.$eval(`${dialog} [aria-busy]`, element => element.getAttribute("aria-busy")), "true");
        await page.click(cancel);
        await page.click(confirmDelete);
        await page.keyboard.press("Escape");
        assert.ok(await page.$(confirm));
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.deletes), [item().id]);
        assert.strictEqual(await page.evaluate(() => backpackTest.escapes), 0);
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.match(await modalText(), /Delete failed/);
        assert.strictEqual(await page.$('#root [role="alert"]'), null);
        assert.strictEqual((await page.$$(entry)).length, 2);
        assert.ok(await page.$(confirm));
        await page.evaluate(() => { backpackTest.failDelete = false; });
        await page.click(confirmDelete);
        await idle();
        assert.strictEqual((await page.$$(entry)).length, 1);
        assert.strictEqual(await page.$eval(rename, element => element === document.activeElement), true);
        await modalClosed();
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

    it("unmounts A's pending delete modal and ignores its late success while B's dialog is open", async () => {
        await signIn([item("Old contents")]);
        await page.click(remove);
        await page.evaluate(() => backpackTest.hold());
        await page.click(confirmDelete);
        await page.evaluate(snippet => {
            backpackTest.gate = undefined;
            backpackTest.remote.B = [snippet];
            backpackTest.account("B");
        }, item("New contents"));
        assert.strictEqual(await page.$(confirm), null);
        assert.doesNotMatch(await text(), /Old contents/);
        await idle();
        await modalClosed();
        await page.click(remove);
        await page.focus(cancel);
        const events = await page.evaluate(() => backpackTest.modalEvents);
        await page.evaluate(() => backpackTest.release());
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.modalEvents), events);
        assert.match(await modalText(), /New contents/);
        assert.strictEqual(await page.$('[role="alert"]'), null);
        assert.strictEqual(await page.$eval(cancel, button => button === document.activeElement), true);
        assert.deepStrictEqual(await visibleNames(), ["New contents"]);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.remote.A), []);
        await page.click(cancel);
        await modalClosed();
        assert.strictEqual(await page.$eval(remove, button => button === document.activeElement), true);
    });
});