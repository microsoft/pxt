"use strict";

const assert = require("assert");
const fs = require("fs");
const puppeteer = require("puppeteer");
const less = require("less");
const rtlcss = require("rtlcss");

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
    const panel = "#project-tools-panel";

    before(async () => {
        const styles = await less.render(fs.readFileSync("theme/project-tools.less", "utf8"), {
            modifyVars: {
                mainMenuHeight: "4rem", mobileMenuHeight: "3.5rem", editorToolsCollapsedHeight: "4.7rem",
                editorToolsHeight: "10rem", editorToolsCollapsedMobileHeight: "3.4rem",
                sidedocZIndex: "50", largestTabletScreen: "991px", bannerHeight: "2rem"
            }
        });
        css = `* { box-sizing: border-box; } ${styles.css}`;
        browser = await puppeteer.launch({ headless: true });
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
            window.exports = {};
            window.require = id => {
                if (id === "react") return window.React;
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
        const code = fs.readFileSync("built/webapp/src/components/ProjectTools.js", "utf8");
        await page.addScriptTag({ content: `(function(require, exports) { ${code}\n})(window.require, window.exports);` });
        await page.evaluate(() => {
            function Harness() {
                const [expanded, setExpanded] = React.useState(false);
                const [request, setRequest] = React.useState(0);
                const [rtl, setRtl] = React.useState(false);
                pxt.Util.isUserLanguageRtl = () => rtl;
                window.setRtl = setRtl;
                window.openHelp = () => { setRequest(value => value + 1); setExpanded(true); };
                return React.createElement(exports.ProjectTools, {
                    header: { id: "test-project" }, expanded, onExpandedChange: setExpanded,
                    docsUrl: request ? "/reference" : undefined, docsRequest: request,
                    onOpenReference: window.openHelp
                }, React.createElement("iframe", {
                    id: "test-reference", title: "Reference content", srcDoc: "<h1>Reference content</h1>"
                }));
            }
            ReactDOM.render(React.createElement(Harness), document.getElementById("root"));
        });
        await page.waitForSelector(more);
    });
    afterEach(async () => { await page?.close(); });

    const focusIs = async id => page.waitForFunction(value => document.activeElement.id === value, {}, id);
    const optionsAre = async hidden => page.waitForFunction(value => {
        const options = document.getElementById("project-tools-options");
        return options.getAttribute("aria-hidden") === String(value) && (value
            ? getComputedStyle(options).visibility === "hidden"
            : Array.from(options.children).every(el => getComputedStyle(el).transform === "none"));
    }, {}, hidden);
    const openTool = async (selector, width = 390) => {
        await page.setViewport({ width, height: 900 });
        await page.waitForFunction(compact => document.querySelector(".project-tools").classList.contains("project-tools--compact") === compact, {}, width <= 991);
        if (width <= 991) {
            await page.click(more);
            await optionsAre(false);
        }
        await page.click(selector);
        await page.waitForFunction(() => !document.getElementById("project-tools-panel").hidden);
    };

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
        it(`closes ${name} and retracts the bubbles when clicking the ellipsis`, async () => {
            await openTool(selector);
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

        for (const width of [390, 1366]) {
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

    it("closes requested help from the ellipsis even when the options are already hidden", async () => {
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

    it("restores desktop tabs above 991px and preserves the mounted draft", async () => {
        await page.click(more);
        await optionsAre(false);
        await page.click(whiteboard);
        await page.waitForSelector("#test-notes", { visible: true });
        await page.type("#test-notes", " edited");
        const draft = await page.$eval("#test-notes", el => el.value);
        await page.setViewport({ width: 992, height: 844 });
        await page.waitForSelector(more, { hidden: true });
        await optionsAre(false);
        assert.equal(await page.$eval("#project-tools-options", el => el.getAttribute("aria-orientation")), "vertical");
        await page.focus(whiteboard);
        await page.setViewport({ width: 991, height: 844 });
        await page.waitForSelector(more, { visible: true });
        await optionsAre(true);
        await focusIs("project-tools-launcher");
        assert.equal(await page.$eval("#test-notes", el => el.value), draft);
        assert.equal(await page.evaluate(() => window.whiteboardMounts), 1);
    });

    it("opens requested documentation while options are hidden", async () => {
        await page.click(more);
        await optionsAre(false);
        await page.click(whiteboard);
        await page.click(more);
        await optionsAre(true);
        await page.evaluate(() => window.openHelp());
        await focusIs("project-tools-panel");
        await optionsAre(true);
        await page.waitForFunction(() => !document.getElementById("project-tools-docs").hidden);
        assert.equal(await page.$eval(docs, el => el.getAttribute("aria-selected")), "true");
    });

    it("moves focus off the resize handle when changing to compact layout", async () => {
        await page.setViewport({ width: 1366, height: 900 });
        await page.waitForSelector(more, { hidden: true });
        await page.click(docs);
        await page.focus(".project-tools__resize");
        await page.setViewport({ width: 768, height: 900 });
        await focusIs("project-tools-panel");
        await optionsAre(true);
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
        await page.evaluate(() => window.openHelp());
        await focusIs("project-tools-panel");
        await optionsAre(false);
        await page.click(whiteboard);
        assert.equal(await page.$eval("#test-notes", el => el.value), draft);
        assert.equal(await page.evaluate(() => window.whiteboardMounts), 1);
        await page.click(".project-tools__close");
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

    it("closes the panel when clicking an outside iframe after reading documentation", async () => {
        await openTool(docs);
        await page.evaluate(() => window.openHelp());
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
        await page.waitForFunction(() => document.getElementById("project-tools-panel").hidden);
        await optionsAre(true);
        await focusIs("outside-frame");
        assert.equal(await outsideFrame.evaluate(() => document.activeElement.id), "simulator-button");
    });

    for (const rtl of [false, true]) {
        it(`animates both bubbles from the launcher in ${rtl ? "RTL" : "LTR"}`, async () => {
            if (rtl) {
                await page.$eval("style", (el, text) => el.textContent = text, rtlcss.process(css));
                await page.evaluate(() => window.setRtl(true));
                // Changing direction in this harness can itself start a transform
                // transition. Settle it before measuring the disclosure animation.
                await page.$$eval("#project-tools-options .project-tools__bubble", elements => {
                    elements.forEach(el => el.getAnimations().forEach(animation => animation.finish()));
                });
            }
            const positions = await page.evaluate(() => {
                const launcher = document.getElementById("project-tools-launcher");
                const bubbles = Array.from(document.querySelectorAll("#project-tools-options .project-tools__bubble"));
                const center = el => {
                    const rect = el.getBoundingClientRect();
                    return rect.x + rect.width / 2;
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
            });
            assert.equal(positions.animated, true);
            assert.deepEqual(positions.durations, [160, 160]);
            for (let i = 0; i < 2; ++i) {
                assert.ok(Math.abs(positions.start[i] - positions.origin) < 1, "bubble starts behind the launcher");
                const direction = rtl ? 1 : -1;
                const distance = (positions.end[i] - positions.start[i]) * direction;
                const halfway = (positions.middle[i] - positions.start[i]) * direction;
                assert.ok(distance > 40 && halfway > 0 && halfway < distance, "bubble travels outward over time");
            }
            await page.click(more);
            assert.equal(await page.$$eval('#project-tools-options [tabindex="0"]', els => els.length), 0);
            assert.equal(await page.$eval("#project-tools-options", el => getComputedStyle(el).pointerEvents), "none");
            await optionsAre(true);
        });
    }

    it("respects reduced motion without disabling the launcher", async () => {
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
        await page.click(more);
        await optionsAre(false);
        assert.equal(await page.$eval(docs, el => el.getAnimations().length), 0);
        await page.click(docs);
        await optionsAre(false);
        await page.click(docs);
        assert.equal(await page.$eval(panel, el => el.hidden), true);
        await page.click(more);
        await optionsAre(true);
    });

    it("centers all three ellipsis dots in the bubble", async () => {
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

    for (const width of [390, 768, 1366]) {
        it(`keeps tools below the experiments banner at ${width}px`, async () => {
            await page.setViewport({ width, height: 900 });
            await page.waitForFunction(compact => document.querySelector(".project-tools").classList.contains("project-tools--compact") === compact, {}, width <= 991);
            if (width <= 991) {
                await page.click(more);
                await optionsAre(false);
            }
            await page.click(docs);
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

    for (const width of [390, 1366]) {
        for (const rtl of [false, true]) {
            it(`points the panel at its source at ${width}px in ${rtl ? "RTL" : "LTR"}`, async () => {
                await page.setViewport({ width, height: 900 });
                await page.waitForFunction(compact => document.querySelector(".project-tools").classList.contains("project-tools--compact") === compact, {}, width <= 991);
                if (rtl) {
                    await page.$eval("style", (el, text) => el.textContent = text, rtlcss.process(css));
                    await page.evaluate(() => window.setRtl(true));
                }
                if (width <= 991) {
                    await page.click(more);
                    await optionsAre(false);
                }
                const checkPointer = async selector => {
                    const positions = await page.evaluate(selector => {
                        const pointer = document.querySelector(".project-tools__pointer").getBoundingClientRect();
                        const bubble = document.querySelector(selector).getBoundingClientRect();
                        const panel = document.getElementById("project-tools-panel").getBoundingClientRect();
                        return { pointer: pointer.toJSON(), bubble: bubble.toJSON(), panel: panel.toJSON() };
                    }, selector);
                    const { pointer, bubble, panel } = positions;
                    if (width <= 991) {
                        assert.ok(Math.abs(pointer.x + pointer.width / 2 - bubble.x - bubble.width / 2) < 1);
                        assert.ok(pointer.top < panel.top && pointer.bottom > panel.top);
                    } else {
                        assert.ok(Math.abs(pointer.y + pointer.height / 2 - bubble.y - bubble.height / 2) < 1);
                        const edge = rtl ? panel.left : panel.right;
                        assert.ok(pointer.left < edge && pointer.right > edge);
                    }
                };
                for (const selector of [docs, whiteboard]) {
                    await page.click(selector);
                    assert.equal(await page.$eval(panel, el => el.hidden), false);
                    await checkPointer(selector);
                }
                if (width <= 991) {
                    await page.click(more);
                    await optionsAre(true);
                    assert.equal(await page.$eval(panel, el => el.hidden), true);
                    await page.evaluate(() => window.openHelp());
                    await focusIs("project-tools-panel");
                    await checkPointer(more);
                }
            });
        }
    }
});