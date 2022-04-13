import * as actions from './types'
import { GalleryView } from '../store/assetEditorReducerState';

export const dispatchChangeSelectedAsset = (assetType?: pxt.AssetType, assetId?: string) => ({ type: actions.CHANGE_SELECTED_ASSET, assetType, assetId });
export const dispatchChangeGalleryView = (view: GalleryView, assetType?: pxt.AssetType, assetId?: string) => ({ type: actions.CHANGE_GALLERY_VIEW, view, assetType, assetId });
export const dispatchUpdateUserAssets = () => ({ type: actions.UPDATE_USER_ASSETS });
export const dispatchUpdateGalleryAssets = () => ({ type: actions.UPDATE_GALLERY_ASSETS });