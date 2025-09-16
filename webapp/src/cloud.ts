import * as core from "./core";
import * as auth from "./auth";
import * as data from "./data";
import * as workspace from "./workspace";
import * as app from "./app";

import * as pxteditor from "../../pxteditor";

type File = pxt.workspace.File;
type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;

import U = pxt.Util;

type CloudProject = {
    id: string;
    shareId?: string;
    header: string;
    text: string;
    version: string;
};

export interface SharedCloudProject extends CloudProject, pxt.Cloud.JsonScript {
    text: string;
}

class StatusCodeError extends Error {
    constructor(public statusCode: number, public message: string) {
        super(message);
    }
}

const localOnlyMetadataFields: (keyof Header)[] = [
    // different for different local storage instances
    '_rev', '_id' as keyof Header,
    // only for tracking local cloud sync state
    'cloudVersion', 'cloudCurrent', 'cloudLastSyncTime'
]
const cloudMetadataFields: (keyof Header)[] = [
    // cloud metadata fields
    'cloudVersion', 'cloudCurrent', 'cloudLastSyncTime', 'cloudUserId'
]

function excludeMetadataFields(h: Header, fields: (keyof Header)[]): Header {
    const clone = { ...h }
    for (let k of fields)
        delete clone[k]
    return clone
}

export function excludeLocalOnlyMetadataFields(h: Header): Header {
    return excludeMetadataFields(h, localOnlyMetadataFields);
}

export function excludeCloudMetadataFields(h: Header): Header {
    return excludeMetadataFields(h, cloudMetadataFields);
}

async function listAsync(hdrs?: Header[]): Promise<Header[]> {
    return new Promise(async (resolve, reject) => {
        const params: pxt.Map<string> = {};
        if (hdrs?.length) {
            params["projectIds"] = hdrs.map(h => h.id).join(",");
        }
        const url = pxt.Util.stringifyQueryString("/api/user/project", params);
        const result = await auth.apiAsync<CloudProject[]>(url);
        if (result.success) {
            const syncTime = U.nowSeconds()
            const userId = auth.userProfile()?.id;
            const headers: Header[] = result.resp.map(proj => {
                const rawHeader: pxt.workspace.Header = JSON.parse(proj.header);
                const header = excludeLocalOnlyMetadataFields(rawHeader)
                header.cloudUserId = userId;
                header.cloudCurrent = true;
                header.cloudLastSyncTime = syncTime
                header.cloudVersion = proj.version;
                return header;
            });
            pxt.tickEvent(`identity.cloudApi.list.success`, { count: headers.length });
            resolve(headers);
        } else {
            pxt.tickEvent(`identity.cloudApi.list.failed`);
            reject(result.err);
        }
    });
}

function getAsync(h: Header): Promise<File> {
    return new Promise(async (resolve, reject) => {
        const cloudMeta = getCloudTempMetadata(h.id);
        try {
            pxt.debug(`downloading from cloud: '${shortName(h)}`);
            cloudMeta.syncInProgress();
            const result = await auth.apiAsync<CloudProject>(`/api/user/project/${h.id}`);
            if (result.success) {
                const userId = auth.userProfile()?.id;
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
                pxt.tickEvent(`identity.cloudApi.getProject.success`);
                resolve(file);
            } else {
                pxt.tickEvent(`identity.cloudApi.getProject.failed`);
                reject(result.err);
            }
        } catch (e) {
            pxt.tickEvent(`identity.cloudApi.getProject.failed`);
            reject(e);
        } finally {
            cloudMeta.syncFinished();
        }
    });
}

export function shareAsync(id: string, scriptData: any): Promise<{ shareID: string, scr: SharedCloudProject }> {
    return new Promise(async (resolve, reject) => {
        const cloudMeta = getCloudTempMetadata(id);
        try {
            cloudMeta.syncInProgress();
            const result = await auth.apiAsync<{ shareID: string, scr: SharedCloudProject }>(
                `/api/user/project/share`,
                scriptData,
                "POST");
            if (result.success) {
                resolve(result.resp);
            } else {
                reject(result.err);
            }
        } finally {
            cloudMeta.syncFinished();
        }
    });
}

// temporary per-project cloud metadata is only kept in memory and shouldn't be persisted to storage.
export class CloudTempMetadata {
    constructor(public headerId: string) { }
    private _justSynced: boolean;
    private _syncStartTime: number;

    public get justSynced() { return this._justSynced; }

