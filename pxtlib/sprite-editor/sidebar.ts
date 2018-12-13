/// <reference path="./buttons.ts" />
namespace pxtsprite {
    import svg = pxt.svgUtil;
    import lf = pxt.Util.lf;

    export interface SideBarHost {
        setActiveTool(tool: PaintTool): void;
        setActiveColor(color: number): void;
        setToolWidth(width: number): void;
    }

    const TOOLBAR_WIDTH = 65;
    const INNER_BUTTON_MARGIN = 3;
    const PALETTE_BORDER_WIDTH = 1;
    const BUTTON_GROUP_SPACING = 3;
    const SELECTED_BORDER_WIDTH = 2;
    const COLOR_PREVIEW_HEIGHT = 30;
    const COLOR_MARGIN = 7;

    const TOOL_BUTTON_WIDTH = (TOOLBAR_WIDTH - INNER_BUTTON_MARGIN) / 2;
    const PALLETTE_SWATCH_WIDTH = (TOOLBAR_WIDTH - PALETTE_BORDER_WIDTH * 3) / 2;
    const TOOL_BUTTON_TOP = TOOLBAR_WIDTH / 3 + BUTTON_GROUP_SPACING;
    const PALETTE_TOP = TOOL_BUTTON_TOP + TOOL_BUTTON_WIDTH * 2 + INNER_BUTTON_MARGIN + COLOR_MARGIN;

    export class SideBar {
        root: svg.Group;
        host: SideBarHost;
        palette: string[];

        protected colorSwatches: svg.Rect[];
        protected pencilTool: Button;
        protected eraseTool: Button;
        protected rectangleTool: Button;
        protected fillTool: Button;

        protected sizeGroup: svg.Group;
        protected buttonGroup: svg.Group;
        protected paletteGroup: svg.Group;

        protected selectedTool: Button;
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
                this.selectedTool.removeClass("selected");
            }

            this.selectedTool = this.getButtonForTool(tool);

            if (this.selectedTool) {
                this.selectedTool.addClass("selected");
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
        }

        public setWidth(width: number) {
            this.root.scale(width / TOOLBAR_WIDTH);
        }

        public translate(left: number, top: number) {
            this.root.translate(left, top);
        }

        protected initSizes() {
            this.sizeGroup = this.root.group().id("sprite-editor-cursor-buttons");
            const buttonGroup = new CursorMultiButton(this.sizeGroup, TOOLBAR_WIDTH);
            buttonGroup.onSelected(index => {
                this.setCursorSize(1 + (index * 2));
            });
            // Sets the first button to show as selected
            buttonGroup.selected = 0;
            buttonGroup.buttons[0].setSelected(true);
        }

        protected initTools() {
            this.buttonGroup = this.root.group()
                .id("sprite-editor-tools")
                .translate(0, TOOL_BUTTON_TOP);

            this.pencilTool = this.initButton(lf("Pencil"), "\uf040", PaintTool.Normal);

            this.eraseTool = this.initButton(lf("Erase"), "\uf12d", PaintTool.Erase);
            this.eraseTool.translate(1 + TOOL_BUTTON_WIDTH + INNER_BUTTON_MARGIN, 0);

            this.fillTool = this.initButton(lf("Fill"), "\uf102", PaintTool.Fill, true);
            this.fillTool.translate(0, TOOL_BUTTON_WIDTH + INNER_BUTTON_MARGIN);

            this.rectangleTool = this.initButton(lf("Rectangle"), "\uf096", PaintTool.Rectangle);
            this.rectangleTool.translate(1 + TOOL_BUTTON_WIDTH + INNER_BUTTON_MARGIN, TOOL_BUTTON_WIDTH + INNER_BUTTON_MARGIN);

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
                swatch.title(`${i}`)

                this.colorSwatches.push(swatch);
            }

            this.setColor(0);
        }

        protected initButton(title: string, icon: string, tool: PaintTool, xicon = false) {
            const btn = xicon ? mkXIconButton(icon, TOOL_BUTTON_WIDTH) : mkIconButton(icon, TOOL_BUTTON_WIDTH);
            btn.title(title);
            btn.onClick(() => this.setTool(tool));
            this.buttonGroup.appendChild(btn.getElement());
            return btn;
        }

        getButtonForTool(tool: PaintTool) {
            switch (tool) {
                case PaintTool.Normal:
                case PaintTool.Line: return this.pencilTool;
                case PaintTool.Erase: return this.eraseTool;
                case PaintTool.Fill: return this.fillTool;
                case PaintTool.Rectangle:
                case PaintTool.Circle: return this.rectangleTool;
                default: return undefined;
            }
        }
    }
}