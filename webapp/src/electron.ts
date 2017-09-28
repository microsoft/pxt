"use strict";

import * as core from "./core";
import Cloud = pxt.Cloud;

enum UpdateEventType {
    Critical = 1,
    Notification,
    Prompt
}

interface UpdateEventInfo {
    type: UpdateEventType;
    appName?: string;
    isInitialCheck?: boolean;
    targetVersion?: string;
}

interface TelemetryEventInfo {
    event: string;
    data: pxt.Map<string | number>;
}

interface ElectronMessage {
    type: string;
    args?: UpdateEventInfo | TelemetryEventInfo;
}

let electronSocket: WebSocket = null;

export const isPxtElectron = /[?&]electron=1/.test(window.location.href);
export const isIpcRenderer = !!(window as any).ipcRenderer;
export const isElectron = isPxtElectron || isIpcRenderer;

export function init() {
    if (!isElectron || !Cloud.isLocalHost() || !Cloud.localToken) {
        return;
    }

    function onCriticalUpdate(args: UpdateEventInfo) {
        const isUrl = /^https:\/\//.test(args.targetVersion);
        let body = lf("To continue using {0}, you must install an update.", args.appName || lf("this application"));
        let agreeLbl = lf("Update");

        if (isUrl) {
            body = lf("To continue using {0}, you must install an update from the website.", args.appName || lf("this application"));
            agreeLbl = lf("Go to website");
        }

        core.confirmAsync({
            header: lf("Critical update required"),
            body,
            agreeLbl,
            disagreeLbl: lf("Quit"),
            disagreeClass: "red",
            size: "medium"
        }).then(b => {
            if (!b) {
                pxt.tickEvent("update.refusedCritical");
                sendMessage("quit");
            } else {
                pxt.tickEvent("update.acceptedCritical");
                core.showLoading("downloadingupdate", lf("Downloading update..."));
                sendMessage("update", {
                    targetVersion: args.targetVersion,
                    type: args.type
                });
            }
        });
    }

    function onUpdateAvailable(args: UpdateEventInfo) {
        const isUrl = /^https:\/\//.test(args.targetVersion);
        let header = lf("Version {0} available", args.targetVersion);
        let body = lf("A new version of {0} is ready to download and install. The app will restart during the update. Update now?", args.appName || lf("this application"));
        let agreeLbl = lf("Update");

        if (isUrl) {
            header = lf("Update available from website");
            body = lf("A new version of {0} is available from the website.", args.appName || lf("this application"));
            agreeLbl = lf("Go to website");
        }

        if (args.type === UpdateEventType.Notification) {
            core.infoNotification(lf("A new version is available. Select 'Check for updates...' in the menu.", args.targetVersion));
        } else if (args.type === UpdateEventType.Prompt) {
            core.confirmAsync({
                header,
                body,
                agreeLbl,
                disagreeLbl: lf("Not now"),
                size: "medium"
            }).then(b => {
                if (!b) {
                    if (args.isInitialCheck) {
                        pxt.tickEvent("update.refusedInitial");
                    } else {
                        pxt.tickEvent("update.refused");
                    }
                } else {
                    if (args.isInitialCheck) {
                        pxt.tickEvent("update.acceptedInitial");
                    } else {
                        pxt.tickEvent("update.accepted");
                    }

                    if (!isUrl) {
                        core.showLoading("downloadingupdate", lf("Downloading update..."));
                    }

                    sendMessage("update", {
                        targetVersion: args.targetVersion,
                        type: args.type
                    });
                }
            });
        }
    }

    function onUpdateNotAvailable() {
        core.confirmAsync({
            body: lf("You are using the latest version available."),
            header: lf("Good to go!"),
            agreeLbl: lf("Ok"),
            hideCancel: true
        });
    }

    function onUpdateCheckError() {
        displayUpdateError(lf("Unable to check for updates"), lf("Ok"));
    }

    function onUpdateDownloadError(args: UpdateEventInfo) {
        const isCritical = args && args.type === UpdateEventType.Critical;

        core.hideLoading("downloadingupdate");
        displayUpdateError(lf("There was an error downloading the update"), isCritical ? lf("Quit") : lf("Ok"))
            .finally(() => {
                if (isCritical) {
                    sendMessage("quit");
                }
            });
    }

    function displayUpdateError(header: string, btnLabel: string) {
        return core.confirmAsync({
            header,
            body: lf("Please ensure you are connected to the Internet and try again later."),
            agreeClass: "red",
            agreeIcon: "cancel",
            agreeLbl: btnLabel,
            hideCancel: true
        });
    }

    pxt.log('initializing electron socket');
    electronSocket = new WebSocket(`ws://localhost:${pxt.options.wsPort}/${Cloud.localToken}/electron`);
    electronSocket.onopen = (ev) => {
        pxt.log('electron: socket opened');
        sendMessage("ready");
    }
    electronSocket.onclose = (ev) => {
        pxt.log('electron: socket closed');
        electronSocket = null;
    }
    electronSocket.onmessage = (ev) => {
        try {
            const msg = JSON.parse(ev.data) as ElectronMessage;

            switch (msg.type) {
                case "critical-update":
                    onCriticalUpdate(msg.args as UpdateEventInfo);
                    break;
                case "update-available":
                    onUpdateAvailable(msg.args as UpdateEventInfo);
                    break;
                case "update-not-available":
                    onUpdateNotAvailable();
                    break;
                case "update-check-error":
                    onUpdateCheckError();
                    break;
                case "update-download-error":
                    onUpdateDownloadError(msg.args as UpdateEventInfo);
                    break;
                case "telemetry":
                    const telemetryInfo = msg.args as TelemetryEventInfo;

                    if (!telemetryInfo) {
                        pxt.debug('invalid telemetry message: ' + ev.data);
                        return;
                    }

                    pxt.tickEvent(telemetryInfo.event, telemetryInfo.data);
                default:
                    pxt.debug('unknown electron message: ' + ev.data);
                    break;
            }
        }
        catch (e) {
            pxt.debug('unknown electron message: ' + ev.data);
        }
    }
}

export function sendMessage(type: string, args?: UpdateEventInfo) {
    if (!electronSocket) {
        return;
    }

    const message: ElectronMessage = {
        type,
        args
    };

    // Sending messages to the web socket sometimes hangs the app briefly; use setTimeout to smoothen the UI animations a bit 
    setTimeout(function () {
        electronSocket.send(JSON.stringify(message));
    }, 150);
}

export function checkForUpdate() {
    pxt.tickEvent("menu.electronupdate");
    sendMessage("check-for-update");
}