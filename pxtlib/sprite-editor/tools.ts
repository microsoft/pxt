/// <reference path="./bitmap.ts" />

namespace pxtsprite {
    export enum PaintTool {
        Normal = 0,
        Rectangle = 1,
        Outline = 2,
        Circle = 3,
        Fill = 4,
        Line = 5,
        Erase = 6,
        Marquee = 7,
    }

    export function getPaintToolShortcut(tool: PaintTool) {
        switch (tool) {
            case PaintTool.Normal:
                return "p";
            case PaintTool.Rectangle:
                return "r";
            case PaintTool.Circle:
                return "c";
            case PaintTool.Fill:
                return "b";
            case PaintTool.Line:
                return "l";
            case PaintTool.Erase:
                return "e";
            case PaintTool.Marquee:
                return "s";
            default:
                return undefined;
        }
    }

    export class Cursor {
        offsetX: number;
        offsetY: number;
        constructor(public readonly width: number, public readonly height: number) {
            this.offsetX = -(width >> 1);
            this.offsetY = -(height >> 1);
        }
    }

    export abstract class Edit {
        protected startCol: number;
        protected startRow: number;
        isStarted: boolean;
        showPreview: boolean;

        constructor (protected canvasWidth: number, protected canvasHeight: number, public color: number, protected toolWidth: number) {
        }

        public abstract update(col: number, row: number): void;
        protected abstract doEditCore(state: CanvasState): void;

        public doEdit(state: CanvasState): void {
            if (this.isStarted) {
                this.doEditCore(state);
            }
        }


        start(cursorCol: number, cursorRow: number, state: CanvasState) {
            this.isStarted = true;
            this.startCol = cursorCol;
            this.startRow = cursorRow;

            state.mergeFloatingLayer();
        }

        getCursor(): Cursor {
            return new Cursor(this.toolWidth, this.toolWidth);
        }

        drawCursor(col: number, row: number, draw: (c: number, r: number) => void) {
            draw(col, row);
        }
    }

    export abstract class SelectionEdit extends Edit {
        protected endCol: number;
        protected endRow: number;

        update(col: number, row: number) {
            this.endCol = col;
            this.endRow = row;
        }

        protected topLeft(): Coord {
            return [Math.min(this.startCol, this.endCol), Math.min(this.startRow, this.endRow)];
        }

        protected bottomRight(): Coord {
            return [Math.max(this.startCol, this.endCol), Math.max(this.startRow, this.endRow)];
        }
    }

    /**
     * Regular old drawing tool
     */
    export class PaintEdit extends Edit {
        protected mask: Bitmask;
        showPreview = true;

        constructor (canvasWidth: number, canvasHeight: number, color: number, toolWidth: number) {
            super(canvasWidth, canvasHeight, color, toolWidth);
            this.mask = new Bitmask(canvasWidth, canvasHeight);
        }

        update(col: number, row: number) {
            // Interpolate (Draw a line) from startCol, startRow to col, row
            this.interpolate(this.startCol, this.startRow, col, row);

            this.startCol = col;
            this.startRow = row;
        }

        // https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
        protected interpolate(x0: number, y0: number, x1: number, y1: number) {
            const dx = x1 - x0;
            const dy = y1 - y0;
            const draw = (c: number, r: number) => this.mask.set(c, r);
            if (dx === 0) {
                const startY = dy >= 0 ? y0 : y1;
                const endY = dy >= 0 ? y1 : y0;
                for (let y = startY; y <= endY; y++) {
                    this.drawCore(x0, y, draw);
                }
                return;
            }

            const xStep = dx > 0 ? 1 : -1;
            const yStep = dy > 0 ? 1 : -1;
            const dErr = Math.abs(dy / dx);

            let err = 0;
            let y = y0;
            for (let x = x0; xStep > 0 ? x <= x1 : x >= x1; x += xStep) {
                this.drawCore(x, y, draw);
                err += dErr;
                while (err >= 0.5) {
                    if (yStep > 0 ? y <= y1 : y >= y1) {
                        this.drawCore(x, y, draw);
                    }
                    y += yStep;
                    err -= 1;
                }
            }
        }

