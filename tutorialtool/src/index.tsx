// TODO: pxtcompiler type is only needed for a few compiler service types,
// we should get rid of this somehow.
/// <reference path="../../built/pxtsim.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import React from "react";
import ReactDOM from "react-dom";
import "./global.scss";
import { App } from "./App";
import { AppStateProvider } from "./state/appStateContext";
import { Ticks } from "./constants";

function enableAnalytics() {
    pxt.analytics.enable(pxt.Util.userLanguage());

    const stats: pxt.Map<string | number> = {};
    if (typeof window !== "undefined") {
        const screen = window.screen;
        stats["screen.width"] = screen.width;
        stats["screen.height"] = screen.height;
        stats["screen.availwidth"] = screen.availWidth;
        stats["screen.availheight"] = screen.availHeight;
        stats["screen.innerWidth"] = window.innerWidth;
        stats["screen.innerHeight"] = window.innerHeight;
        stats["screen.devicepixelratio"] = pxt.BrowserUtils.devicePixelRatio();
        const body = document.firstElementChild; // body
        if (body) {
            stats["screen.clientWidth"] = body.clientWidth;
            stats["screen.clientHeight"] = body.clientHeight;
        }
    }
    pxt.tickEvent(Ticks.Loaded, stats);
}

window.addEventListener("DOMContentLoaded", () => {
    const bundle = (window as any).pxtTargetBundle as pxt.TargetBundle;

    pxt.options.debug = /dbg=1/i.test(window.location.href);
    if (pxt.options.debug) {
        pxt.setLogLevel(pxt.LogLevel.Debug);
    }

    pxt.setupWebConfig((window as any).pxtConfig || pxt.webConfig);
    pxt.setAppTarget(bundle);

    pxt.Cloud.apiRoot = "https://www.makecode.com/api/";

    enableAnalytics();

    ReactDOM.render(
        <React.StrictMode>
            <AppStateProvider>
                <App />
            </AppStateProvider>
        </React.StrictMode>,
        document.getElementById("root")
    );
});
