import * as React from "react";

interface AssetPreviewProps {
    asset: pxt.Asset;
}

export class AssetPreview extends React.Component<AssetPreviewProps> {
    render() {
        const { asset } = this.props;

        return <div className="asset-editor-preview">
            <img src={asset.previewURI} alt={lf("A preview of your asset (eg image, tile, animation)")} />
        </div>
    }
}