        protected doEditCore(state: CanvasState) {
            for (let c = 0; c < state.width; c++) {
                for (let r = 0; r < state.height; r++) {
                    if (this.mask.get(c, r)) {
                        state.image.set(c, r, this.color);
                    }
                }
            }
        }

        drawCursor(col: number, row: number, draw: (c: number, r: number) => void) {
            this.drawCore(col, row, draw);
        }

        protected drawCore(col: number, row: number, setPixel: (col: number, row: number) => void) {
            col = col - Math.floor(this.toolWidth / 2);
            row = row - Math.floor(this.toolWidth / 2);
            for (let i = 0; i < this.toolWidth; i++) {
                for (let j = 0; j < this.toolWidth; j++) {
                    const c = col + i;
                    const r = row + j;

                    if (c >= 0 && c < this.canvasWidth && r >= 0 && r < this.canvasHeight) {
                        setPixel(col + i, row + j);
                    }
                }
            }
        }
    }

    /**
     * Tool for drawing filled rectangles
     */
    export class RectangleEdit extends SelectionEdit {
        showPreview = true;

        protected doEditCore(state: CanvasState) {
            const tl = this.topLeft();
            const br = this.bottomRight();
            for (let c = tl[0]; c <= br[0]; c++) {
                for (let r = tl[1]; r <= br[1]; r++) {
                    state.image.set(c, r, this.color);
                }
            }
        }
    }

    /**
     * Tool for drawing empty rectangles
     */
    export class OutlineEdit extends SelectionEdit {
        showPreview = true;

        protected doEditCore(state: CanvasState) {
            const tl = this.topLeft();
            const br = this.bottomRight();
            for (let i = 0; i < this.toolWidth; i++) {
                this.drawRectangle(state,   
                    [tl[0] + i, tl[1] + i],
                    [br[0] - i, br[1] - i]
                );
            }
        }

        protected drawRectangle(state: CanvasState, tl: Coord, br: Coord) {
            if (tl[0] > br[0] || tl[1] > br[1]) return;

            for (let c = tl[0]; c <= br[0]; c++) {
                state.image.set(c, tl[1], this.color);
                state.image.set(c, br[1], this.color);
            }
            for (let r = tl[1]; r <= br[1]; r++) {
                state.image.set(tl[0], r, this.color);
                state.image.set(br[0], r, this.color);
            }
        }
    }

    /**
     * Tool for drawing straight lines
     */
    export class LineEdit extends SelectionEdit {
        showPreview = true;

        protected doEditCore(state: CanvasState) {
            this.bresenham(this.startCol, this.startRow, this.endCol, this.endRow, state);
        }

        // https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
        protected bresenham(x0: number, y0: number, x1: number, y1: number, state: CanvasState) {
            const dx = x1 - x0;
            const dy = y1 - y0;
            const draw = (c: number, r: number) => state.image.set(c, r, this.color);
            if (dx === 0) {
                const startY = dy >= 0 ? y0 : y1;
                const endY = dy >= 0 ? y1 : y0;
                for (let y = startY; y <= endY; y++) {
                    this.drawCore(x0, y, draw);
                }
                return;
            }

            const xStep = dx > 0 ? 1 : -1;
            const yStep = dy > 0 ? 1 : -1;
            const dErr = Math.abs(dy / dx);

            let err = 0;
            let y = y0;
            for (let x = x0; xStep > 0 ? x <= x1 : x >= x1; x += xStep) {
                this.drawCore(x, y, draw);
                err += dErr;
                while (err >= 0.5) {
                    if (yStep > 0 ? y <= y1 : y >= y1) {
                        this.drawCore(x, y, draw);
                    }
                    y += yStep;
                    err -= 1;
                }
            }
        }

        drawCursor(col: number, row: number, draw: (c: number, r: number) => void) {
            this.drawCore(col, row, draw);
        }

