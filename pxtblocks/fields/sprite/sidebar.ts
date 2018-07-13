namespace pxtblockly {
    import svg = pxt.svgUtil;
    import lf = pxt.Util.lf;

    export interface SideBarHost {
        setActiveTool(tool: PaintTool): void;
        setActiveColor(color: number): void;
        setToolWidth(width: number): void;
    }

    const TOOLBAR_WIDTH = 50;
    const INNER_BUTTON_MARGIN = 2;
    const PALETTE_BORDER_WIDTH = 2;
    const BUTTON_GROUP_SPACING = 3;
    const SELECTED_BORDER_WIDTH = 2;
    const COLOR_PREVIEW_HEIGHT = 25;
    const COLOR_MARGIN = 7;

    const CURSOR_BUTTON_WIDTH = ((TOOLBAR_WIDTH  - INNER_BUTTON_MARGIN * 2) / 3);
    const TOOL_BUTTON_WIDTH = (TOOLBAR_WIDTH - INNER_BUTTON_MARGIN) / 2;
    const PALLETTE_SWATCH_WIDTH = (TOOLBAR_WIDTH - PALETTE_BORDER_WIDTH * 3) / 2;
    const TOOL_BUTTON_TOP = CURSOR_BUTTON_WIDTH + BUTTON_GROUP_SPACING;
    const PALETTE_TOP = TOOL_BUTTON_TOP + TOOL_BUTTON_WIDTH * 2 + INNER_BUTTON_MARGIN + COLOR_MARGIN;

    export class SideBar {
        root: svg.Group;
        host: SideBarHost;
        palette: string[];

        protected sizeButtons: Button[];
        protected colorSwatches: svg.Rect[];
        protected pencilTool: Button;
        protected eraseTool: Button;
        protected rectangleTool: Button;
        protected fillTool: Button;

        protected sizeGroup: svg.Group;
        protected buttonGroup: svg.Group;
        protected paletteGroup: svg.Group;

        protected selectedTool: Button;
        protected selectedSize: Button;
        protected selectedSwatch: svg.Rect;
        protected colorPreview: svg.Rect;

        constructor(palette: string[], host: SideBarHost, parent: svg.Group) {
            this.palette = palette;
            this.host = host;
            this.root = parent.group().id("sprite-editor-sidebar");

            this.initSizes();
            this.initTools();
            this.initPalette();
        }

        public setTool(tool: PaintTool) {
            this.host.setActiveTool(tool);

            if (this.selectedTool) {
                this.selectedTool.removeClass("toolbar-button-selected");
            }

            this.selectedTool = this.getButtonForTool(tool);

            if (this.selectedTool) {
                this.selectedTool.addClass("toolbar-button-selected");
            }
        }

        public setColor(color: number) {
            this.host.setActiveColor(color);

            if (this.selectedSwatch) {
                this.selectedSwatch.stroke("none");
            }

            this.selectedSwatch = this.colorSwatches[color];

            if (this.selectedSwatch) {
                // Border is multiplied by 2 and the excess is clipped away
                this.selectedSwatch.stroke("orange", SELECTED_BORDER_WIDTH * 2);
                this.colorPreview.fill(this.palette[color]);
            }

            // FIXME: Switch the tool to pencil
        }

        public setCursorSize(size: number) {
            this.host.setToolWidth(size);

            if (this.selectedSize) {
                this.selectedSize.removeClass("toolbar-button-selected");
            }

            this.selectedSize = this.sizeButtons[size - 1];

            if (this.selectedSize) {
                this.selectedTool.addClass("toolbar-button-selected");
            }
        }

        public setWidth(width: number) {
            this.root.scale(width / TOOLBAR_WIDTH);
        }

        public translate(left: number, top: number) {
            this.root.translate(left, top);
        }

        protected initSizes() {
            this.sizeGroup = this.root.group().id("sprite-editor-cursor-buttons");
            this.sizeButtons = [];

            this.initCursorButton(1);
            this.initCursorButton(2).translate(INNER_BUTTON_MARGIN + CURSOR_BUTTON_WIDTH, 0);
            this.initCursorButton(3).translate(2 * (INNER_BUTTON_MARGIN + CURSOR_BUTTON_WIDTH), 0);
        }

        protected initTools() {
            this.buttonGroup = this.root.group()
                .id("sprite-editor-tools")
                .translate(0, TOOL_BUTTON_TOP);

            this.pencilTool = this.initButton(lf("Pencil"), "\uf040", PaintTool.Normal);

            this.eraseTool = this.initButton(lf("Erase"), "\uf12d", PaintTool.Erase);
            this.eraseTool.translate(TOOL_BUTTON_WIDTH + INNER_BUTTON_MARGIN, 0);

            this.fillTool = this.initButton(lf("Fill"), "\uf0d0", PaintTool.Fill);
            this.fillTool.translate(0, TOOL_BUTTON_WIDTH + INNER_BUTTON_MARGIN);

            this.rectangleTool = this.initButton(lf("Rectangle"), "\uf096", PaintTool.Rectangle);
            this.rectangleTool.translate(TOOL_BUTTON_WIDTH + INNER_BUTTON_MARGIN, TOOL_BUTTON_WIDTH + INNER_BUTTON_MARGIN);

            this.setTool(PaintTool.Normal);
        }

        protected initPalette() {
            this.paletteGroup = this.root.group().id("sprite-editor-palette")
                .translate(0, PALETTE_TOP);

            // Draw the background/borders for the entire palette
            const bgHeight = COLOR_PREVIEW_HEIGHT + PALETTE_BORDER_WIDTH * 2;
            this.paletteGroup.draw("rect")
                .fill("#000000")
                .size(TOOLBAR_WIDTH, bgHeight);

            this.paletteGroup.draw("rect")
                .fill("#000000")
                .at(0, bgHeight + COLOR_MARGIN)
                .size(TOOLBAR_WIDTH, PALETTE_BORDER_WIDTH + (this.palette.length >> 1) * (PALLETTE_SWATCH_WIDTH + PALETTE_BORDER_WIDTH));

            // The highlighted swatch has an inner border. The only way to do that in SVG
            // is to set the stroke to double the border width and clip the excess away
            const clip = this.paletteGroup.def().create("clipPath", "sprite-editor-selected-color")
                .clipPathUnits(true);

            clip.draw("rect")
                .at(0, 0)
                .size(1, 1);

            // Draw a preview of the current color
            this.colorPreview = this.paletteGroup.draw("rect")
                .at(PALETTE_BORDER_WIDTH, PALETTE_BORDER_WIDTH)
                .size(TOOLBAR_WIDTH - PALETTE_BORDER_WIDTH * 2, COLOR_PREVIEW_HEIGHT);

            // Draw the swatches for each color
            this.colorSwatches = []
            for (let i = 0; i < this.palette.length; i++) {
                const col = i % 2;
                const row = Math.floor(i / 2);

                const swatch = this.paletteGroup
                    .draw("rect")
                    .size(PALLETTE_SWATCH_WIDTH, PALLETTE_SWATCH_WIDTH)
                    .at(col ? PALETTE_BORDER_WIDTH * 2 + PALLETTE_SWATCH_WIDTH : PALETTE_BORDER_WIDTH, bgHeight + COLOR_MARGIN + PALETTE_BORDER_WIDTH + row * (PALETTE_BORDER_WIDTH + PALLETTE_SWATCH_WIDTH))
                    .fill(this.palette[i])
                    .clipPath("url(#sprite-editor-selected-color)")
                    .onClick(() => this.setColor(i));

                this.colorSwatches.push(swatch);
            }

            this.setColor(0);
        }

        protected initButton(title: string, icon: string, tool: PaintTool) {
            const btn = mkToolbarButton(icon, TOOL_BUTTON_WIDTH, 4);
            btn.title(title);
            btn.onClick(() => this.setTool(tool));
            this.buttonGroup.appendChild(btn.getView());
            return btn;
        }

        protected initCursorButton(size: number) {
            const btn = mkCursorSizeButton(size, CURSOR_BUTTON_WIDTH);
            btn.title(sizeAdjective(size));
            btn.onClick(() => this.setCursorSize(size - 1));
            this.sizeGroup.appendChild(btn.getView());
            this.sizeButtons.push(btn);
            return btn;
        }

        protected getButtonForTool(tool: PaintTool) {
            switch (tool) {
                case PaintTool.Normal: return this.pencilTool;
                case PaintTool.Erase: return this.eraseTool;
                case PaintTool.Fill: return this.fillTool;
                case PaintTool.Rectangle: return this.rectangleTool;
                default: return undefined;
            }
        }
    }

    function mkCursorSizeButton(size: number, sideLength: number) {
        return new CursorSizeButton({
            width: sideLength,
            height: sideLength,
            padding: 2,
            cornerRadius: 2,
            rootClass: "toolbar-button",
            backgroundClass: "toolbar-button-background",
            cursorFill: "black",
            cursorSideLength: size
        });
    }

    function mkToolbarButton(icon: string, sideLength: number, padding: number) {
        return new FontIconButton({
            width: sideLength,
            height: sideLength,
            cornerRadius: 2,
            padding: padding,
            iconFont: "Icons",
            iconString: icon,
            rootClass: "toolbar-button",
            backgroundClass: "toolbar-button-background",
            iconClass: "toolbar-button-icon"
        });
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