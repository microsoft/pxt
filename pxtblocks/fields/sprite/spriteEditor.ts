/// <reference path="./bitmap.ts" />
/// <reference path="./tools.ts" />
/// <reference path="./toolbar.ts" />

namespace pxtblockly {
    import svg = pxt.svgUtil;
    import lf = pxt.Util.lf;

    // Absolute editor height
    const TOTAL_HEIGHT = 500;

    const TOTAL_WIDTH = 500;

    // Editor padding on all sides
    const PADDING = 8;

    const PADDING_BOTTOM = 3;

    // Height of toolbar (the buttons above the canvas)
    const TOOLBAR_HEIGHT = 50;

    // Spacing between the toolbar and the canvas
    const TOOLBAR_CANVAS_MARGIN = 10;

    // Height of the bar that displays editor size and info below the canvas
    const REPORTER_BAR_HEIGHT = 13;

    // Spacing between the canvas and reporter bar
    const REPORTER_BAR_CANVAS_MARGIN = 5;

    // Spacing between palette and paint surface
    const PALETTE_CANVAS_MARGIN = 10;

    // Total allowed height of paint surface
    const CANVAS_HEIGHT = TOTAL_HEIGHT - TOOLBAR_HEIGHT - TOOLBAR_CANVAS_MARGIN
        - REPORTER_BAR_HEIGHT - REPORTER_BAR_CANVAS_MARGIN - PADDING * 2;

    const SIDEBAR_WIDTH = 65;

    export class SpriteEditor implements SideBarHost, SpriteHeaderHost {
        private group: svg.Group;
        private root: svg.SVG;

        private paintSurface: CanvasGrid;
        private repoterBar: svg.Group;
        private cursorInfo: svg.Text;
        private canvasDimensions: svg.Text;
        private sidebar: SideBar;
        private header: SpriteHeader;
        private gallery: Gallery;

        private state: Bitmap;

        // When changing the size, keep the old bitmap around so that we can restore it
        private cachedState: Bitmap;

        private edit: Edit;
        private activeTool: PaintTool = PaintTool.Normal;
        private toolWidth = 1;
        private color = 1;

        private cursorCol = 0;
        private cursorRow = 0;

        private undoStack: Bitmap[] = [];
        private redoStack: Bitmap[] = [];

        private columns: number = 16;
        private rows: number = 16;
        private colors: string[];

        private height: number;

        constructor(bitmap: Bitmap, blocksInfo: pxtc.BlocksInfo, protected lightMode = false) {
            this.colors = pxt.appTarget.runtime.palette.slice(1);

            this.columns = bitmap.width;
            this.rows = bitmap.height;

            this.state = bitmap.copy()

            this.root = new svg.SVG();
            this.group = this.root.group();
            this.createDefs();

            this.paintSurface = new CanvasGrid(this.colors, this.state.copy(), this.lightMode);

            this.paintSurface.drag((col, row) => {
                this.debug("gesture (" + PaintTool[this.activeTool] + ")");
                this.setCell(col, row, this.color, false);
                this.setCursorInfo(col, row);
            });

            this.paintSurface.up((col, row) => {
                this.debug("gesture end (" + PaintTool[this.activeTool] + ")");
                this.commit();
            });

            this.paintSurface.down((col, row) => {
                this.setCell(col, row, this.color, false);
            });

            this.paintSurface.move((col, row) => {
                this.drawCursor(col, row);
                this.setCursorInfo(col, row);
            });

            this.paintSurface.leave(() => {
                if (this.edit) {
                    this.paintSurface.repaint();
                }
                if (this.edit.isStarted) {
                    this.commit();
                }
                this.cursorInfo.text("");
            });

            this.sidebar = new SideBar(['url("#alpha-background")'].concat(this.colors), this, this.group);
            this.sidebar.setColor(1);

            this.header = new SpriteHeader(this);
            this.gallery = new Gallery(blocksInfo);

            this.drawReporterBar();
            this.updateUndoRedo();

            document.addEventListener("keydown", ev => {
                if (ev.key === "Undo" || (ev.ctrlKey && ev.key === "z")) {
                    this.undo();
                }
                else if (ev.key === "Redo" || (ev.ctrlKey && ev.key === "y")) {
                    this.redo();
                }
            });
        }

        setCell(col: number, row: number, color: number, commit: boolean): void {
            if (commit) {
                this.state.set(col, row, color);
                this.paintCell(col, row, color);
            }
            else {
                if (!this.edit.isStarted) {
                    this.edit.start(col, row);
                }
                this.edit.update(col, row);
                this.cursorCol = col;
                this.cursorRow = row;
                this.paintEdit(this.edit, col, row);
            }
        }

