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
        displayName?: string;
        tags?: string[];
        blockIDs?: string[];
    }

    export type Asset = ProjectImage | Tile | Animation | ProjectTilemap;

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

    interface AssetSnapshotDiff {
        beforeRevision: number;
        afterRevision: number;
        tiles: AssetCollectionDiff<Tile>;
        tilemaps: AssetCollectionDiff<ProjectTilemap>;
        images: AssetCollectionDiff<ProjectImage>;
        animations: AssetCollectionDiff<Animation>;
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

        add(asset: U) {
            if (this.takenNames[asset.id]) {
                return this.update(asset.id, asset);
            }
            else {
                const clone = cloneAsset(asset);
                this.takenNames[clone.id] = true;

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
                return this.assets.filter(a => filter(a)).map(cloneAsset);
            }
            return this.assets.map(cloneAsset);
        }

        update(id: string, newValue: U) {
            let asset: U;

            if (this.takenNames[id]) {
                const existing = this.lookupByID(id);

                if (!assetEquals(existing, newValue)) {
                    this.removeByID(id);
                    asset = this.add(newValue);
                    this.notifyListener(newValue.internalID);
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
                    if (asset.meta.displayName === name) {
                        return cloneAsset(asset);
                    }
                }
            }
            return undefined;
        }

        isIDTaken(id: string) {
            return !!this.takenNames[id];
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
            let index = 0;
            while (this.takenNames[prefix + index]) {
                ++index;
            }
            return prefix + index;
        }
    }

    export class TilemapProject {
        public needsRebuild = true;

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
                revision: 0,
                tilemaps: new AssetCollection(),
                tiles: new AssetCollection(),
                animations: new AssetCollection(),
                images: new AssetCollection()
            };
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

        public getNewInternalId() {
            return this.nextInternalID++;
        }

        public createNewImage(width = 16, height = 16) {
            const id = this.generateNewID(AssetType.Image, pxt.sprite.IMAGE_PREFIX, pxt.sprite.IMAGES_NAMESPACE);
            const bitmap = new pxt.sprite.Bitmap(width, height).data()

            const newImage: ProjectImage = {
                internalID: this.getNewInternalId(),
                id,
                type: AssetType.Image,
                bitmap: bitmap,
                meta: {},
                jresData: pxt.sprite.base64EncodeBitmap(bitmap)
            };
            return this.state.images.add(newImage);
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
            const tiles = this.state.tiles.getSnapshot(tile => tile.bitmap.width === tileWidth);

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

            if (!id || this.state.tiles.isIDTaken(id)) {
                id = this.generateNewID(AssetType.Tile, pxt.sprite.TILE_PREFIX, pxt.sprite.TILE_NAMESPACE);
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

            return this.state.tiles.add(newTile);
        }

        public createNewProjectImage(data: pxt.sprite.BitmapData) {
            this.onChange();

            const newImage: ProjectImage = {
                internalID: this.getNewInternalId(),
                id: this.generateNewID(AssetType.Image, pxt.sprite.IMAGE_PREFIX, pxt.sprite.IMAGES_NAMESPACE),
                type: AssetType.Image,
                jresData: pxt.sprite.base64EncodeBitmap(data),
                meta: {},
                bitmap: data
            };

            return this.state.images.add(newImage);
        }

        public updateTile(tile: pxt.Tile) {
            this.onChange();

            const existing = this.resolveProjectTileByInternalID(tile.internalID);

            if (existing) {
                this.state.tiles.update(existing.id, tile);

                if (existing.id !== tile.id) {
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
                "namespace": pxt.sprite.IMAGES_NAMESPACE
            };

            return blob;
        }

        public getTilemap(id: string) {
            return this.state.tilemaps.getByID(id);
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
            return this.lookupAsset(AssetType.Tile, id) as Tile;
        }

        public resolveProjectTileByInternalID(id: number): Tile {
            return this.state.tiles.getSnapshot(tile => tile.internalID === id)[0];
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
                    internalID: this.getNewInternalId(),
                    id,
                    type: AssetType.Tile,
                    bitmap: bitmap,
                    jresData: pxt.sprite.base64EncodeBitmap(bitmap),
                    meta: {},
                    isProjectTile: true
                };

                return this.state.tiles.add(tile);
            }
            return tile;
        }

        public createNewTilemapFromData(data: pxt.sprite.TilemapData, name?: string): [string, pxt.sprite.TilemapData] {
            this.onChange()

            const id = this.generateNewID(AssetType.Tilemap, name || lf("level"));
            this.state.tilemaps.add({
                internalID: this.getNewInternalId(),
                id,
                type: AssetType.Tilemap,
                meta: {
                    displayName: id
                },
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
            if (this.state.revision !== this.committedState.revision) {
                this.pushUndo();
            }
            if (this.undoStack.length) {
                const undo = this.undoStack.pop();

                this.state.tiles.applyDiff(undo.tiles, true);
                this.state.images.applyDiff(undo.images, true);
                this.state.tilemaps.applyDiff(undo.tilemaps, true);
                this.state.animations.applyDiff(undo.animations, true);
                this.state.revision = undo.beforeRevision;

                this.redoStack.push(undo);

                this.committedState = this.cloneState();
                this.needsRebuild = true;
            }
        }

        public redo() {
            if (this.redoStack.length) {
                const redo = this.redoStack.pop();

                this.state.tiles.applyDiff(redo.tiles);
                this.state.images.applyDiff(redo.images);
                this.state.tilemaps.applyDiff(redo.tilemaps);
                this.state.animations.applyDiff(redo.animations);

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
                tiles: this.state.tiles.diff(this.committedState.tiles),
                images: this.state.images.diff(this.committedState.images),
                tilemaps: this.state.tilemaps.diff(this.committedState.tilemaps),
                animations: this.state.animations.diff(this.committedState.animations)
            });
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
            switch (assetType) {
                case AssetType.Image:
                    return this.state.images.isIDTaken(name) || this.gallery.images.isIDTaken(name);
                case AssetType.Tile:
                    return this.state.tiles.isIDTaken(name) || this.gallery.tiles.isIDTaken(name);
                case AssetType.Tilemap:
                    return this.state.tilemaps.isIDTaken(name) || this.gallery.tilemaps.isIDTaken(name);
                case AssetType.Animation:
                    return this.state.animations.isIDTaken(name) || this.gallery.animations.isIDTaken(name);
            }
        }

        public lookupAsset(assetType: AssetType.Image, name: string): ProjectImage;
        public lookupAsset(assetType: AssetType.Tile, name: string): Tile;
        public lookupAsset(assetType: AssetType.Tilemap, name: string): ProjectTilemap;
        public lookupAsset(assetType: AssetType.Animation, name: string): Animation;
        public lookupAsset(assetType: AssetType, name: string): Asset;
        public lookupAsset(assetType: AssetType, name: string) {
            switch (assetType) {
                case AssetType.Image:
                    return this.state.images.getByID(name) || this.gallery.images.getByID(name);
                case AssetType.Tile:
                    return this.state.tiles.getByID(name) || this.gallery.tiles.getByID(name);
                case AssetType.Tilemap:
                    return this.state.tilemaps.getByID(name) || this.gallery.tilemaps.getByID(name);
                case AssetType.Animation:
                    return this.state.animations.getByID(name) || this.gallery.animations.getByID(name);
            }
        }

        public lookupAssetByName(assetType: AssetType.Image, name: string): ProjectImage;
        public lookupAssetByName(assetType: AssetType.Tile, name: string): Tile;
        public lookupAssetByName(assetType: AssetType.Tilemap, name: string): ProjectTilemap;
        public lookupAssetByName(assetType: AssetType.Animation, name: string): Animation;
        public lookupAssetByName(assetType: AssetType, name: string): Asset;
        public lookupAssetByName(assetType: AssetType, name: string) {
            switch (assetType) {
                case AssetType.Image:
                    return this.state.images.getByDisplayName(name);
                case AssetType.Tile:
                    return this.state.tiles.getByDisplayName(name);
                case AssetType.Tilemap:
                    return this.state.tilemaps.getByDisplayName(name);
                case AssetType.Animation:
                    return this.state.animations.getByDisplayName(name);
            }
        }

        public getAssets(type: AssetType.Image): ProjectImage[];
        public getAssets(type: AssetType.Tile): Tile[];
        public getAssets(type: AssetType.Tilemap): ProjectTilemap[];
        public getAssets(type: AssetType.Animation): Animation[];
        public getAssets(type: AssetType): Asset[];
        public getAssets(type: AssetType) {
            switch (type) {
                case AssetType.Image: return this.state.images.getSnapshot();
                case AssetType.Tile: return this.state.tiles.getSnapshot();
                case AssetType.Tilemap: return this.state.tilemaps.getSnapshot();
                case AssetType.Animation: return this.state.animations.getSnapshot();
            }
        }

        public lookupBlockAsset(assetType: AssetType.Image, blockID: string): ProjectImage;
        public lookupBlockAsset(assetType: AssetType.Tile, blockID: string): Tile;
        public lookupBlockAsset(assetType: AssetType.Tilemap, blockID: string): ProjectTilemap;
        public lookupBlockAsset(assetType: AssetType.Animation, blockID: string): Animation;
        public lookupBlockAsset(assetType: AssetType, blockID: string): Asset;
        public lookupBlockAsset(type: AssetType, blockID: string) {
            let filter = (a: Asset) => a.meta?.blockIDs?.indexOf(blockID) !== -1;

            switch (type) {
                case AssetType.Image: return this.state.images.getSnapshot(filter)[0];
                case AssetType.Tile: return this.state.tiles.getSnapshot(filter)[0];
                case AssetType.Tilemap: return this.state.tilemaps.getSnapshot(filter)[0];
                case AssetType.Animation: return this.state.animations.getSnapshot(filter)[0];
            }
        }

        public updateAsset(asset: ProjectImage): ProjectImage;
        public updateAsset(asset: Tile): Tile;
        public updateAsset(asset: ProjectTilemap): ProjectTilemap;
        public updateAsset(asset: Animation): Animation;
        public updateAsset(asset: Asset): Asset;
        public updateAsset(asset: Asset) {
            this.onChange();
            switch (asset.type) {
                case AssetType.Image:
                    return this.state.images.update(asset.id, asset);
                case AssetType.Tile:
                    return this.updateTile(asset);
                case AssetType.Tilemap:
                    return this.state.tilemaps.update(asset.id, asset);
                case AssetType.Animation:
                    return this.state.animations.update(asset.id, asset);
            }
        }

        public duplicateAsset(asset: ProjectImage): ProjectImage;
        public duplicateAsset(asset: Tile): Tile;
        public duplicateAsset(asset: ProjectTilemap): ProjectTilemap;
        public duplicateAsset(asset: Animation): Animation;
        public duplicateAsset(asset: Asset): Asset;
        public duplicateAsset(asset: Asset) {
            this.onChange();
            const newAsset = cloneAsset(asset);
            newAsset.internalID = this.getNewInternalId();
            const name = newAsset.id.substr(newAsset.id.lastIndexOf(".") + 1).replace(/\d*$/, "");
            switch (newAsset.type) {
                case AssetType.Image:
                    newAsset.id = this.generateNewID(AssetType.Image, name, pxt.sprite.IMAGES_NAMESPACE);
                    this.state.images.add(newAsset); break;
                case AssetType.Tile:
                    newAsset.id = this.generateNewID(AssetType.Tile, name, pxt.sprite.TILE_NAMESPACE);
                    this.state.tiles.add(newAsset); break;
                case AssetType.Tilemap:
                    newAsset.id = this.generateNewID(AssetType.Tilemap, name);
                    this.state.tilemaps.add(newAsset); break;
                case AssetType.Animation:
                    newAsset.id = this.generateNewID(AssetType.Animation, name);
                    this.state.animations.add(newAsset); break;
            }
            return newAsset;
        }

        public removeAsset(asset: Asset) {
            this.onChange();
            switch (asset.type) {
                case AssetType.Image:
                    return this.state.images.removeByID(asset.id);
                case AssetType.Tile:
                    return this.state.tiles.removeByID(asset.id);
                case AssetType.Tilemap:
                    return this.state.tilemaps.removeByID(asset.id);
                case AssetType.Animation:
                    return this.state.animations.removeByID(asset.id);
            }
        }

        public addChangeListener(asset: Asset, listener: () => void) {
            switch (asset.type) {
                case AssetType.Image: this.state.images.addListener(asset.internalID, listener); break;
                case AssetType.Tile: this.state.tiles.addListener(asset.internalID, listener); break;
                case AssetType.Tilemap: this.state.tilemaps.addListener(asset.internalID, listener); break;
                case AssetType.Animation: this.state.animations.addListener(asset.internalID, listener); break;
            }
        }

        public removeChangeListener(type: AssetType, listener: () => void) {
            switch (type) {
                case AssetType.Image: this.state.images.removeListener(listener); break;
                case AssetType.Tile: this.state.tiles.removeListener(listener); break;
                case AssetType.Tilemap: this.state.tilemaps.removeListener(listener); break;
                case AssetType.Animation: this.state.animations.removeListener(listener); break;
            }
        }

        loadPackage(pack: MainPackage) {
            const allPackages = pack.sortedDeps();
            this.extensionTileSets = [];

            for (const dep of allPackages) {
                const isProject = dep.id === "this";
                const images = this.readImages(dep.parseJRes(), isProject);

                for (const image of images) {
                    if (image.type === AssetType.Tile) {
                        if (isProject) {
                            this.state.tiles.add(image);
                        }
                        else {
                            this.gallery.tiles.add(image);
                        }
                    }
                    else {
                        if (isProject) {
                            this.state.images.add(image);
                        }
                        else {
                            this.gallery.images.add(image);
                        }
                    }
                }
            }

            for (const tm of getTilemaps(pack.parseJRes())) {
                this.state.tilemaps.add({
                    internalID: this.getNewInternalId(),
                    type: AssetType.Tilemap,
                    id: tm.id,
                    meta: {
                        // For tilemaps, use the id as the display name for backwards compat
                        displayName: tm.displayName || tm.id
                    },
                    data: decodeTilemap(tm, id => this.resolveTile(id))
                })
            }
            this.committedState = this.cloneState();
            this.undoStack = [];
            this.redoStack = [];
        }

        loadTilemapJRes(jres: Map<JRes>, skipDuplicates = false) {
            jres = inflateJRes(jres)

            const tiles = this.readImages(jres, true).filter(im => im.type === pxt.AssetType.Tile);

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

                const newTile = this.createNewTile(tile.bitmap, tile.id, tile.meta.displayName);

                if (newTile.id !== tile.id) {
                    tileMapping[tile.id] = newTile.id;
                }
            }

            for (const tm of getTilemaps(jres)) {
                this.state.tilemaps.add({
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

        loadAssetsJRes(jres: Map<JRes>) {
            for (const key of Object.keys(jres)) {
                const entry = jres[key];

                if (entry.mimeType === IMAGE_MIME_TYPE) {
                    this.state.images.add({
                        internalID: this.getNewInternalId(),
                        type: AssetType.Image,
                        id: entry.id,
                        meta: {
                            displayName: entry.displayName
                        },
                        jresData: entry.data,
                        bitmap: pxt.sprite.getBitmapFromJResURL(`data:${IMAGE_MIME_TYPE};base64,${entry.data}`).data()
                    })
                }
            }
        }

        removeInactiveBlockAssets(activeBlockIDs: string[]) {
            cleanupCollection(this.state.images);
            cleanupCollection(this.state.tiles);
            cleanupCollection(this.state.tilemaps);
            cleanupCollection(this.state.animations);


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

        protected generateNewID(type: AssetType, varPrefix: string, namespaceString?: string) {
            const prefix = namespaceString ? namespaceString + "." + varPrefix : varPrefix;
            let index = 1;
            while (this.isNameTaken(type, prefix + index)) {
                ++index;
            }
            return prefix + index;
        }

        protected onChange() {
            this.needsRebuild = true;
            this.state.revision = this.nextID++;
        }

        protected readImages(allJRes: Map<JRes>, isProjectFile = false) {
            const assets: (Tile | ProjectImage)[] = [];

            for (const key of Object.keys(allJRes)) {
                const entry = allJRes[key];

                if (entry.tilemapTile) {
                    const tile: Tile = {
                        internalID: this.getNewInternalId(),
                        type: AssetType.Tile,
                        jresData: entry.data,
                        id: entry.id,
                        meta: {
                            displayName: entry.displayName
                        },
                        bitmap: pxt.sprite.getBitmapFromJResURL(`data:${IMAGE_MIME_TYPE};base64,${entry.data}`).data(),
                        isProjectTile: isProjectFile
                    };

                    assets.push(tile);
                }
                else if (entry.mimeType === IMAGE_MIME_TYPE) {
                    assets.push({
                        internalID: this.getNewInternalId(),
                        type: AssetType.Image,
                        jresData: entry.data,
                        meta: {
                            displayName: entry.displayName
                        },
                        id: entry.id,
                        bitmap: pxt.sprite.getBitmapFromJResURL(`data:${IMAGE_MIME_TYPE};base64,${entry.data}`).data()
                    })
                }
            }

            return assets;
        }

        protected cleanupTemporaryAssets() {
            const orphaned = this.state.images.getSnapshot(image => !image.meta.displayName && !(image.meta.blockIDs?.length));
            for (const image of orphaned) {
                this.state.images.removeByID(image.id);
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
                out += `${indent}//% fixedInstance jres blockIdentity=images._tile\n`
                out += `${indent}export const ${key} = image.ofBuffer(hex\`\`);\n`

                tileEntries.push({ keys: [entry.displayName, key.substr(key.lastIndexOf(".") + 1)], expression: key})
            }

            if (entry.mimeType === TILEMAP_MIME_TYPE) {
                const tm = decodeTilemap(entry);

                tilemapEntries.push({ keys: [entry.displayName, entry.id], expression: pxt.sprite.encodeTilemap(tm, "typescript") });
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

        for (const key of entries) {
            if (key === "*") continue;

            const entry = jres[key];

            let expression: string;
            let factoryKeys = [key.substr(key.lastIndexOf(".") + 1)]
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


        const warning = lf("Auto-generated code. Do not edit.");

        out += emitFactoryHelper("image", imageEntries);

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
                if (asset.meta.displayName) {
                    allJRes[id] = {
                        data: asset.jresData,
                        mimeType: IMAGE_MIME_TYPE,
                        displayName: asset.meta.displayName
                    }
                }
                break;
            case AssetType.Tile:
                allJRes[id] = {
                    data: asset.jresData,
                    mimeType: IMAGE_MIME_TYPE,
                    tilemapTile: true,
                    displayName: asset.meta.displayName
                };
                break;
            case AssetType.Tilemap:
                // we include the full ID for tilemaps
                const serialized = serializeTilemap(asset.data, asset.id, asset.meta.displayName);
                allJRes[serialized.id] = serialized;
                break;

            case AssetType.Animation:
                // TODO: riknoll

        }
    }

    export function assetEquals(a: Asset, b: Asset) {
        if (a == b) return true;
        if (a.id !== b.id || a.type !== b.type ||
            !arrayEquals(a.meta.tags, b.meta.tags) ||
            !arrayEquals(a.meta.blockIDs, b.meta.blockIDs) ||
            a.meta.displayName !== b.meta.displayName
        )
            return false;

        switch (a.type) {
            case AssetType.Image:
            case AssetType.Tile:
                return sprite.bitmapEquals(a.bitmap, (b as ProjectImage | Tile).bitmap);
            case AssetType.Animation:
                    const bAnimation = b as Animation;
                    return a.interval === bAnimation.interval && arrayEquals(a.frames, bAnimation.frames, sprite.bitmapEquals);
            case AssetType.Tilemap:
                return a.data.equals((b as ProjectTilemap).data);
        }
    }

    export function validateAssetName(name: string) {
        if (!name) return false;

        // Covers all punctuation/whitespace except for "-", "_", and " "
        const bannedRegex = /[\u0000-\u001f\u0021-\u002c\u002e\u002f\u003a-\u0040\u005b-\u005e\u0060\u007b-\u007f]/
        return !bannedRegex.test(name);
    }

    function arrayEquals<U>(a: U[], b: U[], compare: (c: U, d: U) => boolean = (c, d) => c === d) {
        if (a == b) return true;
        if (!a && b || !b && a || a.length !== b.length) return false;

        for (let i = 0; i < a.length; i++) {
            if (!compare(a[i], b[i])) return false;
        }
        return true;
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
}
