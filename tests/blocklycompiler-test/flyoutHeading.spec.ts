import * as Blockly from "blockly";
import * as English from "blockly/msg/en";
import { ExtendedButtonInfo, FlyoutButton } from "../../pxtblocks/plugins/flyout/flyoutButton";

describe("flyout heading layout", () => {
    let previousMessages: { [key: string]: string };

    before(() => {
        // Blockly.inject needs its accessibility messages, even in this isolated test.
        previousMessages = { ...Blockly.Msg };
        Blockly.setLocale(English);
    });

    after(() => {
        for (const key of Object.keys(Blockly.Msg)) delete Blockly.Msg[key];
        Object.assign(Blockly.Msg, previousMessages);
    });

    const cases = [
        { title: "Basic", rtl: false },
        { title: "בסיס", rtl: true },
        { title: "أساسي", rtl: true },
        { title: "SuperBitV2 חיישנים דיגיטליים", rtl: true },
    ];

    for (const { title, rtl } of cases) {
        for (const iconType of ["glyph", "image"]) {
            it(`keeps the ${iconType} icon apart from ${title} (${rtl ? "RTL" : "LTR"})`, () => {
                const container = document.createElement("div");
                container.style.width = "800px";
                container.style.height = "500px";
                document.body.appendChild(container);
                const workspace = Blockly.inject(container, { rtl, sounds: false });
                try {
                    const info: ExtendedButtonInfo = {
                        kind: "label",
                        id: undefined,
                        text: title,
                        "web-class": "blocklyFlyoutHeading",
                        "web-icon": iconType === "glyph" ? "■" : "",
                        "web-icon-class": "",
                        "web-icon-color": "",
                        "web-icon-image": iconType === "image"
                            ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'/%3E"
                            : "",
                        "web-line": "",
                        "web-line-width": "",
                    };
                    const button = new FlyoutButton(workspace, workspace, info, true);
                    const root = button.getSvgRoot();
                    const text = root.querySelector<SVGTextElement>(".blocklyFlyoutLabelText");
                    const icon = root.querySelector<SVGGraphicsElement>(iconType === "glyph" ? ".blocklyFlyoutLabelIcon" : "image");
                    chai.assert.isNotNull(text);
                    chai.assert.isNotNull(icon);
                    const textBox = text!.getBBox();
                    const iconBox = icon!.getBBox();
                    chai.assert.isAbove(textBox.width, 0, "heading must have visible width");
                    chai.assert.isAbove(iconBox.width, 0, "icon must have visible width");
                    if (rtl) {
                        chai.assert.isAtMost(textBox.x + textBox.width, iconBox.x - 1, "icon should be to the right of the heading");
                    } else {
                        chai.assert.isAtMost(iconBox.x + iconBox.width, textBox.x - 1, "icon should be to the left of the heading");
                    }
                } finally {
                    workspace.dispose();
                    container.remove();
                }
            });
        }
    }
});
