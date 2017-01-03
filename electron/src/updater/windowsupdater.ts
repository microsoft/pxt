"use strict";

import * as Promise from "bluebird";
import { spawn } from "child_process";
import { app } from "electron";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as I from "../typings/interfaces";
import * as path from "path";
import * as Utils from "../util/electronutils";

/**
 * Windows implementation of the AutoUpdater. This re-implements the built-in Electron AutoUpdater module for Windows.
 */
export class WindowsUpdater extends EventEmitter implements I.UpdaterBase {
    private updateDownloadUrl: string = null;
    private currentRequest: Promise<void> = null;
    private downloadedInstallerPath: string = null;

    constructor(private cacheInfo: I.UpdateCacheInfo) {
        super();
    }

    /**
     * Simply saves the URL to query when checking for an update. The reason we put this in a separate method is to be
     * consistent with how the built-in AutoUpdater is implemented (we use the built-in AutoUpdater for Mac updates).
     */
    public setFeedURL(url: string): void {
        this.updateDownloadUrl = url;
    }

    /**
     * Queries the product's update download URL to check if an update is available. If an update is available, the
     * installer for that update is downloaded to a cache in the temp folder. This method emits the same events as the
     * built-in Electron AutoUpdater:
     *   checking-for-update:  Emitted at the start of the method
     *   update-not-available: Emitted if there is no update available
     *   update-available:     Emitted when an update was found and is being downloaded
     *   update-downloaded:    Emitted by the downloadUpdate() method when the installer finishes downloading
     *   error:                Emitted when an error of any kind occurs
     */
    public checkForUpdates(): void {
        if (!this.updateDownloadUrl) {
            throw new Error("No feed url set");
        }

        if (this.currentRequest) {
            return;
        }

        this.emit("checking-for-update");
        // Query the product's update download URL
        this.currentRequest = Utils.requestAsStream({ url: this.updateDownloadUrl })
            .then<I.Update>(Utils.asJson)
            .then(update => {
                // As per Electron's AutoUpdater module, the queried endpoint must return a JSON object containing a
                // "url" property. This url property is the download location of the installer for the update.
                if (!update || !update.url) {
                    this.emit("update-not-available");
                    return this.cleanup();
                }

                this.emit("update-available");

                // Download the installer for the update
                return this.downloadUpdate(update);
            })
            .catch((e) => {
                this.emit("error", e);
            })
            .finally(() => {
                this.currentRequest = null;
            });
    }

    /**
     * As per Electron's AutoUpdater module, this method quits the app and performs the update. In our specific
     * implementation, we download the installer to a temporary cache, launch the installer as a detached child
     * process, and then exit the app.
     */
    public quitAndInstall(): void {
        if (!this.downloadedInstallerPath) {
            return;
        }

        spawn(this.downloadedInstallerPath, ["/silent", "/mergetasks=runpxt,!desktopicon,!quicklaunchicon"], {
            detached: true,
            stdio: ["ignore", "ignore", "ignore"]
        });

        app.quit();
    }

    private getInstallerName(version: string) {
        return `PxtSetup-${version}.exe`;
    }

    private getInstallerPath(version: string): string {
        return path.join(this.cacheInfo.cachePath, this.getInstallerName(version));
    }

    /**
     * Downloads the installer for the specified Update, using the Update.url property. Emits update-downloaded when
     * the download is complete.
     */
    private downloadUpdate(update: I.Update): Promise<void> {
        let installerPath: string;
        return this.cleanup(update.version)
            .then(() => {
                installerPath = this.getInstallerPath(update.version);
                return Utils.fileExistsAsync(installerPath);
            }).then((exists: boolean) => {
                if (exists) {
                    return Promise.resolve();
                }

                const url = update.url;
                const downloadPath = `${installerPath}.tmp`;

                return Utils.requestAsStream({ url })
                    .then(context => Utils.download(downloadPath, context))
                    .then(() => Utils.fsRenamePromise(downloadPath, installerPath));
            })
            .then(() => {
                this.downloadedInstallerPath = installerPath;

                this.emit("update-downloaded");
            });
    }

    /**
     * Utility method to clean the installer cache of old installers.
     */
    private cleanup(exceptVersion: string = null): Promise<void> {
        return Utils.fsReaddirPromise(this.cacheInfo.cachePath)
            .then((files: string[]) => {
                const escapedVersion = exceptVersion && exceptVersion.replace(/\./g, "\\.");
                const filterRegExp = new RegExp(`-${escapedVersion}\\.exe$`);

                files = files.filter((f) => {
                    if (f === this.cacheInfo.releaseManifestFileName) {
                        return false;
                    }

                    if (!exceptVersion) {
                        return true;
                    }

                    return !filterRegExp.test(f);
                });

                return Promise.map(files, (f) => {
                    return Utils.fsUnlinkPromise(f);
                })
                    .then(() => null);
            });
    }
}
