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
import { Bitmap, bitmapToImageLiteral } from './store/bitmap';
import { EditorState } from './store/imageReducer';

export interface ImageEditorProps {
    singleFrame?: boolean;
}

export class ImageEditor extends React.Component<ImageEditorProps,{}> {
    componentDidMount() {
        addKeyListener();
    }

    componentWillUnmount() {
        removeKeyListener();
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

    initSingleFrame(value: Bitmap) {
        store.dispatch(dispatchSetInitialFrames([{ bitmap: value.data() }], 100));
    }

    initAnimation(frames: Bitmap[], interval: number) {
        store.dispatch(dispatchSetInitialFrames(frames.map(frame => ({ bitmap: frame.data() })), interval));
    }

    onResize() {
        store.dispatch(dispatchChangeZoom(0));
    }

    getCurrentFrame() {
        const state = store.getState();
        const currentFrame = state.present.frames[state.present.currentFrame];

        return bitmapToImageLiteral(Bitmap.fromData(currentFrame.bitmap), "ts");
    }

    getAllFrames() {
        const state = store.getState();
        return "[" + state.present.frames.map(frame => bitmapToImageLiteral(Bitmap.fromData(frame.bitmap), "ts")).join(",") + "]";
    }

    getInterval() {
        return store.getState().present.interval;
    }

    getPersistentData(): EditorState {
        const state = store.getState();
        return state.editor;
    }

    restorePersistentData(oldValue: EditorState) {
        if (oldValue) {
            store.dispatch(dispatchSetInitialState(oldValue));
        }
    }

    setCurrentFrame(bitmap: Bitmap) {
        store.dispatch(dispatchImageEdit({ bitmap: bitmap.data() }))
    }
}