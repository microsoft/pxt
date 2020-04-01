import * as React from 'react';

import { Provider, Store } from 'react-redux';
import { mainStore, tileEditorStore } from './store/imageStore'
import { SideBar } from './SideBar';
import { BottomBar } from './BottomBar';
import { TopBar } from './TopBar';
import { ImageCanvas } from './ImageCanvas';
import { Alert, AlertInfo } from './Alert';

import { Timeline } from './Timeline';
import { addKeyListener, removeKeyListener } from './keyboardShortcuts';

import { dispatchSetInitialState, dispatchImageEdit, dispatchChangeZoom, dispatchSetInitialFrames, dispatchSetInitialTilemap, dispatchCloseTileEditor, dispatchDisableResize } from './actions/dispatch';
import { EditorState, AnimationState, TilemapState, GalleryTile, ImageEditorStore } from './store/imageReducer';
import { imageStateToBitmap, imageStateToTilemap, applyBitmapData } from './util';
import { Unsubscribe, Action } from 'redux';

export interface ImageEditorSaveState {
    editor: EditorState;
    past: AnimationState[];
}

export interface ImageEditorProps {
    singleFrame?: boolean;
    onChange?: (value: string) => void;
    initialValue?: string;
    resizeDisabled?: boolean;
    store?: Store<ImageEditorStore>;
    onDoneClicked?: (value: string) => void;
}

export interface ImageEditorState {
    editingTile: boolean;
    editTileValue?: string;
    alert?: AlertInfo;
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

        if (this.props.resizeDisabled) {
            this.disableResize();
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
        const instanceStore = this.getStore();

        const { editTileValue, editingTile, alert } = this.state;

        const isAnimationEditor = instanceStore.getState().store.present.kind === "Animation"

        return <div className="image-editor-outer">
            <Provider store={instanceStore}>
                <div className={`image-editor ${editingTile ? "editing-tile" : ""}`}>
                    <TopBar singleFrame={singleFrame} />
                    <div className="image-editor-content">
                        <SideBar />
                        <ImageCanvas />
                        {isAnimationEditor && !singleFrame ? <Timeline /> : undefined}
                    </div>
                    <BottomBar singleFrame={singleFrame} onDoneClick={this.onDoneClick} />
                    {alert && alert.title && <Alert title={alert.title} text={alert.text} options={alert.options} />}
                </div>
            </Provider>
            {editingTile && <ImageEditor store={tileEditorStore} onDoneClicked={this.onTileEditorFinished} initialValue={editTileValue} singleFrame={true} resizeDisabled={true} />}
        </div>
    }

    initSingleFrame(value: pxt.sprite.Bitmap) {
        this.dispatchOnStore(dispatchSetInitialFrames([{ bitmap: value.data() }], 100))
    }

    initAnimation(frames: pxt.sprite.Bitmap[], interval: number) {
        this.dispatchOnStore(dispatchSetInitialFrames(frames.map(frame => ({ bitmap: frame.data() })), interval));
    }

    initTilemap(data: pxt.sprite.TilemapData, gallery: GalleryTile[]) {
        this.dispatchOnStore(dispatchSetInitialTilemap(data.tilemap.data(), data.tileset, gallery, [data.layers], data.nextId, data.projectReferences));
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

    getAnimation(): pxt.sprite.AnimationData {
        const state = this.getStore().getState();
        const animationState = state.store.present as AnimationState;
        return {
            interval: animationState.interval,
            frames: animationState.frames.map(frame => imageStateToBitmap(frame).data())
        }
    }

    getTilemap() {
        const state = this.getStore().getState();
        const tilemapState = state.store.present as TilemapState;
        const { floating, overlayLayers, layerOffsetX, layerOffsetY } = tilemapState.tilemap;
        const layers = applyBitmapData(overlayLayers[0], floating && floating.overlayLayers && floating.overlayLayers[0], layerOffsetX, layerOffsetY);
        return new pxt.sprite.TilemapData(imageStateToTilemap(tilemapState.tilemap), tilemapState.tileset, layers);
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

    setCurrentFrame(bitmap: pxt.sprite.Bitmap) {
        this.dispatchOnStore(dispatchImageEdit({ bitmap: bitmap.data() }))
    }

    disableResize() {
        this.dispatchOnStore(dispatchDisableResize());
    }

    protected getStore() {
        return this.props.store || mainStore;
    }

    protected onStoreChange = () => {
        if (this.props.onChange) {
            this.props.onChange(this.props.singleFrame ? pxt.sprite.bitmapToImageLiteral(this.getCurrentFrame(), "typescript") : "")
        }

        const state = this.getStore().getState();

        if (state.editor) this.setState({ alert: state.editor.alert });

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
                    const tileWidth = (state.store.present as TilemapState).tileset.tileWidth;
                    this.setState({
                        editingTile: true,
                        editTileValue: pxt.sprite.bitmapToImageLiteral(new pxt.sprite.Bitmap(tileWidth, tileWidth), "typescript")
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
                value = pxt.sprite.encodeTilemap(this.getTilemap(), "typescript");
            }
            else if (this.props.singleFrame) {
                value = pxt.sprite.bitmapToImageLiteral(this.getCurrentFrame(), "typescript");
            }
            else {
                value = this.getAnimation() + "";
            }

            this.props.onDoneClicked(value);
        }
    }

    protected onTileEditorFinished = (tile: string) => {
        const parsed = pxt.sprite.imageLiteralToBitmap(tile);
        const store = this.getStore();
        const tileEditState = store.getState().editor.editingTile;

        this.dispatchOnStore(dispatchCloseTileEditor(parsed.data(), tileEditState.tilesetIndex))
    }

    protected dispatchOnStore(action: Action) {
        this.getStore().dispatch(action);
    }
}