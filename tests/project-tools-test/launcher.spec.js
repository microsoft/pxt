"use strict";

const assert = require("assert");
const fs = require("fs");
const { launchTestBrowser } = require("./browser");
const less = require("less");
const rtlcss = require("rtlcss");
const { colorThemes, contrastSamples } = require("./theme-helpers");

// Exercise the compiled component with real React, DOM focus and media queries.
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
            window.requestBackpackOpen = (headerId, focus) => {
                const request = { headerId, focus };
                window.openRequests.push(request);
                Array.from(window.backpackOpenListeners).forEach(listener => listener(request));
            };
            window.exports = {};
            window.require = id => {
                if (id === "react") return window.React;
                if (id === "../projectToolsState") return window.projectToolsState;
                if (id === "../backpack") return {
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
        const stateCode = fs.readFileSync("built/webapp/src/projectToolsState.js", "utf8");
        await page.addScriptTag({ content: `(function(exports) { ${stateCode}\n})(window.projectToolsState = {});` });
        const code = fs.readFileSync("built/webapp/src/components/ProjectTools.js", "utf8");
        await page.addScriptTag({ content: `(function(require, exports) { ${code}\n})(window.require, window.exports);` });
        await page.evaluate(() => {
            function Harness() {
                const [expanded, setExpanded] = React.useState(false);
                const [pinned, setPinned] = React.useState(false);
                const [request, setRequest] = React.useState(0);
                const [rtl, setRtl] = React.useState(false);
                pxt.Util.isUserLanguageRtl = () => rtl;
                window.setRtl = setRtl;
                window.openHelp = () => { setRequest(value => value + 1); setExpanded(true); };
                window.openExample = () => { setPinned(true); window.openHelp(); };
                return React.createElement(exports.ProjectTools, {
                    header: { id: "test-project" }, expanded, onExpandedChange: setExpanded,
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

    for (const width of [320, 1024, 1366]) for (const rtl of [false, true]) {
        it(`shows only inactive tab hover labels above the panel and adds an ellipsis label at ${width}px in ${rtl ? "RTL" : "LTR"}`, async () => {
            await openTool(backpack, width);
            if (rtl) {
                await page.$eval("style", (el, text) => el.textContent = text, rtlcss.process(css));
                await page.evaluate(() => window.setRtl(true));
            }
            await page.hover(backpack);
            await labelIs(backpack, false);
            assert.equal(await page.$eval(backpack, el => el.hasAttribute("title")), false, "Do not show a native tooltip for the open tab");
            for (const [selector, text] of [[docs, "Documentation"], [whiteboard, "Whiteboard"], [more, "Project tools"]]) {
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
                    return { text: label.textContent, topmost, pointerEvents,
                        withinViewport: bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight,
                        accessibleName: label.parentElement.getAttribute("aria-label"), hiddenFromAT: label.getAttribute("aria-hidden"),
                        nativeTooltip: label.parentElement.hasAttribute("title") };
                });
                assert.deepEqual(actual, { text, topmost: true, pointerEvents: "none", withinViewport: true,
                    accessibleName: text, hiddenFromAT: "true", nativeTooltip: false });
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
        });
    }

    for (const width of [390, 1024, 1366]) {
        it(`shows keyboard indicators without duplicating the open tab label at ${width}px`, async () => {
            await openTool(backpack, width);
            await page.click(more);
            await optionsAre(true);
            await page.hover("#outside");
            await page.keyboard.press("ArrowDown");
            await focusIs("project-tools-tab-backpack");
            await labelIs(backpack, true);
            await page.keyboard.press("Enter");
            await labelIs(backpack, false);
            assert.equal(await page.$eval(panel, el => el.hidden), false);
            await page.keyboard.press("Escape");
            await labelIs(backpack, true);
            await page.keyboard.press("Escape");
            await optionsAre(true);
            await focusIs("project-tools-launcher");
            await labelIs(more, true);
            await labelIs(backpack, false);
        });
    }

    it("keeps hover labels readable across editor themes and forced colors", async () => {
        await openTool(backpack, 1366);
        for (const theme of colorThemes()) {
            await page.$eval("#root", (root, colors) => {
                root.removeAttribute("style");
                for (const [name, color] of Object.entries(colors)) root.style.setProperty(`--${name}`, color);
            }, theme.colors);
            for (const selector of [docs, more]) {
                await page.hover(selector);
                await labelIs(selector, true);
                const [sample] = await contrastSamples(page, `${selector} .project-tools__bubble-label`);
                assert.ok(sample.contrast >= 4.5, `${theme.id}: ${sample.label} contrast ${sample.contrast.toFixed(2)}`);
            }
        }
        const session = await page.createCDPSession();
        await session.send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
        await page.hover(docs);
        await labelIs(docs, true);
        const [sample] = await contrastSamples(page, `${docs} .project-tools__bubble-label`);
        assert.ok(sample.contrast >= 4.5);
        await session.detach();
    });

    for (const width of [390, 1024, 1366]) {
        it(`keeps the unpinned backpack open during modal focus and resumes dismissal afterward at ${width}px`, async () => {
            await openTool(backpack, width);
            await page.evaluate(() => window.setBackpackModalOpen(true));
            await page.focus("#outside");
            await page.click("#outside");
            assert.equal(await page.$eval(panel, element => element.hidden), false);
            assert.equal(await page.$eval(`${panel} .project-tools__pin`, element => element.getAttribute("aria-pressed")), "false");
            await page.evaluate(() => window.setBackpackModalOpen(false));
            await page.click("#outside");
            await page.waitForFunction(() => document.getElementById("project-tools-panel").hidden);
        });
    }

    for (const width of [390, 768, 991, 992, 1024, 1199, 1200, 1366]) {
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
            assert.deepEqual(await page.$$eval('#project-tools-options [role="tab"]', els => els.map(el => ({
                id: el.id, index: el.style.getPropertyValue("--tools-bubble-index")
            }))), [
                { id: "project-tools-tab-docs", index: "0" },
                { id: "project-tools-tab-whiteboard", index: "1" },
                { id: "project-tools-tab-backpack", index: "2" }
            ]);
            assert.equal(await page.$eval(".project-tools", el => el.style.getPropertyValue("--tools-tab-count")), "3");
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
        for (const width of [1200, 1366, 1199, 992]) {
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

    it("adapts untouched widths to the legacy sidedocs footprint", async () => {
        await openTool(docs);
        for (const [width, expected] of [
            [280, 264], [320, 288], [390, 288], [767, 288], [768, 352], [991, 352],
            [992, 344], [1024, 344], [1199, 344], [1200, 368], [1366, 368], [1920, 368]
        ]) {
            await page.setViewport({ width, height: 900 });
            await page.waitForFunction(expected => {
                const panel = document.getElementById("project-tools-panel");
                const handle = panel.querySelector(".project-tools__resize--width");
                return panel.getBoundingClientRect().width === expected && Number(handle.getAttribute("aria-valuenow")) === expected;
            }, {}, expected);
            const bounds = await page.$eval(panel, el => el.getBoundingClientRect().toJSON());
            assert.equal(await page.$eval(panel, el => el.style.width), "", "Untouched width must remain responsive");
            assert.ok(bounds.left >= 0 && bounds.right <= width);
            if (width >= 992) {
                const legacyFootprint = width >= 1200 ? 448 : 352;
                assert.equal(width - bounds.left, legacyFootprint, "Include the bubble strip when comparing coding space");
                assert.ok(bounds.left - 352 >= width - legacyFootprint - 352, "Do not reduce space between the simulator and docs");
            }
        }
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

    for (const width of [992, 1024, 1199]) {
        it(`keeps horizontal bubbles above the panel with desktop spacing at ${width}px`, async () => {
            await openTool(docs, width);
            const layout = await page.evaluate(() => ({
                launcher: document.querySelector(".project-tools__launcher").getBoundingClientRect().toJSON(),
                docs: document.getElementById("project-tools-tab-docs").getBoundingClientRect().toJSON(),
                whiteboard: document.getElementById("project-tools-tab-whiteboard").getBoundingClientRect().toJSON(),
                backpack: document.getElementById("project-tools-tab-backpack").getBoundingClientRect().toJSON(),
                panel: document.getElementById("project-tools-panel").getBoundingClientRect().toJSON()
            }));
            assert.equal(await page.$eval("#project-tools-options", el => el.getAttribute("aria-orientation")), "horizontal");
            assert.equal(layout.docs.top, layout.whiteboard.top);
            assert.equal(layout.backpack.top, layout.whiteboard.top);
            assert.ok(layout.docs.right <= layout.whiteboard.left);
            assert.ok(layout.whiteboard.right <= layout.backpack.left);
            assert.ok(layout.backpack.right <= layout.launcher.left);
            assert.equal(layout.launcher.top, 72, "Use the desktop menu height, not the tablet menu height");
            assert.equal(layout.panel.top, 140);
            assert.ok(layout.docs.bottom < layout.panel.top);
            assert.ok(Math.abs(900 - layout.panel.bottom - 5.7 * 16) < 1, "Retain desktop footer spacing");
            await page.focus(docs);
            await page.keyboard.press("ArrowRight");
            await focusIs("project-tools-tab-whiteboard");
            assert.equal(await page.$eval(panel, el => el.dataset.activeTab), "docs", "Arrow navigation does not open a compact tab until selected");
            await page.keyboard.press("Enter");
            assert.equal(await page.$eval(panel, el => el.dataset.activeTab), "whiteboard");
        });
    }

    it("keeps options visible so the active bubble can close its panel", async () => {
        await optionsAre(true);
        assert.equal(await page.$eval(more, el => el.getAttribute("aria-expanded")), "false");
        assert.equal(await page.$$eval('#project-tools-options [tabindex="0"]', els => els.length), 0);
        await page.click(more);
        await optionsAre(false);
        await page.click(whiteboard);
        await optionsAre(false);
        await focusIs("project-tools-tab-whiteboard");
        assert.equal(await page.$eval(panel, el => el.hidden), false);
        assert.equal(await page.$eval(whiteboard, el => el.getAttribute("aria-selected")), "true");
        await page.click(whiteboard);
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        await optionsAre(false);
        await focusIs("project-tools-tab-whiteboard");
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

    for (const width of [1024, 1366]) it(`supports desktop disclosure and tab keyboard navigation at ${width}px`, async () => {
        await page.setViewport({ width, height: 900 });
        await optionsAre(false);
        await page.focus(more);
        await page.keyboard.press("ArrowDown");
        await focusIs("project-tools-tab-docs");
        await page.keyboard.press(width < 1200 ? "ArrowRight" : "ArrowDown");
        await focusIs("project-tools-tab-whiteboard");
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        assert.equal(await page.$$eval('#project-tools-options [tabindex="0"]', els => els.length), 1);
        await page.keyboard.press("Enter");
        await page.waitForSelector("#test-notes", { visible: true });
        await page.focus("#test-notes");
        await page.keyboard.press("Escape");
        await focusIs("project-tools-tab-whiteboard");
        await optionsAre(false);
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        await page.keyboard.press("Escape");
        await optionsAre(true);
        await focusIs("project-tools-launcher");
        assert.equal(await page.$$eval('#project-tools-options [tabindex="0"]', els => els.length), 0);
        await page.keyboard.press("ArrowDown");
        await optionsAre(false);
        await focusIs("project-tools-tab-whiteboard");
        assert.equal(await page.$eval(panel, el => el.hidden), true);
    });

    for (const width of [390, 1024, 1366]) for (const rtl of [false, true]) {
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

    for (const width of [390, 1024, 1366]) {
        it(`opens backpack on drag dwell without stealing focus at ${width}px`, async () => {
            await page.setViewport({ width, height: 900 });
            await optionsAre(width <= 991);
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

        for (const alreadyOpen of [false, true]) it(`opens backpack from context with focused tab ${alreadyOpen ? "over whiteboard" : "from closed tools"} at ${width}px`, async () => {
            if (alreadyOpen) {
                await openTool(whiteboard, width);
                await page.focus("#test-notes");
            } else {
                await page.setViewport({ width, height: 900 });
                await optionsAre(width <= 991);
                await page.focus("#outside");
            }
            await page.evaluate(() => window.requestBackpackOpen("test-project", true));
            await page.waitForSelector("#test-backpack-signin", { visible: true });
            await optionsAre(false);
            await focusIs("project-tools-tab-backpack");
            assert.deepEqual(await page.$$eval('#project-tools-options [tabindex="0"]', els => els.map(el => el.id)), ["project-tools-tab-backpack"]);
            assert.equal(await page.$eval(panel, el => el.dataset.activeTab), "backpack");
            assert.deepEqual(await page.evaluate(() => window.openRequests), [{ headerId: "test-project", focus: true }]);
        });
    }

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

    it("dismisses on outside click and Tab without stealing focus", async () => {
        await page.click(more);
        await optionsAre(false);
        await page.click("#outside");
        await optionsAre(true);
        await focusIs("outside");
        await page.focus(more);
        await page.keyboard.press("ArrowDown");
        await focusIs("project-tools-tab-docs");
        await page.keyboard.press("Tab");
        await optionsAre(true);
        await focusIs("outside");
    });

    for (const [name, selector] of [["documentation", docs], ["whiteboard", whiteboard]]) {
        for (const width of [390, 1024, 1366]) it(`closes ${name} and retracts the bubbles with the ellipsis at ${width}px`, async () => {
            await openTool(selector, width);
            let draft;
            if (selector === whiteboard) {
                await page.waitForSelector("#test-notes", { visible: true });
                await page.type("#test-notes", " retained after dismissal");
                draft = await page.$eval("#test-notes", el => el.value);
            }
            await page.click(more);
            await optionsAre(true);
            await focusIs("project-tools-launcher");
            assert.equal(await page.$eval(panel, el => el.hidden), true);
            await page.click(more);
            await optionsAre(false);
            assert.equal(await page.$eval(panel, el => el.hidden), true);
            await page.click(selector);
            assert.equal(await page.$eval(panel, el => el.hidden), false);
            if (draft) {
                assert.equal(await page.$eval("#test-notes", el => el.value), draft);
                assert.equal(await page.evaluate(() => window.whiteboardMounts), 1);
            }
        });

        for (const width of [390, 1024, 1366]) {
            it(`closes ${name} on outside clicks at ${width}px without blocking the target`, async () => {
                await openTool(selector, width);
                await page.$eval("#outside", el => {
                    el.addEventListener("pointerdown", event => event.stopPropagation());
                    el.addEventListener("click", () => el.dataset.clicked = "true");
                });
                await page.click("#outside");
                await optionsAre(width <= 991);
                await focusIs("outside");
                assert.equal(await page.$eval(panel, el => el.hidden), true);
                assert.equal(await page.$eval("#outside", el => el.dataset.clicked), "true");
            });
        }
    }

    for (const width of [390, 1024, 1366]) it(`closes requested help with the ellipsis while bubbles are hidden at ${width}px`, async () => {
        await openTool(docs, width);
        await page.click(more);
        await optionsAre(true);
        await page.evaluate(() => window.openHelp());
        await focusIs("project-tools-panel");
        await optionsAre(true);
        await page.click(more);
        await optionsAre(true);
        await focusIs("project-tools-launcher");
        assert.equal(await page.$eval(panel, el => el.hidden), true);
    });

    it("closes the panel when tabbing out without stealing focus", async () => {
        await openTool(whiteboard);
        await page.waitForSelector("#test-notes", { visible: true });
        await page.focus("#test-notes");
        await page.keyboard.press("Tab");
        await focusIs("outside");
        await optionsAre(true);
        assert.equal(await page.$eval(panel, el => el.hidden), true);
    });

    for (const [name, selector] of [["documentation", docs], ["whiteboard", whiteboard]]) {
        for (const width of [390, 1024, 1366]) {
            it(`keeps pinned ${name} open on outside clicks and after collapse/reopen at ${width}px`, async () => {
                await openTool(selector, width);
                const pin = `${panel} .project-tools__pin`;
                assert.equal(await page.$eval(pin, el => el.getAttribute("aria-pressed")), "false");
                await page.click(pin);
                assert.equal(await page.$eval(pin, el => el.getAttribute("aria-pressed")), "true");
                assert.equal(await page.$eval(pin, el => el.textContent.trim()), "");
                assert.equal(await page.$eval(pin, el => el.title), "Unpin project tools");
                assert.equal(await page.$eval(pin, el => el.getAttribute("aria-label")), "Keep project tools open");
                await page.$eval("#outside", el => el.addEventListener("click", () => el.dataset.clicked = "true"));
                await page.click("#outside");
                await focusIs("outside");
                assert.equal(await page.$eval("#outside", el => el.dataset.clicked), "true");
                assert.equal(await page.$eval(panel, el => el.hidden), false);
                await page.click(`${panel} .project-tools__close`);
                assert.equal(await page.$eval(panel, el => el.hidden), true);
                await page.click(selector);
                assert.equal(await page.$eval(pin, el => el.getAttribute("aria-pressed")), "true");
                await page.click("#outside");
                assert.equal(await page.$eval(panel, el => el.hidden), false);
                await page.click(pin);
                assert.equal(await page.$eval(pin, el => el.getAttribute("aria-pressed")), "false");
                assert.equal(await page.$eval(pin, el => el.textContent.trim()), "");
                assert.equal(await page.$eval(pin, el => el.title), "Pin project tools open");
                assert.equal(await page.$eval(panel, el => el.hidden), false);
                await page.click("#outside");
                await optionsAre(width <= 991);
                assert.equal(await page.$eval(panel, el => el.hidden), true);
            });
        }
    }

    for (const method of ["bubble", "ellipsis", "Escape"]) for (const width of [390, 1024, 1366]) {
        it(`preserves pin when explicitly collapsing with ${method} at ${width}px`, async () => {
            await openTool(whiteboard, width);
            await page.click(`${panel} .project-tools__pin`);
            if (method === "bubble") await page.click(whiteboard);
            else if (method === "ellipsis") await page.click(more);
            else { await page.focus("#test-notes"); await page.keyboard.press("Escape"); }
            assert.equal(await page.$eval(panel, el => el.hidden), true);
            if (method === "ellipsis") {
                await optionsAre(true);
                await page.click(more);
                await optionsAre(false);
            }
            await page.click(whiteboard);
            assert.equal(await page.$eval(`${panel} .project-tools__pin`, el => el.getAttribute("aria-pressed")), "true");
            await page.click("#outside");
            assert.equal(await page.$eval(panel, el => el.hidden), false);
        });
    }

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

    it("shares the pin across tabs and viewport changes while allowing keyboard focus outside", async () => {
        await openTool(whiteboard);
        await page.focus(`${panel} .project-tools__pin`);
        await page.keyboard.press("Space");
        await page.focus("#test-notes");
        await page.keyboard.press("Tab");
        await focusIs("outside");
        assert.equal(await page.$eval(panel, el => el.hidden), false);
        await page.click(docs);
        await page.setViewport({ width: 1366, height: 900 });
        await optionsAre(false);
        assert.equal(await page.$eval(`${panel} .project-tools__pin`, el => el.getAttribute("aria-pressed")), "true");
        await page.click("#outside");
        assert.equal(await page.$eval(panel, el => el.hidden), false);
    });

    it("restores vertical tabs at 1200px and preserves the mounted draft", async () => {
        await page.click(more);
        await optionsAre(false);
        await page.click(whiteboard);
        await page.waitForSelector("#test-notes", { visible: true });
        await page.type("#test-notes", " edited");
        const draft = await page.$eval("#test-notes", el => el.value);
        await page.setViewport({ width: 1200, height: 844 });
        await page.waitForFunction(() => document.getElementById("project-tools-options").getAttribute("aria-orientation") === "vertical");
        await page.waitForSelector(more, { visible: true });
        await optionsAre(false);
        assert.equal(await page.$eval("#project-tools-options", el => el.getAttribute("aria-orientation")), "vertical");
        await page.focus(whiteboard);
        await page.setViewport({ width: 1199, height: 844 });
        await page.waitForFunction(() => document.getElementById("project-tools-options").getAttribute("aria-orientation") === "horizontal");
        await optionsAre(false);
        await focusIs("project-tools-tab-whiteboard");
        assert.equal(await page.$eval("#test-notes", el => el.value), draft);
        assert.equal(await page.evaluate(() => window.whiteboardMounts), 1);
    });

    for (const width of [390, 1024, 1366]) it(`opens requested documentation while options are hidden at ${width}px`, async () => {
        await openTool(whiteboard, width);
        await page.click(more);
        await optionsAre(true);
        await page.evaluate(() => window.openHelp());
        await focusIs("project-tools-panel");
        await optionsAre(true);
        await page.waitForFunction(() => !document.getElementById("project-tools-docs").hidden);
        assert.equal(await page.$eval(docs, el => el.getAttribute("aria-selected")), "true");
        await page.click(`${panel} .project-tools__close`);
        await focusIs("project-tools-launcher");
        await optionsAre(true);
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

    for (const width of [1024, 1366]) for (const rtl of [false, true]) {
        it(`shows a working width grip at ${width}px in ${rtl ? "RTL" : "LTR"}`, async () => {
            await openTool(docs, width);
            if (rtl) {
                await page.$eval("style", (el, css) => el.textContent = css, rtlcss.process(css));
                await page.evaluate(() => window.setRtl(true));
            }
            const grip = ".project-tools__resize--width .project-tools__resize-grip";
            const geometry = await page.$eval(grip, el => ({
                rect: el.getBoundingClientRect().toJSON(),
                panel: document.getElementById("project-tools-panel").getBoundingClientRect().toJSON(),
                dots: el.querySelectorAll("circle").length,
                hiddenFromAT: el.getAttribute("aria-hidden"),
                pointerEvents: getComputedStyle(el).pointerEvents,
                cursor: getComputedStyle(el.parentElement).cursor
            }));
            const { rect, panel: bounds } = geometry;
            const x = rect.x + rect.width / 2;
            const y = rect.y + rect.height / 2;
            assert.ok(Math.abs(y - bounds.y - bounds.height / 2) < 1);
            assert.ok(Math.abs(x - (rtl ? bounds.right : bounds.left)) < 2);
            assert.equal(geometry.dots, 6);
            assert.equal(geometry.hiddenFromAT, "true");
            assert.equal(geometry.pointerEvents, "none");
            assert.equal(geometry.cursor, "ew-resize");
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

    for (const width of [390, 1024, 1366]) {
        for (const rtl of [false, true]) {
            it(`resizes height with the bottom grip and keyboard at ${width}px in ${rtl ? "RTL" : "LTR"}`, async () => {
                await openTool(docs, width);
                if (rtl) {
                    await page.$eval("style", (el, css) => el.textContent = css, rtlcss.process(css));
                    await page.evaluate(() => window.setRtl(true));
                }
                const handle = ".project-tools__resize--height";
                const grip = `${handle} .project-tools__resize-grip`;
                const before = await page.$eval(panel, el => el.getBoundingClientRect().toJSON());
                const geometry = await page.$eval(grip, el => ({
                    bounds: el.getBoundingClientRect().toJSON(),
                    dots: el.querySelectorAll("circle").length,
                    hiddenFromAT: el.getAttribute("aria-hidden"),
                    cursor: getComputedStyle(el.parentElement).cursor
                }));
                const x = geometry.bounds.x + geometry.bounds.width / 2;
                const y = geometry.bounds.y + geometry.bounds.height / 2;
                assert.ok(Math.abs(x - before.x - before.width / 2) < 1);
                assert.ok(Math.abs(y - before.bottom) < 2);
                assert.equal(geometry.dots, 6);
                assert.equal(geometry.hiddenFromAT, "true");
                assert.equal(geometry.cursor, "ns-resize");
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
        }
    }

    it("retains both dimensions across switching and collapse while fitting the viewport and banner", async () => {
        await openTool(whiteboard, 1366);
        await page.waitForSelector("#test-notes", { visible: true });
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

    it("keeps bubbles out while using and switching panels", async () => {
        await page.click(more);
        await optionsAre(false);
        await page.click(whiteboard);
        await page.waitForSelector("#test-notes", { visible: true });
        await page.type("#test-notes", " edited");
        const draft = await page.$eval("#test-notes", el => el.value);
        await optionsAre(false);
        await page.click(docs);
        await optionsAre(false);
        await page.click(backpack);
        await page.waitForSelector("#test-backpack-signin", { visible: true });
        await optionsAre(false);
        assert.equal(await page.$eval("#project-tools-whiteboard", el => el.hidden), true);
        assert.equal(await page.$eval("#test-notes", el => el.value), draft);
        assert.equal(await page.evaluate(() => window.whiteboardMounts), 1);
        await page.evaluate(() => window.openHelp());
        await focusIs("project-tools-panel");
        await optionsAre(false);
        await page.click(whiteboard);
        assert.equal(await page.$eval("#test-notes", el => el.value), draft);
        assert.equal(await page.evaluate(() => window.whiteboardMounts), 1);
        assert.equal(await page.evaluate(() => window.backpackMounts), 1);
        assert.equal(await page.evaluate(() => window.backpackProps.active), false);
        await page.click("#project-tools-whiteboard .project-tools__close");
        await focusIs("project-tools-tab-whiteboard");
        await optionsAre(false);
        await page.click(more);
        await optionsAre(true);
    });

    it("keeps bubbles out when focus enters the documentation iframe", async () => {
        await page.click(more);
        await optionsAre(false);
        await page.evaluate(() => window.openHelp());
        const iframe = await page.waitForSelector("#test-reference", { visible: true });
        const frame = await iframe.contentFrame();
        await frame.waitForSelector("h1");
        await frame.click("h1");
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.$eval(more, el => el.getAttribute("aria-expanded")), "true");
        await focusIs("test-reference");
        await optionsAre(false);
    });

    for (const pinned of [false, true]) for (const width of [390, 1024, 1366]) it(`${pinned ? "keeps pinned" : "closes unpinned"} documentation when clicking an outside iframe at ${width}px`, async () => {
        await openTool(docs, width);
        await page.evaluate(() => window.openHelp());
        if (pinned) await page.click(`${panel} .project-tools__pin`);
        const inside = await page.waitForSelector("#test-reference", { visible: true });
        const insideFrame = await inside.contentFrame();
        await insideFrame.waitForSelector("h1");
        await insideFrame.click("h1");
        await focusIs("test-reference");
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

    for (const width of [390, 1024, 1366]) for (const rtl of [false, true]) {
        it(`animates all three bubbles from the launcher at ${width}px in ${rtl ? "RTL" : "LTR"}`, async () => {
            await page.setViewport({ width, height: 900 });
            await optionsAre(width <= 991);
            if (width > 991) {
                await page.click(more);
                await optionsAre(true);
            }
            if (rtl) {
                await page.$eval("style", (el, text) => el.textContent = text, rtlcss.process(css));
                await page.evaluate(() => window.setRtl(true));
                // Changing direction in this harness can itself start a transform
                // transition. Settle it before measuring the disclosure animation.
                await page.$$eval("#project-tools-options .project-tools__bubble", elements => {
                    elements.forEach(el => el.getAnimations().forEach(animation => animation.finish()));
                });
            }
            const positions = await page.evaluate(horizontal => {
                const launcher = document.getElementById("project-tools-launcher");
                const bubbles = Array.from(document.querySelectorAll("#project-tools-options .project-tools__bubble"));
                const center = el => {
                    const rect = el.getBoundingClientRect();
                    return horizontal ? rect.x + rect.width / 2 : rect.y + rect.height / 2;
                };
                const origin = center(launcher);
                const start = bubbles.map(center);
                launcher.click();
                const transitions = bubbles.map(el => el.getAnimations().find(animation => animation.transitionProperty === "transform"));
                const animated = transitions.every(Boolean);
                const durations = transitions.map(animation => animation?.effect.getTiming().duration);
                transitions.forEach(animation => {
                    if (!animation) return;
                    animation.pause();
                    animation.currentTime = animation.effect.getTiming().duration / 2;
                });
                const middle = bubbles.map(center);
                bubbles.forEach(el => el.getAnimations().forEach(animation => animation.finish()));
                return { origin, start, middle, end: bubbles.map(center), animated, durations };
            }, width < 1200);
            assert.equal(positions.animated, true);
            assert.deepEqual(positions.durations, [160, 160, 160]);
            assert.equal(positions.start.length, 3);
            assert.equal(positions.middle.length, 3);
            assert.equal(positions.end.length, 3);
            for (let i = 0; i < 3; ++i) {
                assert.ok(Math.abs(positions.start[i] - positions.origin) < 1, "bubble starts behind the launcher");
                const direction = width >= 1200 || rtl ? 1 : -1;
                const distance = (positions.end[i] - positions.start[i]) * direction;
                const halfway = (positions.middle[i] - positions.start[i]) * direction;
                assert.ok(distance > 40 && halfway > 0 && halfway < distance, "bubble travels outward over time");
                const steps = width < 1200 ? 3 - i : i + 1;
                assert.ok(Math.abs(distance - steps * (width < 1200 ? 60 : 64)) < 1, "Each indexed bubble reaches its own slot");
            }
            await page.click(more);
            assert.equal(await page.$$eval('#project-tools-options [tabindex="0"]', els => els.length), 0);
            assert.equal(await page.$eval("#project-tools-options", el => getComputedStyle(el).pointerEvents), "none");
            await optionsAre(true);
        });
    }

    for (const width of [390, 1024, 1366]) it(`respects reduced motion without disabling the launcher at ${width}px`, async () => {
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
        await page.setViewport({ width, height: 900 });
        await optionsAre(width <= 991);
        await showOptions();
        assert.deepEqual(await page.$$eval('#project-tools-options [role="tab"]', els => els.map(el => el.getAnimations().length)), [0, 0, 0]);
        await page.click(docs);
        await optionsAre(false);
        await page.click(docs);
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        await page.click(more);
        await optionsAre(true);
    });

    for (const width of [390, 1024, 1366]) it(`centers all three ellipsis dots in the bubble at ${width}px`, async () => {
        await page.setViewport({ width, height: 900 });
        await optionsAre(width <= 991);
        const centers = await page.$eval(more, el => {
            const button = el.getBoundingClientRect();
            const dots = Array.from(el.querySelectorAll("circle")).map(dot => dot.getBoundingClientRect());
            return {
                buttonX: button.x + button.width / 2,
                buttonY: button.y + button.height / 2,
                dotsX: (Math.min(...dots.map(dot => dot.left)) + Math.max(...dots.map(dot => dot.right))) / 2,
                dotsY: dots.map(dot => dot.y + dot.height / 2)
            };
        });
        assert.equal(centers.dotsY.length, 3);
        assert.ok(Math.abs(centers.buttonX - centers.dotsX) < .5);
        assert.ok(centers.dotsY.every(y => Math.abs(y - centers.buttonY) < .5));
    });

    for (const width of [390, 768, 1024, 1199, 1200, 1366]) {
        it(`keeps tools below the experiments banner at ${width}px`, async () => {
            await openTool(docs, width);
            const positions = () => page.evaluate(() => {
                const launcher = document.querySelector(".project-tools__launcher").getBoundingClientRect();
                const panel = document.getElementById("project-tools-panel").getBoundingClientRect();
                return { launcherTop: launcher.top, panelTop: panel.top, panelBottom: panel.bottom };
            });
            const initial = await positions();
            await page.$eval("#root", el => el.classList.add("notificationBannerVisible"));
            const withBanner = await positions();
            assert.equal(withBanner.launcherTop, initial.launcherTop + 32);
            assert.equal(withBanner.panelTop, initial.panelTop + 32);
            assert.equal(withBanner.panelBottom, initial.panelBottom);
            await page.$eval("#root", el => el.classList.remove("notificationBannerVisible"));
            assert.deepEqual(await positions(), initial);
        });
    }

    for (const width of [390, 1024, 1199, 1200, 1366]) {
        for (const rtl of [false, true]) {
            it(`points the panel at its source at ${width}px in ${rtl ? "RTL" : "LTR"}`, async () => {
                await page.setViewport({ width, height: 900 });
                await page.waitForFunction(compact => document.querySelector(".project-tools").classList.contains("project-tools--compact") === compact, {}, width < 1200);
                await optionsAre(width <= 991);
                if (rtl) {
                    await page.$eval("style", (el, text) => el.textContent = text, rtlcss.process(css));
                    await page.evaluate(() => window.setRtl(true));
                }
                await showOptions();
                const checkPointer = async selector => {
                    const positions = await page.evaluate(selector => {
                        const pointer = document.querySelector(".project-tools__pointer").getBoundingClientRect();
                        const bubble = document.querySelector(selector).getBoundingClientRect();
                        const panel = document.getElementById("project-tools-panel").getBoundingClientRect();
                        return { pointer: pointer.toJSON(), bubble: bubble.toJSON(), panel: panel.toJSON() };
                    }, selector);
                    const { pointer, bubble, panel } = positions;
                    if (width < 1200) {
                        assert.ok(Math.abs(pointer.x + pointer.width / 2 - bubble.x - bubble.width / 2) < 1);
                        assert.ok(pointer.top < panel.top && pointer.bottom > panel.top);
                    } else {
                        assert.ok(Math.abs(pointer.y + pointer.height / 2 - bubble.y - bubble.height / 2) < 1);
                        const edge = rtl ? panel.left : panel.right;
                        assert.ok(pointer.left < edge && pointer.right > edge);
                    }
                };
                for (const selector of [docs, whiteboard, backpack]) {
                    await page.click(selector);
                    assert.equal(await page.$eval(panel, el => el.hidden), false);
                    await checkPointer(selector);
                }
                await page.click(more);
                await optionsAre(true);
                assert.equal(await page.$eval(panel, el => el.hidden), true);
                await page.evaluate(() => window.openHelp());
                await focusIs("project-tools-panel");
                await checkPointer(more);
            });
        }
    }
});