// TODO: pxtcompiler type is only needed for a few compiler service types,
// we should get rid of this somehow.
/// <reference path="../../built/pxtcompiler.d.ts" />
/// <reference path="../../built/pxtsim.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import React from "react";
import ReactDOM from "react-dom";
// eslint-disable-next-line import/no-unassigned-import
import "./index.css";
import App from "./App";
import { AppStateProvider } from "./state/AppStateContext";
import { dispatch } from "./state";
import { setTargetConfig } from "./state/actions";

window.addEventListener("DOMContentLoaded", () => {
    const bundle = (window as any).pxtTargetBundle as pxt.TargetBundle;

    pxt.setAppTarget(bundle);
    pxt.setupWebConfig((window as any).pxtConfig || pxt.webConfig);
    // todo: handle this better?
    if (pxt.BrowserUtils.isLocalHostDev()) {
        // patch webconfig to refer to pxt serve instead of multiplayer serve
        const wc = pxt.webConfig as any;

        for (const key of Object.keys(wc)) {
            if (wc[key]?.startsWith("/") && wc[key]?.indexOf("worker") == -1) {
                wc[key] = `http://localhost:3232${wc[key]}`;
            }
        }
        pxt.webConfig.workerjs = `/blb${pxt.webConfig.workerjs}`;
    }
    pxt.Cloud.apiRoot = "https://www.makecode.com/api/";

    pxt.targetConfigAsync()
        .then(trgcfg => dispatch(setTargetConfig(trgcfg)));

    // prefetch worker on load
    pxt.worker.getWorker(pxt.webConfig.workerjs);

    ReactDOM.render(
        <React.StrictMode>
            <AppStateProvider>
                <App />
            </AppStateProvider>
        </React.StrictMode>,
        document.getElementById("root")
    );
});
