namespace pxt {
    const IMAGE_MIME_TYPE = "image/x-mkcd-f4"
    const TILEMAP_MIME_TYPE = "application/"

    export interface Tile {
        id: string;
        data: string;
        bitmap: pxt.sprite.BitmapData;

        isProjectTile?: boolean;
    }

    export interface TileSet {
        tileWidth: number;
        tiles: Tile[];
    }

    export interface TileSetCollection {
        extensionID: string;
        tileSets: TileSet[];
    }

    export interface ProjectTilemap {
        id: string;
        data: pxt.sprite.TilemapData;
    }

    export class TilemapProject {
        public needsRebuild = true;

        protected extensionTileSets: TileSetCollection[];
        protected projectTileSet: TileSetCollection;
        protected projectTilemaps: ProjectTilemap[];
        protected takenNames: pxt.Map<boolean>;

        constructor(protected pack: MainPackage) {
            this.readTileSets(pack);
        }

        public getGalleryTiles(tileWidth: number): TileSet[] | null {
            if (this.extensionTileSets) {
                return this.extensionTileSets.map(
                    collection => collection.tileSets.find(tileSet => tileSet.tileWidth === tileWidth)
                ).filter(tileSet => tileSet?.tiles.length);
            }
            return null;
        }

        public getProjectTiles(tileWidth: number): TileSet | null {
            if (this.projectTileSet) {
                const res = this.projectTileSet.tileSets.find(tileSet => tileSet.tileWidth === tileWidth);

                if (!res) {
                    // This will create a new tileset with the correct width
                    this.createNewTile(new pxt.sprite.Bitmap(tileWidth, tileWidth).data())
                    return this.getProjectTiles(tileWidth);
                }

                return res;
            }
            return null;
        }

        public createNewTile(data: pxt.sprite.BitmapData) {
            this.needsRebuild = true;
            const prefix = pxt.sprite.TILE_NAMESPACE + "." + pxt.sprite.TILE_PREFIX;

            let index = 0;
            while (this.takenNames[prefix + index]) {
                ++index;
            }
            this.takenNames[prefix + index] = true;

            const newTile = {
                id: prefix + index,
                data: pxt.sprite.base64EncodeBitmap(data),
                bitmap: data,
                isProjectTile: true
            };

            for (const tileSet of this.projectTileSet.tileSets) {
                if (tileSet.tileWidth === data.width) {
                    tileSet.tiles.push(newTile);
                    return newTile
                }
            }

            const newTileset = this.createTileset(data.width);
            newTileset.tiles.push(newTile);

            this.projectTileSet.tileSets.push(newTileset);

            return newTile;
        }

        public updateTile(id: string, data: pxt.sprite.BitmapData) {
            this.needsRebuild = true;
            for (const tileSet of this.projectTileSet.tileSets) {
                for (const tile of tileSet.tiles) {
                    if (tile.id === id) {
                        tile.bitmap = data;
                        tile.data = pxt.sprite.base64EncodeBitmap(data);
                        return;
                    }
                }
            }
        }

        public deleteTile(id: string) {
            this.needsRebuild = true;
            for (const tileSet of this.projectTileSet.tileSets) {
                tileSet.tiles = tileSet.tiles.filter(t => t.id !== id);
            }
        }

        public getProjectTilesetJRes() {
            // FIXME: Need to only include tiles from tilemap.jres. Otherwise we're
            // going to get duplicate entries for extra JRes files (e.g. in github projects)
            const tiles = getAllTiles(this.projectTileSet);

            const blob: pxt.Map<any> = {};

            for (const tile of tiles) {
                // Get the last part of the fully qualified name
                const id = tile.id.substr(tile.id.lastIndexOf(".") + 1);
                blob[id] = {
                    data: tile.data,
                    mimeType: IMAGE_MIME_TYPE,
                    tilemapTile: true
                }
            }

            for (const tilemap of this.projectTilemaps) {
                const jres = this.encodeTilemap(tilemap.data, tilemap.id);
                blob[jres.id] = jres;
            }

            blob["*"] = {
                "mimeType": "image/x-mkcd-f4",
                "dataEncoding": "base64",
                "namespace": pxt.sprite.TILE_NAMESPACE
            };

            return blob;
        }

