import * as db from "./db";
import * as core from "./core";
import * as pkg from "./package";
import * as data from "./data";
import * as ws from "./workspace";
import * as onedrive from "./onedrive";

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


export interface CloudFile {
    id: string;
    name: string; // hopefully user-readable
    version: string;
    updatedAt: number; // Unix time
    content?: pxt.Map<string>;
}

export interface CloudProvider {
    name: string;
    loginCheck(): void;
    login(): void;
    loginCallback(queryString: pxt.Map<string>): void;
    listAsync(): Promise<CloudFile[]>;
    // apis below return CloudFile mostly for the version field
    downloadAsync(id: string): Promise<CloudFile>;
    // id can be null - creates a new file then
    uploadAsync(id: string, files: pxt.Map<string>): Promise<CloudFile>;
    deleteAsync(id: string): Promise<void>;
}

let _cloudProviders: pxt.Map<CloudProvider>

export function cloudProviders() {
    if (!_cloudProviders) {
        _cloudProviders = {}
        for (let impl of [onedrive.impl]) {
            _cloudProviders[impl.name] = impl
        }
    }

    let cl = pxt.appTarget.cloud
    if (!cl || !cl.cloudProviders)
        return []
    return cl.cloudProviders.map(n => _cloudProviders[n])
}

export function setCloudProvider(impl: CloudProvider) {
    cloudProvider = impl
}
export let cloudProvider: CloudProvider;

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

function initAsync(target: string, version: string) {
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
    if (h.temporary) return Promise.resolve();

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
    h.id = ts.pxtc.Util.guidGen();
    h.recentUse = U.nowSeconds()
    h.modificationTime = h.recentUse;
    let e: HeaderWithScript = {
        id: h.id,
        header: h,
        text: text,
    }
    allScripts.push(e)
    return saveCoreAsync(h, text)
        .then(() => h)
}

function saveToCloudAsync(h: Header) {
    if (!cloudProvider) return Promise.resolve();
    return syncOneUpAsync(h)
}

function isLocalOnly(h: Header) {
    return h.id[0] == "*"
}

async function syncOneUpAsync(h: Header) {
    let saveId = {}
    let e = lookup(h.id)
    h.saveId = saveId;
    await getTextAsync(h.id)

    let firstTime = isLocalOnly(h)
    // TODO check for conflict
    let info = await cloudProvider.uploadAsync(firstTime ? null : h.id, e.text)
    pxt.debug(`sync up ${h.id}`)

    if (firstTime) {
        h.id = info.id
    } else {
        U.assert(h.id == info.id)
    }
    h.blobId = info.version
    if (h.saveId === saveId)
        h.blobCurrent = true
    await saveCoreAsync(h, firstTime ? e.text : null)
}

function syncAsync(): Promise<pxt.editor.EditorSyncState> {
    let numUp = 0
    let numDown = 0
    let blobConatiner = ""
    let updated: pxt.Map<number> = {}

    if (!cloudProvider)
        return Promise.resolve(undefined)

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

    function syncDownAsync(header0: Header, cloudHeader: CloudFile) {

        let header = header0
        if (!header) {
            header = <any>{
                id: cloudHeader.id
            }
        }

        numDown++
        U.assert(header.id == cloudHeader.id)
        let blobId = cloudHeader.version
        pxt.debug(`sync down ${header.id} - ${blobId}`)
        return cloudProvider.downloadAsync(cloudHeader.id)
            // .catch(core.handleNetworkError)
            .then(resp => {
                U.assert(resp.id == header.id)
                header.blobCurrent = true
                header.blobId = resp.version
                header.modificationTime = resp.updatedAt
                let files = resp.content
                let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
                header.name = cfg.name
                delete header.isDeleted
                header.pubId = ""
                header.pubCurrent = false
                header.saveId = null
                header.target = pxt.appTarget.id
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
        return cloudProvider.deleteAsync(h.id)
            .then(() => uninstallAsync(h))
    }

    return cloudProvider.listAsync()
        .then(entries => {
            let cloudHeaders = U.toDictionary(entries, h => h.id)
            let existingHeaders = U.toDictionary(allScripts, h => h.id)
            let waitFor = allScripts.map(e => {
                let hd = e.header
                if (cloudHeaders.hasOwnProperty(hd.id)) {
                    let chd = cloudHeaders[hd.id]

                    if (hd.isDeleted)
                        return syncDeleteAsync(hd)

                    if (chd.version == hd.blobId) {
                        if (hd.blobCurrent) {
                            // nothing to do
                            return Promise.resolve()
                        } else {
                            return syncUpAsync(hd)
                        }
                    } else {
                        if (hd.blobCurrent) {
                            return syncDownAsync(hd, chd)
                        } else {
                            // TODO resolve conflict
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
            waitFor = waitFor.concat(entries.filter(h => !existingHeaders[h.id]).map(h => syncDownAsync(null, h)))
            progress(0)
            return Promise.all(waitFor)
        })
        .then(() => progressMsg(lf("Syncing done")))
        .then(() => pkg.notifySyncDone(updated))
        .then(() => undefined)
        .catch(core.handleNetworkError)
}


function resetAsync() {
    return db.destroyAsync()
        .then(() => {
            pxt.storage.clearLocal();
            data.clearCache();
        })
}

function loadedAsync(): Promise<void> {
    return Promise.resolve();
}

function loginCheck() {
    let prov = cloudProviders()

    if (!prov.length)
        return

    let qs = core.parseQueryString((location.hash || "#").slice(1).replace(/%23access_token/, "access_token"))
    if (qs["access_token"]) {
        let ex = pxt.storage.getLocal("oauthState")
        if (ex && ex == qs["state"]) {
            for (let impl of prov) {
                if (impl.name == pxt.storage.getLocal("oauthType")) {
                    pxt.storage.removeLocal("oauthState")
                    location.hash = location.hash.replace(/(%23)?[\#\&\?]*access_token.*/, "")
                    impl.loginCallback(qs)
                    break
                }
            }
        }

    }

    for (let impl of prov)
        impl.loginCheck();
}

export const provider: WorkspaceProvider = {
    getHeaders,
    getHeader,
    getTextAsync,
    initAsync,
    saveAsync,
    installAsync,
    saveToCloudAsync,
    syncAsync,
    resetAsync,
    loadedAsync
}