namespace pxt {
    export const IMAGE_MIME_TYPE = "image/x-mkcd-f4"
    export const TILEMAP_MIME_TYPE = "application/mkcd-tilemap"
    export const ANIMATION_MIME_TYPE = "application/mkcd-animation"
    export const SONG_MIME_TYPE = "application/mkcd-song"
    export const JSON_MIME_TYPE = "application/json";

    export const enum AssetType {
        Image = "image",
        Tile = "tile",
        Tilemap = "tilemap",
        Animation = "animation",
        Song = "song",
        Json = "json"
    }

    export interface AssetMetadata {
        displayName?: string;
        tags?: string[];
        blockIDs?: string[];
        temporaryInfo?: TemporaryAssetInfo;
        package?: string;
    }

    export interface TemporaryAssetInfo {
        blockId: string;
        fieldName: string;
    }

    export type Asset = ProjectImage | Tile | Animation | ProjectTilemap | Song | JsonAsset;

    export interface BaseAsset {
        internalID: number;
        id: string;
        meta: AssetMetadata;
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
    }

    export interface Animation extends BaseAsset {
        type: AssetType.Animation;
        frames: pxt.sprite.BitmapData[];
        flippedHorizontal?: boolean;
        frameIds?: string[];
        framePreviewURIs?: string[];
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

    export interface Song extends BaseAsset {
        type: AssetType.Song;
        song: assets.music.Song;
    }

    export interface JsonAsset extends BaseAsset {
        type: AssetType.Json;
        data: any;
        fileName?: string;
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
        assets: pxt.Map<AssetCollection<Asset>>; // key is AssetType
    }

    interface AssetSnapshotDiff {
        beforeRevision: number;
        afterRevision: number;
        assetDiffs: pxt.Map<AssetCollectionDiff<Asset>>;
    }

    interface AssetUpdateListener {
        internalID: number;
        callback: () => void;
    }

    interface AssetCollectionDiff<U> {
        before: U[];
        after: U[];
    }

    class AssetCollection<U extends Asset> {
        protected assets: U[] = [];
        protected takenNames: pxt.Map<boolean> = {};
        protected listeners: AssetUpdateListener[] = [];

        constructor(public readonly type: string) {
        }

        add(asset: U) {
            if (this.takenNames[asset.id]) {
                return this.update(asset.id, asset);
            }
            else {
                const clone = cloneAsset(asset);
                this.takenNames[clone.id] = true;
                this.takenNames[getShortIDForAsset(clone)] = true;

                if (clone.meta.displayName && clone.meta.displayName !== clone.id) {
                    if (this.takenNames[clone.meta.displayName]) {
                        clone.meta.displayName = this.generateNewDisplayName(clone.meta.displayName);
                    }

                    this.takenNames[clone.meta.displayName] = true;
                }
                this.assets.push(clone);

                return cloneAsset(clone);
            }
        }

        getSnapshot(filter?: (asset: U) => boolean) {
            if (filter) {
                return this.assets.filter(a => filter(a)).map(a => cloneAsset(a));
            }
            return this.assets.map(a => cloneAsset(a));
        }

        update(id: string, newValue: U) {
            let asset: U;

            if (this.takenNames[id]) {
                const existing = this.lookupByID(id);

                if (!assetEquals(existing, newValue)) {
                    if (!validateAsset(newValue) && validateAsset(existing)) {
                        pxt.warn("Refusing to overwrite asset with invalid version");
                        pxt.tickEvent("assets.invalidAssetOverwrite", { assetType: newValue.type });
                        return existing;
                    }

                    this.removeByID(id);
                    asset = this.add(newValue);
                    this.notifyListener(newValue.internalID);
                }
                else {
                    asset = newValue;
                }
            }
            else {
                asset = this.add(newValue);
            }

            return asset;
        }

        removeByID(id: string): void {
            const existing = this.lookupByID(id);
            this.assets = this.assets.filter(a => a.id !== id);
            delete this.takenNames[id];
            if (existing) {
                delete this.takenNames[getShortIDForAsset(existing)]
            }
            if (existing?.meta.displayName) {
                delete this.takenNames[existing?.meta.displayName];
            }
        }

        getByID(id: string): U {
            const asset = this.lookupByID(id);
            return asset && cloneAsset(asset);
        }

        getByDisplayName(name: string): U {
            if (this.takenNames[name]) {
                for (const asset of this.assets) {
                    if (asset.meta.displayName === name || getShortIDForAsset(asset) === name) {
                        return cloneAsset(asset);
                    }
                }
            }
            return undefined;
        }

        getByValue(toFind: U) {
            for (const asset of this.assets) {
                if (assetEquals(toFind, asset, true)) {
                    return asset;
                }
            }
            return undefined;
        }

        isIDTaken(id: string) {
            return !!this.takenNames[id];
        }

        clone() {
            const cloned = new AssetCollection<U>(this.type);
            cloned.assets = this.getSnapshot();
            cloned.takenNames = { ...this.takenNames };
            return cloned;
        }

        serializeToJRes(allJRes: pxt.Map<JRes | string> = {}, filter?: (asset: U) => boolean): pxt.Map<JRes | string> {
            for (const asset of this.assets) {
                if (filter && !filter(asset)) continue;
                addAssetToJRes(asset, allJRes);
            }

            return allJRes;
        }

        addListener(internalID: number, listener: () => void) {
            this.listeners.push({ internalID, callback: listener })
        }

        removeListener(listener: () => void) {
            this.listeners = this.listeners.filter(ref => ref.callback !== listener);
        }

        diff(past: AssetCollection<U>) {
            let diff: AssetCollectionDiff<U> = {
                before: [],
                after: []
            };

            let handled: {[index: number]: boolean} = {};

            for (const pastAsset of past.assets) {
                handled[pastAsset.internalID] = true;
                const futureAsset = this.lookupByInternalID(pastAsset.internalID);
                if (!futureAsset || !assetEquals(pastAsset, futureAsset)) {
                    diff.before.push(pastAsset);
                    diff.after.push(futureAsset);
                }
            }

            for (const futureAsset of this.assets.filter(a => !handled[a.internalID])) {
                diff.before.push(null);
                diff.after.push(futureAsset);
            }

            return diff;
        }

        applyDiff(diff: AssetCollectionDiff<U>, backwards = false) {
            const before = backwards ? diff.after : diff.before;
            const after = backwards ? diff.before : diff.after;
            pxt.Util.assert(before.length === after.length);

            for (let i = 0; i < before.length; i++) {
                if (!before[i]) {
                    this.assets.push(after[i]);
                    this.notifyListener(after[i].internalID);
                    continue;
                }
                this.removeByInternalID(before[i].internalID)
                if (after[i]) {
                    this.assets.push(after[i]);
                }
                this.notifyListener(before[i].internalID);
            }

            this.takenNames = {};
            for (const asset of this.assets) {
                pxt.Util.assert(!this.takenNames[asset.id]);
                this.takenNames[asset.id] = true;
                this.takenNames[getShortIDForAsset(asset)] = true;

                if (asset.meta.displayName) {
                    if (asset.meta.displayName !== asset.id) pxt.Util.assert(!this.takenNames[asset.meta.displayName]);
                    this.takenNames[asset.meta.displayName] = true;
                }
            }
        }

        protected lookupByID(id: string): U {
            for (const asset of this.assets) {
                if (asset.id === id) {
                    return asset;
                }
            }
            return null;
        }

        protected lookupByInternalID(id: number): U {
            for (const asset of this.assets) {
                if (asset.internalID === id) {
                    return asset;
                }
            }
            return null;
        }

        protected removeByInternalID(id: number): void {
            this.assets = this.assets.filter(a => a.internalID !== id);
        }

        protected notifyListener(internalID: number) {
            for (const listener of this.listeners) {
                if (listener.internalID === internalID) listener.callback();
            }
        }

        protected generateNewDisplayName(prefix: string) {
            prefix = prefix.replace(/\d+$/, "");
            let index = 0;
            while (this.takenNames[prefix + index]) {
                ++index;
            }
            return prefix + index;
        }
    }

    export class TilemapProject {
        public needsRebuild = true;

        protected static nextRevision = 0;

        protected extensionTileSets: TileSetCollection[];
        protected state: AssetSnapshot;
        protected committedState: AssetSnapshot;

        protected gallery: AssetSnapshot;

        protected undoStack: AssetSnapshotDiff[];
        protected redoStack: AssetSnapshotDiff[];

        protected nextID = 0;
        protected nextInternalID = 0;

