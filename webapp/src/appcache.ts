/// <reference path="../../built/pxtlib.d.ts"/>
import * as core from "./core";

import Cloud = pxt.Cloud;

export function initAppCache(hash: { cmd: string, arg: string }) {
    let appCache = window.applicationCache;
    appCache.addEventListener('updateready', () => {
        core.infoNotification(lf("Update download complete. Reloading... "));
        setTimeout(() => {
            // On embedded pages, preserve the loaded project
            if (pxt.BrowserUtils.isIFrame() && hash.cmd === "pub") {
                location.replace(location.origin + `/#pub:${hash.arg}`)
            }
            else {
                location.reload()
            }
        }, 5000);
    }, false);
}


export function initWebWorker() {
    if (Cloud.isLocalHost()) return;
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            const cdn = pxt.webConfig.commitCdnUrl;
            (navigator as any).serviceWorker.register(`--serviceworker`).then((registration: any) => {
                // Registration was successful
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                // Abort app cache if service worker is loaded
                window.applicationCache.abort();
            }, (err: any) => {
                // registration failed :(
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }
}