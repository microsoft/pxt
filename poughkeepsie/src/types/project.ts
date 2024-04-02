export interface BaseAsset {
    id: number;
    name: string;
    kind: string;
}

export interface ImageAsset extends BaseAsset {
    frames: pxt.sprite.BitmapData[];
    interval: number;
}

export interface AvatarAsset extends ImageAsset {
    kind: "avatar";
}

export interface TileAsset extends ImageAsset {
    kind: "tile";
    isWall: boolean;
}

export interface SpriteAsset extends ImageAsset {
    kind: "sprite";
}

export interface ItemAsset extends ImageAsset {
    kind: "item";
}

export interface TilemapAsset extends BaseAsset {
    kind: "tilemap";
    data: pxt.sprite.TilemapData;
}

export type Asset = AvatarAsset | TileAsset | SpriteAsset | ItemAsset | TilemapAsset;

export interface Project {
    nextId: number;
    assets: Asset[];
    palette: string[];
    revision: number;
}