    public syncInProgress() {
        this._syncStartTime = U.nowSeconds();
        data.invalidate(`${HEADER_CLOUDSTATE}:${this.headerId}`);
    }

    public syncFinished() {
        this._syncStartTime = 0;
        this._justSynced = true;
        data.invalidate(`${HEADER_CLOUDSTATE}:${this.headerId}`);
        // slightly hacky, but we want to keep around a "saved!" message for a small time after
        // a save succeeds so we notify metadata subscribers again after a delay.
        setTimeout(() => {
            if (this._syncStartTime === 0) { // not currently syncing?
                this._justSynced = false;
                data.invalidate(`${HEADER_CLOUDSTATE}:${this.headerId}`);
            }
        }, 1500);
    }

    public cloudStatus(): pxt.cloud.CloudStatusInfo {
        const h = workspace.getHeader(this.headerId);
        if (!h || !h.cloudUserId)
            return undefined;
        if (!auth.loggedIn())
            return pxt.cloud.cloudStatus["offline"];
        if (this._syncStartTime > 0)
            return pxt.cloud.cloudStatus["syncing"];
        if (!h.cloudCurrent)
            return pxt.cloud.cloudStatus["localEdits"];
        if (this.justSynced)
            return pxt.cloud.cloudStatus["justSynced"];
        if (h.cloudLastSyncTime > 0)
            return pxt.cloud.cloudStatus["synced"];
        pxt.reportError("cloudsave", `Invalid project cloud state for project ${shortName(h)}: user: ${h.cloudUserId}, inProg: ${this._syncStartTime}, cloudCurr: ${h.cloudCurrent}, lastCloud: ${h.cloudLastSyncTime}`);
        return undefined;
    }
}
const temporaryHeaderMetadata: { [key: string]: CloudTempMetadata } = {};
export function getCloudTempMetadata(headerId: string): CloudTempMetadata {
    if (!temporaryHeaderMetadata[headerId]) {
        temporaryHeaderMetadata[headerId] = new CloudTempMetadata(headerId);
    }
    return temporaryHeaderMetadata[headerId];
}

type SetAsyncResult = {
    header: Header;
    status: "succeeded" | "failed" | "conflict";
}

function setAsync(h: Header, prevVersion: string, text?: ScriptText): Promise<SetAsyncResult> {
    return new Promise(async (resolve, reject) => {
        const cloudMeta = getCloudTempMetadata(h.id);
        try {
            pxt.debug(`uploading to cloud: ${shortName(h)}`);
            const userId = auth.userProfile()?.id;
            h.cloudUserId = userId;
            h.cloudCurrent = false;
            h.cloudVersion = prevVersion;
            cloudMeta.syncInProgress();
            const project: CloudProject = {
                id: h.id,
                header: JSON.stringify(excludeLocalOnlyMetadataFields(h)),
                text: text ? JSON.stringify(text) : undefined,
                version: prevVersion
            }
            const result = await auth.apiAsync<string>('/api/user/project', project);
            if (result.success) {
                h.cloudCurrent = true;
                h.cloudVersion = result.resp;
                h.cloudLastSyncTime = U.nowSeconds()
                pxt.tickEvent(`identity.cloudApi.setProject.success`);
                resolve({ header: h, status: "succeeded" });
            } else if (result.statusCode === 409) {
                // conflict
                pxt.tickEvent(`identity.cloudApi.setProject.conflict`);
                resolve({ header: h, status: "conflict" });
            } else {
                pxt.tickEvent(`identity.cloudApi.setProject.failed`);
                reject(result.err);
            }
        }
        finally {
            cloudMeta.syncFinished();
        }
    });
}

export type SyncAsyncOptions = {
    hdrs?: Header[],
    direction?: "up" | "down"
};

let inProgressSyncPromise: Promise<pxt.workspace.Header[]>;
export async function syncAsync(opts?: SyncAsyncOptions): Promise<pxt.workspace.Header[]> {
    if (!auth.hasIdentity()) { return []; }
    if (!auth.loggedIn()) { return []; }

    opts = opts ?? {};

    // ensure we don't run this twice
    if (!inProgressSyncPromise) {
        inProgressSyncPromise = syncAsyncInternal(opts).then(res => {
            return res;
        }).finally(() => {
            inProgressSyncPromise = undefined;
        });
    }
    return inProgressSyncPromise;
}

