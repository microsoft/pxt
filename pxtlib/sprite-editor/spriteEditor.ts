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

        private state: CanvasState;

        // When changing the size, keep the old bitmap around so that we can restore it
        private cachedState: CanvasState;

        private edit: Edit;
        private activeTool: PaintTool = PaintTool.Normal;
        private toolWidth = 1;
        public color = 1;

        private cursorCol = 0;
        private cursorRow = 0;

        private undoStack: CanvasState[] = [];
        private redoStack: CanvasState[] = [];

        private columns: number = 16;
        private rows: number = 16;
        private colors: string[];

        private shiftDown: boolean = false;
        private altDown: boolean = false;
        private mouseDown: boolean = false;

        private closeHandler: () => void;

        constructor(bitmap: Bitmap, blocksInfo: pxtc.BlocksInfo, protected lightMode = false, public scale = 1) {
            this.colors = pxt.appTarget.runtime.palette.slice(1);

            this.columns = bitmap.width;
            this.rows = bitmap.height;

            this.state = new CanvasState(bitmap.copy())

            this.root = new svg.SVG();
            this.root.setClass("sprite-canvas-controls");
            this.group = this.root.group();
            this.createDefs();

            this.paintSurface = new CanvasGrid(this.colors, this.state.copy(), this.lightMode, this.scale);

            this.paintSurface.drag((col, row) => {
                this.debug("gesture (" + PaintTool[this.activeTool] + ")");
                if (!this.altDown) {
                    this.setCell(col, row, this.color, false);
                }

                this.bottomBar.updateCursor(col, row);
            });

            this.paintSurface.up((col, row) => {
                this.debug("gesture end (" + PaintTool[this.activeTool] + ")");
                if (this.altDown) {
                    const color = this.state.image.get(col, row);
                    this.sidebar.setColor(color);
                } else {
                    this.paintSurface.onEditEnd(col, row, this.edit);
                    if (this.state.floatingLayer && !this.paintSurface.state.floatingLayer) {
                        this.pushState(true);
                        this.state = this.paintSurface.state.copy();
                        this.rePaint();
                    }
                    this.commit();
                    this.shiftAction();
                }

                this.mouseDown = false;
            });

            this.paintSurface.down((col, row) => {
                if (!this.altDown) {
                    this.setCell(col, row, this.color, false);
                }
                this.mouseDown = true;
            });

            this.paintSurface.move((col, row) => {
                this.drawCursor(col, row);
                this.shiftAction()
                this.bottomBar.updateCursor(col, row);
            });

            this.paintSurface.leave(() => {
                if (this.edit) {
                    this.rePaint();
                    if (this.edit.isStarted && !this.shiftDown) {
                        this.commit();
                    }
                }
                this.bottomBar.hideCursor();
            });

            this.sidebar = new SideBar(['url("#alpha-background")'].concat(this.colors), this, this.group);
            this.sidebar.setColor(this.colors.length >= 3 ? 3 : 1); // colors omits 0

            this.header = new SpriteHeader(this);
            this.gallery = new Gallery(blocksInfo);
            this.bottomBar = new ReporterBar(this.group, this, REPORTER_BAR_HEIGHT);

            this.updateUndoRedo();

            // Sets canvas scale
            this.scale = scale;
        }

        setSidebarColor(color: number) {
            this.sidebar.setColor(color);
        }

        setCell(col: number, row: number, color: number, commit: boolean): void {
            if (commit) {
                this.state.image.set(col, row, color);
                this.paintCell(col, row, color);
            }
            else if (this.edit) {
                if (!this.edit.isStarted) {
                    this.paintSurface.onEditStart(col, row, this.edit);

                    if (this.state.floatingLayer && !this.paintSurface.state.floatingLayer) {
                        this.pushState(true);
                        this.state = this.paintSurface.state.copy();
                    }
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
            else if (this.color != color) {
                this.color = color;

                // If the user is erasing, go back to pencil
                if (this.activeTool === PaintTool.Erase) {
                    this.sidebar.setTool(PaintTool.Normal);
                } else {
                    this.updateEdit();
                }
            }
        }

        setActiveTool(tool: PaintTool) {
            if (this.activeTool != tool) {
                this.activeTool = tool;
                this.updateEdit()
            }
        }

        setToolWidth(width: number) {
            if (this.toolWidth != width) {
                this.toolWidth = width;
                this.updateEdit();
            }
        }

        initializeUndoRedo(undoStack: CanvasState[], redoStack: CanvasState[]) {
            if (undoStack) {
                this.undoStack = undoStack;
            }
            if (redoStack) {
                this.redoStack = redoStack;
            }
            this.updateUndoRedo();
        }

        getUndoStack() {
            return this.undoStack.slice();
        }

        getRedoStack() {
            return this.redoStack.slice();
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
            this.state.image = resizeBitmap(this.cachedState.image, width, height);
            this.afterResize(true);
        }

        setSizePresets(presets: [number, number][]) {
            this.bottomBar.setSizePresets(presets, this.columns, this.rows);
        }

        setGalleryFilter(filter: string) {
            this.gallery.setFilter(filter);
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
                    this.restore(new CanvasState(result));
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
                const ch = this.closeHandler;
                this.closeHandler = undefined;
                ch();
            }
            if (this.state.floatingLayer) {
                this.state.mergeFloatingLayer();
                this.pushState(true);
            }
        }

        onClose(handler: () => void) {
            this.closeHandler = handler;
        }

        switchIconTo(tool: PaintTool) {
            if (this.activeTool === tool) return;

            const btn = this.sidebar.getButtonForTool(tool) as TextButton;

            switch (tool) {
                case PaintTool.Rectangle:
                    updateIcon(btn, "\uf096", lf("Rectangle"));
                    break;
                case PaintTool.Circle:
                    updateIcon(btn, "\uf10c", lf("Circle"));
                    break;
                case PaintTool.Normal:
                    updateIcon(btn, "\uf040", lf("Pencil"));
                    break;
                case PaintTool.Line:
                    updateIcon(btn, "\uf07e", lf("Line"));
                    break;
                default:  // no alternate icon, do not change
                    return;
            }

            btn.onClick(() => {
                if (tool != PaintTool.Circle && tool != PaintTool.Line) {
                    this.setIconsToDefault();
                    this.sidebar.setTool(tool);
                }
            });

            function updateIcon(button: TextButton, text: string, title: string) {
                const shortcut = getPaintToolShortcut(tool);

                button.setText(text);
                button.title(title);
                button.shortcut(shortcut);
            }
        }

        setIconsToDefault() {
            this.switchIconTo(PaintTool.Rectangle);
            this.switchIconTo(PaintTool.Normal);
        }

        private keyDown = (event: KeyboardEvent) => {
            if (event.keyCode == 16) { // Shift
                this.shiftDown = true;
                this.shiftAction();
            }

            if (event.keyCode === 18) { // Alt
                this.discardEdit();
                this.paintSurface.setEyedropperMouse(true);
                this.altDown = true;
            }

            if (this.state.floatingLayer) {
                let didSomething = true;

                switch (event.keyCode) {
                    case 8: // backspace
                    case 46: // delete
                        event.preventDefault();
                        event.stopPropagation();
                        this.state.floatingLayer = undefined;
                        break;
                    case 37: // Left arrow
                        this.state.layerOffsetX--;
                        break;
                    case 38: // Up arrow
                        this.state.layerOffsetY--;
                        break;
                    case 39: // Right arrow
                        this.state.layerOffsetX++;
                        break;
                    case 40: // Down arrow
                        this.state.layerOffsetY++;
                        break;
                    default:
                        didSomething = false;
                }

                if (didSomething) {
                    this.updateEdit();
                    this.pushState(true);
                    this.paintSurface.restore(this.state, true);
                }
            }

            const tools = [
                PaintTool.Fill,
                PaintTool.Normal,
                PaintTool.Rectangle,
                PaintTool.Erase,
                PaintTool.Circle,
                PaintTool.Line,
                PaintTool.Marquee
            ]

            tools.forEach(tool => {
                if (event.key === getPaintToolShortcut(tool)) {
                    this.setIconsToDefault();
                    this.switchIconTo(tool);
                    this.sidebar.setTool(tool);
                }
            });

            const zeroKeyCode = 48;
            const nineKeyCode = 57;

            if (event.keyCode >= zeroKeyCode && event.keyCode <= nineKeyCode) {
                let color = event.keyCode - zeroKeyCode;
                if (this.shiftDown) {
                    color += 9;
                }
                if (color <= this.colors.length) { // colors omits 0
                    this.sidebar.setColor(color);
                }
            }
        }

        private keyUp = (event: KeyboardEvent) => {
            // If not drawing a circle, switch back to Rectangle and Pencil
            if (event.keyCode === 16) { // Shift
                this.shiftDown = false;
                this.clearShiftAction();
            } else if (event.keyCode === 18) { // Alt
                this.altDown = false;
                this.paintSurface.setEyedropperMouse(false);
                this.updateEdit();
            }
        }

        private undoRedoEvent = (event: KeyboardEvent) => {
            const controlOrMeta = event.ctrlKey || event.metaKey; // ctrl on windows, meta on mac
            if (event.key === "Undo" || (controlOrMeta && event.key === "z")) {
                this.undo();
                event.preventDefault();
                event.stopPropagation();
            } else if (event.key === "Redo" || (controlOrMeta && event.key === "y")) {
                this.redo();
                event.preventDefault();
                event.stopPropagation();
            }
        }

        addKeyListeners() {
            document.addEventListener("keydown", this.keyDown);
            document.addEventListener("keyup", this.keyUp);
            document.addEventListener("keydown", this.undoRedoEvent, true);
        }

        removeKeyListeners() {
            document.removeEventListener("keydown", this.keyDown);
            document.removeEventListener("keyup", this.keyUp);
            document.removeEventListener("keydown", this.undoRedoEvent, true);
            this.paintSurface.removeMouseListeners();
        }

        private afterResize(showOverlay: boolean) {
            this.columns = this.state.width;
            this.rows = this.state.height;
            this.paintSurface.restore(this.state, true);
            this.bottomBar.updateDimensions(this.columns, this.rows);
            this.layout();

            if (showOverlay) this.paintSurface.showResizeOverlay();

            // Canvas size changed and some edits rely on that (like paint)
            this.updateEdit();
        }

        private drawCursor(col: number, row: number) {
            if (this.edit) {
                this.paintSurface.drawCursor(this.edit, col, row);
            }
        }

        private paintEdit(edit: Edit, col: number, row: number, gestureEnd = false) {
            this.paintSurface.restore(this.state);
            this.paintSurface.applyEdit(edit, col, row, gestureEnd);
        }

        private commit() {
            if (this.edit) {
                if (this.cachedState) {
                    this.cachedState = undefined;
                }
                this.pushState(true);
                this.paintEdit(this.edit, this.cursorCol, this.cursorRow, true);
                this.state = this.paintSurface.state.copy();
                this.updateEdit();
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

        private discardEdit() {
            if (this.edit) {
                this.edit = undefined;
                this.rePaint();
            }
        }

        private updateEdit() {
            if (!this.altDown) {
                this.edit = this.newEdit();
            }
        }

        private restore(state: CanvasState) {
            if (state.width !== this.state.width || state.height !== this.state.height) {
                this.state = state;
                this.afterResize(false);
            }
            else {
                this.state = state.copy();
                this.paintSurface.restore(state, true);
            }
        }

        private updateUndoRedo() {
            this.bottomBar.updateUndoRedo(this.undoStack.length === 0, this.redoStack.length === 0)
        }

        private paintCell(col: number, row: number, color: number) {
            this.paintSurface.writeColor(col, row, color);
        }

        private newEdit() {
            switch (this.activeTool) {
                case PaintTool.Normal:
                    return new PaintEdit(this.columns, this.rows, this.color, this.toolWidth);
                case PaintTool.Rectangle:
                    return new OutlineEdit(this.columns, this.rows, this.color, this.toolWidth);
                case PaintTool.Outline:
                    return new OutlineEdit(this.columns, this.rows, this.color, this.toolWidth);
                case PaintTool.Line:
                    return new LineEdit(this.columns, this.rows, this.color, this.toolWidth);
                case PaintTool.Circle:
                    return new CircleEdit(this.columns, this.rows, this.color, this.toolWidth);
                case PaintTool.Erase:
                    return new PaintEdit(this.columns, this.rows, 0, this.toolWidth);
                case PaintTool.Fill:
                    return new FillEdit(this.columns, this.rows, this.color, this.toolWidth);
                case PaintTool.Marquee:
                    return new MarqueeEdit(this.columns, this.rows, this.color, this.toolWidth);
            }
        }

        private shiftAction() {
            if (!this.shiftDown || this.altDown)
                return;

            switch (this.activeTool) {
                case PaintTool.Line:
                case PaintTool.Rectangle:
                case PaintTool.Circle:
                    this.setCell(this.paintSurface.mouseCol, this.paintSurface.mouseRow, this.color, false);
                    break;
            }
        }

        private clearShiftAction() {
            if (this.mouseDown)
                return;

            switch (this.activeTool) {
                case PaintTool.Line:
                case PaintTool.Rectangle:
                case PaintTool.Circle:
                    this.updateEdit();
                    this.paintSurface.restore(this.state, true);
                    break;
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