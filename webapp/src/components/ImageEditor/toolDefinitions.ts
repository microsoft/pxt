import { ImageEditorTool, TileDrawingMode } from "./store/imageReducer";

export enum ToolCursor {
    None = "none",
    Default = "default",
    Pointer = "pointer",
    Crosshair = "crosshair",
    Grab = "grab",
    Grabbing = "grabbing",
    EyeDropper = "var(--eyedropper)"
}

export interface ToolInfo {
    tool: ImageEditorTool;
    iconClass: string;
    title: string;

    hiddenTool?: boolean;
    altTool?: ImageEditorTool;
    shiftTool?: ImageEditorTool;

    hoverCursor?: ToolCursor;
    downCursor?: ToolCursor;
    hoverLayerCursor?: ToolCursor;
    downLayerCursor?: ToolCursor;
}

export const tools: ToolInfo[] = [
    {
        tool: ImageEditorTool.Paint,
        iconClass: "ms-Icon ms-Icon--Edit",
        title: lf("Paint Tool"),
        hoverCursor: ToolCursor.Crosshair,
    },
    {
        tool: ImageEditorTool.Erase,
        iconClass: "ms-Icon ms-Icon--EraseTool",
        title: lf("Erase Tool"),
        hoverCursor: ToolCursor.Crosshair,
    },
    {
        tool: ImageEditorTool.Rect,
        iconClass: "ms-Icon ms-Icon--RectangleShape",
        title: lf("Rectangle Tool"),
        hoverCursor: ToolCursor.Crosshair,
    },
    {
        tool: ImageEditorTool.Fill,
        iconClass: "ms-Icon ms-Icon--BucketColor",
        title: lf("Fill Tool"),
        hoverCursor: ToolCursor.Crosshair,
    },
    {
        tool: ImageEditorTool.Circle,
        iconClass: "ms-Icon ms-Icon--CircleRing",
        title: lf("Circle Tool"),
        hoverCursor: ToolCursor.Crosshair,
    },
    {
        tool: ImageEditorTool.Line,
        iconClass: "ms-Icon ms-Icon--Line",
        title: lf("Line Tool"),
        hoverCursor: ToolCursor.Crosshair,
    },
    {
        tool: ImageEditorTool.Marquee,
        iconClass: "ms-Icon ms-Icon--SelectAll",
        title: lf("Marquee Tool"),
        hoverCursor: ToolCursor.Crosshair,
        hoverLayerCursor: ToolCursor.Grab,
        downLayerCursor: ToolCursor.Grabbing
    },
    {
        tool: ImageEditorTool.Pan,
        iconClass: "ms-Icon ms-Icon--HandsFree",
        title: lf("Canvas Pan Tool"),
        hoverCursor: ToolCursor.Grab,
        downCursor: ToolCursor.Grabbing
    },
    {
        tool: ImageEditorTool.ColorSelect,
        hiddenTool: true,
        iconClass: "ms-Icon ms-Icon--Edit",
        title: lf("Color Select Tool"),
        hoverCursor: ToolCursor.EyeDropper
    }
];


export function getEdit(tool: ImageEditorTool, state: EditState, color: number, width: number) {
    switch (tool) {
        case ImageEditorTool.Paint:
            return new PaintEdit(state.width, state.height, color, width);
        case ImageEditorTool.Rect:
            return new OutlineEdit(state.width, state.height, color, width);
        case ImageEditorTool.Fill:
            return new FillEdit(state.width, state.height, color, width);
        case ImageEditorTool.Line:
            return new LineEdit(state.width, state.height, color, width);
        case ImageEditorTool.Marquee:
            return new MarqueeEdit(state.width, state.height, color, width);
        case ImageEditorTool.Circle:
            return new CircleEdit(state.width, state.height, color, width);
        case ImageEditorTool.Erase:
            return new PaintEdit(state.width, state.height, 0, width);
        case ImageEditorTool.ColorSelect:
        default:
            // FIXME
            return undefined;
    }
}

