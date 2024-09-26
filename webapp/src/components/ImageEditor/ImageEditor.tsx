import * as React from 'react';

import { SideBar } from './SideBar';
import { BottomBar } from './BottomBar';
import { TopBar } from './TopBar';
import { ImageCanvas } from './ImageCanvas';
import { Alert, AlertInfo } from './Alert';

import { Timeline } from './Timeline';
import { imageStateToBitmap, imageStateToTilemap, applyBitmapData } from './util';
import { createNewImageAsset, getNewInternalID } from '../../assets';
import { AssetEditorCore } from '../ImageFieldEditor';
import { classList } from '../../../../react-common/components/util';
import { Action, ImageEditorContext, ImageEditorStateProvider, TileEditorStateProvider, EditorState, AnimationState, TilemapState, GalleryTile, ImageEditorStore, setInitialState, changeImageDimensions, imageEdit, disableResize, closeTileEditor, changeCanvasZoom, openAsset, changeAssetName, setFrames } from './state';
import { useKeyboardShortcuts } from './keyboardShortcuts';

export const LIGHT_MODE_TRANSPARENT = "#dedede";

export interface ImageEditorSaveState {
    editor: EditorState;
    past: AnimationState[];
}

export interface ImageEditorProps {
    singleFrame?: boolean;
    onChange?: (value: string) => void;
    asset?: pxt.Asset;
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
    protected store: { state: ImageEditorStore, dispatch: (a: Action) => void };

    constructor(props: ImageEditorProps) {
        super(props);

        this.state = { editingTile: false };
    }

    componentDidMount() {
        if (this.props.asset) {
            this.openAsset(this.props.asset);
        }

        this.onResize();
    }

