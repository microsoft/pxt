import * as core from "./core";

export function init(updated: () => void) {
    const appCache = window.applicationCache;
    if (!(pxt.appTarget.appTheme && pxt.appTarget.appTheme.noReloadOnUpdate)) {
        appCache.addEventListener('updateready', () => {
            core.infoNotification(lf("Update download complete. Reloading... "));
            setTimeout(() => {
                pxt.tickEvent('appcache.updated')
                updated();
            }, 3000);
        }, false);
    }
}
