import * as React from "react";

import { AssetCard } from "./assetCard";


interface AssetCardListProps {
    assets: pxt.Asset[];
}

export class AssetCardList extends React.Component<AssetCardListProps> {
    render() {
        const { assets } = this.props;
        return <div>
            {this.props.children}
            {assets.map(asset => <AssetCard asset={asset} key={asset.id} />)}
        </div>
    }
}
