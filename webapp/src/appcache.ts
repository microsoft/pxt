import * as core from "./core";

export function init(updated: () => void) {
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
        appCache.addEventListener('error', function (e) {
            // It's difficult to tell cause of this error 
            // since there's no information associated with the callback argument
            ts.pxtc.Util.clearTranslationDbAsync();
        });
    }
}