async function transferToCloud(local: Header, cloudVersion: string): Promise<SetAsyncResult> {
    const text = await workspace.getTextAsync(local.id);
    // since we just fetched the text from storage and we're about to make an update,
    //  we should acquire the current header session.
    workspace.acquireHeaderSession(local);
    const result = await setAsync(local, cloudVersion, text);
    if (result.status === "succeeded") {
        // save to the workspace header again to make sure cloud metadata gets saved
        await workspace.saveAsync(local, null, true)
        result.header = workspace.getHeader(local.id)
    } else {
        pxt.tickEvent("identity.toCloud.failed");
    }
    return result;
}

async function transferFromCloud(local: Header | null, remote: Header | null): Promise<Header> {
    if (local) {
        const newHeader = { ...local, ...remote }; // make sure we keep local-only metadata like _rev
        workspace.acquireHeaderSession(local);
        const remoteFile = await getAsync(local);
        await workspace.saveAsync(newHeader, remoteFile.text, true);
        return workspace.getHeader(newHeader.id);
    } else if (remote) {
        const newHeader = { ...remote };
        workspace.acquireHeaderSession(remote);
        const remoteFile = await getAsync(remote);
        await workspace.importAsync(newHeader, remoteFile.text, true)
        return workspace.getHeader(newHeader.id);
    } else {
        pxt.tickEvent("identity.fromCloud.failed");
        return undefined;
    }
}

function getConflictCopyName(hdr: Header): string {
    // TODO: do we want a better or more descriptive name?
    return hdr.name + lf(" - Copy");
}

async function resolveConflictAsync(local: Header, remote: Header | null) {
    pxt.debug(`cloud conflict detected for ${shortName(local)}`);
    // Strategy: resolve conflict by creating a copy
    // Note, we do the operations in the following order:
    // 1. create a local copy
    // 2. load that new local copy (if we're in the editor already)
    // 3. overwrite old local version with the new remote version
    // We want 2 to happen as quickly as possible so that the user is not seeing
    //  nor has any chance to edit the old conflicting copy. This minimizes the chances
    //  that the users creates additional conflicting changes.
    // Similarly, we also want 3 to happen soon so that the conflict is gone and the user can't make
    //  conflicting edits any more.
    // 1, 2, and 3 are local operations and should happen instantly.
    // Regarding failure modes:
    // if 1 fails, we can't do anything to resolve the conflict b/c local storage doesn't work apparently.
    // if 2 fails, we want to continue with at least 3 because those will resolve the conflict (and avoid future conflicts).
    //      hopefully 2 failing doesn't mean the user is still in the editor somewhere with a stale copy because that could reintroduce a conflict.
    // if 3 fails, we're in bad shape since the conflict is still around. There isn't a great way to recover here since we've already
    //      created a copy but apparently we can't change the original we had.
    //      Luckily, it's unlikely that 3 will fail if 1 succeeds since both are very similar local storage writes.

    // 1. copy local project as a new project
    // (let exceptions propagate and fail the whole function since we don't want to
    //  proceed if a basic duplicate operation fails.)
    const newName = getConflictCopyName(local);
    let newCopyHdr = await workspace.duplicateAsync(local, newName);
    pxt.tickEvent(`identity.sync.conflict.createdDuplicate`);
    let anyError = false;

    // 2. swap current project to the new copy
    try {
        if (app.hasEditor()) {
            const editor = await app.getEditorAsync();
            if (!editor.state.home && editor.state.header?.id === local.id) {
                await editor.loadHeaderAsync(newCopyHdr, editor.state.editorState, false);
            }
        }
    } catch (e) {
        // we want to swallow this and keep going since step 3. is the essential one to resolve the conflict.
        pxt.reportException(e);
        pxt.tickEvent(`identity.sync.conflict.reloadEditorFailed`, { exception: e });
        anyError = true;
    }

    // 3. overwrite local changes in the original project with cloud changes
    try {
        local = await transferFromCloud(local, remote);
    } catch (e) {
        // let exceptions propegate since there's nothing localy we can do to recover, but log something
        //  since this is a bad case (may lead to repeat duplication).
        pxt.reportException(e);
        pxt.tickEvent(`identity.sync.conflict.overwriteLocalFailed`, { exception: e });
        pxt.tickEvent(`identity.sync.conflict.failed`);
        throw e;
    }

    // 4. tell the user a conflict occured
    try {
        core.dialogAsync({
            header: lf("Project '{0}' had a conflict!", local.name),
            body:
                lf("Project '{0}' was edited in two places and the changes conflict. The changes on this computer have been saved to '{1}'. The changes made elsewhere remain in '{2}'.",
                    local.name, newCopyHdr.name, local.name),
            disagreeLbl: lf("Got it!"),
            disagreeClass: "green",
            hasCloseIcon: false,
        });
    } catch (e) {
        // we want to swallow this and keep going since it's non-essential
        pxt.reportException(e);
        anyError = true;
    }

    if (!anyError) {
        pxt.tickEvent(`identity.sync.conflict.success`);
    } else {
        pxt.tickEvent(`identity.sync.conflict.failed`);
    }
}

