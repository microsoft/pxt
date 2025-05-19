import * as Blockly from "blockly";


export interface ExtendedButtonInfo extends Blockly.utils.toolbox.LabelInfo {
    "web-class": string;
    "web-icon": string;
    "web-icon-class": string;
    "web-icon-color": string;
    "web-line": string;
    "web-line-width": string;
}

export class FlyoutButton extends Blockly.FlyoutButton {
    constructor(
        workspace: Blockly.WorkspaceSvg,
        targetWorkspace: Blockly.WorkspaceSvg,
        json: Blockly.utils.toolbox.ButtonOrLabelInfo | ExtendedButtonInfo,
        isFlyoutLabel: boolean,
    ) {
        super(workspace, targetWorkspace, json, isFlyoutLabel);

        const svgGroup = this.getSvgRoot();

        // not the prettiest, but this updates the margins of buttons to have more padding
        if (!isFlyoutLabel) {
            const TEXT_MARGIN_X = 17.5;
            const TEXT_MARGIN_Y = 14;

            const prevHeight = this.height;

            this.width += (TEXT_MARGIN_X - Blockly.FlyoutButton.TEXT_MARGIN_X) * 2;
            this.height += (TEXT_MARGIN_Y - Blockly.FlyoutButton.TEXT_MARGIN_Y) * 2;

            const shadow = svgGroup.getElementsByClassName("blocklyFlyoutButtonShadow").item(0) as SVGRectElement;
            const rect = svgGroup.getElementsByClassName("blocklyFlyoutButtonBackground").item(0) as SVGRectElement;
            const text = svgGroup.getElementsByTagName("text").item(0) as SVGTextElement;

            // resize all elements
            shadow.setAttribute('width', String(this.width));
            shadow.setAttribute('height', String(this.height));
            rect.setAttribute('width', String(this.width));
            rect.setAttribute('height', String(this.height));
            text.setAttribute('x', String(this.width / 2));

            // the y of the svg text takes the height of the font into account so express the
            // new height in terms of the old to avoid recalculating the font metrics
            text.setAttribute(
              'y',
              String(parseFloat(text.getAttribute("y")) - (prevHeight / 2) + (this.height / 2)),
            );
            return;
        }

        // this adds the custom label properties we have for headers and group headings
        const def = json as ExtendedButtonInfo;
        if (def["web-class"]) {
            svgGroup.classList.add(def["web-class"]);
        }

        const icon = def["web-icon"];
        const iconClass = def["web-icon-class"];
        const iconColor = def["web-icon-color"];

        if (icon || iconClass) {
            const svgIcon = Blockly.utils.dom.createSvgElement(
                'text',
                {
                    'class': iconClass ? 'blocklyFlyoutLabelIcon ' + iconClass : 'blocklyFlyoutLabelIcon',
                    'x': 0, 'y': 0, 'text-anchor': 'start'
                },
                svgGroup
            ) as SVGTextElement;
            if (icon) svgIcon.textContent = icon;
            if (iconColor) svgIcon.setAttribute('style', 'fill: ' + iconColor);

            const ws = this.getTargetWorkspace();

            svgIcon.setAttribute('dominant-baseline', 'central');
            svgIcon.setAttribute('dy', '0');
            svgIcon.setAttribute('x', (ws.RTL ? this.width + Blockly.FlyoutButton.TEXT_MARGIN_X : 0) + "");
            svgIcon.setAttribute('y', (this.height / 2 + Blockly.FlyoutButton.TEXT_MARGIN_Y) + "");

            const iconWidth = Blockly.utils.dom.getTextWidth(svgIcon) + 2 * Blockly.FlyoutButton.TEXT_MARGIN_X
            this.width += iconWidth;

            for (let i = 0; i < svgGroup.children.length; i++) {
                const el = svgGroup.children.item(i);

                if (el !== svgIcon) {
                    const x = Number(el.getAttribute("x"));
                    el.setAttribute("x", (x + iconWidth) + "")
                }
            }
        }

        const line = def["web-line"];
        const lineWidth = def["web-line-width"];
        if (line) {
            const svgLine = Blockly.utils.dom.createSvgElement(
                'line',
                {
                    'class': 'blocklyFlyoutLine', 'stroke-dasharray': line,
                    'text-anchor': 'middle'
                },
                svgGroup
            );
            svgLine.setAttribute('x1', "0");
            svgLine.setAttribute('x2', lineWidth != null ? lineWidth : this.width + "");
            svgLine.setAttribute('y1', (this.height + 10) + "");
            svgLine.setAttribute('y2', (this.height + 10) + "");
        }
    }

    isDisposed(): boolean {
        return this.getSvgRoot().parentNode === null;
    }
}
