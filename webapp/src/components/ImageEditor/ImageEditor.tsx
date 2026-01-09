import * as React from 'react';

import { Store } from 'redux';
import { Provider } from 'react-redux';
import { mainStore, tileEditorStore } from './store/imageStore'
import { SideBar } from './SideBar';
import { BottomBar } from './BottomBar';
import { TopBar } from './TopBar';
import { ImageCanvas } from './ImageCanvas';
import { Alert, AlertInfo } from './Alert';

import { Timeline } from './Timeline';
import { addKeyListener, removeKeyListener, setStore } from './keyboardShortcuts';

import { dispatchSetInitialState, dispatchImageEdit, dispatchChangeZoom, dispatchOpenAsset, dispatchCloseTileEditor, dispatchDisableResize, dispatchChangeAssetName, dispatchChangeImageDimensions, dispatchSetFrames } from './actions/dispatch';
import { EditorState, AnimationState, TilemapState, GalleryTile, ImageEditorStore } from './store/imageReducer';
import { imageStateToBitmap, imageStateToTilemap, applyBitmapData } from './util';
import { Unsubscribe, Action } from 'redux';
import { createNewImageAsset, getNewInternalID } from '../../assets';
import { AssetEditorCore } from '../ImageFieldEditor';
import { classList } from '../../../../react-common/components/util';

export const LIGHT_MODE_TRANSPARENT = "#dedede";

export interface ImageEditorSaveState {
    editor: EditorState;
    past: AnimationState[];
}

export interface ImageEditorProps {
    singleFrame?: boolean;
    onChange?: (value: string) => void;
    asset?: pxt.Asset;
    store?: Store<ImageEditorStore>;
    onDoneClicked?: (value: pxt.Asset) => void;
    onTileEditorOpenClose?: (open: boolean) => void;
    nested?: boolean;
    lightMode?: boolean;
    hideDoneButton?: boolean;
    hideAssetName?: boolean;
}

export interface ImageEditorState {
    editingTile: boolean;
    tileToEdit?: pxt.Tile;
    resizeDisabled?: boolean;
    alert?: AlertInfo;
}

export class ImageEditor extends React.Component<ImageEditorProps, ImageEditorState> implements AssetEditorCore {
    protected unsubscribeChangeListener: Unsubscribe;

    constructor(props: ImageEditorProps) {
        super(props);

        this.state = { editingTile: false };
    }

    componentDidMount() {
        addKeyListener();

        if (this.props.asset) {
            this.openAsset(this.props.asset);
        }

        this.unsubscribeChangeListener = this.getStore().subscribe(this.onStoreChange);

        this.onResize();
    }

    componentWillUnmount() {
        if (!this.props.nested) removeKeyListener();

        if (this.unsubscribeChangeListener) {
            this.unsubscribeChangeListener()
        }
    }

    render(): JSX.Element {
        const { singleFrame, lightMode, hideDoneButton, hideAssetName } = this.props;
        const instanceStore = this.getStore();

        const { tileToEdit, editingTile, alert } = this.state;

        const isAnimationEditor = instanceStore.getState().store.present.kind === "Animation"

        return <div className="image-editor-outer">
            <Provider store={instanceStore}>
                <div className={classList("image-editor", editingTile && "editing-tile", hideDoneButton && "hide-done-button")}>
                    <TopBar singleFrame={singleFrame} />
                    <div className="image-editor-content">
                        <SideBar lightMode={lightMode} />
                        <ImageCanvas suppressShortcuts={editingTile} lightMode={lightMode} />
                        {isAnimationEditor && !singleFrame ? <Timeline /> : undefined}
                    </div>
                    <BottomBar singleFrame={singleFrame} onDoneClick={this.onDoneClick} hideDoneButton={!!hideDoneButton} hideAssetName={!!hideAssetName} />
                    {alert && alert.title && <Alert title={alert.title} text={alert.text} options={alert.options} />}
                </div>
            </Provider>
            {editingTile &&
                <ImageEditor
                    store={tileEditorStore}
                    ref="nested-image-editor"
                    onDoneClicked={this.onTileEditorFinished}
                    asset={tileToEdit}
                    singleFrame={true}
                    nested={true}
                    hideAssetName={hideAssetName}
                />
            }
        </div>
    }

