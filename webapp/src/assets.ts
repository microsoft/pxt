export function isNameTaken(name: string) {
    return pxt.react.getTilemapProject().isNameTaken(pxt.AssetType.Image, name);
}

export function createNewImageAsset(type: pxt.AssetType.Tile | pxt.AssetType.Image | pxt.AssetType.Animation, width: number, height: number, displayName?: string) {
    const project = pxt.react.getTilemapProject();
    switch (type) {
        case pxt.AssetType.Tile:
            return project.createNewTile(new pxt.sprite.Bitmap(width, height).data(), null, displayName);
        case pxt.AssetType.Image:
            return project.createNewImage(width, height);
        case pxt.AssetType.Animation:
    }

    return null;
}

export function createProjectImage(bitmap: pxt.sprite.BitmapData) {
    const project = pxt.react.getTilemapProject();
    return project.createNewProjectImage(bitmap);
}

export function createTile(bitmap: pxt.sprite.BitmapData, id?: string, displayName?: string) {
    const project = pxt.react.getTilemapProject();
    return project.createNewTile(bitmap, id, displayName);
}

export function lookupAsset(type: pxt.AssetType, id: string) {
    const project = pxt.react.getTilemapProject();
    return project.lookupAsset(type, id);
}

export function getNewInternalID() {
    const project = pxt.react.getTilemapProject();
    return project.getNewInternalId();
}

export function getAssets(gallery = false, firstType = pxt.AssetType.Image, tempAssets: pxt.Asset[] = []): pxt.Asset[] {
    const project = pxt.react.getTilemapProject();
    const imgConv = new pxt.ImageConverter();

    const toGalleryItem = <U extends pxt.Asset>(asset: U) => assetToGalleryItem(asset, imgConv) as U;

    const getAssetType = gallery ? project.getGalleryAssets.bind(project) : project.getAssets.bind(project);

    const images = getAssetType(pxt.AssetType.Image).map(toGalleryItem).sort(compareInternalId);
    const tiles = getAssetType(pxt.AssetType.Tile).map(toGalleryItem)
        .filter((t: pxt.Tile) => !t.id.match(/^myTiles.transparency(8|16|32)$/gi)).sort(compareInternalId);
    const tilemaps = getAssetType(pxt.AssetType.Tilemap).map(toGalleryItem).sort(compareInternalId);
    const animations = getAssetType(pxt.AssetType.Animation).map(toGalleryItem).sort(compareInternalId);
    const songs = getAssetType(pxt.AssetType.Song).map(toGalleryItem).sort(compareInternalId);

    for (const asset of tempAssets) {
        switch (asset.type) {
            case pxt.AssetType.Image:
                images.push(toGalleryItem(asset));
                break;
            case pxt.AssetType.Tile:
                tiles.push(toGalleryItem(asset));
                break;
            case pxt.AssetType.Animation:
                animations.push(toGalleryItem(asset));
                break;
            case pxt.AssetType.Tilemap:
                tilemaps.push(toGalleryItem(asset));
                break;
            case pxt.AssetType.Song:
                songs.push(toGalleryItem(asset));
                break;
        }
    }

    // sort so that non-builtin assets appear at the top of the gallery
    images.sort(comparePackage);
    tiles.sort(comparePackage);
    tilemaps.sort(comparePackage);
    animations.sort(comparePackage);
    songs.sort(comparePackage);

    let assets: pxt.Asset[] = [];
    switch (firstType) {
        case pxt.AssetType.Image:
            assets = images.concat(tiles).concat(animations).concat(tilemaps).concat(songs);
            break;
        case pxt.AssetType.Tile:
            assets = tiles.concat(images).concat(animations).concat(tilemaps).concat(songs);
            break;
        case pxt.AssetType.Animation:
            assets = animations.concat(images).concat(tiles).concat(tilemaps).concat(songs);
            break;
        case pxt.AssetType.Tilemap:
            assets = tilemaps.concat(tiles).concat(images).concat(animations).concat(songs);
            break;
        case pxt.AssetType.Song:
            assets = songs.concat(images).concat(tiles).concat(animations).concat(tilemaps);
            break;
    }

    pxt.tickEvent(gallery ? "assets.gallery" : "assets.update", { count: assets.length });

    return assets;
}

export function assetToGalleryItem(asset: pxt.Asset, imgConv = new pxt.ImageConverter()) {
    switch (asset.type) {
        case pxt.AssetType.Image:
        case pxt.AssetType.Tile:
            asset.previewURI = imgConv.convert("data:image/x-mkcd-f," + asset.jresData);
            return asset;

        case pxt.AssetType.Tilemap:
            let tilemap = asset.data.tilemap;
            asset.previewURI = pxtblockly.tilemapToImageURI(asset.data, Math.max(tilemap.width, tilemap.height), false);
            return asset;
        case pxt.AssetType.Animation:
            if (asset.frames?.length <= 0) return null;
            asset.framePreviewURIs = asset.frames.map(bitmap => imgConv.convert("data:image/x-mkcd-f," + pxt.sprite.base64EncodeBitmap(bitmap)));
            asset.previewURI = asset.framePreviewURIs[0];
            return asset;
        case pxt.AssetType.Song:
            asset.previewURI = pxtblockly.songToDataURI(asset.song, 32, 32, false, 1);
            return asset;
    }
}

function compareInternalId(a: pxt.Asset, b: pxt.Asset) {
    return a.internalID - b.internalID;
}

function comparePackage(a: pxt.Asset, b: pxt.Asset) {
    const aPack = a.meta.package === "device" ? 1 : 0;
    const bPack = b.meta.package === "device" ? 1 : 0;
    return aPack - bPack;
}