function getLocalCloudHeaders(allHdrs?: Header[]) {
    const userId = auth.userProfile()?.id;
    return (allHdrs || workspace.getHeaders(true/*withDeleted*/, false/*filterByEditor*/))
        .filter(h => h.cloudUserId && h.cloudUserId === userId);
}

async function syncAsyncInternal(opts: SyncAsyncOptions): Promise<pxt.workspace.Header[]> {
    try {
        const fullSync = !opts.hdrs;

        if (fullSync) {
            opts.hdrs = getLocalCloudHeaders();
        }

        pxt.debug(`Synchronizing ${opts.hdrs.length} local project(s) with the cloud...`);

        const localCloudHeaders = getLocalCloudHeaders(opts.hdrs);
        const syncStart = U.nowSeconds()
        pxt.tickEvent(`identity.sync.start`)
        const agoStr = (t: number) => `${syncStart - t} seconds ago`

        // Fetch all cloud headers (or just the ones we need to sync)
        const remoteHeaders = await listAsync(!fullSync ? opts.hdrs : undefined);

        const numDiff = remoteHeaders.length - localCloudHeaders.length
        if (numDiff !== 0) {
            pxt.debug(`${Math.abs(numDiff)} ${numDiff > 0 ? 'more' : 'fewer'} projects found in the cloud.`);
        }
        const lastCloudChange = remoteHeaders.length ? Math.max(...remoteHeaders.map(h => h.modificationTime)) : syncStart
        pxt.debug(`Last cloud project change was ${agoStr(lastCloudChange)}`);
        const remoteHeaderMap = U.toDictionary(remoteHeaders, h => h.id);
        const localHeaderChanges: pxt.Map<Header> = {}
        const toCloud = transferToCloud;
        const fromCloud = async (local: Header, remote: Header) => {
            const newLoc = await transferFromCloud(local, remote);
            if (newLoc) {
                localHeaderChanges[newLoc.id] = newLoc;
                return newLoc;
            }
            return undefined;
        }
        let errors: Error[] = [];

        async function syncOneUp(local: Header): Promise<void> {
            const projShorthand = shortName(local);
            try {
                if (!local.cloudCurrent) {
                    if (local.isDeleted) {
                        // Deleted local project, push to cloud
                        const res = await toCloud(local, null);
                        if (res.status !== "succeeded") {
                            throw new Error(`Failed to save deleted ${projShorthand} to the cloud.`)
                        }
                    }
                    else {
                        const remote = remoteHeaderMap[local.id];
                        if (!remote) {
                            // It's a new local project, push to cloud without etag
                            const res = await toCloud(local, null);
                            if (res.status !== "succeeded") {
                                pxt.tickEvent(`identity.sync.failed.localNewProjectSyncUpFailed`)
                                throw new Error(`Failed to save new ${projShorthand} to the cloud.`)
                            }
                        } else {
                            // It's an updated local project, push to cloud with etag
                            const result = await toCloud(local, local.cloudVersion);
                            if (result.status === "conflict") {
                                await resolveConflictAsync(local, remote);
                            } else if (result.status !== "succeeded") {
                                throw new Error(`Failed to save ${projShorthand} to the cloud.`)
                            }
                        }
                    }
                }
            } catch (e) {
                errors.push(e);
            }
        }

        async function syncOneDown(remote: Header): Promise<void> {
            if (!remote?.id) return;
            try {
                const projShorthand = shortName(remote);
                const local = workspace.getHeader(remote.id);
                if (!local) {
                    if (!remote.isDeleted) {
                        // Project exists remotely and not locally, download it.
                        const res = await fromCloud(local, remote);
                        if (!res) throw new Error(`Failed to import new cloud project ${projShorthand}`);
                    }
                } else {
                    if (local.cloudVersion !== remote.cloudVersion) {
                        if (!local.cloudCurrent) {
                            await resolveConflictAsync(local, remote);
                        } else {
                            const res = await fromCloud(local, remote);
                            if (!res) throw new Error(`Failed to download cloud project ${projShorthand}`);
                        }
                    }
                }
            } catch (e) {
                errors.push(e);
            }
        }

        const MAX_CONCURRENCY = 10;

        // Sync local changes to cloud
        if (!opts.direction || opts.direction === "up") {
            await U.promisePoolAsync(
                MAX_CONCURRENCY,
                localCloudHeaders,
                syncOneUp);
        }
        // Sync remote changes from cloud
        if (!opts.direction || opts.direction === "down") {
            await U.promisePoolAsync(
                MAX_CONCURRENCY,
                remoteHeaders,
                syncOneDown);
        }

        // log failed sync tasks.
        errors.forEach(err => pxt.debug(err));
        errors = [];

        const elapsed = U.nowSeconds() - syncStart;
        pxt.tickEvent(`identity.sync.finished`, { elapsed, provider: pxt.auth.identityProviderId(pxt.auth.cachedUserState?.profile) })

        data.invalidate("headers:");

        return U.values(localHeaderChanges);
    }
    catch (e) {
        pxt.reportException(e);
        pxt.tickEvent(`identity.sync.failed`, { exception: e });
    }
    return [];
}

