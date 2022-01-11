import * as React from "react";
import { connect } from 'react-redux';

import { AssetEditorState, GalleryView } from './store/assetEditorReducerState';
import { dispatchChangeGalleryView } from './actions/dispatch';

interface AssetGalleryTabProps {
    title: string;
    view: GalleryView;
    selected: boolean;
    dispatchChangeGalleryView: (view: GalleryView) => void;
}

class AssetGalleryTabImpl extends React.Component<AssetGalleryTabProps> {
    handleClick = () => {
        pxt.tickEvent("assets.gallerytab", { view: this.props.view.toString() });
        this.props.dispatchChangeGalleryView(this.props.view);
    }

    render() {
        const { title, selected } = this.props;

        return <div className={`asset-editor-gallery-tab ${selected ? "selected" : ""}`} onClick={this.handleClick} role="navigation">
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

export const AssetGalleryTab = connect(mapStateToProps, mapDispatchToProps)(AssetGalleryTabImpl);