"use strict";

import * as Promise from "bluebird";
import { spawn } from "child_process";
import { app } from "electron";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as I from "../typings/interfaces";
import * as path from "path";
import * as Utils from "../util/electronUtils";

export class WindowsUpdater extends EventEmitter implements I.UpdaterBase {
    private url: string = null;
    private currentRequest: Promise<void> = null;
    private updatePackagePath: string = null;

    constructor(private cacheInfo: I.UpdateCacheInfo) {
        super();
    }

    public setFeedURL(url: string): void {
        this.url = url;
    }

    public checkForUpdates(): void {
        if (!this.url) {
            throw new Error("No feed url set");
        }

        if (this.currentRequest) {
            return;
        }

        this.emit("checking-for-update");
        this.currentRequest = Utils.request({ url: this.url })
            .then<I.Update>(Utils.asJson)
            .then(update => {
                if (!update || !update.url) {
                    this.emit("update-not-available");
                    return this.cleanup();
                }

                this.emit("update-available");
                return this.downloadUpdate(update);
            })
            .catch((e) => {
                this.emit("update-not-available");
                this.emit("error", e);
            })
            .finally(() => {
                this.currentRequest = null;
            });
    }

    public quitAndInstall(): void {
        if (!this.updatePackagePath) {
            return;
        }

        spawn(this.updatePackagePath, ["/silent", "/mergetasks=runpxt,!desktopicon,!quicklaunchicon"], {
            detached: true,
            stdio: ["ignore", "ignore", "ignore"]
        });

        app.quit();
    }

    private getUpdatePackageName(version: string) {
        return `PxtSetup-${version}.exe`;
    }

    private getUpdatePackagePath(version: string): string {
        return path.join(this.cacheInfo.cachePath, this.getUpdatePackageName(version));
    }

    private downloadUpdate(update: I.Update): Promise<void> {
        let packagePath: string;
        return this.cleanup(update.version)
            .then(() => {
                packagePath = this.getUpdatePackagePath(update.version);
                return Utils.fileExistsAsync(packagePath);
            }).then((exists: boolean) => {
                if (exists) {
                    return Promise.resolve();
                }

                const url = update.url;
                const downloadPath = `${packagePath}.tmp`;

                return Utils.request({ url })
                    .then(context => Utils.download(downloadPath, context))
                    .then(() => Utils.fsRenamePromise(downloadPath, packagePath));
            })
            .then(() => {
                this.updatePackagePath = packagePath;

                this.emit("update-downloaded");
            });
    }

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
