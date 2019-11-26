import * as React from 'react';

import { Provider, Store } from 'react-redux';
import { mainStore, tileEditorStore } from './store/imageStore'
import { SideBar } from './SideBar';
import { BottomBar } from './BottomBar';
import { TopBar } from './TopBar';
import { ImageCanvas } from './ImageCanvas';

import { Timeline } from './Timeline';
import { addKeyListener, removeKeyListener } from './keyboardShortcuts';

import { dispatchSetInitialState, dispatchImageEdit, dispatchChangeZoom, dispatchSetInitialFrames, dispatchSetInitialTilemap, dispatchCreateNewTile, dispatchOpenTileEditor, dispatchCloseTileEditor } from './actions/dispatch';
import { EditorState, AnimationState, TilemapState, GalleryTile, ImageEditorStore, TileEditContext } from './store/imageReducer';
import { imageStateToBitmap, imageStateToTilemap, applyBitmapData } from './util';
import { Unsubscribe } from 'redux';

export interface ImageEditorSaveState {
    editor: EditorState;
    past: AnimationState[];
}

export interface ImageEditorProps {
    singleFrame?: boolean;
    onChange?: (value: string) => void;
    initialValue?: string;
    store?: Store<ImageEditorStore>;
    onDoneClicked?: (value: string) => void;
}

export interface ImageEditorState {
    editingTile: boolean;
    editTileValue?: string;
}

export class ImageEditor extends React.Component<ImageEditorProps, ImageEditorState> {
    protected unsubscribeChangeListener: Unsubscribe;

    constructor(props: ImageEditorProps) {
        super(props);

        this.state = { editingTile: false };
    }

    componentDidMount() {
        addKeyListener();

        if (this.props.initialValue) {
            this.initSingleFrame(pxt.sprite.imageLiteralToBitmap(this.props.initialValue));
        }

        this.unsubscribeChangeListener = this.getStore().subscribe(this.onStoreChange);

        this.onResize();
    }

    componentWillUnmount() {
        removeKeyListener();

        if (this.unsubscribeChangeListener) {
            this.unsubscribeChangeListener()
        }
    }

    render(): JSX.Element {
        const { singleFrame } = this.props;
        const instanceStore = this.getStore()

        const { editTileValue, editingTile } = this.state;

        return <div className="image-editor-outer">
            <Provider store={instanceStore}>
                <div className="image-editor">
                    <TopBar singleFrame={singleFrame} />
                    <div className="image-editor-content">
                        <SideBar />
                        <ImageCanvas />
                        {singleFrame ? undefined : <Timeline />}
                    </div>
                    <BottomBar singleFrame={singleFrame} />
                </div>
            </Provider>
            { editingTile && <ImageEditor store={tileEditorStore} onDoneClicked={this.onTileEditorFinished} initialValue={editTileValue} singleFrame={true} /> }
            { !editingTile && this.props.onDoneClicked && <button
                className={`image-editor-confirm ui small button`}
                title={lf("Done")}
                onClick={this.onDoneClick}>
                    {lf("Done")}
                </button>
            }
        </div>
    }

    initSingleFrame(value: pxt.sprite.Bitmap) {
        this.getStore().dispatch(dispatchSetInitialFrames([{ bitmap: value.data() }], 100));
    }

    initAnimation(frames: pxt.sprite.Bitmap[], interval: number) {
        this.getStore().dispatch(dispatchSetInitialFrames(frames.map(frame => ({ bitmap: frame.data() })), interval));
    }

    initTilemap(tilemap: pxt.sprite.Tilemap, tileset: pxt.sprite.TileSet, gallery: GalleryTile[], layers?: pxt.sprite.BitmapData[]) {
        this.getStore().dispatch(dispatchSetInitialTilemap(tilemap.data(), tileset, gallery, layers));
    }

    onResize() {
        this.getStore().dispatch(dispatchChangeZoom(0));
    }

    getCurrentFrame() {
        const state = this.getStore().getState();
        const animationState = state.store.present as AnimationState;
        const currentFrame = animationState.frames[animationState.currentFrame];

        return pxt.sprite.bitmapToImageLiteral(imageStateToBitmap(currentFrame), "typescript");
    }

    getAllFrames() {
        const state = this.getStore().getState();
        const animationState = state.store.present as AnimationState;
        return "[" + animationState.frames.map(frame => pxt.sprite.bitmapToImageLiteral(imageStateToBitmap(frame), "typescript")).join(",") + "]";
    }

    getInterval() {
        const animationState = this.getStore().getState().store.present as AnimationState;
        return animationState.interval;
    }

    getTilemap() {
        const state = this.getStore().getState();
        const tilemapState = state.store.present as TilemapState;
        const { floating, overlayLayers, layerOffsetX, layerOffsetY } = tilemapState.tilemap;
        const layers = applyBitmapData(overlayLayers[0], floating && floating.overlayLayers && floating.overlayLayers[0], layerOffsetX, layerOffsetY);
        return pxt.sprite.encodeTilemap(new pxt.sprite.TilemapData(imageStateToTilemap(tilemapState.tilemap), tilemapState.tileset, layers), "typescript");
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
            this.getStore().dispatch(dispatchSetInitialState(oldValue.editor, oldValue.past));
        }
    }

    setCurrentFrame(bitmap: pxt.sprite.Bitmap) {
        this.getStore().dispatch(dispatchImageEdit({ bitmap: bitmap.data() }))
    }

    protected getStore() {
        return this.props.store || mainStore;
    }

    protected onStoreChange = () => {
        if (this.props.onChange) {
            this.props.onChange(this.props.singleFrame ? this.getCurrentFrame() : this.getAllFrames())
        }

        const state = this.getStore().getState()

        if (!!state.editor.editingTile != !!this.state.editingTile) {
            if (state.editor.editingTile) {
                const index = state.editor.editingTile.tilesetIndex;

                if (index) {
                    const tile = (state.store.present as TilemapState).tileset.tiles[index];
                    this.setState({
                        editingTile: true,
                        editTileValue: pxt.sprite.bitmapToImageLiteral(pxt.sprite.Bitmap.fromData(tile.data), "typescript")
                    });
                }
                else {
                    this.setState({
                        editingTile: true
                    });
                }
            }
            else {
                this.setState({
                    editingTile: false
                });
            }
        }
    }

    protected onDoneClick = () => {
        if (this.props.onDoneClicked) {
            let value: string;

            if (this.getStore().getState().editor.isTilemap) {
                value = this.getTilemap();
            }
            else if (this.props.singleFrame) {
                value = this.getCurrentFrame();
            }
            else {
                value = this.getAllFrames();
            }

            this.props.onDoneClicked(value);
        }
    }

    protected onTileEditorFinished = (tile: string) => {
        const parsed = pxt.sprite.imageLiteralToBitmap(tile);
        const store = this.getStore();
        const tileEditState = store.getState().editor.editingTile;

        store.dispatch(dispatchCloseTileEditor(parsed.data(), tileEditState.tilesetIndex));
    }
}