export function forceReloadForCloudSync() {
    // TODO: This is too heavy handed. We can be more fine grain here with some work.
    //  preferably with just the virtual data APIs we can push updates to the whole editor.
    core.infoNotification(lf("Cloud synchronization finished. Reloading... "));
    setTimeout(() => {
        pxt.debug("cloud forcing reload.")
        pxt.tickEvent(`identity.sync.forcingReload`)
        location.reload();
    }, 3000);
}

export async function convertCloudToLocal(userId: string) {
    if (userId) {
        const localCloudHeaders = workspace
            .getHeaders(false/*withDeleted*/, false/*filterByEditorType*/, userId /*cloudUserIdOverride*/)
            .filter(h => h.cloudUserId && h.cloudUserId === userId);
        const tasks: Promise<void>[] = [];
        localCloudHeaders.forEach((h) => {
            // Clear cloud metadata and force-resave the header.
            h = excludeCloudMetadataFields(h);
            tasks.push(workspace.forceSaveAsync(h, null, true));
        });
        await Promise.all(tasks);
    }
}

export async function saveLocalProjectsToCloudAsync(headerIds: string[]) {
    const headers = workspace.getHeaders()
        .filter(h => h.cloudUserId == null)
        .filter(h => headerIds.includes(h.id));
    if (headers.length) {
        const guidMap: pxt.Map<string> = {};
        const newHeaders: Header[] = [];
        for (const h of headers) {
            const newHeader = await workspace.duplicateAsync(h, h.name);
            guidMap[h.id] = newHeader.id;
            newHeaders.push(newHeader);
        }
        await syncAsync({ hdrs: newHeaders, direction: "up" });
        return guidMap;
    }
    return undefined;
}

export async function requestProjectCloudStatus(headerIds: string[]): Promise<void> {
    for (const id of headerIds) {
        const cloudMd = getCloudTempMetadata(id);
        const cloudStatus = cloudMd.cloudStatus();

        const msg: pxt.editor.EditorMessageProjectCloudStatus = {
            type: "pxthost",
            action: "projectcloudstatus",
            headerId: cloudMd.headerId,
            status: cloudStatus.value
        };
        pxteditor.postHostMessageAsync(msg);

        // Deprecated: This was originally fired with the "pxteditor"
        // type, which should only be used for responses, not events.
        // Use the pxthost version above instead
        pxteditor.postHostMessageAsync({
            ...msg,
            type: "pxteditor"
        });
    }
}

const CLOUDSAVE_DEBOUNCE_MS = 3000;
const CLOUDSAVE_MAX_MS = 15000;
let headerWorklist: { [headerId: string]: boolean } = {};
let onHeaderChangeTimeout: number = 0;
let onHeaderChangeStarted: number = 0;
const onHeaderChangeSubscriber: data.DataSubscriber = {
    subscriptions: [],
    onDataChanged: (path: string) => {
        const parts = path.split("header:");
        U.assert(parts.length === 2, "onHeaderChangeSubscriber has invalid path subscription: " + path)
        const hdrId = parts[1];
        if (hdrId === "*") {
            // all headers
            // TODO https://github.com/microsoft/pxt-arcade/issues/3129: this branch is being hit WAY too often.
            getLocalCloudHeaders().forEach(h => onHeaderChangeDebouncer(h));
        } else {
            const hdr = workspace.getHeader(hdrId);
            if (!hdr) {
                pxt.debug("cannot find header with id: " + hdrId);
            } else {
                onHeaderChangeDebouncer(hdr);
            }
        }
    }
};