    openAsset(asset: pxt.Asset, gallery?: GalleryTile[], keepPast = false) {
        this.dispatchOnStore(dispatchOpenAsset(asset, keepPast, gallery))

        if (asset.meta.displayName) {
            this.dispatchOnStore(dispatchChangeAssetName(asset.meta.displayName));
        }
        else if (keepPast) {
            this.dispatchOnStore(dispatchChangeAssetName(""));
        }
    }

    openGalleryAsset(asset: pxt.Asset) {
        const current = this.getAsset();

        const frames = (this.getStore().getState().store.present as AnimationState).frames;

        switch (current.type) {
            case pxt.AssetType.Animation:
                switch (asset.type) {
                    case pxt.AssetType.Image:
                    case pxt.AssetType.Tile:
                        this.setCurrentFrame(pxt.sprite.Bitmap.fromData(asset.bitmap), frames.length === 1);
                        break;
                    case pxt.AssetType.Animation:
                        this.dispatchOnStore(dispatchSetFrames(asset.frames.map(b => ({ bitmap: b }))));
                        break;
                }
                break;
            case pxt.AssetType.Image:
            case pxt.AssetType.Tile:
                switch (asset.type) {
                    case pxt.AssetType.Image:
                    case pxt.AssetType.Tile:
                        this.setCurrentFrame(pxt.sprite.Bitmap.fromData(asset.bitmap), true);
                        break;
                    case pxt.AssetType.Animation:
                        this.setCurrentFrame(pxt.sprite.Bitmap.fromData(asset.frames[0]), true);
                        break;
                }
                break;
            case pxt.AssetType.Tilemap:
                if (asset.type === pxt.AssetType.Tilemap) {
                    const currentTilemap = current as pxt.ProjectTilemap;
                    const copied = pxt.cloneAsset(asset) as pxt.ProjectTilemap;

                    const project = pxt.react.getTilemapProject();
                    pxt.sprite.updateTilemapReferencesFromResult(project, currentTilemap);
                    this.prepareGalleryTilemapTemplate(project, currentTilemap, copied);

                    copied.id = currentTilemap.id;
                    copied.internalID = currentTilemap.internalID;
                    copied.meta = { ...currentTilemap.meta };
                    const { tileGallery } = this.getStore().getState().editor;
                    this.openAsset(copied, tileGallery, false);
                }
                break;
        }
    }

    protected prepareGalleryTilemapTemplate(
        project: pxt.TilemapProject,
        current: pxt.ProjectTilemap,
        copied: pxt.ProjectTilemap
    ) {
        this.mergeTilemapTilesIntoProject(project, copied);
        this.mergeCurrentTilemapCustomTilesIntoTileset(project, current, copied);
    }

    protected mergeCurrentTilemapCustomTilesIntoTileset(
        project: pxt.TilemapProject,
        source: pxt.ProjectTilemap,
        target: pxt.ProjectTilemap
    ) {
        const sourceTiles = source?.data?.tileset?.tiles as pxt.Tile[];
        const targetTiles = target?.data?.tileset?.tiles as pxt.Tile[];
        const tileWidth = target?.data?.tileset?.tileWidth;

        if (!sourceTiles?.length || !targetTiles || !tileWidth) return;

        const transparencyId = `myTiles.transparency${tileWidth}`;

        for (const tile of sourceTiles) {
            if (!tile?.isProjectTile) continue;
            if (tile.id === transparencyId) continue;
            if (tile.bitmap?.width !== tileWidth || tile.bitmap?.height !== tileWidth) continue;

            const resolved = project.resolveTile(tile.id);
            if (!resolved) continue;
            if (targetTiles.some(t => t?.id === resolved.id)) continue;

            targetTiles.push(resolved);
        }
    }

