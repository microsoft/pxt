import * as core from "./core";

export function init() {
    let appCache = window.applicationCache;
    // An update was found. The browser is fetching resources.
    appCache.addEventListener('process', (e) => {
        let  p : { 
            lengthComputable: boolean;
            loaded: number; 
            total: number; 
        } = e as any;
        if (!p.lengthComputable) core.infoNotification(lf("Downloading update..."));
        else core.infoNotification(lf("Downloading update ({0}%)...", Math.round(p.loaded / p.total * 100)));
    }, false);
    
    appCache.addEventListener('updateready', () => {
        core.infoNotification("Update download complete. Updating...");
        setTimeout(() => location.reload(), 3000);
    }, false);
}
