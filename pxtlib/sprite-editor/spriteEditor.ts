/// <reference path="./bitmap.ts" />
/// <reference path="./tools.ts" />
/// <reference path="./reporterBar.ts" />
/// <reference path="./sidebar.ts" />
/// <reference path="./gallery.ts" />
/// <reference path="./header.ts" />

namespace pxtsprite {
    import svg = pxt.svgUtil;
    import lf = pxt.Util.lf;

    export const TOTAL_HEIGHT = 500;

    const PADDING = 10;

    const DROP_DOWN_PADDING = 4;

    // Height of toolbar (the buttons above the canvas)
    export const HEADER_HEIGHT = 50;

    // Spacing between the toolbar and the canvas
    const HEADER_CANVAS_MARGIN = 10;

    // Height of the bar that displays editor size and info below the canvas
    const REPORTER_BAR_HEIGHT = 31;

    // Spacing between the canvas and reporter bar
    const REPORTER_BAR_CANVAS_MARGIN = 5;

    // Spacing between palette and paint surface
    const SIDEBAR_CANVAS_MARGIN = 10;

    const SIDEBAR_WIDTH = 65;

    // Total allowed height of paint surface
    const CANVAS_HEIGHT = TOTAL_HEIGHT - HEADER_HEIGHT - HEADER_CANVAS_MARGIN
        - REPORTER_BAR_HEIGHT - REPORTER_BAR_CANVAS_MARGIN - PADDING + DROP_DOWN_PADDING * 2;

    const WIDTH = PADDING + SIDEBAR_WIDTH + SIDEBAR_CANVAS_MARGIN + CANVAS_HEIGHT + PADDING - DROP_DOWN_PADDING * 2;


    export class SpriteEditor implements SideBarHost, SpriteHeaderHost {
        private group: svg.Group;
        private root: svg.SVG;

        private paintSurface: CanvasGrid;
        private sidebar: SideBar;
        private header: SpriteHeader;
        private bottomBar: ReporterBar;
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


        private shiftDown: boolean = false;
        private mouseDown: boolean = false;

        private closeHandler: () => void;

        constructor(bitmap: Bitmap, blocksInfo: pxtc.BlocksInfo, protected lightMode = false) {
            this.colors = pxt.appTarget.runtime.palette.slice(1);

            this.columns = bitmap.width;
            this.rows = bitmap.height;

            this.state = bitmap.copy()

            this.root = new svg.SVG();
            this.root.setClass("sprite-canvas-controls");
            this.group = this.root.group();
            this.createDefs();

            this.paintSurface = new CanvasGrid(this.colors, this.state.copy(), this.lightMode);

            this.paintSurface.drag((col, row) => {
                this.debug("gesture (" + PaintTool[this.activeTool] + ")");
                this.setCell(col, row, this.color, false);
                this.bottomBar.updateCursor(col, row);
            });

            this.paintSurface.up((col, row) => {
                this.debug("gesture end (" + PaintTool[this.activeTool] + ")");
                this.commit();
                this.mouseDown = false;
                if (this.activeTool == PaintTool.Circle && !this.shiftDown) {
                    this.switchIconBack(PaintTool.Rectangle);
                }
                if (this.activeTool == PaintTool.Line && !this.shiftDown) {
                    this.switchIconBack(PaintTool.Normal);
                }
            });

            this.paintSurface.down((col, row) => {
                this.setCell(col, row, this.color, false);
                this.mouseDown = true;
            });

            this.paintSurface.move((col, row) => {
                this.drawCursor(col, row);
                this.bottomBar.updateCursor(col, row);
            });

            this.paintSurface.leave(() => {
                if (this.edit) {
                    this.paintSurface.repaint();
                }
                if (this.edit.isStarted) {
                    this.commit();
                }
                this.bottomBar.hideCursor();
            });

            this.sidebar = new SideBar(['url("#alpha-background")'].concat(this.colors), this, this.group);
            this.sidebar.setColor(1);

            this.header = new SpriteHeader(this);
            this.gallery = new Gallery(blocksInfo);
            this.bottomBar = new ReporterBar(this.group, this, REPORTER_BAR_HEIGHT);

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

            // The width of the palette + editor
            const paintAreaTop = HEADER_HEIGHT + HEADER_CANVAS_MARGIN;
            const paintAreaLeft = PADDING + SIDEBAR_WIDTH + SIDEBAR_CANVAS_MARGIN;

            this.sidebar.translate(PADDING, paintAreaTop);
            this.paintSurface.updateBounds(paintAreaTop, paintAreaLeft, CANVAS_HEIGHT, CANVAS_HEIGHT);
            this.bottomBar.layout(paintAreaTop + CANVAS_HEIGHT + REPORTER_BAR_CANVAS_MARGIN, paintAreaLeft, CANVAS_HEIGHT);

            this.gallery.layout(0, HEADER_HEIGHT, TOTAL_HEIGHT - HEADER_HEIGHT);
            this.header.layout();
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
                    this.sidebar.setTool(PaintTool.Normal);
                } else {
                    this.edit = this.newEdit(this.color);
                }
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