    render(): JSX.Element {
        const { singleFrame, lightMode, hideDoneButton, hideAssetName, nested } = this.props;

        const { tileToEdit, editingTile, alert } = this.state;

        return <div className="image-editor-outer">
            <Provider nested={nested}>
                <ImageEditorContext.Consumer>
                    {context => {
                        if (this.store && this.store.state !== context.state) {
                            this.store = context;
                            this.onStoreChange();
                        }
                        else {
                            this.store = context;
                        }

                        const isAnimationEditor = context.state.store.present.kind === "Animation";
                        return (
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
                        );
                    }}
                </ImageEditorContext.Consumer>
            </Provider>
            {editingTile &&
                <ImageEditor
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
        this.store.dispatch(openAsset(asset, keepPast, gallery));

        if (asset.meta.displayName) {
            this.store.dispatch(changeAssetName(asset.meta.displayName));
        }
        else if (keepPast) {
            this.store.dispatch(changeAssetName(""));
        }
    }

    openGalleryAsset(asset: pxt.Animation | pxt.ProjectImage | pxt.Tile) {
        const current = this.getAsset();

        const frames = (this.store.state.store.present as AnimationState).frames;

        switch (current.type) {
            case pxt.AssetType.Animation:
                switch (asset.type) {
                    case pxt.AssetType.Image:
                    case pxt.AssetType.Tile:
                        this.setCurrentFrame(pxt.sprite.Bitmap.fromData(asset.bitmap), frames.length === 1);
                        break;
                    case pxt.AssetType.Animation:
                        this.store.dispatch(setFrames(asset.frames.map(b => ({ bitmap: b }))));
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
        }
    }

    onResize() {
        this.store.dispatch(changeCanvasZoom(0));
    }

    getCurrentFrame(): pxt.sprite.Bitmap {
        const { state } = this.store;
        const animationState = state.store.present as AnimationState;
        const currentFrame = animationState.frames[animationState.currentFrame];

        return imageStateToBitmap(currentFrame);
    }

    getAsset(): pxt.Asset {
        const { state } = this.store;
        const asset = state.store.present.asset;

        if (!asset) {
            return undefined;
        }

        const type = asset.type;
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
        const { state } = this.store;
        const imageState = state.store.present;

        const data = this.getCurrentFrame().data();

        const meta: pxt.AssetMetadata = imageState.asset ? { ...imageState.asset.meta } : {};

        return {
            id: imageState.asset?.id,
            internalID: imageState.asset ? imageState.asset.internalID : getNewInternalID(),
            type: pxt.AssetType.Image,
            bitmap: data,
            jresData: pxt.sprite.base64EncodeBitmap(data),
            meta
        }
    }

    getTile(): pxt.Tile {
        const { state } = this.store;
        const tileState = state.store.present;
        const data = this.getCurrentFrame().data();

        const meta: pxt.AssetMetadata = tileState.asset ? { ...tileState.asset.meta } : {};

        return {
            id: tileState.asset?.id,
            internalID: tileState.asset ? tileState.asset.internalID : getNewInternalID(),
            isProjectTile: true,
            type: pxt.AssetType.Tile,
            bitmap: data,
            jresData: pxt.sprite.base64EncodeBitmap(data),
            meta
        }
    }

    getAnimation(): pxt.Animation {
        const { state } = this.store;
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
        const { state } = this.store;
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
        const { state } = this.store
        return {
            editor: state.editor,
            past: state.store.past as AnimationState[]
        }
    }

    restorePersistentData(oldValue: ImageEditorSaveState) {
        if (oldValue) {
            this.store.dispatch(setInitialState(oldValue.editor, oldValue.past));
        }
    }

    setCurrentFrame(bitmap: pxt.sprite.Bitmap, shrinkIfNecessary: boolean) {
        if (!shrinkIfNecessary) {
            const { state } = this.store;
            const current = (state.store.present as AnimationState).frames[0];

            if (bitmap.width !== current.bitmap.width || bitmap.height !== current.bitmap.height) {
                const dimensions: [number, number] = [
                    Math.max(bitmap.width, current.bitmap.width), Math.max(bitmap.height, current.bitmap.height)
                ];

                if (current.bitmap.width !== dimensions[0] || current.bitmap.height !== dimensions[1]) {
                    this.store.dispatch(changeImageDimensions(dimensions[0], dimensions[1]));
                }

                bitmap = bitmap.copy();
                bitmap = bitmap.resize(dimensions[0], dimensions[1]);
            }
        }

        this.store.dispatch(imageEdit({ bitmap: bitmap.data() }));
    }

    openInTileEditor(bitmap: pxt.sprite.Bitmap) {
        (this.refs["nested-image-editor"] as ImageEditor).setCurrentFrame(bitmap, false);
    }

    disableResize() {
        this.store.dispatch(disableResize());
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

    protected onStoreChange = () => {
        if (this.props.onChange) {
            this.props.onChange(this.props.singleFrame ? pxt.sprite.bitmapToImageLiteral(this.getCurrentFrame(), "typescript") : "")
        }

        const { state } = this.store;


        setTimeout(() => {
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
        })
    }

    protected onDoneClick = () => {
        if (this.props.onDoneClicked) {
            this.props.onDoneClicked(this.getAsset());
        }
    }

    protected onTileEditorFinished = (tile: pxt.Tile) => {
        const { state } = this.store;
        const tileEditState = state.editor.editingTile;
        tile.isProjectTile = true;

        this.store.dispatch(closeTileEditor(tile, tileEditState.tilesetIndex));
    }
}

const Provider = (props: React.PropsWithChildren<{ nested: boolean }>) => {
    const { nested, children } = props;

    if (nested) {
        return (
            <TileEditorStateProvider>
                {children};
            </TileEditorStateProvider>
        );
    }

    return (
        <ImageEditorStateProvider>
            <KeyboardShortcut>
                {children};
            </KeyboardShortcut>
        </ImageEditorStateProvider>
    );
}


const KeyboardShortcut = ({ children }: React.PropsWithChildren<{}>) => {
    useKeyboardShortcuts();
    return (
        <>
            {children}
        </>
    )
}