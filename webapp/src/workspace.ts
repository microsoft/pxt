/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />
/// <reference path="../../built/pxtwinrt.d.ts" />

import * as db from "./db";
import * as core from "./core";
import * as data from "./data";
import * as cloudworkspace from "./cloudworkspace"
import * as fileworkspace from "./fileworkspace"
import * as memoryworkspace from "./memoryworkspace"
import * as iframeworkspace from "./iframeworkspace"
import * as cloudsync from "./cloudsync"

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type InstallHeader = pxt.workspace.InstallHeader;

let scripts = new db.Table("script")

import U = pxt.Util;
import Cloud = pxt.Cloud;

let impl: WorkspaceProvider;

export function setupWorkspace(id: string) {
    U.assert(!impl, "workspace set twice");
    pxt.debug(`workspace: ${id}`);
    switch (id) {
        case "fs":
        case "file":
            impl = fileworkspace.provider;
            break;
        case "mem":
        case "memory":
            impl = memoryworkspace.provider;
            break;
        case "iframe":
            impl = iframeworkspace.provider;
            break;
        case "uwp":
            impl = data.wrapWorkspace(pxt.winrt.workspace.provider);
            break;
        case "cloud":
        default:
            impl = cloudworkspace.provider
            break;
    }

    cloudsync.setup(impl)
}

export function getHeaders(withDeleted = false) {
    checkSession();

    let r = impl.getHeaders()
    if (!withDeleted)
        r = r.filter(r => !r.isDeleted)
    r.sort((a, b) => b.recentUse - a.recentUse)
    return r
}

export function getHeader(id: string) {
    checkSession();

    let hd = impl.getHeader(id)
    if (hd && !hd.isDeleted)
        return hd
    return null
}

let sessionID: string;
export function isSessionOutdated() {
    return pxt.storage.getLocal('pxt_workspace_session_id') != sessionID;
}
function checkSession() {
    if (isSessionOutdated()) {
        pxt.Util.assert(false, "trying to access outdated session")
    }
}

export function initAsync() {
    if (!impl) impl = cloudworkspace.provider;

    // generate new workspace session id to avoid races with other tabs
    sessionID = ts.pxtc.Util.guidGen();
    pxt.storage.setLocal('pxt_workspace_session_id', sessionID);
    pxt.debug(`workspace session: ${sessionID}`);

    return impl.initAsync(pxt.appTarget.id, pxt.appTarget.versions.target)
}

export function getTextAsync(id: string): Promise<ScriptText> {
    checkSession();
    return impl.getTextAsync(id);
}

export interface ScriptMeta {
    description: string;
    blocksWidth?: number;
    blocksHeight?: number;
}

// https://github.com/Microsoft/pxt-backend/blob/master/docs/sharing.md#anonymous-publishing
export function anonymousPublishAsync(h: Header, text: ScriptText, meta: ScriptMeta) {
    const saveId = {}
    h.saveId = saveId
    const stext = JSON.stringify(text, null, 2) + "\n"
    const scrReq = {
        name: h.name,
        target: h.target,
        targetVersion: h.targetVersion,
        description: meta.description,
        editor: h.editor,
        text: text,
        meta: {
            versions: pxt.appTarget.versions,
            blocksHeight: meta.blocksHeight,
            blocksWidth: meta.blocksWidth
        }
    }
    pxt.debug(`publishing script; ${stext.length} bytes`)
    return Cloud.privatePostAsync("scripts", scrReq, /* forceLiveEndpoint */ true)
        .then((inf: Cloud.JsonScript) => {
            if (inf.shortid) inf.id = inf.shortid;
            h.pubId = inf.shortid
            h.pubCurrent = h.saveId === saveId
            h.meta = inf.meta;
            pxt.debug(`published; id /${h.pubId}`)
            return saveAsync(h)
                .then(() => inf)
        })
}

export function saveAsync(h: Header, text?: ScriptText) {
    checkSession();
    U.assert(h.target == pxt.appTarget.id);
    if (text || h.isDeleted) {
        h.pubCurrent = false
        h.blobCurrent = false
        h.modificationTime = U.nowSeconds();
    }
    h.recentUse = U.nowSeconds();
    // update version on save    
    h.targetVersion = pxt.appTarget.versions.target;
    return impl.saveAsync(h, text)
}

