import * as core from "./core";
import * as auth from "./auth";
import * as ws from "./workspace";
import * as data from "./data";
import * as workspace from "./workspace";

type Version = pxt.workspace.Version;
type File = pxt.workspace.File;
type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

import U = pxt.Util;

type CloudProject = {
    id: string;
    header: string;
    text: string;
    version: string;
};

const localOnlyMetadataFields: (keyof Header)[] = [
    // different for different local storage instances
    '_rev', '_id' as keyof Header,
    // only for tracking local cloud sync state
    'cloudVersion', 'cloudCurrent', 'cloudLastSyncTime'
]
export function excludeLocalOnlyMetadataFields(h: Header): Header {
    const clone = {...h}
    for (let k of localOnlyMetadataFields)
        delete clone[k]
    return clone
}

export type CloudStateSummary = ""/*none*/ | "saved" | "justSaved" | "offline" | "syncing" | "conflict" | "localEdits";
export function getCloudSummary(h: pxt.workspace.Header, md: CloudTempMetadata): CloudStateSummary {
    if (!h.cloudUserId || !md)
        return "" // none
    if (!auth.loggedInSync())
        return "offline"
    if (md.cloudInProgressSyncStartTime > 0)
        return "syncing"
    if (!h.cloudCurrent)
        return "localEdits"
    if (md.justSaved)
        return "justSaved"
    if (h.cloudLastSyncTime > 0)
        return "saved"
    pxt.reportError("cloudsave", `Invalid project cloud state for project ${h.name}(${h.id.substr(0, 4)}..): user: ${h.cloudUserId}, inProg: ${md.cloudInProgressSyncStartTime}, cloudCurr: ${h.cloudCurrent}, lastCloud: ${h.cloudLastSyncTime}`);
    return ""
}

async function listAsync(): Promise<Header[]> {
    return new Promise(async (resolve, reject) => {
        // Note: Cosmos & our backend does not return e-tags each individual item in a list operation
        const result = await auth.apiAsync<CloudProject[]>("/api/user/project");
        if (result.success) {
            const syncTime = U.nowSeconds()
            const userId = auth.user()?.id;
            const headers: Header[] = result.resp.map(proj => {
                const rawHeader = JSON.parse(proj.header);
                const header = excludeLocalOnlyMetadataFields(rawHeader)
                header.cloudUserId = userId;
                header.cloudCurrent = true;
                header.cloudLastSyncTime = syncTime
                return header;
            });
            resolve(headers);
        } else {
            reject(new Error(result.errmsg));
        }
    });
}

function getAsync(h: Header): Promise<File> {
    return new Promise(async (resolve, reject) => {
        const result = await auth.apiAsync<CloudProject>(`/api/user/project/${h.id}`);
        if (result.success) {
            const userId = auth.user()?.id;
            const project = result.resp;
            const rawHeader = JSON.parse(project.header);
            const header = excludeLocalOnlyMetadataFields(rawHeader)
            const text = JSON.parse(project.text);
            const version = project.version;
            const file: File = {
                header,
                text,
                version
            };
            file.header.cloudCurrent = true;
            file.header.cloudVersion = file.version;
            file.header.cloudUserId = userId;
            file.header.cloudLastSyncTime = U.nowSeconds();
            resolve(file);
        } else {
            reject(new Error(result.errmsg));
        }
    });
}

// temporary per-project cloud metadata is only kept in memory and shouldn't be persisted to storage.
export interface CloudTempMetadata {
    cloudInProgressSyncStartTime?: number,
    justSaved?: boolean,
}
const temporaryHeaderMetadata: { [key: string]: CloudTempMetadata } = {};
export function getCloudTempMetadata(headerId: string): CloudTempMetadata {
    return temporaryHeaderMetadata[headerId] || {};
}
function updateCloudTempMetadata(headerId: string, props: Partial<CloudTempMetadata>) {
    const oldMd = temporaryHeaderMetadata[headerId] || {};
    const newMd = { ...oldMd, ...props }
    temporaryHeaderMetadata[headerId] = newMd
    data.invalidate(`${HEADER_CLOUDSTATE}:${headerId}`);
}

