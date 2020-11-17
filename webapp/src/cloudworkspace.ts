import * as core from "./core";
import * as auth from "./auth";
import * as ws from "./workspace";
import * as data from "./data";
import * as workspace from "./workspace";

type Version = pxt.workspace.Version;
type File = pxt.workspace.File;
type Header = pxt.workspace.Header;
type Project = pxt.workspace.Project;
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

function listAsync(): Promise<Header[]> {
    return new Promise(async (resolve, reject) => {
        const result = await auth.apiAsync<CloudProject[]>("/api/user/project");
        if (result.success) {
            const headers = result.resp.map(proj => JSON.parse(proj.header));
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
            const project = result.resp;
            const header = JSON.parse(project.header);
            const text = JSON.parse(project.text);
            const version = project.version;
            const file: File = {
                header,
                text,
                version
            };
            resolve(file);
        } else {
            reject(new Error(result.errmsg));
        }
    });
}

function setAsync(h: Header, prevVersion: Version, text?: ScriptText): Promise<Version> {
    return new Promise(async (resolve, reject) => {
        const project: CloudProject = {
            id: h.id,
            header: JSON.stringify(h),
            text: text ? JSON.stringify(text) : undefined,
            version: prevVersion
        }
        const result = await auth.apiAsync<string>('/api/user/project', project);
        if (result.success) {
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

export const provider: WorkspaceProvider = {
    getAsync,
    setAsync,
    deleteAsync,
    listAsync,
    resetAsync,
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
    data.subscribe(userSubscriber, auth.LOGGED_IN);
}

let prevWorkspaceType: string;

async function updateWorkspace() {
    const loggedIn = await auth.loggedIn();
    if (loggedIn) {
        // TODO: Handling of 'prev' is pretty hacky. Need to improve it.
        let prev = workspace.switchToCloudWorkspace();
        if (prev !== "cloud") {
            prevWorkspaceType = prev;
        }
        await workspace.syncAsync();
    } else if (prevWorkspaceType) {
        workspace.switchToWorkspace(prevWorkspaceType);
        await workspace.syncAsync();
    }
}

const userSubscriber: data.DataSubscriber = {
    subscriptions: [],
    onDataChanged: async () => updateWorkspace()
};
