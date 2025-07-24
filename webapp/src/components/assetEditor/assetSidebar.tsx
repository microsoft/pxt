import * as React from "react";
import * as pkg from "../../package";
import * as simulator from "../../simulator";
import { connect } from 'react-redux';

import { Button } from "../../../../react-common/components/controls/Button";
import { List } from "../../../../react-common/components/controls/List";
import { Modal, ModalAction } from "../../../../react-common/components/controls/Modal";

import { AssetEditorState, GalleryView, isGalleryAsset } from './store/assetEditorReducerState';
import { dispatchChangeGalleryView, dispatchChangeSelectedAsset, dispatchUpdateUserAssets } from './actions/dispatch';

import { AssetPreview } from "./assetPreview";
import { AssetPalette } from "./assetPalette";
import { getBlocksEditor } from "../../app";
import { getLabelForAssetType } from "../../assets";

interface AssetDetail {
    name: string;
    value: string;
}

interface AssetSidebarProps {
    asset?: pxt.Asset;
    isGalleryAsset?: boolean;
    showAssetFieldView?: (asset: pxt.Asset, cb: (result: any) => void) => void;
    updateProject: () => void;
    dispatchChangeGalleryView: (view: GalleryView, assetType?: pxt.AssetType, assetId?: string) => void;
    dispatchChangeSelectedAsset: (assetType?: pxt.AssetType, assetId?: string) => void;
    dispatchUpdateUserAssets: () => void;
}

interface AssetSidebarState {
    showDeleteModal: boolean;
    showPaletteModal: boolean;
    canEdit: boolean;
    canCopy: boolean;
    canDelete: boolean;
}

class AssetSidebarImpl extends React.Component<AssetSidebarProps, AssetSidebarState> {
    protected copyTextAreaRef: HTMLTextAreaElement;

    constructor(props: AssetSidebarProps) {
        super(props);
        this.state = { showDeleteModal: false, showPaletteModal: false, canEdit: true, canCopy: true, canDelete: true };
    }

    UNSAFE_componentWillReceiveProps(nextProps: AssetSidebarProps) {
        if (nextProps.asset && this.props.asset != nextProps.asset) {
            const { asset, isGalleryAsset } = nextProps;

            const project = pxt.react.getTilemapProject();
            const canEdit = !isGalleryAsset;
            const canCopy = asset?.type != pxt.AssetType.Tilemap && asset?.type != pxt.AssetType.Animation;
            const canDelete = !isGalleryAsset && !project.isAssetUsed(asset, pkg.mainEditorPkg().files);

            this.setState({ canEdit, canCopy, canDelete });
        }
    }

    protected getAssetDetails(): AssetDetail[] {
        const asset = this.props.asset;
        const details: AssetDetail[] = [];
        if (asset) {
            details.push({ name: lf("Type"), value: getLabelForAssetType(asset.type) });

            switch (asset.type) {
                case pxt.AssetType.Image:
                case pxt.AssetType.Tile:
                    details.push({ name: lf("Size"), value: `${asset.bitmap.width} x ${asset.bitmap.height}` });
                    break;
                case pxt.AssetType.Tilemap:
                    details.push({ name: lf("Size"), value: `${asset.data.tilemap.width} x ${asset.data.tilemap.height}` });
                    break;
                case pxt.AssetType.Animation:
                    details.push({ name: lf("Size"), value: `${asset.frames[0].width} x ${asset.frames[0].height}` });
                    break;
            }
        }

        return details;
    }

    protected updateAssets(): Promise<void> {
        return pkg.mainEditorPkg().buildAssetsAsync()
            .then(() => this.props.dispatchUpdateUserAssets());
    }

    protected editAssetHandler = () => {
        this.props.showAssetFieldView(this.props.asset, this.editAssetDoneHandler);
    }

    protected editAssetDoneHandler = (result: pxt.Asset) => {
        pxt.tickEvent("assets.edit", { type: result.type.toString() });

        const project = pxt.react.getTilemapProject();
        project.pushUndo();
        result = pxt.patchTemporaryAsset(this.props.asset, result, project);

        if (result.meta.displayName) {
            result = project.updateAsset(result);
        }

        if (!this.props.asset.meta?.displayName && result.meta.temporaryInfo) {
            getBlocksEditor().updateTemporaryAsset(result);
            pkg.mainEditorPkg().lookupFile(`this/${pxt.MAIN_BLOCKS}`).setContentAsync(getBlocksEditor().getCurrentSource());
        }

        this.props.dispatchChangeGalleryView(GalleryView.User);
        this.updateAssets().then(() => simulator.setDirty());
    }

    protected duplicateAssetHandler = () => {
        const { isGalleryAsset } = this.props;
        pxt.tickEvent("assets.duplicate", { type: this.props.asset.type.toString(), gallery: isGalleryAsset.toString() });

        const asset = this.props.asset;
        const displayName = asset.meta?.displayName
            || getDisplayNameForAsset(asset, isGalleryAsset)
            || pxt.getDefaultAssetDisplayName(asset.type);

        const project = pxt.react.getTilemapProject();
        project.pushUndo();
        const { type, id } = project.duplicateAsset(asset, displayName);
        this.updateAssets().then(() => {
            if (isGalleryAsset) this.props.dispatchChangeGalleryView(GalleryView.User, type, id);
        });
    }

