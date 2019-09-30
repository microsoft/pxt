import * as React from 'react';

import { Provider } from 'react-redux';
import store from './store/imageStore'
import { SideBar } from './SideBar';
import { BottomBar } from './BottomBar';
import { TopBar } from './TopBar';
import { ImageCanvas } from './ImageCanvas';

import { Timeline } from './Timeline';
import { addKeyListener, removeKeyListener } from './keyboardShortcuts';

import { dispatchSetInitialImage, dispatchSetInitialState, dispatchImageEdit, dispatchChangeZoom } from './actions/dispatch';
import { Bitmap, bitmapToImageLiteral } from './store/bitmap';

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

    initSingleFrame(value: Bitmap, close: () => void, options?: any) {
        store.dispatch(dispatchSetInitialImage({ bitmap: value.data() }));
    }

    onResize() {
        store.dispatch(dispatchChangeZoom(0));
    }

    getValue() {
        const state = store.getState();
        const currentFrame = state.present.frames[state.present.currentFrame];

        return bitmapToImageLiteral(Bitmap.fromData(currentFrame.bitmap), "ts");
    }

    getPersistentData() {
        const state = store.getState();
        return state;
    }

    restorePersistentData(oldValue: any) {
        if (oldValue) {
            store.dispatch(dispatchSetInitialState(oldValue));
        }
    }

    setCurrentFrame(bitmap: Bitmap) {
        store.dispatch(dispatchImageEdit({ bitmap: bitmap.data() }))
    }
}