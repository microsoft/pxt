/// <reference path="../../built/kindlib.d.ts" />

import * as db from "./db";
import * as core from "./core";
import * as pkg from "./package";
import * as data from "./data";
import * as cloudworkspace from "./cloudworkspace"
import * as fileworkspace from "./fileworkspace"

let scripts = new db.Table("script")

import U = ks.Util;
import Cloud = ks.Cloud;
let lf = U.lf

export interface InstallHeader {
    name: string;
    meta: any;
    editor: string;
    pubId: string; // for published scripts
    pubCurrent: boolean; // is this exactly pubId, or just based on it
}

export interface Header extends InstallHeader {
    _rev: string;
    id: string; // guid
    recentUse: number; // seconds since epoch
    modificationTime: number; // seconds since epoch
    blobId: string; // blob name for cloud version
    blobCurrent: boolean;      // has the current version of the script been pushed to cloud
    isDeleted: boolean;
    saveId?: any;
}

export type ScriptText = U.StringMap<string>;

export interface WorkspaceProvider {
    getHeaders(): Header[];
    getHeader(id: string): Header;
    getTextAsync(id: string): Promise<ScriptText>;
    initAsync(): Promise<void>;
    saveAsync(h: Header, text?: ScriptText): Promise<void>;
    installAsync(h0: InstallHeader, text: ScriptText): Promise<Header>;
    saveToCloudAsync(h: Header): Promise<void>;
    syncAsync(): Promise<void>;
}

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

export function initAsync() {
    if (!impl) impl = cloudworkspace.provider;
    return impl.initAsync()
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
        userplatform: ["yelm-web"],
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
    if (!txt[ks.configName] && txt["yelm.json"]) {
        txt[ks.configName] = txt["yelm.json"]
        delete txt["yelm.json"]
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
                        editor: scr.editor
                    }, files)))
}

export function saveToCloudAsync(h: Header) {
    return impl.saveToCloudAsync(h)
}

export function syncAsync() {
    return impl.syncAsync();
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

