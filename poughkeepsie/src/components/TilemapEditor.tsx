import css from "./styling/TilemapEditor.module.scss";

import { AssetEditorFrame } from "./AssetEditorFrame";
import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { updateTilemapAsset } from "../state/actions";
import { Asset, TilemapAsset } from "../types/project";

interface IProps {

}


export const TilemapEditor: React.FC<IProps> = (props) => {
    const { state, dispatch } = useContext(AppStateContext);

    const onAssetChanged = (asset: Asset) => {
        dispatch(updateTilemapAsset(asset as TilemapAsset));
    }

    return (
        <div className={css["tilemap-editor"]}>
            <AssetEditorFrame assetId={state.currentTilemapId} onAssetChanged={onAssetChanged} />
        </div>
    );
};