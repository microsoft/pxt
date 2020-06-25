namespace pxt {
    const IMAGE_MIME_TYPE = "image/x-mkcd-f4"
    const TILEMAP_MIME_TYPE = "application/mkcd-tilemap"

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

    export interface TilemapSnapshot {
        revision: number;
        projectTilemaps?: ProjectTilemap[];
        projectTileSet?: TileSetCollection;
        takenNames?: pxt.Map<boolean>
    }

    export class TilemapProject {
        public needsRebuild = true;

        protected extensionTileSets: TileSetCollection[];
        protected state: TilemapSnapshot;

        protected undoStack: TilemapSnapshot[];
        protected redoStack: TilemapSnapshot[];

        protected nextID = 0;

        constructor(protected pack: MainPackage) {
            this.state = {
                revision: this.nextID++
            };

            this.readTileSets(pack);
            this.undoStack = [];
            this.redoStack = [];
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
            if (this.state.projectTileSet) {
                const res = this.state.projectTileSet.tileSets.find(tileSet => tileSet.tileWidth === tileWidth);

                if (!res) {
                    // This will create a new tileset with the correct width
                    this.createNewTile(new pxt.sprite.Bitmap(tileWidth, tileWidth).data())
                    return this.getProjectTiles(tileWidth);
                }

                return res;
            }
            return null;
        }

        public createNewTile(data: pxt.sprite.BitmapData, id?: string) {
            this.onChange();

            if (!id || this.state.takenNames[id]) {
                const prefix = pxt.sprite.TILE_NAMESPACE + "." + pxt.sprite.TILE_PREFIX;

                // Start at 1 because the legacy tilemaps used myTiles.myTile0 for transparency and
                // we want to be able to count on that
                let index = 1;
                while (this.state.takenNames[prefix + index]) {
                    ++index;
                }
                id = prefix + index;
            }

            this.state.takenNames[id] = true;

            const newTile = {
                id,
                data: pxt.sprite.base64EncodeBitmap(data),
                bitmap: data,
                isProjectTile: true
            };

            for (const tileSet of this.state.projectTileSet.tileSets) {
                if (tileSet.tileWidth === data.width) {
                    tileSet.tiles.push(newTile);
                    return newTile
                }
            }

            const newTileset = this.createTileset(data.width);
            newTileset.tiles.push(newTile);

            this.state.projectTileSet.tileSets.push(newTileset);

            return newTile;
        }

        public updateTile(id: string, data: pxt.sprite.BitmapData) {
            this.onChange();
            for (const tileSet of this.state.projectTileSet.tileSets) {
                for (const tile of tileSet.tiles) {
                    if (tile.id === id) {
                        tile.bitmap = data;
                        tile.data = pxt.sprite.base64EncodeBitmap(data);
                        return tile;
                    }
                }
            }

            return null;
        }

        public deleteTile(id: string) {
            this.onChange();
            for (const tileSet of this.state.projectTileSet.tileSets) {
                tileSet.tiles = tileSet.tiles.filter(t => t.id !== id);
            }
        }

        public getProjectTilesetJRes() {
            // FIXME: Need to only include tiles from tilemap.jres. Otherwise we're
            // going to get duplicate entries for extra JRes files (e.g. in github projects)
            const tiles = getAllTiles(this.state.projectTileSet);

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

            for (const tilemap of this.state.projectTilemaps) {
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

        public getTilemap(id: string) {
            for (const tm of this.state.projectTilemaps) {
                if (tm.id === id) {
                    return tm.data;
                }
            }
            return null;
        }

        public updateTilemap(id: string, data: pxt.sprite.TilemapData) {
            for (const tm of this.state.projectTilemaps) {
                if (tm.id === id) {
                    this.onChange();
                    tm.data = data;
                }
            }
        }

        public createNewTilemap(name: string, tileWidth: number, width = 16, height = 16): [string, pxt.sprite.TilemapData] {
            this.onChange()
            let index = 0;
            let base = name;

            while (this.state.takenNames[name]) {
                name = base  + "_" + index;
                ++index;
            }

            this.state.takenNames[name] = true;

            const newMap = this.blankTilemap(tileWidth, width, height);
            this.state.projectTilemaps.push({
                id: name,
                data: newMap
            });

            return [name, newMap];
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
            const all = [this.state.projectTileSet].concat(this.extensionTileSets);

            for (const tileSets of all) {
                const found = getTile(tileSets, id);
                if (found) return found;
            }

            return null;
        }

        public getTransparency(tileWidth: number) {
            for (const tileSet of this.state.projectTileSet.tileSets) {
                if (tileSet.tileWidth === tileWidth) {
                    return tileSet.tiles[0];
                }
            }

            const newTileSet = this.createTileset(tileWidth);
            this.state.projectTileSet.tileSets.push(newTileSet);
            return newTileSet.tiles[0];
        }

        protected cloneState(): TilemapSnapshot {
            return {
                ...this.state,
                projectTileSet: {
                    ...this.state.projectTileSet,
                    tileSets: this.state.projectTileSet.tileSets.map(t => ({ ...t, tiles: t.tiles.map(cloneTile) }))
                },
                projectTilemaps: this.state.projectTilemaps.slice(),
                takenNames: {
                    ...this.state.takenNames
                }
            }
        }

        public undo() {
            if (this.undoStack.length) {
                const undo = this.undoStack.pop();
                this.redoStack.push(this.state);
                this.state = undo;
                this.needsRebuild = true;
            }
        }

        public redo() {
            if (this.redoStack.length) {
                const redo = this.redoStack.pop();
                this.undoStack.push(this.state);
                this.state = redo;
                this.needsRebuild = true;
            }
        }

        public pushUndo() {
            if (this.undoStack.length && this.undoStack[this.undoStack.length - 1].revision === this.state.revision) return;
            this.redoStack = [];
            this.undoStack.push(this.state);
            this.state = this.cloneState();
        }

        public revision() {
            return this.state.revision;
        }

        public encodeTilemap(tilemap: sprite.TilemapData, id: string): JRes {
            const tm = tilemap.tilemap.data();
            const data = new Uint8ClampedArray(5 + tm.data.length + tilemap.layers.data.length);

            data[0] = tilemap.tileset.tileWidth;
            data[1] = tm.width & 0xff
            data[2] = (tm.width >> 8) & 0xff
            data[3] = tm.height & 0xff
            data[4] = (tm.height >> 8) & 0xff
            data.set(tm.data, 5);
            data.set(tilemap.layers.data, 5 + tm.data.length);

            return {
                id,
                mimeType: TILEMAP_MIME_TYPE,
                data: btoa(pxt.sprite.uint8ArrayToHex(data)),
                tileset: tilemap.tileset.tiles.map(t => t.id)
            }
        }

        protected readTileSets(pack: MainPackage) {
            const allPackages = pack.sortedDeps();
            this.extensionTileSets = [];

            for (const dep of allPackages) {
                const isProject = dep.id === "this";
                const tiles = readTiles(dep, isProject);

                if (tiles) {
                    if (isProject) {
                        this.state.projectTileSet = tiles
                    }
                    else {
                        this.extensionTileSets.push(tiles);
                    }
                }
                else if (isProject) {
                    this.state.projectTileSet = {
                        extensionID: "this",
                        tileSets: []
                    };
                }
            }

            this.state.projectTilemaps = getTilemaps(pack)
                .map(tm => ({
                    id: tm.id,
                    data: decodeTilemap(tm, id => this.resolveTile(id))
                }));

            // FIXME: we are re-parsing the jres here
            const allJRes = pack.getJRes();

            this.state.takenNames = {};
            for (const id of Object.keys(allJRes)) this.state.takenNames[id] = true;
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

        protected onChange() {
            this.needsRebuild = true;
            this.state.revision = this.nextID++;
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

        const tilemapEntries: string[] = [];
        for (const key of entries) {
            if (key === "*") continue;

            const entry = jres[key];

            if (entry.tilemapTile) {
                // FIXME: we should get the "image.ofBuffer" and blockIdentity from pxtarget probably
                out += `${indent}//% fixedInstance jres blockIdentity=images._tile\n`
                out += `${indent}export const ${key} = image.ofBuffer(hex\`\`);\n`
            }

            if (entry.mimeType === TILEMAP_MIME_TYPE) {
                const tm = decodeTilemap(entry);

                tilemapEntries.push(`case "${key}": return ${pxt.sprite.encodeTilemap(tm, "typescript")}`)
            }
        }

        if (tilemapEntries.length) {
            out += "\n" +
                `${indent}helpers.registerTilemapFactory(function(name: string) {\n` +
                `${indent}${indent}switch(name) {\n` +
                tilemapEntries.map(t => `${indent}${indent}${indent}${t}`).join("\n") + "\n" +
                `${indent}${indent}}\n` +
                `${indent}${indent}return null;\n` +
                `${indent}})\n`
        }


        const warning = lf("Auto-generated code. Do not edit.");

        return `// ${warning}\nnamespace ${pxt.sprite.TILE_NAMESPACE} {\n${out}\n}\n// ${warning}\n`
    }


    function cloneTile(tile: Tile) {
        return {
            ...tile,
            bitmap: pxt.sprite.Bitmap.fromData(tile.bitmap).copy().data()
        }
    }

    function decodeTilemap(jres: JRes, resolveTile?: (id: string) => Tile) {
        const hex = atob(jres.data);
        const bytes = U.fromHex(hex);

        const tmWidth = bytes[1] | (bytes[2] << 8);
        const tmHeight = bytes[3] | (bytes[4] << 8);

        const tileset: TileSet = {
            tileWidth: bytes[0],
            tiles: jres.tileset.map(id => (resolveTile && resolveTile(id)) || { id } as any)
        };

        const tilemapStart = 5;
        const tmData = bytes.slice(tilemapStart, tilemapStart + tmWidth * tmHeight);

        const tilemap = new sprite.Tilemap(tmWidth, tmHeight, 0, 0, new Uint8ClampedArray(tmData));
        const bitmapData = bytes.slice(tilemapStart + tmData.length);

        const layers = new pxt.sprite.Bitmap(tmWidth, tmHeight, 0, 0, new Uint8ClampedArray(bitmapData)).data();

        return new pxt.sprite.TilemapData(tilemap, tileset, layers);
    }
}