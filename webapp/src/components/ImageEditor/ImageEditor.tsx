import * as React from 'react';

import { Provider } from 'react-redux';
import store from './store/imageStore'
import { SideBar } from './SideBar';
import { BottomBar } from './BottomBar';
import { TopBar } from './TopBar';
import { ImageCanvas } from './ImageCanvas';

import { Timeline } from './Timeline';
import { addKeyListener, removeKeyListener } from './keyboardShortcuts';

export class ImageEditor extends React.Component<{},{}> {
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
}