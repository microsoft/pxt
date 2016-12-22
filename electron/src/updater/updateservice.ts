"use strict";

import * as Promise from "bluebird";
import { app, shell } from "electron";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as I from "../typings/interfaces";
import { tmpdir } from "os";
import { OsxUpdater } from "./osxupdater";
import * as path from "path";
import product from "../util/productloader";
import * as semver from "semver";
import * as Utils from "../util/electronutils";
import { WindowsUpdater } from "./windowsupdater";

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
                const targetVersion = this.getTargetRelease(releaseManifest);
                const versionInfo = this.getCurrentVersionInfo(releaseManifest);
                const criticalPrompt = versionInfo.banned.some((banRange) => {
                    return semver.satisfies(product.version, banRange);
                });
                const aggressivePrompt = semver.lte(product.version, versionInfo.prompt);

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
                console.log("Error during initial version check: " + e);
            });
    }

    /**
     * Queries the release manifest to check if an update is available. Emits either update-available or
     * update-not-available if the check was successful, or update-check-error if there was an error during the check.
     */
    public checkForUpdate(): void {
        this.getReleaseManifest()
            .then((releaseManifest) => {
                const targetVersion = this.getTargetRelease(releaseManifest);

                if (targetVersion) {
                    this.emit("update-available", this.makeUpdateInfo(targetVersion));
                } else {
                    this.emit("update-not-available");
                }
            })
            .catch((e) => {
                this.emit("update-check-error");
                console.log("Error during update check: " + e);
            });
    }

    /**
     * Performs an update. If the target version is a URL, the URL is opened in the default browser. If the target
     * version is a tag, the associated installer is downloaded and run.
     */
    public update(targetVersion: string, isCritical: boolean = false): void {
        if (/^https:\/\//.test(targetVersion)) {
            shell.openExternal(targetVersion);

            if (isCritical) {
                app.exit();
            }

            return;
        }

        const deferred = Utils.defer<void>();

        this.updaterImpl.addListener("update-downloaded", () => {
            this.updaterImpl.quitAndInstall();
        });
        this.updaterImpl.addListener("update-not-available", () => {
            deferred.reject(new Error("Update is no longer available"));
        });
        this.updaterImpl.addListener("error", (e: Error) => {
            deferred.reject(e);
        });

        try {
            let downloadUrl = product.updateDownloadUrl;
            const platformString = product.updateTag ? `${process.platform}-${product.updateTag}` : process.platform;

            downloadUrl = downloadUrl.replace(/{{version}}/, targetVersion);
            downloadUrl = downloadUrl.replace(/{{platform}}/, platformString);

            this.updaterImpl.setFeedURL(downloadUrl);
        } catch (e) {
            // On OSX, an error here means the current app isn't signed. Update is not possible.
            deferred.reject(e);
        }

        // The following call downloads the release and emits "update-downloaded" when done
        this.updaterImpl.checkForUpdates();

        deferred.promise.catch((e) => {
            this.emit("update-download-error", {
                isCritical
            });
            console.log("Error during update: " + e);
        });
    }

    private getCurrentVersionInfo(releaseManifest: I.ReleaseManifest): I.VersionInfo {
        const major = semver.major(product.version);

        return releaseManifest.versions[major];
    }

    /**
     * Decides which version to update to. First looks in the list of URLs to see if the current version is listed, and
     * returns the URL to visit if found. If current version is not listed in the URL updates, then returns the latest
     * version, if it is higher than the current version. Returns null if no update is available.
     */
    private getTargetRelease(releaseManifest: I.ReleaseManifest): string {
        const versionInfo = this.getCurrentVersionInfo(releaseManifest);
        let urlUpdate: string;

        versionInfo.urls && Object.keys(versionInfo.urls).find((semverRange) => {
            if (semver.satisfies(product.version, semverRange)) {
                urlUpdate = versionInfo.urls[semverRange];
                return true;
            }

            return false;
        });

        if (urlUpdate) {
            return urlUpdate;
        }

        if (versionInfo && semver.lt(product.version, versionInfo.latest)) {
            return versionInfo.latest;
        }

        return null;
    }

    private makeUpdateInfo(targetVersion: string, isInitialCheck: boolean = false): I.UpdateEventInfo {
        return {
            appName: product.nameLong,
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
                        throw new Error("Error downloading the release manifest: " + e);
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
                        console.log("Error caching the release manifest: " + e);
                    })
                    .then(() => releaseManifest);
            });
    }

    private cacheReleaseManifest(releaseManifest: I.ReleaseManifest): Promise<void> {
        releaseManifest.timestamp = (new Date()).toISOString();

        return Utils.fsWriteFilePromise(this.cacheInfo.releaseManifestPath, JSON.stringify(releaseManifest));
    }
}