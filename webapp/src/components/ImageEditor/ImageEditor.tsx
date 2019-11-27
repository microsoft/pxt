import * as React from 'react';

import { Provider, Store } from 'react-redux';
import { mainStore, tileEditorStore } from './store/imageStore'
import { SideBar } from './SideBar';
import { BottomBar } from './BottomBar';
import { TopBar } from './TopBar';
import { ImageCanvas } from './ImageCanvas';

import { Timeline } from './Timeline';
import { addKeyListener, removeKeyListener } from './keyboardShortcuts';

import { dispatchSetInitialState, dispatchImageEdit, dispatchChangeZoom, dispatchSetInitialFrames, dispatchSetInitialTilemap, dispatchCloseTileEditor } from './actions/dispatch';
import { EditorState, AnimationState, TilemapState, GalleryTile, ImageEditorStore } from './store/imageReducer';
import { imageStateToBitmap, imageStateToTilemap } from './util';
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

    initTilemap(data: pxt.sprite.TilemapData, gallery: GalleryTile[]) {
        this.getStore().dispatch(dispatchSetInitialTilemap(data.tilemap.data(), data.tileset, gallery, [data.layers], data.nextId));
    }

    onResize() {
        this.getStore().dispatch(dispatchChangeZoom(0));
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
        return new pxt.sprite.TilemapData(imageStateToTilemap(tilemapState.tilemap), tilemapState.tileset, tilemapState.tilemap.overlayLayers[0]);
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
            this.props.onChange(this.props.singleFrame ? pxt.sprite.bitmapToImageLiteral(this.getCurrentFrame(), "typescript") : "")
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

        store.dispatch(dispatchCloseTileEditor(parsed.data(), tileEditState.tilesetIndex));
    }
}