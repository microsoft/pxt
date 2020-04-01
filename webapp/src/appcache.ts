import * as core from "./core";

export function init(updated: () => void) {
    if ("serviceWorker" in navigator
        && !pxt.webConfig.isStatic
        && !pxt.BrowserUtils.isLocalHost(true)) {
        window.addEventListener("load", function () {
            const ref = pxt.webConfig.relprefix.replace("---", "").replace(/^\//, "");

            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.addEventListener("message", ev => {
                    const message = ev.data as pxt.ServiceWorkerEvent;

                    // We need to check the ref of the activated service worker so that we don't reload if you have
                    // index.html and beta open at the same time. Otherwise we'd end up in an infinite reload loop as
                    // both tabs continually overwrite the service worker and refresh
                    if (message && message.type === "serviceworker" && message.state === "activated" && message.ref === ref) {
                        scheduleUpdate();
                    }
                });
            }


            navigator.serviceWorker.register(pxt.webConfig.serviceworkerjs).then(function (registration) {
                // Registration was successful
                pxt.debug("ServiceWorker registration successful with scope: " + registration.scope);
            }, function (err) {
                // registration failed :(
                pxt.debug("ServiceWorker registration failed: " + err);
            });
        });
    }

    function scheduleUpdate() {
        if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.noReloadOnUpdate)
            return;
        core.infoNotification(lf("Update download complete. Reloading... "));
        setTimeout(() => {
            pxt.tickEvent('appcache.updated')
            updated();
        }, 3000);
    }
}
