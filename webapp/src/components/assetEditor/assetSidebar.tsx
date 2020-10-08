import * as React from "react";
import * as sui from "../../sui";
import { connect } from 'react-redux';

import { AssetEditorState } from './store/assetEditorReducer';
import { AssetPreview } from "./assetPreview";

interface AssetDetail {
    name: string;
    value: string;
}

interface AssetSidebarProps {
    asset?: pxt.Asset;
}

class AssetSidebarImpl extends React.Component<AssetSidebarProps> {
    protected getAssetDetails(): AssetDetail[] {
        const asset = this.props.asset as pxt.ProjectImage; // TODO generalize
        const details: AssetDetail[] = [];
        if (asset) {
            details.push({ name: lf("Type"), value: getDisplayTextForAsset(asset.type)});
            details.push({ name: lf("Size"), value: `${asset.bitmap.width} x ${asset.bitmap.height}`});
        }

        return details;
    }

    protected editAssetHandler = () => {

    }

    protected duplicateAssetHandler = () => {

    }

    protected copyAssetHandler = () => {

    }

    protected deleteAssetHandler = () => {

    }

    render() {
        const { asset } = this.props;
        const details = this.getAssetDetails();

        return <div className="asset-editor-sidebar">
            <div className="asset-editor-sidebar-info">
                <div>{lf("Asset Preview")}</div>
                <div className="asset-editor-sidebar-preview">
                    { asset && <AssetPreview asset={asset} />  }
                </div>
                <div className="asset-editor-sidebar-name">
                    { asset ? asset.id : lf("No asset selected") }
                </div>
                {details.map(el => {
                    return <div key={el.name} className="asset-editor-sidebar-detail">{`${el.name}: ${el.value}`}</div>
                })}
            </div>
            { asset && <div className="asset-editor-sidebar-controls">
                <sui.MenuItem name={lf("Edit")} className="asset-editor-button" icon="edit" onClick={this.editAssetHandler}/>
                <sui.MenuItem name={lf("Duplicate")} className="asset-editor-button" icon="copy" onClick={this.duplicateAssetHandler}/>
                <sui.MenuItem name={lf("Copy")} className="asset-editor-button" icon="paste" onClick={this.copyAssetHandler}/>
                <sui.MenuItem name={lf("Delete")} className="asset-editor-button" icon="delete" onClick={this.deleteAssetHandler}/>
            </div>}
        </div>
    }
}

export function getDisplayTextForAsset(type: pxt.AssetType) {
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

function mapStateToProps(state: AssetEditorState, ownProps: any) {
    if (!state) return {};
    return {
        asset: state.selectedAsset
    };
}

const mapDispatchToProps = {
};

export const AssetSidebar = connect(mapStateToProps, mapDispatchToProps)(AssetSidebarImpl);