export function installAsync(h0: InstallHeader, text: ScriptText) {
    checkSession();
    U.assert(h0.target == pxt.appTarget.id);

    const h = <Header>h0
    h.id = ts.pxtc.Util.guidGen();
    h.recentUse = U.nowSeconds()
    h.modificationTime = h.recentUse;

    return impl.importAsync(h, text)
        .then(() => h)
}

export function saveScreenshotAsync(h: Header, data: string, icon: string) {
    checkSession();
    return impl.saveScreenshotAsync
        ? impl.saveScreenshotAsync(h, data, icon)
        : Promise.resolve();
}

export function fixupFileNames(txt: ScriptText) {
    if (!txt) return txt;
    ["kind.json", "yelm.json"].forEach(oldName => {
        if (!txt[pxt.CONFIG_NAME] && txt[oldName]) {
            txt[pxt.CONFIG_NAME] = txt[oldName]
            delete txt[oldName]
        }
    })
    return txt
}


let scriptDlQ = new U.PromiseQueue();
//let scriptCache:any = {}
export function getPublishedScriptAsync(id: string) {
    checkSession();
    //if (scriptCache.hasOwnProperty(id)) return Promise.resolve(scriptCache[id])
    if (pxt.github.isGithubId(id))
        id = pxt.github.noramlizeRepoId(id)
    let eid = encodeURIComponent(id)
    return pxt.packagesConfigAsync()
        .then(config => scriptDlQ.enqueue(id, () => scripts.getAsync(eid)
            .then(v => v.files, e =>
                (pxt.github.isGithubId(id) ?
                    pxt.github.downloadPackageAsync(id, config).then(v => v.files) :
                    Cloud.downloadScriptFilesAsync(id))
                    .catch(core.handleNetworkError)
                    .then(files => scripts.setAsync({ id: eid, files: files })
                        .then(() => {
                            //return (scriptCache[id] = files)
                            return files
                        })))
            .then(fixupFileNames))
        );
}

export function installByIdAsync(id: string) {
    return Cloud.privateGetAsync(id, /* forceLiveEndpoint */ true)
        .then((scr: Cloud.JsonScript) =>
            getPublishedScriptAsync(scr.id)
                .then(files => installAsync(
                    {
                        name: scr.name,
                        pubId: id,
                        pubCurrent: true,
                        meta: scr.meta,
                        editor: scr.editor,
                        target: scr.target,
                        targetVersion: scr.targetVersion
                    }, files)))
}

export function saveToCloudAsync(h: Header) {
    checkSession();
    return impl.saveToCloudAsync(h)
        .then(() => cloudsync.saveToCloudAsync(h))
}

export function syncAsync(): Promise<pxt.editor.EditorSyncState> {
    checkSession();
    return impl.syncAsync()
        .then(cloudsync.syncAsync)
}

export function resetAsync() {
    checkSession();
    return impl.resetAsync()
        .then(cloudsync.resetAsync)
}

export function loadedAsync() {
    checkSession();
    return impl.loadedAsync();
}

export function saveAssetAsync(id: string, filename: string, data: Uint8Array): Promise<void> {
    if (impl.saveAssetAsync)
        return impl.saveAssetAsync(id, filename, data)
    else
        return Promise.reject(new Error(lf("Assets not supported here.")))
}

export function listAssetsAsync(id: string): Promise<pxt.workspace.Asset[]> {
    if (impl.listAssetsAsync)
        return impl.listAssetsAsync(id)
    return Promise.resolve([])
}


/*
    header:<guid>   - one header
    header:*        - all headers
*/

data.mountVirtualApi("header", {
    getSync: p => {
        p = data.stripProtocol(p)
        if (p == "*") return getHeaders()
        return getHeader(p)
    },
})

/*
    text:<guid>            - all files
    text:<guid>/<filename> - one file
*/
data.mountVirtualApi("text", {
    getAsync: p => {
        let m = /^[\w\-]+:([^\/]+)(\/(.*))?/.exec(p)
        return getTextAsync(m[1])
            .then(files => {
                if (m[3])
                    return files[m[3]]
                else return files;
            })
    },
})
