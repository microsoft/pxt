import * as core from "./core";

export function init(hash: { cmd: string, arg: string }) {
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
