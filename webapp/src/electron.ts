import Cloud = pxt.Cloud;
import * as core from "./core";

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

const pxtElectron: pxt.electron.PxtElectron = (window as any).pxtElectron;
export const isPxtElectron = !!pxtElectron;
export const isIpcRenderer = !!(window as any).ipcRenderer;
export const isElectron = isPxtElectron || isIpcRenderer;

let updateReleaseInfo: pxt.electron.MajorRelease; // If an update is available, this will be defined
const downloadingUpdateLoadingName = "pxtelectron-downloadingupdate";

export function initPxtElectronAsync(): Promise<void> {
    if (!isPxtElectron) {
        return Promise.resolve();
    }

    return Cloud.downloadTargetConfigAsync()
        .then((targetConfig) => {
            const manifest = targetConfig.electronManifest;
            const currentVersion = pxt.appTarget.versions.target;
            const currentSemver = pxt.semver.parse(currentVersion);

            if (!manifest || !manifest.majorReleases || !manifest.majorReleases[currentSemver.major]) {
                return Promise.resolve();
            }

            const releaseInfo = manifest.majorReleases[currentSemver.major];
            let isBanned = false;

            // Banned version check
            if (releaseInfo.bannedVersions) {
                isBanned = !!releaseInfo.bannedVersions.find((range) => {
                    return isInRangeInclusive(currentSemver, range);
                });
            }

            if (isBanned) {
                return handleCriticalUpdateAsync(releaseInfo);
            } else {
                if (pxt.semver.cmp(currentSemver, pxt.semver.parse(releaseInfo.latest)) >= 0) {
                    // No update available
                    pxt.tickEvent("pxtelectron.update.uptodate");
                    return Promise.resolve();
                }

                // An update is available, check whether we should prompt or notify
                updateReleaseInfo = releaseInfo;

                if (releaseInfo.promptVersion && pxt.semver.cmp(currentSemver, pxt.semver.parse(releaseInfo.promptVersion)) <= 0) {
                    return handlePromptUpdateAsync(releaseInfo, /* isInitialCheck */ true);
                } else {
                    handleNotifyUpdate();
                    return Promise.resolve();
                }
            }
        })
        .catch((e) => {
            // Be permissive
            pxt.tickEvent("pxtelectron.init.initfailed");
        });
}

function isInRangeInclusive(v: pxt.semver.Version, range: pxt.electron.VersionRange): boolean {
    const cmpMin = pxt.semver.cmp(v, pxt.semver.parse(range.from));
    const cmpMax = pxt.semver.cmp(v, pxt.semver.parse(range.to));
    return cmpMin >= 0 && cmpMax <= 0;
}

function handleCriticalUpdateAsync(releaseInfo: pxt.electron.MajorRelease): Promise<void> {
    pxt.tickEvent("pxtelectron.update.criticalupdate");
    const isUrlUpdate = releaseInfo.url;
    let body = lf("To continue using this application, you must install an update.");
    let agreeLbl = lf("Update");

    if (isUrlUpdate) {
        body = lf("To continue using this application, you must install an update from the website.");
        agreeLbl = lf("Go to website");
    }

    return new Promise((resolve, reject) => {
        // Return a promise that is never settled so that the editor does not continue to load
        core.confirmAsync({
            header: lf("Critical update required"),
            body,
            agreeLbl,
            disagreeLbl: lf("Quit"),
            disagreeClass: "red"
        }).then(b => {
            if (!b) {
                pxt.tickEvent("pxtelectron.update.refusedcritical");
                pxtElectron.quitApp();
            } else {
                pxt.tickEvent("pxtelectron.update.acceptedcritical", {
                    isUrlUpdate
                });
                if (isUrlUpdate) {
                    window.open(releaseInfo.url, "_blank");
                    setTimeout(() => { // Use timeout to give enough time to open the web page and to handle telemetry
                        pxtElectron.quitApp();
                    }, 500);
                } else {
                    core.showLoading(downloadingUpdateLoadingName, lf("Downloading update..."));
                    pxtElectron.updateApp(releaseInfo.latest, () => handleUpdateErrorAsync(/* isCriticalUpdate */ true));
                }
            }
        });
    });
}

function handleNotifyUpdate(): void {
    pxt.tickEvent("pxtelectron.update.notify");
    // TODO: Use the notification banner instead (it needs to be revamped first)
    core.infoNotification(lf("An update is available. Select \"Check for update\" in the menu."));
}

function handlePromptUpdateAsync(releaseInfo: pxt.electron.MajorRelease, isInitialCheck: boolean = false): Promise<void> {
    pxt.tickEvent("pxtelectron.update.prompt");
    const isUrlUpdate = releaseInfo.url;
    let header = lf("Version {0} available", releaseInfo.latest);
    let body = lf("A new version is ready to download and install. This application will restart during the update. Update now?");
    let agreeLbl = lf("Update");

    if (isUrlUpdate) {
        header = lf("Update available from website");
        body = lf("A new version is available from the website.");
        agreeLbl = lf("Go to website");
    }

    return new Promise((resolve, reject) => {
        core.confirmAsync({
            header,
            body,
            agreeLbl,
            disagreeLbl: lf("Not now")
        }).then(b => {
            if (!b) {
                if (isInitialCheck) {
                    pxt.tickEvent("pxtelectron.update.refusedinitial");
                } else {
                    pxt.tickEvent("pxtelectron.update.refused");
                }
                resolve();
            } else {
                if (isInitialCheck) {
                    pxt.tickEvent("pxtelectron.update.acceptedinitial", {
                        isUrlUpdate
                    });
                } else {
                    pxt.tickEvent("pxtelectron.update.accepted", {
                        isUrlUpdate
                    });
                }

                if (isUrlUpdate) {
                    window.open(releaseInfo.url, "_blank");
                    resolve();
                } else {
                    // User accepted, so wait for the update to download (the app will automatically quit). Do not
                    // resolve the promise unless there's an error during the update
                    core.showLoading(downloadingUpdateLoadingName, lf("Downloading update..."));
                    pxtElectron.updateApp(releaseInfo.latest, () => {
                        handleUpdateErrorAsync()
                            .finally(resolve);
                    });
                }
            }
        });
    });
}

function handleUpdateErrorAsync(isCriticalUpdate: boolean = false): Promise<void> {
    pxt.tickEvent("pxtelectron.update.error");
    core.hideLoading(downloadingUpdateLoadingName);
    return displayUpdateErrorAsync(lf("Error while downloading the update"), isCriticalUpdate ? lf("Quit") : lf("Ok"))
        .finally(() => {
            if (isCriticalUpdate) {
                pxtElectron.quitApp();
            }
        });
}

function displayUpdateErrorAsync(header: string, btnLabel: string): Promise<void> {
    return core.confirmAsync({
        header,
        body: lf("Please ensure you are connected to the Internet and try again later."),
        agreeClass: "red",
        agreeIcon: "cancel",
        agreeLbl: btnLabel,
        hideCancel: true
    })
        .then(() => null);
}

function displayUpToDateAsync(): Promise<void> {
    return core.confirmAsync({
        body: lf("You are using the latest version available."),
        header: lf("Good to go!"),
        agreeLbl: lf("Ok"),
        hideCancel: true
    })
        .then(() => null);
}

export function checkForUpdate(): Promise<void> {
    pxt.tickEvent("menu.electronupdate");

    if (!updateReleaseInfo) {
        return displayUpToDateAsync();
    } else {
        return handlePromptUpdateAsync(updateReleaseInfo);
    }
}