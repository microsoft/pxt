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
        private static rebuildLock: boolean;

        public static rebuildTileCache(ws: Blockly.Workspace, blocksInfo: pxtc.BlocksInfo) {
            if (FieldTileset.rebuildLock) return;

            FieldTileset.rebuildLock = true;
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
                            const bitmap = pxt.sprite.getBitmap(blocksInfo, tile.qualifiedName);
                            if (bitmap) {
                                FieldTileset.tileCache[tile.qualifiedName] = bitmapToImageURI(bitmap, ts.tileWidth, false);
                            }
                        }
                        if (!FieldTileset.galleryTiles.some(([, qname]) => qname === tile.qualifiedName)) {
                            const json = FieldTileset.getTileImageJSON(tile, ws, blocksInfo);
                            if (json) {
                                FieldTileset.galleryTiles.push([json, tile.qualifiedName]);
                            }
                        }
                    }
                }
            }

            const tsRefs = getAllBlocksWithTilesets(ws)
                .map(({ ref }) => ref.getValue() as string)
                .filter(qname => qname !== "null" && !pxt.Util.startsWith(qname, pxt.sprite.TILE_NAMESPACE));

            for (const galleryRef of tsRefs) {
                if (!FieldTileset.tileCache[galleryRef]) {
                    const bitmap = pxt.sprite.getBitmap(blocksInfo, galleryRef);
                    if (bitmap) {
                        FieldTileset.tileCache[galleryRef] = bitmapToImageURI(bitmap, 16, false);
                    }
                }
                if (!FieldTileset.galleryTiles.some(([, qname]) => qname === galleryRef)) {
                    const json = FieldTileset.getTileImageJSON({ qualifiedName: galleryRef, data: null }, ws, blocksInfo);
                    if (json) {
                        FieldTileset.galleryTiles.push([json, galleryRef]);
                    }
                }
            }

            FieldTileset.rebuildLock = false;
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
            if (!uri) return undefined;

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
        protected notPresentInTilemap: boolean;

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

        getValue() {
            const v = super.getValue();

            // If the user decompiled from JavaScript, then they might have passed an image literal
            // instead of the qualified name of a tile. The decompiler strips out the "img" part
            // so we need to add it back
            if (typeof v === "string" && v.indexOf(".") === -1 && v.indexOf(`\``) === -1) {
                return `img\`${v}\``
            }
            return v;
        }

        getText() {
            const v = this.getValue();

            if (typeof v === "string" && v.indexOf("`") !== -1) {
                return v;
            }
            return super.getText();
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
