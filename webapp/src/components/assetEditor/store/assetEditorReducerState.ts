export const enum GalleryView {
    User,
    Gallery
}

export interface AssetEditorState {
    view: GalleryView;
    assets: pxt.Asset[];
    galleryAssets: pxt.Asset[];
    selectedAsset?: pxt.Asset;
}

export function isGalleryAsset(asset?: pxt.Asset) {
    return asset?.id.startsWith("sprites.");
}