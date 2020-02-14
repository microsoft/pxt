import * as core from "./core";

export function init(updated: () => void) {
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
            navigator.serviceWorker.register(pxt.webConfig.serviceworkerjs).then(function (registration) {
                // Registration was successful
                console.log("ServiceWorker registration successful with scope: ", registration.scope);
            }, function (err) {
                // registration failed :(
                console.log("ServiceWorker registration failed: ", err);
            });
        });
    }

    const appCache = window.applicationCache;
    if (!appCache) return;

    function scheduleUpdate() {
        console.log(`app cache update ready (${appCache.status})`)
        if (appCache.status !== window.applicationCache.UPDATEREADY)
            return;
        core.infoNotification(lf("Update download complete. Reloading... "));
        setTimeout(() => {
            pxt.tickEvent('appcache.updated')
            updated();
        }, 3000);
    }

    // disable in options
    if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.noReloadOnUpdate)
        return;

    // already dowloaded
    if (appCache.status === window.applicationCache.UPDATEREADY) {
        scheduleUpdate();
    }
    else {
        // waiting for event
        appCache.addEventListener('updateready', () => {
            scheduleUpdate();
        }, false);
    }
}
