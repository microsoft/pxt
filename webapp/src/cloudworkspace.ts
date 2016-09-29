import * as db from "./db";
import * as core from "./core";
import * as pkg from "./package";
import * as data from "./data";
import * as ws from "./workspace";

let headers = new db.Table("header")
let texts = new db.Table("text")

type Header = pxt.workspace.Header;
type ScriptText = pxt.workspace.ScriptText;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;
type InstallHeader = pxt.workspace.InstallHeader;

import U = pxt.Util;
import Cloud = pxt.Cloud;
let lf = U.lf
let allScripts: HeaderWithScript[] = [];

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

function getHeaders() {
    return allScripts.map(e => e.header)
}

function getHeader(id: string) {
    let e = lookup(id)
    if (e && !e.header.isDeleted)
        return e.header
    return null
}

function initAsync(target: string) {
    // TODO getAllAsync aware of target?
    return headers.getAllAsync().then(h => {
        allScripts = h
            .filter((hh: Header) => {
                if (!hh.target) hh.target = "microbit"
                return hh.target == pxt.appTarget.id
            })
            .map((hh: Header) => {
                return {
                    id: hh.id,
                    header: hh,
                    text: null
                }
            })
    })
}

function fetchTextAsync(e: HeaderWithScript): Promise<ScriptText> {
    return texts.getAsync(e.id)
        .then(resp => {
            if (!e.text) {
                // otherwise we were beaten to it
                e.text = ws.fixupFileNames(resp.files);
            }
            e.textRev = resp._rev;
            return e.text
        })
}

let headerQ = new U.PromiseQueue();

function getTextAsync(id: string): Promise<ScriptText> {
    let e = lookup(id)
    if (!e)
        return Promise.resolve(null as ScriptText)
    if (e.text)
        return Promise.resolve(e.text)
    return headerQ.enqueue(id, () => fetchTextAsync(e))
}

function fetchTextRevAsync(e: HeaderWithScript) {
    if (e.textRev)
        return Promise.resolve();
    return fetchTextAsync(e).then(() => { }, err => { })
}

function saveCoreAsync(h: Header, text?: ScriptText) {
    let e = lookup(h.id)

    U.assert(e.header === h)

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

function saveAsync(h: Header, text: ScriptText) {
    return saveCoreAsync(h, text)
}

function installAsync(h0: InstallHeader, text: ScriptText) {
    let h = <Header>h0
    h.id = U.guidGen();
    h.recentUse = U.nowSeconds()
    h.modificationTime = h.recentUse;
    h.target = pxt.appTarget.id;
    let e: HeaderWithScript = {
        id: h.id,
        header: h,
        text: text,
    }
    allScripts.push(e)
    return saveCoreAsync(h, text)
        .then(() => h)
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

function saveToCloudAsync(h: Header) {
    if (!Cloud.isLoggedIn()) return Promise.resolve();

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
                script: scr,
                target: pxt.appTarget.id
            }
            pxt.debug(`sync up ${h.id}; ${body.script.length} chars`)
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

function syncAsync() {
    let numUp = 0
    let numDown = 0
    let blobConatiner = ""
    let updated: pxt.Map<number> = {}

    if (!Cloud.hasAccessToken())
        return Promise.resolve()

    function uninstallAsync(h: Header) {
        pxt.debug(`uninstall local ${h.id}`)
        let e = lookup(h.id)
        let idx = allScripts.indexOf(e)
        U.assert(idx >= 0)
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
        U.assert(header.id == cloudHeader.guid)
        let blobId = cloudHeader.scriptVersion.baseSnapshot
        pxt.debug(`sync down ${header.id} - ${blobId}`)
        return U.httpGetJsonAsync(blobConatiner + blobId)
            .catch(core.handleNetworkError)
            .then(resp => {
                U.assert(resp.guid == header.id)
                header.blobCurrent = true
                header.blobId = blobId
                header.modificationTime = cloudHeader.scriptVersion.time
                header.editor = resp.editor
                header.name = resp.name
                let files: pxt.Map<string> = { "_default_": resp.script }
                if (isProject(header))
                    files = JSON.parse(resp.script)
                header.recentUse = cloudHeader.recentUse
                delete header.isDeleted
                header.pubId = resp.scriptId
                header.pubCurrent = (resp.status == "published")
                header.saveId = null
                header.target = resp.target
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
            status: "deleted",
            scriptVersion: { time: U.nowSeconds(), baseSnapshot: "*" }
        }
        return Cloud.privatePostAsync("me/installed", { bodies: [body] })
            .then(() => uninstallAsync(h))
    }

    return Cloud.privateGetAsync("me/installed?format=short")
        .then((resp: InstalledHeaders) => {
            blobConatiner = resp.blobcontainer
            let cloudHeaders = U.toDictionary(resp.headers, h => h.guid)
            let existingHeaders = U.toDictionary(allScripts, h => h.id)
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


function resetAsync() {
    return db.destroyAsync()
        .then(() => {
            pxt.storage.clearLocal();
            data.clearCache();
        })
}

export var provider: WorkspaceProvider = {
    getHeaders,
    getHeader,
    getTextAsync,
    initAsync,
    saveAsync,
    installAsync,
    saveToCloudAsync,
    syncAsync,
    resetAsync
}