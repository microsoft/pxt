import * as Blockly from "blockly";

export class VerticalFlyout extends Blockly.VerticalFlyout {
    protected def: Element[];
    protected buttonListeners: Blockly.browserEvents.Data[] = [];

    show(flyoutDef: string | Blockly.utils.toolbox.FlyoutDefinition): void {
        this.def = flyoutDef as Element[];

        super.show(flyoutDef);
    }

    protected initFlyoutButton_(button: Blockly.FlyoutButton, x: number, y: number): void {
        const textMarginX = Blockly.FlyoutButton.TEXT_MARGIN_X;
        const textMarginY = Blockly.FlyoutButton.TEXT_MARGIN_Y;

        if (!button.isLabel()) {
            Blockly.FlyoutButton.TEXT_MARGIN_X = 17.5;
            Blockly.FlyoutButton.TEXT_MARGIN_Y = 14;
        }

        const buttonSvg = button.createDom() as SVGGElement;
        button.moveTo(x, y);
        button.show();
        // Clicking on a flyout button or label is a lot like clicking on the
        // flyout background.
        this.buttonListeners.push(
            Blockly.browserEvents.conditionalBind(
                buttonSvg,
                'pointerdown',
                this,
                this.onButtonMouseDown,
            ),
        );

        this.buttons_.push(button);

        Blockly.FlyoutButton.TEXT_MARGIN_X = textMarginX;
        Blockly.FlyoutButton.TEXT_MARGIN_Y = textMarginY;

        const def = this.def.find(n => n.getAttribute("text") === button.getButtonText());

        if (!def) return;

        if (def.hasAttribute("web-class")) {
            buttonSvg.classList.add(def.getAttribute("web-class"));
        }

        const icon = def.getAttribute("web-icon");
        const iconClass = def.getAttribute("web-icon-class");
        const iconColor = def.getAttribute("web-icon-color");

        if (icon || iconClass) {
            const svgIcon = Blockly.utils.dom.createSvgElement(
                'text',
                {
                    'class': iconClass ? 'blocklyFlyoutLabelIcon ' + iconClass : 'blocklyFlyoutLabelIcon',
                    'x': 0, 'y': 0, 'text-anchor': 'start'
                },
                buttonSvg
            ) as SVGTextElement;
            if (icon) svgIcon.textContent = icon;
            if (iconColor) svgIcon.setAttribute('style', 'fill: ' + iconColor);

            const ws = button.getTargetWorkspace();

            svgIcon.setAttribute('dominant-baseline', 'central');
            svgIcon.setAttribute('dy', '0');
            svgIcon.setAttribute('x', (ws.RTL ? button.width + Blockly.FlyoutButton.TEXT_MARGIN_X : 0) + "");
            svgIcon.setAttribute('y', (button.height / 2 + Blockly.FlyoutButton.TEXT_MARGIN_Y) + "");

            const iconWidth = Blockly.utils.dom.getTextWidth(svgIcon) + 2 * Blockly.FlyoutButton.TEXT_MARGIN_X
            button.width += iconWidth;

            for (let i = 0; i < buttonSvg.children.length; i++) {
                const el = buttonSvg.children.item(i);

                if (el !== svgIcon) {
                    const x = Number(el.getAttribute("x"));
                    el.setAttribute("x", (x + iconWidth) + "")
                }
            }
        }

        const line = def.getAttribute("web-line");
        const lineWidth = def.getAttribute("web-line-width");
        if (line) {
            const svgLine = Blockly.utils.dom.createSvgElement(
                'line',
                {
                    'class': 'blocklyFlyoutLine', 'stroke-dasharray': line,
                    'text-anchor': 'middle'
                },
                buttonSvg
            );
            svgLine.setAttribute('x1', "0");
            svgLine.setAttribute('x2', lineWidth != null ? lineWidth : button.width + "");
            svgLine.setAttribute('y1', (button.height + 10) + "");
            svgLine.setAttribute('y2', (button.height + 10) + "");
        }
    }

    protected onButtonMouseDown(e: PointerEvent) {
        const gesture = this.targetWorkspace.getGesture(e);
        if (gesture) {
            gesture.handleFlyoutStart(e, this);
        }
    }
}