                // The current state is at the top of the stack unless the user has pressed redo, so
                // we need to discard it
                if (todo.equals(this.state)) {
                    this.undo();
                    return;
                }
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
            this.bottomBar.setSizePresets(presets, this.columns, this.rows);
        }

        canvasWidth() {
            return this.columns;
        }

        canvasHeight() {
            return this.rows;
        }

        outerWidth() {
            return WIDTH;
        }

        outerHeight() {
            return TOTAL_HEIGHT;
        }

        bitmap() {
            return this.state;
        }

        showGallery() {
            this.gallery.show((result: Bitmap, err?: string) => {
                if (err && err !== "cancelled") {
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

        closeEditor() {
            if (this.closeHandler) {
                this.closeHandler();
            }
        }

        onClose(handler: () => void) {
            this.closeHandler = handler;
        }

        switchIconBack(tool: PaintTool) {
            let btn = (this.sidebar.getButtonForTool(tool) as TextButton);
            if (tool == PaintTool.Rectangle) {
                //Change icon back to square
                btn.setText("\uf096");
                btn.title(lf("Rectangle"));
            } else if (tool == PaintTool.Normal) {
                //Change icon back to pencil
                btn.setText("\uf040");
                btn.title(lf("Pencil"));
            }
            btn.onClick(() => this.sidebar.setTool(tool));
            if ((this.activeTool == PaintTool.Circle && tool == PaintTool.Rectangle)
                    || (this.activeTool == PaintTool.Line && tool == PaintTool.Normal)) {
                this.setActiveTool(tool);
            }
        }

        private keyDown = (event: KeyboardEvent) => {
            if (event.keyCode == 16) { // Shift
                if (!this.shiftDown) {
                    let btn = (this.sidebar.getButtonForTool(PaintTool.Normal) as TextButton);
                    btn.setText("\uf07e");
                    btn.title(lf("Line"));
                    btn.onClick(() => this.sidebar.setTool(PaintTool.Line));
                    if (this.activeTool == PaintTool.Normal) {
                        this.setActiveTool(PaintTool.Line);
                    }
                    btn = (this.sidebar.getButtonForTool(PaintTool.Rectangle) as TextButton);
                    btn.setText("\uf10c");
                    btn.title(lf("Circle"));
                    btn.onClick(() => this.sidebar.setTool(PaintTool.Circle));
                    if (this.activeTool == PaintTool.Rectangle) {
                        this.setActiveTool(PaintTool.Circle);
                    }
                }
                this.shiftDown = true;
            }

        }

        private keyUp = (event: KeyboardEvent) => {
            // If not drawing a circle, switch back to Rectangle and Pencil
            if (event.keyCode == 16) { // Shift
                this.shiftDown = false;
                if (this.mouseDown) {
                    if (this.activeTool != PaintTool.Line) {
                        this.switchIconBack(PaintTool.Normal);
                    }
                    if (this.activeTool != PaintTool.Circle) {
                        this.switchIconBack(PaintTool.Rectangle);
                    }
                } else {
                    this.switchIconBack(PaintTool.Normal);
                    this.switchIconBack(PaintTool.Rectangle);
                }
            }
        }

        addKeyListeners() {
            document.addEventListener("keydown", this.keyDown);
            document.addEventListener("keyup", this.keyUp);
        }

        removeKeyListeners() {
            document.removeEventListener("keydown", this.keyDown);
            document.removeEventListener("keyup", this.keyUp);
            this.paintSurface.removeMouseListeners();
        }

        private afterResize(showOverlay: boolean) {
            this.columns = this.state.width;
            this.rows = this.state.height;
            this.paintSurface.restore(this.state, true);
            this.bottomBar.updateDimensions(this.columns, this.rows);
            this.layout();

            if (showOverlay) this.paintSurface.showOverlay();

            // Canvas size changed and some edits rely on that (like paint)
            this.edit = this.newEdit(this.color);
        }

        private drawCursor(col: number, row: number) {
            if (this.edit) {
                this.paintSurface.drawCursor(this.edit, col, row);
            }
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
            const stack = undo ? this.undoStack : this.redoStack;
            if (stack.length && this.state.equals(stack[stack.length - 1])) {
                // Don't push empty commits
                return;
            }

            stack.push(this.state.copy());
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
            this.bottomBar.updateUndoRedo(this.undoStack.length === 0, this.redoStack.length === 0)
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
        }
    }
}