        constructor() {
            this.committedState = {
                revision: TilemapProject.nextRevision++,
                assets: {
                    [AssetType.Image]: new AssetCollection(AssetType.Image),
                    [AssetType.Tile]: new AssetCollection(AssetType.Tile),
                    [AssetType.Tilemap]: new AssetCollection(AssetType.Tilemap),
                    [AssetType.Animation]: new AssetCollection(AssetType.Animation),
                    [AssetType.Song]: new AssetCollection(AssetType.Song),
                    [AssetType.Json]: new AssetCollection(AssetType.Json),
                }
            };
            this.state = {
                revision: TilemapProject.nextRevision++,
                assets: {
                    [AssetType.Image]: new AssetCollection(AssetType.Image),
                    [AssetType.Tile]: new AssetCollection(AssetType.Tile),
                    [AssetType.Tilemap]: new AssetCollection(AssetType.Tilemap),
                    [AssetType.Animation]: new AssetCollection(AssetType.Animation),
                    [AssetType.Song]: new AssetCollection(AssetType.Song),
                    [AssetType.Json]: new AssetCollection(AssetType.Json),
                }
            };

            this.gallery = {
                revision: 0,
                assets: {
                    [AssetType.Image]: new AssetCollection(AssetType.Image),
                    [AssetType.Tile]: new AssetCollection(AssetType.Tile),
                    [AssetType.Tilemap]: new AssetCollection(AssetType.Tilemap),
                    [AssetType.Animation]: new AssetCollection(AssetType.Animation),
                    [AssetType.Song]: new AssetCollection(AssetType.Song),
                    [AssetType.Json]: new AssetCollection(AssetType.Json),
                }
            };

            this.undoStack = [];
            this.redoStack = [];
        }

        public getNewInternalId() {
            return this.nextInternalID++;
        }

        public createNewImage(width = 16, height = 16) {
            this.onChange();
            const id = this.generateNewID(AssetType.Image);
            const bitmap = new pxt.sprite.Bitmap(width, height).data()

            const newImage: ProjectImage = {
                internalID: this.getNewInternalId(),
                id,
                type: AssetType.Image,
                bitmap: bitmap,
                meta: {},
                jresData: pxt.sprite.base64EncodeBitmap(bitmap)
            };
            return this.getAssetCollection(AssetType.Image).add(newImage);
        }

        public createNewAnimation(width = 16, height = 16) {
            this.onChange();
            const id = this.generateNewID(AssetType.Animation);
            const bitmap = new pxt.sprite.Bitmap(width, height).data()

            const newAnimation: Animation = {
                internalID: this.getNewInternalId(),
                id,
                type: AssetType.Animation,
                frames: [bitmap],
                interval: 500,
                meta: {},
            };
            return this.getAssetCollection(AssetType.Animation).add(newAnimation);
        }

        public createNewAnimationFromData(frames: pxt.sprite.BitmapData[], interval = 500, displayName?: string) {
            this.onChange();
            const id = this.generateNewID(AssetType.Animation);

            const newAnimation: Animation = {
                internalID: this.getNewInternalId(),
                id,
                type: AssetType.Animation,
                frames,
                interval,
                meta: { displayName },
            };
            return this.getAssetCollection(AssetType.Animation).add(newAnimation);
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
            return this.getAssetCollection(AssetType.Image).getSnapshot();
        }

