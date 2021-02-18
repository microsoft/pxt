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