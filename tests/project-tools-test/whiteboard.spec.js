"use strict";

const assert = require("assert");
const path = require("path");
const { Transform } = require("stream");
const browserify = require("browserify");
const less = require("less");
const { launchTestBrowser } = require("./browser");
const { colorThemes, contrastSamples } = require("./theme-helpers");

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
        const fixturePath = path.join(__dirname, "whiteboard.fixture.js");
        build.transform(file => {
            const replacement = file === workspacePath ? "module.exports = window.whiteboardTest.workspace;"
                : file === assetsPath ? "module.exports = { lookupAsset() { return undefined; }, isNameTaken() { return false; } };"
                : file === backpackPath ? "module.exports = window.whiteboardTest.backpack;"
                : file === projectBackpackPath ? `
                    const React = require("react");
                    exports.ProjectBackpack = props => {
                        const test = window.whiteboardTest;
                        React.useEffect(() => { ++test.backpackMounts; }, []);
                        test.backpackProps = { headerId: props.headerId, active: props.active, onSignIn: typeof props.onSignIn };
                        return React.createElement(React.Fragment, null, props.renderHeader("Backpack"),
                            React.createElement("button", { id: "test-backpack-signin", onClick: props.onSignIn }, "Sign in"));
                    };
                ` : undefined;
            // Supply the newly required callback without changing the shared fixture
            // or replacing any real whiteboard/image-editor components.
            let fixtureSource = "";
            return new Transform({
                transform(chunk, _encoding, done) {
                    if (file === fixturePath) fixtureSource += chunk.toString();
                    else if (!replacement) this.push(chunk);
                    done();
                },
                flush(done) {
                    if (file === fixturePath) {
                        const anchor = "pinned, onPinnedChange: setPinned,";
                        if (fixtureSource.split(anchor).length !== 2) return done(new Error("Whiteboard fixture sign-in prop anchor must occur once"));
                        this.push(fixtureSource.replace(anchor, `${anchor} onSignIn: () => { ++test.signInRequests; },`));
                    } else if (replacement) this.push(replacement);
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
            const openListeners = new Set();
            Object.assign(whiteboardTest, {
                backpackMounts: 0, signInRequests: 0, openRequests: [],
                backpack: {
                    subscribeBackpackOpen: listener => {
                        openListeners.add(listener);
                        return () => openListeners.delete(listener);
                    },
                    requestBackpackOpen: (headerId, focus) => {
                        const request = { headerId, focus };
                        whiteboardTest.openRequests.push(request);
                        Array.from(openListeners).forEach(listener => listener(request));
                    }
                }
            });
            pxt.reportException = error => whiteboardTest.errors.push(error.message);
        });
        await page.addScriptTag({ content: bundle });
        assert.deepEqual(errors, [], "The real whiteboard components should load without browser errors");
        await openWhiteboard();
    });
    afterEach(async () => { await page?.close(); });

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
        await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control");
        await page.keyboard.type(name);
        await page.keyboard.press("Enter");
        await page.waitForSelector(".project-whiteboard-menu__edit", { hidden: true });
    };

    it("opens a saved named whiteboard without rewriting its notes", async () => {
        assert.equal(await page.$eval(input, el => el.value), "Saved private notes");
        assert.equal(await page.$eval("#project-tools-whiteboard h2", el => el.textContent), "Whiteboard 1");
        assert.equal(await page.evaluate(() => whiteboardTest.saves.length), 0);
        await page.click(menu);
        assert.equal(await page.$$eval('[role="menuitemcheckbox"]', els => els.length), 1);
        assert.equal(await page.$eval("#project-whiteboard-menu-menu", el => el.scrollWidth <= el.clientWidth), true);
        assert.equal(await page.$$eval('[role="menuitem"]', els => els.some(el => el.textContent.includes("Delete whiteboard"))), false);
    });

    it("starts projects without notes with a blank board and only saves after editing", async () => {
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

    for (const width of [1024, 1366]) it(`retains drawing, notes, undo and pin after hiding desktop bubbles at ${width}px`, async () => {
        await page.setViewport({ width, height: 900 });
        await page.waitForFunction(horizontal => document.getElementById("project-tools-options").getAttribute("aria-orientation") === (horizontal ? "horizontal" : "vertical"), {}, width < 1200);
        await page.focus(input);
        await page.keyboard.press("End");
        await page.type(input, " retained after hiding");
        await page.evaluate(() => whiteboardTest.draw(5));
        await page.click("#project-tools-whiteboard .project-tools__pin");
        await page.click("#project-tools-launcher");
        await page.waitForFunction(() => document.getElementById("project-tools-panel").hidden &&
            getComputedStyle(document.getElementById("project-tools-options")).visibility === "hidden");
        assert.equal(await page.$eval("#project-tools-launcher", el => el.getAttribute("aria-expanded")), "false");
        await openWhiteboard();
        assert.equal(await page.$eval(input, el => el.value), "Saved private notes retained after hiding");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 5);
        assert.equal(await page.$eval("#project-tools-whiteboard .project-tools__pin", el => el.getAttribute("aria-pressed")), "true");
        await page.evaluate(() => whiteboardTest.undo());
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 0);
        await page.click("#outside");
        assert.equal(await page.$eval("#project-tools-panel", el => el.hidden), false);
    });

    for (const width of [390, 1024, 1366]) it(`preserves real notes, drawing store and undo across backpack at ${width}px`, async () => {
        await page.setViewport({ width, height: 900 });
        await page.waitForFunction(horizontal => document.getElementById("project-tools-options").getAttribute("aria-orientation") === (horizontal ? "horizontal" : "vertical"), {}, width < 1200);
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
        await page.waitForSelector("#test-backpack-signin", { visible: true });
        assert.deepEqual(await page.evaluate(() => whiteboardTest.backpackProps), { headerId: "whiteboard-project", active: true, onSignIn: "function" });
        assert.equal(await page.$eval("#project-tools-whiteboard", el => el.hidden), true);
        // The inactive whiteboard unmounts its image editor, but retains the
        // Redux store and textarea. Check the store when the editor remounts.
        assert.equal(await page.$eval(input, el => el === whiteboardTest.originalNotes), true);
        assert.equal(await page.$eval(input, el => el.value), "Saved private notes retained across backpack");
        await page.click("#test-backpack-signin");
        assert.equal(await page.evaluate(() => whiteboardTest.signInRequests), 1);
        await page.click("#project-tools-tab-docs");
        assert.equal(await page.$eval("#project-tools-docs", el => el.hidden), false);
        await page.click("#project-tools-tab-whiteboard");
        await page.waitForSelector(input, { visible: true });
        assert.equal(await page.evaluate(() => whiteboardTest.originalStore === whiteboardTest.store()), true);
        assert.equal(await page.$eval(input, el => el === whiteboardTest.originalNotes), true);
        assert.equal(await page.$eval(input, el => el.value), "Saved private notes retained across backpack");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 6);
        assert.equal(await page.$eval("#project-tools-whiteboard .project-tools__pin", el => el.getAttribute("aria-pressed")), "true");
        await page.evaluate(() => whiteboardTest.undo());
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 0);
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards[0].text === "Saved private notes retained across backpack" &&
            pxt.sprite.getBitmapFromJResURL(whiteboardTest.persisted.whiteboards[0].image).get(0, 0) === 0);
        assert.equal(await page.evaluate(() => whiteboardTest.backpackMounts), 1);
        assert.equal(await page.evaluate(() => whiteboardTest.backpackProps.active), false);
        assert.deepEqual(await page.evaluate(() => whiteboardTest.errors), []);
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

    it("validates names and lets Escape close the name form without hiding the panel", async () => {
        await item("New whiteboard");
        await page.focus("#project-whiteboard-name");
        await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control");
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Enter");
        await page.waitForSelector('#project-whiteboard-name[aria-invalid="true"]');
        assert.ok(await page.$eval("#project-whiteboard-name-error", el => el.textContent.includes("Enter")));
        await page.keyboard.type("Whiteboard 1");
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => document.getElementById("project-whiteboard-name-error").textContent.includes("already exists"));
        await page.keyboard.press("Escape");
        assert.equal(await page.$eval("#project-tools-panel", el => el.hidden), false);
        assert.equal(await page.evaluate(() => document.activeElement.id), "project-whiteboard-menu");
        await page.click("#outside");
        assert.equal(await page.$eval("#project-tools-panel", el => el.hidden), true);
    });

    it("requires confirmation and supports Cancel, Escape and outside dismissal without deleting", async () => {
        await nameBoard("New whiteboard", "Keep my ideas");
        await page.type(input, "Keep this text");
        await page.evaluate(() => whiteboardTest.draw(7));
        const confirm = '.project-whiteboard-menu__edit[role="alertdialog"]';
        for (const action of ["cancel", "escape", "outside"]) {
            await item("Delete whiteboard");
            await page.waitForSelector(confirm, { visible: true });
            assert.equal(await page.$eval(confirm, el => el.getAttribute("aria-label")), "Delete whiteboard Keep my ideas?");
            assert.equal(await page.evaluate(() => document.activeElement.textContent), "Cancel");
            assert.equal(await page.$eval(input, el => el.value), "Keep this text");
            assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 7);
            if (action === "cancel") await page.click(`${confirm} button:first-child`);
            else if (action === "escape") await page.keyboard.press("Escape");
            else await page.click("#outside");
            await page.waitForSelector(confirm, { hidden: true });
            if (action === "outside") await openWhiteboard();
            else assert.equal(await page.evaluate(() => document.activeElement.id), "project-whiteboard-menu");
            assert.equal(await page.$eval(input, el => el.value), "Keep this text");
            assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 7);
        }
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards[1].text === "Keep this text");
        assert.equal(await page.evaluate(() => whiteboardTest.saves.every(save => save.notes.whiteboards.length === 2)), true);
    });

    it("deletes a confirmed board, retains the other board and its undo history, and persists deletion", async () => {
        await page.evaluate(() => whiteboardTest.draw(3));
        await nameBoard("New whiteboard", "Delete these ideas");
        await page.type(input, "Only delete this text");
        await page.evaluate(() => whiteboardTest.draw(7));
        await item("Delete whiteboard");
        await page.waitForSelector('[role="alertdialog"]', { visible: true });
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement.textContent), "Delete");
        await page.keyboard.press("Enter");
        await page.waitForSelector('[role="alertdialog"]', { hidden: true });
        assert.equal(await page.evaluate(() => document.activeElement.id), "project-whiteboard-menu");
        assert.equal(await page.$eval("#project-tools-whiteboard h2", el => el.textContent), "Whiteboard 1");
        assert.equal(await page.$eval(input, el => el.value), "Saved private notes");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 3);
        await page.evaluate(() => whiteboardTest.undo());
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 0);
        await page.click(menu);
        assert.equal(await page.$$eval('[role="menuitem"]', els => els.some(el => el.textContent.includes("Delete whiteboard"))), false);
        await page.keyboard.press("Escape");
        await page.click("#outside");
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards.length === 1 && pxt.sprite.getBitmapFromJResURL(whiteboardTest.persisted.whiteboards[0].image).get(0, 0) === 0);
        assert.equal(await page.evaluate(() => JSON.stringify(whiteboardTest.persisted).includes("Only delete this text")), false);
        await page.evaluate(() => whiteboardTest.mount(whiteboardTest.persisted));
        await openWhiteboard();
        assert.equal(await page.$eval("#project-tools-whiteboard h2", el => el.textContent), "Whiteboard 1");
        assert.equal(await page.$eval(input, el => el.value), "Saved private notes");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 0);
    });

    it("keeps the originally confirmed deletion target if the active selection changes", async () => {
        await nameBoard("New whiteboard", "Original target");
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards.length === 2);
        await item("Delete whiteboard");
        await page.evaluate(() => {
            const notes = JSON.parse(JSON.stringify(whiteboardTest.persisted));
            notes.activeWhiteboardId = notes.whiteboards[0].id;
            whiteboardTest.receive(notes);
        });
        await page.waitForFunction(() => document.querySelector("#project-tools-whiteboard h2").textContent === "Whiteboard 1");
        await page.click('[role="alertdialog"] button:last-child');
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards.length === 1);
        assert.equal(await page.$eval(input, el => el.value), "Saved private notes");
        assert.equal(await page.evaluate(() => whiteboardTest.persisted.whiteboards[0].id), "whiteboard-1");
    });

    it("guards against deleting the last board if the collection changes during confirmation", async () => {
        await nameBoard("New whiteboard", "Now the last board");
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards.length === 2);
        await item("Delete whiteboard");
        await page.evaluate(() => {
            const notes = JSON.parse(JSON.stringify(whiteboardTest.persisted));
            notes.whiteboards = [notes.whiteboards[1]];
            whiteboardTest.receive(notes);
        });
        await page.click('[role="alertdialog"] button:last-child');
        await page.waitForSelector('[role="alertdialog"] [role="alert"]');
        assert.ok(await page.$eval('[role="alertdialog"] [role="alert"]', el => el.textContent.includes("Keep at least one whiteboard")));
        await page.keyboard.press("Escape");
        assert.equal(await page.$eval("#project-tools-whiteboard h2", el => el.textContent), "Now the last board");
    });

    it("reports a deletion save failure and retries the remaining collection", async () => {
        await nameBoard("New whiteboard", "Remove after retry");
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards.length === 2);
        await page.evaluate(() => whiteboardTest.failSave = true);
        await item("Delete whiteboard");
        await page.click('[role="alertdialog"] button:last-child');
        await page.waitForSelector('.project-whiteboard__status[role="alert"]');
        assert.equal(await page.evaluate(() => whiteboardTest.persisted.whiteboards.length), 2);
        assert.equal(await page.$eval("#project-tools-whiteboard h2", el => el.textContent), "Whiteboard 1");
        await page.evaluate(() => whiteboardTest.failSave = false);
        await page.click(".project-whiteboard__status button");
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards.length === 1);
        assert.equal(await page.evaluate(() => whiteboardTest.persisted.activeWhiteboardId), "whiteboard-1");
    });

    it("keeps every board on a save failure and retries the complete collection", async () => {
        await page.evaluate(() => whiteboardTest.failSave = true);
        await nameBoard("New whiteboard", "Unsaved ideas");
        await page.waitForSelector('.project-whiteboard__status[role="alert"]');
        await page.type(input, "Retain this draft");
        await item("Whiteboard 1");
        await item("Unsaved ideas");
        assert.equal(await page.$eval(input, el => el.value), "Retain this draft");
        await page.evaluate(() => whiteboardTest.failSave = false);
        await page.click(".project-whiteboard__status button");
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards[1].text === "Retain this draft");
        assert.equal(await page.$eval("#project-tools-panel", el => el.hidden), false);
    });

    it("loads clean incoming collections into existing editor stores", async () => {
        await nameBoard("New whiteboard", "Remote ideas");
        await item("Whiteboard 1");
        await page.waitForFunction(() => whiteboardTest.persisted?.activeWhiteboardId === "whiteboard-1");
        await page.evaluate(() => {
            const notes = JSON.parse(JSON.stringify(whiteboardTest.persisted));
            const bitmap = new pxt.sprite.Bitmap(160, 120);
            bitmap.set(0, 0, 6);
            notes.whiteboards[0].image = pxt.sprite.base64EncodeBitmap(bitmap.data());
            notes.whiteboards[0].text = "Remote text";
            notes.whiteboards[1].text = "Other remote text";
            whiteboardTest.receive(notes);
        });
        await page.waitForFunction(() => document.getElementById("project-notes-text").value === "Remote text");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 6);
        await page.evaluate(() => whiteboardTest.draw(9));
        await item("Remote ideas");
        assert.equal(await page.$eval(input, el => el.value), "Other remote text");
        await item("Whiteboard 1");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 9);
        await page.evaluate(() => whiteboardTest.undo());
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 6);
    });

    it("pauses autosave for incoming conflicts and loads the selected collection", async () => {
        await nameBoard("New whiteboard", "Ideas");
        await page.waitForFunction(() => whiteboardTest.persisted?.whiteboards.length === 2);
        await page.evaluate(() => {
            whiteboardTest.holdSave = new Promise(resolve => whiteboardTest.finishSave = resolve);
            whiteboardTest.draw(3);
        });
        await page.click(menu); // Flush the local edit, keeping its save in flight.
        await page.keyboard.press("Escape");
        await page.evaluate(() => {
            const notes = JSON.parse(JSON.stringify(whiteboardTest.persisted));
            notes.whiteboards[1].text = "Conflicting remote notes";
            whiteboardTest.receive(notes);
        });
        await page.waitForSelector(".project-whiteboard__conflict", { visible: true });
        assert.equal(await page.$eval(input, el => el.value), "");
        await page.evaluate(() => { whiteboardTest.finishSave(); whiteboardTest.holdSave = undefined; });
        await page.click(".project-whiteboard__conflict button:last-child");
        await page.waitForFunction(() => document.getElementById("project-notes-text").value === "Conflicting remote notes");
        assert.equal(await page.evaluate(() => whiteboardTest.pixel()), 0);
        await item("Whiteboard 1");
        assert.equal(await page.$eval(input, el => el.value), "Saved private notes");
    });

    for (const width of [390, 1024, 1366]) {
        it(`keeps keyboard focus indicators on header controls at ${width}px`, async () => {
            await page.setViewport({ width, height: 900 });
            await page.keyboard.press("Shift");
            for (const selector of ["#project-tools-launcher", menu,
                "#project-tools-whiteboard .project-tools__close", "#project-tools-whiteboard .project-tools__pin"]) {
                await page.focus(selector);
                assert.equal(await page.$eval(selector, control => {
                    const style = getComputedStyle(control);
                    return control === document.activeElement && control.getClientRects().length > 0
                        && parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== "none";
                }), true, `Missing keyboard focus indicator: ${selector}`);
            }
        });
    }

    for (const colorScheme of ["light", "dark"]) {
        it(`keeps header controls visible with ${colorScheme} system forced colors`, async () => {
            await page.evaluate(theme => whiteboardTest.switchTheme(theme), colorThemes().find(theme => theme.id === `regression-${colorScheme}`));
            // Puppeteer 23's convenience wrapper does not expose forced-colors.
            const session = await page.createCDPSession();
            try {
                await session.send("Emulation.setEmulatedMedia", { features: [
                    { name: "forced-colors", value: "active" },
                    { name: "prefers-color-scheme", value: colorScheme }
                ] });
                assert.equal(await page.evaluate(() => matchMedia("(forced-colors: active)").matches), true);
                await page.hover(menu);
                await page.click("#project-tools-whiteboard .project-tools__pin");
                const samples = await contrastSamples(page, "#project-whiteboard-menu, #project-tools-whiteboard .project-tools__close, #project-tools-whiteboard .project-tools__pin");
                assert.equal(samples.length, 3);
                assert.ok(samples.every(sample => sample.contrast >= 3), JSON.stringify(samples));
            } finally {
                await session.detach();
            }
        });
    }

    for (const height of [844, 568]) {
        it(`can reach and select all 16 colors at 390×${height}`, async () => {
            await page.setViewport({ width: 390, height });
            for (let index = 0; index < 16; ++index) {
                const selector = `.image-editor-color-buttons button:nth-child(${index + 1})`;
                await page.$eval(selector, el => el.scrollIntoView({ block: "nearest" }));
                await page.click(selector);
                assert.equal(await page.evaluate(() => whiteboardTest.store().getState().editor.selectedColor), index);
            }
            const layout = await page.evaluate(() => ({
                panelBottom: document.getElementById("project-tools-panel").getBoundingClientRect().bottom,
                footerTop: document.getElementById("test-footer").getBoundingClientRect().top,
                scrollable: getComputedStyle(document.querySelector(".image-editor-palette")).overflowY
            }));
            assert.ok(layout.footerTop - layout.panelBottom >= 7 && layout.footerTop - layout.panelBottom <= 9);
            assert.equal(layout.scrollable, "auto");
        });
    }

    it("keeps the palette and notes usable after shrinking the whiteboard height", async () => {
        await page.focus(".project-tools__resize--height");
        await page.keyboard.press("Home");
        assert.equal(await page.$eval("#project-tools-panel", el => el.getBoundingClientRect().height), 240);
        const color = ".image-editor-color-buttons button:nth-child(16)";
        await page.$eval(color, el => el.scrollIntoView({ block: "nearest" }));
        await page.click(color);
        assert.equal(await page.evaluate(() => whiteboardTest.store().getState().editor.selectedColor), 15);
        await page.$eval(input, el => el.scrollIntoView({ block: "nearest" }));
        await page.type(input, " after resizing");
        await page.focus(".project-tools__resize--height");
        await page.keyboard.press("End");
        assert.ok((await page.$eval(input, el => el.value)).includes("after resizing"));
        assert.equal(await page.$eval("#project-tools-panel", el => el.style.height), "");
    });
});