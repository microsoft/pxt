"use strict";

import * as core from "./core";
import Cloud = pxt.Cloud;

interface UpdateEventInfo {
    appName?: string;
    isCritical?: boolean;
    isInitialCheck?: boolean;
    targetVersion?: string;
}

interface ElectronMessage {
    type: string;
    args?: UpdateEventInfo;
}

let electronSocket: WebSocket = null;

export const isElectron = /[?&]electron=1/.test(window.location.href);

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
                core.showLoading(lf("Downloading update..."));
                sendMessage("update", {
                    targetVersion: args.targetVersion,
                    isCritical: true
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
                    core.showLoading(lf("Downloading update..."));
                }

                sendMessage("update", {
                    targetVersion: args.targetVersion
                });
            }
        });
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
        displayUpdateError(lf("Unable to check for update"), lf("Ok"));
    }

    function onUpdateDownloadError(args: UpdateEventInfo) {
        const isCritical = args && args.isCritical;

        core.hideLoading();
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
                    onCriticalUpdate(msg.args);
                    break;
                case "update-available":
                    onUpdateAvailable(msg.args);
                    break;
                case "update-not-available":
                    onUpdateNotAvailable();
                    break;
                case "update-check-error":
                    onUpdateCheckError();
                    break;
                case "update-download-error":
                    onUpdateDownloadError(msg.args);
                    break;
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

export function sendMessage(type: string, args?: any) {
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