namespace pxtsprite {
    import svg = pxt.svgUtil;

    export interface ButtonGroup {
        root: svg.Group;
        cx: number;
        cy: number;
    }

    const TOGGLE_WIDTH = 200;
    const TOGGLE_HEIGHT = 40;
    const TOGGLE_BORDER_WIDTH = 2;
    const TOGGLE_CORNER_RADIUS = 4;

    const BUTTON_CORNER_RADIUS = 2;
    const BUTTON_BORDER_WIDTH = 1;
    const BUTTON_BOTTOM_BORDER_WIDTH = 2;

    export interface ToggleProps {
        baseColor: string;
        borderColor: string;
        backgroundColor: string;
        switchColor: string;
        unselectedTextColor: string;
        selectedTextColor: string;

        leftText: string;
        leftIcon: string;

        rightText: string;
        rightIcon: string;
    }

    export class Toggle {
        protected leftElement: svg.Group;
        protected leftText: svg.Text;
        protected rightElement: svg.Group;
        protected rightText: svg.Text;

        protected switch: svg.Rect;
        protected root: svg.Group;
        protected props: ToggleProps;

        protected isLeft: boolean;
        protected changeHandler: (left: boolean) => void;

        constructor(parent: svg.SVG, props: Partial<ToggleProps>) {
            this.props = defaultColors(props);
            this.root = parent.group();
            this.buildDom();
            this.isLeft = true;
        }

        protected buildDom() {
            // Our css minifier mangles animation names so they need to be injected manually
            this.root.style().content(`
            .toggle-left {
                transform: translateX(0px);
                animation: mvleft 0.2s 0s ease;
            }

            .toggle-right {
                transform: translateX(100px);
                animation: mvright 0.2s 0s ease;
            }

            @keyframes mvright {
                0% {
                    transform: translateX(0px);
                }
                100% {
                    transform: translateX(100px);
                }
            }

            @keyframes mvleft {
                0% {
                    transform: translateX(100px);
                }
                100% {
                    transform: translateX(0px);
                }
            }
            `);


            // The outer border has an inner-stroke so we need to clip out the outer part
            // because SVG's don't support "inner borders"
            const clip = this.root.def().create("clipPath", "sprite-editor-toggle-border")
                .clipPathUnits(true);

            clip.draw("rect")
                .at(0, 0)
                .corners(TOGGLE_CORNER_RADIUS / TOGGLE_WIDTH, TOGGLE_CORNER_RADIUS / TOGGLE_HEIGHT)
                .size(1, 1);

            // Draw the outer border
            this.root.draw("rect")
                .size(TOGGLE_WIDTH, TOGGLE_HEIGHT)
                .fill(this.props.baseColor)
                .stroke(this.props.borderColor, TOGGLE_BORDER_WIDTH * 2)
                .corners(TOGGLE_CORNER_RADIUS, TOGGLE_CORNER_RADIUS)
                .clipPath("url(#sprite-editor-toggle-border)");


            // Draw the background
            this.root.draw("rect")
                .at(TOGGLE_BORDER_WIDTH, TOGGLE_BORDER_WIDTH)
                .size(TOGGLE_WIDTH - TOGGLE_BORDER_WIDTH * 2, TOGGLE_HEIGHT - TOGGLE_BORDER_WIDTH * 2)
                .fill(this.props.backgroundColor)
                .corners(TOGGLE_CORNER_RADIUS, TOGGLE_CORNER_RADIUS);

            // Draw the switch
            this.switch = this.root.draw("rect")
                .at(TOGGLE_BORDER_WIDTH, TOGGLE_BORDER_WIDTH)
                .size((TOGGLE_WIDTH - TOGGLE_BORDER_WIDTH * 2) / 2, TOGGLE_HEIGHT - TOGGLE_BORDER_WIDTH * 2)
                .fill(this.props.switchColor)
                .corners(TOGGLE_CORNER_RADIUS, TOGGLE_CORNER_RADIUS);

            // Draw the left option
            this.leftElement = this.root.group();
            this.leftText = mkText(this.props.leftText)
                .appendClass("sprite-editor-text")
                .fill(this.props.selectedTextColor);
            this.leftElement.appendChild(this.leftText);

            // Draw the right option
            this.rightElement = this.root.group();
            this.rightText = mkText(this.props.rightText)
                .appendClass("sprite-editor-text")
                .fill(this.props.unselectedTextColor);
            this.rightElement.appendChild(this.rightText);

            this.root.onClick(() => this.toggle());
        }

