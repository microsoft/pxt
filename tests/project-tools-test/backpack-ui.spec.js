"use strict";

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
    const idle = async () => {
        await page.waitForFunction(() => {
            return document.querySelector(".project-backpack__body")?.getAttribute("aria-busy") === "false";
        });
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
                        // Supply summary fields directly; indexing matrices belong to search tests.
                        return window.backpackValidation.readBackpackSummary({ id: item.id, name: item.name,
                            createdAt: item.createdAt, updatedAt: item.createdAt, version: '"v1"', status: "ready",
                            hasPreview: !!item.previewUri, previewPixelDensity: item.previewPixelDensity,
                            blockTypes: [], blockText: item.blockText, functionCount: test.functionCount,
                            dependencies: item.dependencies, projectBlocks: item.projectBlocks });
                    }).concat(test.recovery
                        .filter(entry => !!test.user || entry.source === "local")
                        .map(entry => window.backpackValidation.readBackpackEntry(entry.id, entry.value, entry.source))),
                    warning: test.warning, complete: test.complete
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
        assert.strictEqual(await page.$eval(rename, button => button === document.activeElement
            && getComputedStyle(button).outlineStyle === "solid"), true);
        await session.detach();
    });

    it("keeps guest contents usable when identity is unavailable without offering sign-in", async () => {
        await page.evaluate(() => { backpackTest.identity = false; backpackTest.rerender(); });
        assert.match(await text(), /Your backpack is empty/);
        assert.strictEqual(await page.$(signInPrompt), null);
        await loadGuest([item()]);
        await page.evaluate(() => { backpackTest.remote.A = [{ name: "Account only" }]; });
        assert.doesNotMatch(await text(), /Sign in|not available/);
        await page.click(add);
        await idle();
        assert.strictEqual(await page.$('[role="alert"]'), null);
        await page.click(remove);
        assert.match(await modalText(), /in this browser\?/);
        await page.click(confirmDelete);
        await idle();
        await modalClosed();
        assert.match(await text(), /Your backpack is empty/);
        assert.strictEqual(await page.$eval(body, element => element === document.activeElement), true);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.remote.A), [{ name: "Account only" }]);
        assert.deepStrictEqual(await page.evaluate(() => [backpackTest.adds.length, backpackTest.deletes.length, backpackTest.signIns]), [1, 1, 0]);
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
            backpackTest.functionCount = 2;
        });
        await signIn([{ ...item(), previewPixelDensity: 2,
            previewUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" }]);
        assert.equal(await page.evaluate(() => backpackTest.previewRequests || 0), 0);
        assert.match(await text(), /\+ 2 other functions/);
        await page.evaluate(() => backpackTest.intersect([{ isIntersecting: true }]));
        await page.waitForSelector("img");
        await page.$eval("img", image => image.decode());
        assert.strictEqual(await page.evaluate(() => backpackTest.previewRequests), 1);
        assert.strictEqual(await page.evaluate(() => backpackTest.urls.length), 1);
        await page.evaluate(() => backpackTest.account("B"));
        await idle();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.revoked), await page.evaluate(() => backpackTest.urls));
        assert.strictEqual(await page.$("img"), null);
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
        assert.match(await text(), /editable Blocks project outside a tutorial/);
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