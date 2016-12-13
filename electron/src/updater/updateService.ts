"use strict";

import * as Promise from "bluebird";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as I from "../typings/interfaces";
import { tmpdir } from "os";
import { OsxUpdater } from "./osxUpdater";
import * as path from "path";
import product from "../util/productInfoLoader";
import * as semver from "semver";
import { UpdateServer } from "./updateServer";
import * as Utils from "../util/electronUtils";
import { WindowsUpdater } from "./windowsUpdater";

export class UpdateService extends EventEmitter {
    private readonly UPDATE_CACHE_NAME = `${product.targetId}-update`;
    private readonly RELEASE_MANIFEST_NAME = "release.json";
    private readonly CACHE_LIFE_MS = 20 * 60 * 1000; // 20 minutes before re-fetching the release manifest

    private updaterImpl: I.UpdaterBase = null;
    private updateServer: UpdateServer = null;
    private _cacheInfo: I.UpdateCacheInfo = null;

    private get cacheInfo(): I.UpdateCacheInfo {
        if (!this._cacheInfo) {
            const updateCache = path.join(tmpdir(), this.UPDATE_CACHE_NAME);
            Utils.mkdirp(updateCache);

            this._cacheInfo = {
                cachePath: updateCache,
                releaseManifestFileName: this.RELEASE_MANIFEST_NAME,
                releaseManifestPath: path.join(updateCache, this.RELEASE_MANIFEST_NAME)
            };
        }

        return this._cacheInfo;
    }

    constructor() {
        super();

        switch (process.platform) {
            case "win32":
                this.updaterImpl = new WindowsUpdater(this.cacheInfo);
                break;
            case "darwin":
                this.updaterImpl = new OsxUpdater();
                break;
        }

        this.updateServer = new UpdateServer();
    }

    public start(): Promise<void> {
        return this.updateServer.start()
            .catch((e) => {
                this.updateServer = null;
            });
    }

    public versionCheck(): void {
        this.getReleaseManifest()
            .then((releaseManifest) => {
                let targetVersion = this.getTargetRelease(releaseManifest);
                let criticalPrompt = releaseManifest.blackList.some((blacklistRange) => {
                    return semver.satisfies(product.version, blacklistRange);
                });
                let aggressivePrompt = semver.lt(product.version, releaseManifest.aggressivePrompt);
                let moderatePrompt = !releaseManifest.lastPromptedOn || !semver.eq(releaseManifest.lastPromptedOn, product.version);
                let prompted = false;

                if (targetVersion) {
                    if (criticalPrompt) {
                        this.emit("critical-update", this.makeUpdateInfo(targetVersion));
                        prompted = true;
                    } else if (aggressivePrompt || moderatePrompt) {
                        this.emit("update-available", this.makeUpdateInfo(targetVersion, /*isInitialCheck*/ true));
                        prompted = true;
                    }
                }

                if (prompted) {
                    releaseManifest.lastPromptedOn = product.version;
                    this.cacheReleaseManifest(releaseManifest)
                        .catch((e) => {
                            // No-op; failing to cache the manifest is not a critical error
                        });
                }
            })
            .catch((e) => {
                // In case of error, be permissive
            });
    }

    public checkForUpdate(): void {
        this.getReleaseManifest()
            .then((releaseManifest) => {
                let targetVersion = this.getTargetRelease(releaseManifest);

                if (targetVersion) {
                    this.emit("update-available", this.makeUpdateInfo(targetVersion));
                } else {
                    this.emit("update-not-available");
                }
            })
            .catch((e) => {
                this.emit("update-check-error");
            });
    }

    public update(targetVersion: string, isCritical: boolean = false): void {
        let deferred = Utils.defer<void>();

        this.updaterImpl.addListener("update-downloaded", () => {
            this.updaterImpl.quitAndInstall();
        });
        this.updaterImpl.addListener("update-not-available", () => {
            deferred.reject(null);
        });
        this.updaterImpl.addListener("error", (e: Error) => {
            deferred.reject(null);
        });

        try {
            this.updaterImpl.setFeedURL(this.updateServer.getFeedUrl(targetVersion));
        } catch (e) {
            // On OSX, an error here means the current app isn't signed. Update is not possible.
            deferred.reject(void 0);
        }

        // The following call downloads the release and emits "update-downloaded" when done
        this.updaterImpl.checkForUpdates();

        deferred.promise.catch((e) => {
            this.emit("update-download-error", isCritical ? { isCritical } : void 0);
        });
    }

    private getTargetRelease(releaseManifest: I.ReleaseManifest): string {
        if (semver.lt(product.version, releaseManifest.latestRelease)) {
            return releaseManifest.latestRelease;
        }

        return null;
    }

    private makeUpdateInfo(targetVersion: string, isInitialCheck: boolean = false): I.UpdateEventInfo {
        return {
            appName: "@@nameLong@@",
            isBeta: product.isBeta,
            isInitialCheck,
            targetVersion
        };
    }

    private getReleaseManifest(): Promise<I.ReleaseManifest> {
        return Promise.resolve()
            .then(() => {
                return Utils.readJsonFileAsync(this.cacheInfo.releaseManifestPath);
            })
            .then((releaseManifest: I.ReleaseManifest) => {
                if (releaseManifest && releaseManifest.timestamp) {
                    const cachedTime = Date.parse(releaseManifest.timestamp);
                    const currentTime = Date.parse((new Date()).toISOString());

                    if (!isNaN(cachedTime) && currentTime - cachedTime <= this.CACHE_LIFE_MS) {
                        return Promise.resolve(releaseManifest);
                    }
                }

                return this.downloadReleaseManifest()
                    .catch((e) => {
                        // If we had a cached version, fallback to that even if it was outdated
                        if (releaseManifest) {
                            return releaseManifest;
                        }

                        // If not, propagate the error
                        throw e;
                    });
            });
    }

    private downloadReleaseManifest(): Promise<I.ReleaseManifest> {
        if (!product.releaseManifestUrl) {
            return Promise.reject(null);
        }

        return Utils.request({ url: product.releaseManifestUrl })
            .then<I.ReleaseManifest>(Utils.asJson)
            .then((releaseManifest) => {
                return this.cacheReleaseManifest(releaseManifest)
                    .catch((e) => {
                        // No-op; failing to cache the manifest is not a critical error
                    })
                    .then(() => releaseManifest);
            });
    }

    private cacheReleaseManifest(releaseManifest: I.ReleaseManifest): Promise<void> {
        releaseManifest.timestamp = (new Date()).toISOString();

        return Utils.fsWriteFilePromise(this.cacheInfo.releaseManifestPath, JSON.stringify(releaseManifest));
    }
}