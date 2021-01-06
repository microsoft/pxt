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

const state = {
    uploadCount: 0,
    downloadCount: 0
};

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
function excludeLocalOnlyMetadataFields(h: Header): Header {
    const clone = {...h}
    for (let k of localOnlyMetadataFields)
        delete clone[k]
    return clone
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
            console.log("cloud:listAsync")
            console.dir(headers.map(h => ({id: h.id, mod: h.recentUse, del: h.isDeleted}))) // TODO @darzu: dbg
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
            console.log("cloud:getAsync")
            console.dir(file.header) // TODO @darzu: dbg
            resolve(file);
        } else {
            reject(new Error(result.errmsg));
        }
    });
}

function setAsync(h: Header, prevVersion: Version, text?: ScriptText): Promise<Version> {
    return new Promise(async (resolve, reject) => {
        const userId = auth.user()?.id;
        h.cloudUserId = userId;
        h.cloudCurrent = false;
        h.cloudVersion = prevVersion;
        const project: CloudProject = {
            id: h.id,
            header: JSON.stringify(excludeLocalOnlyMetadataFields(h)),
            text: text ? JSON.stringify(text) : undefined,
            version: prevVersion
        }
        const result = await auth.apiAsync<string>('/api/user/project', project);
        console.log("cloud:setAsync")
        console.dir(result) // TODO @darzu: dbg"
        if (result.success) {
            h.cloudCurrent = true;
            h.cloudVersion = result.resp;
            h.cloudLastSyncTime = U.nowSeconds()
            resolve(result.resp);
        } else if (result.statusCode === 409) {
            // conflict
            resolve(undefined)
        } else {
            // TODO: Handle reject due to version conflict
            reject(new Error(result.errmsg));
        }
    });
}

