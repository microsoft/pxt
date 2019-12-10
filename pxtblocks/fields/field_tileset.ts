/// <reference path="../../built/pxtlib.d.ts" />

namespace pxtblockly {
    export interface ImageJSON {
        src: string;
        alt: string;
        width: number;
        height: number;
    }

    export type TilesetDropdownOption = [ImageJSON, string];

    export class FieldTileset extends FieldImages implements Blockly.FieldCustom {
        private static tileCache: pxt.Map<string>;
        private static galleryTiles: TilesetDropdownOption[];

        public static rebuildTileCache(ws: Blockly.Workspace, blocksInfo: pxtc.BlocksInfo) {
            const tiles = getAllTilesetTiles(ws);

            if (!FieldTileset.tileCache) FieldTileset.tileCache = {};

            for (const t of tiles) {
                const key = FieldTileset.getTileKey(t);

                if (key) {
                    FieldTileset.tileCache[key] = bitmapToImageURI(pxt.sprite.Bitmap.fromData(t.data), 16, false);
                }
            }

            FieldTileset.galleryTiles = [];

            if (!blocksInfo) return;

            const tilemaps = getAllBlocksWithTilemaps(ws);
            for (const t of tilemaps) {
                const ts = t.ref.getTileset();

                for (const tile of ts.tiles) {
                    if (tile.qualifiedName) {
                        if (!FieldTileset.tileCache[tile.qualifiedName]) {
                            FieldTileset.tileCache[tile.qualifiedName] = bitmapToImageURI(pxt.sprite.getBitmap(blocksInfo, tile.qualifiedName), ts.tileWidth, false);
                        }
                        if (!FieldTileset.galleryTiles.some(([, qname]) => qname === tile.qualifiedName)) {
                            FieldTileset.galleryTiles.push([FieldTileset.getTileImageJSON(tile, ws, blocksInfo), tile.qualifiedName]);
                        }
                    }
                }
            }
        }

        public static getTileKey(t: pxt.sprite.TileInfo) {
            if (t.qualifiedName) return t.qualifiedName;
            if (t.projectId !== undefined) return `${pxt.sprite.TILE_NAMESPACE}.${pxt.sprite.TILE_PREFIX}${t.projectId}`;

            return undefined;
        }

        public static getTileImage(t: pxt.sprite.TileInfo, ws: Blockly.Workspace, blocksInfo: pxtc.BlocksInfo) {
            if (!FieldTileset.tileCache) {
                FieldTileset.rebuildTileCache(ws, blocksInfo);
            }

            return FieldTileset.tileCache[FieldTileset.getTileKey(t)];
        }

        public static getTileImageJSON(t: pxt.sprite.TileInfo, ws: Blockly.Workspace, blocksInfo: pxtc.BlocksInfo) {
            const uri = FieldTileset.getTileImage(t, ws, blocksInfo);

            return {
                src: uri,
                width: 50,
                height: 50,
                alt: FieldTileset.getTileKey(t).split(".").pop()
            }
        }

        public static getGalleryTiles(): TilesetDropdownOption[] {
            return FieldTileset.galleryTiles;
        }

        public isFieldCustom_ = true;
        protected selected: pxt.sprite.TileInfo;
        protected blocksInfo: pxtc.BlocksInfo;

        constructor(text: string, options: FieldImageDropdownOptions, validator?: Function) {
            super(text, options, validator);
            this.blocksInfo = options.blocksInfo;
        }

        menuGenerator_ = () => {
            let options: any[][] = [[{
                    src: bitmapToImageURI(new pxt.sprite.Bitmap(16, 16), 16, false),
                    width: 50,
                    height: 50,
                    alt: "transparency"
                }, "null"
            ]];

            if (this.sourceBlock_) {
                // projectId 0 is reserved for transparency, which is always included
                const projectTiles = getAllTilesetTiles(this.sourceBlock_.workspace).filter(t => t.projectId !== 0);
                options.push(...projectTiles.map(info => [FieldTileset.getTileImageJSON(info, this.sourceBlock_.workspace, this.blocksInfo), FieldTileset.getTileKey(info)]).filter(([, b]) => !!b));
                options.push(...FieldTileset.getGalleryTiles());
            }

            return options;
        }
    }
}
