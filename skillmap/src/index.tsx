import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import store from './store/store';
import App from './App';
import { isLocal } from './lib/browserUtils';

const bundle = (window as any).pxtTargetBundle as pxt.TargetBundle;
bundle.bundledpkgs = {}

pxt.setAppTarget(bundle);
pxt.Cloud.apiRoot = "https://www.makecode.com/api/";
if (!isLocal()) pxt.setupWebConfig((window as any).pxtConfig);

ReactDOM.render(
    <Provider store={store}>
        <App />
    </Provider>,

    document.getElementById('root')
);