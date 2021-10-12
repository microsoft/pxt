import * as actions from '../actions/types'
import * as pkg from '../../../package';
import { getBlocksEditor } from '../../../app';
import { AssetEditorState, GalleryView } from './assetEditorReducerState';
import { assetToGalleryItem, getAssets } from '../../../assets';


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
            const selectedAsset = !!action.assetId ? getSelectedAsset(state, action.assetType, action.assetId) : state.selectedAsset;
            return {
                ...state,
                view: action.view,
                selectedAsset
            };
        case actions.UPDATE_USER_ASSETS:
            let assets = getAssets();
            let imgConv = new pxt.ImageConverter();

            if (isBlocksProject()) {
                assets = assets.concat(getBlocksEditor().getTemporaryAssets().map(a => assetToGalleryItem(a, imgConv)));
            }

            return {
                ...state,
                selectedAsset: state.selectedAsset ? assets.find(el => el.id == state.selectedAsset.id) : undefined,
                assets
            }
        case actions.UPDATE_GALLERY_ASSETS:
            return {
                ...state,
                galleryAssets: getAssets(true)
            }
        default:
            return state
    }
}



function getSelectedAsset(state: AssetEditorState, type: pxt.AssetType, id: string) {
    if (!type || !id) return undefined;

    return state.assets.find(el => el.type == type && el.id == id)
        || state.galleryAssets.find(el => el.type == type && el.id == id);
}



function isBlocksProject() {
    return pkg.mainPkg?.config?.preferredEditor === pxt.BLOCKS_PROJECT_NAME;
}

export default topReducer;