        toggle(quiet = false) {
            if (this.isLeft) {
                this.switch.removeClass("toggle-left");
                this.switch.appendClass("toggle-right");
                this.leftText.fill(this.props.unselectedTextColor);
                this.rightText.fill(this.props.selectedTextColor);
            }
            else {
                this.switch.removeClass("toggle-right");
                this.switch.appendClass("toggle-left");
                this.leftText.fill(this.props.selectedTextColor);
                this.rightText.fill(this.props.unselectedTextColor);
            }
            this.isLeft = !this.isLeft;

            if (!quiet && this.changeHandler) {
                this.changeHandler(this.isLeft);
            }
        }

        onStateChange(handler: (left: boolean) => void) {
            this.changeHandler = handler;
        }

        layout() {
            const centerOffset = (TOGGLE_WIDTH - TOGGLE_BORDER_WIDTH * 2) / 4;
            this.leftText.moveTo(centerOffset + TOGGLE_BORDER_WIDTH, TOGGLE_HEIGHT / 2);
            this.rightText.moveTo(TOGGLE_WIDTH - TOGGLE_BORDER_WIDTH - centerOffset, TOGGLE_HEIGHT / 2)
        }

        translate(x: number, y: number) {
            this.root.translate(x, y);
        }

        height() {
            return TOGGLE_HEIGHT;
        }

        width() {
            return TOGGLE_WIDTH;
        }
    }

    export class Button {
        cx: number;
        cy: number;
        root: svg.Group;
        clickHandler: () => void;

        constructor(root: svg.Group, cx: number, cy: number) {
            this.root = root;
            this.cx = cx;
            this.cy = cy;
            this.root.onClick(() => this.clickHandler && this.clickHandler());
            this.root.appendClass("sprite-editor-button");
        }

        public getElement() {
            return this.root;
        }

        public addClass(className: string) {
            this.root.appendClass(className);
        }

        public removeClass(className: string) {
            this.root.removeClass(className);
        }

        public onClick(clickHandler: () => void) {
            this.clickHandler = clickHandler;
        }

        public translate(x: number, y: number) {
            this.root.translate(x, y);
        }

        public title(text: string) {
            this.root.title(text);
        }

        public setDisabled(disabled: boolean) {
            this.editClass("disabled", disabled);
        }

        public setSelected(selected: boolean) {
            this.editClass("selected", selected);
        }

        protected layout() { /* subclass */ }

        protected editClass(className: string, add: boolean) {
            if (add) {
                this.root.appendClass(className);
            }
            else {
                this.root.removeClass(className);
            }
        }
    }

    export class TextButton extends Button {
        protected textEl: svg.Text;

        constructor(button: ButtonGroup, text: string, className: string) {
            super(button.root, button.cx, button.cy);

            this.textEl = mkText(text)
                .appendClass(className);

            this.textEl.moveTo(this.cx, this.cy);

            this.root.appendChild(this.textEl);
        }

        setText(text: string) {
            this.textEl.text(text);
            this.textEl.moveTo(this.cx, this.cy);
        }

        getComputedTextLength() {
            try {
                return this.textEl.el.getComputedTextLength();
            }
            catch (e) {
                // Internet Explorer and Microsoft Edge throw if the element
                // is not visible. The best we can do is approximate
                return this.textEl.el.textContent.length * 8;
            }
        }
    }

    export class StandaloneTextButton extends TextButton {
        protected padding = 30;

        constructor(text: string, readonly height: number) {
            super(drawSingleButton(65, height), text, "sprite-editor-text");
            this.addClass("sprite-editor-label");
        }

        layout() {
            const newBG = drawSingleButton(this.width(), this.height);

            while (this.root.el.hasChildNodes()) {
                this.root.el.removeChild(this.root.el.firstChild);
            }

            while (newBG.root.el.hasChildNodes()) {
                const el = newBG.root.el.firstChild;
                newBG.root.el.removeChild(el);
                this.root.el.appendChild(el);
            }

            this.cx = newBG.cx;
            this.cy = newBG.cy;

            this.root.appendChild(this.textEl);
            this.textEl.moveTo(this.cx, this.cy);
        }

        width() {
            return this.getComputedTextLength() + this.padding * 2;
        }
    }

    export class CursorButton extends Button {
        constructor(root: svg.Group, cx: number, cy: number, width: number) {
            super(root, cx, cy);

            this.root.draw("rect")
                .fill("white")
                .size(width, width)
                .at(Math.floor(this.cx - width / 2), Math.floor(this.cy - width / 2))
        }
    }

    export function mkIconButton(icon: string, width: number, height = width + BUTTON_BOTTOM_BORDER_WIDTH - BUTTON_BORDER_WIDTH) {
        const g = drawSingleButton(width, height);
        return new TextButton(g, icon, "sprite-editor-icon");
    }