export async function saveAsync(h: Header, text?: ScriptText): Promise<void> {
    if (!auth.hasIdentity()) { return; }
    if (!await auth.loggedIn()) { return; }
    // TODO @darzu: do we want to make callees responsible for tracking e-tags?
    // TODO @darzu: put this in a queue?
    const res = await setAsync(h, h.cloudVersion, text)
    if (!res) {
        // wait to synchronize
        pxt.debug('save to cloud failed; synchronizing...')
        await syncAsync()
        // console.log(`INVALIDATING due to conflict: ${h.id}`) // TODO @darzu: dbg
        // data.invalidateHeader("header", h);
        // data.invalidateHeader("text", h);
        // data.invalidateHeader("pkg-git-status", h);
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
export async function syncAsync(): Promise<any> {
    // ensure we don't run this twice
    if (_inProgressSyncAsync.isResolved()) {
        _inProgressSyncAsync = syncAsyncInternal()
    }
    return _inProgressSyncAsync
}

async function syncAsyncInternal(): Promise<any> {
    if (!auth.hasIdentity()) { return; }
    if (!await auth.loggedIn()) { return; }
    try {
        pxt.log("Synchronizing with the cloud...")
        const userId = auth.user()?.id;
        // Filter to cloud-synced headers owned by the current user.
        const localCloudHeaders = workspace.getHeaders(true)
            .filter(h => h.cloudUserId && h.cloudUserId === userId);
        const syncStart = U.nowSeconds()
        const agoStr = (t: number) => `${syncStart - t} seconds ago`
        const remoteHeaders = await listAsync();
        const numDiff = remoteHeaders.length - localCloudHeaders.length
        if (numDiff !== 0) {
            pxt.log(`${Math.abs(numDiff)} ${numDiff > 0 ? 'more' : 'fewer'} projects found in the cloud.`);
        }
        const lastCloudChange = Math.max(...remoteHeaders.map(h => h.modificationTime))
        pxt.log(`Last cloud project change was ${agoStr(lastCloudChange)}`);
        console.log("REMOTE") // TODO @darzu: dbg
        console.dir(remoteHeaders)
        const remoteHeaderMap = U.toDictionary(remoteHeaders, h => h.id);
        const localHeaderChanges: pxt.Map<Header> = {}
        let tasks = localCloudHeaders.map(async (local) => {
            const remote = remoteHeaderMap[local.id];
            delete remoteHeaderMap[local.id];
            if (remote) {
                local.cloudLastSyncTime = remote.cloudLastSyncTime
                // Note that we use modification time to detect differences. If we had full (or partial) history, we could
                //  use version numbers. However we cannot currently use etags since the Cosmos list operations
                //  don't return etags per-version. And because of how etags work, the record itself can never
                //  have the latest etag version.
                if (local.modificationTime !== remote.modificationTime) {
                    const remoteFile = await getAsync(local);
                    if (local.cloudCurrent) {
                        // No local changes, download latest.
                        console.log(`remote has new changes ${local.id}`) // TODO @darzu: dbg
                        // TODO @darzu: pass isCloud ?
                        console.log("cloud:syncAsync:saveAsync (1)") // TODO @darzu: dbg
                        const newHeader = {...local, ...remoteFile.header} // make sure we keep local-only metadata like _rev
                        localHeaderChanges[remoteFile.header.id] = newHeader
                        await workspace.saveAsync(newHeader, remoteFile.text, true);
                    } else {
                        // Possible conflict.
                        const conflictStr = `conflict found for '${local.name}' (${local.id.substr(0, 5)}...). Last cloud change was ${agoStr(remoteFile.header.modificationTime)} and last local change was ${agoStr(local.modificationTime)}.`
                        // last write wins.
                        if (local.modificationTime > remoteFile.header.modificationTime) {
                            if (local.cloudVersion === remoteFile.version) {
                                // local is one ahead, push as normal
                                pxt.debug(`local project '${local.name}' has changes that will be pushed to the cloud.`)
                            } else {
                                // conflict and local wins
                                // TODO: Pop a dialog and/or show the user a diff. Better yet, handle merges.
                                pxt.log(conflictStr + ' Local will overwrite cloud.')
                            }
                            const text = await workspace.getTextAsync(local.id);
                            const newVer = await setAsync(local, remoteFile.version, text);
                            U.assert(!!newVer, 'Failed to sync local change (1)') // TODO @darzu: dbg
                            // save to the workspace header again to make sure cloud metadata gets saved
                            await workspace.saveAsync(local, null, true)
                        } else {
                            // conflict and remote wins
                            // TODO: Pop a dialog and/or show the user a diff. Better yet, handle merges.
                            pxt.log(conflictStr + ' Cloud will overwrite local.')
                            const newHeader = {...local, ...remoteFile.header} // make sure we keep local-only metadata like _rev
                            localHeaderChanges[remoteFile.header.id] = newHeader
                            const localVer = await workspace.saveAsync(newHeader, remoteFile.text, true);
                        }
                    }
                } else {
                    if (local.isDeleted) {
                        // Delete remote copy.
                        //return deleteAsync(local, local.cloudVersion);
                        // Mark remote copy as deleted.
                        remote.isDeleted = true;
                        const newVer = await setAsync(remote, local.cloudVersion, {});
                        const newHeader = {...local, ...remote} // make sure we keep local-only metadata like _rev
                        await workspace.saveAsync(newHeader, null, true);
                        U.assert(!!newVer, 'Failed to sync local change (3)') // TODO @darzu: dbg
                    }
                    if (remote.isDeleted) {
                        // Delete local copy.
                        local.isDeleted = true;
                        console.log("cloud:syncAsync:saveAsync (2)") // TODO @darzu: dbg
                        localHeaderChanges[local.id] = local
                        return workspace.forceSaveAsync(local, {}, true)
                            .then(() => { data.clearCache(); }) // TODO @darzu: is this cache clear necessary?
                    }
                    // Nothing to do. We're up to date locally.
                    return Promise.resolve();
                }
            } else {
                if (local.cloudVersion) {
                    // TODO @darzu: should we abort? should we try to fix things?
                    console.log(`Project ${local.id} incorrectly thinks it is synced to the cloud (ver: ${local.cloudVersion})`) // TODO @darzu: dbg
                    return Promise.resolve()
                }
                // Local cloud synced project exists, but it didn't make it to the server,
                // so let's push it now.
                const text = await workspace.getTextAsync(local.id)
                const newVer = await setAsync(local, local.cloudVersion, text);
                U.assert(!!newVer, 'Failed to sync local change (4)') // TODO @darzu: dbg
                const newHeader = {...local, ...remote} // make sure we keep local-only metadata like _rev
                await workspace.saveAsync(newHeader, null, true);

                // TODO @darzu: previously Eric thought we should delete the project locally. Which is correct?
                // // Anomaly. Local cloud synced project exists, but no record of
                //  // it on remote. We cannot know if there's a conflict. Convert
                //  // to a local project.
                //  delete local.cloudUserId;
                //  delete local.cloudVersion;
                //  delete local.cloudCurrent;
                //  return workspace.saveAsync(local);
            }
        });
        tasks = [...tasks, ...remoteHeaders.map(async (remote) => {
            if (remoteHeaderMap[remote.id]) {
                // Project exists remotely and not locally, download it.
                const file = await getAsync(remote);
                localHeaderChanges[file.header.id] = file.header
                console.log(`cloud->local import: ${file.header.id}`) // TODO @darzu: dbg
                return workspace.importAsync(file.header, file.text, true)
            }
        })]
        await Promise.all(tasks);

        // sanity check: all cloud headers should have a new sync time
        U.assert(workspace.getLastCloudSync() >= syncStart, 'Cloud sync failed!');

        console.log("done with cloud:syncAsync tasks") // TODO @darzu: dbg

        // TODO @darzu: too heavy handed? maybe only reload if the current editor is out of date
        if (U.values(localHeaderChanges).length) {
            core.infoNotification(lf("Cloud synchronization finished. Reloading... "));
            setTimeout(() => {
                // TODO @darzu: tick event
                console.log("FORCE RELOAD") // TODO @darzu: dbg
                location.reload();
            }, 3000);
        }
    }
    catch (e) {
        pxt.reportException(e);
    }
}

/**
 * Virtual API
 */

const MODULE = "cloud";
const FIELD_UPLOADING = "uploading";
const FIELD_DOWNLOADING = "downloading";
const FIELD_WORKING = "working";
export const UPLOADING = `${MODULE}:${FIELD_UPLOADING}`;
export const DOWNLOADING = `${MODULE}:${FIELD_DOWNLOADING}`;
export const WORKING = `${MODULE}:${FIELD_WORKING}`;

function cloudApiHandler(p: string): any {
    switch (data.stripProtocol(p)) {
        case FIELD_UPLOADING: return state.uploadCount > 0;
        case FIELD_DOWNLOADING: return state.downloadCount > 0;
        case WORKING: return cloudApiHandler(UPLOADING) || cloudApiHandler(DOWNLOADING);
    }
    return null;
}

export function init() {
    // 'cloudws' because 'cloud' protocol is already taken.
    data.mountVirtualApi("cloudws", { getSync: cloudApiHandler });
}