        public getProjectTiles(tileWidth: number, createIfMissing: boolean): TileSet | null {
            const tiles = this.getAssetCollection(AssetType.Tile).getSnapshot(tile => tile.bitmap.width === tileWidth);

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

        public createNewTile(data: pxt.sprite.BitmapData, id?: string, displayName?: string) {
            this.onChange();

            if (!id || this.isNameTaken(AssetType.Tile, id)) {
                id = this.generateNewID(AssetType.Tile);
            }

            const newTile: Tile = {
                internalID: this.getNewInternalId(),
                id,
                type: AssetType.Tile,
                jresData: pxt.sprite.base64EncodeBitmap(data),
                bitmap: data,
                meta: {
                    displayName
                },
                isProjectTile: true
            };

            return this.getAssetCollection(AssetType.Tile).add(newTile);
        }

        public createNewProjectImage(data: pxt.sprite.BitmapData, displayName?: string) {
            this.onChange();

            const newImage: ProjectImage = {
                internalID: this.getNewInternalId(),
                id: this.generateNewID(AssetType.Image),
                type: AssetType.Image,
                jresData: pxt.sprite.base64EncodeBitmap(data),
                meta: {
                    displayName
                },
                bitmap: data
            };

            return this.getAssetCollection(AssetType.Image).add(newImage);
        }

        public createNewSong(data: pxt.assets.music.Song, displayName?: string) {
            this.onChange();

            const newSong: Song = {
                internalID: this.getNewInternalId(),
                id: this.generateNewID(AssetType.Song),
                type: AssetType.Song,
                song: pxt.assets.music.cloneSong(data),
                meta: {
                    displayName
                },
            };

            return this.getAssetCollection(AssetType.Song).add(newSong);
        }

        public createNewJsonAsset(data: any, fileName?: string, displayName?: string) {
            this.onChange();

            const newSong: JsonAsset = {
                internalID: this.getNewInternalId(),
                id: this.generateNewID(AssetType.Json),
                type: AssetType.Json,
                data,
                fileName,
                meta: {
                    displayName
                },
            };

            return this.getAssetCollection(AssetType.Json).add(newSong);
        }

        public updateTile(tile: pxt.Tile) {
            this.onChange();

            const existing = this.resolveProjectTileByInternalID(tile.internalID);

            if (existing) {
                this.getAssetCollection(AssetType.Tile).update(existing.id, tile);

                if (existing.id !== tile.id || !pxt.sprite.bitmapEquals(existing.bitmap, tile.bitmap)) {
                    for (const tm of this.getAssets(AssetType.Tilemap)) {
                        if (tm.data.tileset.tiles.some(t => t.internalID === tile.internalID)) {

                            tm.data.tileset.tiles = tm.data.tileset.tiles.map(t => t.internalID === tile.internalID ? tile : t);
                            this.updateTilemap(tm.id, tm.data);
                        }
                    }
                }
                return tile;
            }

            return null;
        }

        public deleteTile(id: string) {
            this.onChange();
            this.getAssetCollection(AssetType.Tile).removeByID(id);
        }

        public getProjectTilesetJRes(projectFiles?: pxt.Map<{content: string}>) {
            const blob: pxt.Map<any> = {};

            this.getAssetCollection(AssetType.Tile).serializeToJRes(blob);

            // tilemaps are always named assets, so if the user creates a bunch by
            // accident (e.g. by dragging out blocks) we want to only serialize the ones
            // that are actually used/nonempty
            this.getAssetCollection(AssetType.Tilemap).serializeToJRes(blob, asset => {
                if (!projectFiles) return true;

                return !pxt.sprite.isTilemapEmptyOrUnused(asset, this, projectFiles)
            });

            blob["*"] = {
                "mimeType": "image/x-mkcd-f4",
                "dataEncoding": "base64",
                "namespace": pxt.sprite.TILE_NAMESPACE
            };

            return blob;
        }

        public getProjectAssetsJRes() {

            const blob: pxt.Map<any> = {};

            for (const type of Object.keys(this.state.assets)) {
                if (type !== AssetType.Tilemap && type !== AssetType.Tile) {
                    this.state.assets[type].serializeToJRes(blob);
                }
            }

            blob["*"] = {
                "mimeType": "image/x-mkcd-f4",
                "dataEncoding": "base64",
                "namespace": pxt.sprite.IMAGES_NAMESPACE
            };

            return blob;
        }

        public getTilemap(id: string) {
            return this.getAssetCollection(AssetType.Tilemap).getByID(id);
        }

        public updateTilemap(id: string, data: pxt.sprite.TilemapData): ProjectTilemap {

            const existing = this.getAssetCollection(AssetType.Tilemap).getByID(id);

            if (existing) {
                this.onChange();
                const newValue = {
                    ...existing,
                    data: data,
                };
                this.getAssetCollection(AssetType.Tilemap).update(id, newValue);
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
            return this.lookupAsset(AssetType.Tile, id) as Tile;
        }

        public resolveProjectTileByInternalID(id: number): Tile {
            return this.getAssetCollection(AssetType.Tile).getSnapshot(tile => tile.internalID === id)[0];
        }

        public resolveTileByBitmap(data: pxt.sprite.BitmapData): Tile {
            const dataString = pxt.sprite.base64EncodeBitmap(data);
            return this.getAssetCollection(AssetType.Tile).getSnapshot(tile => tile.jresData === dataString)[0];
        }

        public getTransparency(tileWidth: number) {
            const id = pxt.sprite.TILE_NAMESPACE + ".transparency" + tileWidth;
            let tile = this.getAssetCollection(AssetType.Tile).getByID(id);

            if (!tile) {
                const bitmap = new pxt.sprite.Bitmap(tileWidth, tileWidth).data();
                tile = {
                    internalID: this.getNewInternalId(),
                    id,
                    type: AssetType.Tile,
                    bitmap: bitmap,
                    jresData: pxt.sprite.base64EncodeBitmap(bitmap),
                    meta: {},
                    isProjectTile: true
                };

                return this.getAssetCollection(AssetType.Tile).add(tile);
            }
            return tile;
        }

        public createNewTilemapFromData(data: pxt.sprite.TilemapData, name?: string): [string, pxt.sprite.TilemapData] {
            this.onChange()

            const id = this.generateNewIDInternal(AssetType.Tilemap, name || lf("level"));
            this.getAssetCollection(AssetType.Tilemap).add({
                internalID: this.getNewInternalId(),
                id,
                type: AssetType.Tilemap,
                meta: {
                    displayName: name || id
                },
                data: data
            });

            return [id, data];
        }

        protected cloneState(): AssetSnapshot {
            const result: AssetSnapshot = {
                revision: this.state.revision,
                assets: {}
            };

            for (const type of Object.keys(this.state.assets)) {
                result.assets[type] = this.state.assets[type].clone();
            }

            return result;
        }

        public undo() {
            if (this.state.revision !== this.committedState.revision) {
                this.pushUndo();
            }
            if (this.undoStack.length) {
                const undo = this.undoStack.pop();

                for (const key of Object.keys(undo.assetDiffs)) {
                    this.getAssetCollection(key as AssetType).applyDiff(undo.assetDiffs[key], true);
                }

                this.state.revision = undo.beforeRevision;

                this.redoStack.push(undo);

                this.committedState = this.cloneState();
                this.needsRebuild = true;
            }
        }

        public redo() {
            if (this.redoStack.length) {
                const redo = this.redoStack.pop();

                for (const key of Object.keys(redo.assetDiffs)) {
                    this.getAssetCollection(key as AssetType).applyDiff(redo.assetDiffs[key]);
                }

                this.state.revision = redo.afterRevision;

                this.undoStack.push(redo);

                this.committedState = this.cloneState();
                this.needsRebuild = true;
            }
        }

        public pushUndo() {
            if (this.undoStack.length && this.committedState.revision === this.state.revision) return;
            this.redoStack = [];
            this.undoStack.push({
                beforeRevision: this.committedState.revision,
                afterRevision: this.state.revision,
                assetDiffs: {}
            });

            const entry = this.undoStack[this.undoStack.length - 1];
            for (const type of Object.keys(this.state.assets)) {
                entry.assetDiffs[type] = this.state.assets[type].diff(this.committedState.assets[type]);
            }

            this.committedState = this.cloneState();
            this.cleanupTemporaryAssets();
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

        public isNameTaken(assetType: AssetType, name: string) {
            const isTaken = (id: string) => {
                return this.getAssetCollection(assetType).isIDTaken(id) ||
                    this.getAssetCollection(assetType, true).isIDTaken(id);
            }

            const shortId = getShortIDCore(assetType, name);
            const checkShortId = shortId && shortId !== name;

            return isTaken(name) || (checkShortId && isTaken(shortId));
        }

        /**
         * Checks if the asset is referenced anywhere in the user's code.
         * If an asset is referenced in any block we return true, as well
         * as if a tile is used in any tilemap.
         *
         * Ways to reference an asset in TS/Python:
         *
         * TILES:
         * myTiles.shortId
         * assets.tile`shortId`
         * assets.tile`displayName`
         *
         * IMAGES:
         * assets.image`shortId`
         * assets.image`displayName`
         *
         * ANIMATIONS:
         * assets.animation`shortId`
         * assets.animation`displayName`
         *
         * SONGS:
         * assets.song`shortId`
         * assets.song`displayName`
         *
         * TILEMAPS:
         * tilemap`shortId`
         *
         * @param skipIDs string[] a list of string ids (block id, asset id, or file name) to ignore
         **/
        public isAssetUsed(asset: Asset, files?: pxt.Map<{content: string}>, skipIDs?: string[]): boolean {
            let blockIds = asset.meta?.blockIDs?.filter(id => !skipIDs || skipIDs?.indexOf(id) < 0) || [];
            if (blockIds.length > 0) return true;

            if (asset.type == pxt.AssetType.Tile) {
                for (const tm of this.getAssets(AssetType.Tilemap)) {
                    if (skipIDs?.indexOf(tm.id) >= 0) {
                        continue;
                    } else if (tm.data.tileset.tiles.some(t => t.id === asset.id)) {
                        return true;
                    }
                }
            }

            if (files) {
                const shortId = Util.escapeForRegex(getShortIDForAsset(asset));
                const displayName = Util.escapeForRegex(asset.meta?.displayName) || "";

                let assetTsRefs: string;
                switch (asset.type) {
                    case pxt.AssetType.Tile:
                        assetTsRefs = `myTiles.${shortId}|assets.tile\`${shortId}\``;
                        if (displayName) assetTsRefs += `|assets.tile\`${displayName}\``;
                        break;
                    case pxt.AssetType.Tilemap:
                        assetTsRefs = `tilemap\`${shortId}\``;
                        break;
                    case pxt.AssetType.Animation:
                        assetTsRefs = `assets.animation\`${shortId}\``;
                        if (displayName) assetTsRefs += `|assets.animation\`${displayName}\``;
                        break;
                    case pxt.AssetType.Song:
                        assetTsRefs = `assets.song\`${shortId}\``;
                        if (displayName) assetTsRefs += `|assets.song\`${displayName}\``;
                        break;
                    case pxt.AssetType.Json:
                        assetTsRefs = `assets.json\`${shortId}\``;
                        if (displayName) assetTsRefs += `|assets.json\`${displayName}\``;
                        break;
                    default:
                        assetTsRefs = `assets.image\`${shortId}\``;
                        if (displayName) assetTsRefs += `|assets.image\`${displayName}\``;
                        break;
                }
                const assetTsRegex = new RegExp(assetTsRefs, "gm");

                let assetPyRefs: string;
                switch (asset.type) {
                    case pxt.AssetType.Tile:
                        assetPyRefs = `myTiles.${shortId}|assets.tile\("""${shortId}"""\)`;
                        if (displayName) assetPyRefs += `|assets.tile\("""${displayName}"""\)`;
                        break;
                    case pxt.AssetType.Tilemap:
                        assetPyRefs = `assets.tilemap\("""${shortId}"""\)`;
                        break;
                    case pxt.AssetType.Animation:
                        assetPyRefs = `assets.animation\("""${shortId}"""\)`;
                        if (displayName) assetPyRefs += `|assets.animation\("""${displayName}"""\)`;
                        break;
                    case pxt.AssetType.Song:
                        assetPyRefs = `assets.song\("""${shortId}"""\)`;
                        if (displayName) assetPyRefs += `|assets.song\("""${displayName}"""\)`;
                        break;
                    case pxt.AssetType.Json:
                        assetPyRefs = `assets.json\("""${shortId}"""\)`;
                        if (displayName) assetPyRefs += `|assets.json\("""${displayName}"""\)`;
                        break;
                    default:
                        assetPyRefs = `assets.image\("""${shortId}"""\)`;
                        if (displayName) assetPyRefs += `|assets.image\("""${displayName}"""\)`;
                        break;
                }
                const assetPyRegex = new RegExp(assetPyRefs, "gm");

                for (let filename of Object.keys(files)) {
                    if (skipIDs?.indexOf(filename) >= 0) continue;

                    const f = files[filename];
                    // Match .ts files that are not generated (.g.ts)
                    if (filename.match(/((?!\.g).{2}|^.{0,1})\.ts$/i)) {
                        if (f.content.match(assetTsRegex)) return true;
                    } else if (filename.endsWith(".py")) {
                        if (f.content.match(assetPyRegex)) return true;
                    }
                }
            }

            return false;
        }

        public lookupAsset(assetType: AssetType.Image, name: string): ProjectImage;
        public lookupAsset(assetType: AssetType.Tile, name: string): Tile;
        public lookupAsset(assetType: AssetType.Tilemap, name: string): ProjectTilemap;
        public lookupAsset(assetType: AssetType.Animation, name: string): Animation;
        public lookupAsset(assetType: AssetType.Song, name: string): Song;
        public lookupAsset(assetType: AssetType.Json, name: string): JsonAsset;
        public lookupAsset(assetType: AssetType, name: string): Asset;
        public lookupAsset(assetType: AssetType, name: string) {
            return this.getAssetCollection(assetType).getByID(name) ||
                this.getAssetCollection(assetType, true).getByID(name);
        }

        public lookupAssetByName(assetType: AssetType.Image, name: string): ProjectImage;
        public lookupAssetByName(assetType: AssetType.Tile, name: string): Tile;
        public lookupAssetByName(assetType: AssetType.Tilemap, name: string): ProjectTilemap;
        public lookupAssetByName(assetType: AssetType.Animation, name: string): Animation;
        public lookupAssetByName(assetType: AssetType.Song, name: string): Song;
        public lookupAssetByName(assetType: AssetType.Json, name: string): JsonAsset;
        public lookupAssetByName(assetType: AssetType, name: string): Asset;
        public lookupAssetByName(assetType: AssetType, name: string) {
            return this.getAssetCollection(assetType).getByDisplayName(name);
        }

        public lookupAssetByValue(assetType: AssetType.Image, toFind: ProjectImage): ProjectImage;
        public lookupAssetByValue(assetType: AssetType.Tile, toFind: Tile): Tile;
        public lookupAssetByValue(assetType: AssetType.Tilemap, toFind: ProjectTilemap): ProjectTilemap;
        public lookupAssetByValue(assetType: AssetType.Animation, toFind: Animation): Animation;
        public lookupAssetByValue(assetType: AssetType.Song, toFind: Song): Song;
        public lookupAssetByValue(assetType: AssetType.Json, toFind: Song): JsonAsset;
        public lookupAssetByValue(assetType: AssetType, toFind: Asset): Asset;
        public lookupAssetByValue(assetType: AssetType, toFind: Asset) {
            return this.getAssetCollection(assetType).getByValue(toFind);
        }

        public getAssets(type: AssetType.Image): ProjectImage[];
        public getAssets(type: AssetType.Tile): Tile[];
        public getAssets(type: AssetType.Tilemap): ProjectTilemap[];
        public getAssets(type: AssetType.Animation): Animation[];
        public getAssets(type: AssetType.Song): Song[];
        public getAssets(type: AssetType.Json): JsonAsset[];
        public getAssets(type: AssetType): Asset[];
        public getAssets(type: AssetType) {
            return this.getAssetCollection(type).getSnapshot();
        }

        public getGalleryAssets(type: AssetType.Image): ProjectImage[];
        public getGalleryAssets(type: AssetType.Tile): Tile[];
        public getGalleryAssets(type: AssetType.Tilemap): ProjectTilemap[];
        public getGalleryAssets(type: AssetType.Animation): Animation[];
        public getGalleryAssets(type: AssetType.Song): Song[];
        public getGalleryAssets(type: AssetType.Json): JsonAsset[];
        public getGalleryAssets(type: AssetType): Asset[];
        public getGalleryAssets(type: AssetType) {
            return this.getAssetCollection(type, true).getSnapshot();
        }

        public lookupBlockAsset(assetType: AssetType.Image, blockID: string): ProjectImage;
        public lookupBlockAsset(assetType: AssetType.Tile, blockID: string): Tile;
        public lookupBlockAsset(assetType: AssetType.Tilemap, blockID: string): ProjectTilemap;
        public lookupBlockAsset(assetType: AssetType.Animation, blockID: string): Animation;
        public lookupBlockAsset(assetType: AssetType.Song, blockID: string): Song;
        public lookupBlockAsset(assetType: AssetType.Json, blockID: string): JsonAsset;
        public lookupBlockAsset(assetType: AssetType, blockID: string): Asset;
        public lookupBlockAsset(type: AssetType, blockID: string) {
            let filter = (a: Asset) => a.meta?.blockIDs?.indexOf(blockID) !== -1;

            return this.getAssetCollection(type).getSnapshot(filter)[0];
        }

        public updateAsset(asset: ProjectImage): ProjectImage;
        public updateAsset(asset: Tile): Tile;
        public updateAsset(asset: ProjectTilemap): ProjectTilemap;
        public updateAsset(asset: Animation): Animation;
        public updateAsset(asset: Song): Song;
        public updateAsset(asset: JsonAsset): JsonAsset;
        public updateAsset(asset: Asset): Asset;
        public updateAsset(asset: Asset) {
            this.onChange();
            switch (asset.type) {
                case AssetType.Tile:
                    return this.updateTile(asset);
                default:
                    return this.getAssetCollection(asset.type).update(asset.id, asset);
            }
        }

        public duplicateAsset(asset: ProjectImage, displayName?: string): ProjectImage;
        public duplicateAsset(asset: Tile, displayName?: string): Tile;
        public duplicateAsset(asset: ProjectTilemap, displayName?: string): ProjectTilemap;
        public duplicateAsset(asset: Animation, displayName?: string): Animation;
        public duplicateAsset(asset: Song, displayName?: string): Song;
        public duplicateAsset(asset: JsonAsset, displayName?: string): JsonAsset;
        public duplicateAsset(asset: Asset, displayName?: string): Asset;
        public duplicateAsset(asset: Asset, displayName?: string) {
            this.onChange();
            const clone = cloneAsset(asset);
            const name = displayName || clone.meta?.displayName;

            let newAsset: pxt.Asset;
            switch (asset.type) {
                case AssetType.Image:
                    newAsset = this.createNewProjectImage((clone as pxt.ProjectImage).bitmap, name);
                    break;
                case AssetType.Tile:
                    newAsset = this.createNewTile((clone as pxt.Tile).bitmap, null, name);
                    break;
                case AssetType.Tilemap:
                    const [id, tilemap] = this.createNewTilemapFromData((clone as pxt.ProjectTilemap).data, name);
                    newAsset = this.getTilemap(id);
                    break;
                case AssetType.Animation:
                    newAsset = this.createNewAnimationFromData((clone as pxt.Animation).frames, (clone as pxt.Animation).interval, name);
                    break;
                case AssetType.Song:
                    newAsset = this.createNewSong((clone as pxt.Song).song, name);
                    break;
                case AssetType.Json:
                    newAsset = this.createNewJsonAsset((clone as JsonAsset).data, asset.fileName, name);
                    break;

            }
            return newAsset;
        }

        public removeAsset(asset: Asset) {
            this.onChange();
            this.getAssetCollection(asset.type).removeByID(asset.id);
        }

        public addChangeListener(asset: Asset, listener: () => void) {
            this.getAssetCollection(asset.type).addListener(asset.internalID, listener);
        }

        public removeChangeListener(type: AssetType, listener: () => void) {
            this.getAssetCollection(type).removeListener(listener);
        }

        loadPackage(pack: MainPackage) {
            const allPackages = pack.sortedDeps();
            this.extensionTileSets = [];

            for (const dep of allPackages) {
                const isProject = dep.id === "this";
                const images = this.readImages(dep.parseJRes(), isProject);

                for (const toAdd of images) {
                    toAdd.meta.package = dep.id;
                    if (toAdd.type === AssetType.Tile) {
                        this.getAssetCollection(AssetType.Tile, !isProject).add(toAdd);
                    }
                    else if (toAdd.type === AssetType.Image) {
                        this.getAssetCollection(AssetType.Image, !isProject).add(toAdd);
                    }
                    else if (toAdd.type === AssetType.Animation) {
                        this.getAssetCollection(AssetType.Animation, !isProject).add(toAdd);
                    }
                    else if (toAdd.type === AssetType.Json) {
                        this.getAssetCollection(AssetType.Json, !isProject).add(toAdd);
                    }
                    else {
                        if (isProject) {
                            // there was a bug at one point that caused songs to be erroneously serialized
                            // with ids in the myImages namespace. if that's the case here, remap the id to
                            // the correct namespace before loading it
                            const IMAGE_NAMESPACE = pxt.sprite.IMAGES_NAMESPACE + ".";
                            if (toAdd.id.startsWith(IMAGE_NAMESPACE)) {
                                toAdd.id = toAdd.id.replace(IMAGE_NAMESPACE, pxt.sprite.SONG_NAMESPACE + ".");
                            }
                            this.getAssetCollection(AssetType.Song).add(toAdd);
                        }
                        else {
                            this.getAssetCollection(AssetType.Song, true).add(toAdd);
                        }
                    }
                }
            }

            for (const dep of allPackages) {
                const isProject = dep.id === "this";
                for (const tm of getTilemaps(dep.parseJRes())) {
                    if (isProject) {
                        this.getAssetCollection(AssetType.Tilemap).add({
                            internalID: this.getNewInternalId(),
                            type: AssetType.Tilemap,
                            id: tm.id,
                            meta: {
                                // For tilemaps, use the id as the display name for backwards compat
                                displayName: tm.displayName || tm.id,
                                package: dep.id
                            },
                            data: decodeTilemap(tm, id => this.resolveTile(id))
                        });
                    }
                    else {
                        this.getAssetCollection(AssetType.Tilemap, true).add({
                            internalID: this.getNewInternalId(),
                            type: AssetType.Tilemap,
                            id: tm.id,
                            meta: {
                                // For tilemaps, use the id as the display name for backwards compat
                                displayName: tm.displayName || tm.id,
                                package: dep.id
                            },
                            data: decodeTilemap(tm, id => this.getAssetCollection(AssetType.Tile, true).getByID(id))
                        });
                    }
                }
            }


            this.committedState = this.cloneState();
            this.undoStack = [];
            this.redoStack = [];
        }

        loadTilemapJRes(jres: Map<JRes>, skipDuplicates = false, gallery = false) {
            jres = inflateJRes(jres)

            const tiles = this.readImages(jres, !gallery).filter(im => im.type === pxt.AssetType.Tile) as Tile[];

            // If we are loading JRES into an existing project (i.e. in multipart tutorials)
            // we need to correct the tile ids because the user may have created new tiles
            // and taken some of the ids that were used by the tutorial author
            let tileMapping: Map<string> = {};

            if (gallery) {
                for (const tile of tiles) {
                    this.getAssetCollection(AssetType.Tile, true).add(tile);
                }
            }
            else {
                for (const tile of tiles) {
                    if (skipDuplicates) {
                        const existing = this.resolveTileByBitmap(tile.bitmap);
                        if (existing) {
                            tileMapping[tile.id] = existing.id;
                            continue;
                        }
                    }

                    const newTile = this.createNewTile(tile.bitmap, tile.id, tile.meta.displayName);

                    if (newTile.id !== tile.id) {
                        tileMapping[tile.id] = newTile.id;
                    }
                }
            }

            for (const tm of getTilemaps(jres)) {
                this.getAssetCollection(AssetType.Tilemap, gallery).add({
                    internalID: this.getNewInternalId(),
                    type: AssetType.Tilemap,
                    id: tm.id,
                    meta: {
                        // For tilemaps, use the id as the display name for backwards compat
                        displayName: tm.displayName || tm.id
                    },
                    data: decodeTilemap(tm, id => {
                        if (tileMapping[id]) {
                            id = tileMapping[id];
                        }

                        return this.resolveTile(id)
                    })
                })
            }
        }

        loadAssetsJRes(jres: Map<JRes>, gallery = false) {
            jres = inflateJRes(jres);

            const toInflate = [];


            for (const key of Object.keys(jres)) {
                const entry = jres[key];

                if (entry.tilemapTile) {
                    this.getAssetCollection(AssetType.Tile, gallery).add(this.generateImage(entry, AssetType.Tile));
                } else if (entry.mimeType === IMAGE_MIME_TYPE) {
                    this.getAssetCollection(AssetType.Image, gallery).add(this.generateImage(entry, AssetType.Image));
                } else if (entry.mimeType === ANIMATION_MIME_TYPE) {
                    const [animation, needsInflation] = this.generateAnimation(entry)
                    if (needsInflation) {
                        toInflate.push(animation);
                    } else {
                        this.getAssetCollection(AssetType.Animation, gallery).add(animation);
                    }
                } else if (entry.mimeType === SONG_MIME_TYPE) {
                    this.getAssetCollection(AssetType.Song, gallery).add(this.generateSong(entry));
                } else if (entry.mimeType === JSON_MIME_TYPE) {
                    this.getAssetCollection(AssetType.Json, gallery).add(this.generateJsonAsset(entry));
                }
            }

            for (const animation of toInflate) {
                this.getAssetCollection(AssetType.Animation, gallery).add(
                    this.inflateAnimation(animation, this.getAssetCollection(AssetType.Image, gallery).getSnapshot())
                );
            }
        }

        removeInactiveBlockAssets(activeBlockIDs: string[]) {
            for (const type of Object.keys(this.state.assets)) {
                cleanupCollection(this.state.assets[type]);
            }

            function cleanupCollection<U extends Asset>(collection: AssetCollection<U>) {
                const inactiveAssets = collection.getSnapshot(asset => !asset.meta.displayName && asset.meta.blockIDs?.some(id => activeBlockIDs.indexOf(id) === -1));
                const toRemove: Asset[] = [];
                for (const asset of inactiveAssets) {
                    if (asset.meta.blockIDs.length === 1) toRemove.push(asset)
                    else {
                        asset.meta.blockIDs = asset.meta.blockIDs.filter(id => activeBlockIDs.indexOf(id) !== -1);
                        if (asset.meta.blockIDs.length === 0) toRemove.push(asset);
                    }
                }
                for (const asset of toRemove) {
                    collection.removeByID(asset.id);
                }
            }
        }

        clone() {
            const clone = new TilemapProject();
            clone.committedState = cloneSnapshot(this.committedState);
            clone.state = cloneSnapshot(this.state);
            clone.gallery = cloneSnapshot(this.gallery);
            clone.extensionTileSets = this.extensionTileSets?.map(t => ({
                ...t,
                tileSets: t.tileSets.map(ts => ({
                    ...ts,
                    tiles: ts.tiles.map(tl => cloneAsset(tl))
                }))
            }));
            clone.needsRebuild = this.needsRebuild;
            clone.nextID = this.nextID;
            clone.nextInternalID = this.nextInternalID;
            clone.undoStack = this.undoStack.map(u => cloneSnapshotDiff(u));
            clone.redoStack = this.undoStack.map(r => cloneSnapshotDiff(r));
            return clone;
        }

        saveGallerySnapshot() {
            return this.gallery;
        }

        loadGallerySnapshot(snapshot: AssetSnapshot) {
            this.gallery = snapshot;
        }

        protected generateImage(entry: JRes, type: AssetType.Image): ProjectImage;
        protected generateImage(entry: JRes, type: AssetType.Tile): Tile;
        protected generateImage(entry: JRes, type: AssetType.Image | AssetType.Tile): ProjectImage | Tile {
            return {
                internalID: this.getNewInternalId(),
                type: type,
                id: entry.id,
                meta: {
                    displayName: entry.displayName,
                    tags: entry.tags,
                },
                jresData: entry.data,
                bitmap: pxt.sprite.getBitmapFromJResURL(`data:${IMAGE_MIME_TYPE};base64,${entry.data}`).data()
            }
        }

        protected generateSong(entry: JRes): Song {
            return {
                internalID: this.getNewInternalId(),
                type: AssetType.Song,
                id: entry.id,
                meta: {
                    displayName: entry.displayName,
                    tags: entry.tags
                },
                song: pxt.assets.music.decodeSongFromHex(entry.data)
            }
        }

        protected generateJsonAsset(entry: JRes): JsonAsset {
            const parsed = JSON.parse(entry.data);
            return {
                internalID: this.getNewInternalId(),
                type: AssetType.Json,
                id: entry.id,
                meta: {
                    displayName: entry.displayName,
                    tags: entry.tags
                },
                data: parsed.data,
                fileName: parsed.fileName
            }
        }

        protected generateAnimation(entry: JRes): [Animation, boolean] {
            if (entry.dataEncoding === "json") {
                let data: any;

                try {
                    data = JSON.parse(entry.data);
                }
                catch (e) {
                    pxt.warn("could not parse json data of '" + entry.id + "'");
                }

                const anim: Animation = {
                    internalID: this.getNewInternalId(),
                    type: AssetType.Animation,
                    meta: {
                        displayName: entry.displayName,
                        tags: entry.tags
                    },
                    id: entry.id,
                    frames: [],
                    frameIds: data.frames,
                    interval: 100,
                    flippedHorizontal: data.flippedHorizontal
                };

                return [anim, true];

            } else {
                return [{
                    ...decodeAnimation(entry),
                    internalID: this.getNewInternalId()
                }, false];
            }
        }

        protected inflateAnimation(animation: Animation, assets: (Tile | ProjectImage | Animation | Song | JsonAsset)[]): Animation {
            animation.frames = animation.frameIds.map(frameId =>
                (assets.find(entry => entry.id === frameId) as ProjectImage).bitmap
            );

            if (animation.flippedHorizontal) {
                animation.frames = animation.frames.map(frame => {
                    const source = sprite.Bitmap.fromData(frame);

                    const flipped = new sprite.Bitmap(frame.width, frame.height);
                    for (let x = 0; x < flipped.width; x++) {
                        for (let y = 0; y < flipped.height; y++) {
                            flipped.set(x, y, source.get(source.width - x - 1, y))
                        }
                    }
                    return flipped.data();
                })
            }

            return animation;
        }

        generateNewID(type: AssetType) {
            switch (type) {
                case AssetType.Animation:
                    return this.generateNewIDInternal(AssetType.Animation, pxt.sprite.ANIMATION_PREFIX, pxt.sprite.ANIMATION_NAMESPACE);
                case AssetType.Image:
                    return this.generateNewIDInternal(AssetType.Image, pxt.sprite.IMAGE_PREFIX, pxt.sprite.IMAGES_NAMESPACE);
                case AssetType.Tile:
                    return this.generateNewIDInternal(AssetType.Tile, pxt.sprite.TILE_PREFIX, pxt.sprite.TILE_NAMESPACE);
                case AssetType.Tilemap:
                    return this.generateNewIDInternal(AssetType.Tilemap, lf("level"));
                case AssetType.Song:
                    return this.generateNewIDInternal(AssetType.Song, pxt.sprite.SONG_PREFIX, pxt.sprite.SONG_NAMESPACE);
                case AssetType.Json:
                    return this.generateNewIDInternal(AssetType.Json, pxt.sprite.JSON_PREFIX, pxt.sprite.JSON_NAMESPACE);
            }
        }

        generateNewName(type: AssetType, name?: string) {
            const defaultName = name || pxt.getDefaultAssetDisplayName(type);
            let newName = defaultName;
            let index = 0;

            while (this.isNameTaken(type, newName)) {
                newName = defaultName + (index++);
            }

            return newName;
        }

        protected generateNewIDInternal(type: AssetType, varPrefix: string, namespaceString?: string) {
            varPrefix = varPrefix.replace(/\d+$/, "");
            const prefix = namespaceString ? namespaceString + "." + varPrefix : varPrefix;
            let index = 1;
            while (this.isNameTaken(type, prefix + index)) {
                ++index;
            }
            return prefix + index;
        }

        protected onChange() {
            this.needsRebuild = true;
            this.state.revision = TilemapProject.nextRevision++;
        }

        protected readImages(allJRes: Map<JRes>, isProjectFile = false) {
            const assets: (Tile | ProjectImage | Animation | Song | JsonAsset)[] = [];

            const toInflate: Animation[] = [];

            for (const key of Object.keys(allJRes)) {
                const entry = allJRes[key];

                if (entry.tilemapTile) {
                    const tile = this.generateImage(entry, AssetType.Tile);
                    tile.isProjectTile = isProjectFile;
                    assets.push(tile);
                }
                else if (entry.mimeType === IMAGE_MIME_TYPE) {
                    assets.push(this.generateImage(entry, AssetType.Image));
                }
                else if (entry.mimeType === ANIMATION_MIME_TYPE) {
                    const [animation, needsInflation] = this.generateAnimation(entry)
                    if (needsInflation) {
                        toInflate.push(animation);
                    } else {
                        assets.push(animation);
                    }
                }
                else if (entry.mimeType === SONG_MIME_TYPE) {
                    assets.push(this.generateSong(entry));
                }
                else if (entry.mimeType === JSON_MIME_TYPE) {
                    assets.push(this.generateJsonAsset(entry));
                }
            }

            for (const animation of toInflate) {
                assets.push(this.inflateAnimation(animation, assets));
            }

            return assets;
        }

        protected cleanupTemporaryAssets() {
            const images = this.getAssetCollection(AssetType.Image);
            const orphaned = images.getSnapshot(image => !image.meta.displayName && !(image.meta.blockIDs?.length));
            for (const image of orphaned) {
                images.removeByID(image.id);
            }
        }

        protected getAssetCollection(type: AssetType.Animation, gallery?: boolean): AssetCollection<Animation>
        protected getAssetCollection(type: AssetType.Image, gallery?: boolean): AssetCollection<ProjectImage>
        protected getAssetCollection(type: AssetType.Song, gallery?: boolean): AssetCollection<Song>
        protected getAssetCollection(type: AssetType.Tile, gallery?: boolean): AssetCollection<Tile>
        protected getAssetCollection(type: AssetType.Tilemap, gallery?: boolean): AssetCollection<ProjectTilemap>
        protected getAssetCollection(type: AssetType.Json, gallery?: boolean): AssetCollection<JsonAsset>
        protected getAssetCollection(type: AssetType, gallery?: boolean): AssetCollection<Asset>
        protected getAssetCollection(type: AssetType, gallery = false,): AssetCollection<Asset> {
            if (gallery) {
                return getAssetCollection(this.gallery, type, true);
            } else {
                return getAssetCollection(this.state, type, true);
            }
        }
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

    export function emitGalleryDeclarations(jres: pxt.Map<JRes>, namespaceName: string): [pxt.Map<JRes>, string] {
        const entries = Object.keys(jres);

        const indent = "    ";
        let out = "";

        const takenNames: {[index: string]: boolean} = {};
        const idMapping: {[index: string]: string} = {};

        const outJRes: pxt.Map<JRes> = {};

        const getId = (key: string) => {
            let ns = jres[key].namespace || jres["*"].namespace;
            const id = jres[key].id || key;

            if (ns) {
                if (ns.endsWith(".")) {
                    ns = ns.slice(0, ns.length - 1);
                }

                if (!id.startsWith(ns + ".")) {
                    return ns + "." + id;
                }
            }

            return id;
        }

        if (jres["*"]) {
            outJRes["*"] = {
                ...jres["*"],
                namespace: namespaceName
            };
        }

        // First do a pass to generate new qualified names for each asset
        for (const key of entries) {
            if (key === "*") continue;

            const entry = jres[key];
            const id = getId(key);
            let varName = ts.pxtc.escapeIdentifier(entry.displayName || id.split(".").pop());

            if (takenNames[varName]) {
                const base = varName;
                let index = 2;
                while (takenNames[varName]) {
                    varName = base + index;
                    index++;
                }
            }
            takenNames[varName] = true;
            idMapping[id] = namespaceName + "." + varName
        }

        // Now actually generate the TS
        for (const key of entries) {
            if (key === "*") continue;

            const entry = jres[key];
            let mimeType = entry.mimeType || jres["*"]?.mimeType;
            let blockIdentity: string;
            let value: string;
            const varName = idMapping[getId(key)].split(".").pop();
            let tags: string[] = entry.tags;

            if (!tags) {
                tags = [];
                if (varName.toLowerCase().indexOf("background") !== -1) {
                    tags.push("background");
                }
                if (varName.toLowerCase().indexOf("dialog") !== -1) {
                    tags.push("dialog");
                }
                if (entry.tilemapTile) {
                    tags.push("tile");
                }
            }

            if (mimeType === IMAGE_MIME_TYPE) {
                value = "image.ofBuffer(hex\`\`)"

                if (entry.tilemapTile) {
                    blockIdentity = "images._tile"
                }
                else {
                    blockIdentity = "images._image"
                }
            }
            else if (mimeType === ANIMATION_MIME_TYPE) {
                const am = decodeAnimation(entry);
                value = `[${
                    am.frames.map(f =>
                        pxt.sprite.bitmapToImageLiteral(pxt.sprite.Bitmap.fromData(f), "typescript")
                    ).join(",")
                }]`;
            }
            else if (mimeType === TILEMAP_MIME_TYPE) {
                const tm = decodeTilemap(entry);
                value = pxt.sprite.encodeTilemap(tm, "typescript", idMapping);
            }
            else if (mimeType === SONG_MIME_TYPE) {
                value = `hex\`${entry.data}\``;
            }
            else if (mimeType === JSON_MIME_TYPE) {
                value = entry.data;
            }

            out += `${indent}//% fixedInstance jres whenUsed\n`
            if (blockIdentity)  out += `${indent}//% blockIdentity=${blockIdentity}\n`
            if (tags.length) out += `${indent}//% tags="${tags.join(" ")}"\n`
            out += `${indent}export const ${varName} = ${value};\n`

            if (typeof entry === "string") {
                outJRes[varName] = entry;
            }
            else {
                outJRes[varName] = {
                    ...entry,
                    id: idMapping[getId(key)],
                    tags
                };
                if (entry.namespace) {
                    outJRes[varName].namespace = namespaceName
                    if (entry.namespace.endsWith(".")) {
                        outJRes[varName].namespace += ".";
                    }
                }
                if (outJRes[varName].tileset) {
                    outJRes[varName].tileset = entry.tileset.map(t => idMapping[t] || t);
                }
            }
        }

        const warning = lf("Auto-generated code. Do not edit.");

        return [outJRes, `// ${warning}\nnamespace ${namespaceName} {\n${out}\n}\n// ${warning}\n`]
    }

    export function emitTilemapsFromJRes(jres: pxt.Map<JRes>) {
        const entries = Object.keys(jres);

        const indent = "    ";
        let out = "";

        const tilemapEntries: FactoryEntry[] = [];
        const tileEntries: FactoryEntry[] = [];

        for (const key of entries) {
            if (key === "*") continue;

            const entry = jres[key];

            if (entry.tilemapTile) {
                // FIXME: we should get the "image.ofBuffer" and blockIdentity from pxtarget probably
                let varName = key;
                if (varName.indexOf(".") !== -1) {
                    varName = varName.split(".").slice(-1)[0];
                }

                out += `${indent}//% fixedInstance jres blockIdentity=images._tile\n`
                out += `${indent}export const ${varName} = image.ofBuffer(hex\`\`);\n`

                tileEntries.push({ keys: [entry.displayName, getShortIDCore(AssetType.Tile, key, true)], expression: key})
            }

            if (entry.mimeType === TILEMAP_MIME_TYPE) {
                const tm = decodeTilemap(entry);

                tilemapEntries.push({ keys: [entry.displayName, getShortIDCore(AssetType.Tilemap, entry.id)], expression: pxt.sprite.encodeTilemap(tm, "typescript") });
            }
        }

        if (tilemapEntries.length) {
            out += emitFactoryHelper("tilemap", tilemapEntries);
        }
        if (tileEntries.length) {
            out += emitFactoryHelper("tile", tileEntries);
        }


        const warning = lf("Auto-generated code. Do not edit.");

        return `// ${warning}\nnamespace ${pxt.sprite.TILE_NAMESPACE} {\n${out}\n}\n// ${warning}\n`
    }

    export function emitProjectImages(jres: pxt.Map<JRes | string>) {
        const entries = Object.keys(jres);

        let out = "";

        const imageEntries: FactoryEntry[] = [];
        const animationEntries: FactoryEntry[] = [];
        const songEntries: FactoryEntry[] = [];
        const jsonEntries: FactoryEntry[] = [];

        for (const key of entries) {
            if (key === "*") continue;

            const entry = jres[key];

            if (typeof entry === "string" || entry.mimeType === IMAGE_MIME_TYPE) {
                let expression: string;
                let factoryKeys = [getShortIDCore(AssetType.Image, key, true)]
                if (typeof entry === "string") {
                    expression = sprite.bitmapToImageLiteral(sprite.getBitmapFromJResURL(entry), "typescript");
                }
                else {
                    expression = sprite.bitmapToImageLiteral(sprite.getBitmapFromJResURL(entry.data), "typescript");
                    factoryKeys.push(entry.displayName)
                }
                imageEntries.push({
                    keys: factoryKeys,
                    expression
                });
            }
            else if (entry.mimeType === ANIMATION_MIME_TYPE) {
                const animation = decodeAnimation(entry);

                animationEntries.push({
                    keys: [entry.displayName, getShortIDCore(AssetType.Animation, key, true)],
                    expression: `[${animation.frames.map(f =>
                            sprite.bitmapToImageLiteral(sprite.Bitmap.fromData(f), "typescript")
                        ).join(", ")}]`
                });
            }
            else if (entry.mimeType === SONG_MIME_TYPE) {
                songEntries.push({
                    keys: [getShortIDCore(AssetType.Song, key, true), entry.displayName],
                    expression: `hex\`${entry.data}\``
                });
            }
            else if (entry.mimeType === JSON_MIME_TYPE) {
                jsonEntries.push({
                    keys: [getShortIDCore(AssetType.Json, key, true), entry.displayName],
                    expression: entry.data
                });
            }
        }


        const warning = lf("Auto-generated code. Do not edit.");

        out += emitFactoryHelper("image", imageEntries);
        out += emitFactoryHelper("animation", animationEntries);
        out += emitFactoryHelper("song", songEntries);
        out += emitFactoryHelper("json", jsonEntries);

        return `// ${warning}\nnamespace ${pxt.sprite.IMAGES_NAMESPACE} {\n${out}\n}\n// ${warning}\n`
    }

    interface FactoryEntry {
        keys: string[];
        expression: string;
    }

    function emitFactoryHelper(factoryKind: string, expressions: FactoryEntry[]) {
        const indent = "    ";

        return "\n" +
        `${indent}helpers._registerFactory("${factoryKind}", function(name: string) {\n` +
        `${indent}${indent}switch(helpers.stringTrim(name)) {\n` +
        expressions.map(t =>
            t.keys.filter(k => !!k).map(key => `${indent}${indent}${indent}case "${key}":`).join("\n") +
            `return ${t.expression};`
        ).join("\n") + "\n" +
        `${indent}${indent}}\n` +
        `${indent}${indent}return null;\n` +
        `${indent}})\n`
    }

    function cloneBitmap(bitmap: sprite.BitmapData) {
        return pxt.sprite.Bitmap.fromData(bitmap).copy().data();
    }

    function decodeTilemap(jres: JRes, resolveTile?: (id: string) => Tile) {
        const hex = atob(jres.data);
        const bytes = U.fromHex(hex);

        const tmWidth = bytes[1] | (bytes[2] << 8);
        const tmHeight = bytes[3] | (bytes[4] << 8);

        const tiles: Tile[] = jres.tileset.map(id => (resolveTile && resolveTile(id)) || { id } as any);
        let tileWidth = bytes[0];

        if (!tileWidth) {
            tileWidth = tiles.length && tiles.find(t => t.bitmap?.width)?.bitmap.width;
        }
        tileWidth = tileWidth || 16;

        const tileset: TileSet = {
            tileWidth,
            tiles
        };

        const tilemapStart = 5;
        const tmData = bytes.slice(tilemapStart, tilemapStart + tmWidth * tmHeight);

        const tilemap = new sprite.Tilemap(tmWidth, tmHeight, 0, 0, new Uint8ClampedArray(tmData));
        const bitmapData = bytes.slice(tilemapStart + tmData.length);

        const layers = new pxt.sprite.Bitmap(tmWidth, tmHeight, 0, 0, new Uint8ClampedArray(bitmapData)).data();

        return new pxt.sprite.TilemapData(tilemap, tileset, layers);
    }

    export function cloneAsset<U extends Asset>(asset: U, includeEditorData = false): U {
        asset.meta = Object.assign({}, asset.meta);
        if (asset.meta.temporaryInfo) {
            asset.meta.temporaryInfo = Object.assign({}, asset.meta.temporaryInfo);
        }

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
                    data: (asset as ProjectTilemap).data.cloneData(includeEditorData)
                };
            case AssetType.Song:
                return {
                    ...asset,
                    song: pxt.assets.music.cloneSong(asset.song)
                }
            case AssetType.Json:
                return {
                    ...asset,
                    data: U.clone((asset as JsonAsset).data),
                }
        }
    }

    function cloneSnapshot(toClone: AssetSnapshot) {
        const result: AssetSnapshot = {
            revision: toClone.revision,
            assets: {}
        };

        for (const key of Object.keys(toClone.assets)) {
            const assetCollection = toClone.assets[key];
            result.assets[key] = assetCollection.clone();
        }

        return result;
    }

    function cloneSnapshotDiff(toClone: AssetSnapshotDiff): AssetSnapshotDiff {
        const result: AssetSnapshotDiff = {
            ...toClone,
            assetDiffs: {}
        };

        for (const key of Object.keys(toClone.assetDiffs)) {
            const assetCollection = toClone.assetDiffs[key];
            result.assetDiffs[key] = cloneAssetCollectionDiff(assetCollection);
        }
        return result;
    }

    function cloneAssetCollectionDiff<U extends Asset>(toClone: AssetCollectionDiff<U>): AssetCollectionDiff<U> {
        return {
            ...toClone,
            before: toClone.before.map(entry => cloneAsset(entry)),
            after: toClone.after.map(entry => cloneAsset(entry)),
        }
    }

    function addAssetToJRes(asset: Asset, allJRes: pxt.Map<Partial<JRes> | string>): void {
        // Get the last part of the fully qualified name
        const id = asset.id.substr(asset.id.lastIndexOf(".") + 1);
        const tags = asset.meta.tags;

        switch (asset.type) {
            case AssetType.Image:
                allJRes[id] = asset.jresData;
                if (asset.meta.displayName || tags?.length) {
                    const imgJres: Partial<JRes> = {
                        data: asset.jresData,
                        mimeType: IMAGE_MIME_TYPE,
                    }
                    if (asset.meta.displayName)
                        imgJres.displayName = asset.meta.displayName;
                    if (tags?.length)
                        imgJres.tags = tags;
                    allJRes[id] = imgJres;
                }
                break;
            case AssetType.Tile:
                const tileJres: Partial<JRes> = {
                    data: asset.jresData,
                    mimeType: IMAGE_MIME_TYPE,
                    tilemapTile: true,
                    displayName: asset.meta.displayName
                };
                if (tags?.length)
                    tileJres.tags = tags;
                allJRes[id] = tileJres;
                break;
            case AssetType.Tilemap:
                // we include the full ID for tilemaps
                const serialized = serializeTilemap(asset.data, asset.id, asset.meta.displayName);
                allJRes[serialized.id] = serialized;
                break;

            case AssetType.Animation:
                allJRes[id] = serializeAnimation(asset);
                break;
            case AssetType.Song:
                const songJres: Partial<JRes> = {
                    data: pxt.assets.music.encodeSongToHex(asset.song),
                    mimeType: SONG_MIME_TYPE,
                    displayName: asset.meta.displayName,
                    namespace: pxt.sprite.SONG_NAMESPACE + "."
                };
                if (tags?.length)
                    songJres.tags = tags;

                allJRes[id] = songJres;
                break;
            case AssetType.Json:
                const jsonJres: Partial<JRes> = {
                    data: JSON.stringify({ data: asset.data, fileName: asset.fileName }),
                    mimeType: JSON_MIME_TYPE,
                    displayName: asset.meta.displayName,
                    namespace: pxt.sprite.JSON_NAMESPACE + "."
                };
                if (tags?.length)
                    jsonJres.tags = tags;

                allJRes[id] = jsonJres;
                break;
        }

    }

    export function assetEquals(a: Asset, b: Asset, valueOnly = false): boolean {
        if (a == b) return true;
        if (!a && b || !b && a || a.type !== b.type) return false;
        if (!valueOnly) {
            if (a.id !== b.id ||
                !U.arrayEquals(a.meta.tags, b.meta.tags) ||
                !U.arrayEquals(a.meta.blockIDs, b.meta.blockIDs) ||
                a.meta.displayName !== b.meta.displayName
            )
                return false;
        }

        switch (a.type) {
            case AssetType.Image:
            case AssetType.Tile:
                return sprite.bitmapEquals(a.bitmap, (b as ProjectImage | Tile).bitmap);
            case AssetType.Animation:
                    const bAnimation = b as Animation;
                    return a.interval === bAnimation.interval && U.arrayEquals(a.frames, bAnimation.frames, sprite.bitmapEquals);
            case AssetType.Tilemap:
                return a.data.equals((b as ProjectTilemap).data);
            case AssetType.Song:
                return pxt.assets.music.songEquals(a.song, (b as Song).song);
            case AssetType.Json:
                return a.fileName === (b as JsonAsset).fileName && U.deepEqual(a.data, (b as JsonAsset).data);
        }
    }

    export function validateAssetName(name: string) {
        if (!name) return false;

        // Covers all punctuation/whitespace except for "-", "_", and " "
        // eslint-disable-next-line no-control-regex
        const bannedRegex = /[\u0000-\u001f\u0021-\u002c\u002e\u002f\u003a-\u0040\u005b-\u005e\u0060\u007b-\u007f]/
        return !bannedRegex.test(name);
    }

    export function getTSReferenceForAsset(asset: pxt.Asset, isPython = false) {
        let shortId: string;
        if (asset.meta?.displayName) {
            shortId = asset.meta.displayName;
        }
        else {
            shortId = getShortIDForAsset(asset);
        }

        if (!shortId) {
            if (asset.type === pxt.AssetType.Image || asset.type === pxt.AssetType.Tile) {
                // Use the qualified name
                return asset.id;
            }
            return undefined;
        }

        const leftTick = isPython ? `("""` : "`";
        const rightTick = isPython ? `""")` : "`";

        switch (asset.type) {
            case AssetType.Tile:
                return `assets.tile${leftTick}${shortId}${rightTick}`
            case AssetType.Image:
                return `assets.image${leftTick}${shortId}${rightTick}`
            case AssetType.Animation:
                return `assets.animation${leftTick}${shortId}${rightTick}`
            case AssetType.Tilemap:
                return `tilemap${leftTick}${shortId}${rightTick}`
            case AssetType.Song:
                return `assets.song${leftTick}${shortId}${rightTick}`
            case AssetType.Json:
                return `assets.json${leftTick}${shortId}${rightTick}`;
        }
    }

    export function parseAssetTSReference(ts: string) {
        const match = /^\s*(?:(?:assets\s*\.\s*(image|tile|animation|tilemap|song))|(tilemap))\s*(?:`|\(""")([^`"]*)(?:`|"""\))\s*$/m.exec(ts);

        if (match) {
            const type = match[1] || match[2];
            const name = match[3].trim();

            return {
                type, name
            }
        }

        return undefined;
    }

