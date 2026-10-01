"use strict";

const assert = require("assert");
const fs = require("fs");
const { launchTestBrowser } = require("./browser");
const less = require("less");
const rtlcss = require("rtlcss");
const ts = require("typescript");
const { bundleSource } = require("./source");

// Compile current source in memory with real React, DOM focus and media queries.
// Whiteboard persistence and shortcut isolation use the real editor in whiteboard.spec.
describe("responsive project-tools launcher", function () {
    this.timeout(30000);
    let browser;
    let page;
    let css;
    let components;
    const more = "#project-tools-launcher";
    const docs = "#project-tools-tab-docs";
    const whiteboard = "#project-tools-tab-whiteboard";
    const backpack = "#project-tools-tab-backpack";
    const panel = "#project-tools-panel";
    const source = file => ts.transpileModule(fs.readFileSync(file, "utf8"), {
        fileName: file,
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2018,
            jsx: ts.JsxEmit.React
        }
    }).outputText;
    const themeVariables = {
        mainMenuHeight: "4rem", mobileMenuHeight: "3.5rem", editorToolsCollapsedHeight: "4.7rem",
        editorToolsHeight: "10rem", editorToolsCollapsedMobileHeight: "3.4rem",
        sidedocZIndex: "50", largestTabletScreen: "991px", bannerHeight: "2rem",
        sideBarWidth: "22rem", sideBarWidthLarge: "28rem", sideBarWidthSmall: "18rem",
        largestMobileScreen: "767px", largeMonitorBreakpoint: "1200px"
    };

    before(async () => {
        components = bundleSource([
            "react-common/components/controls/Button.tsx",
            "react-common/components/util.tsx",
            "webapp/src/components/projectTools/ProjectToolsHeader.tsx",
            "webapp/src/components/projectTools/ProjectToolsResizeHandle.tsx",
            "webapp/src/components/projectTools/useProjectToolsResize.ts"
        ], "projectToolsComponents");
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
                appTarget: { appTheme: { whiteboard: true, backpack: true }, runtime: { palette: ["#000", "#fff"] } },
                BREAKPOINT_TABLET: 991,
                BrowserUtils: { isTabletSize: () => window.innerWidth <= 991 },
                Util: { isUserLanguageRtl: () => false }
            };
            window.backpackOpenListeners = new Set();
            window.requestBackpackOpen = (headerId, focus) => {
                const request = { headerId, focus };
                Array.from(window.backpackOpenListeners).forEach(listener => listener(request));
            };
            window.exports = {};
            window.require = id => {
                if (id === "react") return window.React;
                if (id === "../../projectToolsState") return window.projectToolsState;
                if ([
                    "./ProjectToolsHeader", "./ProjectToolsResizeHandle", "./useProjectToolsResize",
                    "../../../../react-common/components/controls/Button", "../../../../react-common/components/util"
                ].includes(id)) return window.projectToolsComponents;
                if (id === "../../backpack") return {
                    isBackpackEnabled: () => pxt.appTarget.appTheme.backpack,
                    subscribeBackpackOpen: listener => {
                        window.backpackOpenListeners.add(listener);
                        return () => window.backpackOpenListeners.delete(listener);
                    }
                };
                if (id === "../backpack/index") return {
                    ProjectBackpack: props => {
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
                        return React.createElement(React.Fragment, null, props.renderHeader("Whiteboard"),
                            React.createElement("textarea", { id: "test-notes", defaultValue: "Private draft" }));
                    }
                };
                throw new Error(`Unexpected dependency: ${id}`);
            };
        });
        const stateCode = source("webapp/src/projectToolsState.ts");
        await page.addScriptTag({ content: `(function(exports) { ${stateCode}\n})(window.projectToolsState = {});` });
        await page.addScriptTag({ content: components });
        const code = source("webapp/src/components/projectTools/ProjectTools.tsx");
        await page.addScriptTag({ content: `(function(require, exports) { ${code}\n})(window.require, window.exports);` });
        await page.evaluate(() => {
            function Harness() {
                const [expanded, setExpanded] = React.useState(false);
                const [pinned, setPinned] = React.useState(false);
                const [request, setRequest] = React.useState(0);
                const [rtl, setRtl] = React.useState(false);
                const [, update] = React.useReducer(value => value + 1, 0);
                window.setToolsFlags = flags => { Object.assign(pxt.appTarget.appTheme, flags); update(); };
                pxt.Util.isUserLanguageRtl = () => rtl;
                window.setRtl = setRtl;
                window.openHelp = () => {
                    setRequest(value => value + 1);
                    setExpanded(true);
                };
                window.openExample = () => {
                    setPinned(true);
                    window.openHelp();
                };
                return React.createElement(exports.ProjectTools, {
                    header: { id: "test-project" }, expanded, onExpandedChange: setExpanded,
                    pinned, onPinnedChange: setPinned,
                    docsUrl: request ? "/reference" : undefined, docsRequest: request,
                    onOpenReference: window.openHelp, onSignIn: () => {}
                });
            }
            ReactDOM.render(React.createElement(Harness), document.getElementById("root"));
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
    const shiftTab = async () => {
        await page.keyboard.down("Shift");
        try { await page.keyboard.press("Tab"); }
        finally { await page.keyboard.up("Shift"); }
    };
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
        await page.waitForFunction(compact => document.querySelector(".project-tools").classList.contains("project-tools-compact") === compact, {}, width < 1200);
        await optionsAre(width <= 991);
        await showOptions();
        await page.click(selector);
        await page.waitForFunction(() => !document.getElementById("project-tools-panel").hidden);
        await page.waitForSelector(`${panel} .project-tools-pin`, { visible: true });
    };

    it("keeps the unpinned backpack open during modal focus and resumes dismissal afterward", async () => {
        await openTool(backpack);
        await page.evaluate(() => window.setBackpackModalOpen(true));
        await page.focus("#outside");
        await page.click("#outside");
        assert.equal(await page.$eval(panel, element => element.hidden), false);
        assert.equal(await page.$eval(`${panel} .project-tools-pin`, element => element.getAttribute("aria-pressed")), "false");
        await page.evaluate(() => window.setBackpackModalOpen(false));
        await page.click("#outside");
        await page.waitForFunction(() => document.getElementById("project-tools-panel").hidden);
    });

    it("independently gates Whiteboard and Backpack and resizes horizontally on a phone", async () => {
        await openTool(whiteboard);
        const grip = ".project-tools-resize-width";
        const width = () => page.$eval(panel, el => el.getBoundingClientRect().width);
        await page.focus(grip);
        await page.keyboard.press("Home");
        const min = await width();
        await page.keyboard.press("End");
        assert(await width() > min);
        assert(await width() <= 390);
        const bounds = await page.$eval(grip, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        const client = await page.createCDPSession();
        await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [bounds] });
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: bounds.x + 60, y: bounds.y }] });
        await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        assert(await width() < 350);
        await client.detach();
        await page.evaluate(() => window.setToolsFlags({ whiteboard: false }));
        assert.equal(await page.$(whiteboard), null);
        assert.equal(await page.$("#project-tools-whiteboard"), null);
        assert(await page.$(backpack));
        await page.evaluate(() => window.setToolsFlags({ whiteboard: true, backpack: false }));
        assert(await page.$(whiteboard));
        assert.equal(await page.$(backpack), null);
        await page.evaluate(() => { pxt.appTarget.runtime.palette = undefined; window.setToolsFlags({ backpack: true }); });
        assert.equal(await page.$(whiteboard), null);
        assert(await page.$(backpack));
    });

    it("tabs between Documentation and Backpack when whiteboard is unavailable", async () => {
        await page.setViewport({ width: 1366, height: 900 });
        await page.evaluate(() => window.setToolsFlags({ whiteboard: false }));
        await optionsAre(false);
        await page.focus(more);
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement.id), "project-tools-tab-docs");
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement.id), "project-tools-tab-backpack");
        await shiftTab();
        assert.equal(await page.evaluate(() => document.activeElement.id), "project-tools-tab-docs");
        await shiftTab();
        assert.equal(await page.evaluate(() => document.activeElement.id), "project-tools-launcher");
        assert.equal(await page.$eval("#project-tools-options", element => element.getAttribute("role")), "group");
        assert.equal(await page.$$eval("#project-tools-options button", buttons => buttons.some(button =>
            button.hasAttribute("aria-selected") || button.hasAttribute("role"))), false);
        await page.focus(backpack);
        await page.keyboard.press("Space");
        await page.waitForSelector("#test-backpack-signin", { visible: true });
        assert.equal(await page.$eval(backpack, element => element.getAttribute("aria-expanded")), "true");
        assert.equal(await page.$eval("#project-tools-backpack", element => element.getAttribute("role")), "region");
        await page.waitForFunction(() => getComputedStyle(document.getElementById("project-tools-launcher")).backgroundColor
            !== getComputedStyle(document.getElementById("project-tools-tab-backpack")).backgroundColor);
        assert.notEqual(await page.$eval(more, element => getComputedStyle(element).backgroundColor),
            await page.$eval(backpack, element => getComputedStyle(element).backgroundColor));
        await page.click(more);
        await optionsAre(true);
        assert.equal(await page.$$eval('#project-tools-options [tabindex="0"]', elements => elements.length), 0);
        await page.focus(more);
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement.id), "outside");
    });

    it("supports sequential Tab, manual arrow selection, and Escape focus", async () => {
        await page.focus(more);
        await page.keyboard.press("ArrowDown");
        await focusIs("project-tools-tab-docs");
        await page.keyboard.press("Tab");
        await focusIs("project-tools-tab-whiteboard");
        await page.keyboard.press("Tab");
        await focusIs("project-tools-tab-backpack");
        await shiftTab();
        await focusIs("project-tools-tab-whiteboard");
        await shiftTab();
        await focusIs("project-tools-tab-docs");
        await page.keyboard.press("ArrowRight");
        await focusIs("project-tools-tab-whiteboard");
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        assert.equal(await page.$$eval('#project-tools-options [tabindex="0"]', els => els.length), 3);
        await page.keyboard.press("Enter");
        await focusIs("project-tools-tab-whiteboard");
        await page.waitForSelector("#test-notes", { visible: true });
        await page.focus("#test-notes");
        await optionsAre(false);
        await page.keyboard.press("Escape");
        await focusIs("project-tools-tab-whiteboard");
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        await optionsAre(false);
        await page.keyboard.press("Escape");
        await optionsAre(true);
        await focusIs("project-tools-launcher");
    });

    // Horizontal RTL reverses arrows; vertical navigation automatically selects.
    for (const { width, rtl } of [{ width: 1024, rtl: true }, { width: 1366, rtl: false }]) {
        it(`cycles bubble shortcuts and Home/End at ${width}px in ${rtl ? "RTL" : "LTR"}`, async () => {
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
                assert.deepEqual(await page.$$eval('#project-tools-options [tabindex="0"]', els => els.map(el => el.id)),
                    ["project-tools-tab-docs", "project-tools-tab-whiteboard", "project-tools-tab-backpack"]);
                const selected = compact ? "docs" : name;
                assert.equal(await page.$eval(panel, el => el.dataset.activeTab), selected);
                assert.equal(await page.$eval(panel, el => el.hidden), false);
                assert.deepEqual(await page.$$eval('#project-tools-options [aria-expanded="true"]', els => els.map(el => el.id)), [`project-tools-tab-${selected}`]);
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
        assert.equal(await page.$eval(backpack, el => el.getAttribute("aria-expanded")), "true");
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
        const pin = `${panel} .project-tools-pin`;
        assert.equal(await page.$eval(pin, el => el.getAttribute("aria-pressed")), "false");
        await page.click(pin);
        assert.equal(await page.$eval(pin, el => el.getAttribute("aria-pressed")), "true");
        await page.$eval("#outside", el => el.addEventListener("click", () => el.dataset.clicked = "true"));
        await page.click("#outside");
        await focusIs("outside");
        assert.equal(await page.$eval("#outside", el => el.dataset.clicked), "true");
        assert.equal(await page.$eval(panel, el => el.hidden), false);
        await page.click(`${panel} .project-tools-close`);
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
        assert.equal(await page.$eval(`${panel} .project-tools-pin`, el => el.getAttribute("aria-pressed")), "true");
        await page.click("#outside");
        assert.equal(await page.$eval(panel, el => el.hidden), false);
        await page.click(`${panel} .project-tools-pin`);
        await page.evaluate(() => window.openHelp());
        assert.equal(await page.$eval(`${panel} .project-tools-pin`, el => el.getAttribute("aria-pressed")), "false");
        await page.click("#outside");
        assert.equal(await page.$eval(panel, el => el.hidden), true);
    });
});