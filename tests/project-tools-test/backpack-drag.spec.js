"use strict";

const assert = require("assert");
const path = require("path");
const { launchTestBrowser } = require("./browser");
const { bundleSource } = require("./source");

describe("host-provided Backpack drag targets", function () {
    this.timeout(30000);
    let browser;
    let page;
    const bundle = bundleSource([
        "pxtblocks/backpack.ts",
        "webapp/src/projectToolsDragTargets.ts"
    ], "backpackDrag", { blockly: "window.Blockly" });

    before(async () => { browser = await launchTestBrowser(); });
    after(async () => { await browser?.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        await page.setContent(`
            <div id="workspace" style="width: 400px; height: 400px"></div>
            <button id="custom-tab">Tab</button>
            <div id="custom-panel" style="width: 100px; height: 100px">Panel</div>
            <button id="custom-launcher">Launcher</button>
        `);
        await page.addScriptTag({ path: path.resolve("node_modules/blockly/blockly_compressed.js") });
        await page.addScriptTag({ path: path.resolve("node_modules/blockly/msg/en.js") });
        await page.evaluate(() => {
            window.lf = text => text;
            window.dragTest = { enabled: true, visible: true, opens: 0, saves: 0, errors: [] };
            window.pxt = { reportException: error => dragTest.errors.push(error.message) };
            Blockly.Blocks.backpack_drag_container = {
                init() {
                    this.appendDummyInput().appendField("loop");
                    this.appendStatementInput("BODY");
                    this.setPreviousStatement(true);
                    this.setNextStatement(true);
                }
            };
            dragTest.workspace = Blockly.inject("workspace", { scrollbars: false });
            dragTest.block = Blockly.serialization.blocks.append({ type: "backpack_drag_container" }, dragTest.workspace);
        });
        await page.addScriptTag({ content: bundle });
    });
    afterEach(async () => {
        try {
            await page.evaluate(() => {
                dragTest.dispose?.();
                dragTest.workspace?.dispose();
            });
        } finally { await page.close(); }
    });

    it("uses arbitrary host elements while retaining dwell, drop, and cleanup behavior", async () => {
        await page.evaluate(() => {
            const manager = dragTest.workspace.getComponentManager();
            const capability = Blockly.ComponentManager.Capability.DRAG_TARGET;
            const existing = new Set(manager.getComponents(capability, false));
            dragTest.dispose = backpackDrag.registerBackpackWorkspace(dragTest.workspace, {
                isEnabled: () => dragTest.enabled,
                save: () => ++dragTest.saves,
                open: () => ++dragTest.opens,
                hoverClass: "custom-hover",
                dragTargets: [{
                    getElement: () => dragTest.visible ? document.getElementById("custom-tab") : undefined,
                    openOnHover: true
                }, {
                    getElement: () => document.getElementById("custom-panel")
                }]
            });
            dragTest.targets = manager.getComponents(capability, false).filter(target => !existing.has(target));
            dragTest.before = JSON.stringify(Blockly.serialization.workspaces.save(dragTest.workspace));
            const rect = document.getElementById("custom-tab").getBoundingClientRect();
            const targetRect = dragTest.targets[0].getClientRect();
            dragTest.sameRect = targetRect.left === rect.left && targetRect.right === rect.right
                && targetRect.top === rect.top && targetRect.bottom === rect.bottom;
            dragTest.targets[0].onDragEnter(dragTest.block);
        });
        assert.equal(await page.evaluate(() => dragTest.sameRect), true);
        assert.equal(await page.$eval("#custom-tab", element => element.classList.contains("custom-hover")), true);
        await page.waitForFunction(() => dragTest.opens === 1);
        await page.evaluate(() => dragTest.targets[0].onDrop(dragTest.block));
        assert.equal(await page.evaluate(() => dragTest.saves), 1);
        assert.equal(await page.$eval("#custom-tab", element => element.classList.contains("custom-hover")), false);
        assert.equal(await page.evaluate(() => dragTest.targets[0].shouldPreventMove(dragTest.block)), true);
        await page.evaluate(() => {
            dragTest.targets[1].onDragEnter(dragTest.block);
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
            dragTest.visible = false;
        });
        assert.equal(await page.$eval("#custom-panel", element => element.classList.contains("custom-hover")), false);
        assert.equal(await page.evaluate(() => dragTest.targets[0].getClientRect()), null);
        await page.evaluate(() => { dragTest.enabled = false; });
        assert.equal(await page.evaluate(() => dragTest.targets[1].getClientRect()), null);
        assert.deepStrictEqual(await page.evaluate(() => ({
            opens: dragTest.opens, errors: dragTest.errors,
            unchanged: JSON.stringify(Blockly.serialization.workspaces.save(dragTest.workspace)) === dragTest.before
        })), { opens: 1, errors: [], unchanged: true });
    });

    it("keeps the production adapter's visibility and launcher fallback rules", async () => {
        assert.deepStrictEqual(await page.evaluate(() => {
            document.getElementById("custom-tab").id = "project-tools-tab-backpack";
            document.getElementById("custom-panel").id = "project-tools-backpack";
            document.getElementById("custom-launcher").id = "project-tools-launcher";
            const targets = backpackDrag.getBackpackDragTargets();
            const ids = () => targets.map(target => target.getElement()?.id || null);
            const visible = ids();
            document.getElementById("project-tools-tab-backpack").style.visibility = "hidden";
            const hidden = ids();
            document.getElementById("project-tools-backpack").hidden = true;
            const collapsed = ids();
            return { visible, hidden, collapsed, dwell: targets.map(target => !!target.openOnHover) };
        }), {
            visible: ["project-tools-tab-backpack", "project-tools-backpack", null],
            hidden: [null, "project-tools-backpack", "project-tools-launcher"],
            collapsed: [null, null, "project-tools-launcher"],
            dwell: [true, false, true]
        });
    });
});
