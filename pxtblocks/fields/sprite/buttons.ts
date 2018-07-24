namespace pxtblockly {
    import svg = pxt.svgUtil;

    export interface ButtonProps {
        width: number;
        height: number;
        cornerRadius: number;
        backgroundClass?: string;
        rootClass?: string;

        padding: number;
    }

    export class Button {
        protected root: svg.Group;
        protected background: svg.Rect;
        protected enabled = true;

        protected clickHandler: () => void;

        constructor (protected props: ButtonProps) {
            this.buildDom();
        }

        public onClick(clickHandler: () => void) {
            this.clickHandler = clickHandler;
        }

        public translate(x: number, y: number) {
            this.root.translate(x, y);
        }

        public getView() {
            return this.root;
        }

        public addClass(className: string) {
            this.root.appendClass(className);
        }

        public removeClass(className: string) {
            this.root.removeClass(className);
        }

        public title(text: string) {
            this.root.title(text);
        }

        public setDimensions(width: number, height: number) {
            this.props.width = width;
            this.props.height = height;
            this.layout();
        }

        public setEnabled(enabled: boolean) {
            if (enabled != this.enabled) {
                this.enabled = enabled;

                if (this.enabled) {
                    this.root.removeClass("disabled");
                }
                else {
                    this.root.appendClass("disabled");
                }
            }
        }

        public setVisible(visible: boolean) {
            this.root.setVisible(visible);
        }

        protected buildDom() {
            this.root = new svg.Group();

            this.background = this.root.draw("rect")
                .corner(this.props.cornerRadius);

            if (this.props.rootClass) {
                this.root.setClass(this.props.rootClass);
            }
            if (this.props.backgroundClass) {
                this.background.setClass(this.props.backgroundClass);
            }

            this.drawContent();

            this.root.el.addEventListener("click", () => {
                this.handleClick();
            });

            this.layout();
        }

        // To be overridden by subclass
        protected drawContent() {  }

        // To be overridden by subclass
        protected layoutContent(contentWidth: number, contentHeight: number, top: number, left: number) {  }

        protected handleClick() {
            if (this.clickHandler && this.enabled) {
                this.clickHandler();
            }
        }

        protected layout() {
            this.background.size(this.props.width, this.props.height);
            const contentWidth = this.props.width - this.props.padding * 2;
            const contentHeight = this.props.height - this.props.padding * 2;
            this.layoutContent(contentWidth, contentHeight, this.props.padding, this.props.padding);
        }
    }

    export interface FontIconButtonProps extends ButtonProps {
        iconString: string;
        iconFont: string;
        iconClass?: string;
    }

    export class FontIconButton extends Button {
        protected icon: svg.Text;

        constructor (protected props: FontIconButtonProps) {
            super(props);
        }

        protected drawContent() {
            this.icon = this.root.draw("text")
                .fontFamily(this.props.iconFont)
                .text(this.props.iconString)
                .anchor("middle")

            if (this.props.iconClass) {
                this.icon.setClass(this.props.iconClass);
            }
        }

        protected layoutContent(contentWidth: number, contentHeight: number, top: number, left: number) {
            this.icon.at(left + contentWidth / 2, top)
                .offset(0, 0.8, svg.LengthUnit.em)
                .fontSize(contentHeight, svg.LengthUnit.px);
        }
    }

    export interface CursorButtonProps extends ButtonProps {
        cursorSideLength: number;
        cursorFill: string;
    }

    export class CursorSizeButton extends Button {
        protected cursor: svg.Rect;

        constructor (protected props: CursorButtonProps) {
            super(props);
        }

        protected drawContent() {
            this.cursor = this.root.draw("rect")
                .fill(this.props.cursorFill)
        }

        protected layoutContent(contentWidth: number, contentHeight: number, top: number, left: number) {

            const unit = Math.min(contentWidth, contentHeight) / 3;

            const sideLength = this.props.cursorSideLength * unit;
            this.cursor.at(left + contentWidth / 2 - sideLength / 2, top + contentHeight / 2 - sideLength / 2)
                .size(sideLength, sideLength);
        }
    }

    const TOGGLE_WIDTH = 200;
    const TOGGLE_HEIGHT = 40;
    const CORNER_RADIUS = 4;
    const BORDER_WIDTH = 2;

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
                .corners(CORNER_RADIUS / TOGGLE_WIDTH, CORNER_RADIUS / TOGGLE_HEIGHT)
                .size(1, 1);

            // Draw the outer border
            this.root.draw("rect")
                .size(TOGGLE_WIDTH, TOGGLE_HEIGHT)
                .fill(this.props.baseColor)
                .stroke(this.props.borderColor, BORDER_WIDTH * 2)
                .corners(CORNER_RADIUS, CORNER_RADIUS)
                .clipPath("url(#sprite-editor-toggle-border)");


            // Draw the background
            this.root.draw("rect")
                .at(BORDER_WIDTH, BORDER_WIDTH)
                .size(TOGGLE_WIDTH - BORDER_WIDTH * 2, TOGGLE_HEIGHT - BORDER_WIDTH * 2)
                .fill(this.props.backgroundColor)
                .corners(CORNER_RADIUS, CORNER_RADIUS);

            // Draw the switch
            this.switch = this.root.draw("rect")
                .at(BORDER_WIDTH, BORDER_WIDTH)
                .size((TOGGLE_WIDTH - BORDER_WIDTH * 2) / 2, TOGGLE_HEIGHT - BORDER_WIDTH * 2)
                .fill(this.props.switchColor)
                .corners(CORNER_RADIUS, CORNER_RADIUS);

            // Draw the left option
            this.leftElement = this.root.group();
            this.leftText = this.leftElement.draw("text")
                .fill(this.props.selectedTextColor)
                .text(this.props.leftText)
                .setAttribute("dominant-baseline", "middle")
                .setAttribute("dy", 0);

            // Draw the right option
            this.rightElement = this.root.group();
            this.rightText = this.rightElement.draw("text")
                .fill(this.props.unselectedTextColor)
                .text(this.props.rightText)
                .setAttribute("dominant-baseline", "middle")
                .setAttribute("dy", 0);

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
            const centerOffset = (TOGGLE_WIDTH - BORDER_WIDTH * 2) / 4;

            const lWidth = this.leftText.el.getComputedTextLength();
            this.leftText.moveTo(centerOffset + BORDER_WIDTH - lWidth / 2, TOGGLE_HEIGHT / 2);

            const rWidth = this.rightText.el.getComputedTextLength();
            this.rightText.moveTo(TOGGLE_WIDTH - BORDER_WIDTH - centerOffset - rWidth / 2, TOGGLE_HEIGHT / 2)
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

    const BUTTON_BOTTOM_OFFSET = 3;
    const BUTTON_BORDER_WIDTH = 1;
    const BUTTON_CORNER_RADIUS = 2;

    export abstract class BaseButton {
        root: svg.Group;
        clickHandler: () => void;

        constructor(parent: svg.Group) {
            this.root = parent.group().appendClass("sprite-editor-button");
            this.root.onClick(() => this.clickHandler && this.clickHandler());
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
    }

    export abstract class NewButton extends BaseButton {
        background: svg.Rect;
        foreground: svg.Rect;
        content: svg.Group;
        width = 31;

        constructor(parent: svg.Group) {
            super(parent);
            this.root.style().content(`
            .test-anim {
                animation: dom-test 0.2s 0s ease;
            }

            @keyframes dom-test {
                0% {
                    transform: translateX(0px);
                }
                100% {
                    transform: translateX(0px);
                }
            }
            `);
            this.buildDom();
        }

        protected abstract buildContent(g: svg.Group): void;
        protected abstract layout(): void;

        protected buildDom() {
            this.background = this.root.draw("rect")
                .size(this.width, this.width)
                .corners(BUTTON_CORNER_RADIUS, BUTTON_CORNER_RADIUS)
                .appendClass("sprite-editor-button-bg");

            this.foreground = this.root.draw("rect")
                .at(BUTTON_BORDER_WIDTH, BUTTON_BORDER_WIDTH)
                .size(this.width - BUTTON_BORDER_WIDTH * 2, this.width - BUTTON_BOTTOM_OFFSET - BUTTON_BORDER_WIDTH)
                .corners(BUTTON_CORNER_RADIUS, BUTTON_CORNER_RADIUS)
                .appendClass("sprite-editor-button-fg");

            this.content = this.root.group();
            this.buildContent(this.content);

            this.background.el.style.animation = "dom-test";
            this.background.el.addEventListener("animationstart", () => {
                this.layout();
            });
        }
    }

    export class NewFontButton extends NewButton {
        iconEl: svg.Text;
        constructor(parent: svg.Group, icon: string) {
            super(parent);
            this.iconEl.text(icon);
        }

        protected buildContent(g: svg.Group) {
            this.iconEl = g.draw("text")
                .appendClass("sprite-editor-icon")
                .setAttribute("dominant-baseline", "middle")
                .setAttribute("dy", 2.5);
        }

        protected layout() {
            const width = this.iconEl.el.getComputedTextLength();
            this.content.translate((this.width - width) / 2, (this.width - BUTTON_BOTTOM_OFFSET - BUTTON_BORDER_WIDTH) / 2)
        }
    }

    function drawLeftButton(width: number, height: number, lip: number, border: number, r: number) {
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

        const content = root.group().id("sprite-editor-button-content");
        content.translate(border + (width - border) >> 1, (height - lip - border) >> 1);

        return root;
    }

    function drawMidButton(width: number, height: number, lip: number, border: number) {
        const root = new svg.Group().appendClass("sprite-editor-button");
        const bg = root.draw("rect")
            .appendClass("sprite-editor-button-bg")
            .size(width, height)

        const fg = root.draw("rect")
            .appendClass("sprite-editor-button-fg")
            .size(width - border, height - lip - border)
            .at(border, border);

        const content = root.group().id("sprite-editor-button-content");
        content.translate((width - border) >> 1, (height - lip - border) >> 1);

        return root;
    }

    function drawRightButton(width: number, height: number, lip: number, border: number, r: number) {
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

        return root;
    }


    function buttonGroup(width: number, height: number, lip: number, border: number, r: number, segments: number) {
        const available = width - (segments + 1) * border;
        const segmentWidth = Math.floor(available / segments);

        const result: svg.Group[] = [];
        for (let i = 0; i < segments; i++) {
            if (i === 0) {
                result.push(drawLeftButton(segmentWidth + border, height, lip, border, r));
            }
            else if (i === segments - 1) {
                const b = drawRightButton(segmentWidth + (border << 1), height, lip, border, r);
                b.translate((border + segmentWidth) * i, 0);
                result.push(b);
            }
            else {
                const b = drawMidButton(segmentWidth + border, height, lip, border);
                b.translate((border + segmentWidth) * i, 0);
                result.push(b);
            }
        }

        return result;
    }

    export class CursorMultiButton {
        root: svg.Group;
        buttons: svg.Group[];
        selected: number;

        indexHandler: (index: number) => void;

        constructor(parent: svg.Group, width: number) {
            this.root = parent.group();
            const widths = [4, 7, 10]

            this.buttons = buttonGroup(65, 21, 3, 1, CORNER_RADIUS, 3);
            this.buttons.forEach((button, index) => {
                const width = widths[index];
                const content = getChildById(button.el, "sprite-editor-button-content");
                const r = new svg.Rect().size(width, width).at(1 + Math.ceil(-width / 2), 1 + Math.ceil(-width / 2)).fill("white");
                content.appendChild(r.el);
                this.root.appendChild(button);
                button.onClick(() => this.handleClick(index));
                button.title(sizeAdjective(index));
            });
        }

        protected handleClick(index: number) {
            if (index === this.selected) return;

            if (this.selected != undefined) {
                this.buttons[this.selected].removeClass("selected");
            }

            this.selected = index;

            if (this.selected != undefined) {
                this.buttons[this.selected].appendClass("selected");
            }

            if (this.indexHandler) this.indexHandler(index);
        }

        onSelected(cb: (index: number) => void) {
            this.indexHandler = cb;
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

    function getChildById(parent: SVGElement, id: string) {
        if (parent && parent.children) {
            for (let i = 0; i < parent.children.length; i++) {
                const child = parent.children.item(i);
                if (child.id === id) {
                    return child as SVGElement;
                }
            }
        }
        return undefined;
    }

    function sizeAdjective(cursorIndex: number) {
        switch (cursorIndex) {
            case 0: return lf("Small Cursor");
            case 1: return lf("Medium Cursor");
            case 2: return lf("Large Cursor");
        }

        return undefined;
    }
}