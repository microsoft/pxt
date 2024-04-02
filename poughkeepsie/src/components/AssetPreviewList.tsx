import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { ImageAsset } from "../types/project";
import { ImageAssetPreview } from "./ImageAssetPreview";

import css from "./styling/AssetPreviewList.module.scss";

export const AssetPreviewList: React.FC = () => {
    const { state } = useContext(AppStateContext);

    const assets = state.project.assets.filter(a => a.kind === state.activeImageTab) as ImageAsset[];

    return (
        <div className={css["asset-preview-list"]}>
            {assets.map(a =>
                <ImageAssetPreview key={a.id} assetId={a.id} />
            )}
        </div>
    )
};