"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const less = require("less");
const { launchTestBrowser } = require("./browser");

// No build output or ProjectTools integration: exercise today's source with
// real React 17, the shared portal/FocusTrap/Button sources, and their Less.
describe("project backpack UI", function () {
    this.timeout(30000);
    let browser;
    let page;
    let css;
    let controls;
    let pageErrors;
    const root = path.resolve(__dirname, "../..");
    const source = file => ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
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
        const entry = "react-common/components/controls/Modal.tsx";
        visit(entry);
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
            window.backpackControls = load(${JSON.stringify(entry)});
        })();`;
    };
    const item = (name = "Jump", id = "00000000-0000-0000-0000-000000000001") => ({
        id, name, code: "basic.pause(100)", createdAt: 1, dependencies: {}
    });
    const entry = ".project-backpack__item";
    const add = `${entry} .project-backpack__actions button:first-child`;
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
            @modalSeparatorBorder: 1px solid #ccc; @pageFont: sans-serif;
            @buttonFocusOutlineLightBackground: 2px solid #000;
            @buttonFocusOutlineDarkBackground: 2px solid #fff;
            @highContrastBackgroundColor: #000; @highContrastTextColor: #fff;
            @highContrastFocusOutline: 2px solid #fff; @highContrastFocusZIndex: 1002;
            ${["theme/project-backpack.less", "react-common/styles/controls/Button.less", "react-common/styles/controls/Modal.less"]
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
                get MAX_BACKPACK_NAME_LENGTH() { return window.backpackValidation.MAX_BACKPACK_NAME_LENGTH; },
                validateBackpackItem: value => window.backpackValidation.validateBackpackItem(value),
                getBackpackItems: () => test.snapshots[test.storeKey()] || [],
                subscribeBackpack(listener) { listeners.add(listener); return () => listeners.delete(listener); },
                canImportBackpack: () => test.canImport,
                async refreshBackpackAsync() {
                    const user = test.storeKey();
                    const fail = test.failRefresh;
                    ++test.refreshes;
                    await test.gate;
                    if (fail) throw new Error("Sync failed. Try again.");
                    test.snapshots[user] = JSON.parse(JSON.stringify(test.remote[user] || []));
                    test.notify();
                },
                async importBackpackItemAsync(item, headerId) {
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
                async deleteBackpackItemAsync(id) {
                    const user = test.storeKey();
                    const fail = test.failDelete;
                    test.deletes.push(id);
                    await test.gate;
                    if (fail) throw new Error("Delete failed. Try again.");
                    test.remote[user] = test.remote[user].filter(item => item.id !== id);
                    test.snapshots[user] = test.remote[user];
                    test.notify();
                }
            };
            window.require = id => {
                const modules = { react: React, "../auth": auth, "../data": data, "../backpack": backpack, "../package": test.pkg };
                modules["../../../react-common/components/controls/Modal"] = window.backpackControls;
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
        assert.strictEqual(await page.$("h3 b"), null);
        assert.strictEqual(await page.$eval("img", image => image.alt), "Blocks in <b>Jump</b>");
        const requirements = await page.$$eval(".project-backpack__requirements li", elements => elements.map(el => el.textContent));
        assert.deepStrictEqual(requirements, [
            "Other extension — github:owner/other#v2 — Missing from this project", "absent — pub:example — Missing from this project"
        ]);
        assert.doesNotMatch(await text(), /In this project/);
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

    it("reports invalid source metadata without rendering an actionable snippet", async () => {
        await signIn([{ ...item(), projectBlocks: { custom_block: 7 } }]);
        assert.match(await page.$eval('[role="alert"]', element => element.textContent), /Invalid project-defined blocks/);
        assert.strictEqual(await page.$(entry), null);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds), []);
    });

    it("rejects non-PNG previews rather than injecting image or SVG markup", async () => {
        await signIn([{ ...item(), previewUri: "data:image/svg+xml,<svg onload='alert(1)'/>" }]);
        assert.match(await page.$eval('[role="alert"]', element => element.textContent), /PNG/);
        assert.strictEqual(await page.$("img, svg"), null);
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
        assert.strictEqual(await page.$eval(add, element => element === document.activeElement), true);
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
            const colors = await page.$eval(add, button => ({ background: getComputedStyle(button).backgroundColor, color: getComputedStyle(button).color }));
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