import * as React from "react";
import { connect } from 'react-redux';

import { AssetEditorState, GalleryView } from "./store/assetEditorReducer";

import { AssetCardList } from "./assetCardList";
import { AssetTopbar } from "./assetTopbar";

interface AssetGalleryProps {
    view: GalleryView;
    galleryAssets: pxt.Asset[];
    userAssets: pxt.Asset[];
}

class AssetGalleryImpl extends React.Component<AssetGalleryProps> {
    render() {
        const { view, galleryAssets, userAssets } = this.props;
        return <div className="asset-editor-gallery">
            <AssetTopbar />
            <div className={`asset-editor-card-list ${view !== GalleryView.User ? "hidden" : ""}`}>
                <AssetCardList assets={userAssets} />
            </div>
            <div className={`asset-editor-card-list ${view !== GalleryView.Gallery ? "hidden" : ""}`}>
                <AssetCardList assets={galleryAssets} />
            </div>
        </div>
    }
}

function mapStateToProps(state: AssetEditorState, ownProps: any) {
    if (!state) return {};
    return {
        ...ownProps,
        view: state.view,
        userAssets: state.assets
    }
}

const mapDispatchToProps = {
};

export const AssetGallery = connect(mapStateToProps, mapDispatchToProps)(AssetGalleryImpl);
