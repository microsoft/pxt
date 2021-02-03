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

interface AssetOption {
    label: string;
    icon: string;
    handler: () => void;
}

class AssetGalleryImpl extends React.Component<AssetGalleryProps, AssetGalleryState> {
    private assetCreateOptions: AssetOption[];

    constructor(props: AssetGalleryProps) {
        super(props);
        this.state = { showCreateModal: false };

        this.assetCreateOptions = [
            { label: lf("Image"), icon: "picture", handler: this.getCreateAssetHandler(pxt.AssetType.Image) },
            { label: lf("Tile"), icon: "clone", handler: this.getCreateAssetHandler(pxt.AssetType.Tile) },
            { label: lf("Tilemap"), icon: "map", handler: this.getCreateAssetHandler(pxt.AssetType.Tilemap) },
            { label: lf("Animation"), icon: "video", handler: this.getCreateAssetHandler(pxt.AssetType.Animation) }
        ]
    }

    protected showCreateModal = () => {
        this.setState({ showCreateModal: true });
    }

    protected hideCreateModal = () => {
        this.setState({ showCreateModal: false });
    }

    protected getCreateAssetHandler = (type: pxt.AssetType) => {
        return () => {
            pxt.tickEvent("assets.create", { type: type.toString() });

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
                        project.createNewAnimationFromData(result.frames, result.interval, name); break;
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
                animation.interval = 200;
                break;

        }
        return asset;
    }

    protected getEmptyAssetDisplayName(type: pxt.AssetType): string {
        switch (type) {
            case pxt.AssetType.Image:
                return lf("myImage");
            case pxt.AssetType.Tile:
                return lf("myTile");
            case pxt.AssetType.Tilemap:
                return lf("level");
            case pxt.AssetType.Animation:
                return lf("myAnim");
            default:
                return lf("asset")
        }
    }

    render() {
        const { view, galleryAssets, userAssets } = this.props;
        const { showCreateModal } = this.state;
        const isBlocksProject = pkg.mainPkg?.config && pkg.mainPkg.getPreferredEditor() === pxt.BLOCKS_PROJECT_NAME;

        return <div className="asset-editor-gallery">
            <AssetTopbar />
            <div className={`asset-editor-card-list ${view !== GalleryView.User ? "hidden" : ""}`}>
                <AssetCardList assets={filterAssets(userAssets, isBlocksProject)}>
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
                closeIcon={true} dimmer={true} header={lf("Create New Asset")}>
                <div>{lf("Choose your asset type from the options below:")}</div>
                <div className="asset-editor-create-options">{
                    this.assetCreateOptions.map((opt, i) => {
                        return <div className="asset-editor-create-button" onClick={opt.handler} role="button" key={i}>
                            <i className={`icon ${opt.icon}`} /><span>{opt.label}</span>
                        </div>
                    })
                }</div>
            </sui.Modal>
        </div>
    }
}
function filterAssets(assets: pxt.Asset[], includeTemporary: boolean) {
    return includeTemporary ? assets : assets.filter(asset => !!asset.meta.displayName)
}


function mapStateToProps(state: AssetEditorState, ownProps: any) {
    if (!state) return {};
    return {
        ...ownProps,
        view: state.view,
        userAssets: state.assets,
        galleryAssets: state.galleryAssets
    }
}

const mapDispatchToProps = {
    dispatchUpdateUserAssets
};

export const AssetGallery = connect(mapStateToProps, mapDispatchToProps)(AssetGalleryImpl);
