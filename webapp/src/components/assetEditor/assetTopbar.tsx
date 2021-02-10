import * as React from "react";
import { connect } from 'react-redux';

import { GalleryView } from './store/assetEditorReducer';
import { AssetGalleryTab } from './assetGalleryTab';

import {dispatchFilterButtonClicked} from './actions/dispatch';

interface AssetTopbarProps {
    dispatchFilterButtonClicked: () => void;
}

export class AssetTopbarImpl extends React.Component<AssetTopbarProps> {

    render() {
        return <div className="asset-editor-topbar">
            <AssetGalleryTab title={lf("My Assets")} view={GalleryView.User} />
            <AssetGalleryTab title={lf("Gallery")} view={GalleryView.Gallery} />
            <div className="asset-editor-filter-button" role="button" onClick={this.props.dispatchFilterButtonClicked}>
                <i className="icon filter" />
            </div>
        </div>
    }
}

const mapDispatchToProps = {
    dispatchFilterButtonClicked
};

export const AssetTopbar = connect(undefined, mapDispatchToProps)(AssetTopbarImpl)