export function getEditState(state: pxt.sprite.ImageState, isTilemap: boolean, drawingMode: TileDrawingMode = TileDrawingMode.Default): EditState {
    const res =  new EditState(isTilemap
        ? pxt.sprite.Tilemap.fromData(state.bitmap).copy()
        : pxt.sprite.Bitmap.fromData(state.bitmap).copy());
    if (state.overlayLayers) res.overlayLayers = state.overlayLayers.map(layer => pxt.sprite.Bitmap.fromData(layer).copy());
    res.layerOffsetX = state.layerOffsetX;
    res.layerOffsetY = state.layerOffsetY;

    let floating, image, overlayLayers;
    if (state.floating) {
        if (state.floating.bitmap)
            image = isTilemap ? pxt.sprite.Tilemap.fromData(state.floating.bitmap).copy() : pxt.sprite.Bitmap.fromData(state.floating.bitmap).copy();
        if (state.floating.overlayLayers)
            overlayLayers = state.floating.overlayLayers.map(el => pxt.sprite.Bitmap.fromData(el).copy());
        floating = { image, overlayLayers };
    }
    res.floating = floating;

    res.setActiveLayer(drawingMode);

    return res;
}

export class EditState {
    image: pxt.sprite.Bitmap;
    overlayLayers?: pxt.sprite.Bitmap[];
    floating: {
        image: pxt.sprite.Bitmap;
        overlayLayers?: pxt.sprite.Bitmap[];
    }
    layerOffsetX: number;
    layerOffsetY: number;

    protected activeLayerIndex: number = -1;

    constructor(bitmap?: pxt.sprite.Bitmap) {
        this.image = bitmap;
        this.layerOffsetX = 0;
        this.layerOffsetY = 0;
    }

    get width() {
        return this.image.width;
    }

    get height() {
        return this.image.height;
    }

    get activeLayer(): pxt.sprite.Bitmap {
        if (this.activeLayerIndex < 0) {
            return this.image;
        } else {
            return this.overlayLayers[this.activeLayerIndex];
        }
    }

    setActiveLayer(drawingMode: TileDrawingMode) {
        switch (drawingMode) {
            case TileDrawingMode.Wall:
                this.activeLayerIndex = 0;
                break;
            default:
                this.activeLayerIndex = -1;
                break;
        }
    }

    copy() {
        const res = new EditState();
        res.image = this.image.copy();
        res.overlayLayers = this.overlayLayers && this.overlayLayers.map(layer => layer.copy());

        if (this.floating) {
            let image, overlayLayers;
            if (this.floating.image) image = this.floating.image.copy();
            if (this.floating.overlayLayers) overlayLayers = this.floating.overlayLayers.map(el => el.copy());
            res.floating = { image: image, overlayLayers: overlayLayers };
            // res.floatingLayer.x0 = this.layerOffsetX;
            // res.floatingLayer.y0 = this.layerOffsetY;
        }
        res.layerOffsetX = this.layerOffsetX;
        res.layerOffsetY = this.layerOffsetY;

        return res;
    }

    equals(other: EditState) {
        // todo add overlay layers
        if (!this.image.equals(other.image) || (this.floating && !other.floating) || (!this.floating && other.floating)) return false;

        if (this.floating && this.floating.image) return this.floating.image.equals(other.floating.image) && this.layerOffsetX === other.layerOffsetX && this.layerOffsetY === other.layerOffsetY;

        return true;
    }

    mergeFloatingLayer() {
        if (!this.floating || (!this.floating.image && !this.floating.overlayLayers)) return;

        if (this.floating.image) {
            this.floating.image.x0 = this.layerOffsetX;
            this.floating.image.y0 = this.layerOffsetY;

            this.image.apply(this.floating.image, true);
            this.floating.image = undefined;
        }

        if (this.floating.overlayLayers) {
            this.floating.overlayLayers.forEach((el, i) => {
                el.x0 = this.layerOffsetX;
                el.y0 = this.layerOffsetY;
                this.overlayLayers[i].apply(el, true);
            })
            this.floating.overlayLayers = undefined;
        }
    }