function setAsync(h: Header, prevVersion: Version, text?: ScriptText): Promise<Version> {
    return new Promise(async (resolve, reject) => {
        const userId = auth.user()?.id;
        h.cloudUserId = userId;
        h.cloudCurrent = false;
        h.cloudVersion = prevVersion;
        updateCloudTempMetadata(h.id, { cloudInProgressSyncStartTime: U.nowSeconds() })
        const project: CloudProject = {
            id: h.id,
            header: JSON.stringify(excludeLocalOnlyMetadataFields(h)),
            text: text ? JSON.stringify(text) : undefined,
            version: prevVersion
        }
        const result = await auth.apiAsync<string>('/api/user/project', project);
        updateCloudTempMetadata(h.id, { cloudInProgressSyncStartTime: 0, justSaved: true })
        setTimeout(() => {
            // slightly hacky, but we want to keep around a "saved!" message for a small time after
            // a save succeeds so we notify metadata subscribers again afte a delay.
            updateCloudTempMetadata(h.id, { justSaved: false })
        }, 1000);
        if (result.success) {
            h.cloudCurrent = true;
            h.cloudVersion = result.resp;
            h.cloudLastSyncTime = U.nowSeconds()
            resolve(result.resp);
        } else if (result.statusCode === 409) {
            // conflict
            resolve(undefined)
        } else {
            reject(new Error(result.errmsg));
        }
    });
}

export enum CloudSaveResult {
    Success,
    SyncError,
    NotLoggedIn
}
export async function saveAsync(h: Header, text?: ScriptText): Promise<CloudSaveResult> {
    if (!auth.hasIdentity()) { return CloudSaveResult.NotLoggedIn; }
    if (!await auth.loggedIn()) { return CloudSaveResult.NotLoggedIn; }
    const res = await setAsync(h, h.cloudVersion, text)
    if (!res) {
        // wait to synchronize
        pxt.debug('save to cloud failed; synchronizing...')
        pxt.tickEvent(`identity.cloudSaveFailedTriggeringPartialSync`);
        await syncAsync([h])
        return CloudSaveResult.SyncError;
    } else {
        return CloudSaveResult.Success;
    }
}

function deleteAsync(h: Header, prevVersion: Version, text?: ScriptText): Promise<void> {
    // Note: we don't actually want to support permanent delete initiated from the client.
    // Instead we use soft delete ".isDeleted" so that we have a tombstone to track that a
    // project used to exist. Without this, we will unintentionally resync deleted projects.
    return Promise.resolve();
}

function resetAsync(): Promise<void> {
    return Promise.resolve();
}

let _inProgressSyncAsync: Promise<any> = Promise.resolve()
export async function syncAsync(hdrs?: Header[]): Promise<Header[]> {
    // ensure we don't run this twice
    if (_inProgressSyncAsync.isResolved()) {
        _inProgressSyncAsync = syncAsyncInternal(hdrs)
    }
    return _inProgressSyncAsync
}

async function transferToCloud(local: Header, cloudVersion: string): Promise<Header> {
    const text = await workspace.getTextAsync(local.id);
    // since we just fetched the text from storage and we're about to make an update,
    //  we should acquire the current header session.
    workspace.acquireHeaderSession(local);
    const newVer = await setAsync(local, cloudVersion, text);
    U.assert(!!newVer, 'Failed to sync local change (1)');
    // save to the workspace header again to make sure cloud metadata gets saved
    await workspace.saveAsync(local, null, true)
    return local
}

async function transferFromCloud(local: Header | null, remoteFile: File): Promise<Header> {
    const newHeader = {...local || {}, ...remoteFile.header} // make sure we keep local-only metadata like _rev
    if (local) {
        // we've decided to overwrite what we have locally with what is in the
        // the cloud, so acquire the header session
        workspace.acquireHeaderSession(remoteFile.header)
        await workspace.saveAsync(newHeader, remoteFile.text, true);
    } else {
        await workspace.importAsync(newHeader, remoteFile.text, true)
    }
    return newHeader
}

