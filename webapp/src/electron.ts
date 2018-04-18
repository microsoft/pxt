import Cloud = pxt.Cloud;
import * as core from "./core";

const pxtElectron: pxt.electron.PxtElectron = (window as any).pxtElectron;
export const isPxtElectron = !!pxtElectron;
export const isIpcRenderer = !!(window as any).ipcRenderer;
export const isElectron = isPxtElectron || isIpcRenderer;

const downloadingUpdateLoadingName = "pxtelectron-downloadingupdate";

export function initPxtElectronAsync(): Promise<void> {
    if (!isPxtElectron) {
        return Promise.resolve();
    }

    pxtElectron.onTelemetry((ev: pxt.electron.TelemetryEvent) => {
        pxt.tickEvent(ev.event, ev.data);
    });
    pxtElectron.onUpdateInstalled(() => {
        core.infoNotification(Util.lf("An update will take effect after the app restarts"))
    });

    const criticalUpdateFailedPromise = new Promise((resolve) => {
        pxtElectron.onCriticalUpdateFailed(() => {
            resolve();
        });
    });

    // Block on update status check, which will let us know if the current version is banned
    return new Promise((resolve, reject) => {
        pxtElectron.onUpdateStatus((status) => {
            switch (status) {
                case pxt.electron.UpdateStatus.Ok:
                    // No update available; just resume
                    return resolve();
                case pxt.electron.UpdateStatus.UpdatingCritical:
                    // App is installing a critical update; show a dialog asking the user to wait
                    core.showLoading("pxt-electron-update", Util.lf("Installing update..."));
                    core.confirmAsync({
                        header: lf("Critical update required"),
                        body: lf("A critical update is installing. Please do not quit the app. It will automatically restart when the update has completed."),
                        hideAgree: true,
                        disagreeLbl: lf("Ok"),
                        disagreeClass: "green",
                        size: "medium"
                    });

                    criticalUpdateFailedPromise
                        .then(() => {
                            core.confirmAsync({
                                header: lf("Critical update failed"),
                                body: lf("There was an error installing the critical update. Please ensure you are connected to the Internet and try again later."),
                                hideAgree: true,
                                disagreeLbl: lf("Quit"),
                                disagreeClass: "red",
                                size: "medium"
                            }).then(b => {
                                pxtElectron.sendQuit();
                            });
                        });

                    // Do not resolve the promise; the app will restart after the update is ready
                    break;
                case pxt.electron.UpdateStatus.BannedWithoutUpdate:
                    // Current version is banned and there are no updates available; show a dialog explaining the
                    // situation and quit
                    core.showLoading("pxt-electron-update", Util.lf("Can't start app"));
                    core.confirmAsync({
                        header: lf("Critical update required"),
                        body: lf("We have disabled this app for security reasons. Please ensure you are connected to the Internet and try again later. An update will be automatically installed as soon as it is available."),
                        hideAgree: true,
                        disagreeLbl: lf("Quit"),
                        disagreeClass: "red",
                        size: "medium"
                    }).then(b => {
                        pxtElectron.sendQuit();
                    });
                default:
                    // Unknown status; just resume
                    return resolve();
            }
        });
        pxtElectron.sendUpdateStatusCheck();
    });
}