    protected copyAssetHandler = () => {
        const { asset } = this.props;
        pxt.tickEvent("assets.clipboard", { type: asset.type.toString(), gallery: this.props.isGalleryAsset.toString() });

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

    protected showPaletteModal = () => {
        this.setState({ showPaletteModal: true });
        pxt.tickEvent("palette.open");
    }

    protected hidePaletteModal = (paletteChanged: boolean) => {
        this.setState({ showPaletteModal: false });
        if (paletteChanged) this.props.updateProject();
    }

    protected deleteAssetHandler = () => {
        pxt.tickEvent("assets.delete", { type: this.props.asset.type.toString() });

        this.setState({ showDeleteModal: false });
        const project = pxt.react.getTilemapProject();
        project.pushUndo();
        project.removeAsset(this.props.asset);
        this.props.dispatchChangeSelectedAsset();
        this.updateAssets();
    }

    render() {
        const { asset, isGalleryAsset } = this.props;
        const { showDeleteModal, showPaletteModal, canEdit, canCopy, canDelete } = this.state;
        const details = this.getAssetDetails();
        const isNamed = asset?.meta?.displayName || isGalleryAsset;
        const name = getDisplayNameForAsset(asset, isGalleryAsset);

        const actions: ModalAction[] = [
            { label: lf("Delete"), onClick: this.deleteAssetHandler, icon: 'icon trash', className: 'red' }
        ];

        return <div className="asset-editor-sidebar">
            <List className="asset-editor-sidebar-info">
                <div>{lf("Asset Preview")}</div>
                <div className="asset-editor-sidebar-preview">
                    {asset && <AssetPreview asset={asset} />}
                </div>
                {isNamed || !asset
                    ? <div className="asset-editor-sidebar-name">{name}</div>
                    : <div className="asset-editor-sidebar-temp">
                        <i className="icon exclamation triangle" />
                        <span>{lf("No asset name")}</span>
                    </div>
                }
                {details.map(el => {
                    return <div key={el.name} className="asset-editor-sidebar-detail">{`${el.name}: ${el.value}`}</div>
                })}
            </List>
            <List className="asset-editor-sidebar-controls">
                {asset && canEdit && <Button
                    label={lf("Edit")}
                    title={lf("Edit the selected asset")}
                    ariaLabel={lf("Edit the selected asset")}
                    leftIcon="icon edit"
                    className="asset-editor-button"
                    onClick={this.editAssetHandler} />}
                {asset && <Button
                    label={lf("Duplicate")}
                    title={lf("Duplicate the selected asset")}
                    ariaLabel={lf("Duplicate the selected asset")}
                    leftIcon="icon copy"
                    className="asset-editor-button"
                    onClick={this.duplicateAssetHandler} />}
                {asset && canCopy && <Button
                    label={lf("Copy")}
                    title={lf("Copy the selected asset to the clipboard")}
                    ariaLabel={lf("Copy the selected asset to the clipboard")}
                    leftIcon="icon paste"
                    className="asset-editor-button"
                    onClick={this.copyAssetHandler} />}
                {asset && canDelete && <Button
                    label={lf("Delete")}
                    title={lf("Delete the selected asset")}
                    ariaLabel={lf("Delete the selected asset")}
                    className="asset-editor-button"
                    leftIcon="icon trash"
                    onClick={this.showDeleteModal} />}
                <Button className="tertiary asset-palette-button"
                    label={lf("Colors")}
                    title={lf("Open the color palette")}
                    ariaLabel={lf("Open the color palette")}
                    leftIcon="fas fa-palette"
                    onClick={this.showPaletteModal}
                />
            </List>
            <textarea className="asset-editor-sidebar-copy" ref={this.copyTextAreaRefHandler} ></textarea>
            {showDeleteModal && <Modal
                className="asset-editor-delete-dialog"
                onClose={this.hideDeleteModal}
                title={lf("Delete Asset")}
                actions={actions}
                parentElement={document.getElementById("root")}>
                <div>{lf("Are you sure you want to delete {0}? Deleted assets cannot be recovered.", name)}</div>
            </Modal>}
            {showPaletteModal && <AssetPalette onClose={this.hidePaletteModal} />}
        </div>
    }
}

function getDisplayNameForAsset(asset: pxt.Asset, isGalleryAsset?: boolean) {
    if (!asset) {
        return lf("No asset selected");
    } else if (asset?.meta?.displayName) {
        return asset.meta.displayName;
    } else if (isGalleryAsset) {
        return asset.id.split('.').pop();
    }
    return null;
}

function mapStateToProps(state: AssetEditorState, ownProps: any) {
    if (!state) return {};
    return {
        asset: state.selectedAsset,
        isGalleryAsset: isGalleryAsset(state.selectedAsset)
    };
}

const mapDispatchToProps = {
    dispatchChangeGalleryView,
    dispatchChangeSelectedAsset,
    dispatchUpdateUserAssets
};

export const AssetSidebar = connect(mapStateToProps, mapDispatchToProps)(AssetSidebarImpl);
