/// <reference path="./bitmap.ts" />

namespace pxtblockly {
    export enum PaintTool {
        Normal = 0,
        Rectangle = 1,
        Outline = 2,
        Circle = 3,
        Fill = 4,
        Line = 5,
        Erase = 6,
    }

    export class Cursor {
        color: number;
        width: number;
        height: number;
    }

    export abstract class Edit {
        protected startCol: number;
        protected startRow: number;
        isStarted: boolean;

        constructor (protected canvasWidth: number, protected canvasHeight: number, public color: number, protected toolWidth: number) {
        }

        public abstract update(col: number, row: number): void;
        protected abstract doEditCore(bitmap: Bitmap): void;

        public doEdit(bitmap: Bitmap): void {
            if (this.isStarted) {
                this.doEditCore(bitmap);
            }
        }


        start(cursorCol: number, cursorRow: number) {
            this.isStarted = true;
            this.startCol = cursorCol;
            this.startRow = cursorRow;
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

        constructor (canvasWidth: number, canvasHeight: number, color: number, toolWidth: number) {
            super(canvasWidth, canvasHeight, color, toolWidth);
            this.mask = new Bitmask(canvasWidth, canvasHeight);
        }

        update(col: number, row: number) {
            this.drawCore(col, row, (c, r) => this.mask.setBit(c, r));
        }

        drawCursor(col: number, row: number, draw: (c: number, r: number) => void) {
            this.drawCore(col, row, draw);
        }

        protected doEditCore(bitmap: Bitmap) {
            for (let c = 0; c < bitmap.width; c++) {
                for (let r = 0; r < bitmap.height; r++) {
                    if (this.mask.getBit(c, r)) {
                        bitmap.setPixel(c, r, this.color);
                    }
                }
            }
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
        protected doEditCore(bitmap: Bitmap) {
            const tl = this.topLeft();
            const br = this.bottomRight();
            for (let c = tl[0]; c <= br[0]; c++) {
                for (let r = tl[1]; r <= br[1]; r++) {
                    bitmap.setPixel(c, r, this.color);
                }
            }
        }
    }

    /**
     * Tool for drawing empty rectangles
     */
    export class OutlineEdit extends SelectionEdit {
        protected doEditCore(bitmap: Bitmap) {
            const tl = this.topLeft();
            const br = this.bottomRight();
            for (let i = 0; i < this.toolWidth; i++) {
                this.drawRectangle(bitmap,
                    [tl[0] + i, tl[1] + i],
                    [br[0] - i, br[1] - i]
                );
            }
        }

        protected drawRectangle(bitmap: Bitmap, tl: Coord, br: Coord) {
            if (tl[0] > br[0] || tl[1] > br[1]) return;

            for (let c = tl[0]; c <= br[0]; c++) {
                bitmap.setPixel(c, tl[1], this.color);
                bitmap.setPixel(c, br[1], this.color);
            }
            for (let r = tl[1]; r <= br[1]; r++) {
                bitmap.setPixel(tl[0], r, this.color);
                bitmap.setPixel(br[0], r, this.color);
            }
        }
    }

    /**
     * Tool for drawing straight lines
     */
    export class LineEdit extends SelectionEdit {
        protected doEditCore(bitmap: Bitmap) {
            this.bresenham(this.startCol, this.startRow, this.endCol, this.endRow, bitmap);
        }

        drawCursor(col: number, row: number, draw: (c: number, r: number) => void) {
            this.drawCore(col, row, draw);
        }

        // https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
        protected bresenham(x0: number, y0: number, x1: number, y1: number, bitmap: Bitmap) {
            const dx = x1 - x0;
            const dy = y1 - y0;
            const draw = (c: number, r: number) => bitmap.setPixel(c, r, this.color);
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
        protected doEditCore(bitmap: Bitmap) {
            const tl = this.topLeft();
            const br = this.bottomRight();
            const dx = br[0] - tl[0];
            const dy = br[1] - tl[1];
            if (dx < dy) {
                br[1] = tl[1] + dx;
            }
            else {
                br[0] = tl[0] + dy;
            }
            const radius = Math.floor((br[0] - tl[0]) / 2);
            const cx = tl[0] + radius;
            const cy = tl[1] + radius;

            this.midpoint(cx, cy, radius, bitmap);
        }

        // https://en.wikipedia.org/wiki/Midpoint_circle_algorithm
        midpoint(cx: number, cy: number, radius: number, bitmap: Bitmap) {
            let x = radius;
            let y = 0;
            let err = 0;
            while (x >= y) {
                bitmap.setPixel(cx + x, cy + y, this.color);
                bitmap.setPixel(cx + x, cy - y, this.color);
                bitmap.setPixel(cx + y, cy + x, this.color);
                bitmap.setPixel(cx + y, cy - x, this.color);
                bitmap.setPixel(cx - y, cy + x, this.color);
                bitmap.setPixel(cx - y, cy - x, this.color);
                bitmap.setPixel(cx - x, cy + y, this.color);
                bitmap.setPixel(cx - x, cy - y, this.color);
                if (err <= 0) {
                    y += 1;
                    err += 2 * y + 1;
                }
                if (err > 0) {
                    x -= 1;
                    err -= 2 * x + 1;
                }
            }
        }
    }


    export class FillEdit extends Edit {
        protected col: number;
        protected row: number;

        start(col: number, row: number) {
            this.isStarted = true;
            this.col = col;
            this.row = row;
        }

        update(col: number, row: number) {
            this.col = col;
            this.row = row;
        }

        protected doEditCore(bitmap: Bitmap) {
            const replColor = bitmap.getPixel(this.col, this.row);
            if (replColor === this.color) {
                return;
            }

            const mask = new Bitmask(bitmap.width, bitmap.height);
            mask.setBit(this.col, this.row);
            const q: Coord[] = [[this.col, this.row]];
            while (q.length) {
                const [c, r] = q.pop();
                if (bitmap.getPixel(c, r) === replColor) {
                    bitmap.setPixel(c, r, this.color);
                    tryPush(c + 1, r);
                    tryPush(c - 1, r);
                    tryPush(c, r + 1);
                    tryPush(c, r - 1);
                }
            }

            function tryPush(x: number, y: number) {
                if (x >= 0 && x < mask.width && y >= 0 && y < mask.height && !mask.getBit(x, y)) {
                    mask.setBit(x, y);
                    q.push([x, y]);
                }
            }
        }
    }
}