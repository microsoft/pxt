import * as React from "react";
import * as pkg from "../../package";
import * as sui from "../../sui";
import { connect } from 'react-redux';

import { AssetEditorState, GalleryView } from './store/assetEditorReducer';
import { dispatchUpdateUserAssets } from './actions/dispatch';
import { AssetGalleryTab } from './assetGalleryTab'

interface AssetTopbarProps {
    showAssetFieldView: (asset: pxt.Asset, cb: (result: any) => void) => void;
    dispatchUpdateUserAssets?: () => void;
}

interface AssetTopbarState {
    showCreateModal?: boolean;
}

class AssetTopbarImpl extends React.Component<AssetTopbarProps, AssetTopbarState> {
    constructor(props: AssetTopbarProps) {
        super(props);
        this.state = { showCreateModal: false };
    }

    protected showCreateModal = () => {
        this.setState({ showCreateModal: true });
    }

    protected hideCreateModal = () => {
        this.setState({ showCreateModal: false });
    }

    protected getCreateAssetHandler = (type: pxt.AssetType) => {
        return () => {
            const project = pxt.react.getTilemapProject();
            const asset = this.getEmptyAsset(type);

            this.hideCreateModal();
            this.props.showAssetFieldView(asset, (result: any) => {
                project.pushUndo();
                const name = result.meta?.displayName;
                switch (type) {
                    case pxt.AssetType.Image:
                        project.createNewProjectImage(result.bitmap); break;
                    case pxt.AssetType.Tile:
                        project.createNewTile(result.bitmap); break;
                    case pxt.AssetType.Tilemap:
                        project.createNewTilemapFromData(result.data, name); break;
                }
                pkg.mainEditorPkg().buildAssetsAsync()
                    .then(() => this.props.dispatchUpdateUserAssets());
            });
        }
    }

    protected getEmptyAsset(type: pxt.AssetType): pxt.Asset {
        const project = pxt.react.getTilemapProject();
        const asset = { type, id: "", internalID: 0, meta: {} } as pxt.Asset;
        switch (type) {
            case pxt.AssetType.Image:
            case pxt.AssetType.Tile:
                (asset as pxt.ProjectImage).bitmap = new pxt.sprite.Bitmap(16, 16).data(); break
            case pxt.AssetType.Tilemap:
                (asset as pxt.ProjectTilemap).data = project.blankTilemap(16, 16, 16);
        }
        return asset;
    }

    render() {
        const { showCreateModal } = this.state;

        const actions: sui.ModalButton[] = [
            { label: lf("Image"), onclick: this.getCreateAssetHandler(pxt.AssetType.Image) },
            { label: lf("Tile"), onclick: this.getCreateAssetHandler(pxt.AssetType.Tile) },
            { label: lf("Tilemap"), onclick: this.getCreateAssetHandler(pxt.AssetType.Tilemap) }
        ]

        return <div className="asset-editor-topbar">
            <AssetGalleryTab title={lf("My Assets")} view={GalleryView.User} />
            <AssetGalleryTab title={lf("Gallery")} view={GalleryView.Gallery} />
            <div className="asset-editor-button create-new" onClick={this.showCreateModal}>{lf("Create New")}</div>
            <sui.Modal isOpen={showCreateModal} onClose={this.hideCreateModal} closeIcon={false} dimmer={true} header={lf("Create New Asset")} buttons={actions}>
                <div>{lf("Choose your asset type from the options below.")}</div>
            </sui.Modal>
        </div>
    }
}

function mapStateToProps(state: AssetEditorState, ownProps: any) {
    if (!state) return {};
    return ownProps;
}

const mapDispatchToProps = {
    dispatchUpdateUserAssets
};

export const AssetTopbar = connect(mapStateToProps, mapDispatchToProps)(AssetTopbarImpl);