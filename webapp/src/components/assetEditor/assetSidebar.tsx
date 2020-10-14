import * as React from "react";
import * as pkg from "../../package";
import * as sui from "../../sui";
import { connect } from 'react-redux';

import { AssetEditorState, GalleryView } from './store/assetEditorReducer';
import { dispatchChangeGalleryView, dispatchChangeSelectedAsset, dispatchUpdateUserAssets } from './actions/dispatch';

import { AssetPreview } from "./assetPreview";

interface AssetDetail {
    name: string;
    value: string;
}

interface AssetSidebarProps {
    asset?: pxt.Asset;
    isGalleryAsset?: boolean;
    showAssetFieldView?: (asset: pxt.Asset, cb: (result: any) => void) => void;
    dispatchChangeGalleryView: (view: GalleryView) => void;
    dispatchChangeSelectedAsset: (asset: pxt.Asset) => void;
    dispatchUpdateUserAssets: () => void;
}

interface AssetSidebarState {
    showDeleteModal?: boolean;
}

class AssetSidebarImpl extends React.Component<AssetSidebarProps, AssetSidebarState> {
    protected copyTextAreaRef: HTMLTextAreaElement;

    constructor(props: AssetSidebarProps) {
        super(props);
        this.state = { showDeleteModal: false };
    }

    protected getAssetDetails(): AssetDetail[] {
        const asset = this.props.asset;
        const details: AssetDetail[] = [];
        if (asset) {
            details.push({ name: lf("Type"), value: getDisplayTextForAsset(asset.type)});

            switch (asset.type) {
                case pxt.AssetType.Image:
                case pxt.AssetType.Tile:
                    details.push({ name: lf("Size"), value: `${asset.bitmap.width} x ${asset.bitmap.height}`});
                    break;
                case pxt.AssetType.Tilemap:
                    details.push({ name: lf("Size"), value: `${asset.data.tilemap.width} x ${asset.data.tilemap.height}`});
            }
        }

        return details;
    }

    protected updateAssets(): void {
        pkg.mainEditorPkg().buildAssetsAsync()
            .then(() => this.props.dispatchUpdateUserAssets());
    }

    protected editAssetHandler = () => {
        this.props.showAssetFieldView(this.props.asset, this.editAssetDoneHandler);
    }

    protected editAssetDoneHandler = (result: any) => {
        const project = pxt.react.getTilemapProject();
        project.pushUndo();
        project.updateAsset(result);
        this.updateAssets();
    }

    protected duplicateAssetHandler = () => {
        const project = pxt.react.getTilemapProject();
        project.pushUndo();
        const newAsset = project.duplicateAsset(this.props.asset);
        this.props.dispatchChangeSelectedAsset(newAsset);
        if (this.props.isGalleryAsset) this.props.dispatchChangeGalleryView(GalleryView.User);
        this.updateAssets();
    }

    protected copyAssetHandler = () => {
        const { asset } = this.props;
        switch (asset.type) {
            case pxt.AssetType.Image:
            case pxt.AssetType.Tile:
                try {
                    const data = pxt.sprite.bitmapToImageLiteral(pxt.sprite.getBitmapFromJResURL(asset.jresData), "typescript");
                    this.copyTextAreaRef.value = data;
                    this.copyTextAreaRef.focus();
                    this.copyTextAreaRef.select();
                    document.execCommand("copy");
                } catch { }
                break;
            default:
                break;
        }
    }

    protected copyTextAreaRefHandler = (el: HTMLTextAreaElement) => { this.copyTextAreaRef = el }

    protected showDeleteModal = () => {
        this.setState({ showDeleteModal: true });
    }

    protected hideDeleteModal = () => {
        this.setState({ showDeleteModal: false });
    }

    protected deleteAssetHandler = () => {
        this.setState({ showDeleteModal: false });
        const project = pxt.react.getTilemapProject();
        project.pushUndo();
        project.removeAsset(this.props.asset);
        this.props.dispatchChangeSelectedAsset(null);
        this.updateAssets();
    }

    render() {
        const { asset, isGalleryAsset } = this.props;
        const { showDeleteModal } = this.state;
        const details = this.getAssetDetails();
        const name = asset?.meta?.displayName || lf("No asset selected");

        const actions: sui.ModalButton[] = [
            { label: lf("Cancel"), onclick: this.hideDeleteModal, icon: 'cancel' },
            { label: lf("Delete"), onclick: this.deleteAssetHandler, icon: 'trash', className: 'red' }
        ]

        return <div className="asset-editor-sidebar">
            <div className="asset-editor-sidebar-info">
                <div>{lf("Asset Preview")}</div>
                <div className="asset-editor-sidebar-preview">
                    { asset && <AssetPreview asset={asset} />  }
                </div>
                <div className="asset-editor-sidebar-name">{ name }</div>
                {details.map(el => {
                    return <div key={el.name} className="asset-editor-sidebar-detail">{`${el.name}: ${el.value}`}</div>
                })}
            </div>
            { asset && <div className="asset-editor-sidebar-controls">
                {!isGalleryAsset && <sui.MenuItem name={lf("Edit")} className="asset-editor-button" icon="edit" onClick={this.editAssetHandler}/>}
                <sui.MenuItem name={lf("Duplicate")} className="asset-editor-button" icon="copy" onClick={this.duplicateAssetHandler}/>
                <sui.MenuItem name={lf("Copy")} className="asset-editor-button" icon="paste" onClick={this.copyAssetHandler}/>
                {!isGalleryAsset && <sui.MenuItem name={lf("Delete")} className="asset-editor-button" icon="trash" onClick={this.showDeleteModal}/>}
            </div>}
            <textarea className="asset-editor-sidebar-copy" ref={this.copyTextAreaRefHandler} ></textarea>
            <sui.Modal isOpen={showDeleteModal} onClose={this.hideDeleteModal} closeIcon={false}
                dimmer={true} header={lf("Delete Asset")} buttons={actions}>
                <div>{lf("Are you sure you want to delete {0}? Deleted assets cannot be recovered.", name)}</div>
            </sui.Modal>
        </div>
    }
}

function getDisplayTextForAsset(type: pxt.AssetType) {
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
        asset: state.selectedAsset,
        isGalleryAsset: state.selectedAsset?.internalID == -1
    };
}

const mapDispatchToProps = {
    dispatchChangeGalleryView,
    dispatchChangeSelectedAsset,
    dispatchUpdateUserAssets
};

export const AssetSidebar = connect(mapStateToProps, mapDispatchToProps)(AssetSidebarImpl);
