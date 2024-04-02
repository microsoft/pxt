import css from "./styling/ImageEditor.module.scss";

import { AssetEditorFrame } from "./AssetEditorFrame";
import { useCallback, useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Asset } from "../types/project";
import { updateImageAsset } from "../state/actions";
import { ImageEditorSidebar } from "./ImageEditorSidebar";

interface IProps {

}


export const ImageEditor: React.FC<IProps> = (props) => {
    const { state, dispatch } = useContext(AppStateContext);

    const onAssetChanged = useCallback((asset: Asset) => {
        dispatch(updateImageAsset(asset));
    }, []);

    return (
        <div className={css["image-editor"]}>
            <AssetEditorFrame assetId={state.currentImageId} onAssetChanged={onAssetChanged} />
            <ImageEditorSidebar />
        </div>
    );
};