    export function mkXIconButton(icon: string, width: number, height = width + BUTTON_BOTTOM_BORDER_WIDTH - BUTTON_BORDER_WIDTH) {
        const g = drawSingleButton(width, height);
        return new TextButton(g, icon, "sprite-editor-xicon");
    }

    export function mkTextButton(text: string, width: number, height: number) {
        const g = drawSingleButton(width, height);
        const t = new TextButton(g, text, "sprite-editor-text");
        t.addClass("sprite-editor-label");
        return t;
    }

    /**
     * Draws a button suitable for the left end of a button group.
     *
     * @param width The total width of the result (including border)
     * @param height The total height of the resul (including border and lip)
     * @param lip  The width of the bottom border
     * @param border The width of the outer border (except bottom)
     * @param r The corner radius
     */
    function drawLeftButton(width: number, height: number, lip: number, border: number, r: number): ButtonGroup {
        const root = new svg.Group().appendClass("sprite-editor-button");
        const bg = root.draw("path")
            .appendClass("sprite-editor-button-bg");
        bg.d.moveTo(r, 0)
            .lineBy(width - r, 0)
            .lineBy(0, height)
            .lineBy(-(width - r), 0)
            .arcBy(r, r, 0, false, true, -r, -r)
            .lineBy(0, -(height - (r << 1)))
            .arcBy(r, r, 0, false, true, r, -r)
            .close();
        bg.update();

        const fg = root.draw("path")
            .appendClass("sprite-editor-button-fg");
        fg.d.moveTo(border + r, border)
            .lineBy(width - border - r, 0)
            .lineBy(0, height - lip - border)
            .lineBy(-(width - border - r), 0)
            .arcBy(r, r, 0, false, true, -r, -r)
            .lineBy(0, -(height - lip - border - (r << 1)))
            .arcBy(r, r, 0, false, true, r, -r)
            .close();
        fg.update();

        return {
            root,
            cx: border + (width - border) / 2,
            cy: border + (height - lip) / 2
        };
    }

    export class CursorMultiButton {
        root: svg.Group;
        selected: number;
        buttons: Button[];

        indexHandler: (index: number) => void;

        constructor(parent: svg.Group, width: number) {
            this.root = parent.group();
            const widths = [4, 7, 10]

            this.buttons = buttonGroup(65, 21, 3).map((b, i) => new CursorButton(b.root, b.cx, b.cy, widths[i]));
            this.buttons.forEach((button, index) => {
                button.onClick(() => this.handleClick(index));
                button.title(sizeAdjective(index));
                this.root.appendChild(button.getElement());
            });
        }

        protected handleClick(index: number) {
            if (index === this.selected) return;

            if (this.selected != undefined) {
                this.buttons[this.selected].setSelected(false);
            }

            this.selected = index;

            if (this.selected != undefined) {
                this.buttons[this.selected].setSelected(true);
            }

            if (this.indexHandler) this.indexHandler(index);
        }

        onSelected(cb: (index: number) => void) {
            this.indexHandler = cb;
        }
    }

    export interface UndoRedoHost {
        undo(): void;
        redo(): void;
    }

    export class UndoRedoGroup {
        root: svg.Group;
        undo: TextButton;
        redo: TextButton;

        host: UndoRedoHost;

        constructor(parent: svg.Group, host: UndoRedoHost, width: number, height: number) {
            this.root = parent.group();
            this.host = host;
            const [undo, redo] = buttonGroup(width, height, 2);

            this.undo = new TextButton(undo, "\uf118", "sprite-editor-xicon");
            this.undo.onClick(() => this.host.undo());
            this.root.appendChild(this.undo.getElement());


            this.redo = new TextButton(redo, "\uf111", "sprite-editor-xicon");
            this.redo.onClick(() => this.host.redo());
            this.root.appendChild(this.redo.getElement());
        }

        translate(x: number, y: number) {
            this.root.translate(x, y);
        }

        updateState(undo: boolean, redo: boolean) {
            this.undo.setDisabled(undo);
            this.redo.setDisabled(redo);
        }
    }


    function defaultColors(props: Partial<ToggleProps>): ToggleProps {
        if (!props.baseColor) props.baseColor = "#e95153";
        if (!props.backgroundColor) props.backgroundColor = "rgba(52,73,94,.2)";
        if (!props.borderColor) props.borderColor = "rgba(52,73,94,.4)";
        if (!props.selectedTextColor) props.selectedTextColor = props.baseColor;
        if (!props.unselectedTextColor) props.unselectedTextColor = "hsla(0,0%,100%,.9)";
        if (!props.switchColor) props.switchColor = "#ffffff";

        return props as ToggleProps;
    }

    function sizeAdjective(cursorIndex: number) {
        switch (cursorIndex) {
            case 0: return lf("Small Cursor");
            case 1: return lf("Medium Cursor");
            case 2: return lf("Large Cursor");
        }

        return undefined;
    }