        render(el: HTMLDivElement): void {
            el.appendChild(this.header.getElement());
            el.appendChild(this.gallery.getElement());
            this.paintSurface.render(el);
            el.appendChild(this.root.el);
            this.layout();
            this.root.attr({ "width": this.outerWidth() + "px", "height": this.outerHeight() + "px" });
            this.root.el.style.position = "absolute";
            this.root.el.style.top = "0px";
            this.root.el.style.left = "0px";
        }

        layout(): void {
            if (!this.root) {
                return;
            }

            this.paintSurface.setGridDimensions(CANVAS_HEIGHT);
            // this.sidebar.setWidth(SIDEBAR_WIDTH);

            // The width of the palette + editor
            const editorWidth = SIDEBAR_WIDTH + PALETTE_CANVAS_MARGIN + CANVAS_HEIGHT;
            const editorLeft = Math.floor((TOTAL_WIDTH / 2) - (editorWidth / 2));
            const paintAreaTop = TOOLBAR_HEIGHT + TOOLBAR_CANVAS_MARGIN;
            const paintAreaLeft = editorLeft + SIDEBAR_WIDTH + PALETTE_CANVAS_MARGIN;

            this.sidebar.translate(editorLeft, paintAreaTop);
            this.paintSurface.updateBounds(paintAreaTop, paintAreaLeft, CANVAS_HEIGHT, CANVAS_HEIGHT);
            this.repoterBar.translate(paintAreaLeft, paintAreaTop + CANVAS_HEIGHT + REPORTER_BAR_CANVAS_MARGIN);
            this.canvasDimensions.at(CANVAS_HEIGHT - this.canvasDimensions.el.getComputedTextLength(), 0);

            this.gallery.layout(0, TOOLBAR_HEIGHT, TOTAL_HEIGHT - TOOLBAR_HEIGHT);
            this.header.layout();

            this.height = paintAreaTop + CANVAS_HEIGHT + PADDING_BOTTOM + REPORTER_BAR_CANVAS_MARGIN + REPORTER_BAR_HEIGHT;
        }

        rePaint() {
            this.paintSurface.repaint();
        }

        setActiveColor(color: number, setPalette = false) {
            if (setPalette) {
            }
            else {
                this.color = color;

                // If the user is erasing, go back to pencil
                if (this.activeTool === PaintTool.Erase) {
                    this.activeTool = PaintTool.Normal;
                }

                this.edit = this.newEdit(this.color);
            }
        }

        setActiveTool(tool: PaintTool) {
            this.activeTool = tool;
            this.edit = this.newEdit(this.color)
        }

        setToolWidth(width: number) {
            this.toolWidth = width;
            this.edit = this.newEdit(this.color);
        }

        undo() {
            if (this.undoStack.length) {
                this.debug("undo");
                const todo = this.undoStack.pop();
                this.pushState(false);
                this.restore(todo);
            }
            this.updateUndoRedo();
        }

        redo() {
            if (this.redoStack.length) {
                this.debug("redo");
                const todo = this.redoStack.pop();
                this.pushState(true);
                this.restore(todo);
            }
            this.updateUndoRedo();
        }

        resize(width: number, height: number) {
            if (!this.cachedState) {
                this.cachedState = this.state.copy();
                this.undoStack.push(this.cachedState)
                this.redoStack = [];
            }
            this.state = resizeBitmap(this.cachedState, width, height);
            this.afterResize(true);
        }

        setSizePresets(presets: [number, number][]) {
            // this.toolbar.setSizePresets(presets);
        }

        canvasWidth() {
            return this.columns;
        }

        canvasHeight() {
            return this.rows;
        }

        outerWidth() {
            return TOTAL_WIDTH;
        }

        outerHeight() {
            return this.height;
        }

        bitmap() {
            return this.state;
        }

        showGallery() {
            this.gallery.show((result: Bitmap, err?: string) => {
                if (err) {
                    console.error(err);
                }
                else if (result) {
                    this.redoStack = [];
                    this.pushState(true);
                    this.restore(result);
                    this.hideGallery();
                    this.header.toggle.toggle(true);
                }
            });
        }

        hideGallery() {
            this.gallery.hide();
        }

