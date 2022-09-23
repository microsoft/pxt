/// <reference path="../../built/pxtlib.d.ts" />

import React from "react";
import ReactDOM from "react-dom";
// eslint-disable-next-line import/no-unassigned-import
import "./index.css";
import App from "./App";
import { AppStateProvider } from './state/Context';
import { isLocal } from "./util/browserUtils";
import * as authClient from "./services/authClient";

const bundle = (window as any).pxtTargetBundle as pxt.TargetBundle;
bundle.bundledpkgs = {};

pxt.setAppTarget(bundle);
pxt.Cloud.apiRoot = "https://www.makecode.com/api/";
if (!isLocal()) pxt.setupWebConfig((window as any).pxtConfig);

ReactDOM.render(
    <React.StrictMode>
        <AppStateProvider>
            <App />
        </AppStateProvider>
    </React.StrictMode>,
    document.getElementById("root")
);

document.addEventListener("DOMContentLoaded", async () => {
    await authClient.authCheckAsync();
});
