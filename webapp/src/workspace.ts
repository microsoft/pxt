/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />

import * as db from "./db";
import * as core from "./core";
import * as pkg from "./package";
import * as data from "./data";
import * as cloudworkspace from "./cloudworkspace"
import * as fileworkspace from "./fileworkspace"
import * as memoryworkspace from "./memoryworkspace"

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type InstallHeader = pxt.workspace.InstallHeader;

let scripts = new db.Table("script")

import U = pxt.Util;
import Cloud = pxt.Cloud;
let lf = U.lf


let impl: WorkspaceProvider;

export function setupWorkspace(id: string) {
    switch (id) {
        case "fs":
        case "file":
            impl = fileworkspace.provider;
            break;
        case "mem":
        case "memory":
            impl = memoryworkspace.provider;
            break;
        case "cloud":
        default:
            impl = cloudworkspace.provider
            break;
    }
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
        Util.assert(false, "trying to access outdated session")
    }
}

export function initAsync() {
    if (!impl) impl = cloudworkspace.provider;

    // generate new workspace session id to avoid races with other tabs
    sessionID = Util.guidGen();
    pxt.storage.setLocal('pxt_workspace_session_id', sessionID);
    pxt.debug(`workspace session: ${sessionID}`);

    return impl.initAsync(pxt.appTarget.id)
}

export function getTextAsync(id: string): Promise<ScriptText> {
    checkSession();
    return impl.getTextAsync(id);
}

export interface ScriptMeta {
    description: string;
    islibrary: boolean;
    blocksWidth?: number;
    blocksHeight?: number;
}

export function publishAsync(h: Header, text: ScriptText, meta: ScriptMeta) {
    let saveId = {}
    h.saveId = saveId
    let stext = JSON.stringify(text, null, 2) + "\n"
    let scrReq = {
        baseid: h.pubId,
        name: h.name,
        description: meta.description,
        islibrary: meta.islibrary,
        ishidden: false,
        userplatform: ["pxt-web"],
        target: h.target,
        editor: h.editor,
        text: stext,
        meta: {
            blocksHeight: meta.blocksHeight,
            blocksWidth: meta.blocksWidth
        }
    }
    pxt.debug(`publishing script; ${stext.length} bytes`)
    return Cloud.privatePostAsync("scripts", scrReq)
        .then((inf: Cloud.JsonScript) => {
            h.pubId = inf.id
            h.pubCurrent = h.saveId === saveId
            h.meta = inf.meta;
            pxt.debug(`published; id /${inf.id}`)
            return saveAsync(h)
                .then(() => inf)
        })
}

export function saveAsync(h: Header, text?: ScriptText) {
    checkSession();
    if (text || h.isDeleted) {
        h.pubCurrent = false
        h.blobCurrent = false
        h.modificationTime = U.nowSeconds();
    }
    h.recentUse = U.nowSeconds();
    return impl.saveAsync(h, text)
}

export function installAsync(h0: InstallHeader, text: ScriptText) {
    checkSession();
    return impl.installAsync(h0, text)
}

export function saveScreenshotAsync(h: Header, data: string, icon: string) {
    checkSession();
    return impl.saveScreenshotAsync
        ? impl.saveScreenshotAsync(h, data, icon)
        : Promise.resolve();
}

export function fixupFileNames(txt: ScriptText) {
    if (!txt) return txt
    for (let oldName in ["kind.json", "yelm.json"]) {
        if (!txt[pxt.CONFIG_NAME] && txt[oldName]) {
            txt[pxt.CONFIG_NAME] = txt[oldName]
            delete txt[oldName]
        }
    }
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
    return Cloud.privateGetAsync(id)
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
                    }, files)))
}

export function saveToCloudAsync(h: Header) {
    checkSession();
    return impl.saveToCloudAsync(h)
}

export function syncAsync() {
    checkSession();
    return impl.syncAsync();
}

export function resetAsync() {
    checkSession();
    return impl.resetAsync()
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