        public encodeTilemap(tilemap: sprite.TilemapData, id: string): JRes {
            // Encoding
            // tile width (1 byte)
            // tilemap data (4 + width * height bytes)
            // wall data (ceiling(width * height / 2 bytes))
            const tileWidth = pxt.sprite.formatByte(tilemap.tileset.tileWidth, 1);
            const tilemapData = pxt.sprite.hexEncodeTilemap(tilemap.tilemap);
            const wallData = pxt.sprite.uint8ArrayToHex(tilemap.layers.data);

            const data = btoa(tileWidth + tilemapData + wallData);

            return {
                id,
                mimeType: TILEMAP_MIME_TYPE,
                data,
                tileset: tilemap.tileset.tiles.map(t => t.id)
            }
        }

        public getTilemap(id: string) {
            for (const tm of this.projectTilemaps) {
                if (tm.id === id) {
                    return tm.data;
                }
            }
            return null;
        }

        public createNewTilemap(name: string, tileWidth: number, width = 16, height = 16) {
            this.needsRebuild = true;
            let index = 0;
            let base = name;

            while (this.takenNames[name]) {
                name = base  + "_" + index;
                ++index;
            }

            this.takenNames[name] = true;

            const newMap = this.blankTilemap(tileWidth, width, height);
            this.projectTilemaps.push({
                id: name,
                data: newMap
            });

            return newMap;
        }

        public blankTilemap(tileWidth: number, width = 16, height = 16) {
            const tilemap = new pxt.sprite.Tilemap(width, height);
            const layers = new pxt.sprite.Bitmap(width, height);
            const tileset = {
                tileWidth,
                tiles: [this.getTransparency(tileWidth)]
            };

            return new pxt.sprite.TilemapData(tilemap, tileset, layers.data());
        }

        public resolveTile(id: string): Tile {
            const all = [this.projectTileSet].concat(this.extensionTileSets);

            for (const tileSets of all) {
                const found = getTile(tileSets, id);
                if (found) return found;
            }

            return null;
        }

        public getTransparency(tileWidth: number) {
            for (const tileSet of this.projectTileSet.tileSets) {
                if (tileSet.tileWidth === tileWidth) {
                    return tileSet.tiles[0];
                }
            }

            const newTileSet = this.createTileset(tileWidth);
            this.projectTileSet.tileSets.push(newTileSet);
            return newTileSet.tiles[0];
        }

        protected decodeTilemap(jres: JRes) {
            const hex = atob(jres.data);
            const bytes = U.fromHex(hex);

            const tileset: TileSet = {
                tileWidth: bytes[0],
                tiles: jres.tileset.map(id => this.resolveTile(id))
            };

            const tilemapStart = 1;

            const tmWidth = readNumber(bytes, tilemapStart, 2);
            const tmHeight = readNumber(bytes, tilemapStart + 2, 2);
            const tmData = bytes.slice(tilemapStart + 4, tilemapStart + 4 + tmWidth * tmHeight);

            const tilemap = new sprite.Tilemap(tmWidth, tmHeight, 0, 0, new Uint8ClampedArray(tmData));
            const bitmapData = bytes.slice(tilemapStart + 4 + tmWidth * tmHeight);

            const layers = new pxt.sprite.Bitmap(tmWidth, tmHeight, 0, 0, new Uint8ClampedArray(bitmapData)).data();

            return new pxt.sprite.TilemapData(tilemap, tileset, layers);
        }

        protected readTileSets(pack: MainPackage) {
            const allPackages = pack.sortedDeps();
            this.extensionTileSets = [];

            for (const dep of allPackages) {
                const isProject = dep.id === "this";
                const tiles = readTiles(dep, isProject);

                if (tiles) {
                    if (isProject) {
                        this.projectTileSet = tiles
                    }
                    else {
                        this.extensionTileSets.push(tiles);
                    }
                }
                else if (isProject) {
                    this.projectTileSet = {
                        extensionID: "this",
                        tileSets: []
                    };
                }
            }

            this.projectTilemaps = getTilemaps(pack)
                .map(tm => ({
                    id: tm.id,
                    data: this.decodeTilemap(tm)
                }));

            // FIXME: we a re re-parsing the jres here
            const allJRes = pack.getJRes();

            this.takenNames = {};
            for (const id of Object.keys(allJRes)) this.takenNames[id] = true;
        }

