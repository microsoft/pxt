import * as core from "./core";

export function init() {
    let appCache = window.applicationCache;
    appCache.addEventListener('updateready', () => {
        core.infoNotification(lf("Update download complete. Reloading..."));
        setTimeout(() => location.reload(), 3000);
    }, false);
}
