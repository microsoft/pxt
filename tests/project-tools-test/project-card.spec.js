"use strict";

const assert = require("assert");
const { launchTestBrowser } = require("./browser");
const { bundleSource } = require("./source");

describe("project-card selection accessibility", function () {
    this.timeout(30000);
    let browser;
    let page;
    let components;
    let client;

    before(async () => {
        const dependencies = [
            "data", "sui", "cloud", "util", "core", "workspace", "compiler",
            "components/searchInput", "projects", "dialogs"
        ];
        const externals = { react: "window.React" };
        dependencies.forEach(name => {
            externals[`webapp/src/${name}`] = `window.cardDependencies[${JSON.stringify(name)}]`;
        });
        externals["react-common/components/controls/Modal"] = "window.cardDependencies.sui";
        externals["react-common/components/util"] = "window.cardDependencies.util";
        components = bundleSource([
            "webapp/src/codecard.tsx",
            "webapp/src/scriptmanager.tsx"
        ], "projectCards", externals);
        browser = await launchTestBrowser();
    });
    after(async () => { await browser?.close(); });

    beforeEach(async () => {
        page = await browser.newPage();
        await page.setContent('<div id="root"></div>');
        await page.addScriptTag({ path: require.resolve("react/umd/react.development.js") });
        await page.addScriptTag({ path: require.resolve("react-dom/umd/react-dom.development.js") });
        await page.evaluate(() => {
            const headers = [
                { id: "first", name: "First project", recentUse: 0, modificationTime: 2 },
                { id: "second", name: "Second project", recentUse: 0, modificationTime: 1 }
            ];
            window.lf = text => text;
            window.pxt = {
                appTarget: { appTheme: {} },
                Util: { repeatMap: () => [] },
                BrowserUtils: { isMac: () => false, hasFileAccess: () => false },
                tutorial: { shouldFilterProject: () => false },
                setInteractiveConsent: () => {}
            };
            class Component extends React.Component {
                getData(key) {
                    if (key.startsWith("headers:")) return headers;
                    if (key.startsWith("header:")) return headers.find(header => key === `header:${header.id}`);
                    return undefined;
                }
                render() { return this.renderCore(); }
            }
            window.cardDependencies = {
                data: { Component },
                sui: {
                    StatelessUIElement: Component,
                    Modal: props => React.createElement("div", null, props.children),
                    Icon: () => React.createElement("i", { "aria-hidden": true }, "○"),
                    Button: () => null,
                    DropdownMenu: () => null
                },
                cloud: {},
                util: { classList: (...names) => names.filter(Boolean).join(" ") },
                core: { keyCodeFromEvent: event => event.keyCode },
                workspace: {},
                compiler: { projectSearchClear: () => {} },
                "components/searchInput": {},
                projects: {
                    ProjectsCodeCard: props => React.createElement(window.projectCards.CodeCardView, {
                        ...props,
                        onClick: event => props.onCardClick(event, props.scr, props.index, props.id),
                        onLabelClicked: event => props.onLabelClick(event, props.scr, props.index, props.id)
                    })
                },
                dialogs: {}
            };
        });
        await page.addScriptTag({ content: components });
        await page.evaluate(() => {
            const dialog = ReactDOM.render(
                React.createElement(projectCards.ScriptManagerDialog),
                document.getElementById("root")
            );
            dialog.show();
        });
        client = await page.createCDPSession();
    });
    afterEach(async () => { await page?.close(); });

    async function checkedStates() {
        const { nodes } = await client.send("Accessibility.getFullAXTree");
        return nodes.filter(node => node.role?.value === "checkbox").map(node => ({
            name: node.name.value,
            checked: node.properties.find(property => property.name === "checked").value.value
        }));
    }

    it("exposes unchecked state on focus and updates it on repeated Enter and Space", async () => {
        await page.keyboard.press("Tab");
        assert.strictEqual(await page.$eval(":focus", element => element.getAttribute("aria-label")), "First project");
        assert.deepStrictEqual(await checkedStates(), [
            { name: "First project", checked: "false" },
            { name: "Second project", checked: "false" }
        ]);
        for (const [key, checked] of [["Enter", "true"], ["Enter", "false"], ["Space", "true"], ["Space", "false"]]) {
            await page.keyboard.press(key);
            assert.strictEqual((await checkedStates())[0].checked, checked);
            assert.strictEqual(await page.$eval(":focus", element => element.getAttribute("aria-checked")), checked);
            assert.strictEqual(await page.$eval(":focus", element => element.hasAttribute("aria-expanded")), false);
        }
    });

    it("keeps accessible states in sync when selection moves between projects", async () => {
        await page.keyboard.press("Tab");
        await page.keyboard.press("Enter");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Enter");
        assert.deepStrictEqual(await checkedStates(), [
            { name: "First project", checked: "false" },
            { name: "Second project", checked: "true" }
        ]);
        await page.click('[aria-label="First project"] label');
        assert.deepStrictEqual(await checkedStates(), [
            { name: "First project", checked: "true" },
            { name: "Second project", checked: "true" }
        ]);
    });

    it("preserves expanded semantics for home-page cards", async () => {
        for (const selected of [false, true]) {
            await page.evaluate(selected => {
                ReactDOM.render(React.createElement(projectCards.CodeCardView, {
                    name: "Home project", role: "button", selected, onClick: () => {}
                }), document.getElementById("root"));
            }, selected);
            assert.strictEqual(await page.$eval('[role="button"]', element => element.getAttribute("aria-expanded")), String(selected));
            assert.strictEqual(await page.$eval('[role="button"]', element => element.hasAttribute("aria-checked")), false);
        }
    });
});
