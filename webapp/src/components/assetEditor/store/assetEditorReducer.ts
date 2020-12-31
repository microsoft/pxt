import * as actions from '../actions/types'

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

const initialState: AssetEditorState = {
    view: GalleryView.User,
    assets: [],
    galleryAssets: []
}

const topReducer = (state: AssetEditorState = initialState, action: any): AssetEditorState => {
    switch (action.type) {
        case actions.CHANGE_SELECTED_ASSET:
            return {
                ...state,
                selectedAsset: getSelectedAsset(state, action.assetType, action.assetId)
            };
        case actions.CHANGE_GALLERY_VIEW:
            return {
                ...state,
                view: action.view
            };
        case actions.UPDATE_USER_ASSETS:
            const assets = getAssets();
            return {
                ...state,
                selectedAsset: state.selectedAsset ? assets.find(el => el.id == state.selectedAsset.id) : undefined,
                assets
            }
        case actions.UPDATE_GALLERY_ASSETS:
            return {
                ...state,
                galleryAssets: action.assets
            }
        default:
            return state
    }
}

function compareInternalId(a: pxt.Asset, b: pxt.Asset) {
    return a.internalID - b.internalID;
}

function getSelectedAsset(state: AssetEditorState, type: pxt.AssetType, id: string) {
    if (!type || !id) return undefined;

    return state.assets.find(el => el.type == type && el.id == id)
        || state.galleryAssets.find(el => el.type == type && el.id == id);
}

export function getAssets(gallery = false, firstType = pxt.AssetType.Image): pxt.Asset[] {
    const project = pxt.react.getTilemapProject();
    const imgConv = new pxt.ImageConverter();

    const imageToGalleryItem = (image: pxt.ProjectImage | pxt.Tile) => {
        let asset = image as pxt.Asset;
        asset.previewURI = imgConv.convert("data:image/x-mkcd-f," + image.jresData);
        return asset;
    };

    const tilemapToGalleryItem = (asset: pxt.ProjectTilemap) => {
        let tilemap = asset.data.tilemap;
        asset.previewURI = pxtblockly.tilemapToImageURI(asset.data, Math.max(tilemap.width, tilemap.height), false);
        return asset;
    };

    const animationToGalleryItem = (asset: pxt.Animation) => {
        if (asset.frames?.length <= 0) return null;
        asset.framePreviewURIs = asset.frames.map(bitmap => imgConv.convert("data:image/x-mkcd-f," + pxt.sprite.base64EncodeBitmap(bitmap)));
        asset.previewURI = asset.framePreviewURIs[0];
        return asset;
    };

    const getAssetType = gallery ? project.getGalleryAssets.bind(project) : project.getAssets.bind(project);

    const images = getAssetType(pxt.AssetType.Image).map(imageToGalleryItem).sort(compareInternalId);
    const tiles = getAssetType(pxt.AssetType.Tile).map(imageToGalleryItem)
        .filter((t: pxt.Tile) => !t.id.match(/^myTiles.transparency(8|16|32)$/gi)).sort(compareInternalId);
    const tilemaps = getAssetType(pxt.AssetType.Tilemap).map(tilemapToGalleryItem).sort(compareInternalId);
    const animations = getAssetType(pxt.AssetType.Animation).map(animationToGalleryItem).sort(compareInternalId);

    let assets: pxt.Asset[] = [];
    switch (firstType) {
        case pxt.AssetType.Image:
            assets = images.concat(tiles).concat(animations).concat(tilemaps);
            break;
        case pxt.AssetType.Tile:
            assets = tiles.concat(images).concat(animations).concat(tilemaps);
            break;
        case pxt.AssetType.Animation:
            assets = animations.concat(images).concat(tiles).concat(tilemaps);
            break;
        case pxt.AssetType.Tilemap:
            assets = tilemaps.concat(tiles).concat(images).concat(animations)
    }

    pxt.tickEvent(gallery ? "assets.gallery" : "assets.update", { count: assets.length });

    return assets;
}

export default topReducer;