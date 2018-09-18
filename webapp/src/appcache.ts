import * as core from "./core";

export function init(hash: { cmd: string, arg: string }) {
    let appCache = window.applicationCache;
    if (!appCache) return; // might eventually go away

    appCache.addEventListener('updateready', () => {
        if (appCache.status != appCache.UPDATEREADY)
            return; // FF incorrectly fires this event
        core.infoNotification(lf("Update download complete. Reloading... "));
        setTimeout(() => {
            pxt.tickEvent('appcache.updated')
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
