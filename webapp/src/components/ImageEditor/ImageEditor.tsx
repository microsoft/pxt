import * as React from 'react';

import { Provider, Store } from 'react-redux';
import { mainStore, tileEditorStore } from './store/imageStore'
import { SideBar } from './SideBar';
import { BottomBar } from './BottomBar';
import { TopBar } from './TopBar';
import { ImageCanvas } from './ImageCanvas';

import { Timeline } from './Timeline';
import { addKeyListener, removeKeyListener } from './keyboardShortcuts';

import { dispatchSetInitialState, dispatchImageEdit, dispatchChangeZoom, dispatchSetInitialFrames, dispatchSetInitialTilemap } from './actions/dispatch';
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
}

export interface ImageEditorState {
    editingTile: boolean;
}

export class ImageEditor extends React.Component<ImageEditorProps, ImageEditorState> {
    protected unsubscribeChangeListener: Unsubscribe;

    constructor(props: ImageEditorProps) {
        super(props);

        this.state = { editingTile: false};
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
            { this.state.editingTile && <ImageEditor store={tileEditorStore} /> }
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
        return pxt.sprite.encodeTilemap(new pxt.sprite.TilemapData(imageStateToTilemap(tilemapState.tilemap), tilemapState.tileset, tilemapState.tilemap.overlayLayers[0]), "typescript");
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

        if (!!(this.getStore().getState().editingTile) != this.state.editingTile) {
            this.setState({ editingTile: !this.state.editingTile });
        }
    }
}