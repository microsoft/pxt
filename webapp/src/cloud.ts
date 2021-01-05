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

async function listAsync(): Promise<Header[]> {
    return new Promise(async (resolve, reject) => {
        const result = await auth.apiAsync<CloudProject[]>("/api/user/project");
        if (result.success) {
            const userId = auth.user()?.id;
            const headers: Header[] = result.resp.map(proj => {
                const header = JSON.parse(proj.header);
                header.cloudUserId = userId;
                header.cloudVersion = proj.version;
                header.cloudCurrent = true;
                // TODO @darzu: is there a better place to do this?
                // browser db fields we don't want to propegate
                delete header._rev
                delete (header as any)._id
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
            const header = JSON.parse(project.header);
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
            // TODO @darzu: is there a better place to do this?
            // browser db fields we don't want to propegate
            delete file.header._rev
            delete (file.header as any)._id
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
        // TODO @darzu: is there a better place to do this?
        // browser db fields we don't want to propegate
        delete h._rev
        delete (h as any)._id
        const project: CloudProject = {
            id: h.id,
            header: JSON.stringify(h),
            text: text ? JSON.stringify(text) : undefined,
            version: prevVersion
        }
        const result = await auth.apiAsync<string>('/api/user/project', project);
        console.log("cloud:setAsync")
        console.dir(result) // TODO @darzu: dbg"
        if (result.success) {
            h.cloudCurrent = true;
            h.cloudVersion = result.resp;
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
        await syncAsyncInternal()
        // console.log(`INVALIDATING due to conflict: ${h.id}`) // TODO @darzu: dbg
        // data.invalidateHeader("header", h);
        // data.invalidateHeader("text", h);
        // data.invalidateHeader("pkg-git-status", h);
    }
}

function deleteAsync(h: Header, prevVersion: Version, text?: ScriptText): Promise<void> {
    return Promise.resolve();
}

function resetAsync(): Promise<void> {
    return Promise.resolve();
}

let _inProgressSyncAsync: Promise<any> = Promise.resolve()
export async function syncAsync(): Promise<any> {
    // ensure we don't run this twice at once
    if (_inProgressSyncAsync.isResolved()) {
        _inProgressSyncAsync = syncAsyncInternal()
    }
    return _inProgressSyncAsync
}

export async function syncAsyncInternal(): Promise<any> {
    if (!auth.hasIdentity()) { return; }
    if (!await auth.loggedIn()) { return; }
    try {
        const userId = auth.user()?.id;
        // Filter to cloud-synced headers owned by the current user.
        const localCloudHeaders = workspace.getHeaders(true)
            .filter(h => h.cloudUserId && h.cloudUserId === userId);
        const remoteHeaders = await listAsync();
        console.log("REMOTE") // TODO @darzu: dbg
        console.dir(remoteHeaders)
        const remoteHeaderMap = U.toDictionary(remoteHeaders, h => h.id);
        const localHeaderChanges: pxt.Map<Header> = {}
        let tasks = localCloudHeaders.map(async (local) => {
            const remote = remoteHeaderMap[local.id];
            delete remoteHeaderMap[local.id];
            if (remote) {
                if (local.cloudVersion !== remote.cloudVersion) {
                    if (local.cloudCurrent) {
                        // No local changes, download latest.
                        const remoteFile = await getAsync(local);
                        // TODO @darzu: pass isCloud ?
                        console.log("cloud:syncAsync:saveAsync (1)") // TODO @darzu: dbg
                        localHeaderChanges[remoteFile.header.id] = remoteFile.header
                        workspace.saveAsync(remoteFile.header, remoteFile.text, true);
                    } else {
                        // Conflict.
                        // TODO: Figure out how to register these.
                        // last write wins.
                        if (local.modificationTime > remote.modificationTime) {
                            console.log(`CONFLCIT; local wins ${local.id};`) // TODO @darzu: dbg
                            // local wins
                            const text = await workspace.getTextAsync(local.id);
                            return setAsync(local, remote.cloudVersion, text);
                        } else {
                            console.log(`CONFLCIT; remote wins ${remote.id};`) // TODO @darzu: dbg
                            // remote wins
                            const remoteFile = await getAsync(local);
                            localHeaderChanges[remoteFile.header.id] = remoteFile.header
                            return workspace.saveAsync(remoteFile.header, remoteFile.text, true);
                        }
                    }
                } else {
                    if (local.isDeleted) {
                        // Delete remote copy.
                        //return deleteAsync(local, local.cloudVersion);
                        // Mark remote copy as deleted.
                        remote.isDeleted = true;
                        return setAsync(remote, null, {});
                    }
                    if (remote.isDeleted) {
                        // Delete local copy.
                        local.isDeleted = true;
                        console.log("cloud:syncAsync:saveAsync (2)") // TODO @darzu: dbg
                        localHeaderChanges[local.id] = local
                        return workspace.forceSaveAsync(local, {}, true)
                            .then(() => { data.clearCache(); })
                    }
                    if (!local.cloudCurrent) {
                        // Local changes need to be synced up.
                        const text = await workspace.getTextAsync(local.id);
                        return setAsync(local, local.cloudVersion, text);
                    }
                    // Nothing to do. We're up to date locally.
                    return Promise.resolve();
                }
            } else {
                // Local cloud synced project exists, but it didn't make it to the server,
                // so let's push it now.
                const text = await workspace.getTextAsync(local.id)
                return setAsync(local, null, text);
                // TODO @darzu: previously Eric thought we should delete the project locally. Which is correct?
                // delete local.cloudUserId;
                // delete local.cloudVersion;
                // delete local.cloudCurrent;
                // console.log("cloud:syncAsync:saveAsync (3)") // TODO @darzu: dbg
                // return workspace.forceSaveAsync(local);
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

        console.log("done with cloud:syncAsync tasks") // TODO @darzu: dbg

        // notify the rest of the system
        // TODO @darzu: should we do this here or in workspace.ts?
        for (let hdr of U.values(localHeaderChanges)) {
            console.log(`INVALIDATING: ${hdr.id}`) // TODO @darzu: dbg
            data.invalidateHeader("header", hdr);
            data.invalidateHeader("text", hdr);
            data.invalidateHeader("pkg-git-status", hdr);
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
