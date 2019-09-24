import * as React from 'react';

import { Provider } from 'react-redux';
import store from './store/imageStore'
import { SideBar } from './SideBar';
import { BottomBar } from './BottomBar';
import { TopBar } from './TopBar';
import { ImageCanvas } from './ImageCanvas';

import { Timeline } from './Timeline';
import { addKeyListener, removeKeyListener } from './keyboardShortcuts';
import { FieldEditorComponent } from '../../blocklyFieldView';

import { dispatchSetInitialImage, dispatchSetInitialState } from './actions/dispatch';
import { Bitmap, imageLiteralToBitmap, bitmapToImageLiteral } from './store/bitmap';

export class ImageEditor extends React.Component<{},{}> implements FieldEditorComponent {
    componentDidMount() {
        addKeyListener();
    }

    componentWillUnmount() {
        removeKeyListener();
    }

    render() {
        return <Provider store={store}>
            <div className="image-editor">
                <TopBar />
                <div className="image-editor-content">
                    <SideBar />
                    <ImageCanvas />
                    <Timeline />
                </div>
                <BottomBar />
            </div>
        </Provider>
    }

    init(value: string, options?: any) {
        const bitmap = imageLiteralToBitmap(value);
        store.dispatch(dispatchSetInitialImage({ bitmap: bitmap.data() }));
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
}