    export function lookupProjectAssetByTSReference(ts: string, project: TilemapProject) {
        const match = parseAssetTSReference(ts);

        if (match) {
            const { type, name } = match;

            switch (type) {
                case "tile":
                    return project.lookupAssetByName(AssetType.Tile, name);
                case "image":
                    return project.lookupAssetByName(AssetType.Image, name);
                case "tilemap":
                    return project.lookupAssetByName(AssetType.Tilemap, name) || project.lookupAsset(AssetType.Tilemap, name);
                case "animation":
                    return project.lookupAssetByName(AssetType.Animation, name);
                case "song":
                    return project.lookupAssetByName(AssetType.Song, name);
                case "json":
                    return project.lookupAssetByName(AssetType.Json, name);
            }
        }

        return undefined
    }

    export function getDefaultAssetDisplayName(type: pxt.AssetType): string {
        switch (type) {
            case pxt.AssetType.Image:
                return lf("myImage");
            case pxt.AssetType.Tile:
                return lf("myTile");
            case pxt.AssetType.Tilemap:
                return lf("level");
            case pxt.AssetType.Animation:
                return lf("myAnim");
            case pxt.AssetType.Song:
                return lf("mySong");
            case pxt.AssetType.Json:
                return lf("myFile");
            default:
                return lf("asset")
        }
    }

