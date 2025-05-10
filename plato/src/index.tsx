// TODO: pxtcompiler type is only needed for a few compiler service types,
// we should get rid of this somehow.
/// <reference path="../../built/pxtcompiler.d.ts" />
/// <reference path="../../built/pxtsim.d.ts" />
/// <reference path="../../built/pxtlib.d.ts" />

import React from "react";
import ReactDOM from "react-dom";
import { App } from "@/components/App";
import { AppStateProvider } from "@/state/Context";
import { Ticks } from "@/constants";
import "./global.scss";

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
    const optsQuery = pxt.Util.parseQueryString(window.location.href.toLowerCase());

    pxt.options.debug = optsQuery["dbg"] == "1";
    if (pxt.options.debug) {
        pxt.setLogLevel(pxt.LogLevel.Debug);
    }

    if (optsQuery["consoleticks"] == "1" || optsQuery["consoleticks"] == "verbose") {
        pxt.analytics.consoleTicks = pxt.analytics.ConsoleTickOptions.Verbose;
    } else if (optsQuery["consoleticks"] == "2" || optsQuery["consoleticks"] == "short") {
        pxt.analytics.consoleTicks = pxt.analytics.ConsoleTickOptions.Short;
    }

    pxt.setupWebConfig((window as any).pxtConfig || pxt.webConfig);
    pxt.setAppTarget(bundle);

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
