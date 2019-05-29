/// <reference path="./melodyArray.ts" />
/// <reference path="./bottomBar.ts" />
/// <reference path="./gallery.ts" />
/// <reference path="./topBar.ts" />

namespace pxtmelody {
    import svg = pxt.svgUtil;

    export const TOTAL_HEIGHT = 500;

    const PADDING = 10;
    const DROP_DOWN_PADDING = 4;

    // Height of toolbar (the buttons above the canvas)
    export const HEADER_HEIGHT = 50;
    // Spacing between the toolbar and the canvas
    const HEADER_CANVAS_MARGIN = 10;
    // Height of bottom bar which displays name, play, and done
    const BOTTOM_BAR_HEIGHT = 31;
    // Spacing between the canvas and the bottom bar
    const BOTTOM_BAR_CANVAS_MARGIN = 5;

    // Total allowed height of melody surface
    const CANVAS_HEIGHT = TOTAL_HEIGHT - HEADER_HEIGHT - HEADER_CANVAS_MARGIN
        - BOTTOM_BAR_HEIGHT - BOTTOM_BAR_CANVAS_MARGIN - PADDING + DROP_DOWN_PADDING * 2;

        const WIDTH = PADDING  + CANVAS_HEIGHT + PADDING - DROP_DOWN_PADDING * 2;

    export class MelodyEditor implements TopBarHost {
        
        private group: svg.Group;
        private root: svg.SVG;
        
        private selectionSurface: MelodyGrid; // rename selectionSurface
        private bottomBar: BottomBar;
        private header: TopBar;
        private gallery: Gallery;

        private state: boolean [][];
        private melody: MelodyArray;

        // When changing the size, keep the old array around so that we can restore it
        private cachedState: boolean [][];
        
        private columns: number = 8;
        private rows: number = 9;
        private colors: string[];

        private shiftDown: boolean = false;
        private altDown: boolean = false;
        private mouseDown: boolean = false;

        private closeHandler: () => void;
    
        // constructor
        constructor(melody: MelodyArray, blocksInfo: pxtc.BlocksInfo, protected lightMode = false) {
            this.melody = melody;
            this.state = melody.getArray();
            this.colors = pxt.appTarget.runtime.palette.slice(1);

            this.columns = melody.getWidth();
            this.rows = melody.getHeight();

            this.state = melody.getArray();

            this.root = new svg.SVG();
            this.root.setClass("sprite-canvas-controls");
            this.group = this.root.group();
            this.createDefs();

            this.selectionSurface = new MelodyGrid(this.copy(), this.lightMode);

            this.selectionSurface.drag((col, row) => {
                //this.debug("gesture (" + PaintTool[this.activeTool] + ")");
                if (!this.altDown) {
                    this.setCell(col, row, 1, false); // third parameter is color
                }
                this.bottomBar.updateCursor(col, row);
            });

            this.selectionSurface.up((col, row) => {
               // this.debug("gesture end (" + PaintTool[this.activeTool] + ")");
                if (this.altDown) {
                    const color = 1; //this.state.get(col, row);
                   // this.sidebar.setColor(color);
                } else {
                   // this.commit();
                    this.shiftAction();
                }

                this.mouseDown = false;
            });

            this.selectionSurface.down((col, row) => {
                if (!this.altDown) {
                    this.setCell(col, row, 1, false); // third parameter is color
                }
                this.mouseDown = true;
            });

            this.selectionSurface.move((col, row) => {
                //this.drawCursor(col, row);
                this.shiftAction()
                this.bottomBar.updateCursor(col, row);
            });

            this.selectionSurface.leave(() => {
                // if (this.edit) {
                //     this.rePaint();
                //     if (this.edit.isStarted && this.activeTool === PaintTool.Normal) {
                //         this.commit();
                //     }
                // }
                this.bottomBar.hideCursor();
            });


            this.header = new TopBar(this);
            this.gallery = new Gallery(blocksInfo);
            this.bottomBar = new BottomBar(this.group, this, BOTTOM_BAR_HEIGHT);

            // this.updateUndoRedo();
        }

        copy(): MelodyArray {
            let copy = new MelodyArray();
            copy.setArray(this.state);
            return copy;
        }

        resize(width: number, height: number) {
            // if (!this.cachedState) {
            //     this.cachedState = this.copy();
            //     this.undoStack.push(this.cachedState)
            //     this.redoStack = [];
            // }
            // this.state = resizeBitmap(this.cachedState, width, height);
            // this.afterResize(true);
        }

        setCell(col: number, row: number, color: number, commit: boolean): void {
            this.melody.updateMelody(row, col);
            // if (commit) {
            //     this.state.set(col, row, color);
            //     this.paintCell(col, row, color);
            // }
            // else if (this.edit) {
            //     if (!this.edit.isStarted) {
            //         this.edit.start(col, row);
            //     }
            //     this.edit.update(col, row);
            //     this.cursorCol = col;
            //     this.cursorRow = row;
            //     this.paintEdit(this.edit, col, row);
            // }
        }

        // set cell
        // use switch statement for color fill

        // render
        render(el: HTMLDivElement): void {
            el.appendChild(this.header.getElement());
            el.appendChild(this.gallery.getElement());
            this.selectionSurface.render(el);
            el.appendChild(this.root.el);
            this.layout();
            this.root.attr({ "width": this.outerWidth() + "px", "height": this.outerHeight() + "px" });
            this.root.el.style.position = "absolute";
            this.root.el.style.top = "0px";
            this.root.el.style.left = "0px";
        }

        // layout():void

        layout(): void {
            if (!this.root) {
                return;
            }

            this.selectionSurface.setGridDimensions(CANVAS_HEIGHT);

            // The width of the palette + editor
            const paintAreaTop = HEADER_HEIGHT + HEADER_CANVAS_MARGIN;
            const paintAreaLeft = PADDING;

            //this.sidebar.translate(PADDING, paintAreaTop);
            this.selectionSurface.updateBounds(paintAreaTop, paintAreaLeft, CANVAS_HEIGHT, CANVAS_HEIGHT);
            this.bottomBar.layout(paintAreaTop + CANVAS_HEIGHT + BOTTOM_BAR_CANVAS_MARGIN, paintAreaLeft, CANVAS_HEIGHT);

            this.gallery.layout(0, HEADER_HEIGHT, TOTAL_HEIGHT - HEADER_HEIGHT);
            this.header.layout();
        }


        getMelody() { // instead of bitmap
            return this.melody;
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

        rePaint() {
            this.selectionSurface.repaint();
        }
        
        showGallery(): void {
            this.gallery.show((result: MelodyArray, err?: string) => {
                if (err && err !== "cancelled") {
                    console.error(err);
                }
                else if (result) {
                    this.hideGallery();
                    this.header.toggle.toggle(true);
                }
            });
        }
        hideGallery(): void {
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

        private shiftAction() {
            if (!this.shiftDown || this.altDown)
                return;
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