import * as React from "react";
import { connect } from 'react-redux';

import { AssetEditorState, isGalleryAsset } from './store/assetEditorReducerState';
import { dispatchChangeSelectedAsset } from './actions/dispatch';

import { AssetPreview } from "./assetPreview";
import { fireClickOnEnter } from "../../util";


interface AssetCardProps {
    asset: pxt.Asset;
    selected?: boolean;
    dispatchChangeSelectedAsset: (assetType?: pxt.AssetType, assetId?: string) => void;
}

class AssetCardImpl extends React.Component<AssetCardProps> {
    clickHandler = () => {
        const { type, id } = this.props.asset;
        this.props.dispatchChangeSelectedAsset(type, id);
    }

    render() {
        const { asset, selected } = this.props;
        return <AssetCardView asset={asset} selected={selected} onClick={this.clickHandler} />
    }
}

interface AssetCardCoreProps {
    asset: pxt.Asset;
    selected?: boolean;
    onClick: (selected: pxt.Asset) => void;
}

export class AssetCardView extends React.Component<AssetCardCoreProps> {
    protected getDisplayIconForAsset(type: pxt.AssetType) {
        switch (type) {
            case pxt.AssetType.Tile:
                return "clone";
            case pxt.AssetType.Animation:
                return "video";
            case pxt.AssetType.Tilemap:
                return "map";
            case pxt.AssetType.Song:
                return "music";
            case pxt.AssetType.Image:
            default:
                return null;
        }
    }

    clickHandler = () => {
        this.props.onClick(this.props.asset);
    }

    render() {
        const { asset, selected } = this.props;
        const inGallery = isGalleryAsset(asset);
        const icon = this.getDisplayIconForAsset(asset.type);
        const showIcons = icon || !asset.meta?.displayName;
        return (
            <div
                className={`asset-editor-card ${selected ? "selected" : ""}`}
                onClick={this.clickHandler}
                role="listitem"
                tabIndex={0}
                onKeyDown={fireClickOnEnter}
            >
                <AssetPreview asset={asset} />
                {showIcons && <div className="asset-editor-card-label">
                    {icon && <div className="asset-editor-card-icon">
                        <i className={`icon ${icon}`} />
                    </div>}
                    {!asset.meta?.displayName && !inGallery && <div className="asset-editor-card-icon warning">
                        <i className="icon exclamation triangle" />
                    </div>}
                </div>}
            </div>
        );
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
