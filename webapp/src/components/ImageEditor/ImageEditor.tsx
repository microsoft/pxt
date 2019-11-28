import * as React from 'react';

import { Provider } from 'react-redux';
import store from './store/imageStore'
import { SideBar } from './SideBar';
import { BottomBar } from './BottomBar';
import { TopBar } from './TopBar';
import { ImageCanvas } from './ImageCanvas';

import { Timeline } from './Timeline';
import { addKeyListener, removeKeyListener } from './keyboardShortcuts';

import { dispatchSetInitialState, dispatchImageEdit, dispatchChangeZoom, dispatchSetInitialFrames } from './actions/dispatch';
import { EditorState, AnimationState } from './store/imageReducer';
import { imageStateToBitmap } from './util';
import { Unsubscribe } from 'redux';

export interface ImageEditorSaveState {
    editor: EditorState;
    past: AnimationState[];
}

export interface ImageEditorProps {
    singleFrame?: boolean;
    onChange?: (value: string) => void;
    initialValue?: string;
}

export class ImageEditor extends React.Component<ImageEditorProps,{}> {
    protected unsubscribeChangeListener: Unsubscribe;

    componentDidMount() {
        addKeyListener();

        if (this.props.initialValue) {
            this.initSingleFrame(pxt.sprite.imageLiteralToBitmap(this.props.initialValue));
        }

        this.onResize();
    }

    componentWillUnmount() {
        removeKeyListener();

        if (this.unsubscribeChangeListener) {
            this.unsubscribeChangeListener()
        }
    }

    componentDidUpdate() {
        if (this.unsubscribeChangeListener) {
            this.unsubscribeChangeListener()
        }

        if (this.props.onChange) {
            this.unsubscribeChangeListener = store.subscribe(this.onStoreChange);
        }
    }

    render() {
        const { singleFrame } = this.props;

        return <Provider store={store}>
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
    }

    initSingleFrame(value: pxt.sprite.Bitmap) {
        store.dispatch(dispatchSetInitialFrames([{ bitmap: value.data() }], 100));
    }

    initAnimation(frames: pxt.sprite.Bitmap[], interval: number) {
        store.dispatch(dispatchSetInitialFrames(frames.map(frame => ({ bitmap: frame.data() })), interval));
    }

    onResize() {
        store.dispatch(dispatchChangeZoom(0));
    }

    getCurrentFrame() {
        const state = store.getState();
        const currentFrame = state.present.frames[state.present.currentFrame];

        return pxt.sprite.bitmapToImageLiteral(imageStateToBitmap(currentFrame), "typescript");
    }

    getAllFrames() {
        const state = store.getState();
        return "[" + state.present.frames.map(frame => pxt.sprite.bitmapToImageLiteral(imageStateToBitmap(frame), "typescript")).join(",") + "]";
    }

    getInterval() {
        return store.getState().present.interval;
    }

    getPersistentData(): ImageEditorSaveState {
        const state = store.getState();
        return {
            editor: state.editor,
            past: state.past
        }
    }

    restorePersistentData(oldValue: ImageEditorSaveState) {
        if (oldValue) {
            store.dispatch(dispatchSetInitialState(oldValue.editor, oldValue.past));
        }
    }

    setCurrentFrame(bitmap: pxt.sprite.Bitmap) {
        store.dispatch(dispatchImageEdit({ bitmap: bitmap.data() }))
    }

    protected onStoreChange = () => {
        if (this.props.onChange) {
            this.props.onChange(this.props.singleFrame ? this.getCurrentFrame() : this.getAllFrames())
        }
    }
}