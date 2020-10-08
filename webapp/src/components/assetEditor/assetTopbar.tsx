import * as React from "react";
import { connect } from 'react-redux';

import { AssetEditorState, GalleryView } from './store/assetEditorReducer';
import { dispatchChangeGalleryView } from './actions/dispatch';

interface AssetGalleryTabProps {
    title: string;
    view: GalleryView;
    selected: boolean;
    dispatchChangeGalleryView: (view: GalleryView) => void;
}

class AssetGalleryTabImpl extends React.Component<AssetGalleryTabProps> {
    handleClick = () => {
        this.props.dispatchChangeGalleryView(this.props.view);
    }

    render() {
        const { title, selected } = this.props;

        return <div className={`asset-editor-gallery-tab ${selected ? "selected" : ""}`} onClick={this.handleClick}>
            {title}
        </div>
    }
}

function mapStateToProps(state: AssetEditorState, ownProps: any) {
    if (!state) return {};
    return {
        selected: state.view == ownProps.view
    };
}

const mapDispatchToProps = {
    dispatchChangeGalleryView
};

const AssetGalleryTab = connect(mapStateToProps, mapDispatchToProps)(AssetGalleryTabImpl);


interface AssetTopbarProps {
}

export class AssetTopbar extends React.Component<AssetTopbarProps> {
    render() {
        return <div className="asset-editor-topbar">
            <AssetGalleryTab title={lf("My Assets")} view={GalleryView.User} />
            <AssetGalleryTab title={lf("Gallery")} view={GalleryView.Gallery} />
            <div className="asset-editor-button create-new">{lf("Create New")}</div>
        </div>
    }
}