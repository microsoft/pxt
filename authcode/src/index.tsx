/// <reference path="../../built/pxtlib.d.ts" />

import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
// eslint-disable-next-line import/no-unassigned-import
import "./index.css";
import store from "./state/store";
import App from "./App";
import * as auth from "./services/auth";
import { isLocal } from "./util/browserUtils";

const bundle = (window as any).pxtTargetBundle as pxt.TargetBundle;
bundle.bundledpkgs = {};

pxt.setAppTarget(bundle);
pxt.Cloud.apiRoot = "https://www.makecode.com/api/";
if (!isLocal()) pxt.setupWebConfig((window as any).pxtConfig);

ReactDOM.render(
    <React.StrictMode>
        <Provider store={store}>
            <App />
        </Provider>
    </React.StrictMode>,
    document.getElementById("root")
);

document.addEventListener("DOMContentLoaded", async () => {
    await auth.authCheckAsync();
});
