import * as React from "react";

import { AssetPreview } from "./assetPreview";


interface AssetCardProps {
    asset: pxt.Asset;
}

export class AssetCard extends React.Component<AssetCardProps> {
    render() {
        const { asset } = this.props;
        return <div className="asset-editor-card">
            <AssetPreview asset={asset} />
            <div className="asset-editor-card-label">
                { getDisplayLabelForAsset(asset.type) }
            </div>
        </div>
    }
}


export function getDisplayLabelForAsset(type: pxt.AssetType) {
    switch (type) {
        case pxt.AssetType.Image:
            return lf("Image");
        case pxt.AssetType.Tile:
            return lf("Tile");
        case pxt.AssetType.Animation:
            return lf("Animation");
        case pxt.AssetType.Tilemap:
            return lf("Tilemap");
    }
}