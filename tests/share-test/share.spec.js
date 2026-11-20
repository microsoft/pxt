"use strict";

const assert = require("assert");
const path = require("path");
const less = require("less");
const { launchTestBrowser } = require("../project-tools-test/browser");
const { bundleSource } = require("../project-tools-test/source");

describe("Share dialog embed options", function () {
    this.timeout(30000);
    let browser;
    let page;
    let bundle;
    let css;
    let pageErrors;

    before(async () => {
        bundle = bundleSource(["react-common/components/share/ShareInfo.tsx"], "shareComponents");
        const imports = [
            "react-common/styles/react-common-variables.less",
            "react-common/styles/theming/base-theme.less",
            "react-common/styles/controls/Button.less",
            "react-common/styles/controls/EditorToggle.less",
            "react-common/styles/controls/Textarea.less",
            "react-common/styles/share/share.less"
        ].map(file => `@import "${path.resolve(file).replace(/\\/g, "/")}";`).join("\n");
        css = (await less.render(imports, { modifyVars: { pageFont: "sans-serif", segoeUIFont: "sans-serif" } })).css;
        browser = await launchTestBrowser();
    });
    after(async () => { await browser?.close(); });
    afterEach(async () => {
        await page?.close();
        assert.deepStrictEqual(pageErrors, []);
    });

    // Shares a project and opens the embed panel, where the Code/Editor/Simulator options live.
    async function openEmbedPanel(simulator) {
        page = await browser.newPage();
        pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.setViewport({ width: 1024, height: 768 });
        await page.setContent('<div id="mount" class="pxt-theme-root"></div>');
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ path: require.resolve("react/umd/react.development.js") });
        await page.addScriptTag({ path: require.resolve("react-dom/umd/react-dom.development.js") });
        await page.evaluate(simulator => {
            window.lf = (text, ...args) => text.replace(/\{(\d+)\}/g, (_, n) => args[n]);
            window.pxt = {
                appTarget: { appTheme: {}, simulator },
                tickEvent: () => {},
                Util: { isUserLanguageRtl: () => false }
            };
        }, simulator);
        await page.addScriptTag({ content: bundle });
        await page.evaluate(() => {
            ReactDOM.render(React.createElement(shareComponents.ShareInfo, {
                projectName: "My project",
                publishAsync: () => Promise.resolve({
                    url: "https://makecode.com/_share",
                    embed: { code: "code embed", editor: "editor embed", simulator: "simulator embed" }
                }),
                onClose: () => {}
            }), document.getElementById("mount"));
        });
        await page.click(".share-publish-button");
        await page.waitForSelector(".project-share-social .embed");
        await page.click(".project-share-social .embed");
        await page.waitForSelector(".project-embed textarea");
    }

    const visibleTabs = () => page.$$eval(".common-editor-toggle-item", items => items.map(item => item.textContent));
    const accessibleTabs = () => page.$$eval(".common-toggle-accessibility [role=tab]", tabs => tabs.map(tab => tab.textContent));
    const waitForEmbedCode = code => page.waitForFunction(code =>
        document.querySelector(".project-embed textarea").value === code, {}, code);

    it("leaves out the Simulator option for headless targets such as Minecraft", async () => {
        await openEmbedPanel({ headless: true });
        assert.deepStrictEqual(await visibleTabs(), ["Code", "Editor"]);
        assert.deepStrictEqual(await accessibleTabs(), ["Code", "Editor"]);
        await waitForEmbedCode("code embed");

        await page.click(".common-editor-toggle-item:nth-child(2) button");
        await waitForEmbedCode("editor embed");
        // With only two options, the highlight should slide over to cover exactly the selected half of the toggle.
        await page.waitForFunction(() => {
            const toggle = document.querySelector(".common-editor-toggle");
            const selected = toggle.querySelector(".common-editor-toggle-item.selected").getBoundingClientRect();
            const handle = toggle.querySelector(".common-editor-toggle-handle").getBoundingClientRect();
            return Math.abs(handle.left - selected.left) < 1 && Math.abs(handle.width - selected.width) < 1
                && Math.abs(handle.width - toggle.clientWidth / 2) < 1;
        });
    });

    it("keeps the Simulator option for targets with a visible simulator", async () => {
        await openEmbedPanel({ autoRun: true });
        assert.deepStrictEqual(await visibleTabs(), ["Code", "Editor", "Simulator"]);
        assert.deepStrictEqual(await accessibleTabs(), ["Code", "Editor", "Simulator"]);

        await page.click(".common-editor-toggle-item:nth-child(3) button");
        await waitForEmbedCode("simulator embed");
    });
});
