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
}