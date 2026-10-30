"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { launchTestBrowser } = require("./browser");
const less = require("less");
const rtlcss = require("rtlcss");
const ts = require("typescript");
const { bundleSource } = require("./source");

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
            "webapp/src/components/projectTools/useProjectToolsResize.ts",
            "webapp/src/components/projectTools/useProjectToolsDismiss.ts",
            "pxtblocks/backpackDrag.ts",
            "pxtblocks/backpack.ts"
        ], "projectToolsComponents", {
            react: "window.React", "react-dom": "window.ReactDOM", blockly: "window.Blockly"
        });
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
        const blocklyDirectory = path.dirname(require.resolve("blockly"));
        for (const file of ["blockly_compressed.js", "msg/en.js"]) {
            await page.addScriptTag({ path: path.join(blocklyDirectory, file) });
        }
        await page.evaluate(() => {
            window.lf = text => text;
            window.pxt = {
                appTarget: { appTheme: { whiteboard: true, backpack: true }, runtime: { palette: ["#000", "#fff"] } },
                BREAKPOINT_TABLET: 991,
                U: { userError: message => { throw new Error(message); } },
                reportException: error => { throw error; },
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
                    "./ProjectToolsHeader", "./ProjectToolsResizeHandle", "./useProjectToolsResize", "./useProjectToolsDismiss",
                    "../../../../react-common/components/controls/Button", "../../../../react-common/components/util"
                ].includes(id)) return window.projectToolsComponents;
                if (id === "../backpack/service") return {
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
                const [tutorial, setTutorial] = React.useState(false);
                const [headerTutorial, setHeaderTutorial] = React.useState(false);
                const [, update] = React.useReducer(value => value + 1, 0);
                window.rerenderTools = update;
                window.setToolsFlags = flags => { Object.assign(pxt.appTarget.appTheme, flags); update(); };
                pxt.Util.isUserLanguageRtl = () => rtl;
                window.setRtl = setRtl;
                window.setTutorial = setTutorial;
                window.setHeaderTutorial = setHeaderTutorial;
                window.openHelp = () => {
                    setRequest(value => value + 1);
                    setExpanded(true);
                };
                window.openExample = () => {
                    setPinned(true);
                    window.openHelp();
                };
                return React.createElement(exports.ProjectTools, {
                    header: { id: "test-project", tutorial: headerTutorial ? { tutorial: "/test-tutorial" } : undefined },
                    tutorial, expanded, onExpandedChange: value => setExpanded(value),
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
            await page.evaluate(() => {
                const root = document.getElementById("root");
                if (window.ReactDOM && root) ReactDOM.unmountComponentAtNode(root);
                window.disposeBackpackDrag?.();
                window.testWorkspace?.dispose();
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

    const createWorkspace = async () => page.evaluate(async () => {
        const host = document.createElement("div");
        host.id = "test-workspace";
        host.style.cssText = "position:absolute;left:20px;top:300px;width:650px;height:420px";
        document.body.appendChild(host);
        Blockly.Blocks.backpack_dismiss_statement = { init() {
            this.appendDummyInput().appendField("save this block");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
        } };
        window.testWorkspace = Blockly.inject(host, { scrollbars: false, sounds: false });
        window.testBlock = Blockly.serialization.blocks.append({ type: "backpack_dismiss_statement" }, testWorkspace);
        testBlock.moveTo(new Blockly.utils.Coordinate(80, 60));
        await Blockly.renderManagement.finishQueuedRenders();
        window.backpackCaptures = [];
        window.disposeBackpackDrag = projectToolsComponents.registerBackpackWorkspace(testWorkspace, {
            isEnabled: () => !document.getElementById("project-tools-panel").hidden
                && document.getElementById("project-tools-panel").dataset.activeTab === "backpack",
            save: block => backpackCaptures.push(JSON.parse(projectToolsComponents.captureBackpackBlock(block).code)),
            open: () => {},
            hoverClass: "test-backpack-hover",
            dragTargets: [{ getElement: () => document.getElementById("project-tools-backpack") }]
        });
        window.workspaceBefore = JSON.stringify(Blockly.serialization.workspaces.save(testWorkspace));
    });

    const blockPosition = async () => page.evaluate(() => {
        projectToolsComponents.refreshBackpackDragTargets(testWorkspace);
        const rect = testBlock.getSvgRoot().getBoundingClientRect();
        return { x: rect.left + 20, y: rect.top + 15 };
    });

    for (const width of [1366, 1024]) {
        it(`keeps the unpinned Backpack open for a native workspace-to-panel drop at ${width}px`, async () => {
            await createWorkspace();
            await openTool(backpack, width);
            const start = await blockPosition();
            const end = await page.$eval("#project-tools-backpack", element => {
                const rect = element.getBoundingClientRect();
                return { x: rect.left + 100, y: rect.top + rect.height / 2 };
            });
            await page.mouse.move(start.x, start.y);
            await page.mouse.down();
            assert.equal(await page.$eval(panel, element => element.hidden), false);
            await page.mouse.move(end.x, end.y, { steps: 15 });
            assert.equal(await page.evaluate(() => testWorkspace.isDragging()), true);
            assert.equal(await page.$eval(panel, element => element.hidden), false);
            await page.mouse.up();
            await page.waitForFunction(() => backpackCaptures.length === 1 && !testWorkspace.isDragging());
            assert.deepStrictEqual(await page.evaluate(() => ({
                open: !document.getElementById("project-tools-panel").hidden,
                types: backpackCaptures[0].blocks.map(block => block.type),
                unchanged: workspaceBefore === JSON.stringify(Blockly.serialization.workspaces.save(testWorkspace))
            })), { open: true, types: ["backpack_dismiss_statement"], unchanged: true });
            assert.equal(await page.$eval(`${panel} .project-tools-pin`, element => element.getAttribute("aria-pressed")), "false");
            await page.click("#outside");
            assert.equal(await page.$eval(panel, element => element.hidden), true);
        });
    }

    it("keeps the unpinned Backpack open during a native touch drag and drop", async () => {
        await createWorkspace();
        await openTool(backpack, 1366);
        const start = await blockPosition();
        const end = await page.$eval("#project-tools-backpack", element => {
            const rect = element.getBoundingClientRect();
            return { x: rect.left + 100, y: rect.top + rect.height / 2 };
        });
        const client = await page.createCDPSession();
        try {
            await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
            for (let step = 1; step <= 5; step++) {
                await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{
                    x: start.x + (end.x - start.x) * step / 5,
                    y: start.y + (end.y - start.y) * step / 5
                }] });
            }
            assert.equal(await page.$eval(panel, element => element.hidden), false);
            await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
            await page.waitForFunction(() => backpackCaptures.length === 1 && !testWorkspace.isDragging());
            assert.equal(await page.$eval(panel, element => element.hidden), false);
        } finally { await client.detach(); }
    });

    it("still dismisses Backpack for a block click that does not become a drag", async () => {
        await createWorkspace();
        await openTool(backpack, 1366);
        const start = await blockPosition();
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        assert.equal(await page.$eval(panel, element => element.hidden), false);
        await page.mouse.up();
        assert.equal(await page.$eval(panel, element => element.hidden), true);
        assert.equal(await page.evaluate(() => Blockly.getSelected()?.id === testBlock.id), true);
        assert.equal(await page.evaluate(() => backpackCaptures.length), 0);
    });

    it("does not lose a pending block click when the parent replaces its callbacks", async () => {
        await createWorkspace();
        await openTool(backpack, 1366);
        const start = await blockPosition();
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.evaluate(() => {
            window.rerenderTools();
            return new Promise(resolve => requestAnimationFrame(resolve));
        });
        await page.mouse.up();
        assert.equal(await page.$eval(panel, element => element.hidden), true);
    });

    it("clears a cancelled touch press and resumes normal keyboard dismissal", async () => {
        await createWorkspace();
        await openTool(backpack, 1366);
        const start = await blockPosition();
        const client = await page.createCDPSession();
        try {
            await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
            await client.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
            assert.equal(await page.$eval(panel, element => element.hidden), true);
        } finally { await client.detach(); }
        await page.click(backpack);
        await page.click("#test-backpack-signin");
        await page.keyboard.press("Tab");
        await focusIs("outside");
        assert.equal(await page.$eval(panel, element => element.hidden), true);
    });

    it("still dismisses an unpinned Backpack when focus enters an outside iframe", async () => {
        await openTool(backpack, 1366);
        await page.evaluate(() => {
            const frame = document.createElement("iframe");
            frame.id = "outside-frame";
            frame.style.cssText = "position:absolute;left:20px;top:300px";
            frame.srcdoc = '<button id="outside-frame-button">Outside frame</button>';
            document.body.appendChild(frame);
        });
        const frame = await (await page.$("#outside-frame")).contentFrame();
        await frame.waitForSelector("#outside-frame-button");
        await frame.click("#outside-frame-button");
        await page.waitForFunction(() => document.getElementById("project-tools-panel").hidden);
    });

    for (const tool of [docs, whiteboard]) {
        it(`does not defer outside block clicks for ${tool}`, async () => {
            await createWorkspace();
            await openTool(tool, 1366);
            const start = await blockPosition();
            await page.mouse.move(start.x, start.y);
            await page.mouse.down();
            assert.equal(await page.$eval(panel, element => element.hidden), true);
            await page.mouse.up();
        });
    }

    it("still dismisses Backpack immediately for workspace-background and right-click interactions", async () => {
        await createWorkspace();
        await openTool(backpack, 1366);
        await page.mouse.move(600, 650);
        await page.mouse.down();
        assert.equal(await page.$eval(panel, element => element.hidden), true);
        await page.mouse.up();
        await page.click(backpack);
        const start = await blockPosition();
        await page.mouse.move(start.x, start.y);
        await page.mouse.down({ button: "right" });
        assert.equal(await page.$eval(panel, element => element.hidden), true);
        await page.mouse.up({ button: "right" });
    });

    it("preserves keyboard dismissal after a completed block drag", async () => {
        await createWorkspace();
        await openTool(backpack, 1366);
        const start = await blockPosition();
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + 120, start.y + 60, { steps: 5 });
        await page.mouse.up();
        assert.equal(await page.$eval(panel, element => element.hidden), false);
        await page.click("#test-backpack-signin");
        await page.keyboard.press("Tab");
        await focusIs("outside");
        assert.equal(await page.$eval(panel, element => element.hidden), true);
    });

    for (const { width, rtl } of [{ width: 1366, rtl: false }, { width: 1024, rtl: true }, { width: 390, rtl: false }]) {
        it(`tracks the workspace top rather than the tutorial flag at ${width}px in ${rtl ? "RTL" : "LTR"}`, async () => {
            await openTool(docs, width);
            if (rtl) {
                await page.$eval("style", (element, text) => element.textContent = text, rtlcss.process(css));
                await page.evaluate(() => window.setRtl(true));
            }
            await page.$eval("#root", element => element.classList.add("tabTutorial"));
            await page.evaluate(() => window.setTutorial(true));
            const menuHeight = (width <= 991 ? 3.5 : 4) * 16;
            const compact = width < 1200;
            for (const bannerVisible of [false, true]) {
                await page.$eval("#root", (element, visible) => {
                    element.classList.toggle("notificationBannerVisible", visible);
                }, bannerVisible);
                for (const offset of [0, 160, 240, 0]) {
                    await page.$eval("#root", (element, offset) => {
                        if (offset) element.style.setProperty("--editor-offset", `${offset}px`);
                        else element.style.removeProperty("--editor-offset");
                    }, offset);
                    const workspaceTop = menuHeight + (bannerVisible ? 32 : 0) + offset;
                    const bounds = await page.evaluate(() => ({
                        launcher: document.getElementById("project-tools-launcher").getBoundingClientRect().top,
                        panel: document.getElementById("project-tools-panel").getBoundingClientRect().top,
                        bottom: document.getElementById("project-tools-panel").getBoundingClientRect().bottom
                    }));
                    assert.equal(bounds.launcher, workspaceTop + (compact ? 8 : 16));
                    assert.equal(bounds.panel, workspaceTop + (compact ? 76 : 16));
                    assert(bounds.bottom <= 900);
                }
            }
        });
    }

    it("updates height-resize accessibility bounds when a top tutorial changes height", async () => {
        await openTool(docs, 1366);
        await page.evaluate(() => window.setTutorial(true));
        const handle = ".project-tools-resize-height";
        await page.focus(handle);
        await page.keyboard.press("Home");
        const height = await page.$eval(panel, element => element.getBoundingClientRect().height);
        const maximum = await page.$eval(handle, element => Number(element.getAttribute("aria-valuemax")));
        await page.$eval("#root", element => element.style.setProperty("--editor-offset", "160px"));
        await page.waitForFunction(expected => {
            const maximum = Number(document.querySelector(".project-tools-resize-height").getAttribute("aria-valuemax"));
            return Math.abs(maximum - expected) < 1;
        }, { timeout: 3000 }, maximum - 160);
        assert.equal(await page.$eval(panel, element => element.getBoundingClientRect().height), height);
    });

    for (const source of ["prop", "header"]) {
        it(`hides Backpack during a ${source} tutorial even when assets are enabled`, async () => {
            await page.setViewport({ width: 1366, height: 900 });
            await optionsAre(false);
            await page.evaluate(source => {
                window.setToolsFlags({ assetEditor: true });
                if (source === "prop") window.setTutorial(true);
                else window.setHeaderTutorial(true);
            }, source);
            assert.equal(await page.$(backpack), null);
            assert.equal(await page.$("#project-tools-backpack"), null);
            assert.equal(await page.$("#test-backpack-signin"), null);
            assert.deepEqual(await page.$$eval("#project-tools-options button", elements => elements.map(element => element.id)),
                ["project-tools-tab-docs", "project-tools-tab-whiteboard"]);
            assert.equal(await page.$eval(".project-tools", element => element.style.getPropertyValue("--tools-tab-count")), "2");
            await page.focus(more);
            await page.keyboard.press("Tab");
            await focusIs("project-tools-tab-docs");
            await page.keyboard.press("Tab");
            await focusIs("project-tools-tab-whiteboard");
            await page.keyboard.press("Tab");
            await focusIs("outside");
            await page.evaluate(() => {
                window.requestBackpackOpen("test-project", true);
                window.requestBackpackOpen("test-project", false);
            });
            assert.equal(await page.$eval(panel, element => element.hidden), true);
            assert.equal(await page.$("#project-tools-backpack"), null);
        });
    }

    it("falls back to Documentation on tutorial entry and restores Backpack afterward", async () => {
        await openTool(backpack, 1366);
        await page.evaluate(() => window.setTutorial(true));
        assert.equal(await page.$(backpack), null);
        assert.equal(await page.$("#project-tools-backpack"), null);
        assert.equal(await page.$eval(panel, element => element.dataset.activeTab), "docs");
        await focusIs("project-tools-tab-docs");
        await page.click(more);
        await optionsAre(true);
        await page.evaluate(() => window.setTutorial(false));
        await page.waitForSelector(backpack);
        await page.focus("#outside");
        await page.evaluate(() => window.requestBackpackOpen("test-project", false));
        await page.waitForSelector("#test-backpack-signin", { visible: true });
        assert.equal(await page.$eval(panel, element => element.dataset.activeTab), "backpack");
        await focusIs("outside");
    });

    it("keeps Documentation usable when no optional tools are available during a tutorial", async () => {
        await page.evaluate(() => {
            window.setToolsFlags({ whiteboard: false, assetEditor: false });
            window.setTutorial(true);
        });
        await showOptions();
        assert.deepEqual(await page.$$eval("#project-tools-options button", elements => elements.map(element => element.id)),
            ["project-tools-tab-docs"]);
        assert.equal(await page.$eval(".project-tools", element => element.style.getPropertyValue("--tools-tab-count")), "1");
        await page.focus(more);
        await page.keyboard.press("ArrowDown");
        await focusIs("project-tools-tab-docs");
        await page.keyboard.press("Enter");
        assert.equal(await page.$eval(panel, element => element.hidden), false);
        assert.equal(await page.$eval(`${panel} .project-tools-title`, element => element.textContent), "Documentation");
    });

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
        // Click to focus after reopening; the panel's pending open effect can override programmatic focus.
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