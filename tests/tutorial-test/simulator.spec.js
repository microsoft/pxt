"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const less = require("less");
const rtlcss = require("rtlcss");
const ts = require("typescript");
const { launchTestBrowser } = require("../project-tools-test/browser");
const { bundleSource } = require("../project-tools-test/source");

describe("simulator-focused tutorial layout", function () {
    this.timeout(30000);
    let browser;
    let page;
    let css;
    let components;
    let appSource;
    let pageErrors;

    before(async () => {
        const styles = await less.render(fs.readFileSync(path.join("theme", "pxt.less"), "utf8"), {
            filename: path.resolve("theme", "pxt.less"),
            paths: [
                path.resolve("theme", "foo", "bar"),
                path.resolve("theme"),
                path.resolve("react-common", "styles"),
                path.dirname(require.resolve("semantic-ui-less/semantic.less")),
                path.resolve("node_modules", "@fortawesome")
            ]
        });
        css = styles.css;
        const empty = "(() => null)";
        components = bundleSource(["webapp/src/sidepanel.tsx"], "tutorialComponents", {
            react: "window.React",
            "webapp/src/data": "window.testData",
            "webapp/src/sui": "window.testUI",
            "webapp/src/marked": "window.testMarkdown",
            "webapp/src/simulator": "window.testSimulator",
            "webapp/src/filelist": `{FileList: ${empty}}`,
            "webapp/src/keymap": `{Keymap: ${empty}}`,
            "webapp/src/serialindicator": `{SerialIndicator: ${empty}}`,
            "webapp/src/immersivereader": `{ImmersiveReaderButton: ${empty}}`,
            "webapp/src/components/SimulatorPresenceBar": `{SimulatorPresenceBar: ${empty}}`,
            "webapp/src/components/tutorialValidators": "{}",
            "webapp/src/components/tutorial/TutorialHint": `{TutorialHint: ${empty}}`,
            "webapp/src/components/tutorial/TutorialResetCode": `{TutorialResetCode: ${empty}}`,
            "webapp/src/components/tutorial/TutorialValidationErrorMessage": `{TutorialValidationErrorMessage: ${empty}}`
        });
        const source = ts.createSourceFile("app.tsx", fs.readFileSync(path.join("webapp", "src", "app.tsx"), "utf8"),
            ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const projectView = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === "ProjectView");
        const methods = ["renderCore", "isTutorialSimFullscreen", "setTutorialStep", "setEditorOffset"]
            .map(name => {
                const method = projectView.members.find(member => member.name?.getText(source) === name);
                assert.ok(method, `Missing ProjectView.${name}`);
                return method.getText(source);
            }).join("\n");
        appSource = ts.transpileModule(`class ProjectView extends React.Component {
            static tutorialCardId = "tutorialcard";
            ${methods}
        }
        window.TestProjectView = ProjectView;`, {
            compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2018 }
        }).outputText;
        browser = await launchTestBrowser();
    });

    after(async () => { await browser?.close(); });
    afterEach(async () => {
        await page?.close();
        assert.deepStrictEqual(pageErrors, []);
    });

    async function mount({ width = 1280, height = 900, topInstructions = false, legacy = false,
        collapsed = false, bigRunButton = false, rtl = false, headless = false, startStep = 0, sidebarTutorial = false,
        reducedMotion = false } = {}) {
        page = await browser.newPage();
        pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.setViewport({ width, height });
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" }]);
        await page.setContent('<div id="mount"></div>');
        await page.addStyleTag({ content: (rtl ? rtlcss.process(css) : css)
            + "\nhtml, body { margin: 0; height: 100%; } * { box-sizing: border-box; }" });
        await page.addScriptTag({ path: require.resolve("react/umd/react.development.js") });
        await page.addScriptTag({ path: require.resolve("react-dom/umd/react-dom.development.js") });
        await page.addScriptTag({ path: path.resolve("built", "web", "pxtapp.js") });
        await page.evaluate(({ legacy, topInstructions, rtl, headless, bigRunButton, sidebarTutorial }) => {
            document.documentElement.dir = rtl ? "rtl" : "ltr";
            window.lf = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, i) => args[i]);
            pxt.appTarget = { appTheme: {} };
            window.tutorialTestInfo = pxt.tutorial.parseTutorial(`# Simulator lesson

## Code

Write your code.

## Try it @simFullscreen

Look at the simulator and press A.

## Continue

Return to your code.`);
            window.pxt = {
                appTarget: {
                    appTheme: { tutorialSimSidebarLangs: topInstructions ? ["blocks"] : [], hasAudio: true, bigRunButton, sidebarTutorial },
                    simulator: { headless }
                },
                options: {},
                BLOCKS_PROJECT_NAME: "blocks",
                hasHwVariants: () => false,
                editor: { SimState: { Stopped: 0, Running: 1, Starting: 2, Pending: 3 },
                    MuteState: { Unmuted: 0, Muted: 1, Disabled: 2 } },
                auth: { hasIdentity: () => false },
                U: { ocvEnabled: () => false },
                Util: { isUserLanguageRtl: () => rtl, toArray: items => Array.from(items) },
                BrowserUtils: {
                    useOldTutorialLayout: () => legacy,
                    isTabletSize: () => window.innerWidth <= 991,
                    isTouchEnabled: () => false, isElectron: () => false,
                    isIOS: () => false, isIE: () => false
                },
                shell: {
                    isControllerMode: () => false, isSandboxMode: () => false,
                    isReadOnly: () => false, isTimeMachineEmbed: () => false,
                    layoutTypeClass: () => ""
                },
                tickEvent: () => {}
            };
            window.testData = { Component: class extends React.Component {
                constructor(props) { super(props); this.state = {}; }
                render() { return this.renderCore(); }
            } };
            const Button = props => React.createElement("button", {
                className: "ui button " + (props.className || ""), title: props.title, "aria-label": props.ariaLabel,
                disabled: props.disabled, onClick: props.onClick, tabIndex: props.tabIndex
            }, props.text || React.createElement("i", { className: "icon " + (props.icon || ""), "aria-hidden": true }));
            window.testUI = { Button, Modal: () => null, cx: values => values.filter(Boolean).join(" "),
                StatelessUIElement: testData.Component };
            window.testMarkdown = { MarkedContent: props => React.createElement("div", {
                className: props.className, tabIndex: props.tabIndex, ref: props.contentRef
            }, props.markdown) };
            testMarkdown.MarkedContent.clearBlockSnippetCache = () => {};
            window.testSimulator = { driver: { focus: () => {} } };
            window.cmds = { isNativeHost: () => false };
            window.setEditor = () => {};
            window.shouldShowProjectTools = () => false;
            window.tutorial = { shouldShowTutorialCategories: () => true,
                WorkspaceHeader: () => null,
                TutorialCard: ({ parent }) => React.createElement("div", { id: "tutorialcard" },
                    parent.state.tutorialOptions.tutorialStepInfo[parent.state.tutorialOptions.tutorialStep].headerContentMd,
                    React.createElement(Button, { text: "Next", onClick: () => parent.setTutorialStep(1) })) };
            window.sidebarTutorial = { SidebarTutorialCard: ({ parent }) => React.createElement("div", { id: "sidebar" },
                parent.state.tutorialOptions.tutorialStepInfo[parent.state.tutorialOptions.tutorialStep].headerContentMd) };
            window.sui = testUI;
            window.pkg = {};
            window.workspace = { saveAsync: () => Promise.resolve() };
            const empty = () => null;
            window.accessibility = { EditorAccessibilityMenu: empty };
            window.notification = { NotificationBanner: empty };
            window.headerbar = { HeaderBar: () => React.createElement("div", { id: "mainmenu" }, "Menu") };
            window.container = { SideDocs: empty };
            window.editortoolbar = { EditorToolbar: () => React.createElement("div", { id: "editortools" }, "Editor tools") };
            window.scriptsearch = { ScriptSearch: empty };
            window.extensions = { Extensions: empty };
            window.projects = { ExitAndSaveDialog: empty, NewProjectDialog: empty };
            window.sidepanel = {};
        }, { legacy, topInstructions, rtl, headless, bigRunButton, sidebarTutorial });
        await page.addScriptTag({ content: components });
        await page.addScriptTag({ content: appSource });
        await page.evaluate(({ topInstructions, collapsed, startStep, sidebarTutorial }) => {
            sidepanel.Sidepanel = tutorialComponents.Sidepanel;
            const editor = { isVisible: true, hasEditorToolbar: () => true, closeFlyout: () => {},
                getId: () => "blocksArea",
                displayOuter: () => React.createElement("div", { id: "blocksArea", className: "full-abs" },
                    React.createElement("textarea", { "aria-label": "Code" })) };
            const prototype = TestProjectView.prototype;
            prototype.render = prototype.renderCore;
            prototype.useTutorialSimSidebarLayout = () => topInstructions;
            prototype.getPreferredEditor = () => "blocks";
            prototype.isAssetsActive = () => false;
            prototype.isJavaScriptActive = () => false;
            prototype.isTextEditor = () => false;
            prototype.isBlocksActive = () => true;
            prototype.isPythonActive = () => false;
            prototype.isTextSourceCodeEditorActive = () => false;
            prototype.isTutorial = function () { return !!this.state.tutorialOptions; };
            prototype.typecheckNow = prototype.stopPokeUserActivity = prototype.postTutorialProgress = () => {};
            prototype.showMiniSim = visible => miniSimRequests.push(visible);
            prototype.fireResize = () => window.dispatchEvent(new Event("resize"));
            prototype.startStopSimulator = function () { this.setState({ simState: this.state.simState ? 0 : 1 }); };
            prototype.restartSimulator = () => { window.restartCount++; };
            prototype.toggleMute = () => {};
            prototype.expandSimulator = function () { window.expandCount++; this.setState({ collapseEditorTools: false }); };
            prototype.collapseSimulator = function () { window.collapseCount++; this.setState({ collapseEditorTools: true }); };
            class TestApp extends TestProjectView {
                constructor(props) {
                    super(props);
                    this.editor = this.blocksEditor = editor;
                    this.textEditor = {};
                    this.allEditors = [editor];
                    this.themeManager = { isHighContrast: () => false, getCurrentColorTheme: () => ({}) };
                    this.setTutorialStep = this.setTutorialStep.bind(this);
                    this.setEditorOffset = this.setEditorOffset.bind(this);
                    this.state = {
                        header: { id: "simulator-test" }, feedback: {}, currFile: {},
                        editorState: { hasCategories: !sidebarTutorial }, showMiniSim: true,
                        collapseEditorTools: collapsed, simState: 1,
                        tutorialOptions: { tutorial: "simulator-test", tutorialReady: true,
                            tutorialName: tutorialTestInfo.title, tutorialStep: startStep,
                            metadata: tutorialTestInfo.metadata, tutorialStepInfo: tutorialTestInfo.steps }
                    };
                }
            }
            window.expandCount = window.collapseCount = window.restartCount = 0;
            window.miniSimRequests = [];
            window.app = ReactDOM.render(React.createElement(TestApp), document.getElementById("mount"));
            const board = document.getElementById("boardview");
            board.innerHTML = '<div id="simulators"></div>';
            const driver = new pxsim.SimulatorDriver(board.firstElementChild, { simUrl: "about:blank" });
            driver.preload(1.22);
            window.originalFrame = board.querySelector("iframe");
            originalFrame.srcdoc = '<button aria-label="A" onclick="this.textContent=String(++window.presses)">0</button><script>window.presses=0</script>';
        }, { topInstructions, collapsed, startStep, sidebarTutorial });
        await page.waitForFunction(() => window.originalFrame.contentDocument?.querySelector("button"));
    }

    async function settleTransition() {
        await page.waitForFunction(() => !document.getElementById("simulator")?.classList.contains("tutorialSimTransitioning"));
    }

    async function changeStep(step, pauseAnimation = false) {
        await page.evaluate(({ step, pauseAnimation }) => {
            app.setTutorialStep(step);
            if (pauseAnimation) {
                document.getElementById("boardview").getAnimations().forEach(animation => animation.pause());
            }
        }, { step, pauseAnimation });
    }

    async function enterStep(waitForAnimation = true) {
        await changeStep(1, !waitForAnimation);
        await page.waitForSelector("#root.tutorialSimFullscreen");
        if (waitForAnimation) await settleTransition();
    }

    async function geometry() {
        return page.evaluate(() => {
            const bounds = selector => {
                const rect = document.querySelector(selector).getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
            };
            return { directions: bounds(".tutorialWrapper, .tutorial-instructions:not(:empty), #sidebar"), simulator: bounds("#boardview"),
                frame: bounds("#boardview iframe"), width: innerWidth, height: innerHeight,
                codeVisible: getComputedStyle(document.querySelector("#maineditor:not(.tutorial-instructions)")).display !== "none",
                sameFrame: originalFrame === document.querySelector("#boardview iframe") };
        });
    }

    it("parses simulator steps using the packaged browser runtime", async () => {
        await mount();
        const step = await page.evaluate(() => tutorialTestInfo.steps[1]);
        assert.strictEqual(step.simFullscreen, true);
        assert.strictEqual(step.showHint, undefined);
        assert.strictEqual(step.title, "Try it");
    });

    for (const options of [{}, { width: 1100 }, { width: 390, height: 844 }, { width: 320, height: 568 },
        { width: 850, height: 500 }, { topInstructions: true }, { rtl: true }, { legacy: true },
        { legacy: true, sidebarTutorial: true }]) {
        it(`fills the available simulator space and restores the editor: ${JSON.stringify(options)}`, async () => {
            await mount(options);
            await page.evaluate(() => originalFrame.contentDocument.querySelector("button").click());
            await enterStep();
            const layout = await geometry();
            assert.strictEqual(layout.codeVisible, false);
            assert.strictEqual(layout.sameFrame, true);
            assert.ok(layout.directions.width > 0 && layout.directions.height > 0);
            assert.ok(layout.simulator.width >= layout.width * (options.width === 1100 ? .5 : .55), JSON.stringify(layout));
            assert.ok(layout.simulator.height >= layout.height * .45, JSON.stringify(layout));
            assert.ok(layout.frame.width >= layout.simulator.width - 2, JSON.stringify(layout));
            assert.ok(layout.frame.height >= layout.simulator.height - 2, JSON.stringify(layout));
            assert.ok(layout.simulator.bottom <= layout.height + 1, JSON.stringify(layout));
            assert.ok(layout.directions.right <= layout.simulator.x + 1 ||
                layout.simulator.right <= layout.directions.x + 1 ||
                layout.directions.bottom <= layout.simulator.y + 1, JSON.stringify(layout));
            assert.strictEqual(await page.evaluate(() => originalFrame.contentWindow.presses), 1);
            assert.strictEqual(await page.evaluate(() => restartCount), 0);
            await page.evaluate(() => app.setTutorialStep(2));
            assert.strictEqual(await page.$("#root.tutorialSimFullscreen"), null);
            assert.strictEqual(await page.$eval("#maineditor:not(.tutorial-instructions)", e => getComputedStyle(e).display !== "none"), true);
            assert.strictEqual(await page.evaluate(() => originalFrame === document.querySelector("#boardview iframe")), true);
        });
    }

    it("keeps keyboard-accessible directions and Next/Back navigation", async () => {
        await mount();
        await enterStep();
        assert.strictEqual(await page.$eval(".tutorial-step-content", e => e.textContent), "Look at the simulator and press A.");
        assert.strictEqual(await page.$eval(".tutorial-step-content", e => e.tabIndex), 0);
        assert.strictEqual(await page.$eval('[aria-label="Code"]', e => e.getClientRects().length), 0);
        await page.focus(".tutorial-step-content");
        await page.keyboard.press("Tab");
        assert.strictEqual(await page.evaluate(() => document.activeElement.tagName), "BUTTON");
        const next = await page.$('button[aria-label="Go to the next step of the tutorial."]');
        await next.focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => app.state.tutorialOptions.tutorialStep === 2);
        await page.focus('[title="Go to the previous step of the tutorial."]');
        await page.keyboard.press("Enter");
        await page.waitForSelector("#root.tutorialSimFullscreen");
    });

    it("provides run controls even when the target normally uses a big Run button", async () => {
        await mount({ bigRunButton: true });
        await page.evaluate(() => app.setState({ simState: 0 }));
        await enterStep();
        await page.click('button[title="Start the simulator"]');
        assert.strictEqual(await page.evaluate(() => app.state.simState), 1);
        assert.strictEqual(await page.$eval(".fullscreen-button", e => getComputedStyle(e).display), "none");
    });

    it("expands a collapsed simulator without stopping it when changing steps", async () => {
        await mount({ collapsed: true });
        await enterStep();
        assert.strictEqual(await page.evaluate(() => expandCount), 1);
        assert.strictEqual(await page.evaluate(() => app.state.collapseEditorTools), false);
        await page.evaluate(() => app.setTutorialStep(2));
        assert.strictEqual(await page.evaluate(() => collapseCount), 0);
        assert.strictEqual(await page.evaluate(() => app.state.collapseEditorTools), false);
        await enterStep();
        assert.strictEqual(await page.evaluate(() => expandCount), 1);
        assert.strictEqual(await page.evaluate(() => originalFrame === document.querySelector("#boardview iframe")), true);
    });

    it("does not change headless tutorials", async () => {
        await mount({ headless: true });
        await page.evaluate(() => app.setTutorialStep(1));
        assert.strictEqual(await page.$("#root.tutorialSimFullscreen"), null);
        assert.strictEqual(await page.$eval("#maineditor", e => getComputedStyle(e).display !== "none"), true);
    });

    it("supports loading directly into a simulator step without restarting", async () => {
        await mount({ startStep: 1 });
        assert.ok(await page.$("#root.tutorialSimFullscreen"));
        assert.strictEqual(await page.evaluate(() => expandCount + restartCount), 0);
        assert.ok((await geometry()).simulator.height > 450);
    });

    it("does not send keyboard focus to the hidden text editor", async () => {
        await mount();
        await page.evaluate(() => {
            window.codeFocusCount = 0;
            app.isTextEditor = () => true;
            app.textEditor = { giveFocusOnLoading: true, editor: { focus: () => codeFocusCount++ } };
        });
        await enterStep();
        assert.strictEqual(await page.evaluate(() => codeFocusCount), 0);
        await page.evaluate(() => app.setTutorialStep(2));
        assert.ok(await page.evaluate(() => codeFocusCount > 0));
    });

    it("respects tutorial loading, exit, and completion state", async () => {
        await mount({ startStep: 1 });
        const states = await page.evaluate(() => {
            const active = state => app.isTutorialSimFullscreen.call({ state });
            return [
                active(app.state),
                active({ ...app.state, home: true }),
                active({ ...app.state, header: { tutorialCompleted: {} } }),
                active({ ...app.state, tutorialOptions: undefined }),
                active({ ...app.state, tutorialOptions: { ...app.state.tutorialOptions, tutorialReady: false } })
            ];
        });
        assert.deepStrictEqual(states, [true, false, false, false, false]);
    });

    it("adapts the existing directions layout when resized during a simulator step", async () => {
        await mount({ startStep: 1 });
        await page.setViewport({ width: 390, height: 844 });
        await page.waitForSelector(".tutorialWrapper.vertical-resize-container");
        const mobile = await geometry();
        assert.ok(mobile.directions.bottom <= mobile.simulator.y + 1, JSON.stringify(mobile));
        assert.ok(mobile.simulator.width >= 350, JSON.stringify(mobile));
        await page.setViewport({ width: 1280, height: 900 });
        await page.waitForFunction(() => !document.querySelector(".tutorialWrapper").classList.contains("vertical-resize-container"));
        const desktop = await geometry();
        assert.ok(desktop.directions.right <= desktop.simulator.x + 1, JSON.stringify(desktop));
        assert.strictEqual(desktop.sameFrame, true);
    });

    it("keeps a full rem between the simulator and its toolbar", async () => {
        await mount({ startStep: 1 });
        const spacing = await page.evaluate(() => ({
            gap: document.querySelector(".simtoolbar").getBoundingClientRect().top
                - document.getElementById("boardview").getBoundingClientRect().bottom,
            rem: parseFloat(getComputedStyle(document.documentElement).fontSize)
        }));
        assert.ok(spacing.gap >= spacing.rem - 1, JSON.stringify(spacing));
    });

    async function sampleTransition(time) {
        return page.evaluate(time => {
            const view = document.getElementById("boardview");
            const animation = view.getAnimations()[0];
            if (!animation) throw new Error("Missing simulator transition");
            animation.pause();
            animation.currentTime = time;
            const bounds = view.getBoundingClientRect();
            return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
                duration: animation.effect.getTiming().duration,
                visible: view.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)) };
        }, time);
    }

    function assertSameBounds(actual, expected) {
        for (const key of ["x", "y", "width", "height"]) {
            assert.ok(Math.abs(actual[key] - expected[key]) < 2, `${key}: ${JSON.stringify({ actual, expected })}`);
        }
    }

    async function finishTransition() {
        await page.evaluate(() => document.getElementById("boardview").getAnimations()[0].finish());
        await settleTransition();
    }

    for (const options of [{}, { topInstructions: true }, { width: 390, height: 844 }, { rtl: true }]) {
        it(`animates expansion and restoration over 200ms: ${JSON.stringify(options)}`, async () => {
            await mount(options);
            const before = (await geometry()).simulator;
            await enterStep(false);
            const start = await sampleTransition(0);
            assert.strictEqual(start.duration, 200);
            assertSameBounds(start, before);
            assert.strictEqual(start.visible, true);
            const middle = await sampleTransition(100);
            assert.strictEqual(middle.visible, true);
            await finishTransition();
            const expanded = (await geometry()).simulator;
            assert.ok(middle.width > before.width && middle.width < expanded.width);

            await changeStep(2, true);
            const exit = await sampleTransition(0);
            assert.strictEqual(exit.duration, 200);
            assertSameBounds(exit, expanded);
            assert.strictEqual(exit.visible, true);
            const shrinking = await sampleTransition(100);
            assert.strictEqual(shrinking.visible, true);
            assert.ok(shrinking.width < expanded.width && shrinking.width > before.width);
            await finishTransition();
            assertSameBounds((await geometry()).simulator, before);
            assert.strictEqual(await page.evaluate(() => originalFrame === document.querySelector("#boardview iframe")), true);
            assert.strictEqual(await page.evaluate(() => restartCount), 0);
        });
    }

    it("reverses an interrupted transition from its current visible position", async () => {
        await mount();
        await enterStep(false);
        const midway = await sampleTransition(100);
        await changeStep(2, true);
        assertSameBounds(await sampleTransition(0), midway);
        assert.strictEqual(await page.$eval("#boardview", e => e.getAnimations().length), 1);
        await finishTransition();
        assert.strictEqual(await page.$(".tutorialSimTransitioning"), null);
    });

    it("skips animation for reduced motion and cancels when that preference changes", async () => {
        await mount({ reducedMotion: true });
        await enterStep(false);
        assert.strictEqual(await page.$eval("#boardview", e => e.getAnimations().length), 0);
        assert.strictEqual(await page.$(".tutorialSimTransitioning"), null);
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
        await changeStep(2, true);
        await sampleTransition(100);
        await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
        await settleTransition();
        assert.strictEqual(await page.$eval("#boardview", e => e.getAnimations().length), 0);
    });

    it("cleans up an active transition when the editor unmounts", async () => {
        await mount();
        await enterStep(false);
        await sampleTransition(100);
        const state = await page.evaluate(() => {
            const view = document.getElementById("boardview");
            ReactDOM.unmountComponentAtNode(document.getElementById("mount"));
            return view.getAnimations().map(a => a.playState);
        });
        assert.deepStrictEqual(state, []);
    });

    it("preserves simulator visibility when changing or exiting tutorials", async () => {
        await mount({ startStep: 1 });
        await page.evaluate(() => {
            miniSimRequests.length = 0;
            app.setState({ tutorialOptions: { ...app.state.tutorialOptions, tutorial: "another-tutorial" } });
        });
        assert.deepStrictEqual(await page.evaluate(() => miniSimRequests), [true]);
        await page.evaluate(() => {
            miniSimRequests.length = 0;
            app.setState({ tutorialOptions: undefined });
        });
        assert.deepStrictEqual(await page.evaluate(() => miniSimRequests), [false]);
        assert.strictEqual(await page.$eval("#boardview", e => e.getAnimations().length), 0);
    });

    it("keeps simulator steps usable without the browser animation API", async () => {
        await mount();
        await page.$eval("#boardview", e => e.animate = undefined);
        await enterStep();
        assert.strictEqual(await page.$(".tutorialSimTransitioning"), null);
        assert.ok((await geometry()).simulator.width > 700);
        assert.strictEqual(await page.evaluate(() => originalFrame === document.querySelector("#boardview iframe")), true);
    });
});