    copyToLayer(left: number, top: number, width: number, height: number, cut = false) {
        if (width === 0 || height === 0) return;

        if (width < 0) {
            left += width;
            width = -width;
        }

        if (height < 0) {
            top += height;
            height = -height;
        }

        let image = this.image.copy(left, top, width, height);
        this.layerOffsetX = image.x0;
        this.layerOffsetY = image.y0;

        image.x0 = undefined;
        image.y0 = undefined;

        let overlayLayers;
        if (this.overlayLayers) {
            overlayLayers = this.overlayLayers.map(el => el.copy(left, top, width, height));
        }

        if (cut) {
            for (let c = 0; c < width; c++) {
                for (let r = 0; r < height; r++) {
                    this.image.set(left + c, top + r, 0);
                    if (this.overlayLayers)
                        this.overlayLayers.forEach(el => el.set(left + c, top + r, 0));
                }
            }
        }

        this.floating = { image: image, overlayLayers: overlayLayers }
    }

    inFloatingLayer(col: number, row: number) {
        if (!this.floating || !this.floating.image) return false;

        col = col - this.layerOffsetX;
        row = row - this.layerOffsetY;

        return col >= 0 && col < this.floating.image.width && row >= 0 && row < this.floating.image.height;
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
    protected abstract doEditCore(state: EditState): void;

    public doEdit(state: EditState): void {
        if (this.isStarted) {
            this.doEditCore(state);
        }
    }

    public inBounds(x: number, y: number) {
        return x >= 0 && x < this.canvasWidth && y >= 0 && y < this.canvasHeight
    }


    start(cursorCol: number, cursorRow: number, state: EditState) {
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
    protected isDragged: boolean;

    update(col: number, row: number) {
        this.endCol = col;
        this.endRow = row;

        if (!this.isDragged && !(col == this.startCol && row == this.startRow)) {
            this.isDragged = true;
        }
    }

    protected topLeft(): pxt.sprite.Coord {
        return {
            x: Math.min(this.startCol, this.endCol),
            y: Math.min(this.startRow, this.endRow)
        };
    }

    protected bottomRight(): pxt.sprite.Coord {
        return {
            x: Math.max(this.startCol, this.endCol),
            y: Math.max(this.startRow, this.endRow)
    };
    }
}

/**
 * Regular old drawing tool
 */
export class PaintEdit extends Edit {
    protected mask: pxt.sprite.Bitmask;
    showPreview = true;

    constructor (canvasWidth: number, canvasHeight: number, color: number, toolWidth: number) {
        super(canvasWidth, canvasHeight, color, toolWidth);
        this.mask = new pxt.sprite.Bitmask(canvasWidth, canvasHeight);
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

    protected doEditCore(state: EditState) {
        state.mergeFloatingLayer();
        for (let c = 0; c < state.width; c++) {
            for (let r = 0; r < state.height; r++) {
                if (this.mask.get(c, r)) {
                    state.activeLayer.set(c, r, this.color);
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

    protected doEditCore(state: EditState) {
        state.mergeFloatingLayer();
        const tl = this.topLeft();
        const br = this.bottomRight();
        for (let c = tl.x; c <= br.x; c++) {
            for (let r = tl.y; r <= br.y; r++) {
                state.activeLayer.set(c, r, this.color);
            }
        }
    }
}

/**
 * Tool for drawing empty rectangles
 */
export class OutlineEdit extends SelectionEdit {
    showPreview = true;

    protected doEditCore(state: EditState) {
        state.mergeFloatingLayer();
        let tl = this.topLeft();
        tl.x -= this.toolWidth >> 1;
        tl.y -= this.toolWidth >> 1;

        let br = this.bottomRight();
        br.x += this.toolWidth >> 1;
        br.y += this.toolWidth >> 1;

        for (let i = 0; i < this.toolWidth; i++) {
            this.drawRectangle(state,
                {x: tl.x + i, y: tl.y + i},
                {x: br.x - i, y: br.y - i}
            );
        }
    }

    protected drawRectangle(state: EditState, tl: pxt.sprite.Coord, br: pxt.sprite.Coord) {
        if (tl.x > br.x || tl.y > br.y) return;

        for (let c = tl.x; c <= br.x; c++) {
            state.activeLayer.set(c, tl.y, this.color);
            state.activeLayer.set(c, br.y, this.color);
        }
        for (let r = tl.y; r <= br.y; r++) {
            state.activeLayer.set(tl.x, r, this.color);
            state.activeLayer.set(br.x, r, this.color);
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
 * Tool for drawing straight lines
 */
export class LineEdit extends SelectionEdit {
    showPreview = true;

    protected doEditCore(state: EditState) {
        state.mergeFloatingLayer();
        this.bresenham(this.startCol, this.startRow, this.endCol, this.endRow, state);
    }

    // https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
    protected bresenham(x0: number, y0: number, x1: number, y1: number, state: EditState) {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const draw = (c: number, r: number) => state.activeLayer.set(c, r, this.color);
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

    protected doEditCore(state: EditState) {
        state.mergeFloatingLayer();
        const tl = this.topLeft();
        const br = this.bottomRight();
        const dx = br.x - tl.x;
        const dy = br.y - tl.y;

        const radius = Math.floor(Math.hypot(dx, dy));
        const cx = this.startCol;
        const cy = this.startRow;

        this.midpoint(cx, cy, radius, state);
    }

    // https://en.wikipedia.org/wiki/Midpoint_circle_algorithm
    midpoint(cx: number, cy: number, radius: number, state: EditState) {
        let x = radius - 1;
        let y = 0;
        let dx = 1;
        let dy = 1;
        let err = dx - (radius * 2);
        while (x >= y) {
            state.activeLayer.set(cx + x, cy + y, this.color);
            state.activeLayer.set(cx + x, cy - y, this.color);
            state.activeLayer.set(cx + y, cy + x, this.color);
            state.activeLayer.set(cx + y, cy - x, this.color);
            state.activeLayer.set(cx - y, cy + x, this.color);
            state.activeLayer.set(cx - y, cy - x, this.color);
            state.activeLayer.set(cx - x, cy + y, this.color);
            state.activeLayer.set(cx - x, cy - y, this.color);
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

    start(col: number, row: number, state: EditState) {
        this.isStarted = true;
        this.col = col;
        this.row = row;
    }

    update(col: number, row: number) {
        this.col = col;
        this.row = row;
    }

    protected doEditCore(state: EditState) {
        // Read image layer, but write to the active layer; allows wall fill to fill based on tiles
        const colorToReplace = state.image.get(this.col, this.row);
        if (state.activeLayer === state.image && colorToReplace === this.color) {
            return;
        }

        state.mergeFloatingLayer();

        const mask = new pxt.sprite.Bitmask(state.width, state.height);
        mask.set(this.col, this.row);
        const q: pxt.sprite.Coord[] = [{x: this.col, y: this.row}];
        while (q.length) {
            const curr = q.pop();
            if (state.image.get(curr.x, curr.y) === colorToReplace) {
                state.activeLayer.set(curr.x, curr.y, this.color);
                tryPush(curr.x + 1, curr.y);
                tryPush(curr.x - 1, curr.y);
                tryPush(curr.x, curr.y + 1);
                tryPush(curr.x, curr.y - 1);
            }
        }

        function tryPush(x: number, y: number) {
            if (x >= 0 && x < mask.width && y >= 0 && y < mask.height && !mask.get(x, y)) {
                mask.set(x, y);
                q.push({x: x, y: y});
            }
        }
    }
}


export class MarqueeEdit extends SelectionEdit {
    protected isMove = false;
    showPreview = false;

    protected startOffsetX: number;
    protected startOffsetY: number;

    start(cursorCol: number, cursorRow: number, state: EditState) {
        this.isStarted = true;
        this.startCol = cursorCol;
        this.startRow = cursorRow;
        if (state.floating && state.floating.image) {
            if (state.inFloatingLayer(cursorCol, cursorRow)) {
                this.isMove = true;
                this.startOffsetX = state.layerOffsetX;
                this.startOffsetY = state.layerOffsetY;
            }
        }
    }

    public inBounds(x: number, y: number) {
        return this.isMove || super.inBounds(x, y);
    }

    protected doEditCore(state: EditState): void {
        const tl = this.topLeft();
        const br = this.bottomRight();

        if (this.isDragged) {
            if (this.isMove) {
                state.layerOffsetX = this.startOffsetX + this.endCol - this.startCol;
                state.layerOffsetY = this.startOffsetY + this.endRow - this.startRow;
            }
            else {
                state.mergeFloatingLayer();
                state.copyToLayer(tl.x, tl.y, br.x - tl.x + 1, br.y - tl.y + 1, true);
            }
        }
        else if (!this.isMove) {
            state.mergeFloatingLayer();
        }
    }
}
