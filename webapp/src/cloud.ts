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
            const headers = result.resp.map(proj => {
                const header = JSON.parse(proj.header);
                header.cloudUserId = userId;
                header.cloudVersion = proj.version;
                header.cloudCurrent = true;
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
            resolve(file);
        } else {
            reject(new Error(result.errmsg));
        }
    });
}

// TODO @darzu: is it okay to export this?
export function setAsync(h: Header, prevVersion: Version, text?: ScriptText): Promise<Version> {
    return new Promise(async (resolve, reject) => {
        const userId = auth.user()?.id;
        h.cloudUserId = userId;
        h.cloudCurrent = false;
        h.cloudVersion = prevVersion;
        const project: CloudProject = {
            id: h.id,
            header: JSON.stringify(h),
            text: text ? JSON.stringify(text) : undefined,
            version: prevVersion
        }
        const result = await auth.apiAsync<string>('/api/user/project', project);
        if (result.success) {
            h.cloudCurrent = true;
            h.cloudVersion = result.resp;
            resolve(result.resp);
        } else {
            // TODO: Handle reject due to version conflict
            reject(new Error(result.errmsg));
        }
    });
}

function deleteAsync(h: Header, prevVersion: Version, text?: ScriptText): Promise<void> {
    return Promise.resolve();
}

function resetAsync(): Promise<void> {
    return Promise.resolve();
}

export async function syncAsync(): Promise<any> {
    if (!auth.hasIdentity()) { return; }
    if (!await auth.loggedIn()) { return; }
    try {
        const userId = auth.user()?.id;
        // Filter to cloud-synced headers owned by the current user.
        const localCloudHeaders = workspace.getHeaders(true)
            .filter(h => h.cloudUserId && h.cloudUserId === userId);
        const remoteHeaders = await listAsync();
        const remoteHeaderMap = U.toDictionary(remoteHeaders, h => h.id);
        const tasks = localCloudHeaders.map(async (local) => {
            const remote = remoteHeaderMap[local.id];
            delete remoteHeaderMap[local.id];
            if (remote) {
                if (local.cloudVersion !== remote.cloudVersion) {
                    if (local.cloudCurrent) {
                        // No local changes, download latest.
                        const file = await getAsync(local);
                        workspace.saveAsync(file.header, file.text, file.version);
                    } else {
                        // Conflict.
                        // TODO: Figure out how to register these.
                        return Promise.resolve();
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
                        return workspace.forceSaveAsync(local, {})
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
                // Anomaly. Local cloud synced project exists, but no record of
                // it on remote. We cannot know if there's a conflict. Convert
                // to a local project.
                delete local.cloudUserId;
                delete local.cloudVersion;
                delete local.cloudCurrent;
                return workspace.saveAsync(local);
            }
        });
        remoteHeaders.forEach(async (remote) => {
            if (remoteHeaderMap[remote.id]) {
                // Project exists remotely and not locally, download it.
                const file = await getAsync(remote);
                tasks.push(workspace.importAsync(file.header, file.text));
            }
        })
        await Promise.all(tasks);
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
