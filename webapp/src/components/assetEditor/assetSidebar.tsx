import * as React from "react";
import * as sui from "../../sui";

import { AssetPreview } from "./assetPreview";


interface AssetSidebarProps {
    asset?: pxt.Asset;
}

export class AssetSidebar extends React.Component<AssetSidebarProps> {
    render() {
        const { asset } = this.props;
        return <div className="asset-editor-sidebar">
            <div className="asset-editor-sidebar-preview">
                { asset && <AssetPreview asset={asset} /> }
            </div>
            <div className="asset-editor-sidebar-controls">
                <sui.MenuItem name={lf("Edit")} icon="edit" onClick={this.editAssetHandler}/>
                <sui.MenuItem name={lf("Duplicate")} icon="copy" onClick={this.duplicateAssetHandler}/>
                <sui.MenuItem name={lf("Delete")} icon="delete" onClick={this.deleteAssetHandler}/>
            </div>
        </div>
    }

    protected editAssetHandler = () => {

    }

    protected duplicateAssetHandler = () => {

    }

    protected deleteAssetHandler = () => {

    }
}