import * as actions from '../actions/types'

export const enum GalleryView {
    User,
    Gallery
}

export interface AssetEditorState {
    view: GalleryView;
    assets: pxt.Asset[];
    selectedAsset?: pxt.Asset;
}

const initialState: AssetEditorState = {
    view: GalleryView.User,
    assets: []
}

const topReducer = (state: AssetEditorState = initialState, action: any): AssetEditorState => {
    switch (action.type) {
        case actions.CHANGE_SELECTED_ASSET:
            return {
                ...state,
                selectedAsset: action.asset
            };
        case actions.CHANGE_GALLERY_VIEW:
            return {
                ...state,
                view: action.view
            };
        case actions.UPDATE_USER_ASSETS:
            return {
                ...state,
                assets: getUserAssets()
            }
        default:
            return state
    }
}

function getUserAssets() {
    const project = pxt.react.getTilemapProject();
    const imgConv = new pxt.ImageConverter();

    const imageToGalleryItem = (image: pxt.ProjectImage | pxt.Tile) => {
        let asset = image as pxt.Asset;
        asset.previewURI = imgConv.convert("data:image/x-mkcd-f," + image.jresData);
        return asset;
    };

    return project.getAssets(pxt.AssetType.Image).map(imageToGalleryItem)
        .concat(project.getAssets(pxt.AssetType.Tile).map(imageToGalleryItem));
}

export default topReducer;