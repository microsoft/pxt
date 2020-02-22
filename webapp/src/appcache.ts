import * as core from "./core";

export function init(updated: () => void) {
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
            navigator.serviceWorker.register(pxt.webConfig.serviceworkerjs).then(function (registration) {
                // Registration was successful
                console.log("ServiceWorker registration successful with scope: ", registration.scope);
                registration.addEventListener("updatefound", scheduleUpdate);
            }, function (err) {
                // registration failed :(
                console.log("ServiceWorker registration failed: ", err);
            });
        });
    }

    function scheduleUpdate() {
        if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.noReloadOnUpdate)
            return;
        core.infoNotification(lf("Update download complete. Reloading... "));
        // setTimeout(() => {
        //     pxt.tickEvent('appcache.updated')
        //     updated();
        // }, 3000);
    }
}
