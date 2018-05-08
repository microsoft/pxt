/// <reference path="./grid.ts" />
/// <reference path="./bitmap.ts" />
/// <reference path="./tools.ts" />
/// <reference path="./toolbar.ts" />

namespace pxtblockly {
    import svg = pxt.svgUtil;
    import lf = pxt.Util.lf;

    // Absolute editor height
    const TOTAL_HEIGHT = 350;

    // Editor padding on all sides
    const PADDING = 8;

    const PADDING_BOTTOM = 3;

    // Height of toolbar (the buttons above the canvas)
    const TOOLBAR_HEIGHT = 55;

    // Spacing between the toolbar and the canvas
    const TOOLBAR_CANVAS_MARGIN = 5;

    // Height of the bar that displays editor size and info below the canvas
    const REPORTER_BAR_HEIGHT = 13;

    // Spacing between the canvas and reporter bar
    const REPORTER_BAR_CANVAS_MARGIN = 5;

    // Border width between palette swatches
    const PALETTE_INNER_BORDER = 2;

    // Border width around the outside of the palette
    const PALETTE_OUTER_BORDER = 3;

    // Spacing between palette and paint surface
    const PALETTE_CANVAS_MARGIN = 0;

    // Total allowed height of paint surface
    const CANVAS_HEIGHT = TOTAL_HEIGHT - TOOLBAR_HEIGHT - TOOLBAR_CANVAS_MARGIN
        - REPORTER_BAR_HEIGHT - REPORTER_BAR_CANVAS_MARGIN - PADDING * 2;

    export class SpriteEditor implements ToolbarHost {
        private group: svg.Group;
        private root: svg.SVG;

        private palette: ColorPalette;
        private paintSurface: CanvasGrid;
        private toolbar: Toolbar;
        private repoterBar: svg.Group;
        private cursorInfo: svg.Text;
        private canvasDimensions: svg.Text;

        private state: Bitmap;

        // When changing the size, keep the old bitmap around so that we can restore it
        private cachedState: Bitmap;

        private edit: Edit;
        private activeTool: PaintTool = PaintTool.Normal;
        private toolWidth = 1;
        private color = 1;

        private undoStack: Bitmap[] = [];
        private redoStack: Bitmap[] = [];

        private columns: number = 16;
        private rows: number = 16;
        private colors: string[];

        private width: number;
        private height: number;

        constructor(bitmap: Bitmap, protected lightMode = false) {
            this.colors = pxt.appTarget.runtime.palette.slice(1);

            this.columns = bitmap.width;
            this.rows = bitmap.height;

            this.state = bitmap.copy()

            this.root = new svg.SVG();
            this.group = this.root.group();
            this.makeTransparencyFill();

            this.palette = new ColorPalette({
                rowLength: 2,
                emptySwatchDisabled: false,
                cellClass: "palette-swatch",
                emptySwatchFill: 'url("#alpha-background")',
                outerMargin: PALETTE_OUTER_BORDER,
                columnMargin: PALETTE_INNER_BORDER,
                rowMargin: PALETTE_INNER_BORDER,
                backgroundFill: "black",
                colors: this.colors
            });
            this.palette.setRootId("sprite-editor-palette");

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

            this.group.appendChild(this.palette.getView());

            this.toolbar = new Toolbar(this.group.group(), {
                height: TOOLBAR_HEIGHT,
                width: CANVAS_HEIGHT,
                buttonMargin: 5,
                optionsMargin: 3,
                rowMargin: 5
            }, this);

            this.palette.setSelected(this.color);
            this.palette.onColorSelected(color => {
                this.setActiveColor(color);
            });
            this.setActiveColor(this.color);

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
                this.paintEdit(this.edit);
            }
        }

        render(el: HTMLDivElement): void {
            this.paintSurface.render(el);
            el.appendChild(this.root.el);
            this.layout();
            this.root.attr({ "width": this.outerWidth() + "px", "height": this.outerHeight() + "px" });
        }

        layout(): void {
            if (!this.root) {
                return;
            }

            const paintAreaTop = TOOLBAR_HEIGHT + TOOLBAR_CANVAS_MARGIN + PADDING;

            this.palette.setGridDimensions(CANVAS_HEIGHT);
            this.palette.translate(PADDING, paintAreaTop);

            const paintAreaLeft = PADDING + this.palette.outerWidth() + PALETTE_CANVAS_MARGIN;
            this.paintSurface.setGridDimensions(CANVAS_HEIGHT);
            this.paintSurface.updateBounds(paintAreaTop, paintAreaLeft, CANVAS_HEIGHT, CANVAS_HEIGHT);

            this.repoterBar.translate(paintAreaLeft, paintAreaTop + CANVAS_HEIGHT + REPORTER_BAR_CANVAS_MARGIN);
            this.canvasDimensions.at(CANVAS_HEIGHT - this.canvasDimensions.el.getComputedTextLength(), 0);

            this.width = paintAreaLeft + CANVAS_HEIGHT + PADDING;
            this.height = paintAreaTop + CANVAS_HEIGHT + PADDING_BOTTOM + REPORTER_BAR_CANVAS_MARGIN + REPORTER_BAR_HEIGHT;

            this.toolbar.translate(PADDING, PADDING);
            this.toolbar.setDimensions(this.width - PADDING * 2, TOOLBAR_HEIGHT);
        }

        rePaint() {
            this.paintSurface.repaint();
        }

        setActiveColor(color: number, setPalette = false) {
            if (setPalette) {
                this.palette.setSelected(color);
            }
            else {
                this.color = color;

                // If the user is erasing, go back to pencil
                if (this.activeTool === PaintTool.Erase) {
                    this.toolbar.resetTool();
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

            // Cursor doesn't affect fill, so switch to pencil
            if (this.activeTool === PaintTool.Fill) {
                this.toolbar.resetTool();
                this.activeTool = PaintTool.Normal;
            }
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
            this.columns = width;
            this.rows = height;

            this.state = resizeBitmap(this.cachedState, width, height);
            this.paintSurface.restore(this.state, true);
            this.canvasDimensions.text(`${this.columns}x${this.rows}`)
            this.layout();

            this.paintSurface.showOverlay();

            // Canvas size changed and some edits rely on that (like paint)
            this.edit = this.newEdit(this.color);
        }

        setSizePresets(presets: [number, number][]) {
            this.toolbar.setSizePresets(presets);
        }

        canvasWidth() {
            return this.columns;
        }

        canvasHeight() {
            return this.rows;
        }

        outerWidth() {
            return this.width;
        }

        outerHeight() {
            return this.height;
        }

        bitmap() {
            return this.state;
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
                this.paintSurface.repaint();
                this.edit.drawCursor(col, row, (c, r) => this.paintSurface.drawColor(c, r, this.edit.color));
            }
        }

        private setCursorInfo(col: number, row: number) {
            this.cursorInfo.text(`${col},${row}`);
        }

        private paintEdit(edit: Edit) {
            this.paintSurface.restore(this.state);
            this.paintSurface.applyEdit(edit);
        }

        private commit() {
            if (this.edit) {
                if (this.cachedState) {
                    this.cachedState = undefined;
                }
                this.pushState(true);
                this.paintEdit(this.edit);
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
            this.state.apply(bitmap);
            this.paintSurface.restore(bitmap, true);
        }

        private updateUndoRedo() {
            this.toolbar.setUndoState(this.undoStack.length > 0);
            this.toolbar.setRedoState(this.redoStack.length > 0);
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

        private makeTransparencyFill() {
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
        }
    }
}