    export function getShortIDForAsset(asset: pxt.Asset) {
        return getShortIDCore(asset.type, asset.id);
    }

    export function validateAsset(asset: pxt.Asset) {
        if (!asset) return false;

        switch (asset.type) {
            case AssetType.Image:
            case AssetType.Tile:
                return validateImageAsset(asset as ProjectImage | Tile);
            case AssetType.Tilemap:
                return validateTilemap(asset as ProjectTilemap);
            case AssetType.Animation:
                return validateAnimation(asset as Animation)
            case AssetType.Song:
                return validateSong(asset as Song);
            case AssetType.Json:
                return !!(asset as JsonAsset).data;
        }
    }

    function validateImageAsset(asset: ProjectImage | Tile) {
        if (!asset.bitmap) return false;

        return validateBitmap(sprite.Bitmap.fromData(asset.bitmap));
    }

    function validateTilemap(tilemap: ProjectTilemap) {
        if (
            !tilemap.data ||
            !tilemap.data.tilemap ||
            !tilemap.data.tileset ||
            !tilemap.data.tileset.tileWidth ||
            !tilemap.data.tileset.tiles?.length ||
            !tilemap.data.layers
        ) {
            return false;
        }

        return validateBitmap(sprite.Bitmap.fromData(tilemap.data.layers)) &&
            validateBitmap(tilemap.data.tilemap);
    }

