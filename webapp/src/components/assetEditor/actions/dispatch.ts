import * as actions from './types'
import { GalleryView } from '../store/assetEditorReducer';

export const dispatchChangeSelectedAsset = (assetType?: pxt.AssetType, assetId?: string) => ({ type: actions.CHANGE_SELECTED_ASSET, assetType, assetId });
export const dispatchChangeGalleryView = (view: GalleryView) => ({ type: actions.CHANGE_GALLERY_VIEW, view });
export const dispatchUpdateUserAssets = () => ({ type: actions.UPDATE_USER_ASSETS });
export const dispatchUpdateGalleryAssets = () => ({ type: actions.UPDATE_GALLERY_ASSETS });
export const dispatchFilterButtonClicked = () => ({ type: actions.TOGGLE_FILTER });
export const dispatchFilterTagToggle = (tag: string) => ({ type: actions.TOGGLE_TAG, tag});