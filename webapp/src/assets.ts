import * as pkg from "./package";

export function isNameTaken(name: string) {
    return pkg.mainEditorPkg().tilemapProject.isNameTaken(pxt.AssetType.Image, name);
}

export function createNewImageAsset(type: pxt.AssetType.Tile | pxt.AssetType.Image | pxt.AssetType.Animation, width: number, height: number) {
    const project = pkg.mainEditorPkg().tilemapProject;
    switch (type) {
        case pxt.AssetType.Tile:
            return project.createNewTile(new pxt.sprite.Bitmap(width, height).data());
        case pxt.AssetType.Image:
            return project.createNewImage(width, height);
        case pxt.AssetType.Animation:
    }

    return null;
}

export function createProjectImage(bitmap: pxt.sprite.BitmapData) {
    const project = pkg.mainEditorPkg().tilemapProject;
    return project.createNewProjectImage(bitmap);
}

export function createTile(bitmap: pxt.sprite.BitmapData) {
    const project = pkg.mainEditorPkg().tilemapProject;
    return project.createNewTile(bitmap);
}

export function lookupAsset(type: pxt.AssetType, id: string) {
    const project = pkg.mainEditorPkg().tilemapProject;
    return project.lookupAsset(type, id);
}

export function getNewInternalID() {
    const project = pkg.mainEditorPkg().tilemapProject;
    return project.getNewInternalId();
}