    function validateAnimation(animation: Animation) {
        if (!animation.frames?.length || animation.interval <= 0) {
            return false;
        }

        return !animation.frames.some(frame => !validateBitmap(sprite.Bitmap.fromData(frame)));
    }

    function validateBitmap(bitmap: sprite.Bitmap) {
        return bitmap.width > 0 &&
            bitmap.height > 0 &&
            !Number.isNaN(bitmap.x0) &&
            !Number.isNaN(bitmap.y0) &&
            bitmap.data().data.length === bitmap.dataLength();
    }

    function validateSong(song: Song) {
        return song.song &&
            song.song.ticksPerBeat > 0 &&
            song.song.beatsPerMeasure > 0 &&
            song.song.measures > 0 &&
            song.song.beatsPerMinute > 0 &&
            !!song.song.tracks;
    }

    function getShortIDCore(assetType: pxt.AssetType, id: string, allowNoPrefix = false) {
        let prefix: string;
        switch (assetType) {
            case AssetType.Image:
                prefix = pxt.sprite.IMAGES_NAMESPACE + ".";
                break;
            case AssetType.Tile:
                prefix = pxt.sprite.TILE_NAMESPACE + ".";
                break;
            case AssetType.Tilemap:
                prefix = "";
                break;
            case AssetType.Animation:
                prefix = pxt.sprite.ANIMATION_NAMESPACE + ".";
                break;
            case AssetType.Song:
                prefix = pxt.sprite.SONG_NAMESPACE + ".";
                break;
            case AssetType.Json:
                prefix = pxt.sprite.JSON_NAMESPACE + ".";
                break;
        }

        if (prefix) {
            if (id.startsWith(prefix)) {
                const short = id.substr(prefix.length);
                if (short.indexOf(".") === -1) return short;
            }
            else if (!allowNoPrefix) {
                return null;
            }
        }

        return id;
    }

