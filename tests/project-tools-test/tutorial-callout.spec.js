"use strict";

const assert = require("assert");
const { launchTestBrowser } = require("./browser");
const { bundleSource } = require("./source");

describe("tutorial hint accessibility", function () {
    this.timeout(30000);
    let browser;
    let page;
    let components;

    before(async () => {
        components = bundleSource(["webapp/src/components/tutorial/TutorialCallout.tsx"], "tutorialComponents", {
            react: "window.React",
            "react-dom": "window.ReactDOM",
            "react-modal": "{}",
            "react-tooltip": "{}",
            "webapp/src/data": "window.testData",
            "webapp/src/core": "{}",
            "webapp/src/util": "{}",
            "react-common/components/util": "{}",
            "react-common/components/theming/themeManager": "{}"
        });
        browser = await launchTestBrowser();
    });
    after(async () => { await browser?.close(); });
    beforeEach(async () => {
        page = await browser.newPage();
        await page.setContent('<div id="root"></div>');
        await page.addScriptTag({ path: require.resolve("react/umd/react.development.js") });
        await page.addScriptTag({ path: require.resolve("react-dom/umd/react-dom.development.js") });
        await page.evaluate(() => {
            class Component extends React.Component {
                render() { return this.renderCore(); }
            }
            window.testData = { Component, PureComponent: Component };
        });
        await page.addScriptTag({ content: components });
    });
    afterEach(async () => {
        try {
            await page.evaluate(() => ReactDOM.unmountComponentAtNode(document.getElementById("root")));
        } finally { await page.close(); }
    });

    for (const closeLabel of ["Close", "Fermer"]) {
        it(`names the keyboard-focused Close button "${closeLabel}" and closes on Enter`, async () => {
            await page.evaluate(closeLabel => {
                window.lf = text => text === "Close" ? closeLabel : text;
                ReactDOM.render(React.createElement(tutorialComponents.TutorialCallout, { buttonIcon: "lightbulb" },
                    React.createElement("p", null, "Hint")), document.getElementById("root"));
            }, closeLabel);

            await page.keyboard.press("Tab");
            await page.keyboard.press("Enter");
            await page.waitForSelector(".tutorial-callout-close");
            await page.keyboard.press("Tab");
            assert.equal(await page.evaluate(() => document.activeElement.classList.contains("tutorial-callout-close")), true);

            const button = await page.$(".tutorial-callout-close");
            const snapshot = await page.accessibility.snapshot({ root: button });
            assert.equal(snapshot.role, "button");
            assert.equal(snapshot.name, closeLabel);
            assert.equal(await button.evaluate(element => element.title), closeLabel);

            await page.keyboard.press("Enter");
            assert.equal(await page.$(".tutorial-callout"), null);
            assert.equal(await page.$(".tutorial-callout-mask"), null);
        });
    }
});
