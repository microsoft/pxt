namespace pxt {
    const IMAGE_MIME_TYPE = "image/x-mkcd-f4"
    const TILEMAP_MIME_TYPE = "application/mkcd-tilemap"

    export const enum AssetType {
        Image = "image",
        Tile = "tile",
        Tilemap = "tilemap",
        Animation = "animation"
    }

    export interface AssetMetadata {
        tags?: string[];
        blockIDs?: string[];
    }

    export type Asset = ProjectImage | Tile | Animation | ProjectTilemap;

    export interface BaseAsset {
        id: string;
        meta?: AssetMetadata;
        previewURI?: string;
    }

    export interface ProjectImage extends BaseAsset {
        type: AssetType.Image;
        jresData: string;
        bitmap: pxt.sprite.BitmapData;
    }

    export interface Tile extends BaseAsset {
        type: AssetType.Tile;
        jresData: string;
        bitmap: pxt.sprite.BitmapData;
        isProjectTile?: boolean;
        weight?: number;
    }

    export interface Animation extends BaseAsset {
        type: AssetType.Animation;
        frames: pxt.sprite.BitmapData[];
        interval: number;
    }

    export interface TileSet {
        tileWidth: number;
        tiles: Tile[];
    }

    export interface TileSetCollection {
        extensionID: string;
        tileSets: TileSet[];
    }

    export interface ProjectTilemap extends BaseAsset {
        type: AssetType.Tilemap;
        data: pxt.sprite.TilemapData;
    }

    export interface TilemapSnapshot {
        revision: number;
        projectTilemaps?: ProjectTilemap[];
        projectTileSet?: TileSetCollection;
        takenNames?: pxt.Map<boolean>
        projectImages?: ProjectImage[];
    }

    interface AssetSnapshot {
        revision: number;
        tiles: AssetCollection<Tile>;
        tilemaps: AssetCollection<ProjectTilemap>;
        images: AssetCollection<ProjectImage>;
        animations: AssetCollection<Animation>;
    }

    class AssetCollection<U extends Asset> {
        protected assets: U[] = [];
        protected takenNames: pxt.Map<boolean> = {};

        add(asset: U) {
            if (this.lookupByID(asset.id)) {
                this.update(asset.id, asset);
            }
            else {
                this.assets.push(asset);
                this.takenNames[asset.id] = true;
            }
        }

        getSnapshot(filter?: (asset: U) => boolean) {
            if (filter) {
                return this.assets.filter(a => filter(a)).map(cloneAsset);
            }
            return this.assets.map(cloneAsset);
        }

        update(id: string, newValue: U) {
            this.removeByID(id);
            this.add(cloneAsset(newValue));
        }

        removeByID(id: string): void {
            this.assets = this.assets.filter(a => a.id !== id);
            delete this.takenNames[id];
        }

        getByID(id: string): U {
            const asset = this.lookupByID(id);
            return asset && cloneAsset(asset);
        }

        isIDTaken(id: string) {
            return !!this.takenNames[id];
        }

        generateNewID(varPrefix: string, namespaceString?: string) {
            const prefix = namespaceString ? namespaceString + "." + varPrefix : varPrefix;
            let index = 0;
            while (this.takenNames[prefix + index]) {
                ++index;
            }
            return prefix + index;
        }

        clone() {
            const cloned = new AssetCollection<U>();
            cloned.assets = this.getSnapshot();
            cloned.takenNames = { ...this.takenNames };
            return cloned;
        }

        serializeToJRes(allJRes: pxt.Map<JRes | string> = {}): pxt.Map<JRes | string> {
            for (const asset of this.assets) {
                addAssetToJRes(asset, allJRes);
            }

            return allJRes;
        }

        protected lookupByID(id: string): U {
            for (const asset of this.assets) {
                if (asset.id === id) {
                    return asset;
                }
            }
            return null;
        }
    }

    export class TilemapProject {
        public needsRebuild = true;

        protected extensionTileSets: TileSetCollection[];
        protected state: AssetSnapshot;
        protected gallery: AssetSnapshot;

        protected undoStack: AssetSnapshot[];
        protected redoStack: AssetSnapshot[];

        protected nextID = 0;

        constructor() {
            this.state = {
                revision: this.nextID++,
                tilemaps: new AssetCollection(),
                tiles: new AssetCollection(),
                animations: new AssetCollection(),
                images: new AssetCollection()
            };

            this.gallery = {
                revision: 0,
                tilemaps: new AssetCollection(),
                tiles: new AssetCollection(),
                animations: new AssetCollection(),
                images: new AssetCollection()
            };

            this.undoStack = [];
            this.redoStack = [];
        }

        public createNewImage(width = 16, height = 16) {
            const id = this.state.images.generateNewID(pxt.sprite.IMAGE_PREFIX, pxt.sprite.ASSETS_NAMESPACE,);
            const bitmap = new pxt.sprite.Bitmap(width, height).data()

            const newImage: ProjectImage = {
                id,
                type: AssetType.Image,
                bitmap: bitmap,
                jresData: pxt.sprite.base64EncodeBitmap(bitmap)
            };
            this.state.images.add(newImage);
            return newImage;
        }

        public getGalleryTiles(tileWidth: number): TileSet[] | null {
            if (this.extensionTileSets) {
                return this.extensionTileSets.map(
                    collection => collection.tileSets.find(tileSet => tileSet.tileWidth === tileWidth)
                ).filter(tileSet => tileSet?.tiles.length);
            }
            return null;
        }

        public getProjectImages(): ProjectImage[] {
            return this.state.images.getSnapshot();
        }

        public getProjectTiles(tileWidth: number, createIfMissing: boolean): TileSet | null {
            const tiles = this.state.tiles.getSnapshot((tile => tile.bitmap.width === tileWidth));

            if (tiles.length === 0) {
                if (createIfMissing) {
                    // This will create a new tileset with the correct width
                    this.createNewTile(new pxt.sprite.Bitmap(tileWidth, tileWidth).data())
                    return this.getProjectTiles(tileWidth, false);
                }
                return null;
            }

            return {
                tileWidth,
                tiles
            }
        }

        public createNewTile(data: pxt.sprite.BitmapData, id?: string) {
            this.onChange();

            if (!id || this.state.tiles.isIDTaken(id)) {
                id = this.state.tiles.generateNewID(pxt.sprite.TILE_PREFIX, pxt.sprite.TILE_NAMESPACE);
            }

            const newTile: Tile = {
                id,
                type: AssetType.Tile,
                jresData: pxt.sprite.base64EncodeBitmap(data),
                bitmap: data,
                isProjectTile: true
            };

            this.state.tiles.add(newTile);
            return newTile;
        }

        public updateTile(id: string, data: pxt.sprite.BitmapData) {
            this.onChange();

            const existing = this.state.tiles.getByID(id);

            if (existing) {
                const newValue = {
                    ...existing,
                    bitmap: data,
                    jresData: pxt.sprite.base64EncodeBitmap(data)
                };
                this.state.tiles.update(id, newValue);
                return newValue;
            }

            return null;
        }

        public deleteTile(id: string) {
            this.onChange();
            this.state.tiles.removeByID(id);
        }

        public getProjectTilesetJRes() {
            const blob: pxt.Map<any> = {};

            this.state.tiles.serializeToJRes(blob);
            this.state.tilemaps.serializeToJRes(blob);

            blob["*"] = {
                "mimeType": "image/x-mkcd-f4",
                "dataEncoding": "base64",
                "namespace": pxt.sprite.TILE_NAMESPACE
            };

            return blob;
        }

        public getProjectAssetsJRes() {

            const blob: pxt.Map<any> = {};

            this.state.images.serializeToJRes(blob);
            this.state.animations.serializeToJRes(blob);

            blob["*"] = {
                "mimeType": "image/x-mkcd-f4",
                "dataEncoding": "base64",
                "namespace": pxt.sprite.ASSETS_NAMESPACE
            };

            return blob;
        }

        public getTilemap(id: string) {
            return this.state.tilemaps.getByID(id);
        }

        public getAllTilemaps() {
            return this.state.tilemaps.getSnapshot();
        }

        public updateTilemap(id: string, data: pxt.sprite.TilemapData): ProjectTilemap {

            const existing = this.state.tilemaps.getByID(id);

            if (existing) {
                this.onChange();
                const newValue = {
                    ...existing,
                    data: data,
                };
                this.state.tilemaps.update(id, newValue);
                return newValue;
            }

            return null;
        }

        public createNewTilemap(name: string, tileWidth: number, width = 16, height = 16): [string, pxt.sprite.TilemapData] {
            return this.createNewTilemapFromData(this.blankTilemap(tileWidth, width, height), name)
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
            return this.state.tiles.getByID(id) || this.gallery.tiles.getByID(id);
        }

        public resolveTileByBitmap(data: pxt.sprite.BitmapData): Tile {
            const dataString = pxt.sprite.base64EncodeBitmap(data);
            return this.state.tiles.getSnapshot(tile => tile.jresData === dataString)[0];
        }

        public getTransparency(tileWidth: number) {
            const id = pxt.sprite.TILE_NAMESPACE + ".transparency" + tileWidth;
            let tile = this.state.tiles.getByID(id);

            if (!tile) {
                const bitmap = new pxt.sprite.Bitmap(tileWidth, tileWidth).data();
                tile = {
                    id,
                    type: AssetType.Tile,
                    bitmap: bitmap,
                    jresData: pxt.sprite.base64EncodeBitmap(bitmap),
                    isProjectTile: true
                };

                this.state.tiles.add(tile);
            }
            return tile;
        }

        public createNewTilemapFromData(data: pxt.sprite.TilemapData, name?: string): [string, pxt.sprite.TilemapData] {
            this.onChange()

            const id = this.state.tilemaps.generateNewID(name || lf("level"));
            this.state.tilemaps.add({
                id,
                type: AssetType.Tilemap,
                data: data
            });

            return [id, data];
        }

        protected cloneState(): AssetSnapshot {
            return {
                revision: this.state.revision,
                images: this.state.images.clone(),
                tilemaps: this.state.tilemaps.clone(),
                animations: this.state.animations.clone(),
                tiles: this.state.tiles.clone(),
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

        public forceUpdate() {
            this.onChange();
        }

        public isNameTaken(name: string) {
            return false;
        }

        loadPackage(pack: MainPackage) {
            const allPackages = pack.sortedDeps();
            this.extensionTileSets = [];

            for (const dep of allPackages) {
                const isProject = dep.id === "this";
                const tiles = readTiles(dep.parseJRes(), dep.id, isProject);

                if (tiles) {
                    if (isProject) {
                        for (const tile of tiles) {
                            this.state.tiles.add(tile);
                        }
                    }
                    else {
                        for (const tile of tiles) {
                            this.gallery.tiles.add(tile);
                        }
                    }
                }
            }

            for (const tm of getTilemaps(pack.parseJRes())) {
                this.state.tilemaps.add({
                    type: AssetType.Tilemap,
                    id: tm.id,
                    data: decodeTilemap(tm, id => this.resolveTile(id))
                })
            }
        }

        loadTilemapJRes(jres: Map<JRes>, skipDuplicates = false) {
            jres = inflateJRes(jres)

            const tiles = readTiles(jres, "this", true);

            // If we are loading JRES into an existing project (i.e. in multipart tutorials)
            // we need to correct the tile ids because the user may have created new tiles
            // and taken some of the ids that were used by the tutorial author
            let tileMapping: Map<string> = {};

            for (const tile of tiles) {
                if (skipDuplicates) {
                    const existing = this.resolveTileByBitmap(tile.bitmap);
                    if (existing) {
                        tileMapping[tile.id] = existing.id;
                        continue;
                    }
                }

                const newTile = this.createNewTile(tile.bitmap, tile.id);

                if (newTile.id !== tile.id) {
                    tileMapping[tile.id] = newTile.id;
                }
            }

            for (const tm of getTilemaps(jres)) {
                this.state.tilemaps.add({
                    type: AssetType.Tilemap,
                    id: tm.id,
                    data: decodeTilemap(tm, id => {
                        if (tileMapping[id]) {
                            id = tileMapping[id];
                        }

                        return this.resolveTile(id)
                    })
                })
            }
        }

        loadAssetsJRes(jres: Map<JRes>) {
            for (const key of Object.keys(jres)) {
                const entry = jres[key];

                if (entry.mimeType === IMAGE_MIME_TYPE) {
                    this.state.images.add({
                        type: AssetType.Image,
                        id: entry.id,
                        jresData: entry.data,
                        bitmap: pxt.sprite.getBitmapFromJResURL(`data:${IMAGE_MIME_TYPE};base64,${entry.data}`).data()
                    })
                }
            }
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
            const bitmap = new pxt.sprite.Bitmap(tileWidth, tileWidth).data();
            tileSet.tiles.push({
                id: transparencyID,
                type: AssetType.Tile,
                bitmap: bitmap,
                jresData: pxt.sprite.base64EncodeBitmap(bitmap),
                isProjectTile: true
            });

            return tileSet;
        }

        protected onChange() {
            this.needsRebuild = true;
            this.state.revision = this.nextID++;
        }
    }

    function readTiles(allJRes: Map<JRes>, id: string, isProjectTile = false): Tile[] {
        const tiles: Tile[] = [];

        for (const key of Object.keys(allJRes)) {
            const entry = allJRes[key];

            if (entry.tilemapTile) {
                const tile: Tile = {
                    type: AssetType.Tile,
                    jresData: entry.data,
                    id: entry.id,
                    bitmap: pxt.sprite.getBitmapFromJResURL(`data:${IMAGE_MIME_TYPE};base64,${entry.data}`).data(),
                    isProjectTile
                };

                tiles.push(tile);
            }
        }

        return tiles;
    }

    function getTilemaps(allJRes: Map<JRes>): JRes[] {
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
                `${indent}${indent}switch(helpers.stringTrim(name)) {\n` +
                tilemapEntries.map(t => `${indent}${indent}${indent}${t}`).join("\n") + "\n" +
                `${indent}${indent}}\n` +
                `${indent}${indent}return null;\n` +
                `${indent}})\n`
        }


        const warning = lf("Auto-generated code. Do not edit.");

        return `// ${warning}\nnamespace ${pxt.sprite.TILE_NAMESPACE} {\n${out}\n}\n// ${warning}\n`
    }

    export function emitProjectImages(jres: pxt.Map<JRes>) {
        const entries = Object.keys(jres);

        const indent = "    ";
        let out = "";

        for (const key of entries) {
            if (key === "*") continue;

            const entry = jres[key];

            if (entry.mimeType === IMAGE_MIME_TYPE) {
                // FIXME: we should get the "image.ofBuffer" and blockIdentity from pxtarget probably
                out += `${indent}//% fixedInstance jres blockIdentity=images._image\n`
                out += `${indent}export const ${key} = image.ofBuffer(hex\`\`);\n`
            }
        }


        const warning = lf("Auto-generated code. Do not edit.");

        return `// ${warning}\nnamespace ${pxt.sprite.ASSETS_NAMESPACE} {\n${out}\n}\n// ${warning}\n`
    }

    function cloneBitmap(bitmap: sprite.BitmapData) {
        return pxt.sprite.Bitmap.fromData(bitmap).copy().data();
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

    function cloneAsset<U extends Asset>(asset: U): U {
        switch (asset.type) {
            case AssetType.Tile:
            case AssetType.Image:
                return {
                    ...asset,
                    bitmap: cloneBitmap((asset as ProjectImage | Tile).bitmap)
                };
            case AssetType.Animation:
                return {
                    ...asset,
                    frames: (asset as Animation).frames.map(frame => cloneBitmap(frame))
                };
            case AssetType.Tilemap:
                return {
                    ...asset,
                    data: (asset as ProjectTilemap).data.cloneData()
                };
        }
    }


    function addAssetToJRes(asset: Asset, allJRes: pxt.Map<Partial<JRes> | string>): void {
        // Get the last part of the fully qualified name
        const id = asset.id.substr(asset.id.lastIndexOf(".") + 1);

        switch (asset.type) {
            case AssetType.Image:
                allJRes[id] = asset.jresData;
                break;
            case AssetType.Tile:
                allJRes[id] = {
                    data: asset.jresData,
                    mimeType: IMAGE_MIME_TYPE,
                    tilemapTile: true
                };
                break;
            case AssetType.Tilemap:
                // we include the full ID for tilemaps
                const serialized = serializeTilemap(asset.data, asset.id);
                allJRes[serialized.id] = serialized;
                break;

            case AssetType.Animation:
                // TODO: riknoll

        }
    }

    function serializeTilemap(tilemap: sprite.TilemapData, id: string): JRes {
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
}