    function serializeTilemap(tilemap: sprite.TilemapData, id: string, name: string): JRes {
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
            tileset: tilemap.tileset.tiles.map(t => t.id),
            displayName: name
        }
    }

    function serializeAnimation(asset: Animation): JRes {
        const animationJres: JRes = {
            namespace: asset.id.substr(0, asset.id.lastIndexOf(".")),
            id: asset.id.substr(asset.id.lastIndexOf(".") + 1),
            mimeType: ANIMATION_MIME_TYPE,
            data: pxt.sprite.encodeAnimationString(asset.frames, asset.interval),
            displayName: asset.meta.displayName,
        }
        if (asset.meta.tags?.length)
            animationJres.tags = asset.meta.tags;
        return animationJres;
    }

    function decodeAnimation(jres: JRes): Animation {
        const hex = atob(jres.data);
        const bytes = new Uint8ClampedArray(U.fromHex(hex));

        const interval = read16Bit(bytes, 0);
        const frameWidth = read16Bit(bytes, 2);
        const frameHeight = read16Bit(bytes, 4);
        const frameCount = read16Bit(bytes, 6);
        const frameLength = Math.ceil((frameWidth * frameHeight) / 2);

        let offset = 8;

        const decodedFrames: pxt.sprite.BitmapData[] = [];

        for (let i = 0; i < frameCount; i++) {
            const frameData = bytes.slice(offset, offset + frameLength);
            decodedFrames.push({
                x0: 0,
                y0: 0,
                width: frameWidth,
                height: frameHeight,
                data: frameData
            });

            offset += frameLength;
        }

        let id = jres.id;

        if (!id.startsWith(jres.namespace)) {
            id = jres.namespace + "." + id;
            id = id.replace(/\.\./g, ".");
        }

        return {
            type: AssetType.Animation,
            internalID: 0,
            id: id,
            interval,
            frames: decodedFrames,
            meta: {
                displayName: jres.displayName,
                tags: jres.tags
            }
        }
    }

