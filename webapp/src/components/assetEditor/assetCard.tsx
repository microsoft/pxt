import * as React from "react";
import { connect } from 'react-redux';

import { AssetEditorState } from './store/assetEditorReducer';
import { dispatchChangeSelectedAsset } from './actions/dispatch';

import { AssetPreview } from "./assetPreview";


interface AssetCardProps {
    asset: pxt.Asset;
    selected?: boolean;
    dispatchChangeSelectedAsset: (assetType?: pxt.AssetType, assetId?: string) => void;
}

class AssetCardImpl extends React.Component<AssetCardProps> {
    protected getDisplayIconForAsset(type: pxt.AssetType) {
        switch (type) {
            case pxt.AssetType.Tile:
                return "clone";
            case pxt.AssetType.Animation:
                return "video";
            case pxt.AssetType.Tilemap:
                return "map";
            case pxt.AssetType.Image:
            default:
                return null;
        }
    }

    clickHandler = () => {
        const { type, id } = this.props.asset;
        this.props.dispatchChangeSelectedAsset(type, id);
    }

    render() {
        const { asset, selected } = this.props;
        const icon = this.getDisplayIconForAsset(asset.type);
        return <div className={`asset-editor-card ${selected ? "selected" : ""}`} onClick={this.clickHandler} role="listitem">
            <AssetPreview asset={asset} />
            {icon && <div className="asset-editor-card-label">
                <i className={`icon ${icon}`} />
            </div>}
        </div>
    }
}

function mapStateToProps(state: AssetEditorState, ownProps: any) {
    if (!state) return {};
    return {
        selected: state.selectedAsset && ownProps.asset.id == state.selectedAsset.id
    }
}

const mapDispatchToProps = {
    dispatchChangeSelectedAsset
};

export const AssetCard = connect(mapStateToProps, mapDispatchToProps)(AssetCardImpl);
