/// <reference path="../../built/pxtlib.d.ts" />

namespace pxtblockly {
    export interface ImageJSON {
        src: string;
        alt: string;
        width: number;
        height: number;
    }

    export type TilesetDropdownOption = [ImageJSON, string];

    const PREVIEW_SIDE_LENGTH = 32;

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

            const tsRefs = getAllBlocksWithTilesets(ws)
                .map(({ ref }) => ref.getValue() as string)
                .filter(qname => qname !== "null" && !pxt.Util.startsWith(qname, pxt.sprite.TILE_NAMESPACE));

            for (const galleryRef of tsRefs) {
                if (!FieldTileset.tileCache[galleryRef]) {
                    FieldTileset.tileCache[galleryRef] = bitmapToImageURI(pxt.sprite.getBitmap(blocksInfo, galleryRef), 16, false);
                }
                if (!FieldTileset.galleryTiles.some(([, qname]) => qname === galleryRef)) {
                    FieldTileset.galleryTiles.push([FieldTileset.getTileImageJSON({ qualifiedName: galleryRef, data: null }, ws, blocksInfo), galleryRef]);
                }
            }
        }

        public static getTileKey(t: pxt.sprite.TileInfo) {
            if (t.qualifiedName) return t.qualifiedName;
            if (t.projectId !== undefined) return `${pxt.sprite.TILE_NAMESPACE}.${pxt.sprite.TILE_PREFIX}${t.projectId}`;

            return undefined;
        }

        public static getTileImage(t: pxt.sprite.TileInfo, ws: Blockly.Workspace, blocksInfo: pxtc.BlocksInfo) {
            if (!FieldTileset.tileCache || !FieldTileset.tileCache[FieldTileset.getTileKey(t)]) {
                FieldTileset.rebuildTileCache(ws, blocksInfo);
            }

            return FieldTileset.tileCache[FieldTileset.getTileKey(t)];
        }

        public static getTileImageJSON(t: pxt.sprite.TileInfo, ws: Blockly.Workspace, blocksInfo: pxtc.BlocksInfo) {
            const uri = FieldTileset.getTileImage(t, ws, blocksInfo);

            return {
                src: uri,
                width: PREVIEW_SIDE_LENGTH,
                height: PREVIEW_SIDE_LENGTH,
                alt: FieldTileset.getTileKey(t).split(".").pop()
            }
        }

        public static getGalleryTiles(): TilesetDropdownOption[] {
            return FieldTileset.galleryTiles || [];
        }

        public isFieldCustom_ = true;
        protected selected: pxt.sprite.TileInfo;
        protected blocksInfo: pxtc.BlocksInfo;
        protected transparent: TilesetDropdownOption;

        constructor(text: string, options: FieldImageDropdownOptions, validator?: Function) {
            super(text, options, validator);
            this.blocksInfo = options.blocksInfo;

            if (!text) {
                this.setValue(this.getOptions()[0][1]);
            }
        }

        init() {
            super.init();

            if (this.sourceBlock_ && this.sourceBlock_.workspace && !this.sourceBlock_.isInFlyout) {
                const tiles = getAllTilesetTiles(this.sourceBlock_.workspace);

                if (!tiles.some(t => t.projectId === 0)) {
                    // Ensure transparency exists or else compilation will fail
                    // TODO: Other tile sizes
                    saveTilesetTile(this.sourceBlock_.workspace, { projectId: 0, data: new pxt.sprite.Bitmap(16, 16).data() });
                }
            }
        }

        menuGenerator_ = () => {
            if (!this.transparent) {
                this.transparent = [{
                    src: mkTransparentTileImage(16),
                    width: PREVIEW_SIDE_LENGTH,
                    height: PREVIEW_SIDE_LENGTH,
                    alt: pxt.U.lf("transparency")
                }, "myTiles.tile0"];
            }

            let options: TilesetDropdownOption[] = [this.transparent];

            if (this.sourceBlock_) {
                // projectId 0 is reserved for transparency, which is always included
                const projectTiles = getAllTilesetTiles(this.sourceBlock_.workspace).filter(t => t.projectId !== 0);
                options.push(...projectTiles.map(info => [FieldTileset.getTileImageJSON(info, this.sourceBlock_.workspace, this.blocksInfo), FieldTileset.getTileKey(info)]).filter(([, b]) => !!b) as TilesetDropdownOption[]);

                const galleryTiles = FieldTileset.getGalleryTiles();

                if (this.value_ && !(options.concat(galleryTiles)).some(([, id]) => id === this.value_)) {
                    FieldTileset.rebuildTileCache(this.sourceBlock_.workspace, this.blocksInfo);
                }

                options.push(...FieldTileset.getGalleryTiles());
            }

            return options;
        }
    }

    function mkTransparentTileImage(sideLength: number) {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = sideLength;
        canvas.height = sideLength;

        context.fillStyle = "#aeaeae";
        context.fillRect(0, 0, sideLength, sideLength);

        context.fillStyle = "#dedede";

        for (let x = 0; x < sideLength; x += 4) {
            for (let y = 0; y < sideLength; y += 4) {
                if (((x + y) >> 2) & 1) context.fillRect(x, y, 4, 4);
            }
        }

        return canvas.toDataURL();
    }
}
