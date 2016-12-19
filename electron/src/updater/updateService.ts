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
import * as Utils from "../util/electronUtils";
import { WindowsUpdater } from "./windowsUpdater";

/**
 * This class is the main entry point for updates in the app. It is responsible for checking if updates are available,
 * downloading updates, applying updates, and understanding the release manifest of the target. In addition to the
 * public method it exposes, this class also emits the following events:
 *   critical-update:       Emitted when the current version is blacklisted in the release manifest
 *   update-available:      Emitted when an update is available
 *   update-not-available:  Emitted when no update is available
 *   update-check-error:    Emitted when there was an error while checking for an update
 *   update-download-error: Emitted when there was an error while downloading an update
 * 
 * These events are emitted with an UpdateEventInfo object, which gives the handlers relevant info.
 */
export class UpdateService extends EventEmitter {
    private readonly UPDATE_CACHE_NAME = `${product.targetId}-update`;
    private readonly RELEASE_MANIFEST_NAME = "release.json";
    private readonly CACHE_LIFE_MS = 20 * 60 * 1000; // 20 minutes before re-fetching the release manifest

    private updaterImpl: I.UpdaterBase = null;
    private _cacheInfo: I.UpdateCacheInfo = null;

    /**
     * Information about the cache in the temp folder where we store the release manifest (and also the installers on
     * Windows).
     */
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
    }

    /**
     * Queries the release manifest, and based on the app's current version, emits either critical-update or
     * update-available, with UpdateEventInfo.isInitialCheck set to true. If the current app is up-to-date, then no
     * events are emitted from this check.
     */
    public initialCheck(): void {
        this.getReleaseManifest()
            .then((releaseManifest) => {
                let targetVersion = this.getTargetRelease(releaseManifest);
                let versionInfo = this.getCurrentVersionInfo(releaseManifest);
                let criticalPrompt = versionInfo.blacklist.some((blacklistRange) => {
                    return semver.satisfies(product.version, blacklistRange);
                });
                let aggressivePrompt = semver.lte(product.version, versionInfo.prompt);

                if (targetVersion) {
                    if (criticalPrompt) {
                        this.emit("critical-update", this.makeUpdateInfo(targetVersion));
                    } else if (aggressivePrompt) {
                        this.emit("update-available", this.makeUpdateInfo(targetVersion, /*isInitialCheck*/ true));
                    }
                }
            })
            .catch((e) => {
                // In case of error, be permissive (swallow the error and let the app continue normally)
            });
    }

    /**
     * Queries the release manifest to check if an update is available. Emits either update-available or
     * update-not-available if the check was successful, or update-check-error if there was an error during the check.
     */
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

    /**
     * Performs the update to the specified target version by using the AutoUpdater implementation for the current
     * platform. By using the AutoUpdater.checkForUpdates(), any available update is downloaded automatically. When the
     * download is complete, we install the update in the update-downloaded handler.
     */
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
            let downloadUrl = product.updateDownloadUrl;
            let platformString = product.isBeta ? process.platform + "-beta" : process.platform;

            downloadUrl = downloadUrl.replace(/{{version}}/, targetVersion);
            downloadUrl = downloadUrl.replace(/{{platform}}/, platformString);

            this.updaterImpl.setFeedURL(downloadUrl);
        } catch (e) {
            // On OSX, an error here means the current app isn't signed. Update is not possible.
            deferred.reject(void 0);
        }

        // The following call downloads the release and emits "update-downloaded" when done
        this.updaterImpl.checkForUpdates();

        deferred.promise.catch((e) => {
            this.emit("update-download-error", isCritical);
        });
    }

    private getCurrentVersionInfo(releaseManifest: I.ReleaseManifest): I.VersionInfo {
        let major = semver.major(product.version);

        return releaseManifest.versions[major];
    }

    private getTargetRelease(releaseManifest: I.ReleaseManifest): string {
        let versionInfo = this.getCurrentVersionInfo(releaseManifest);

        if (versionInfo && semver.lt(product.version, versionInfo.latest)) {
            return versionInfo.latest;
        }

        return null;
    }

    private makeUpdateInfo(targetVersion: string, isInitialCheck: boolean = false): I.UpdateEventInfo {
        return {
            appName: product.nameLong,
            isBeta: product.isBeta,
            isInitialCheck,
            targetVersion
        };
    }

    /**
     * Gets the target's release manifest. We try to use a cached copy first, but if there is none, or if the cache is
     * outdated, we download a new one by using the URL specified in the product info. The release manifest is cached
     * after download.
     */
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
                        // Error downloading a new manifest; if we had one in the cache, fallback to that even if it
                        // was outdated
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

        return Utils.requestAsStream({ url: product.releaseManifestUrl })
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