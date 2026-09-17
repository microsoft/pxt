"use strict";

const assert = require("assert");
const path = require("path");
const { Transform } = require("stream");
const browserify = require("browserify");
const less = require("less");
const { launchTestBrowser } = require("./browser");

describe("named private whiteboards", function () {
    this.timeout(30000);
    let browser;
    let page;
    let bundle;
    let css;
    const menu = "#project-whiteboard-menu";
    const input = "#project-notes-text";

    before(async () => {
        const build = browserify(path.join(__dirname, "whiteboard.fixture.js"));
        const workspacePath = path.resolve("built/webapp/src/workspace.js");
        const assetsPath = path.resolve("built/webapp/src/assets.js");
        const backpackPath = path.resolve("built/webapp/src/backpack.js");
        const projectBackpackPath = path.resolve("built/webapp/src/components/ProjectBackpack.js");
        build.transform(file => {
            const replacement = file === workspacePath ? "module.exports = window.whiteboardTest.workspace;"
                : file === assetsPath ? "module.exports = { lookupAsset() { return undefined; }, isNameTaken() { return false; } };"
                : file === backpackPath ? "module.exports = window.whiteboardTest.backpack;"
                : file === projectBackpackPath ? `
                    const React = require("react");
                    exports.ProjectBackpack = props => React.createElement(React.Fragment, null,
                        props.renderHeader("Backpack"), React.createElement("button", { id: "test-backpack" }, "Backpack"));
                ` : undefined;
            return new Transform({
                transform(chunk, _encoding, done) {
                    if (!replacement) this.push(chunk);
                    done();
                },
                flush(done) {
                    if (replacement) this.push(replacement);
                    done();
                }
            });
        });
        bundle = await new Promise((resolve, reject) => build.bundle((error, buffer) => error ? reject(error) : resolve(buffer.toString())));
        const imports = [
            // Production imports project-tools through sidedoc before image-editor
            // and react-common. Reversing this order hides menu-color regressions.
            "theme/project-tools.less", "theme/image-editor/imageEditor.less",
            "react-common/styles/react-common-variables.less",
            "react-common/styles/controls/Button.less", "react-common/styles/controls/MenuDropdown.less"
        ].map(file => `@import "${path.resolve(file).replace(/\\/g, "/")}";`).join("\n");
        const result = await less.render(imports, { modifyVars: {
            mainMenuHeight: "4rem", mobileMenuHeight: "3.5rem", editorToolsCollapsedHeight: "4.7rem",
            editorToolsCollapsedMobileHeight: "3.4rem", sidedocZIndex: "50", largestTabletScreen: "991px",
            largestMobileScreen: "767px", bannerHeight: "2rem", customScrollbarWidth: "8px",
            pageFont: "sans-serif", white: "#fff", largeMonitorBreakpoint: "1200px",
            sideBarWidth: "22rem", sideBarWidthLarge: "28rem", sideBarWidthSmall: "18rem"
        } });
        css = `* { box-sizing: border-box; } body { margin: 0; font: 16px sans-serif; }
            #test-footer { position: fixed; bottom: 0; height: 3.4rem; width: 100%; }
            :root { --pxt-neutral-background1: white; --pxt-neutral-foreground1: black; }
            ${result.css}`;
        browser = await launchTestBrowser();
    });
    after(async () => { await browser?.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.setViewport({ width: 390, height: 844 });
        await page.setContent('<div id="root"></div><footer id="test-footer"><button id="outside">Outside</button></footer>');
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ path: path.resolve("built/pxtlib.js") });
        await page.evaluate(() => {
            window.lf = pxt.Util.lf;
            pxt.appTarget = { id: "arcade", appTheme: { defaultLocale: "en" }, runtime: { palette: [
                "#000000", "#ffffff", "#ff2121", "#ff93c4", "#ff8135", "#fff609", "#249ca3", "#78dc52",
                "#003fad", "#87f2ff", "#8e2ec4", "#a4839f", "#5c406c", "#e5cdc4", "#91463d", "#000000"
            ] } };
            pxt.BrowserUtils.isTabletSize = () => innerWidth <= 991;
            pxt.Util.isUserLanguageRtl = () => false;
            window.whiteboardTest = { workspace: {}, saves: [], errors: [], initialNotes: {
                whiteboards: [{ id: "whiteboard-1", name: "Whiteboard 1", text: "Saved private notes" }],
                activeWhiteboardId: "whiteboard-1"
            } };
            whiteboardTest.backpack = {
                isBackpackEnabled: () => true,
                subscribeBackpackOpen: () => () => {}
            };
            pxt.reportException = error => whiteboardTest.errors.push(error.message);
        });
        await page.addScriptTag({ content: bundle });
        assert.deepEqual(errors, [], "The real whiteboard components should load without browser errors");
        await openWhiteboard();
    });
    afterEach(async () => {
        if (!page || page.isClosed()) return;
        try { await page.evaluate(() => whiteboardTest.unmount()); }
        finally { await page.close(); }
    });

    const openWhiteboard = async () => {
        await page.waitForSelector("#project-tools-launcher", { visible: true });
        if (await page.$eval("#project-tools-launcher", el => el.getAttribute("aria-expanded")) !== "true") {
            await page.click("#project-tools-launcher");
        }
        await page.waitForFunction(() => getComputedStyle(document.getElementById("project-tools-tab-whiteboard")).transform === "none");
        await page.click("#project-tools-tab-whiteboard");
        await page.waitForSelector(input, { visible: true });
    };
    const item = async label => {
        await page.click(menu);
        const handle = await page.waitForFunction(label => Array.from(document.querySelectorAll('#project-whiteboard-menu-menu [role^="menuitem"]')).find(el => el.textContent.trim() === label), {}, label);
        await handle.asElement().click();
        await handle.dispose();
    };
    const nameBoard = async (action, name) => {
        await item(action);
        await page.waitForSelector("#project-whiteboard-name", { visible: true });
        await page.focus("#project-whiteboard-name");
        await page.keyboard.down("Control");
        await page.keyboard.press("A");
        await page.keyboard.up("Control");
        await page.keyboard.type(name);
        await page.keyboard.press("Enter");
        await page.waitForSelector(".project-whiteboard-menu__edit", { hidden: true });
    };

    it("loads saved or new notes without writing until the first edit", async () => {
        assert.equal(await page.$eval(input, el => el.value), "Saved private notes");
        assert.equal(await page.evaluate(() => whiteboardTest.saves.length), 0);
        await page.click(menu);
        assert.equal(await page.$$eval('[role="menuitemcheckbox"]', els => els.length), 1);
        assert.equal(await page.$$eval('[role="menuitem"]', els => els.some(el => el.textContent.includes("Delete whiteboard"))), false);
        await page.evaluate(() => whiteboardTest.mount());
        await openWhiteboard();
        assert.equal(await page.$eval(input, el => el.value), "");
        assert.equal(await page.$eval("#project-tools-whiteboard h2", el => el.textContent), "Whiteboard 1");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 0);
        assert.equal(await page.evaluate(() => whiteboardTest.saves.length), 0);
        await page.type(input, "First private notes");
        await page.click("#outside");
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards[0].text === "First private notes");
        const notes = await page.evaluate(() => whiteboardTest.persisted);
        assert.deepEqual(Object.keys(notes).sort(), ["activeWhiteboardId", "whiteboards"]);
        assert.equal(notes.whiteboards.length, 1);
        assert.equal(notes.activeWhiteboardId, notes.whiteboards[0].id);
    });

    it("preserves real notes, drawing store, undo and pin across tabs and hiding tools", async () => {
        await page.setViewport({ width: 1366, height: 900 });
        await page.waitForFunction(() => document.getElementById("project-tools-options").getAttribute("aria-orientation") === "vertical");
        await page.focus(input);
        await page.keyboard.press("End");
        await page.type(input, " retained across backpack");
        await page.evaluate(() => {
            whiteboardTest.draw(6);
            whiteboardTest.originalStore = whiteboardTest.store();
            whiteboardTest.originalNotes = document.getElementById("project-notes-text");
        });
        await page.click("#project-tools-whiteboard .project-tools__pin");
        await page.click("#project-tools-tab-backpack");
        await page.waitForSelector("#test-backpack", { visible: true });
        assert.equal(await page.$eval("#project-tools-whiteboard", el => el.hidden), true);
        // The inactive whiteboard unmounts its image editor, but retains the
        // Redux store and textarea. Check the store when the editor remounts.
        assert.equal(await page.$eval(input, el => el === whiteboardTest.originalNotes), true);
        assert.equal(await page.$eval(input, el => el.value), "Saved private notes retained across backpack");
        await page.click("#project-tools-tab-docs");
        assert.equal(await page.$eval("#project-tools-docs", el => el.hidden), false);
        await page.click("#project-tools-tab-whiteboard");
        await page.waitForSelector(input, { visible: true });
        await page.click("#project-tools-launcher");
        await page.waitForFunction(() => document.getElementById("project-tools-panel").hidden &&
            getComputedStyle(document.getElementById("project-tools-options")).visibility === "hidden");
        await openWhiteboard();
        assert.equal(await page.evaluate(() => whiteboardTest.originalStore === whiteboardTest.store()), true);
        assert.equal(await page.$eval(input, el => el === whiteboardTest.originalNotes), true);
        assert.equal(await page.$eval(input, el => el.value), "Saved private notes retained across backpack");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 6);
        assert.equal(await page.$eval("#project-tools-whiteboard .project-tools__pin", el => el.getAttribute("aria-pressed")), "true");
        await page.evaluate(() => whiteboardTest.undo());
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 0);
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards[0].text === "Saved private notes retained across backpack" &&
            pxt.sprite.getBitmapFromJResURL(whiteboardTest.persisted.whiteboards[0].image).get(0, 0) === 0);
        assert.deepEqual(await page.evaluate(() => whiteboardTest.errors), []);
    });

    it("routes undo to the canvas without intercepting notes or outside controls", async () => {
        await page.click("#project-tools-whiteboard .project-tools__pin");
        await page.evaluate(() => whiteboardTest.draw(3));
        for (const selector of [input, "#outside"]) {
            await page.focus(selector);
            await page.keyboard.down("Control");
            await page.keyboard.press("z");
            await page.keyboard.up("Control");
            assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 3);
        }
        await page.focus(".image-editor-canvas");
        await page.keyboard.down("Control");
        await page.keyboard.press("z");
        await page.keyboard.up("Control");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 0);
    });

    it("adds, renames and switches independent drawings, notes and undo histories", async () => {
        await page.evaluate(() => whiteboardTest.draw(3));
        await nameBoard("New whiteboard", "Ideas");
        assert.equal(await page.$eval(input, el => el.value), "");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 0);
        await page.type(input, "Notes for Ideas");
        await page.evaluate(() => whiteboardTest.draw(7));
        await nameBoard("Rename whiteboard", "Level ideas");
        await item("Whiteboard 1");
        assert.equal(await page.$eval(input, el => el.value), "Saved private notes");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 3);
        await page.evaluate(() => whiteboardTest.undo());
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 0);
        await item("Level ideas");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 7);
        assert.equal(await page.$eval(input, el => el.value), "Notes for Ideas");
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards.length === 2 && whiteboardTest.persisted.whiteboards[1].name === "Level ideas");
        await page.evaluate(() => whiteboardTest.mount(whiteboardTest.persisted));
        await openWhiteboard();
        assert.equal(await page.$eval("#project-tools-whiteboard h2", el => el.textContent), "Level ideas");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 7);
        assert.equal(await page.$eval(input, el => el.value), "Notes for Ideas");
    });

    it("keeps header controls visible and keyboard-focused in forced colors", async () => {
        // Puppeteer 23's convenience wrapper does not expose forced-colors.
        const session = await page.createCDPSession();
        try {
            await session.send("Emulation.setEmulatedMedia", { features: [
                { name: "forced-colors", value: "active" }
            ] });
            assert.equal(await page.evaluate(() => matchMedia("(forced-colors: active)").matches), true);
            await page.keyboard.press("Shift");
            for (const selector of ["#project-tools-launcher", menu,
                "#project-tools-whiteboard .project-tools__close", "#project-tools-whiteboard .project-tools__pin"]) {
                await page.focus(selector);
                assert.equal(await page.$eval(selector, control => {
                    const style = getComputedStyle(control);
                    const surface = getComputedStyle(document.getElementById("project-tools-panel")).backgroundColor;
                    return control === document.activeElement && control.getClientRects().length > 0
                        && parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== "none"
                        && style.visibility === "visible" && style.color !== surface && style.outlineColor !== surface;
                }), true, `Missing keyboard focus indicator: ${selector}`);
            }
            await page.keyboard.press("Space");
            assert.equal(await page.$eval("#project-tools-whiteboard .project-tools__pin", el => el.getAttribute("aria-pressed")), "true");
        } finally {
            await session.detach();
        }
    });
});