async function syncAsyncInternal(hdrs?: Header[]): Promise<Header[]> {
    if (!auth.hasIdentity()) { return []; }
    if (!await auth.loggedIn()) { return []; }
    try {
        const partialSync = hdrs && hdrs.length > 0
        pxt.log(`Synchronizing${partialSync ? ` ${hdrs.length} project(s) ` : " all projects "}with the cloud...`)
        const userId = auth.user()?.id;
        // Filter to cloud-synced headers owned by the current user.
        const localCloudHeaders = (hdrs || workspace.getHeaders(true))
            .filter(h => h.cloudUserId && h.cloudUserId === userId)
        const syncStart = U.nowSeconds()
        pxt.tickEvent(`identity.sync.start`)
        const agoStr = (t: number) => `${syncStart - t} seconds ago`
        const remoteFiles: {[id: string]: File} = {}
        const getWithCacheAsync = async (h: Header): Promise<File> => {
            if (!remoteFiles[h.id]) {
                remoteFiles[h.id] = await getAsync(h)
            }
            return remoteFiles[h.id]
        }
        if (partialSync) {
            // during a partial sync, get the full files for each cloud project and
            // save them to our temporary cache
            await Promise.all(hdrs.map(h => getWithCacheAsync(h)))
        }
        const remoteHeaders = partialSync
            ? U.values(remoteFiles).map(f => f.header) // a partial set of cloud headers
            : await listAsync() // all cloud headers
        const numDiff = remoteHeaders.length - localCloudHeaders.length
        if (numDiff !== 0) {
            pxt.log(`${Math.abs(numDiff)} ${numDiff > 0 ? 'more' : 'fewer'} projects found in the cloud.`);
        }
        pxt.tickEvent(`identity.sync.projectNumbers`, {
            numRemote: remoteHeaders.length,
            numNonCloudLocal: workspace.getHeaders(true).length - localCloudHeaders.length,
            numCloudLocal: localCloudHeaders.length
        })
        const lastCloudChange = remoteHeaders.length ? Math.max(...remoteHeaders.map(h => h.modificationTime)) : syncStart
        pxt.log(`Last cloud project change was ${agoStr(lastCloudChange)}`);
        const remoteHeadersToProcess = U.toDictionary(remoteHeaders, h => h.id);
        const localHeaderChanges: pxt.Map<Header> = {}
        const toCloud = transferToCloud;
        const fromCloud = async (loc: Header, rem: File) => {
            const newLoc = await transferFromCloud(loc, rem)
            localHeaderChanges[newLoc.id] = newLoc
            return newLoc
        }
        let didProjectCountChange = false;
        let tasks: Promise<Header>[] = localCloudHeaders.map(async (local) => {
            // track the fact that we're checking for updates on each project
            updateCloudTempMetadata(local.id, { cloudInProgressSyncStartTime: U.nowSeconds() });

            const remote = remoteHeadersToProcess[local.id];
            delete remoteHeadersToProcess[local.id];
            if (remote) {
                local.cloudLastSyncTime = remote.cloudLastSyncTime
                // Note that we use modification time to detect differences. If we had full (or partial) history, we could
                //  use version numbers. However we cannot currently use etags since the Cosmos list operations
                //  don't return etags per-version. And because of how etags work, the record itself can never
                //  have the latest etag version.
                if (local.modificationTime !== remote.modificationTime || local.isDeleted !== remote.isDeleted) {
                    const projShorthand = `'${local.name}' (${local.id.substr(0, 5)}...)`;
                    const remoteFile = await getWithCacheAsync(local);
                    // delete always wins no matter what
                    if (local.isDeleted) {
                        // Mark remote copy as deleted.
                        pxt.debug(`Propegating ${projShorthand} delete to cloud.`)
                        const newHdr = await toCloud(local, remoteFile.version)
                        pxt.tickEvent(`identity.sync.localDeleteUpdatedCloud`)
                        return newHdr
                    }
                    if (remote.isDeleted) {
                        // Delete local copy.
                        pxt.debug(`Propegating ${projShorthand} delete from cloud.`)
                        const newHdr = await fromCloud(local, remoteFile);
                        didProjectCountChange = true;
                        pxt.tickEvent(`identity.sync.cloudDeleteUpdatedLocal`)
                        return newHdr
                    }
                    // if it's not a delete...
                    if (local.cloudCurrent) {
                        // No local changes, download latest.
                        const newHdr = await fromCloud(local, remoteFile);
                        pxt.tickEvent(`identity.sync.noConflict.localProjectUpdatedFromCloud`)
                        return newHdr
                    } else {
                        // Possible conflict.
                        const conflictStr = `conflict found for ${projShorthand}. Last cloud change was ${agoStr(remoteFile.header.modificationTime)} and last local change was ${agoStr(local.modificationTime)}.`
                        // last write wins.
                        if (local.modificationTime > remoteFile.header.modificationTime) {
                            if (local.cloudVersion === remoteFile.version) {
                                // local is one ahead, push as normal
                                pxt.debug(`local project '${local.name}' has changes that will be pushed to the cloud.`)
                                pxt.tickEvent(`identity.sync.noConflict.localProjectUpdatingToCloud`)
                            } else {
                                // conflict and local wins
                                // TODO: Pop a dialog and/or show the user a diff. Better yet, handle merges.
                                pxt.log(conflictStr + ' Local will overwrite cloud.')
                                pxt.tickEvent(`identity.sync.conflict.localOverwrittingCloud`)
                            }
                            return await toCloud(local, remoteFile.version);
                        } else {
                            // conflict and remote wins
                            // TODO: Pop a dialog and/or show the user a diff. Better yet, handle merges.
                            pxt.log(conflictStr + ' Cloud will overwrite local.')
                            pxt.tickEvent(`identity.sync.conflict.cloudOverwritingLocal`)
                            return await fromCloud(local, remoteFile);
                        }
                    }
                }
                return local // no changes
            } else if (!partialSync) {
                if (local.cloudVersion) {
                    pxt.debug(`Project ${local.id} incorrectly thinks it is synced to the cloud (ver: ${local.cloudVersion})`)
                    local.cloudVersion = null;
                    pxt.tickEvent(`identity.sync.incorrectlyVersionedLocalProjectPushedToCloud`)
                } else {
                    pxt.tickEvent(`identity.sync.orphanedLocalProjectPushedToCloud`)
                }
                // Local cloud synced project exists, but it didn't make it to the server,
                // so let's push it now.
                return await toCloud(local, null)
            }
            else {
                // no remote verison so nothing to do
                return local
            }
        });
        tasks = [...tasks, ...U.values(remoteHeadersToProcess).map(async (remote) => {
            // Project exists remotely and not locally, download it.
            const remoteFile = await getWithCacheAsync(remote);
            // TODO @darzu: woops.... something went off the rails here
            pxt.debug(`importing new cloud project '${remoteFile.header.name}' (${remoteFile.header.id})`)
            const res = await fromCloud(null, remoteFile)
            pxt.tickEvent(`identity.sync.importCloudProject`)
            didProjectCountChange = true;
            return res;
        })]
        tasks = tasks.map(async t => {
            const newHdr = await t
            // reset cloud state sync metadata if there is any
            if (getCloudTempMetadata(newHdr.id).cloudInProgressSyncStartTime > 0) {
                updateCloudTempMetadata(newHdr.id, { cloudInProgressSyncStartTime: 0 });
            }
            return newHdr;
        })
        await Promise.all(tasks);

        // sanity check: all cloud headers should have a new sync time
        const noCloudProjs = remoteHeaders.length === 0
        const cloudSyncSuccess = partialSync || noCloudProjs || workspace.getLastCloudSync() >= syncStart
        if (!cloudSyncSuccess) {
            U.assert(false, 'Cloud sync failed!');
        }

        const elapsed = U.nowSeconds() - syncStart;
        const localHeaderChangesList = U.values(localHeaderChanges)
        pxt.log(`Cloud sync finished after ${elapsed} seconds with ${localHeaderChangesList.length} local changes.`);
        pxt.tickEvent(`identity.sync.finished`, { elapsed })
        if (didProjectCountChange) {
            // headers are individually invalidated as they are synced, but if new projects come along we also need to
            // update the global headers list.
            // TODO @darzu: maybe causes crashes...
            // TODO @darzu: this isn't propegating to the home page list yet
            data.invalidate("headers:");
        }

        return localHeaderChangesList
    }
    catch (e) {
        pxt.reportException(e);
    }
    return [];
}

