import * as actions from './types'
import { GalleryView } from '../store/assetEditorReducer';

export const dispatchChangeSelectedAsset = (asset: pxt.Asset) => ({ type: actions.CHANGE_SELECTED_ASSET, asset });
export const dispatchChangeGalleryView = (view: GalleryView) => ({ type: actions.CHANGE_GALLERY_VIEW, view });
export const dispatchUpdateUserAssets = () => ({ type: actions.UPDATE_USER_ASSETS });