    function read16Bit(buf: Uint8ClampedArray, offset: number) {
        return buf[offset] | (buf[offset + 1] << 8)
    }

    function getAssetCollection(snapshot: AssetSnapshot, type: AssetType.Animation, createIfMissing?: boolean): AssetCollection<Animation>
    function getAssetCollection(snapshot: AssetSnapshot, type: AssetType.Image, createIfMissing?: boolean): AssetCollection<ProjectImage>
    function getAssetCollection(snapshot: AssetSnapshot, type: AssetType.Song, createIfMissing?: boolean): AssetCollection<Song>
    function getAssetCollection(snapshot: AssetSnapshot, type: AssetType.Json, createIfMissing?: boolean): AssetCollection<JsonAsset>
    function getAssetCollection(snapshot: AssetSnapshot, type: AssetType.Tile, createIfMissing?: boolean): AssetCollection<Tile>
    function getAssetCollection(snapshot: AssetSnapshot, type: AssetType.Tilemap, createIfMissing?: boolean): AssetCollection<ProjectTilemap>
    function getAssetCollection(snapshot: AssetSnapshot, type: AssetType, createIfMissing?: boolean): AssetCollection<Asset>
    function getAssetCollection(snapshot: AssetSnapshot, type: AssetType, createIfMissing = false): AssetCollection<Asset> {
        if (!snapshot.assets[type]) {
            if (createIfMissing) {
                snapshot.assets[type] = new AssetCollection<Asset>(type);
            }
            else {
                return undefined;
            }
        }

        return snapshot.assets[type];
    }

    export function patchTemporaryAsset(oldValue: pxt.Asset, newValue: pxt.Asset, project: TilemapProject) {
        if (!oldValue || assetEquals(oldValue, newValue)) return newValue;

        newValue = cloneAsset(newValue, true);
        const wasTemporary = oldValue.internalID === -1;
        const isTemporary = newValue.internalID === -1;

        // if we went from being temporary to no longer being temporary,
        // make sure we replace the junk id with a new value
        if (wasTemporary && !isTemporary) {
            newValue.id = project.generateNewID(newValue.type);
            newValue.internalID = project.getNewInternalId();
        }

        return newValue;
    }
}
