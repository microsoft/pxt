"use strict";

const assert = require("assert");
const { launchTestBrowser } = require("./browser");
const { bundleSource } = require("./source");

describe("tutorial inline block accessibility", function () {
    this.timeout(30000);
    let browser;
    let page;
    let source;

    before(async () => {
        source = bundleSource(["webapp/src/marked.tsx"], "markedContent", {
            react: "window.React",
            marked: "{}",
            dashjs: "{}",
            blockly: "{}",
            pxtblocks: "{}",
            "webapp/src/data": "{ Component: window.React.Component }",
            "webapp/src/compiler": "{ getBlocksAsync: () => Promise.resolve(window.blocksInfo) }"
        });
        browser = await launchTestBrowser();
    });
    after(async () => { await browser?.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        await page.setContent('<button id="before">Before</button><div id="tutorial"></div><div id="maineditor"><div><button class="blocklyTreeRow" data-ns="player">Player</button></div></div>');
        await page.addScriptTag({ path: require.resolve("react/umd/react.development.js") });
        await page.evaluate(() => {
            window.lf = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, index) => args[index]);
            window.pxtc = { SymbolKind: { Module: 1 } };
            window.blocksInfo = {
                apis: { byQName: { player: { kind: pxtc.SymbolKind.Module, attributes: { icon: "\ue000" } } } }
            };
            window.pxt = {
                Util: { toArray: Array.from, htmlEscape: text => text },
                U: { rlf: text => window.translatedBlockName || text },
                toolbox: {}
            };
            window.pxsim = { U: { clear: element => element.replaceChildren() } };
            window.categoryClicks = 0;
            window.toolboxFocuses = 0;
            document.querySelector(".blocklyTreeRow").onclick = () => window.categoryClicks++;
        });
        await page.addScriptTag({ content: source });
    });
    afterEach(async () => { await page?.close(); });

    async function renderBlock(options = {}) {
        await page.evaluate(async ({ text = "on chat command", translatedBlockName, metadata = {} }) => {
            window.translatedBlockName = translatedBlockName;
            const content = document.getElementById("tutorial");
            const code = document.createElement("code");
            code.textContent = `||player: ${text}||`;
            content.appendChild(code);
            const component = new markedContent.MarkedContent({
                parent: {
                    state: { tutorialOptions: { metadata } },
                    editor: { focusToolbox: () => window.toolboxFocuses++ }
                }
            });
            component.renderInlineBlocks(content);
            await Promise.resolve();
        }, options);
    }

    async function accessibleBlock() {
        const client = await page.createCDPSession();
        try {
            const { root } = await client.send("DOM.getDocument");
            const { nodeId } = await client.send("DOM.querySelector", {
                nodeId: root.nodeId, selector: "#tutorial .inlineblock"
            });
            const { nodes } = await client.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false });
            return nodes[0];
        } finally {
            await client.detach();
        }
    }

    it("announces the block name on keyboard focus and describes the category action separately", async () => {
        await renderBlock();
        await page.focus("#before");
        await page.keyboard.press("Tab");
        assert.strictEqual(await page.$eval("#tutorial .inlineblock", element => element === document.activeElement), true);
        const block = await accessibleBlock();
        assert.strictEqual(block.name.value, "on chat command");
        assert.strictEqual(block.description.value, "Toggle the player category");
    });

    it("uses the localized visible block text without including the decorative icon", async () => {
        await renderBlock({ translatedBlockName: "bei Chat-Befehl" });
        const block = await accessibleBlock();
        assert.strictEqual(block.name.value, "bei Chat-Befehl");
        assert.strictEqual(block.description.value, "Toggle the player category");
    });

    for (const key of ["Enter", "Space"]) {
        it(`still toggles the category with ${key}`, async () => {
            await renderBlock();
            await page.focus("#before");
            await page.keyboard.press("Tab");
            await page.keyboard.press(key);
            assert.deepStrictEqual(await page.evaluate(() => [window.categoryClicks, window.toolboxFocuses]), [1, 1]);
        });
    }

    for (const option of ["flyoutOnly", "hideToolbox", "unifiedToolbox"]) {
        it(`keeps blocks non-interactive when ${option} is enabled`, async () => {
            await renderBlock({ metadata: { [option]: true } });
            assert.deepStrictEqual(await page.$eval("#tutorial .inlineblock", element => ({
                text: element.textContent,
                clickable: element.classList.contains("clickable"),
                tabIndex: element.tabIndex,
                title: element.title
            })), { text: "on chat command", clickable: false, tabIndex: -1, title: "" });
        });
    }
});