    /**
     * When applying a gallery tilemap as a template, ensure the resulting tilemap references tiles in *this* project.
     */
    protected mergeTilemapTilesIntoProject(project: pxt.TilemapProject, tilemap: pxt.ProjectTilemap) {
        const tiles = tilemap?.data?.tileset?.tiles;
        if (!tiles?.length) return;

        const getSourceTileName = (t: pxt.Tile) => {
            const name = t?.meta?.displayName || pxt.getShortIDForAsset(t) || t?.id;
            return name ? name.split(".").pop() : undefined;
        }

        const remappedByBitmap: pxt.Map<pxt.Tile> = {};

        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            if (!tile) continue;

            const key = (tile as any).jresData || (tile.bitmap ? pxt.sprite.base64EncodeBitmap(tile.bitmap) : "");
            if (key && remappedByBitmap[key]) {
                tiles[i] = remappedByBitmap[key];
                continue;
            }

            const existing = tile.bitmap && project.lookupAssetByValue(pxt.AssetType.Tile, tile);
            if (existing) {
                tiles[i] = existing;
                if (key) remappedByBitmap[key] = existing;

                if (!existing.meta?.displayName) {
                    const originalName = getSourceTileName(tile);
                    if (originalName) {
                        const uniqueDisplayName = project.generateNewName(pxt.AssetType.Tile, originalName);
                        project.updateTile({
                            ...existing,
                            meta: {
                                ...existing.meta,
                                displayName: uniqueDisplayName
                            }
                        });
                    }
                }
                continue;
            }

            if (tile.bitmap) {
                const originalName = getSourceTileName(tile);
                const newName = originalName ? project.generateNewName(pxt.AssetType.Tile, originalName) : undefined;

                const created = project.createNewTile(tile.bitmap, undefined, newName);
                tiles[i] = created;
                if (key) remappedByBitmap[key] = created;
            }
        }
    }

    onResize() {
        this.dispatchOnStore(dispatchChangeZoom(0));
    }

    getCurrentFrame(): pxt.sprite.Bitmap {
        const state = this.getStore().getState();
        const animationState = state.store.present as AnimationState;
        const currentFrame = animationState.frames[animationState.currentFrame];

        return imageStateToBitmap(currentFrame);
    }

    getAsset(): pxt.Asset {
        const type = this.getStore().getState().store.present.asset.type;
        switch (type) {
            case pxt.AssetType.Tile:
                return this.getTile();
            case pxt.AssetType.Animation:
                return this.getAnimation();
            case pxt.AssetType.Tilemap:
                return this.getTilemap();
            default:
                return this.getImage();
        }
    }

    getImage(): pxt.ProjectImage {
        const state = this.getStore().getState().store.present;
        const data = this.getCurrentFrame().data();

        const meta: pxt.AssetMetadata = state.asset ? { ...state.asset.meta } : {};

        return {
            id: state.asset?.id,
            internalID: state.asset ? state.asset.internalID : getNewInternalID(),
            type: pxt.AssetType.Image,
            bitmap: data,
            jresData: pxt.sprite.base64EncodeBitmap(data),
            meta
        }
    }

    getTile(): pxt.Tile {
        const state = this.getStore().getState().store.present;
        const data = this.getCurrentFrame().data();

        const meta: pxt.AssetMetadata = state.asset ? { ...state.asset.meta } : {};

        return {
            id: state.asset?.id,
            internalID: state.asset ? state.asset.internalID : getNewInternalID(),
            isProjectTile: true,
            type: pxt.AssetType.Tile,
            bitmap: data,
            jresData: pxt.sprite.base64EncodeBitmap(data),
            meta
        }
    }

    getAnimation(): pxt.Animation {
        const state = this.getStore().getState();
        const animationState = state.store.present as AnimationState;

        const meta: pxt.AssetMetadata = animationState.asset ? { ...animationState.asset.meta } : {};

        return {
            id: animationState.asset?.id,
            internalID: animationState.asset ? animationState.asset.internalID : getNewInternalID(),
            type: pxt.AssetType.Animation,
            interval: animationState.interval,
            frames: animationState.frames.map(frame => imageStateToBitmap(frame).data()),
            meta
        }
    }

    getTilemap(): pxt.ProjectTilemap {
        const state = this.getStore().getState();
        const tilemapState = state.store.present as TilemapState;
        const { floating, overlayLayers, layerOffsetX, layerOffsetY } = tilemapState.tilemap;
        const layers = applyBitmapData(pxt.sprite.Bitmap.fromData(overlayLayers[0]).copy().data(), floating && floating.overlayLayers && floating.overlayLayers[0], layerOffsetX, layerOffsetY);

        const out = new pxt.sprite.TilemapData(imageStateToTilemap(tilemapState.tilemap), tilemapState.tileset, layers);
        out.deletedTiles = state.editor.deletedTiles;
        out.editedTiles = state.editor.editedTiles;

        const meta: pxt.AssetMetadata = tilemapState.asset ? { ...tilemapState.asset.meta } : {};

        return {
            id: tilemapState.asset?.id,
            internalID: tilemapState.asset ? tilemapState.asset.internalID : getNewInternalID(),
            type: pxt.AssetType.Tilemap,
            data: out,
            meta
        }
    }

    getPersistentData(): ImageEditorSaveState {
        const state = this.getStore().getState();
        return {
            editor: state.editor,
            past: state.store.past as AnimationState[]
        }
    }

    restorePersistentData(oldValue: ImageEditorSaveState) {
        if (oldValue) {
            this.dispatchOnStore(dispatchSetInitialState(oldValue.editor, oldValue.past));
        }
    }

    setCurrentFrame(bitmap: pxt.sprite.Bitmap, shrinkIfNecessary: boolean) {
        if (!shrinkIfNecessary) {
            const state = this.getStore().getState();
            const current = (state.store.present as AnimationState).frames[0];

            if (bitmap.width !== current.bitmap.width || bitmap.height !== current.bitmap.height) {
                const dimensions: [number, number] = [
                    Math.max(bitmap.width, current.bitmap.width), Math.max(bitmap.height, current.bitmap.height)
                ];

                if (current.bitmap.width !== dimensions[0] || current.bitmap.height !== dimensions[1]) {
                    this.dispatchOnStore(dispatchChangeImageDimensions(dimensions));
                }

                bitmap = bitmap.copy();
                bitmap = bitmap.resize(dimensions[0], dimensions[1]);
            }
        }

        this.dispatchOnStore(dispatchImageEdit({ bitmap: bitmap.data() }));
    }

    openInTileEditor(bitmap: pxt.sprite.Bitmap) {
        (this.refs["nested-image-editor"] as ImageEditor).setCurrentFrame(bitmap, false);
    }

    disableResize() {
        this.dispatchOnStore(dispatchDisableResize());
    }

    closeNestedEditor() {
        if (this.state.editingTile) {
            (this.refs["nested-image-editor"] as ImageEditor)?.onDoneClick();
        }
    }

    getJres() {
        if (this.props.singleFrame) {
            const bitmapData = this.getCurrentFrame().data();
            return pxt.sprite.base64EncodeBitmap(bitmapData);
        }
        return "";
    }

    loadJres(value: string): void {
        if (value) {
            try {
                this.setCurrentFrame(pxt.sprite.getBitmapFromJResURL(value), true);
            } catch (e) {
            }
        }
    }

    protected getStore() {
        return this.props.store || mainStore;
    }

    protected onStoreChange = () => {
        if (this.props.onChange) {
            this.props.onChange(this.props.singleFrame ? pxt.sprite.bitmapToImageLiteral(this.getCurrentFrame(), "typescript") : "")
        }

        const store = this.getStore();
        const state = store.getState();
        setStore(store);

        if (state.editor) this.setState({ alert: state.editor.alert });

        if (!!state.editor.editingTile != !!this.state.editingTile) {
            if (state.editor.editingTile) {
                const index = state.editor.editingTile.tilesetIndex;
                if (index) {
                    const tile = (state.store.present as TilemapState).tileset.tiles[index];
                    this.setState({
                        editingTile: true,
                        tileToEdit: tile
                    });
                }
                else {
                    const tileWidth = (state.store.present as TilemapState).tileset.tileWidth;
                    const emptyTile = createNewImageAsset(pxt.AssetType.Tile, tileWidth, tileWidth, lf("myTile")) as pxt.Tile;
                    this.setState({
                        editingTile: true,
                        tileToEdit: emptyTile
                    });
                }
                if (this.props.onTileEditorOpenClose) this.props.onTileEditorOpenClose(true);
            }
            else {
                this.setState({
                    editingTile: false
                });
                if (this.props.onTileEditorOpenClose) this.props.onTileEditorOpenClose(false);
            }
        }
    }

    protected onDoneClick = () => {
        if (this.props.onDoneClicked) {
            this.props.onDoneClicked(this.getAsset());
        }
    }

    protected onTileEditorFinished = (tile: pxt.Tile) => {
        const store = this.getStore();
        const tileEditState = store.getState().editor.editingTile;
        tile.isProjectTile = true;

        this.dispatchOnStore(dispatchCloseTileEditor(tile, tileEditState.tilesetIndex))
    }

    protected dispatchOnStore(action: Action) {
        this.getStore().dispatch(action);
    }
}