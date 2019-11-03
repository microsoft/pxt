import { Bitmap, BitmapData } from "./bitmap";

export class Tilemap extends Bitmap {
    public static fromData(data: BitmapData): Tilemap {
        return new Tilemap(data.width, data.height, data.x0, data.y0, data.data);
    }

    protected setCore(index: number, value: number) {
        this.buf[index] = value;
    }

    protected dataLength() {
        return this.width * this.height;
    }
}

export interface TileSet {
    tileWidth: number;
    tiles: BitmapData[];
}
