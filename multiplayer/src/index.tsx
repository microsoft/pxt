/// <reference path="../../built/pxtlib.d.ts" />

import React from "react";
import ReactDOM from "react-dom";
// eslint-disable-next-line import/no-unassigned-import
import "./index.css";
import App from "./App";
import { AppStateProvider } from "./state/AppStateContext";
import { isLocal } from "./util";
import * as authClient from "./services/authClient";

const bundle = (window as any).pxtTargetBundle as pxt.TargetBundle;
bundle.bundledpkgs = {};

pxt.setAppTarget(bundle);
pxt.setupWebConfig(pxt.webConfig);
// todo: handle this better?
if (pxt.BrowserUtils.isLocalHostDev()) {
    pxt.webConfig.runUrl = "http://localhost:3232/--run";
}
pxt.Cloud.apiRoot = "https://www.makecode.com/api/";

ReactDOM.render(
    <React.StrictMode>
        <AppStateProvider>
            <App />
        </AppStateProvider>
    </React.StrictMode>,
    document.getElementById("root")
);