        protected createTileset(tileWidth: number) {
            this.needsRebuild = true;
            const tileSet: TileSet = {
                tileWidth,
                tiles: []
            };

            const baseID = pxt.sprite.TILE_NAMESPACE + ".transparency" + tileWidth;

            let transparencyID = baseID;
            let index = 1;

            while (this.resolveTile(transparencyID)) {
                transparencyID = baseID + "_" + index;
                ++index;
            }

            // Always create a transparent tile
            const bitmap = new pxt.sprite.Bitmap(16, 16).data();
            tileSet.tiles.push({
                id: transparencyID,
                bitmap: bitmap,
                data: pxt.sprite.base64EncodeBitmap(bitmap),
                isProjectTile: true
            });

            return tileSet;
        }
    }

    function readTiles(pack: pxt.Package, isProjectTile = false): TileSetCollection | null {
        const allJRes = pack.parseJRes();

        const tiles: Tile[] = [];

        for (const key of Object.keys(allJRes)) {
            const entry = allJRes[key];

            if (entry.tilemapTile) {
                const tile: Tile = {
                    data: entry.data,
                    id: entry.id,
                    bitmap: pxt.sprite.getBitmapFromJResURL(`data:${IMAGE_MIME_TYPE};base64,${entry.data}`).data(),
                    isProjectTile
                };

                tiles.push(tile);
            }
        }

        const tileSets: TileSet[] = [];
        for (const tile of tiles) {
            let foundTileset = false;
            for (const tileset of tileSets) {
                if (tileset.tileWidth === tile.bitmap.width) {
                    tileset.tiles.push(tile);
                    foundTileset = true;
                    break;
                }
            }

            if (!foundTileset) {
                tileSets.push({
                    tileWidth: tile.bitmap.width,
                    tiles: [tile]
                });
            }
        }

        if (!tileSets.length) return null;

        const collection = {
            extensionID: pack.id,
            tileSets: tileSets
        };

        return collection;
    }

    function getTilemaps(pack: pxt.Package): JRes[] {
        const allJRes = pack.parseJRes();

        const res: JRes[] = [];
        for (const key of Object.keys(allJRes)) {
            const entry = allJRes[key];
            if (entry.mimeType === TILEMAP_MIME_TYPE) {
                res.push(entry);
            }
        }

        return res;
    }

    function getAllTiles(tileSets: TileSetCollection) {
        const allTiles: Tile[] = [];

        for (const tileSet of tileSets.tileSets) {
            allTiles.push(...tileSet.tiles);
        }

        return allTiles;
    }

    function readNumber(buf: Uint8Array, offset: number, bytes: number) {
        let start = offset << 1;
        let res = 0;
        for (let i = 0; i < bytes; i++) {
            res |= (buf[start + i]) << (8 * i);
        }
        return res;
    }

    function getTile(tileSets: TileSetCollection, id: string) {
        for (const tileSet of tileSets.tileSets) {
            for (const tile of tileSet.tiles) {
                if (tile.id === id) return tile;
            }
        }
        return null;
    }

    export function emitTilemapsFromJRes(jres: pxt.Map<JRes>) {
        const entries = Object.keys(jres);

        const indent = "    ";
        let out = "";
        for (const key of entries) {
            if (key === "*") continue;

            const entry = jres[key];

            if (entry.tilemapTile) {
                // FIXME: we should get the "image.ofBuffer" and blockIdentity from pxtarget probably
                out += `${indent}//% fixedInstance jres blockIdentity=images._tile\n`
                out += `${indent}export const ${key} = image.ofBuffer(hex\`\`);\n`
            }
        }

        return `namespace ${pxt.sprite.TILE_NAMESPACE} {\n${out}\n}\n`
    }
}