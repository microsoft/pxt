"use strict";

const assert = require("assert");
const fs = require("fs");
const { launchTestBrowser } = require("./browser");
const less = require("less");
const rtlcss = require("rtlcss");
const ts = require("typescript");

// Compile current source in memory with real React, DOM focus and media queries.
// The image editor is stubbed here; storage and shortcut tests cover its isolation.
describe("responsive project-tools launcher", function () {
    this.timeout(30000);
    let browser;
    let page;
    let css;
    const more = "#project-tools-launcher";
    const docs = "#project-tools-tab-docs";
    const whiteboard = "#project-tools-tab-whiteboard";
    const backpack = "#project-tools-tab-backpack";
    const panel = "#project-tools-panel";
    const source = file => ts.transpileModule(fs.readFileSync(file, "utf8"), { fileName: file,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.React } }).outputText;
    const themeVariables = {
        mainMenuHeight: "4rem", mobileMenuHeight: "3.5rem", editorToolsCollapsedHeight: "4.7rem",
        editorToolsHeight: "10rem", editorToolsCollapsedMobileHeight: "3.4rem",
        sidedocZIndex: "50", largestTabletScreen: "991px", bannerHeight: "2rem",
        sideBarWidth: "22rem", sideBarWidthLarge: "28rem", sideBarWidthSmall: "18rem",
        largestMobileScreen: "767px", largeMonitorBreakpoint: "1200px"
    };

    before(async () => {
        const styles = await less.render(fs.readFileSync("theme/project-tools.less", "utf8"), {
            modifyVars: themeVariables
        });
        css = `* { box-sizing: border-box; } ${styles.css}`;
        browser = await launchTestBrowser();
    });
    after(async () => { await browser?.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844 });
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
        await page.setContent('<div id="root"></div><button id="outside">Outside</button>');
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ path: require.resolve("react/umd/react.development.js") });
        await page.addScriptTag({ path: require.resolve("react-dom/umd/react-dom.development.js") });
        await page.evaluate(() => {
            window.lf = text => text;
            window.pxt = {
                BREAKPOINT_TABLET: 991,
                BrowserUtils: { isTabletSize: () => window.innerWidth <= 991 },
                Util: { isUserLanguageRtl: () => false }
            };
            window.whiteboardMounts = 0;
            window.backpackMounts = 0;
            window.signInRequests = 0;
            window.openRequests = [];
            window.backpackOpenListeners = new Set();
            window.backpackSubscriptions = 0;
            window.backpackUnsubscriptions = 0;
            window.backpackEnabled = true;
            window.requestBackpackOpen = (headerId, focus, kind) => {
                const request = { headerId, focus, ...(kind ? { kind } : {}) };
                window.openRequests.push(request);
                Array.from(window.backpackOpenListeners).forEach(listener => listener(request));
            };
            window.exports = {};
            window.require = id => {
                if (id === "react") return window.React;
                if (id === "../projectToolsState") return window.projectToolsState;
                if (id === "../backpack") return {
                    isBackpackEnabled: () => window.backpackEnabled,
                    subscribeBackpackOpen: listener => {
                        ++window.backpackSubscriptions;
                        window.backpackOpenListeners.add(listener);
                        return () => {
                            ++window.backpackUnsubscriptions;
                            window.backpackOpenListeners.delete(listener);
                        };
                    }
                };
                if (id === "./ProjectBackpack") return {
                    ProjectBackpack: props => {
                        React.useEffect(() => { ++window.backpackMounts; }, []);
                        window.backpackProps = { headerId: props.headerId, active: props.active, onSignIn: typeof props.onSignIn };
                        window.backpackCaptureRequest = props.openRequest;
                        window.setBackpackModalOpen = props.onModalOpenChange;
                        return React.createElement(React.Fragment, null, props.renderHeader("Backpack"),
                            React.createElement("button", { id: "test-backpack-signin", onClick: props.onSignIn }, "Sign in"));
                    }
                };
                if (id === "react/jsx-runtime") {
                    const jsx = (type, props, key) => React.createElement(type, { ...props, key });
                    return { jsx, jsxs: jsx, Fragment: React.Fragment };
                }
                if (id === "./ProjectWhiteboard") return {
                    ProjectWhiteboard: props => {
                        React.useEffect(() => { ++window.whiteboardMounts; }, []);
                        return React.createElement(React.Fragment, null, props.renderHeader("Whiteboard"),
                            React.createElement("textarea", { id: "test-notes", defaultValue: "Private draft" }));
                    }
                };
                throw new Error(`Unexpected dependency: ${id}`);
            };
        });
        const stateCode = source("webapp/src/projectToolsState.ts");
        await page.addScriptTag({ content: `(function(exports) { ${stateCode}\n})(window.projectToolsState = {});` });
        const code = source("webapp/src/components/ProjectTools.tsx");
        await page.addScriptTag({ content: `(function(require, exports) { ${code}\n})(window.require, window.exports);` });
        await page.evaluate(() => {
            function Harness() {
                const [expanded, setExpanded] = React.useState(false);
                const [pinned, setPinned] = React.useState(false);
                const [request, setRequest] = React.useState(0);
                const [rtl, setRtl] = React.useState(false);
                const [gate, setGate] = React.useState("");
                window.setBackpackGate = gate => { window.backpackEnabled = gate !== "disabled"; setGate(gate); };
                pxt.Util.isUserLanguageRtl = () => rtl;
                window.setRtl = setRtl;
                window.openHelp = () => { setRequest(value => value + 1); setExpanded(true); };
                window.openExample = () => { setPinned(true); window.openHelp(); };
                return React.createElement(exports.ProjectTools, {
                    header: { id: "test-project", tutorial: gate === "header" ? {} : undefined },
                    tutorial: gate === "tutorial", expanded, onExpandedChange: setExpanded,
                    pinned, onPinnedChange: setPinned,
                    docsUrl: request ? "/reference" : undefined, docsRequest: request,
                    onOpenReference: window.openHelp, onSignIn: () => { ++window.signInRequests; }
                }, React.createElement("iframe", {
                    id: "test-reference", title: "Reference content", srcDoc: "<h1>Reference content</h1>"
                }));
            }
            window.mountProjectTools = () => {
                ReactDOM.unmountComponentAtNode(document.getElementById("root"));
                ReactDOM.render(React.createElement(Harness), document.getElementById("root"));
            };
            window.mountProjectTools();
        });
        await page.waitForSelector(more);
    });
    afterEach(async () => {
        if (!page || page.isClosed()) return;
        try {
            // Unmount listeners and let pending polling cleanup finish before
            // closing the target; late CDP replies can affect the next page.
            await page.evaluate(() => {
                const root = document.getElementById("root");
                if (window.ReactDOM && root) ReactDOM.unmountComponentAtNode(root);
            });
        } finally { await page.close(); }
    });

    const focusIs = async id => page.waitForFunction(value => document.activeElement.id === value, {}, id);
    const optionsAre = async hidden => page.waitForFunction(value => {
        const options = document.getElementById("project-tools-options");
        return options.getAttribute("aria-hidden") === String(value) && (value
            ? getComputedStyle(options).visibility === "hidden"
            : getComputedStyle(options).visibility === "visible" && Array.from(options.children).every(el => getComputedStyle(el).transform === "none"));
    }, {}, hidden);
    const showOptions = async () => {
        if (await page.$eval(more, el => el.getAttribute("aria-expanded")) !== "true") await page.click(more);
        await optionsAre(false);
    };
    const openTool = async (selector, width = 390) => {
        await page.setViewport({ width, height: 900 });
        await page.waitForFunction(compact => document.querySelector(".project-tools").classList.contains("project-tools--compact") === compact, {}, width < 1200);
        await optionsAre(width <= 991);
        await showOptions();
        await page.click(selector);
        await page.waitForFunction(() => !document.getElementById("project-tools-panel").hidden);
        await page.waitForSelector(`${panel} .project-tools__pin`, { visible: true });
    };

    const labelIs = async (selector, visible) => page.waitForFunction(({ selector, visible }) => {
        const label = document.querySelector(`${selector} .project-tools__bubble-label`);
        return !!label && (getComputedStyle(label).visibility === "visible" && !!label.getClientRects().length) === visible;
    }, {}, { selector, visible });

    it("shows inactive-tab and ellipsis hover labels above the panel in forced colors", async () => {
        await openTool(backpack, 320);
        const session = await page.createCDPSession();
        try {
            await session.send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
            assert.equal(await page.evaluate(() => matchMedia("(forced-colors: active)").matches), true);
            await page.hover(backpack);
            await labelIs(backpack, false);
            assert.equal(await page.$eval(backpack, el => el.hasAttribute("title")), false, "Do not show a native tooltip for the open tab");
            for (const selector of [docs, more]) {
                await page.hover(selector);
                await labelIs(selector, true);
                const actual = await page.$eval(`${selector} .project-tools__bubble-label`, label => {
                    const bounds = label.getBoundingClientRect();
                    const style = getComputedStyle(label);
                    const pointerEvents = style.pointerEvents;
                    // The real label is click-through. Temporarily enable hit testing
                    // to check actual paint order rather than just numeric z-indexes.
                    label.style.pointerEvents = "auto";
                    const topmost = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2) === label;
                    label.style.removeProperty("pointer-events");
                    return { topmost, pointerEvents, readable: style.color !== style.backgroundColor,
                        withinViewport: bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight,
                        named: !!label.parentElement.getAttribute("aria-label"), hiddenFromAT: label.getAttribute("aria-hidden"),
                        nativeTooltip: label.parentElement.hasAttribute("title") };
                });
                assert.deepEqual(actual, { topmost: true, pointerEvents: "none", readable: true, withinViewport: true,
                    named: true, hiddenFromAT: "true", nativeTooltip: false });
                assert.equal(await page.$eval(panel, el => el.dataset.activeTab), "backpack", "Hover must not switch tabs");
                await labelIs(backpack, false);
                await page.hover("#outside");
                await labelIs(selector, false);
            }
            await page.click(backpack);
            assert.equal(await page.$eval(panel, el => el.hidden), true);
            await labelIs(backpack, true); // The tab may show its label once closed.
            await page.click(more);
            await optionsAre(true);
            await labelIs(more, true); // Ellipsis still labels itself with options hidden.
            for (const selector of [docs, whiteboard, backpack]) await labelIs(selector, false);
        } finally {
            await session.detach();
        }
    });

    it("keeps the unpinned backpack open during modal focus and resumes dismissal afterward", async () => {
        await openTool(backpack);
        await page.evaluate(() => window.setBackpackModalOpen(true));
        await page.focus("#outside");
        await page.click("#outside");
        assert.equal(await page.$eval(panel, element => element.hidden), false);
        assert.equal(await page.$eval(`${panel} .project-tools__pin`, element => element.getAttribute("aria-pressed")), "false");
        await page.evaluate(() => window.setBackpackModalOpen(false));
        await page.click("#outside");
        await page.waitForFunction(() => document.getElementById("project-tools-panel").hidden);
    });

    // One initial viewport per layout regime; transitions below exercise exact boundaries.
    for (const width of [390, 992, 1200]) {
        it(`starts with ${width > 991 ? "expanded" : "collapsed"} bubbles and an ellipsis at ${width}px without stealing focus`, async () => {
            await page.setViewport({ width, height: 900 });
            await page.focus("#outside");
            await page.evaluate(() => window.mountProjectTools());
            await page.waitForSelector(more, { visible: true });
            await optionsAre(width <= 991);
            await focusIs("outside");
            assert.equal(await page.$eval(more, el => el.getAttribute("aria-expanded")), String(width > 991));
            assert.equal(await page.$eval("#project-tools-options", el => el.getAttribute("aria-orientation")), width < 1200 ? "horizontal" : "vertical");
            assert.equal(await page.$$eval('#project-tools-options [tabindex="0"]', els => els.length), width > 991 ? 1 : 0);
            assert.equal(await page.$eval(panel, el => el.hidden), true, "Expanded bubbles must not open a panel");
            if (width > 991) {
                const positions = await page.evaluate(() => ["project-tools-launcher", "project-tools-tab-docs", "project-tools-tab-whiteboard", "project-tools-tab-backpack"]
                    .map(id => document.getElementById(id).getBoundingClientRect().toJSON()));
                const [launcher, docs, whiteboard, backpack] = positions;
                if (width < 1200) {
                    assert.equal(docs.top, launcher.top);
                    assert.equal(whiteboard.top, launcher.top);
                    assert.equal(backpack.top, launcher.top);
                    assert.ok(docs.right < whiteboard.left && whiteboard.right < backpack.left && backpack.right < launcher.left);
                } else {
                    assert.equal(docs.left, launcher.left);
                    assert.equal(whiteboard.left, launcher.left);
                    assert.equal(backpack.left, launcher.left);
                    assert.ok(launcher.bottom < docs.top && docs.bottom < whiteboard.top && whiteboard.bottom < backpack.top);
                }
                await page.click("#outside");
                await optionsAre(false);
                await focusIs("outside");
            }
        });
    }

    it("preserves desktop disclosure choices across orientation changes and restores defaults at the tablet boundary", async () => {
        await page.focus("#outside");
        await page.setViewport({ width: 992, height: 900 });
        await optionsAre(false);
        await focusIs("outside");
        await page.click(more);
        await optionsAre(true);
        for (const width of [1200, 1199]) {
            await page.setViewport({ width, height: 900 });
            await page.waitForFunction(compact => document.querySelector(".project-tools").classList.contains("project-tools--compact") === compact, {}, width < 1200);
            await optionsAre(true);
            await focusIs("project-tools-launcher");
            assert.equal(await page.$eval(panel, el => el.hidden), true);
        }
        await page.setViewport({ width: 991, height: 900 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        await optionsAre(true);
        await page.setViewport({ width: 992, height: 900 });
        await optionsAre(false);
        await focusIs("project-tools-launcher");
        assert.equal(await page.$eval(panel, el => el.hidden), true);
    });

    it("honors target-specific legacy widths instead of hard-coded Arcade sizes", async () => {
        const { css } = await less.render(fs.readFileSync("theme/project-tools.less", "utf8"), {
            modifyVars: { ...themeVariables, sideBarWidth: "24rem", sideBarWidthLarge: "30rem", sideBarWidthSmall: "19rem" }
        });
        await page.$eval("style", (el, css) => el.textContent = `* { box-sizing: border-box; } ${css}`, css);
        await openTool(docs);
        for (const [width, expected] of [[390, 304], [768, 384], [1024, 376], [1366, 400]]) {
            await page.setViewport({ width, height: 900 });
            await page.waitForFunction(expected => document.getElementById("project-tools-panel").getBoundingClientRect().width === expected, {}, expected);
        }
    });

    it("keeps manual widths across breakpoints while clamping them to the screen", async () => {
        await openTool(docs, 1366);
        await page.focus(".project-tools__resize--width");
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowRight");
        assert.equal(await page.$eval(panel, el => el.getBoundingClientRect().width), 256);
        await page.keyboard.press("End");
        assert.equal(await page.$eval(panel, el => el.getBoundingClientRect().width), 900);
        await page.setViewport({ width: 992, height: 900 });
        await page.waitForFunction(() => document.getElementById("project-tools-panel").getBoundingClientRect().width === 900);
        await page.setViewport({ width: 390, height: 900 });
        await page.waitForFunction(() => document.getElementById("project-tools-panel").getBoundingClientRect().width === 374);
        await page.setViewport({ width: 1366, height: 900 });
        await page.waitForFunction(() => document.getElementById("project-tools-panel").getBoundingClientRect().width === 900);
        await page.click(`${panel} .project-tools__close`);
        await page.click(docs);
        assert.equal(await page.$eval(panel, el => el.getBoundingClientRect().width), 900);
    });

    it("supports manual arrow selection, a single tab stop, and Escape focus", async () => {
        await page.focus(more);
        await page.keyboard.press("ArrowDown");
        await focusIs("project-tools-tab-docs");
        await page.focus(more);
        await page.keyboard.press("ArrowDown");
        await focusIs("project-tools-tab-docs");
        await page.keyboard.press("ArrowRight");
        await focusIs("project-tools-tab-whiteboard");
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        assert.equal(await page.$$eval('#project-tools-options [tabindex="0"]', els => els.length), 1);
        await page.keyboard.press("Enter");
        await focusIs("project-tools-tab-whiteboard");
        await labelIs(whiteboard, false);
        await page.waitForSelector("#test-notes", { visible: true });
        await page.focus("#test-notes");
        await optionsAre(false);
        await page.keyboard.press("Escape");
        await focusIs("project-tools-tab-whiteboard");
        await labelIs(whiteboard, true);
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        await optionsAre(false);
        await page.keyboard.press("Escape");
        await optionsAre(true);
        await focusIs("project-tools-launcher");
        await labelIs(more, true);
        await labelIs(whiteboard, false);
    });

    // Horizontal RTL reverses arrows; vertical navigation automatically selects.
    for (const { width, rtl } of [{ width: 1024, rtl: true }, { width: 1366, rtl: false }]) {
        it(`cycles all three roving tabs and Home/End at ${width}px in ${rtl ? "RTL" : "LTR"}`, async () => {
            await openTool(docs, width);
            if (rtl) {
                await page.$eval("style", (el, text) => el.textContent = text, rtlcss.process(css));
                await page.evaluate(() => window.setRtl(true));
            }
            const compact = width < 1200;
            const forward = compact ? (rtl ? "ArrowLeft" : "ArrowRight") : "ArrowDown";
            const backward = compact ? (rtl ? "ArrowRight" : "ArrowLeft") : "ArrowUp";
            const checkTab = async name => {
                await focusIs(`project-tools-tab-${name}`);
                assert.deepEqual(await page.$$eval('#project-tools-options [tabindex="0"]', els => els.map(el => el.id)), [`project-tools-tab-${name}`]);
                const selected = compact ? "docs" : name;
                assert.equal(await page.$eval(panel, el => el.dataset.activeTab), selected);
                assert.equal(await page.$eval(panel, el => el.hidden), false);
                assert.deepEqual(await page.$$eval('#project-tools-options [aria-selected="true"]', els => els.map(el => el.id)), [`project-tools-tab-${selected}`]);
            };
            await page.focus(docs);
            for (const name of ["whiteboard", "backpack", "docs"]) {
                await page.keyboard.press(forward);
                await checkTab(name);
            }
            for (const name of ["backpack", "whiteboard", "docs"]) {
                await page.keyboard.press(backward);
                await checkTab(name);
            }
            await page.keyboard.press("End");
            await checkTab("backpack");
            await page.keyboard.press("Home");
            await checkTab("docs");
            for (const key of compact ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"]) {
                await page.keyboard.press(key);
                await checkTab("docs");
            }
            await page.keyboard.press("End");
            if (compact) await page.keyboard.press("Enter");
            await page.waitForSelector("#test-backpack-signin", { visible: true });
            assert.equal(await page.$eval(panel, el => el.dataset.activeTab), "backpack");
            await focusIs("project-tools-tab-backpack");
        });
    }

    it("opens backpack on drag dwell without stealing focus", async () => {
        await optionsAre(true);
        await page.focus("#outside");
        await page.evaluate(() => window.requestBackpackOpen("test-project", false));
        await page.waitForSelector("#test-backpack-signin", { visible: true });
        await optionsAre(false);
        await focusIs("outside");
        assert.equal(await page.$eval(panel, el => el.dataset.activeTab), "backpack");
        assert.equal(await page.$eval(backpack, el => el.getAttribute("aria-selected")), "true");
        assert.deepEqual(await page.evaluate(() => window.openRequests), [{ headerId: "test-project", focus: false }]);
        assert.deepEqual(await page.evaluate(() => window.backpackProps), { headerId: "test-project", active: true, onSignIn: "function" });
        assert.equal(await page.evaluate(() => window.whiteboardMounts), 0);
        assert.equal(await page.evaluate(() => window.backpackMounts), 1);
        await page.click("#test-backpack-signin");
        assert.equal(await page.evaluate(() => window.signInRequests), 1);
        await page.click("#project-tools-backpack .project-tools__close");
        await focusIs("project-tools-tab-backpack");
        assert.equal(await page.evaluate(() => window.backpackProps.active), false);
        await page.click(whiteboard);
        await page.waitForSelector("#test-notes", { visible: true });
        await focusIs("project-tools-tab-whiteboard");
    });

    it("opens backpack from context over whiteboard with a focused tab", async () => {
        await openTool(whiteboard, 1366);
        await page.focus("#test-notes");
        await page.evaluate(() => window.requestBackpackOpen("test-project", true, "asset"));
        await page.waitForSelector("#test-backpack-signin", { visible: true });
        await optionsAre(false);
        await focusIs("project-tools-tab-backpack");
        assert.deepEqual(await page.$$eval('#project-tools-options [tabindex="0"]', els => els.map(el => el.id)), ["project-tools-tab-backpack"]);
        assert.equal(await page.$eval(panel, el => el.dataset.activeTab), "backpack");
        assert.deepEqual(await page.evaluate(() => window.openRequests), [{ headerId: "test-project", focus: true, kind: "asset" }]);
        assert.deepEqual(await page.evaluate(() => window.backpackCaptureRequest), { headerId: "test-project", focus: true, kind: "asset" });
    });

    it("dynamically hides gated backpack, ignores captures and keeps docs/whiteboard keyboard navigation", async () => {
        await openTool(backpack, 1366);
        for (const gate of ["disabled", "tutorial", "header"]) {
            await page.evaluate(gate => window.setBackpackGate(gate), gate);
            await page.waitForSelector(backpack, { hidden: true });
            assert.strictEqual(await page.$("#project-tools-backpack"), null);
            assert.strictEqual(await page.$eval(panel, el => el.dataset.activeTab), "docs");
            await page.evaluate(() => window.requestBackpackOpen("test-project", true, "asset"));
            await page.focus(docs);
            for (const [key, name] of [["End", "whiteboard"], ["ArrowDown", "docs"], ["ArrowUp", "whiteboard"], ["Home", "docs"]]) {
                await page.keyboard.press(key);
                await focusIs(`project-tools-tab-${name}`);
                assert.strictEqual(await page.$eval(panel, el => el.dataset.activeTab), name);
            }
            assert.strictEqual(await page.$$eval('#project-tools-options [role="tab"]', tabs => tabs.length), 2);
            assert.strictEqual(await page.$$eval('#project-tools-options [tabindex="0"]', tabs => tabs.length), 1);
        }
        await page.evaluate(() => window.setBackpackGate(""));
        await page.waitForSelector(backpack, { visible: true });
        await page.focus(docs);
        await page.keyboard.press("End");
        await focusIs("project-tools-tab-backpack");
        assert.strictEqual(await page.$eval(panel, el => el.dataset.activeTab), "backpack");
    });

    it("ignores backpack requests for another header and cleans up subscriptions on remount", async () => {
        await page.focus("#outside");
        await page.evaluate(() => {
            window.requestBackpackOpen("another-project", false);
            window.requestBackpackOpen("another-project", true);
        });
        await optionsAre(true);
        await focusIs("outside");
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        assert.equal(await page.$eval(panel, el => el.dataset.activeTab), "docs");
        assert.equal(await page.evaluate(() => window.backpackMounts), 0);
        await openTool(whiteboard);
        await page.focus("#test-notes");
        await page.evaluate(() => window.requestBackpackOpen("another-project", true));
        await focusIs("test-notes");
        assert.equal(await page.$eval(panel, el => el.dataset.activeTab), "whiteboard");
        assert.equal(await page.$eval(panel, el => el.hidden), false);
        await page.evaluate(() => window.mountProjectTools());
        await page.waitForFunction(() => window.backpackSubscriptions === 2 && window.backpackUnsubscriptions === 1);
        assert.equal(await page.evaluate(() => window.backpackOpenListeners.size), 1);
        await page.evaluate(() => ReactDOM.unmountComponentAtNode(document.getElementById("root")));
        await page.waitForFunction(() => window.backpackUnsubscriptions === 2);
        assert.equal(await page.evaluate(() => window.backpackOpenListeners.size), 0);
    });

    it("dismisses on outside pointer and Tab without blocking the target or stealing focus", async () => {
        await openTool(whiteboard);
        await page.waitForSelector("#test-notes", { visible: true });
        await page.$eval("#outside", el => {
            el.addEventListener("pointerdown", event => event.stopPropagation());
            el.addEventListener("click", () => el.dataset.clicked = "true");
        });
        await page.click("#outside");
        await optionsAre(true);
        await focusIs("outside");
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        assert.equal(await page.$eval("#outside", el => el.dataset.clicked), "true");
        await showOptions();
        await page.click(whiteboard);
        await page.waitForSelector("#test-notes", { visible: true });
        await focusIs("project-tools-tab-whiteboard");
        // Reopening retains the textarea. Click it as a user would rather than
        // racing programmatic focus against the panel's pending open effect.
        await page.click("#test-notes");
        await page.keyboard.press("Tab");
        await focusIs("outside");
        await optionsAre(true);
        assert.equal(await page.$eval(panel, el => el.hidden), true);
    });

    it("keeps pinned documentation open across collapse/reopen until manually unpinned", async () => {
        await openTool(docs, 1024);
        const pin = `${panel} .project-tools__pin`;
        assert.equal(await page.$eval(pin, el => el.getAttribute("aria-pressed")), "false");
        await page.click(pin);
        assert.equal(await page.$eval(pin, el => el.getAttribute("aria-pressed")), "true");
        await page.$eval("#outside", el => el.addEventListener("click", () => el.dataset.clicked = "true"));
        await page.click("#outside");
        await focusIs("outside");
        assert.equal(await page.$eval("#outside", el => el.dataset.clicked), "true");
        assert.equal(await page.$eval(panel, el => el.hidden), false);
        await page.click(`${panel} .project-tools__close`);
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        await page.click(docs);
        assert.equal(await page.$eval(pin, el => el.getAttribute("aria-pressed")), "true");
        await page.click("#outside");
        assert.equal(await page.$eval(panel, el => el.hidden), false);
        await page.click(pin);
        assert.equal(await page.$eval(pin, el => el.getAttribute("aria-pressed")), "false");
        assert.equal(await page.$eval(panel, el => el.hidden), false);
        await page.click("#outside");
        await optionsAre(false);
        assert.equal(await page.$eval(panel, el => el.hidden), true);
    });

    it("pins example documentation initially without overriding a later manual unpin", async () => {
        await page.evaluate(() => window.openExample());
        await focusIs("project-tools-panel");
        await optionsAre(true);
        assert.equal(await page.$eval(`${panel} .project-tools__pin`, el => el.getAttribute("aria-pressed")), "true");
        await page.click("#outside");
        assert.equal(await page.$eval(panel, el => el.hidden), false);
        await page.click(`${panel} .project-tools__pin`);
        await page.evaluate(() => window.openHelp());
        assert.equal(await page.$eval(`${panel} .project-tools__pin`, el => el.getAttribute("aria-pressed")), "false");
        await page.click("#outside");
        assert.equal(await page.$eval(panel, el => el.hidden), true);
    });

    it("opens requested documentation with hidden options and closes it through the ellipsis", async () => {
        await openTool(whiteboard, 1024);
        await page.click(more);
        await optionsAre(true);
        await page.evaluate(() => window.openHelp());
        await focusIs("project-tools-panel");
        await optionsAre(true);
        await page.waitForFunction(() => !document.getElementById("project-tools-docs").hidden);
        assert.equal(await page.$eval(docs, el => el.getAttribute("aria-selected")), "true");
        await page.click(more);
        await focusIs("project-tools-launcher");
        await optionsAre(true);
        assert.equal(await page.$eval(panel, el => el.hidden), true);
    });

    it("moves focus to the ellipsis when tablet defaults hide a desktop tab", async () => {
        await openTool(docs, 1024);
        await page.focus(docs);
        await page.setViewport({ width: 991, height: 900 });
        await optionsAre(true);
        await focusIs("project-tools-launcher");
        assert.equal(await page.$eval(panel, el => el.hidden), false);
        await page.click(`${panel} .project-tools__close`);
        await focusIs("project-tools-launcher");
    });

    it("keeps the width grip on small desktops and moves focus only when tablet layout hides it", async () => {
        await openTool(docs, 1366);
        await page.focus(".project-tools__resize--width");
        await page.setViewport({ width: 1199, height: 900 });
        await page.waitForFunction(() => document.getElementById("project-tools-options").getAttribute("aria-orientation") === "horizontal");
        await page.waitForSelector(".project-tools__resize--width", { visible: true });
        assert.equal(await page.$eval(".project-tools__resize--width", el => el === document.activeElement), true);
        await page.setViewport({ width: 992, height: 900 });
        await page.waitForSelector(".project-tools__resize--width", { visible: true });
        await page.setViewport({ width: 768, height: 900 });
        await focusIs("project-tools-panel");
        await optionsAre(true);
    });

    for (const { width, rtl } of [{ width: 1024, rtl: false }, { width: 1366, rtl: true }]) {
        it(`shows a working width grip at ${width}px in ${rtl ? "RTL" : "LTR"}`, async () => {
            await openTool(docs, width);
            if (rtl) {
                await page.$eval("style", (el, css) => el.textContent = css, rtlcss.process(css));
                await page.evaluate(() => window.setRtl(true));
            }
            const grip = ".project-tools__resize--width .project-tools__resize-grip";
            const geometry = await page.$eval(grip, el => ({
                rect: el.getBoundingClientRect().toJSON(),
                panel: document.getElementById("project-tools-panel").getBoundingClientRect().toJSON()
            }));
            const { rect, panel: bounds } = geometry;
            const x = rect.x + rect.width / 2;
            const y = rect.y + rect.height / 2;
            assert.ok(Math.abs(y - bounds.y - bounds.height / 2) < 1);
            assert.ok(Math.abs(x - (rtl ? bounds.right : bounds.left)) < 2);
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + (rtl ? 48 : -48), y, { steps: 4 });
            await page.mouse.up();
            assert.equal(await page.$eval(panel, el => el.getBoundingClientRect().width), bounds.width + 48);
            await page.focus(".project-tools__resize--width");
            await page.keyboard.press(rtl ? "ArrowRight" : "ArrowLeft");
            assert.equal(await page.$eval(panel, el => el.getBoundingClientRect().width), bounds.width + 68);
            await page.setViewport({ width: 768, height: 900 });
            await page.waitForSelector(grip, { hidden: true });
        });
    }

    it("resizes mobile panel height with the pointer and keyboard, clamping and restoring defaults", async () => {
        await openTool(docs);
        const handle = ".project-tools__resize--height";
        const grip = `${handle} .project-tools__resize-grip`;
        const before = await page.$eval(panel, el => el.getBoundingClientRect().toJSON());
        const bounds = await page.$eval(grip, el => el.getBoundingClientRect().toJSON());
        const x = bounds.x + bounds.width / 2;
        const y = bounds.y + bounds.height / 2;
        assert.ok(Math.abs(x - before.x - before.width / 2) < 1);
        assert.ok(Math.abs(y - before.bottom) < 2);
        assert.equal(await page.$eval(handle, el => el.getAttribute("aria-orientation")), "horizontal");
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y - 96, { steps: 4 });
        await page.mouse.up();
        const after = await page.$eval(panel, el => el.getBoundingClientRect().toJSON());
        assert.ok(Math.abs(after.height - (before.height - 96)) < 1);
        assert.equal(after.width, before.width);
        assert.equal(after.top, before.top);
        assert.equal(await page.$eval(panel, el => el.classList.contains("project-tools__panel--resizing")), false);
        await page.focus(handle);
        await page.keyboard.press("ArrowUp");
        assert.ok(Math.abs(await page.$eval(panel, el => el.getBoundingClientRect().height) - (before.height - 116)) < 1);
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowUp");
        assert.equal(await page.$eval(panel, el => el.getBoundingClientRect().height), 240);
        await page.keyboard.down("Shift");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.up("Shift");
        assert.equal(await page.$eval(panel, el => el.getBoundingClientRect().height), 320);
        await page.keyboard.press("End");
        assert.equal(await page.$eval(panel, el => el.style.height), "");
        assert.ok(Math.abs(await page.$eval(panel, el => el.getBoundingClientRect().height) - before.height) < 1);
    });

    it("retains both dimensions across switching and collapse while fitting the viewport and banner", async () => {
        await openTool(whiteboard, 1366);
        await page.waitForSelector("#test-notes", { visible: true });
        await page.click(`${panel} .project-tools__pin`);
        await page.type("#test-notes", " resized draft");
        const draft = await page.$eval("#test-notes", el => el.value);
        const originalWidth = await page.$eval(panel, el => el.getBoundingClientRect().width);
        await page.focus(".project-tools__resize--width");
        await page.keyboard.press("ArrowLeft");
        await page.focus(".project-tools__resize--height");
        await page.keyboard.press("Home");
        await page.keyboard.down("Shift");
        for (let i = 0; i < 5; ++i) await page.keyboard.press("ArrowDown");
        await page.keyboard.up("Shift");
        assert.equal(await page.$eval(panel, el => el.getBoundingClientRect().height), 640);
        await page.click(docs);
        await page.click(`${panel} .project-tools__close`);
        await page.click(whiteboard);
        assert.equal(await page.$eval(panel, el => el.getBoundingClientRect().height), 640);
        assert.equal(await page.$eval(panel, el => el.getBoundingClientRect().width), originalWidth + 20);
        assert.equal(await page.$eval("#test-notes", el => el.value), draft);
        assert.equal(await page.$eval(`${panel} .project-tools__pin`, el => el.getAttribute("aria-pressed")), "true");

        await page.setViewport({ width: 1366, height: 438 });
        await page.$eval("#root", el => el.classList.add("notificationBannerVisible"));
        await page.waitForFunction(() => {
            const panel = document.getElementById("project-tools-panel");
            const handle = document.querySelector(".project-tools__resize--height");
            const bounds = panel.getBoundingClientRect();
            const max = parseFloat(getComputedStyle(panel).maxHeight);
            return Math.abs(bounds.height - max) < 1 && Math.abs(Number(handle.getAttribute("aria-valuenow")) - bounds.height) < 1
                && Number(handle.getAttribute("aria-valuemax")) === max;
        });
        const bounds = await page.$eval(panel, el => el.getBoundingClientRect().toJSON());
        assert.ok(bounds.bottom <= 438 - 90);
        assert.ok(bounds.top >= 96);
        await page.setViewport({ width: 1366, height: 900 });
        await page.$eval("#root", el => el.classList.remove("notificationBannerVisible"));
        assert.equal(await page.$eval(panel, el => el.getBoundingClientRect().height), 640);
        assert.equal(await page.evaluate(() => window.whiteboardMounts), 1);
    });

    for (const { width, pinned } of [{ width: 390, pinned: true }, { width: 1024, pinned: false }]) it(`${pinned ? "keeps pinned" : "closes unpinned"} documentation when moving from docs to an outside iframe at ${width}px`, async () => {
        await openTool(docs, width);
        await page.evaluate(() => window.openHelp());
        if (pinned) await page.click(`${panel} .project-tools__pin`);
        const inside = await page.waitForSelector("#test-reference", { visible: true });
        const insideFrame = await inside.contentFrame();
        await insideFrame.waitForSelector("h1");
        await insideFrame.click("h1");
        await focusIs("test-reference");
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await optionsAre(false);
        assert.equal(await page.$eval(panel, el => el.hidden), false);
        await page.evaluate(() => {
            const frame = document.createElement("iframe");
            frame.id = "outside-frame";
            frame.title = "Simulator";
            frame.srcdoc = '<button id="simulator-button">Simulator</button>';
            frame.style.cssText = "position: fixed; top: 0; left: 0; width: 180px; height: 48px; border: 0";
            document.body.appendChild(frame);
        });
        const outside = await page.waitForSelector("#outside-frame", { visible: true });
        const outsideFrame = await outside.contentFrame();
        await outsideFrame.waitForSelector("#simulator-button");
        await outsideFrame.click("#simulator-button");
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.$eval(panel, el => el.hidden), !pinned);
        await optionsAre(!pinned && width <= 991);
        await focusIs("outside-frame");
        assert.equal(await outsideFrame.evaluate(() => document.activeElement.id), "simulator-button");
    });

    it("respects reduced motion without disabling the launcher", async () => {
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
        await optionsAre(true);
        await showOptions();
        assert.deepEqual(await page.$$eval('#project-tools-options [role="tab"]', els => els.map(el => el.getAnimations().length)), [0, 0, 0]);
        await page.click(docs);
        await optionsAre(false);
        await page.click(docs);
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        await page.click(more);
        await optionsAre(true);
    });
});