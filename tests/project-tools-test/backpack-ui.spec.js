"use strict";
/* global pxt */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const less = require("less");
const { launchTestBrowser } = require("./browser");
const { source, bundleSource } = require("./source");

describe("project backpack UI", function () {
    this.timeout(30000);
    let browser;
    let page;
    let css;
    let controls;
    let pageErrors;
    const root = path.resolve(__dirname, "../..");
    const item = (name = "Jump", id = "00000000-0000-0000-0000-000000000001") => ({
        id, name, kind: "code", versions: { target: "1.2.3", pxt: "4.5.6" },
        code: JSON.stringify({ blocks: [{ type: "pxt-on-start" }] }), blockText: "", createdAt: 1, dependencies: {}
    });
    const asset = (type, index) => ({ ...item(type, `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`),
        kind: "asset", code: JSON.stringify({ blocks: [{ type, fields: { ASSET: "pixels" } }] }) });
    const assetPreviewURI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
    const assetPreview = ".project-backpack-preview-asset";
    const add = ".project-backpack-add";
    const rename = ".project-backpack-rename";
    const assetModal = ".project-backpack-asset-modal";
    const body = ".project-backpack-body";
    const searchBox = "#project-backpack-search";
    const visibleNames = () => page.$$eval(".project-backpack-name", headings => headings.map(heading => heading.textContent));
    const text = () => page.$eval("#root", element => element.textContent);
    const idle = async () => {
        await page.waitForFunction(() => {
            return document.querySelector(".project-backpack-body")?.getAttribute("aria-busy") === "false";
        });
    };
    const modalClosed = async () => {
        await page.waitForFunction(() => !document.querySelector(".project-backpack-asset-modal")
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
        controls = bundleSource([
            "react-common/components/controls/Modal.tsx",
            "react-common/components/controls/Input.tsx",
            "react-common/components/controls/Button.tsx",
            "react-common/components/controls/TabList.tsx",
            "react-common/components/controls/FocusTrap/FocusTrap.tsx",
            "react-common/components/util.tsx"
        ], "backpackControls");
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
                appTarget: { appTheme: { backpack: true, assetEditor: true }, bundledpkgs: { core: {} } },
                Util: {
                    isUserLanguageRtl: () => false,
                    jsonTryParse: text => { try { return JSON.parse(text); } catch { return undefined; } }
                }
            };
            const subscribers = new Set();
            const listeners = new Set();
            const test = window.backpackTest = {
                user: undefined, remote: {}, snapshots: {},
                refreshes: 0, adds: [], assetSaves: [], renames: [], deletes: [], failAdd: false,
                modalOpen: false, collapses: 0,
                assetPreviewURI, assetPreviewLoads: 0,
                assetContext: { blocksInfo: {}, gallery: {}, palette: ["#000000"] },
                reportedErrors: [],
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
            pxt.reportException = reason => test.reportedErrors.push(reason instanceof Error ? reason.message : String(reason));
            const auth = {
                USER_PROFILE: "auth:profile", LOGGED_IN: "auth:logged-in",
                loggedIn: () => !!test.user, userProfile: () => test.user ? { id: test.user } : undefined,
                hasIdentity: () => !test.noIdentity
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
                MAX_BACKPACK_NAME_LENGTH: 100,
                isBackpackEnabled: () => window.backpackValidation.isBackpackEnabled(),
                isBackpackAssetsEnabled: () => window.backpackValidation.isBackpackAssetsEnabled(),
                backpackEntryKey: entry => JSON.stringify([entry.source, entry.id]),
                getBackpackState: () => ({
                    entries: (test.snapshots[test.storeKey()] || []).map(item => {
                        const validated = window.backpackValidation.readBackpackEntry(item.id, item, test.user ? "cloud" : "local");
                        if (!test.user || validated.error) return validated;
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
                canDropBackpack: (_headerId, target) => target.id === "outside",
                canEditBackpackAsset: () => true,
                async refreshBackpackAsync() {
                    const user = test.storeKey();
                    ++test.refreshes;
                    await test.gate;
                    test.snapshots[user] = JSON.parse(JSON.stringify(test.remote[user] || []));
                    test.complete = true;
                    test.notify();
                },
                async importBackpackEntryAsync(entry, headerId, position) {
                    const item = entry.item || (test.snapshots[test.storeKey()] || []).find(item => item.id === entry.id);
                    const fail = test.failAdd;
                    test.adds.push({ item, headerId, position });
                    await test.gate;
                    if (test.importError) throw test.importError;
                    if (fail) throw new Error("Import failed. Try again.");
                    return true;
                },
                async renameBackpackItemAsync(id, name) {
                    test.renames.push({ id, name });
                    await test.gate;
                    test.remote[test.storeKey()] = test.snapshots[test.storeKey()] =
                        test.remote[test.storeKey()].map(item => item.id === id ? { ...item, name } : item);
                    test.notify();
                },
                async deleteBackpackEntryAsync(entry) {
                    test.deletes.push(entry.id);
                    await test.gate;
                    test.remote[test.storeKey()] = test.snapshots[test.storeKey()] =
                        test.remote[test.storeKey()].filter(item => item.id !== entry.id);
                    test.notify();
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
                const modules = { react: React, "fuse.js": window.Fuse, "../../auth": auth, "../../data": data,
                    "../../backpack": backpack, "../../backpackSearch": window.backpackSearch, "../../package": test.pkg,
                    "../../blockSnippet": window.blockSnippets,
                    "blockly": {}, "../../pxtblocks": {}, "./core": {}, "./package": test.pkg, "./backpack": backpack };
                modules["../../backpackErrors"] = window.backpackErrors;
                modules["./backpackErrors"] = window.backpackErrors;
                modules["./BackpackPreview"] = window.backpackPreviewUI;
                modules["./BackpackEntryCard"] = window.backpackEntryCard;
                modules["./BackpackItemDialog"] = window.backpackItemDialog;
                modules["./BackpackToolbar"] = window.backpackToolbar;
                modules["./useBackpackDrag"] = window.backpackDrag;
                modules["./useBackpackPageFocus"] = window.backpackPageFocus;
                modules["./useBackpackCollection"] = window.backpackCollection;
                modules["../../backpackAssetPreview"] = { backpackAssetPreview: item => test.noAssetPreview ? undefined : ({
                    previewURI: test.assetPreviewURI + "#" + encodeURIComponent(item.code),
                    framePreviewURIs: test.previewFrames
                }) };
                modules["./BackpackAssetEditDialog"] = { BackpackAssetEditDialog: props => {
                    const [code, setCode] = React.useState(props.item.code);
                    return React.createElement(window.backpackControls.Modal, {
                        title: "Edit Backpack asset", className: "project-backpack-asset-modal", fullscreen: true, onClose: props.onClose,
                        actions: [{ label: "Cancel", onClick: props.onClose },
                            { label: "Save", onClick: () => props.onSave({ ...props.item, code }) }]
                    }, React.createElement("input", { "aria-label": "Asset field", value: code, onChange: event => setCode(event.target.value) }));
                } };
                modules["../../../../react-common/components/controls/Modal"] = window.backpackControls;
                modules["../../../../react-common/components/controls/Input"] = window.backpackControls;
                modules["../../../../react-common/components/controls/Button"] = window.backpackControls;
                modules["../../../../react-common/components/controls/TabList"] = window.backpackControls;
                modules["../../../../react-common/components/util"] = window.backpackControls;
                if (!(id in modules)) throw new Error(`Unexpected import ${id}`);
                return modules[id];
            };
        }, assetPreviewURI);
        await page.addScriptTag({ content: controls });
        await page.addScriptTag({ content: `(function(exports) { ${source("webapp/src/backpackErrors.ts")}\n})(window.backpackErrors = {});` });
        await page.addScriptTag({ content: bundleSource(["webapp/src/backpack.ts"], "backpackValidation", {}) });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/blockSnippet.ts")}\n})(window.require, window.blockSnippets = {});` });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/backpackSearch.ts")}\n})(window.require, window.backpackSearch = {});` });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/components/backpack/BackpackPreview.tsx")}\n})(window.require, window.backpackPreviewUI = {});` });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/components/backpack/BackpackEntryCard.tsx")}\n})(window.require, window.backpackEntryCard = {});` });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/components/backpack/BackpackItemDialog.tsx")}\n})(window.require, window.backpackItemDialog = {});` });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/components/backpack/BackpackToolbar.tsx")}\n})(window.require, window.backpackToolbar = {});` });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/components/backpack/useBackpackDrag.ts")}\n})(window.require, window.backpackDrag = {});` });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/components/backpack/useBackpackPageFocus.ts")}\n})(window.require, window.backpackPageFocus = {});` });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/components/backpack/useBackpackCollection.ts")}\n})(window.require, window.backpackCollection = {});` });
        await page.addScriptTag({ content: `(function(require, exports) { ${source("webapp/src/components/backpack/ProjectBackpack.tsx")}\n})(window.require, window.backpackUI = {});` });
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

    it("retains action-button geometry, shared keyboard activation, and disabled styling", async () => {
        await signIn([item()]);
        const appearance = async selector => page.$eval(selector, button => {
            const bounds = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            return {
                width: bounds.width, height: bounds.height, margin: style.margin,
                filter: style.filter, opacity: style.opacity, cursor: style.cursor,
                radius: style.borderRadius, type: button.type, disabled: button.disabled
            };
        });
        await page.hover(add);
        assert.deepStrictEqual(await appearance(add), {
            width: 44, height: 44, margin: "0px", filter: "none", opacity: "1",
            cursor: "pointer", radius: "8px", type: "button", disabled: false
        });
        await page.focus(add);
        assert.equal(await page.$eval(add, button => getComputedStyle(button, "::after").outlineStyle), "none");
        await page.keyboard.down("Space");
        await idle();
        assert.equal(await page.evaluate(() => backpackTest.adds.length), 1);
        await page.keyboard.up("Space");
        assert.equal(await page.evaluate(() => backpackTest.adds.length), 1);
        await page.evaluate(() => backpackTest.hold());
        await page.click(add);
        const disabled = await appearance(add);
        assert.equal(disabled.disabled, true);
        assert.equal(disabled.cursor, "not-allowed");
        assert.equal(disabled.opacity, "0.5");
        assert.equal(disabled.width, 44);
        assert.equal(disabled.height, 44);
        await page.evaluate(() => backpackTest.release());
        await idle();
    });

    it("preserves tab naming, roving focus, and rename/delete dialog submission", async () => {
        const saved = item();
        await signIn([saved]);
        assert.equal(await page.$eval(".project-backpack-tabs", tabs => tabs.getAttribute("aria-label")), "Backpack contents");
        assert.deepStrictEqual(await page.$$eval(".project-backpack-tabs button", buttons => buttons.map(button => button.title)), ["Code", "Assets"]);
        await page.focus("#project-backpack-tab-code");
        await page.keyboard.press("End");
        assert.equal(await page.evaluate(() => document.activeElement.id), "project-backpack-tab-asset");
        await page.keyboard.press("Home");
        assert.equal(await page.evaluate(() => document.activeElement.id), "project-backpack-tab-code");
        assert.equal(await page.$$eval('.project-backpack-tabs [tabindex="0"]', tabs => tabs.length), 1);
        await page.click(rename);
        await page.waitForSelector("#project-backpack-name", { visible: true });
        await page.waitForFunction(() => document.activeElement.id === "project-backpack-name");
        assert.equal(await page.evaluate(() => document.activeElement.id), "project-backpack-name");
        assert.equal(await page.$eval("#project-backpack-name", input => input.maxLength), 100);
        await page.keyboard.type("Landing");
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => !document.querySelector(".project-backpack-rename-modal"));
        await idle();
        assert.deepStrictEqual(await visibleNames(), ["Landing"]);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.renames), [{ id: saved.id, name: "Landing" }]);
        await page.click(".project-backpack-delete");
        await page.waitForSelector(".project-backpack-delete-modal", { visible: true });
        await page.click(".project-backpack-delete-modal .common-modal-footer button:last-child");
        await page.waitForFunction(() => !document.querySelector(".project-backpack-delete-modal"));
        await idle();
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.deletes), [saved.id]);
        await page.waitForFunction(() => document.activeElement.id === "project-backpack-items");
        assert.equal(await page.evaluate(() => document.activeElement.id), "project-backpack-items");
    });

    it("chooses asset icons independently of translated display labels", async () => {
        await page.evaluate(() => {
            backpackTest.noAssetPreview = true;
            const translate = window.lf;
            window.lf = (text, ...args) => text === "Image" || text === "Music" ? "Asset" : translate(text, ...args);
        });

        await signIn([asset("image_picker", 2), asset("music_song_editor", 3)]);
        await page.click("#project-backpack-tab-asset");
        await page.waitForSelector(".project-backpack-asset");
        assert.deepStrictEqual(await page.$$eval(".project-backpack-asset i", icons => icons.map(icon => icon.className)), ["icon image", "icon music"]);
    });

    it("shows intended user errors but reports technical failures without displaying their details", async () => {
        await signIn([item()]);
        await page.evaluate(() => {
            backpackTest.importError = new backpackErrors.BackpackUserError("Delete some snippets and try again.");
        });
        await page.click(add);
        await idle();
        assert.match(await text(), /Delete some snippets and try again/);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.reportedErrors), []);
        await page.evaluate(() => {
            backpackTest.importError = new TypeError("PRIVATE_INTERNAL_DETAILS");
        });
        await page.click(add);
        await idle();
        assert.match(await text(), /Could not update your backpack\. Please try again/);
        assert.doesNotMatch(await text(), /PRIVATE_INTERNAL_DETAILS/);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.reportedErrors), ["PRIVATE_INTERNAL_DETAILS"]);
    });

    it("keeps preview drag data private and imports at the workspace drop position", async () => {
        const saved = item();
        await page.evaluate(saved => {
            backpackTest.remote.__guest__ = [{ ...saved, previewUri: backpackTest.assetPreviewURI }];
        }, saved);
        await reopen();
        await idle();
        await page.waitForSelector(".project-backpack-preview", { visible: true });

        const dragData = await page.evaluate(() => {
            const transfer = new DataTransfer();
            transfer.setData("text/uri-list", "private-preview");
            document.querySelector(".project-backpack-preview").dispatchEvent(new DragEvent("dragstart", {
                bubbles: true,
                dataTransfer: transfer
            }));
            const types = [...transfer.types];
            const key = transfer.getData("application/x-makecode-backpack");
            document.getElementById("outside").dispatchEvent(new DragEvent("drop", {
                bubbles: true,
                dataTransfer: transfer,
                clientX: 120,
                clientY: 240
            }));
            return { types, key };
        });

        await idle();
        assert.deepStrictEqual(dragData, {
            types: ["application/x-makecode-backpack"],
            key: JSON.stringify(["local", saved.id])
        });
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.adds.map(add => ({
            id: add.item.id,
            position: add.position
        }))), [{ id: saved.id, position: { x: 120, y: 240 } }]);
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
        await page.evaluate(() => { pxt.appTarget.appTheme.assetEditor = false; backpackTest.rerender(); });
        await idle();
        assert.equal(await page.$('.project-backpack-tabs'), null);
        assert.match(await text(), /Code snippets aren't available during tutorials/);
        assert.doesNotMatch(await text(), /Use the Assets tab/);
        await page.evaluate(items => {
            backpackTest.tutorial = false;
            backpackTest.noIdentity = true;
            backpackTest.remote.__guest__ = items;
            backpackTest.rerender();
        }, [item(), saved]);
        await idle();
        assert.deepStrictEqual(await visibleNames(), ["Jump"]);
        assert.equal(await page.$('.project-backpack-sign-in'), null);
        assert.equal(await page.$eval(body, element => element.getAttribute("aria-labelledby")), null);
        await page.evaluate(() => { pxt.appTarget.appTheme.backpack = false; backpackTest.rerender(); });
        assert.equal(await page.$(body), null);
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

    it("queues metadata revalidation until an in-flight import finishes", async () => {
        await signIn([item()]);
        const before = await page.evaluate(saved => {
            backpackTest.remote.A = [saved];
            backpackTest.hold();
            return backpackTest.refreshes;
        }, item("Updated elsewhere"));
        await page.click(add);
        await returnToTab();
        assert.deepStrictEqual(await visibleNames(), []);
        assert.equal(await page.evaluate(() => backpackTest.refreshes), before);
        await page.evaluate(() => backpackTest.release());
        await page.waitForFunction(count => backpackTest.refreshes === count + 1, {}, before);
        await idle();
        assert.deepStrictEqual(await visibleNames(), ["Updated elsewhere"]);
        assert.equal(await page.evaluate(() => backpackTest.adds.length), 1);
    });

    it("keeps a rename draft open through page-return revalidation and refreshes after cancellation", async () => {
        await signIn([item()]);
        await page.click(rename);
        await page.waitForFunction(() => document.activeElement.id === "project-backpack-name");
        await page.keyboard.type("Unsaved draft");
        const before = await page.evaluate(saved => {
            backpackTest.remote.A = [saved];
            backpackTest.hold();
            return backpackTest.refreshes;
        }, item("Updated elsewhere"));
        await returnToTab();
        assert.equal(await page.$eval("#project-backpack-name", input => input.value), "Unsaved draft");
        assert.equal(await page.evaluate(() => backpackTest.refreshes), before);
        assert.equal(await page.evaluate(() => backpackTest.modalOpen), true);
        await page.keyboard.press("Escape");
        await page.waitForFunction(count => backpackTest.refreshes === count + 1, {}, before);
        await page.evaluate(() => backpackTest.release());
        await idle();
        assert.deepStrictEqual(await visibleNames(), ["Updated elsewhere"]);
        assert.deepStrictEqual(await page.evaluate(() => backpackTest.renames), []);
        assert.equal(await page.evaluate(() => backpackTest.collapses), 0);
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
        await page.waitForFunction(() => document.querySelector(".project-backpack-rename").disabled);
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