export function forceReloadForCloudSync() {
    // TODO: This is too heavy handed. We can be more fine grain here with some work.
    //  preferably with just the virtual data APIs we can push updates to the whole editor.
    core.infoNotification(lf("Cloud synchronization finished. Reloading... "));
    setTimeout(() => {
        pxt.log("Forcing reload.")
        pxt.tickEvent(`identity.sync.forcingReload`)
        location.reload();
    }, 3000);
}

export async function convertCloudToLocal(userId: string) {
    if (userId) {
        const localCloudHeaders = workspace.getHeaders(true)
            .filter(h => h.cloudUserId && h.cloudUserId === userId);
        const tasks: Promise<void>[] = [];
        localCloudHeaders.forEach((h) => {
            // Clear cloud header and re-save the header.
            delete h.cloudCurrent;
            delete h.cloudLastSyncTime;
            delete h.cloudUserId;
            delete h.cloudVersion;
            tasks.push(workspace.saveAsync(h, null, true));
        });
        await Promise.all(tasks);
    }
}

/**
 * Virtual API
 */

export const HEADER_CLOUDSTATE = "header-cloudstate"

function cloudHeaderMetadataHandler(p: string): any {
    p = data.stripProtocol(p)
    if (p == "*") return workspace.getHeaders().map(h => getCloudTempMetadata(h.id))
    return getCloudTempMetadata(p)
}

export function init() {
    data.mountVirtualApi(HEADER_CLOUDSTATE, { getSync: cloudHeaderMetadataHandler });
}

