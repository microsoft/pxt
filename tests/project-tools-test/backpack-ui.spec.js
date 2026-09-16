"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const less = require("less");
const rtlcss = require("rtlcss");
const { launchTestBrowser } = require("./browser");
const { contrastSamples } = require("./theme-helpers");

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
        id, name, code: JSON.stringify({ blocks: [{ type: "pxt-on-start" }] }), blockText: "", createdAt: 1, dependencies: {}
    });
    const entry = ".project-backpack__item";
    const add = ".project-backpack__add";
    const rename = ".project-backpack__rename";
    const renameModal = ".project-backpack__rename-modal";
    const nameInput = "#project-backpack-name";
    const saveName = `${renameModal} .common-modal-footer button:last-child`;
    const cancelName = `${renameModal} .common-modal-footer button:first-child`;
    const closeName = `${renameModal} .common-modal-close button`;
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
    const quiet = async () => assert.doesNotMatch(await page.$eval("#root", element => element.innerText),
        /\b(?:Deleted|Added|Deleting|Adding)\b|The snippet was not added/);
    const idle = async () => {
        await page.waitForFunction(() => {
            return document.querySelector(".project-backpack__body")?.getAttribute("aria-busy") === "false";
        });
        await quiet();
    };
    const modalClosed = async () => {
        // Portal removal is synchronous; shared Modal's aria-hidden restoration
        // and the owner's false notification are passive-effect cleanups.
        await page.waitForFunction(() => !document.querySelector(".project-backpack__delete-modal, .project-backpack__rename-modal")
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
        await quiet();
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
        await page.evaluate(() => {
            window.lf = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]);
            window.pxt = {
                BLOCKS_PROJECT_NAME: "blocksprj",
                shell: { isReadOnly: () => backpackTest.readOnly },
                appTarget: { bundledpkgs: { core: {} } },
                github: { parseRepoId: version => ({ owner: version.split(":")[1].split("/")[0], project: version.split("/")[1] }) }
            };
            const subscribers = new Set();
            const listeners = new Set();
            const test = window.backpackTest = {
                user: undefined, identity: true, remote: {}, snapshots: {},
                recovery: [], deletedEntries: [], warning: undefined,
                refreshes: 0, adds: [], deletes: [], renames: [], signIns: 0, escapes: 0,
                failRefresh: false, failDelete: false, failRename: false, failAdd: false, importResult: true,
                modalOpen: false, modalEvents: [], collapses: 0,
                modalChanged(open) {
                    test.modalOpen = open;
                    test.modalEvents.push({ type: "change", open });
                },
                canImport: true, readOnly: false, editor: "blocksprj",
                header: { id: "project" },
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
                backpackEntryKey: entry => JSON.stringify([entry.source, entry.local?.namespace || "", entry.id]),
                get MAX_BACKPACK_NAME_LENGTH() { return window.backpackValidation.MAX_BACKPACK_NAME_LENGTH; },
                validateBackpackItem: value => window.backpackValidation.validateBackpackItem(value),
                getBackpackState: () => ({
                    entries: (test.snapshots[test.storeKey()] || []).map(item => {
                        const validated = window.backpackValidation.readBackpackEntry(item.id, item, test.user ? "cloud" : "local");
                        if (!test.user || validated.error) return validated;
                        const blockTypes = [];
                        const words = [];
                        const walk = value => {
                            if (!value || typeof value !== "object") return;
                            if (typeof value.type === "string") blockTypes.push(value.type);
                            for (const [key, child] of Object.entries(value)) {
                                if (["id", "functionid", "data", "jres", "bitmap", "pixels"].includes(key)) continue;
                                if (typeof child === "object") walk(child);
                                else if (typeof child === "string" || typeof child === "number") words.push(String(child));
                            }
                        };
                        try { walk(JSON.parse(item.code)); } catch { /* Invalid source is covered separately. */ }
                        return window.backpackValidation.readBackpackSummary({ id: item.id, name: item.name,
                            createdAt: item.createdAt, updatedAt: item.createdAt, version: '"v1"', status: "ready",
                            hasPreview: !!item.previewUri, previewPixelDensity: item.previewPixelDensity,
                            blockTypes, blockText: [item.blockText, ...words].join(" "),
                            dependencies: item.dependencies, projectBlocks: item.projectBlocks });
                    }).concat(test.recovery
                        .filter(entry => !!test.user || entry.source === "local")
                        .map(entry => window.backpackValidation.readBackpackEntry(entry.id, entry.value, entry.source))),
                    warning: test.warning
                }),
                subscribeBackpack(listener) { listeners.add(listener); return () => listeners.delete(listener); },
                notifyBackpackEditorChanged: () => test.notify(),
                canImportBackpack: () => test.canImport,
                async getBackpackPreviewAsync(entry, signal) {
                    test.previewRequests = (test.previewRequests || 0) + 1;
                    const item = (test.snapshots[test.storeKey()] || []).find(item => item.id === entry.id);
                    const response = await fetch(item.previewUri, { signal });
                    return response.blob();
                },
                async exportOldBackpackAsync() { test.legacyExports = (test.legacyExports || 0) + 1; return '{"old":true}'; },
                async clearOldBackpackAsync() { test.legacyClears = (test.legacyClears || 0) + 1; },
                async retryBackpackEntryAsync() { test.syncRetries = (test.syncRetries || 0) + 1; },
                async refreshBackpackAsync() {
                    const user = test.storeKey();
                    const fail = test.failRefresh;
                    ++test.refreshes;
                    await test.gate;
                    if (fail) throw new Error("Sync failed. Try again.");
                    test.snapshots[user] = JSON.parse(JSON.stringify(test.remote[user] || []));
                    test.notify();
                },
                async importBackpackEntryAsync(entry, headerId) {
                    const item = entry.item || (test.snapshots[test.storeKey()] || []).find(item => item.id === entry.id);
                    const fail = test.failAdd;
                    const result = test.importResult;
                    test.adds.push({ item, headerId });
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
        });
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
                        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && !backpackTest.modalOpen) {
                            ++backpackTest.collapses;
                            setActive(false);
                        }
                    },
                    onKeyDown: event => { if (event.key === "Escape") ++backpackTest.escapes; }
                }, React.createElement(backpackUI.ProjectBackpack, {
                    headerId: "project", active,
                    renderHeader: (title, actions) => React.createElement("header", null, React.createElement("h2", null, title), actions),
                    onSignIn: () => ++backpackTest.signIns,
                    onModalOpenChange: backpackTest.modalChanged
                }));
            }
            backpackTest.mount = () => ReactDOM.render(React.createElement(Harness), document.getElementById("root"));
            backpackTest.mount();
        });
        await idle();
    });
    afterEach(async () => {
        if (!page || page.isClosed()) return;
        try {
            await quiet();
            await page.evaluate(() => ReactDOM.unmountComponentAtNode(document.getElementById("root")));
            assert.deepStrictEqual(pageErrors, [], "Unexpected browser error or unhandled rejection");
        } finally { await page.close(); }
    });

    it("loads guest contents, subscribes to both auth paths, and offers nonblocking sign-in", async () => {
        assert.match(await text(), /Your backpack is empty/);
        assert.match(await text(), /Right-click or hold.*Add to Backpack.*bubble/);
        assert.strictEqual(await page.$eval(signInPrompt, button => button.textContent), "Sign in to save your backpack across browsers.");
        assert.strictEqual(await page.$eval(body, element => element.firstElementChild.classList.contains("project-backpack__sign-in")), true);
        assert.doesNotMatch(await text(), /Refresh|up.to.date|syncs across devices|Sign in to use/i);
        assert.strictEqual(await page.$(entry), null);
        await page.click(signInPrompt);
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.signIns, backpackTest.refreshes]), [1, 1]);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.paths()), ["auth:profile", "auth:logged-in"]);
        await signIn();
        assert.strictEqual(await page.$(signInPrompt), null);
    });

    it("filters locally by fuzzy name, contained blocks, displayed values and all used extensions", async () => {
        const saved = { ...item("Orchard setup"), blockText: "set velocity anticlockwise",
            dependencies: { core: "*", radio: "github:acme/telemetry#v1" },
            code: JSON.stringify({ blocks: [{ type: "pxt-on-start", inputs: { HANDLER: { block: {
                type: "radio_sendNumber", fields: { TEXT: "cumulonimbus", NUM: 8675309 },
                next: { block: { type: "variables_set", fields: { VAR: { name: "altitude", id: "internal" } } } }
            } } } }] }) };
        const other = item("Rocket launch", "00000000-0000-0000-0000-000000000002");
        await page.evaluate(() => {
            backpackTest.pkg.mainPkg.deps = {
                core: { config: { name: "Foundation" }, version: () => "embed:core", verProtocol: () => "embed" },
                radio: { config: { name: "Wireless messages" }, version: () => "github:acme/telemetry#v1", verProtocol: () => "github" }
            };
        });
        await signIn([other, saved]);
        const refreshes = await page.evaluate(() => backpackTest.refreshes);
        assert.strictEqual(await page.$(".project-backpack__requirements"), null);
        assert.strictEqual(await page.$eval(searchBox, input => input === document.activeElement), false);
        for (const query of ["orchad", "RADIO", "send number", "anticlockwise", "8675309", "cumulonimbus", "altitude",
            "telemetry", "wireless", "foundation", "orchard anticlockwise telemetry"]) {
            await searchFor(query);
            assert.deepStrictEqual(await visibleNames(), [saved.name], query);
            assert.strictEqual(await page.$eval(`${body} [role="status"]`, element => element.textContent), "1 of 2 snippets");
        }
        await searchFor("zygomorphic");
        assert.deepStrictEqual(await visibleNames(), []);
        assert.match(await text(), /No matching snippets/);
        assert.doesNotMatch(await text(), /Your backpack is empty/);
        await searchFor("   ");
        assert.deepStrictEqual(await visibleNames(), [other.name, saved.name]);
        assert.deepStrictEqual(await page.evaluate(() => ({ refreshes: backpackTest.refreshes, adds: backpackTest.adds,
            renames: backpackTest.renames, deletes: backpackTest.deletes, remote: backpackTest.remote.A })),
        { refreshes, adds: [], renames: [], deletes: [], remote: [other, saved] });
    });

    it("labels search accessibly and supports clear, keyboard import and Escape without closing the panel", async () => {
        await signIn([item("Orchard"), item("Rocket", "00000000-0000-0000-0000-000000000002")]);
        const accessibility = await page.accessibility.snapshot({ interestingOnly: false });
        const find = node => node.role === "searchbox" ? node : (node.children || []).map(find).find(Boolean);
        assert.strictEqual(find(accessibility)?.name, "Search backpack");
        await searchFor("orchard");
        await page.keyboard.press("Tab");
        assert.strictEqual(await page.$eval(clearSearch, button => button === document.activeElement), true);
        for (const selector of [rename, remove, add]) {
            await page.keyboard.press("Tab");
            assert.strictEqual(await page.$eval(selector, button => button === document.activeElement), true);
        }
        await page.keyboard.press("Enter");
        await idle();
        assert.strictEqual(await page.evaluate(() => backpackTest.adds[0].item.name), "Orchard");
        await page.click(clearSearch);
        await page.waitForFunction(() => document.getElementById("project-backpack-search").value === "");
        assert.strictEqual(await page.$eval(searchBox, input => input.value === "" && input === document.activeElement), true);
        assert.deepStrictEqual(await visibleNames(), ["Orchard", "Rocket"]);
        await searchFor("rocket");
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => document.getElementById("project-backpack-search").value === "");
        assert.strictEqual(await page.$eval(searchBox, input => input.value === "" && input === document.activeElement), true);
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.escapes, backpackTest.collapses]), [0, 0]);
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

    it("retains search on reopen, updates after notifications and clears it on account changes", async () => {
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
        await signIn([item("Rocket")]);
        assert.strictEqual(await page.$eval(searchBox, input => input.value), "");
        assert.deepStrictEqual(await visibleNames(), ["Rocket"]);
        await searchFor("rocket");
        await page.evaluate(() => backpackTest.account(undefined));
        await idle();
        assert.strictEqual(await page.$eval(searchBox, input => input.value), "");
        assert.deepStrictEqual(await visibleNames(), ["Orchard"]);
    });

    it("keeps search above the scrolling list, touch-sized, themed and readable in narrow panels and RTL", async () => {
        await signIn(Array.from({ length: 8 }, (_, i) => item("Orchard " + i, `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`)));
        await searchFor("orchard");
        for (const direction of ["ltr", "rtl"]) {
            await page.addStyleTag({ content: direction === "rtl" ? rtlcss.process(css) : css });
            for (const dark of [false, true]) {
                await page.evaluate(({ direction, dark }) => {
                    document.getElementById("root").style.width = "180px";
                    const section = document.querySelector("section");
                    section.dir = direction;
                    section.style.setProperty("--tools-surface", dark ? "rgb(25, 25, 25)" : "rgb(250, 250, 250)");
                    section.style.setProperty("--tools-foreground", dark ? "rgb(250, 250, 250)" : "rgb(25, 25, 25)");
                    section.style.setProperty("--pxt-focus-border", dark ? "rgb(250, 250, 250)" : "rgb(25, 25, 25)");
                }, { direction, dark });
                assert.deepStrictEqual(await page.$eval(".project-backpack__search", search => {
                    const rect = search.getBoundingClientRect();
                    const input = search.querySelector("input").getBoundingClientRect();
                    const clear = search.querySelector("button").getBoundingClientRect();
                    const list = document.querySelector(".project-backpack__body");
                    const before = rect.top;
                    list.scrollTop = list.scrollHeight;
                    return { above: rect.bottom <= list.getBoundingClientRect().top,
                        stationary: before === search.getBoundingClientRect().top,
                        fits: search.scrollWidth <= search.clientWidth && input.left >= rect.left && input.right <= rect.right,
                        touch: input.width >= 44 && input.height >= 44 && clear.width >= 44 && clear.height >= 44 };
                }), { above: true, stationary: true, fits: true, touch: true });
                assert.ok((await contrastSamples(page, searchBox))[0].contrast >= 4.5);
                await page.focus(searchBox);
                assert.strictEqual(await page.$eval(".project-backpack__search .common-input-group",
                    group => getComputedStyle(group, "::after").borderTopStyle), "solid");
            }
        }
        const session = await page.createCDPSession();
        await session.send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
        assert.ok((await contrastSamples(page, searchBox))[0].contrast >= 4.5);
        await session.detach();
    });

    it("keeps guest contents usable when identity is unavailable without offering sign-in", async () => {
        await page.evaluate(() => { backpackTest.identity = false; backpackTest.rerender(); });
        assert.match(await text(), /Your backpack is empty/);
        assert.strictEqual(await page.$(signInPrompt), null);
        await loadGuest([item()]);
        assert.doesNotMatch(await text(), /Sign in|not available/);
        await page.click(add);
        await idle();
        assert.strictEqual(await page.$('[role="alert"]'), null);
        await page.click(remove);
        assert.match(await modalText(), /in this browser\?/);
        await page.click(confirmDelete);
        await idle();
        assert.match(await text(), /Your backpack is empty/);
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.adds.length, backpackTest.deletes.length, backpackTest.signIns]), [1, 1, 0]);
    });

    it("lets guests add and delete snippets locally without signing in", async () => {
        const snippet = item();
        await loadGuest([snippet]);
        await page.evaluate(snippet => { backpackTest.remote.A = [snippet]; }, item("Account only"));
        assert.strictEqual(await page.$eval(add, button => button.disabled), false);
        await page.click(add);
        await idle();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds), [{ item: snippet, headerId: "project" }]);
        assert.strictEqual(await page.$('[role="alert"]'), null);
        await page.click(remove);
        assert.match(await modalText(), /Delete Jump from your backpack in this browser\?/);
        assert.doesNotMatch(await modalText(), /all devices/);
        assert.strictEqual(await page.$eval(confirm, element => element === document.activeElement), true);
        await page.keyboard.press("Escape");
        await modalClosed();
        assert.strictEqual(await page.$eval(remove, element => element === document.activeElement), true);
        await page.click(remove);
        await page.click(confirmDelete);
        await idle();
        await modalClosed();
        assert.match(await text(), /Your backpack is empty/);
        assert.strictEqual(await page.$eval(body, element => element === document.activeElement), true);
        assert.deepStrictEqual(await page.evaluate(() => ({
            guest: backpackTest.remote.__guest__, account: backpackTest.remote.A[0].name,
            deletes: backpackTest.deletes, signIns: backpackTest.signIns
        })), { guest: [], account: "Account only", deletes: [snippet.id], signIns: 0 });
    });

    it("allows guests to retry loading, import, and delete errors", async () => {
        await loadGuest([item()]);
        await page.evaluate(() => { backpackTest.failRefresh = true; });
        await reopen();
        await idle();
        assert.ok(await page.$('[role="alert"]'));
        assert.strictEqual(await page.$(entry), null);
        await page.evaluate(() => { backpackTest.failRefresh = false; });
        await page.click(retry);
        await idle();
        assert.strictEqual(await page.$('[role="alert"]'), null);
        await page.evaluate(() => { backpackTest.failAdd = true; });
        await page.click(add);
        await idle();
        assert.match(await text(), /Import failed/);
        await page.evaluate(() => { backpackTest.failAdd = false; });
        await page.click(add);
        await idle();
        assert.strictEqual(await page.$('[role="alert"]'), null);
        await page.click(remove);
        await page.evaluate(() => { backpackTest.failDelete = true; });
        await page.click(confirmDelete);
        await idle();
        assert.match(await modalText(), /Delete failed/);
        assert.strictEqual(await page.$('#root [role="alert"]'), null);
        assert.ok(await page.$(entry));
        assert.ok(await page.$(confirm));
        await page.evaluate(() => { backpackTest.failDelete = false; });
        await page.click(confirmDelete);
        await idle();
        await modalClosed();
        assert.strictEqual(await page.$('[role="alert"]'), null);
        assert.match(await text(), /Your backpack is empty/);
    });

    it("keeps the centered sign-in button wrapped, touch-sized, themed, and keyboard accessible", async () => {
        await loadGuest([item()]);
        await page.evaluate(() => { document.getElementById("root").style.width = "180px"; });
        for (const dark of [false, true]) {
            await page.evaluate(dark => {
                const section = document.querySelector("section");
                section.style.setProperty("--tools-surface", dark ? "rgb(25, 25, 25)" : "rgb(250, 250, 250)");
                section.style.setProperty("--tools-foreground", dark ? "rgb(250, 250, 250)" : "rgb(25, 25, 25)");
            }, dark);
            const metrics = await page.$eval(signInPrompt, button => {
                const rect = button.getBoundingClientRect();
                const style = getComputedStyle(button);
                const range = document.createRange();
                range.selectNodeContents(button);
                return {
                    touch: rect.height >= 44 && rect.width >= 44,
                    fits: button.scrollWidth <= button.clientWidth && button.parentElement.scrollWidth <= button.parentElement.clientWidth,
                    wraps: range.getClientRects().length > 1,
                    underlined: style.textDecorationLine.includes("underline"),
                    border: style.borderTopStyle === "solid" && parseFloat(style.borderTopWidth) >= 1
                        && style.borderTopColor !== "rgba(0, 0, 0, 0)",
                    aligned: style.textAlign === "center",
                    color: style.color, background: style.backgroundColor
                };
            });
            assert.deepStrictEqual(metrics, {
                touch: true, fits: true, wraps: true, underlined: false, border: true, aligned: true,
                color: dark ? "rgb(250, 250, 250)" : "rgb(25, 25, 25)",
                background: dark ? "rgb(25, 25, 25)" : "rgb(250, 250, 250)"
            });
        }
        for (const width of [180, 320, 480]) {
            for (const direction of ["ltr", "rtl"]) {
                await page.evaluate(({ width, direction }) => {
                    document.getElementById("root").style.width = `${width}px`;
                    document.querySelector(".project-backpack").dir = direction;
                }, { width, direction });
                assert.strictEqual(await page.$eval(signInPrompt, button => {
                    const rect = button.getBoundingClientRect();
                    const parent = button.parentElement.getBoundingClientRect();
                    return Math.abs((rect.left + rect.right) / 2 - (parent.left + parent.right) / 2) < 1;
                }), true);
            }
        }
        await page.focus(body);
        await page.keyboard.press("Tab");
        assert.strictEqual(await page.$eval(signInPrompt, button => button === document.activeElement), true);
        assert.strictEqual(await page.$eval(signInPrompt, button => getComputedStyle(button).outlineStyle), "solid");
        await page.keyboard.press("Enter");
        await page.keyboard.press("Space");
        assert.strictEqual(await page.evaluate(() => backpackTest.signIns), 2);
        const session = await page.createCDPSession();
        await session.send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
        assert.strictEqual(await page.$eval(signInPrompt, button => getComputedStyle(button).outlineStyle), "solid");
        await session.detach();
    });

    it("shows empty instructions and refreshes on open, not rerender or inactive notifications", async () => {
        await signIn();
        assert.match(await text(), /Your backpack is empty/);
        assert.match(await text(), /Right-click or hold.*Add to Backpack.*bubble/);
        assert.strictEqual(await page.$("header button"), null);
        assert.strictEqual(await page.$(retry), null);
        assert.doesNotMatch(await text(), /Refresh|up to date|syncs across devices/i);
        assert.strictEqual(await page.$eval('[role="status"]', element => element.getBoundingClientRect().height), 0);
        await page.evaluate(() => { backpackTest.rerender(); backpackTest.notify(); });
        assert.strictEqual(await page.evaluate(() => backpackTest.refreshes), 2);
        await page.evaluate(() => backpackTest.setActive(false));
        assert.strictEqual(await page.$eval("section", element => getComputedStyle(element).display), "none");
        await page.evaluate(() => { backpackTest.notify(); backpackTest.setActive(true); });
        await idle();
        assert.strictEqual(await page.evaluate(() => backpackTest.refreshes), 3);
    });

    it("does not fetch for an account selected while inactive and cleans up subscribers", async () => {
        await page.evaluate(() => backpackTest.setActive(false));
        await page.evaluate(() => backpackTest.account("A"));
        assert.strictEqual(await page.evaluate(() => backpackTest.refreshes), 1);
        await page.evaluate(() => backpackTest.setActive(true));
        await idle();
        await page.evaluate(() => ReactDOM.unmountComponentAtNode(document.getElementById("root")));
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.subscriberCount(), backpackTest.listenerCount()]), [0, 0]);
    });

    it("renders literal names, validated PNG previews, and only missing extension requirements", async () => {
        const snippet = item("<b>Jump</b>");
        snippet.previewUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
        snippet.dependencies = { core: "*", radio: "github:owner/radio#v1", other: "github:owner/other#v2", absent: "pub:example" };
        await page.evaluate(() => {
            backpackTest.pkg.mainPkg.deps = {
                core: { config: { name: "Core" }, version: () => "embed:core", verProtocol: () => "embed" },
                radio: { config: { name: "Radio extension" }, version: () => "github:OWNER/RADIO#v9", verProtocol: () => "github" },
                other: { config: { name: "Other extension" }, version: () => "github:unrelated/repository#v2", verProtocol: () => "github" }
            };
        });
        await signIn([snippet]);
        await page.waitForSelector("img");
        assert.strictEqual(await page.$("h3 b"), null);
        assert.strictEqual(await page.$eval("img", image => image.alt), "Blocks in <b>Jump</b>");
        const requirements = await page.$$eval(".project-backpack__requirements li", elements => elements.map(el => el.textContent));
        assert.deepStrictEqual(requirements, [
            "Other extension — github:owner/other#v2 — Missing from this project", "absent — pub:example — Missing from this project"
        ]);
        assert.doesNotMatch(await text(), /In this project/);
    });

    it("displays high-density PNGs at their original CSS size and keeps them within narrow cards", async () => {
        const previewUri = await page.evaluate(() => {
            const canvas = document.createElement("canvas");
            canvas.width = 400;
            canvas.height = 200;
            const context = canvas.getContext("2d");
            context.fillStyle = "#2196f3";
            context.fillRect(0, 0, canvas.width, canvas.height);
            return canvas.toDataURL("image/png");
        });
        for (const density of [1, 1.5, 2]) {
            await loadGuest([{ ...item(), previewUri, previewPixelDensity: density }]);
            await page.$eval("img", image => image.decode());
            await page.evaluate(() => { document.getElementById("root").style.width = "480px"; });
            for (const scale of [1, 2]) {
                await page.setViewport({ width: 600, height: 700, deviceScaleFactor: scale });
                const metrics = await page.$eval("img", image => ({
                    width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height,
                    source: image.currentSrc, density: image.srcset.split(" ").pop()
                }));
                const logicalScale = Math.min(1, 160 / (200 / density));
                assert.ok(Math.abs(metrics.width - 400 / density * logicalScale) < 1);
                assert.ok(Math.abs(metrics.height - 200 / density * logicalScale) < 1);
                assert.equal(metrics.source, previewUri);
                assert.equal(metrics.density, `${density}x`);
            }
            await page.evaluate(() => { document.getElementById("root").style.width = "180px"; });
            assert.equal(await page.$eval("img", image => image.getBoundingClientRect().width <= image.parentElement.clientWidth), true);
        }
    });

    it("fetches cloud previews only on intersection and revokes URLs on account changes", async () => {
        await page.evaluate(() => {
            window.IntersectionObserver = class {
                constructor(callback) { backpackTest.intersect = callback; }
                observe() {}
                disconnect() {}
            };
            const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
            backpackTest.urls = []; backpackTest.revoked = [];
            URL.createObjectURL = blob => { const url = create(blob); backpackTest.urls.push(url); return url; };
            URL.revokeObjectURL = url => { backpackTest.revoked.push(url); revoke(url); };
        });
        await signIn([{ ...item(), previewPixelDensity: 2,
            previewUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" }]);
        assert.equal(await page.evaluate(() => backpackTest.previewRequests || 0), 0);
        await page.evaluate(() => backpackTest.intersect([{ isIntersecting: true }]));
        await page.waitForSelector("img");
        assert.deepStrictEqual(await page.$eval("img", image => ({ src: image.getAttribute("src"), density: image.srcset.split(" ").pop() })),
            { src: null, density: "2x" });
        await page.evaluate(() => backpackTest.account("B"));
        await idle();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.revoked), await page.evaluate(() => backpackTest.urls));
        assert.strictEqual(await page.$("img"), null);
    });

    it("never reads or clears legacy preferences on open; cleanup requires its explicit dialog action", async () => {
        await signIn([item()]);
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.legacyExports || 0, backpackTest.legacyClears || 0]), [0, 0]);
        const legacy = 'button[aria-haspopup="dialog"]';
        await page.evaluate(selector => Array.from(document.querySelectorAll(selector)).find(button => button.textContent === "Old Backpack data…").click(), legacy);
        await page.waitForSelector(".common-modal-container");
        assert.match(await page.$eval(".common-modal-container", element => element.textContent), /does not transfer.*permanently removes/s);
        await page.keyboard.press("Escape");
        assert.equal(await page.evaluate(() => backpackTest.legacyClears || 0), 0);
        await page.evaluate(selector => Array.from(document.querySelectorAll(selector)).find(button => button.textContent === "Old Backpack data…").click(), legacy);
        await page.evaluate(() => Array.from(document.querySelectorAll(".common-modal-footer button"))
            .find(button => button.textContent === "Clear old Backpack data").click());
        await idle();
        assert.equal(await page.evaluate(() => backpackTest.legacyClears), 1);
        assert.deepStrictEqual(await visibleNames(), ["Jump"]);
    });

    it("hides the extension section when every requirement is installed without stripping import metadata", async () => {
        const snippet = { ...item(), dependencies: { core: "*", radio: "github:owner/radio#v1", shared: "pub:example" } };
        await page.evaluate(() => {
            backpackTest.pkg.mainPkg.deps = {
                core: { config: { name: "Core" }, version: () => "embed:core", verProtocol: () => "embed" },
                radio: { config: { name: "Radio extension" }, version: () => "github:OWNER/RADIO#v9", verProtocol: () => "github" },
                shared: { config: { name: "Shared extension" }, version: () => "pub:example", verProtocol: () => "pub" }
            };
        });
        await signIn([snippet]);
        assert.strictEqual(await page.$(".project-backpack__requirements"), null);
        assert.doesNotMatch(await text(), /Required extensions|In this project|Missing from this project/);
        assert.strictEqual(await page.$eval(add, button => button.disabled), false);
        await page.click(add);
        await idle();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds), [{ item: snippet, headerId: "project" }]);
    });

    it("updates missing extensions when the current project's installed packages change", async () => {
        const snippet = { ...item(), dependencies: { core: "*", radio: "github:owner/radio#v1" } };
        await page.evaluate(() => {
            backpackTest.pkg.mainPkg.deps.core = { config: { name: "Core" }, version: () => "embed:core", verProtocol: () => "embed" };
        });
        await loadGuest([snippet]);
        assert.deepStrictEqual(await page.$$eval(".project-backpack__requirements li", elements => elements.map(el => el.textContent)),
            ["radio — github:owner/radio#v1 — Missing from this project"]);
        const refreshes = await page.evaluate(() => backpackTest.refreshes);
        await page.evaluate(() => {
            backpackTest.pkg.mainPkg.deps.radio = {
                config: { name: "Radio extension" }, version: () => "github:owner/radio#v1", verProtocol: () => "github"
            };
            backpackTest.notify();
        });
        assert.strictEqual(await page.$(".project-backpack__requirements"), null);
        assert.doesNotMatch(await text(), /Required extensions/);
        await page.evaluate(() => { delete backpackTest.pkg.mainPkg.deps.core; backpackTest.notify(); });
        assert.deepStrictEqual(await page.$$eval(".project-backpack__requirements li", elements => elements.map(el => el.textContent)),
            ["core — * — Missing from this project"]);
        assert.strictEqual(await page.evaluate(() => backpackTest.refreshes), refreshes);
    });

    it("omits source requirements for absent or empty projectBlocks", async () => {
        await signIn([item(), { ...item("Run", "00000000-0000-0000-0000-000000000002"), projectBlocks: {} }]);
        assert.strictEqual((await page.$$(entry)).length, 2);
        assert.strictEqual(await page.$(".project-backpack__requirements"), null);
        assert.doesNotMatch(await text(), /project-defined blocks|source code is not included/);
        assert.strictEqual(await page.$$eval(add, buttons => buttons.every(button => !button.disabled)), true);
    });

    it("lists unique literal source filenames alongside extensions and forwards metadata on add", async () => {
        const snippet = { ...item(), projectBlocks: {
            custom_block: "custom.ts", another_block: "custom.ts", helper_block: "<b>helpers</b>.ts"
        }, dependencies: { core: "*" } };
        await signIn([snippet]);
        assert.strictEqual(await page.$eval("p.project-backpack__requirements", element => element.textContent),
            "Uses project-defined blocks from custom.ts, <b>helpers</b>.ts. Their source code is not included.");
        assert.strictEqual(await page.$(".project-backpack__requirements b"), null);
        assert.match(await text(), /Required extensions/);
        assert.strictEqual(await page.$eval(".project-backpack__requirements li", element => element.textContent),
            "core — * — Missing from this project");
        // The panel explains requirements; the real project importer owns consent
        // and the missing-source popup (covered in backpack-project.spec.js).
        assert.strictEqual(await page.$eval(add, button => button.disabled), false);
        await page.click(add);
        await idle();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds), [{ item: snippet, headerId: "project" }]);
        assert.strictEqual(await page.$('[role="alert"]'), null);
    });

    it("places labeled icon-only Rename and Delete controls in reading and keyboard order", async () => {
        await signIn([item("character setup")]);
        assert.strictEqual(await page.$(`${entry} .project-backpack__actions .project-backpack__icon-button`), null);
        assert.ok(await page.$(`${entry} .project-backpack__item-header ${rename}`));
        assert.ok(await page.$(`${entry} .project-backpack__item-header ${remove}`));
        assert.strictEqual(await page.$$eval(`${entry} .project-backpack__actions button`, buttons => buttons.length), 1);
        for (const [selector, label, icon] of [[rename, "Rename character setup", "pencil"], [remove, "Delete character setup", "trash"]]) {
            assert.deepStrictEqual(await page.$eval(selector, button => ({
                text: button.textContent.trim(), label: button.getAttribute("aria-label"), title: button.title,
                icon: button.querySelector("i")?.className, hiddenIcon: button.querySelector("i")?.getAttribute("aria-hidden"),
                popup: button.getAttribute("aria-haspopup"), width: button.getBoundingClientRect().width,
                height: button.getBoundingClientRect().height
            })), { text: "", label, title: label, icon: `icon ${icon}`, hiddenIcon: "true", popup: "dialog", width: 44, height: 44 });
        }
        const accessibility = await page.accessibility.snapshot({ interestingOnly: false });
        const buttonNames = node => (node.role === "button" ? [node.name] : []).concat((node.children || []).flatMap(buttonNames));
        const names = buttonNames(accessibility);
        assert.ok(names.includes("Rename character setup"));
        assert.ok(names.includes("Delete character setup"));
        await page.focus(body);
        for (const selector of [rename, remove, add]) {
            await page.keyboard.press("Tab");
            assert.strictEqual(await page.$eval(selector, element => element === document.activeElement), true);
            assert.strictEqual(await page.$eval(selector, element => getComputedStyle(element).outlineStyle), "solid");
        }
    });

    it("keeps both icons at the top trailing edge and Add at the bottom trailing edge with long names, narrow panels and RTL", async () => {
        await signIn([item("character setup"), item("x".repeat(100), "00000000-0000-0000-0000-000000000002")]);
        for (const width of [180, 320, 480]) {
            for (const direction of ["ltr", "rtl"]) {
                await page.evaluate(({ width, direction }) => {
                    document.getElementById("root").style.width = `${width}px`;
                    document.querySelector("section").dir = direction;
                }, { width, direction });
                const metrics = await page.$$eval(".project-backpack__item", (items, direction) => items.map(item => {
                    const header = item.querySelector(".project-backpack__item-header").getBoundingClientRect();
                    const name = item.querySelector("h3").getBoundingClientRect();
                    const rename = item.querySelector(".project-backpack__rename").getBoundingClientRect();
                    const trash = item.querySelector(".project-backpack__delete").getBoundingClientRect();
                    const actions = item.querySelector(".project-backpack__item-actions").getBoundingClientRect();
                    const footer = item.querySelector(".project-backpack__actions").getBoundingClientRect();
                    const add = item.querySelector(".project-backpack__add").getBoundingClientRect();
                    return {
                        top: Math.abs(rename.top - header.top) < 1 && Math.abs(trash.top - header.top) < 1,
                        opposite: direction === "rtl" ? actions.right <= name.left : actions.left >= name.right,
                        trailing: Math.abs(direction === "rtl" ? trash.left - header.left : trash.right - header.right) < 1,
                        grouped: direction === "rtl" ? trash.right === rename.left : rename.right === trash.left,
                        bottom: add.top >= header.bottom && Math.abs(add.bottom - footer.bottom) < 1,
                        addTrailing: Math.abs(direction === "rtl" ? add.left - footer.left : add.right - footer.right) < 1,
                        fits: item.scrollWidth <= item.clientWidth,
                        touch: [rename, trash, add].every(rect => rect.width >= 44 && rect.height >= 44)
                    };
                }), direction);
                assert.deepStrictEqual(metrics, Array(2).fill({ top: true, opposite: true, trailing: true, grouped: true,
                    bottom: true, addTrailing: true, fits: true, touch: true }));
            }
        }
    });

    it("uses a filled confirmation button for Add with themed hover, focus and disabled states", async () => {
        await signIn([item()]);
        for (const dark of [false, true]) {
            const background = dark ? "rgb(122, 162, 247)" : "rgb(0, 120, 212)";
            const hover = dark ? "rgb(143, 180, 255)" : "rgb(2, 110, 193)";
            const color = dark ? "rgb(22, 22, 30)" : "rgb(255, 255, 255)";
            const disabledBackground = dark ? "rgb(45, 45, 45)" : "rgb(221, 221, 221)";
            const disabledColor = dark ? "rgb(243, 242, 241)" : "rgb(102, 102, 102)";
            await page.evaluate(({ dark, background, hover, color, disabledBackground, disabledColor }) => {
                const section = document.querySelector("section");
                section.style.setProperty("--tools-surface", dark ? "rgb(25, 25, 25)" : "rgb(250, 250, 250)");
                section.style.setProperty("--tools-foreground", dark ? "rgb(250, 250, 250)" : "rgb(25, 25, 25)");
                section.style.setProperty("--tools-accent", background);
                section.style.setProperty("--tools-on-accent", color);
                section.style.setProperty("--pxt-primary-background-hover", hover);
                section.style.setProperty("--pxt-primary-foreground-hover", color);
                section.style.setProperty("--pxt-neutral-background3", disabledBackground);
                section.style.setProperty("--pxt-neutral-foreground3", disabledColor);
                backpackTest.canImport = true;
                backpackTest.notify();
            }, { dark, background, hover, color, disabledBackground, disabledColor });
            await page.hover("h3");
            assert.deepStrictEqual(await page.$eval(add, button => {
                const style = getComputedStyle(button);
                return { text: button.textContent, background: style.backgroundColor, border: style.borderTopStyle, borderColor: style.borderTopColor,
                    color: style.color, weight: style.fontWeight, underline: style.textDecorationLine.includes("underline") };
            }), { text: "Add to project", background, border: "solid", borderColor: background, color, weight: "600", underline: false });
            assert.ok((await contrastSamples(page, add))[0].contrast >= 4.5);
            await page.hover(add);
            assert.deepStrictEqual(await page.$eval(add, button => {
                const style = getComputedStyle(button);
                return { background: style.backgroundColor, color: style.color, underline: style.textDecorationLine.includes("underline") };
            }), { background: hover, color, underline: false });
            assert.ok((await contrastSamples(page, add))[0].contrast >= 4.5);
            await page.focus(body);
            for (let i = 0; i < 3; ++i) await page.keyboard.press("Tab");
            assert.strictEqual(await page.$eval(add, button => button === document.activeElement && getComputedStyle(button).outlineStyle === "solid"), true);
            await page.evaluate(() => { backpackTest.canImport = false; backpackTest.notify(); });
            assert.deepStrictEqual(await page.$eval(add, button => ({
                disabled: button.disabled, background: getComputedStyle(button).backgroundColor,
                color: getComputedStyle(button).color, border: getComputedStyle(button).borderTopStyle,
                description: button.getAttribute("aria-describedby")
            })), { disabled: true, background: disabledBackground, color: disabledColor, border: "dashed", description: "project-backpack-import-reason" });
            await page.click(add);
            assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds), []);
        }
        const session = await page.createCDPSession();
        await session.send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
        await page.evaluate(() => { backpackTest.canImport = true; backpackTest.notify(); });
        await page.focus(body);
        for (let i = 0; i < 3; ++i) await page.keyboard.press("Tab");
        assert.strictEqual(await page.$eval(add, button => button === document.activeElement && getComputedStyle(button).outlineStyle === "solid"), true);
        assert.ok((await contrastSamples(page, add))[0].contrast >= 4.5);
        await session.detach();
    });

    for (const signedIn of [false, true]) {
        it(`offers optional ${signedIn ? "profile" : "guest"} renaming without changing blocks or requiring a name on add`, async () => {
            const snippet = { ...item("on start"), dependencies: { core: "*" }, projectBlocks: { custom: "custom.ts" },
                previewUri: "data:image/png;base64,iVBORw0KGgo=" };
            if (signedIn) await signIn([snippet]);
            else await loadGuest([snippet]);
            assert.strictEqual(await page.$(renameModal), null);
            assert.strictEqual(await page.$eval("h3", element => element.textContent), "on start");
            await page.click(add);
            await idle();
            assert.strictEqual(await page.$(renameModal), null);
            assert.deepStrictEqual(await page.evaluate(() => backpackTest.renames), []);
            await page.focus(rename);
            await page.keyboard.press("Enter");
            assert.deepStrictEqual(await page.$eval(nameInput, input => ({
                value: input.value, focused: input === document.activeElement,
                selection: [input.selectionStart, input.selectionEnd], max: input.maxLength,
                label: input.labels[0].textContent
            })), { value: "on start", focused: true, selection: [0, 8], max: 100, label: "Snippet name" });
            await page.keyboard.type("  character setup  ");
            if (signedIn) await page.click(saveName);
            else await page.keyboard.press("Enter");
            await idle();
            await modalClosed();
            assert.strictEqual(await page.$eval("h3", element => element.textContent), "character setup");
            assert.strictEqual(await page.$eval(rename, button => button === document.activeElement), true);
            const renamed = { ...snippet, name: "character setup" };
            assert.deepStrictEqual(await page.evaluate(() => backpackTest.remote[backpackTest.storeKey()]), [renamed]);
            assert.strictEqual(await page.$eval("img", image => image.alt), "Blocks in character setup");
            await reopen();
            await idle();
            assert.strictEqual(await page.$eval("h3", element => element.textContent), "character setup");
            await page.click(add);
            await idle();
            assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds),
                [{ item: snippet, headerId: "project" }, { item: renamed, headerId: "project" }]);
            assert.strictEqual(await page.evaluate(() => backpackTest.signIns), 0);
            assert.doesNotMatch(await text(), /Renamed|Renaming/);
        });
    }

    it("cancels renaming with Cancel, Close or Escape and traps focus without closing the Backpack", async () => {
        await loadGuest([item("on start")]);
        assert.strictEqual(await page.$eval(rename, button => button.getAttribute("aria-haspopup")), "dialog");
        for (const dismiss of ["Cancel", "Close", "Escape"]) {
            await page.evaluate(() => { backpackTest.modalEvents = []; });
            await page.click(rename);
            await page.keyboard.type("discard this name");
            const accessibility = await page.accessibility.snapshot({ interestingOnly: false });
            const find = (node, role) => node.role === role ? node : (node.children || []).map(child => find(child, role)).find(Boolean);
            assert.strictEqual(find(accessibility, "dialog")?.name, "Rename snippet");
            assert.strictEqual(find(accessibility, "textbox")?.name, "Snippet name");
            assert.strictEqual(await page.$eval("#root", root => root.getAttribute("aria-hidden")), "true");
            const events = await page.evaluate(() => backpackTest.modalEvents);
            assert.deepStrictEqual(events[0], { type: "change", open: true });
            assert.ok(events.filter(event => event.type === "focus").every(event => event.open));
            for (const selector of [cancelName, saveName, closeName, nameInput]) {
                await page.keyboard.press("Tab");
                assert.strictEqual(await page.$eval(selector, element => element === document.activeElement), true);
            }
            if (dismiss === "Escape") await page.keyboard.press("Escape");
            else await page.click(dismiss === "Cancel" ? cancelName : closeName);
            await modalClosed();
            assert.strictEqual(await page.$eval(rename, button => button === document.activeElement), true);
            assert.strictEqual(await page.$eval("h3", element => element.textContent), "on start");
            assert.deepStrictEqual(await page.evaluate(() => backpackTest.renames), []);
        }
    });

    it("validates blank names in the dialog, bounds input length, and lets the user correct the name", async () => {
        await loadGuest([item()]);
        await page.click(rename);
        await page.keyboard.type("   ");
        await page.keyboard.press("Enter");
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
        await page.click(saveName);
        await idle();
        await modalClosed();
        assert.strictEqual(await page.$eval("h3", element => element.textContent), "x".repeat(100));
    });

    it("keeps rename errors and drafts in the modal, prevents duplicate submits, and retries without renaming blocks", async () => {
        await signIn([item()]);
        await page.click(rename);
        await page.keyboard.type("<b>character setup</b>");
        await page.evaluate(() => { backpackTest.failRename = true; backpackTest.hold(); });
        await page.click(saveName);
        assert.strictEqual(await page.$eval(nameInput, input => input.disabled), true);
        assert.strictEqual(await page.$$eval("#root button", buttons => buttons.every(button => button.disabled)), true);
        assert.strictEqual(await page.$(closeName), null);
        for (const selector of [cancelName, saveName]) await page.click(selector);
        await page.keyboard.press("Enter");
        await page.keyboard.press("Escape");
        assert.ok(await page.$(renameModal));
        assert.strictEqual(await page.evaluate(() => backpackTest.renames.length), 1);
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.strictEqual(await page.$eval(nameInput, input => input.value), "<b>character setup</b>");
        assert.match(await page.$eval(`${renameModal} [role="alert"]`, element => element.textContent), /Rename failed/);
        assert.strictEqual(await page.$eval("h3", element => element.textContent), "Jump");
        await page.evaluate(() => { backpackTest.failRename = false; });
        await page.click(saveName);
        await idle();
        await modalClosed();
        assert.strictEqual(await page.$eval("h3", element => element.textContent), "<b>character setup</b>");
        assert.strictEqual(await page.$("h3 b"), null);
        assert.strictEqual(await page.$eval(rename, button => button === document.activeElement), true);
    });

    it("allows renaming outside an editable Blocks project and clears abandoned dialogs", async () => {
        await loadGuest([item()]);
        await page.evaluate(() => { backpackTest.canImport = false; backpackTest.readOnly = true; backpackTest.notify(); });
        assert.strictEqual(await page.$eval(rename, button => button.disabled), false);
        await page.click(rename);
        await page.keyboard.type("discard on close");
        await page.evaluate(() => backpackTest.setActive(false));
        await modalClosed();
        await page.evaluate(() => backpackTest.setActive(true));
        await idle();
        await page.click(rename);
        assert.strictEqual(await page.$eval(nameInput, input => input.value), "Jump");
        await page.keyboard.type("character setup");
        await page.keyboard.press("Enter");
        await idle();
        await modalClosed();
        assert.strictEqual(await page.$eval(rename, button => button === document.activeElement), true);
    });

    it("discards an old account's rename completion without affecting a new account's dialog", async () => {
        await signIn([item("Account A")]);
        await page.click(rename);
        await page.keyboard.type("Old draft");
        await page.evaluate(() => { backpackTest.failRename = true; backpackTest.hold(); });
        await page.click(saveName);
        await page.evaluate(snippet => {
            backpackTest.gate = undefined;
            backpackTest.failRename = false;
            backpackTest.remote.B = [snippet];
            backpackTest.account("B");
        }, item("Account B"));
        await idle();
        await modalClosed();
        assert.doesNotMatch(await text(), /Account A|Old draft/);
        await page.click(rename);
        await page.keyboard.type("New draft");
        await page.evaluate(() => backpackTest.release());
        assert.strictEqual(await page.$('[role="alert"]'), null);
        assert.strictEqual(await page.$eval(nameInput, input => input.value), "New draft");
        assert.strictEqual(await page.$eval(nameInput, input => input === document.activeElement), true);
        await page.click(cancelName);
        await modalClosed();
    });

    it("keeps the rename form touch-sized, responsive, and themed with visible keyboard focus", async () => {
        await loadGuest([item()]);
        await page.click(rename);
        for (const dark of [false, true]) {
            await page.evaluate(dark => {
                document.documentElement.style.setProperty("--pxt-neutral-background1", dark ? "rgb(25, 25, 25)" : "rgb(250, 250, 250)");
                document.documentElement.style.setProperty("--pxt-neutral-foreground1", dark ? "rgb(250, 250, 250)" : "rgb(25, 25, 25)");
                document.documentElement.style.setProperty("--pxt-focus-border", dark ? "white" : "black");
            }, dark);
            const metrics = await page.$eval(nameInput, input => ({
                height: input.getBoundingClientRect().height >= 44,
                fits: input.closest(".common-modal").scrollWidth <= input.closest(".common-modal").clientWidth,
                color: getComputedStyle(input).color, background: getComputedStyle(input).backgroundColor,
                focus: getComputedStyle(input).outlineStyle
            }));
            assert.deepStrictEqual(metrics, { height: true, fits: true,
                color: dark ? "rgb(250, 250, 250)" : "rgb(25, 25, 25)",
                background: dark ? "rgb(25, 25, 25)" : "rgb(250, 250, 250)", focus: "solid" });
        }
        const session = await page.createCDPSession();
        await session.send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
        assert.strictEqual(await page.$eval(nameInput, input => getComputedStyle(input).outlineStyle), "solid");
        await session.detach();
        await page.keyboard.press("Escape");
        await modalClosed();
    });

    it("reports invalid source metadata with a named trash-only recovery card", async () => {
        await signIn([{ ...item(), projectBlocks: { custom_block: 7 } }]);
        assert.match(await page.$eval(".project-backpack__invalid", element => element.textContent), /invalid or oversized/);
        assert.deepStrictEqual(await visibleNames(), ["Jump"]);
        assert.strictEqual(await page.$(add), null);
        assert.strictEqual(await page.$(rename), null);
        assert.strictEqual(await page.$eval(remove, button => button.disabled), false);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds), []);
    });

    it("rejects non-PNG previews rather than injecting image or SVG markup", async () => {
        await signIn([{ ...item(), previewUri: "data:image/svg+xml,<svg onload='alert(1)'/>" }]);
        assert.match(await page.$eval(".project-backpack__invalid", element => element.textContent), /invalid or oversized/);
        assert.strictEqual(await page.$("img, svg"), null);
        assert.strictEqual(await page.$eval(remove, button => button.disabled), false);
    });

    for (const cloud of [false, true]) {
        it(`keeps valid ${cloud ? "synced" : "guest"} snippets usable beside named recovery cards and deletes only the invalid item`, async () => {
            const valid = item("Character setup");
            const invalid = { ...item("Damaged startup", "00000000-0000-0000-0000-000000000002"),
                blockText: undefined, previewUri: "https://invalid.example/private.png", code: "PRIVATE_INVALID_CODE" };
            if (cloud) await signIn([invalid, valid]);
            else await loadGuest([invalid, valid]);
            const card = '.project-backpack__item--invalid';
            const trash = `${card} ${remove}`;
            assert.deepStrictEqual(await visibleNames(), [invalid.name, valid.name]);
            assert.strictEqual(await page.$(retry), null);
            assert.doesNotMatch(await text(), /by ID|PRIVATE_INVALID_CODE|invalid.example/);
            assert.strictEqual(await page.$(`${card} img, ${card} ${add}, ${card} ${rename}`), null);
            assert.strictEqual(await page.$eval(trash, button => button.getAttribute("aria-label")), "Delete Damaged startup");
            await page.click(add);
            await idle();
            assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds.map(add => add.item)), [valid]);
            await searchFor("damaged");
            assert.deepStrictEqual(await visibleNames(), [invalid.name]);
            await page.click(trash);
            assert.match(await modalText(), cloud ? /on all devices/ : /in this browser/);
            await page.keyboard.press("Escape");
            await modalClosed();
            assert.strictEqual(await page.$eval(trash, button => button === document.activeElement), true);
            assert.deepStrictEqual(await page.evaluate(() => backpackTest.deletes), []);
            await page.keyboard.press("Enter");
            await page.evaluate(() => { backpackTest.failDelete = true; });
            await page.click(confirmDelete);
            await idle();
            assert.match(await modalText(), /Delete failed/);
            assert.strictEqual(await page.$$eval(card, cards => cards.length), 1);
            await page.evaluate(() => { backpackTest.failDelete = false; });
            await page.click(confirmDelete);
            await idle();
            await modalClosed();
            assert.strictEqual(await page.$(card), null);
            assert.strictEqual(await page.$eval(searchBox, input => input === document.activeElement), true);
            await page.click(clearSearch);
            assert.deepStrictEqual(await visibleNames(), [valid.name]);
            await reopen();
            await idle();
            assert.deepStrictEqual(await visibleNames(), [valid.name]);
            assert.deepStrictEqual(await page.evaluate(() => backpackTest.deletedEntries),
                Array(2).fill({ id: invalid.id, source: cloud ? "cloud" : "local" }));
        });
    }

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
        await quiet();
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.match(await text(), /Import failed/);
        await page.evaluate(() => { backpackTest.failAdd = false; });
        await page.click(add);
        await idle();
        assert.strictEqual(await page.$('[role="alert"]'), null);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds), [{ item: snippet, headerId: "project" }, { item: snippet, headerId: "project" }]);
    });

    it("silently cancels an import returning false and leaves the snippet usable", async () => {
        await loadGuest([item()]);
        await page.evaluate(() => { backpackTest.importResult = false; backpackTest.hold(); });
        await page.click(add);
        await quiet();
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

    it("explains Blocks versus tutorial/read-only restrictions and responds to editor changes", async () => {
        await signIn([item()]);
        await page.evaluate(() => { backpackTest.canImport = false; backpackTest.editor = "tsprj"; backpackTest.notify(); });
        assert.match(await text(), /Switch to Blocks to add snippets/);
        assert.strictEqual(await page.$eval(add, element => element.disabled), true);
        for (const reason of ["tutorial", "readOnly"]) {
            await page.evaluate(reason => {
                backpackTest.header.tutorial = reason === "tutorial" ? {} : undefined;
                backpackTest.readOnly = reason === "readOnly";
                backpackTest.notify();
            }, reason);
            assert.match(await text(), /Open an editable Blocks project outside a tutorial/);
        }
    });

    it("clears cached entries during a failed refresh and supports manual retry", async () => {
        await signIn([item()]);
        await page.evaluate(() => { backpackTest.failRefresh = true; backpackTest.hold(); });
        await reopen();
        assert.strictEqual(await page.$(entry), null);
        assert.match(await text(), /Loading backpack/);
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.match(await text(), /Sync failed/);
        assert.strictEqual(await page.$(entry), null);
        await page.evaluate(() => { backpackTest.failRefresh = false; });
        await page.click(retry);
        await idle();
        assert.strictEqual((await page.$$(entry)).length, 1);
        assert.strictEqual(await page.$('[role="alert"]'), null);
        assert.strictEqual(await page.$(retry), null);
        assert.strictEqual(await page.$eval(body, element => element === document.activeElement), true);
    });

    it("refreshes acknowledged additions and removals from another device on reopen", async () => {
        await signIn([item()]);
        await page.evaluate(snippet => { backpackTest.remote.A = [snippet]; }, item("Other device"));
        await reopen();
        await idle();
        assert.strictEqual(await page.$eval("h3", element => element.textContent), "Other device");
        await page.evaluate(() => { backpackTest.remote.A = []; });
        await reopen();
        await idle();
        assert.match(await text(), /Your backpack is empty/);
    });

    it("confirms in an accessible covered portal and cancels by Cancel, Close, and Escape without collapsing", async () => {
        await signIn([item()]);
        assert.strictEqual(await page.$eval(remove, button => button.getAttribute("aria-haspopup")), "dialog");
        for (const dismiss of ["Escape", "Cancel", "Close"]) {
            await page.evaluate(() => { backpackTest.modalEvents = []; });
            await page.focus(remove);
            await page.keyboard.press(dismiss === "Cancel" ? "Space" : "Enter");
            assert.match(await modalText(), /Delete Jump from your backpack on all devices\?/);
            assert.doesNotMatch(await text(), /Delete snippet\?|on all devices\?/);
            assert.strictEqual(await page.$eval(confirm, element => element === document.activeElement), true);
            assert.deepStrictEqual(await page.$eval(dialog, element => ({
                title: document.getElementById(element.getAttribute("aria-labelledby"))?.textContent,
                description: document.getElementById(element.getAttribute("aria-describedby"))?.textContent,
                inRoot: document.getElementById("root").contains(element),
                hidden: document.getElementById("root").getAttribute("aria-hidden"),
                outsideHidden: document.getElementById("outside").getAttribute("aria-hidden")
            })), { title: "Delete snippet?", description: "Delete Jump from your backpack on all devices?",
                inRoot: false, hidden: "true", outsideHidden: "true" });
            const accessibility = await page.accessibility.snapshot({ interestingOnly: false });
            const accessibleDialog = node => node.role === "dialog" ? node : (node.children || []).map(accessibleDialog).find(Boolean);
            assert.strictEqual(accessibleDialog(accessibility)?.name, "Delete snippet?");
            assert.strictEqual(accessibleDialog(accessibility)?.description, "Delete Jump from your backpack on all devices?");
            assert.deepStrictEqual(await page.$eval(confirm, overlay => {
                const rect = overlay.getBoundingClientRect();
                return { position: getComputedStyle(overlay).position, background: getComputedStyle(overlay).backgroundColor,
                    covers: rect.left === 0 && rect.top === 0 && rect.right === innerWidth && rect.bottom === innerHeight,
                    hit: document.elementFromPoint(1, 1) === overlay };
            }), { position: "fixed", background: "rgba(0, 0, 0, 0.5)", covers: true, hit: true });
            const events = await page.evaluate(() => backpackTest.modalEvents);
            assert.deepStrictEqual(events[0], { type: "change", open: true });
            assert.ok(events.some(event => event.type === "focus"));
            assert.ok(events.filter(event => event.type === "focus").every(event => event.open));
            // The real FocusTrap focuses its container, then cycles Close/Cancel/Delete.
            for (const selector of [close, cancel, confirmDelete, close]) {
                await page.keyboard.press("Tab");
                assert.strictEqual(await page.$eval(selector, element => element === document.activeElement), true);
            }
            await page.keyboard.down("Shift");
            await page.keyboard.press("Tab");
            await page.keyboard.up("Shift");
            assert.strictEqual(await page.$eval(confirmDelete, element => element === document.activeElement), true);
            if (dismiss === "Escape") await page.keyboard.press("Escape");
            else if (dismiss === "Close") await page.click(close);
            else {
                await page.focus(cancel);
                await page.keyboard.press("Enter");
            }
            await modalClosed();
            assert.strictEqual(await page.$eval(remove, element => element === document.activeElement), true);
            assert.strictEqual((await page.$$(entry)).length, 1);
            assert.deepStrictEqual(await page.evaluate(() => backpackTest.deletes), []);
        }
    });

    it("retains the entry and confirmation after delete failure, then retries and focuses the next entry", async () => {
        await signIn([item(), item("Run", "00000000-0000-0000-0000-000000000002")]);
        await page.click(remove);
        await page.evaluate(() => { backpackTest.failDelete = true; backpackTest.hold(); });
        await page.click(confirmDelete);
        assert.strictEqual((await page.$$(entry)).length, 2);
        assert.strictEqual(await page.$$eval("#root button", elements => elements.every(button => button.disabled)), true);
        assert.deepStrictEqual(await page.$$eval(`${confirm} button`, buttons => buttons.map(button => ({
            label: button.textContent, disabledClass: button.classList.contains("disabled"),
            nativeDisabled: button.disabled, tabIndex: button.tabIndex
        }))), [
            { label: "Cancel", disabledClass: true, nativeDisabled: false, tabIndex: -1 },
            { label: "Delete", disabledClass: true, nativeDisabled: false, tabIndex: -1 }
        ]);
        assert.strictEqual(await page.$(close), null);
        assert.strictEqual(await page.$eval(`${dialog} [aria-busy]`, element => element.getAttribute("aria-busy")), "true");
        await quiet();
        await page.click(cancel);
        await page.click(confirmDelete);
        await page.keyboard.press("Enter");
        await page.keyboard.press("Space");
        await page.keyboard.press("Escape");
        assert.ok(await page.$(confirm));
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.deletes), [item().id]);
        assert.strictEqual(await page.evaluate(() => backpackTest.escapes), 0);
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.match(await modalText(), /Delete failed/);
        assert.strictEqual(await page.$('#root [role="alert"]'), null);
        assert.strictEqual(await page.$eval(`${confirm} [role="alert"]`, element => element.innerText), "Delete failed. Try again.");
        assert.strictEqual(await page.$$eval(`${confirm} button`, buttons => buttons.every(button => !button.classList.contains("disabled"))), true);
        assert.ok(await page.$(close));
        assert.strictEqual((await page.$$(entry)).length, 2);
        assert.ok(await page.$(confirm));
        await page.evaluate(() => { backpackTest.failDelete = false; });
        await page.click(confirmDelete);
        await idle();
        assert.strictEqual((await page.$$(entry)).length, 1);
        assert.strictEqual(await page.$eval(rename, element => element === document.activeElement), true);
        await modalClosed();
    });

    it("focuses the next available action when import is unavailable and the panel after the last deletion", async () => {
        await signIn([item(), item("Run", "00000000-0000-0000-0000-000000000002")]);
        await page.evaluate(() => { backpackTest.canImport = false; backpackTest.notify(); });
        // Deleting the last row falls back to its previous neighbor.
        await page.click(`${entry}:last-child ${remove}`);
        await page.click(confirmDelete);
        await idle();
        await modalClosed();
        assert.strictEqual(await page.$eval(rename, element => element === document.activeElement), true);
        await page.click(remove);
        await page.click(confirmDelete);
        await idle();
        await modalClosed();
        assert.strictEqual(await page.$eval(body, element => element === document.activeElement && element.tabIndex === -1), true);
    });

    it("cleans up modal callbacks and background hiding on inactivity and unmount, including a pending deletion", async () => {
        await signIn([item()]);
        await page.click(remove);
        await page.evaluate(() => backpackTest.setActive(false));
        await modalClosed();
        assert.strictEqual(await page.$eval("section", element => element.hidden), true);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.deletes), []);
        await page.evaluate(() => backpackTest.setActive(true));
        await idle();
        assert.strictEqual((await page.$$(entry)).length, 1);
        for (const pending of [false, true]) {
            await page.click(remove);
            if (pending) {
                await page.evaluate(() => { backpackTest.failDelete = true; backpackTest.hold(); });
                await page.click(confirmDelete);
            }
            await page.evaluate(() => ReactDOM.unmountComponentAtNode(document.getElementById("root")));
            await modalClosed();
            assert.deepStrictEqual(await page.evaluate(() => [backpackTest.subscriberCount(), backpackTest.listenerCount()]), [0, 0]);
            if (pending) {
                const events = await page.evaluate(() => backpackTest.modalEvents);
                await page.focus("#outside");
                await page.evaluate(() => backpackTest.release());
                assert.deepStrictEqual(await page.evaluate(() => backpackTest.modalEvents), events);
                assert.strictEqual(await page.$('[role="alert"]'), null);
                assert.strictEqual(await page.$eval("#outside", button => button === document.activeElement), true);
            }
            else {
                await page.evaluate(() => backpackTest.mount());
                await idle();
            }
        }
    });

    it("hides a previous account immediately and ignores its late async error", async () => {
        await signIn([item("Account A private")]);
        await page.evaluate(() => { backpackTest.failAdd = true; backpackTest.hold(); });
        await page.click(add);
        await page.evaluate(snippet => { backpackTest.remote.B = [snippet]; backpackTest.account("B"); }, item("Account B private"));
        assert.doesNotMatch(await text(), /Account A private/);
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.match(await text(), /Account B private/);
        assert.strictEqual(await page.$('[role="alert"]'), null);
        await page.evaluate(() => backpackTest.account(undefined));
        assert.doesNotMatch(await text(), /Account B private/);
        assert.match(await text(), /Sign in/);
    });

    it("ignores an old account refresh even if that account is selected again", async () => {
        await page.evaluate(() => { backpackTest.failRefresh = true; backpackTest.hold(); backpackTest.account("A"); });
        await page.evaluate(() => backpackTest.account("B"));
        await page.evaluate(snippet => {
            backpackTest.failRefresh = false;
            backpackTest.remote.A = [snippet];
            backpackTest.account("A");
        }, item("Fresh account A"));
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.match(await text(), /Fresh account A/);
        assert.strictEqual(await page.$('[role="alert"]'), null);
    });

    for (const [from, to] of [[undefined, "A"], ["A", undefined], ["A", "B"]]) {
        it(`resets pending state from ${from || "guest"} to ${to || "guest"} and ignores the old import error`, async () => {
            if (from) await signIn([item("Old contents")]);
            else await loadGuest([item("Old contents")]);
            await page.evaluate(() => { backpackTest.failAdd = true; backpackTest.hold(); });
            await page.click(add);
            assert.strictEqual(await page.$eval(add, button => button.disabled), true);
            await page.evaluate(({ to, snippet }) => {
                backpackTest.gate = undefined;
                backpackTest.failAdd = false;
                backpackTest.remote[to || "__guest__"] = [snippet];
                backpackTest.account(to);
            }, { to, snippet: item("New contents") });
            await idle();
            assert.doesNotMatch(await text(), /Old contents|Import failed/);
            assert.match(await text(), /New contents/);
            assert.strictEqual(await page.$eval(add, button => button.disabled), false);
            // The new session works without waiting for the abandoned operation.
            await page.click(add);
            await idle();
            assert.strictEqual(await page.$('[role="alert"]'), null);
            await page.evaluate(() => backpackTest.release());
            assert.strictEqual(await page.$('[role="alert"]'), null);
            await quiet();
            assert.strictEqual(await page.$eval(add, button => button.disabled), false);
        });

        it(`unmounts the modal from ${from || "guest"} to ${to || "guest"} and ignores late delete success/error`, async () => {
            for (const fail of [false, true]) {
                await page.evaluate(({ from, snippet }) => {
                    backpackTest.remote[from || "__guest__"] = [snippet];
                    backpackTest.account(from);
                }, { from, snippet: item("Old contents") });
                await reopen();
                await idle();
                await page.click(remove);
                await page.evaluate(fail => { backpackTest.failDelete = fail; backpackTest.hold(); }, fail);
                await page.click(confirmDelete);
                await page.evaluate(({ to, snippet }) => {
                    backpackTest.gate = undefined;
                    backpackTest.failDelete = false;
                    backpackTest.remote[to || "__guest__"] = [snippet];
                    backpackTest.account(to);
                }, { to, snippet: item("New contents") });
                assert.strictEqual(await page.$(confirm), null);
                assert.doesNotMatch(await text(), /Old contents/);
                await idle();
                await modalClosed();
                assert.strictEqual(await page.$eval(add, button => button.disabled), false);
                // An old completion must neither close a new dialog nor replace
                // its error/pending state or focus with the old account's state.
                await page.click(remove);
                assert.match(await modalText(), /New contents/);
                await page.focus(cancel);
                const events = await page.evaluate(() => backpackTest.modalEvents);
                await page.evaluate(() => backpackTest.release());
                assert.deepStrictEqual(await page.evaluate(() => backpackTest.modalEvents), events);
                assert.match(await modalText(), /New contents/);
                assert.strictEqual(await page.$('[role="alert"]'), null);
                assert.strictEqual(await page.$eval(cancel, button => !button.classList.contains("disabled") && button === document.activeElement), true);
                assert.strictEqual(await page.$eval("h3", element => element.textContent), "New contents");
                await page.click(cancel);
                await modalClosed();
                assert.strictEqual(await page.$eval(remove, button => button === document.activeElement), true);
            }
        });
    }

    it("clears existing errors and deletion confirmations between guest and different accounts", async () => {
        await loadGuest([item("Guest contents")]);
        for (const next of ["A", "B", undefined]) {
            await page.click(remove);
            await page.evaluate(() => { backpackTest.failDelete = true; });
            await page.click(confirmDelete);
            await idle();
            assert.match(await modalText(), /Delete failed/);
            assert.ok(await page.$(confirm));
            const name = next ? `Account ${next}` : "Guest contents";
            await page.evaluate(({ next, snippet }) => {
                backpackTest.failDelete = false;
                backpackTest.remote[next || "__guest__"] = [snippet];
                backpackTest.account(next);
            }, { next, snippet: item(name) });
            await idle();
            assert.strictEqual(await page.$('[role="alert"]'), null);
            await modalClosed();
            assert.strictEqual(await page.$eval("h3", element => element.textContent), name);
            assert.strictEqual(await page.$eval(remove, button => button.disabled), false);
        }
    });

    it("ignores an abandoned guest refresh after signing in and returning to guest", async () => {
        await page.evaluate(() => { backpackTest.failRefresh = true; backpackTest.hold(); });
        await reopen();
        await page.evaluate(snippet => {
            backpackTest.gate = undefined;
            backpackTest.failRefresh = false;
            backpackTest.remote.A = [snippet];
            backpackTest.account("A");
        }, item("Account contents"));
        await idle();
        await page.evaluate(snippet => {
            backpackTest.remote.__guest__ = [snippet];
            backpackTest.account(undefined);
        }, item("Fresh guest contents"));
        await idle();
        await page.evaluate(() => backpackTest.release());
        assert.match(await text(), /Fresh guest contents/);
        assert.doesNotMatch(await text(), /Account contents|Sync failed/);
        assert.strictEqual(await page.$('[role="alert"]'), null);
        assert.strictEqual(await page.$eval(add, button => button.disabled), false);
    });

    it("bounds long content and previews, keeps touch targets, and uses theme variables for contrast/focus", async () => {
        await signIn(Array.from({ length: 8 }, (_, i) => item("x".repeat(100), `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`)));
        const metrics = await page.evaluate(() => {
            const body = document.querySelector(".project-backpack__body");
            return {
                scrolls: body.scrollHeight > body.clientHeight,
                fits: body.scrollWidth <= body.clientWidth,
                touch: Array.from(document.querySelectorAll("#root button")).every(button => {
                    const rect = button.getBoundingClientRect();
                    return rect.height >= 44 && rect.width >= 44;
                })
            };
        });
        assert.deepStrictEqual(metrics, { scrolls: true, fits: true, touch: true });
        for (const dark of [false, true]) {
            await page.evaluate(dark => {
                const section = document.querySelector("section");
                section.style.setProperty("--tools-surface", dark ? "rgb(25, 25, 25)" : "rgb(250, 250, 250)");
                section.style.setProperty("--tools-foreground", dark ? "rgb(250, 250, 250)" : "rgb(25, 25, 25)");
            }, dark);
            const colors = await page.$eval(rename, button => ({ background: getComputedStyle(button).backgroundColor, color: getComputedStyle(button).color }));
            assert.strictEqual(colors.background, dark ? "rgb(25, 25, 25)" : "rgb(250, 250, 250)");
            assert.strictEqual(colors.color, dark ? "rgb(250, 250, 250)" : "rgb(25, 25, 25)");
        }
        // Puppeteer's media helper only permits a small feature allowlist.
        const session = await page.createCDPSession();
        await session.send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
        await page.focus(add);
        await page.keyboard.press("Tab");
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "solid");
        await page.focus(body);
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "solid");
        await session.detach();
    });
});