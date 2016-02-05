/// <reference path="../../built/yelmlib.d.ts" />

import * as Promise from "bluebird";
import * as db from "./db";
import * as core from "./core";
import * as pkg from "./package";
import * as data from "./data";

let headers = new db.Table("header")
let texts = new db.Table("text")
let scripts = new db.Table("script")

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

export interface ScriptText {
    _rev?: string;
    id?: string;
    files: Util.StringMap<string>;
}

export let allHeaders: Header[];

export function getHeader(id: string) {
    return allHeaders.filter(h => !h.isDeleted && h.id == id)[0]
}

export function initAsync() {
    return headers.getAllAsync().then(h => { allHeaders = h })
}

export class PromiseQueue {
    promises: Util.StringMap<Promise<any>> = {};

    enqueue<T>(id: string, f: () => Promise<T>): Promise<T> {
        if (!this.promises.hasOwnProperty(id)) {
            this.promises[id] = Promise.resolve()
        }
        let newOne = this.promises[id].then(() => f().then(v => {
            if (this.promises[id] === newOne)
                delete this.promises[id];
            return v;
        }))
        this.promises[id] = newOne;
        return newOne;
    }
}

let headerQ = new PromiseQueue();
let lastTextRev: Util.StringMap<string> = {}

export function resetAsync() {
    return db.db.destroy()
        .then(() => {
            window.localStorage.clear()
        })
}

function getTextCoreAsync(id: string): Promise<ScriptText> {
    return texts.getAsync(id)
            .then(resp => {
                lastTextRev[resp.id] = resp._rev
                return resp;
            })
}

export function getTextAsync(id: string): Promise<ScriptText> {
    return headerQ.enqueue(id, () => getTextCoreAsync(id))
}

function nowSeconds() {
    return Math.round(Date.now() / 1000)
}

export function saveAsync(h: Header, text?: ScriptText) {
    let clear = () => {
        if (text || h.isDeleted) {
            h.pubCurrent = false
            h.blobCurrent = false
            h.modificationTime = nowSeconds();
            h.saveId = null;
        }
    }
    h.recentUse = nowSeconds();
    clear();
    return saveCoreAsync(h, text).then(clear)
}

export function installAsync(h0: InstallHeader, text: ScriptText) {
    let h = <Header>h0
    h.id = Util.guidGen();
    h.recentUse = nowSeconds()
    h.modificationTime = h.recentUse;
    text.id = h.id
    return saveCoreAsync(h, text)
        .then(() => {
            allHeaders.push(h)
        })
}

let scriptDlQ = new PromiseQueue();
//let scriptCache:any = {}
export function getScriptFilesAsync(id: string) {
    //if (scriptCache.hasOwnProperty(id)) return Promise.resolve(scriptCache[id])   
    return scriptDlQ.enqueue(id, () => scripts.getAsync(id)
        .then(v => v.files, e => Cloud.downloadScriptFilesAsync(id)
            .then(files => scripts.setAsync({ id: id, files: files })
                .then(() => {
                    //return (scriptCache[id] = files)
                    return files
                }))))
}

export function installByIdAsync(id: string) {
    return Cloud.privateGetAsync(id)
        .then((scr: Cloud.JsonScript) =>
            getScriptFilesAsync(scr.id)
                .then(files => installAsync(
                    {
                        name: scr.name,
                        pubId: id,
                        pubCurrent: true,
                        meta: scr.meta,
                        editor: scr.editor
                    },
                    {
                        _rev: undefined,
                        id: undefined,
                        files: files
                    })))
}

function saveCoreAsync(h: Header, text?: ScriptText) {
    if (text && !text.id) text.id = h.id
    if (text) h.saveId = null
    return headerQ.enqueue(h.id, () =>
        setTextAsync(text).then(() =>
            headers.setAsync(h).then(rev => {
                h._rev = rev
                data.invalidate("header:" + h.id)
                data.invalidate("header:*")
                if (text) {
                    data.invalidate("text:" + h.id)
                    h.saveId = null
                }
            })))
}

function setTextAsync(t: ScriptText): Promise<void> {
    if (!t) return Promise.resolve();

    Util.assert(!!t.id)
    Util.assert(!!t.files)
    
    t._rev = lastTextRev[t.id]
    
    if (!t._rev)
        return getTextCoreAsync(t.id).then(() => setTextAsync(t))

    return texts.setAsync(t)
        .then(resp => {
            lastTextRev[t.id] = resp
        })
}

export function apiAsync(path: string, data?: any) {
    return (data ?
        Cloud.privatePostAsync(path, data) :
        Cloud.privateGetAsync(path))
        .then(resp => {
            console.log("*")
            console.log("*******", path, "--->")
            console.log("*")
            console.log(resp)
            console.log("*")
            return resp
        }, err => {
            console.log(err.message)
        })
}

interface CloudHeader {
    guid: string;
    status: string;
    recentUse: number;
    scriptVersion: { time: number; baseSnapshot: string };
}

interface InstalledHeaders {
    headers: CloudHeader[];
    newNotifications: number;
    notifications: boolean;
    time: number;
    random: string;
    v: number;
    blobcontainer: string;
}

function isProject(h: Header) {
    return /prj$/.test(h.editor)
}

export function saveToCloudAsync(h: Header) {
    return syncOneUpAsync(h)
}

