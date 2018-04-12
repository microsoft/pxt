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

    pxtElectron.initTelemetry(pxt.tickEvent);
    return Promise.resolve();
}