        // This is surely not the most efficient approach for drawing thick lines...
        protected drawCore(col: number, row: number, draw: (c: number, r: number) => void) {
            col = col - Math.floor(this.toolWidth / 2);
            row = row - Math.floor(this.toolWidth / 2);
            for (let i = 0; i < this.toolWidth; i++) {
                for (let j = 0; j < this.toolWidth; j++) {
                    const c = col + i;
                    const r = row + j;

                    draw(c, r);
                }
            }
        }
    }

    /**
     * Tool for circular outlines
     */
    export class CircleEdit extends SelectionEdit {
        showPreview = true;

        protected doEditCore(state: CanvasState) {
            const tl = this.topLeft();
            const br = this.bottomRight();
            const dx = br[0] - tl[0];
            const dy = br[1] - tl[1];

            const radius = Math.floor(Math.hypot(dx, dy));
            const cx = this.startCol;
            const cy = this.startRow;

            this.midpoint(cx, cy, radius, state);
        }

        // https://en.wikipedia.org/wiki/Midpoint_circle_algorithm
        midpoint(cx: number, cy: number, radius: number, state: CanvasState) {
            let x = radius - 1;
            let y = 0;
            let dx = 1;
            let dy = 1;
            let err = dx - (radius * 2);
            while (x >= y) {
                state.image.set(cx + x, cy + y, this.color);
                state.image.set(cx + x, cy - y, this.color);
                state.image.set(cx + y, cy + x, this.color);
                state.image.set(cx + y, cy - x, this.color);
                state.image.set(cx - y, cy + x, this.color);
                state.image.set(cx - y, cy - x, this.color);
                state.image.set(cx - x, cy + y, this.color);
                state.image.set(cx - x, cy - y, this.color);
                if (err <= 0) {
                    y++;
                    err += dy;
                    dy += 2;
                }
                if (err > 0) {
                    x--;
                    dx += 2;
                    err += dx - (radius * 2);
                }
            }
        }
    }


    export class FillEdit extends Edit {
        protected col: number;
        protected row: number;
        showPreview = true;

        start(col: number, row: number, state: CanvasState) {
            this.isStarted = true;
            this.col = col;
            this.row = row;

            state.mergeFloatingLayer();
        }

        update(col: number, row: number) {
            this.col = col;
            this.row = row;
        }

        protected doEditCore(state: CanvasState) {
            const replColor = state.image.get(this.col, this.row);
            if (replColor === this.color) {
                return;
            }

            const mask = new Bitmask(state.width, state.height);
            mask.set(this.col, this.row);
            const q: Coord[] = [[this.col, this.row]];
            while (q.length) {
                const [c, r] = q.pop();
                if (state.image.get(c, r) === replColor) {
                    state.image.set(c, r, this.color);
                    tryPush(c + 1, r);
                    tryPush(c - 1, r);
                    tryPush(c, r + 1);
                    tryPush(c, r - 1);
                }
            }

            function tryPush(x: number, y: number) {
                if (x >= 0 && x < mask.width && y >= 0 && y < mask.height && !mask.get(x, y)) {
                    mask.set(x, y);
                    q.push([x, y]);
                }
            }
        }
    }


    export class MarqueeEdit extends SelectionEdit {
        protected isMove = false;
        showPreview = false;

        start(cursorCol: number, cursorRow: number, state: CanvasState) {
            this.isStarted = true;
            this.startCol = cursorCol;
            this.startRow = cursorRow;

            if (state.inFloatingLayer(cursorCol, cursorRow)) {
                this.isMove = true;
            }
            else {
                state.mergeFloatingLayer();
            }
        }

        protected doEditCore(state: CanvasState): void {
            if (this.isMove) {
                state.layerOffsetX = state.floatingLayer.x0 + this.endCol - this.startCol;
                state.layerOffsetY = state.floatingLayer.y0 + this.endRow - this.startRow;
            }
            else {
                state.copyToLayer(this.startCol, this.startRow, this.endCol - this.startCol, this.endRow - this.startRow, true);
            }
        }

        getCursor(): Cursor {
            return undefined;
        }
    }
}