function syncOneUpAsync(h: Header) {
    let saveId = {}
    return getTextAsync(h.id)
        .then(txt => {
            let scr = ""
            if (isProject(h))
                scr = JSON.stringify(txt.files)
            else
                scr = txt.files[Object.keys(txt.files)[0]] || ""
            let body = {
                guid: h.id,
                name: h.name,
                scriptId: h.pubId,
                scriptVersion: { time: h.modificationTime, baseSnapshot: "*" },
                meta: JSON.stringify(h.meta),
                status: h.pubCurrent ? "published" : "unpublished",
                recentUse: h.recentUse,
                editor: h.editor,
                script: scr
            }
            console.log(`sync up ${h.id}; ${body.script.length} chars`)
            h.saveId = saveId;
            return Cloud.privatePostAsync("me/installed", { bodies: [body] })
        })
        .then(resp => {
            let chd = resp.headers[0] as CloudHeader
            h.blobId = chd.scriptVersion.baseSnapshot
            if (h.saveId === saveId)
                h.blobCurrent = true
            return saveCoreAsync(h)
        })

}

export function syncAsync() {
    var numUp = 0
    var numDown = 0
    var blobConatiner = ""
    var updated: Util.StringMap<number> = {}

    function uninstallAsync(h: Header) {
        console.log(`uninstall local ${h.id}`)
        let idx = allHeaders.indexOf(h)
        Util.assert(idx >= 0)
        allHeaders.splice(idx, 1)
        h.isDeleted = true;
        return headers.deleteAsync(h)
            .then(() => texts.deleteAsync({ id: h.id, _rev: lastTextRev[h.id] }))
    }

    function syncDownAsync(header0: Header, cloudHeader: CloudHeader) {
        if (cloudHeader.status == "deleted") {
            if (!header0)
                return Promise.resolve()
            else
                return uninstallAsync(header0)
        }

        let header = header0
        if (!header) {
            header = <any>{
                id: cloudHeader.guid
            }
        }

        numDown++
        Util.assert(header.id == cloudHeader.guid)
        let blobId = cloudHeader.scriptVersion.baseSnapshot
        console.log(`sync down ${header.id} - ${blobId}`)
        return Util.httpGetJsonAsync(blobConatiner + blobId)
            .then(resp => {
                Util.assert(resp.guid == header.id)
                header.blobCurrent = true
                header.blobId = blobId
                header.modificationTime = cloudHeader.scriptVersion.time
                header.editor = resp.editor
                header.name = resp.name
                var files: Util.StringMap<string> = { "_default_": resp.script }
                if (isProject(header))
                    files = JSON.parse(resp.script)
                header.recentUse = cloudHeader.recentUse
                delete header.isDeleted
                header.pubId = resp.scriptId
                header.pubCurrent = (resp.status == "published")
                header.saveId = null
                if (!header0)
                    allHeaders.push(header);
                updated[header.id] = 1;
                return saveCoreAsync(header, { files: files })
            })
            .then(() => progress(--numDown))
    }

    function progressMsg(m: string) {
        core.infoNotification(m)
    }

    function progress(dummy: number) {
        let msg = ""
        if (numDown == 0 && numUp == 0)
            msg = "All synced"
        else {
            msg = "Syncing ("
            if (numDown) msg += numDown + " down"
            if (numUp) msg += (numDown ? ", " : "") + numUp + " up"
            msg += ")"
        }
        progressMsg(msg)
    }

    function syncUpAsync(h: Header) {
        numUp++
        return syncOneUpAsync(h)
            .then(() => progress(--numUp))
    }

    function syncDeleteAsync(h: Header) {
        let body = {
            guid: h.id,
            status: "deleted"
        }
        return Cloud.privatePostAsync("me/installed", { bodies: [body] })
            .then(() => uninstallAsync(h))
    }

    return Cloud.privateGetAsync("me/installed?format=short")
        .then((resp: InstalledHeaders) => {
            blobConatiner = resp.blobcontainer
            let cloudHeaders = Util.toDictionary(resp.headers, h => h.guid)
            let existingHeaders = Util.toDictionary(allHeaders, h => h.id)
            let waitFor = allHeaders.map(hd => {
                if (cloudHeaders.hasOwnProperty(hd.id)) {
                    let chd = cloudHeaders[hd.id]

                    if (hd.isDeleted)
                        return syncDeleteAsync(hd)

                    if (chd.scriptVersion.baseSnapshot == hd.blobId) {
                        if (hd.blobCurrent) {
                            if (hd.recentUse != chd.recentUse) {
                                hd.recentUse = chd.recentUse
                                return saveCoreAsync(hd)
                            } else {
                                // nothing to do
                                return Promise.resolve()
                            }
                        } else {
                            return syncUpAsync(hd)
                        }
                    } else {
                        if (hd.blobCurrent) {
                            return syncDownAsync(hd, chd)
                        } else {
                            return syncUpAsync(hd)
                        }
                    }
                } else {
                    if (hd.blobId)
                        // this has been pushed once to the cloud - uninstall wins
                        return uninstallAsync(hd)
                    else
                        // never pushed before
                        return syncUpAsync(hd)
                }
            })
            waitFor = waitFor.concat(resp.headers.filter(h => !existingHeaders[h.guid]).map(h => syncDownAsync(null, h)))
            progress(0)
            return Promise.all(waitFor)
        })
        .then(() => progressMsg("Syncing done"))
        .then(() => pkg.notifySyncDone(updated))
}

/*
    header:<guid>   - one header
    header:*        - all headers
*/

data.mountVirtualApi("header", {
    isSync: p => true,
    getSync: p => {
        p = data.stripProtocol(p)
        if (p == "*") return allHeaders.filter(f => !f.isDeleted)
        return getHeader(p)
    },
    getAsync: null,
})

/*
    text:<guid>            - all files
    text:<guid>/<filename> - one file
*/
data.mountVirtualApi("text", {
    isSync: p => false,
    getSync: null,
    getAsync: p => {
        let m = /^[\w\-]+:([^\/]+)(\/(.*))?/.exec(p)
        return getTextAsync(m[1])
            .then(v => {
                if (m[3])
                    return v.files[m[3]]
                else return v.files;
            })
    },
})