        /**
     * Draws a button suitable for the interior of a button group.
     *
     * @param width The total width of the result (including border)
     * @param height The total height of the resul (including border and lip)
     * @param lip  The width of the bottom border
     * @param border The width of the outer border (except bottom)
     */
    function drawMidButton(width: number, height: number, lip: number, border: number): ButtonGroup {
        const root = new svg.Group().appendClass("sprite-editor-button");
        const bg = root.draw("rect")
            .appendClass("sprite-editor-button-bg")
            .size(width, height)

        const fg = root.draw("rect")
            .appendClass("sprite-editor-button-fg")
            .size(width - border, height - lip - border)
            .at(border, border);

        return {
            root,
            cx: border + (width - border) / 2,
            cy: border + (height - lip) / 2
        };
    }

    /**
     * Draws a button suitable for the right end of a button group.
     *
     * @param width The total width of the result (including border)
     * @param height The total height of the resul (including border and lip)
     * @param lip  The width of the bottom border
     * @param border The width of the outer border (except bottom)
     * @param r The corner radius
     */
    function drawRightButton(width: number, height: number, lip: number, border: number, r: number): ButtonGroup {
        const root = new svg.Group().appendClass("sprite-editor-button");
        const bg = root.draw("path")
            .appendClass("sprite-editor-button-bg");
        bg.d.moveTo(0, 0)
            .lineBy(width - r, 0)
            .arcBy(r, r, 0, false, true, r, r)
            .lineBy(0, height - (r << 1))
            .arcBy(r, r, 0, false, true, -r, r)
            .lineBy(-(width - r), 0)
            .lineBy(0, -height)
            .close();
        bg.update();

        const fg = root.draw("path")
            .appendClass("sprite-editor-button-fg");
        fg.d.moveTo(border, border)
            .lineBy(width - border - r, 0)
            .arcBy(r, r, 0, false, true, r, r)
            .lineBy(0, height - border - lip - (r << 1))
            .arcBy(r, r, 0, false, true, -r, r)
            .lineBy(-(width - border - r), 0)
            .lineBy(0, -(height - border - lip))
            .close();
        fg.update();

        const content = root.group().id("sprite-editor-button-content");
        content.translate(border + (width - (border << 1)) >> 1, (height - lip - border) >> 1);

        return {
            root,
            cx: width / 2,
            cy: border + (height - lip) / 2
        };
    }

    /**
     * Draws a standalone button.
     *
     * @param width The total width of the result (including border)
     * @param height The total height of the resul (including border and lip)
     * @param lip  The width of the bottom border
     * @param border The width of the outer border (except bottom)
     * @param r The corner radius
     */
    function drawSingleButton(width: number, height: number, lip = BUTTON_BOTTOM_BORDER_WIDTH, border = BUTTON_BORDER_WIDTH, r = BUTTON_CORNER_RADIUS): ButtonGroup {
        const root = new svg.Group().appendClass("sprite-editor-button");
        root.draw("rect")
            .size(width, height)
            .corners(r, r)
            .appendClass("sprite-editor-button-bg");

        root.draw("rect")
            .at(border, border)
            .size(width - (border << 1), height - lip - border)
            .corners(r, r)
            .appendClass("sprite-editor-button-fg");

        return {
            root,
            cx: width / 2,
            cy: border + (height - lip) / 2
        };
    }

    function buttonGroup(width: number, height: number, segments: number, lip = BUTTON_BOTTOM_BORDER_WIDTH, border = BUTTON_BORDER_WIDTH, r = BUTTON_CORNER_RADIUS): ButtonGroup[] {
        const available = width - (segments + 1) * border;
        const segmentWidth = Math.floor(available / segments);

        const result: ButtonGroup[] = [];
        for (let i = 0; i < segments; i++) {
            if (i === 0) {
                result.push(drawLeftButton(segmentWidth + border, height, lip, border, r));
            }
            else if (i === segments - 1) {
                const b = drawRightButton(segmentWidth + (border << 1), height, lip, border, r);
                b.root.translate((border + segmentWidth) * i, 0);
                result.push(b);
            }
            else {
                const b = drawMidButton(segmentWidth + border, height, lip, border);
                b.root.translate((border + segmentWidth) * i, 0);
                result.push(b);
            }
        }

        return result;
    }

    export function mkText(text: string) {
        return new svg.Text(text)
            .anchor("middle")
            .setAttribute("dominant-baseline", "middle")
            .setAttribute("dy", (pxt.BrowserUtils.isIE() || pxt.BrowserUtils.isEdge()) ? "0.3em" : "0.1em")
    }
}