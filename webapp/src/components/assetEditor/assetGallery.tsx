import * as React from "react";
import * as pkg from "../../package";
import * as sui from "../../sui";
import { connect } from 'react-redux';

import { AssetEditorState, GalleryView } from "./store/assetEditorReducer";
import { dispatchUpdateUserAssets } from './actions/dispatch';

import { AssetCardList } from "./assetCardList";
import { AssetTopbar } from "./assetTopbar";

interface AssetGalleryProps {
    view: GalleryView;
    galleryAssets: pxt.Asset[];
    userAssets: pxt.Asset[];
    showAssetFieldView?: (asset: pxt.Asset, cb: (result: any) => void) => void;
    dispatchUpdateUserAssets?: () => void;
}

interface AssetGalleryState {
    showCreateModal?: boolean;
}

class AssetGalleryImpl extends React.Component<AssetGalleryProps, AssetGalleryState> {
    constructor(props: AssetGalleryProps) {
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
                        project.createNewProjectImage(result.bitmap, name); break;
                    case pxt.AssetType.Tile:
                        project.createNewTile(result.bitmap, null, name); break;
                    case pxt.AssetType.Tilemap:
                        project.createNewTilemapFromData(result.data, name); break;
                    case pxt.AssetType.Animation:
                        project.createNewAnimationFromData(result.data, name); break;
                }
                pkg.mainEditorPkg().buildAssetsAsync()
                    .then(() => this.props.dispatchUpdateUserAssets());
            });
        }
    }

    protected getEmptyAsset(type: pxt.AssetType): pxt.Asset {
        const project = pxt.react.getTilemapProject();
        const asset = { type, id: "", internalID: 0, meta: { displayName: this.getEmptyAssetDisplayName(type) } } as pxt.Asset;
        switch (type) {
            case pxt.AssetType.Image:
            case pxt.AssetType.Tile:
                (asset as pxt.ProjectImage).bitmap = new pxt.sprite.Bitmap(16, 16).data(); break
            case pxt.AssetType.Tilemap:
                const tilemap = asset as pxt.ProjectTilemap;
                tilemap.data = project.blankTilemap(16, 16, 16);
            case pxt.AssetType.Animation:
                const animation = asset as pxt.Animation;
                animation.frames = [new pxt.sprite.Bitmap(16, 16).data()];
                break;

        }
        return asset;
    }

    protected getEmptyAssetDisplayName(type: pxt.AssetType): string {
        switch (type) {
            case pxt.AssetType.Image:
                return lf("image");
            case pxt.AssetType.Tile:
                return lf("tile");
            case pxt.AssetType.Tilemap:
                return lf("level");
            case pxt.AssetType.Animation:
                return lf("anim");
            default:
                return lf("asset")
        }
    }

    render() {
        const { view, galleryAssets, userAssets } = this.props;
        const { showCreateModal } = this.state;

        const actions: sui.ModalButton[] = [
            { label: lf("Image"), onclick: this.getCreateAssetHandler(pxt.AssetType.Image) },
            { label: lf("Tile"), onclick: this.getCreateAssetHandler(pxt.AssetType.Tile) },
            { label: lf("Tilemap"), onclick: this.getCreateAssetHandler(pxt.AssetType.Tilemap) }
        ]

        return <div className="asset-editor-gallery">
            <AssetTopbar />
            <div className={`asset-editor-card-list ${view !== GalleryView.User ? "hidden" : ""}`}>
                <AssetCardList assets={userAssets}>
                    <div className="create-new" role="button" onClick={this.showCreateModal}>
                        <i className="icon huge add circle" />
                        <span>{lf("New Asset")}</span>
                    </div>
                </AssetCardList>
            </div>
            <div className={`asset-editor-card-list ${view !== GalleryView.Gallery ? "hidden" : ""}`}>
                <AssetCardList assets={galleryAssets} />
            </div>
            <sui.Modal className="asset-editor-create-dialog" isOpen={showCreateModal} onClose={this.hideCreateModal}
                closeIcon={true} dimmer={true} header={lf("Create New Asset")} buttons={actions}>
                <div>{lf("Choose your asset type from the options below.")}</div>
            </sui.Modal>
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
    dispatchUpdateUserAssets
};

export const AssetGallery = connect(mapStateToProps, mapDispatchToProps)(AssetGalleryImpl);
