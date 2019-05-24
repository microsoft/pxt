namespace pxtsprite {
    export class CanvasState {
        image: Bitmap;
        floatingLayer: Bitmap;
        layerOffsetX: number;
        layerOffsetY: number;

        constructor(bitmap?: Bitmap) {
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

        copy() {
            const res = new CanvasState();
            res.image = this.image.copy();

            if (this.floatingLayer) {
                res.floatingLayer = this.floatingLayer.copy();
                res.floatingLayer.x0 = this.layerOffsetX;
                res.floatingLayer.y0 = this.layerOffsetY;
            }
            res.layerOffsetX = this.layerOffsetX;
            res.layerOffsetY = this.layerOffsetY;

            return res;
        }

        equals(other: CanvasState) {
            if (!this.image.equals(other.image) || (this.floatingLayer && !other.floatingLayer) || (!this.floatingLayer && other.floatingLayer)) return false;

            if (this.floatingLayer) return this.floatingLayer.equals(other.floatingLayer) && this.layerOffsetX === other.layerOffsetX && this.layerOffsetY === other.layerOffsetY;

            return true;
        }

        mergeFloatingLayer() {
            if (!this.floatingLayer) return;

            this.floatingLayer.x0 = this.layerOffsetX;
            this.floatingLayer.y0 = this.layerOffsetY;

            this.image.apply(this.floatingLayer, true);
            this.floatingLayer = undefined;
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

            this.floatingLayer = this.image.copy(left, top, width, height);
            this.layerOffsetX = this.floatingLayer.x0;
            this.layerOffsetY = this.floatingLayer.y0;

            if (cut) {
                for (let c = 0; c < width; c++) {
                    for (let r = 0; r < height; r++) {
                        this.image.set(left + c, top + r, 0);
                    }
                }
            }
        }

        inFloatingLayer(col: number, row: number) {
            if (!this.floatingLayer) return false;

            col = col - this.layerOffsetX;
            row = row - this.layerOffsetY;

            return col >= 0 && col < this.floatingLayer.width && row >= 0 && row < this.floatingLayer.height;
        }
    }
}