        private afterResize(showOverlay: boolean) {
            this.columns = this.state.width;
            this.rows = this.state.height;
            this.paintSurface.restore(this.state, true);
            this.canvasDimensions.text(`${this.columns}x${this.rows}`)
            this.layout();

            if (showOverlay) this.paintSurface.showOverlay();

            // Canvas size changed and some edits rely on that (like paint)
            this.edit = this.newEdit(this.color);
        }

        protected drawReporterBar() {
            this.repoterBar = this.group.group();
            this.canvasDimensions = this.repoterBar.draw("text")
                .fontSize(REPORTER_BAR_HEIGHT, svg.LengthUnit.px)
                .fontFamily("monospace")
                .fill("white")
                .offset(0, 0.8, svg.LengthUnit.em)
                .text(`${this.columns}x${this.rows}`);

            this.cursorInfo = this.repoterBar.draw("text")
                .fontSize(REPORTER_BAR_HEIGHT, svg.LengthUnit.px)
                .fontFamily("monospace")
                .offset(0, 0.8, svg.LengthUnit.em)
                .fill("white");
        }

        private drawCursor(col: number, row: number) {
            if (this.edit) {
                this.paintSurface.drawCursor(this.edit, col, row);
            }
        }

        private setCursorInfo(col: number, row: number) {
            this.cursorInfo.text(`${col},${row}`);
        }

        private paintEdit(edit: Edit, col: number, row: number) {
            this.paintSurface.restore(this.state);
            this.paintSurface.applyEdit(edit, col, row);
        }

        private commit() {
            if (this.edit) {
                if (this.cachedState) {
                    this.cachedState = undefined;
                }
                this.pushState(true);
                this.paintEdit(this.edit, this.cursorCol, this.cursorRow);
                this.state.apply(this.paintSurface.image);
                this.edit = this.newEdit(this.color);
                this.redoStack = [];
            }
        }

        private pushState(undo: boolean) {
            const cp = this.state.copy();
            if (undo) {
                this.undoStack.push(cp);
            }
            else {
                this.redoStack.push(cp);
            }
            this.updateUndoRedo();
        }

        private restore(bitmap: Bitmap) {
            if (bitmap.width !== this.state.width || bitmap.height !== this.state.height) {
                this.state = bitmap;
                this.afterResize(false);
            }
            else {
                this.state.apply(bitmap);
                this.paintSurface.restore(bitmap, true);
            }
        }

        private updateUndoRedo() {
            this.header.setUndoState(this.undoStack.length > 0);
            this.header.setRedoState(this.redoStack.length > 0);
        }

        private paintCell(col: number, row: number, color: number) {
            this.paintSurface.writeColor(col, row, color);
        }

        private newEdit(color: number) {
            switch (this.activeTool) {
                case PaintTool.Normal: return new PaintEdit(this.columns, this.rows, color, this.toolWidth);
                case PaintTool.Rectangle: return new OutlineEdit(this.columns, this.rows, color, this.toolWidth);
                case PaintTool.Outline: return new OutlineEdit(this.columns, this.rows, color, this.toolWidth);
                case PaintTool.Line: return new LineEdit(this.columns, this.rows, color, this.toolWidth);
                case PaintTool.Circle: return new CircleEdit(this.columns, this.rows, color, this.toolWidth);
                case PaintTool.Erase: return new PaintEdit(this.columns, this.rows, 0, this.toolWidth);
                case PaintTool.Fill: return new FillEdit(this.columns, this.rows, color, this.toolWidth);
            }
        }

        private debug(msg: string) {
            // if (this.debugText) {
            //     this.debugText.text("DEBUG: " + msg);
            // }
        }

        private createDefs() {
            this.root.define(defs => {
                const p = defs.create("pattern", "alpha-background")
                    .size(10, 10)
                    .units(svg.PatternUnits.userSpaceOnUse);

                p.draw("rect")
                    .at(0, 0)
                    .size(10, 10)
                    .fill("white");
                p.draw("rect")
                    .at(0, 0)
                    .size(5, 5)
                    .fill("#dedede");
                p.draw("rect")
                    .at(5, 5)
                    .size(5, 5)
                    .fill("#dedede");
            })

            // This is used for detecting when text nodes are in the dom.
            // getComputedTextLength() requires the node to be in the dom so
            // by listening when this animation begins we can tell if the
            // node is rendered or not
            this.group.style().content(`
            @keyframes dom-test {
                0% {
                    transform: translateX(0px);
                }
                100% {
                    transform: translateX(0px);
                }
            }
            `);
        }
    }
}