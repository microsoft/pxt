namespace pxtblockly {
    import svg = pxt.svgUtil;

    export interface SpriteHeaderHost {
        undo(): void;
        redo(): void;
        showGrid(): void;
        hideGrid(): void;
    }

    const BUTTON_HEIGHT = 35;

    export class SpriteHeader {
        div: HTMLDivElement;
        root: svg.SVG;
        toggle: Toggle;
        undoButton: Button;
        redoButton: Button;

        constructor() {
            this.div = document.createElement("div");
            this.div.setAttribute("id", "sprite-editor-header");

            this.root = new svg.SVG(this.div).id("sprite-editor-header-controls");
            this.toggle = new Toggle(this.root, { leftText: "Editor", rightText: "Gallery", baseColor: "#4B7BEC" });

            this.undoButton = mkHeaderButton("\uf0e2", BUTTON_HEIGHT, 5);
            this.root.appendChild(this.undoButton.getView());

            this.redoButton = mkHeaderButton("\uf01e", BUTTON_HEIGHT, 5);
            this.root.appendChild(this.redoButton.getView());
        }

        getElement() {
            return this.div;
        }

        layout() {
            this.toggle.layout();
            const bounds = this.div.getBoundingClientRect();
            this.toggle.translate(bounds.width - this.toggle.width(), (bounds.height / 2) - (this.toggle.height() / 2));

            this.undoButton.translate(8, (bounds.height / 2) - (BUTTON_HEIGHT / 2));
            this.redoButton.translate(13 + BUTTON_HEIGHT, (bounds.height / 2) - (BUTTON_HEIGHT / 2));
        }
    }

    function mkHeaderButton(icon: string, sideLength: number, padding: number) {
        return new FontIconButton({
            width: sideLength,
            height: sideLength,
            cornerRadius: 4,
            padding: padding,
            iconFont: "Icons",
            iconString: icon,
            rootClass: "toolbar-button",
            backgroundClass: "toolbar-button-background header",
            iconClass: "toolbar-button-icon"
        });
    }
}