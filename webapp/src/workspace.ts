/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="../../built/pxteditor.d.ts" />

import * as db from "./db";
import * as core from "./core";
import * as pkg from "./package";
import * as data from "./data";
import * as cloudworkspace from "./cloudworkspace"
import * as fileworkspace from "./fileworkspace"

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type InstallHeader = pxt.workspace.InstallHeader;

let scripts = new db.Table("script")

import U = pxt.Util;
import Cloud = pxt.Cloud;
let lf = U.lf


var impl: WorkspaceProvider;

export function setupWorkspace(id: string) {
    switch (id) {
        case "fs":
        case "file":
            impl = fileworkspace.provider;
            break;
        case "cloud":
        default:
            impl = cloudworkspace.provider
            break;
    }
}

export function getHeaders(withDeleted = false) {
    let r = impl.getHeaders()
    if (!withDeleted)
        r = r.filter(r => !r.isDeleted)
    r.sort((a, b) => b.recentUse - a.recentUse)
    return r
}

export function getHeader(id: string) {
    let hd = impl.getHeader(id)
    if (hd && !hd.isDeleted)
        return hd
    return null
}

var currentTarget = "";

export function getCurrentTarget() {
    return currentTarget
}

export function initAsync(target: string) {
    if (!impl) impl = cloudworkspace.provider;
    currentTarget = target
    return impl.initAsync(target)
}

export function getTextAsync(id: string): Promise<ScriptText> {
    return impl.getTextAsync(id);
}

export interface ScriptMeta {
    description: string;
    islibrary: boolean;
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
        text: stext
    }
    console.log(`publishing script; ${stext.length} bytes`)
    return Cloud.privatePostAsync("scripts", scrReq)
        .then((inf: Cloud.JsonScript) => {
            h.pubId = inf.id
            h.pubCurrent = h.saveId === saveId
            console.log(`published; id /${inf.id}`)
            return saveAsync(h)
                .then(() => inf)
        })
}

export function saveAsync(h: Header, text?: ScriptText) {
    if (text || h.isDeleted) {
        h.pubCurrent = false
        h.blobCurrent = false
        h.modificationTime = U.nowSeconds();
    }
    h.recentUse = U.nowSeconds();
    return impl.saveAsync(h, text)
}

export function installAsync(h0: InstallHeader, text: ScriptText) {
    return impl.installAsync(h0, text)
}

export function fixupFileNames(txt: ScriptText) {
    if (!txt) return txt
    for (let oldName in ["kind.json", "yelm.json"]) {
        if (!txt[pxt.configName] && txt[oldName]) {
            txt[pxt.configName] = txt[oldName]
            delete txt[oldName]
        }
    }
    return txt
}


let scriptDlQ = new U.PromiseQueue();
//let scriptCache:any = {}
export function getPublishedScriptAsync(id: string) {
    //if (scriptCache.hasOwnProperty(id)) return Promise.resolve(scriptCache[id])   
    return scriptDlQ.enqueue(id, () => scripts.getAsync(id)
        .then(v => v.files, e => Cloud.downloadScriptFilesAsync(id)
            .then(files => scripts.setAsync({ id: id, files: files })
                .then(() => {
                    //return (scriptCache[id] = files)
                    return files
                })))
        .then(fixupFileNames))
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
    return impl.saveToCloudAsync(h)
}

export function syncAsync() {
    return impl.syncAsync();
}

export function resetAsync() {
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

