import Cloud = pxt.Cloud;
import * as core from "./core";

const pxtElectron: pxt.electron.PxtElectron = (window as any).pxtElectron;
export const isPxtElectron = !!pxtElectron;
export const isIpcRenderer = !!(window as any).ipcRenderer;
export const isElectron = isPxtElectron || isIpcRenderer;

const downloadingUpdateLoadingName = "pxtelectron-downloadingupdate";

export function initPxtElectron(): void {
    if (!isPxtElectron) {
        return;
    }

    pxtElectron.registerTelemetryHandler(pxt.tickEvent);
    pxtElectron.registerUpdateHandler(() => core.infoNotification(Util.lf("An update will take effect after the app restarts")));
}