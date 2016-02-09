/// <reference path="../../built/yelmlib.d.ts" />

import * as Promise from "bluebird";
import * as db from "./db";
import * as core from "./core";
import * as pkg from "./package";
import * as data from "./data";

let headers = new db.Table("header")
let texts = new db.Table("text")
let scripts = new db.Table("script")

let lf = Util.lf
let allScripts: HeaderWithScript[] = [];


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

export type ScriptText = Util.StringMap<string>;

interface HeaderWithScript {
    id: string;
    header: Header;
    text: ScriptText;
    textRev?: string;
    textNeedsSave?: boolean;
}

function lookup(id: string) {
    return allScripts.filter(x => x.id == id)[0]
}

export function getHeaders(withDeleted = false) {
    let r = allScripts.map(x => x.header)
    if (!withDeleted)
        r = r.filter(r => !r.isDeleted)
    return r
}

export function getHeader(id: string) {
    let e = lookup(id)
    if (e && !e.header.isDeleted)
        return e.header
    return null
}

export function initAsync() {
    return headers.getAllAsync().then(h => {
        allScripts = h.map((hh: Header) => {
            return {
                id: hh.id,
                header: hh,
                text: null
            }
        })
    })
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

export function resetAsync() {
    return db.db.destroy()
        .then(() => {
            window.localStorage.clear()
        })
}

function fetchTextAsync(e: HeaderWithScript): Promise<ScriptText> {
    return texts.getAsync(e.id)
        .then(resp => {
            if (!e.text) {
                // otherwise we were beaten to it
                e.text = resp.files;
            }
            e.textRev = resp._rev;
            return e.text
        })
}

let headerQ = new PromiseQueue();

export function getTextAsync(id: string): Promise<ScriptText> {
    let e = lookup(id)
    if (!e)
        return Promise.resolve(null as ScriptText)
    if (e.text)
        return Promise.resolve(e.text)
    return headerQ.enqueue(id, () => fetchTextAsync(e))
}

export function nowSeconds() {
    return Math.round(Date.now() / 1000)
}

function fetchTextRevAsync(e: HeaderWithScript) {
    if (e.textRev)
        return Promise.resolve();
    return fetchTextAsync(e).then(() => { }, err => { })
}

function saveCoreAsync(h: Header, text?: ScriptText) {
    let e = lookup(h.id)

    Util.assert(e.header === h)

    if (text) {
        h.saveId = null
        e.textNeedsSave = true
        e.text = text
    }

    return headerQ.enqueue(h.id, () => {
        return (!text ? Promise.resolve() :
            fetchTextRevAsync(e)
                .then(() => {
                    e.textNeedsSave = false;
                    return texts.setAsync({
                        id: e.id,
                        files: e.text,
                        _rev: e.textRev
                    }).then(rev => {
                        e.textRev = rev
                    })
                }))
            .then(() => headers.setAsync(e.header))
            .then(rev => {
                h._rev = rev
                data.invalidate("header:" + h.id)
                data.invalidate("header:*")
                if (text) {
                    data.invalidate("text:" + h.id)
                    h.saveId = null
                }
            })
    })
}

export function saveAsync(h: Header, text?: ScriptText) {
    if (text || h.isDeleted) {
        h.pubCurrent = false
        h.blobCurrent = false
        h.modificationTime = nowSeconds();
    }
    h.recentUse = nowSeconds();
    return saveCoreAsync(h, text)
}

export function installAsync(h0: InstallHeader, text: ScriptText) {
    let h = <Header>h0
    h.id = Util.guidGen();
    h.recentUse = nowSeconds()
    h.modificationTime = h.recentUse;
    let e: HeaderWithScript = {
        id: h.id,
        header: h,
        text: text,
    }
    allScripts.push(e)
    return saveCoreAsync(h, text)
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
                    }, files)))
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
    let e = lookup(h.id)
    return getTextAsync(h.id)
        .then(() => {
            let scr = ""
            let files = e.text
            if (isProject(h))
                scr = JSON.stringify(files)
            else
                scr = files[Object.keys(files)[0]] || ""
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
        let e = lookup(h.id)
        let idx = allScripts.indexOf(e)
        Util.assert(idx >= 0)
        allScripts.splice(idx, 1)
        h.isDeleted = true;
        return headerQ.enqueue(h.id, () =>
            headers.deleteAsync(h)
                .then(() => fetchTextRevAsync(e))
                .then(() => texts.deleteAsync({ id: h.id, _rev: e.textRev })))
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
                    allScripts.push({
                        header: header,
                        text: null,
                        id: header.id
                    })
                updated[header.id] = 1;
                return saveCoreAsync(header, files)
            })
            .then(() => progress(--numDown))
    }

    function progressMsg(m: string) {
        core.infoNotification(m)
    }

    function progress(dummy: number) {
        let msg = ""
        if (numDown == 0 && numUp == 0)
            msg = lf("All synced")
        else {
            msg = lf("Syncing") + " ("
            if (numDown) msg += lf("{0} down", numDown)
            if (numUp) msg += (numDown ? ", " : "") + lf("{0} up", numUp)
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
            let existingHeaders = Util.toDictionary(allScripts, h => h.id)
            let waitFor = allScripts.map(e => {
                let hd = e.header
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
        .then(() => progressMsg(lf("Syncing done")))
        .then(() => pkg.notifySyncDone(updated))
        .catch(core.handleNetworkError)
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

