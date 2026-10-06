export interface PreparedBackpackAssetGallery {
    snapshot: pxt.AssetSnapshot;
    projectGallery: pxt.AssetSnapshot;
}

/** Copy gallery data and restore the class prototypes that structuredClone removes. */
export function prepareBackpackAssetGallery(
    gallery: pxt.AssetSnapshot,
    project: pxt.TilemapProject
): PreparedBackpackAssetGallery {
    const snapshot = structuredClone(gallery);
    const projectGallery = project.saveGallerySnapshot();

    for (const type of Object.keys(snapshot.assets)) {
        const collection = snapshot.assets[type];
        Object.setPrototypeOf(collection, Object.getPrototypeOf(projectGallery.assets[type]));
        if (type === pxt.AssetType.Tilemap) {
            for (const asset of (collection as unknown as { assets: pxt.ProjectTilemap[] }).assets) {
                Object.setPrototypeOf(asset.data, pxt.sprite.TilemapData.prototype);
                Object.setPrototypeOf(asset.data.tilemap, pxt.sprite.Tilemap.prototype);
            }
        }
    }

    return { snapshot, projectGallery };
}