async function onHeaderChangeDebouncer(h: Header) {
    if (!auth.hasIdentity()) return
    if (!auth.loggedIn()) return

    // do we actually have a significant change?
    const hasCloudChange = h.cloudUserId === auth.userProfile()?.id && !h.cloudCurrent;
    if (!hasCloudChange)
        return;
    // is another tab responsible for this project?
    if (workspace.isHeaderSessionOutdated(h))
        return;

    // we have a change to sync
    headerWorklist[h.id] = true;
    clearTimeout(onHeaderChangeTimeout);
    const doAfter = async () => {
        onHeaderChangeStarted = 0;
        await onHeadersChanged();
    };

    // has it been longer than the max time?
    if (!onHeaderChangeStarted)
        onHeaderChangeStarted = U.now();
    if (CLOUDSAVE_MAX_MS < U.now() - onHeaderChangeStarted) {
        // save/sync now
        await doAfter()
    } else {
        // debounce
        onHeaderChangeTimeout = setTimeout(doAfter, CLOUDSAVE_DEBOUNCE_MS);
    }
}

async function onHeadersChanged(): Promise<void> {
    // wait on any already pending saves or syncs first
    try {
        await inProgressSyncPromise;
    } catch {
        // Rejected global promise. Reset it.
        inProgressSyncPromise = undefined;
    }

    const hdrs = getLocalCloudHeaders().filter(h => headerWorklist[h.id]);
    headerWorklist = {};

    syncAsync({ hdrs, direction: "up" });
}

function shortName(h: Header): string {
    return `'${h.name}' (${h.id.substr(0, 5)}...)`;
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
    // mount our virtual APIs
    data.mountVirtualApi(HEADER_CLOUDSTATE, { getSync: cloudHeaderMetadataHandler });

    // subscribe to header changes
    data.subscribe(onHeaderChangeSubscriber, "header:*");
}

/**
 * Copilot / AI Requests
 */
export async function aiErrorExplainRequest(
    code: string,
    errors: string,
    lang: "blocks" | "typescript" | "python",
    target: string,
    outputFormat: "tour_json" | "text",
    locale: string
): Promise<string | undefined> {
    const startUrl = `/api/copilot/startexplainerror`;
    const statusUrl = `/api/copilot/explainerrorstatus`;

    const data = { lang, code, errors, target, outputFormat, locale };

    // Start the request.
    const queryStart = await auth.apiAsync(startUrl, data, "POST");
    if (!queryStart.success) {
        throw new StatusCodeError(
            queryStart.statusCode,
            queryStart.err || `Unable to reach AI. Error: ${queryStart.statusCode}.\n${queryStart.err}`
        );
    }
    const resultId = queryStart.resp.resultId;

    // Poll until the request is complete (or timeout).
    const result = await pxt.Util.runWithBackoffAsync<pxt.auth.ApiResult<any>>(
        async () => {
            const response = await auth.apiAsync(statusUrl, { resultId }, "POST");
            if (!response.success) {
                throw new StatusCodeError(
                    response.statusCode,
                    response.err || `Unable to reach AI. Error: ${response.statusCode}.\n${response.err}`
                );
            }
            return response;
        },
        (statusResponse) => {
            // Expected states: "InProgress", "Success", "Failed"
            return statusResponse.resp?.state === "Success" || statusResponse.resp?.state === "Failed";
        },
        1000, // initial delay, 1 second
        10000, // max delay, 10 seconds
        90000, // timeout, 90 seconds
        "Timeout waiting for Explain Error response",
    );

    if (result.resp.state === "Failed") {
        // This shouldn't normally happen (backend will log errors and return 500, instead)
        // but handle it just in case.
        pxt.reportError("errorHelp", `"Error in response for Explain Error: ${JSON.stringify(result.resp)}`);
        throw new Error("Failure response from AI service");
    }

    return result.resp.data;
}

export async function getHowToResponse(
    goal: string,
    code: string,
    lang: "blocks" | "typescript" | "python",
    target: string,
    locale: string,
    blockData?: string
): Promise<string> {
    const url = `/api/copilot/howto`;

    const data = { lang, code, goal, target, locale, blockData };

    const response = await auth.apiAsync(url, data, "POST");
    if (!response.success) {
        throw new StatusCodeError(
            response.statusCode,
            response.err || `Unable to reach AI. Error: ${response.statusCode}.\n${response.err}`
        );
    }

    return response.resp;
}