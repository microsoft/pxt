// TODO detect login to a different account
// TODO recentUse is bumped on sync down
// TODO token redirect address
// TODO UI for login
// TODO cloud save indication in the editor somewhere
// TODO trigger sync on home screen?
// TODO test conflict "resolution"

import * as core from "./core";
import * as pkg from "./package";
import * as ws from "./workspace";

import * as onedrive from "./onedrive";

type Header = pxt.workspace.Header;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

import U = pxt.Util;
const lf = U.lf

let wsimpl: WorkspaceProvider
let allProviders: pxt.Map<Provider>
let provider: Provider

const HEADER_JSON = ".cloudheader.json"

export interface FileInfo {
    id: string;
    name: string; // hopefully user-readable
    version: string;
    updatedAt: number; // Unix time
    content?: pxt.Map<string>;
}

export interface Provider {
    name: string;
    loginCheck(): void;
    login(): void;
    loginCallback(queryString: pxt.Map<string>): void;
    listAsync(): Promise<FileInfo[]>;
    // apis below return CloudFile mostly for the version field
    downloadAsync(id: string): Promise<FileInfo>;
    // id can be null - creates a new file then
    uploadAsync(id: string, baseVersion: string, files: pxt.Map<string>): Promise<FileInfo>;
    deleteAsync(id: string): Promise<void>;
}

export function reconstructMeta(files: pxt.Map<string>) {
    let cfg = JSON.parse(files[pxt.CONFIG_NAME]) as pxt.PackageConfig
    let r: pxt.cpp.HexFile = {
        meta: {
            cloudId: pxt.CLOUD_ID + pxt.appTarget.id,
            editor: pxt.BLOCKS_PROJECT_NAME,
            name: cfg.name,
        },
        source: JSON.stringify(files)
    }

    let hd = JSON.parse(files[HEADER_JSON] || "{}") as pxt.workspace.Header
    if (hd) {
        if (hd.editor)
            r.meta.editor = hd.editor
        if (hd.target)
            r.meta.cloudId = pxt.CLOUD_ID + hd.target
        if (hd.targetVersion)
            r.meta.targetVersions = { target: hd.targetVersion }
    }

    return r
}

export function providers() {
    if (!allProviders) {
        allProviders = {}
        for (let impl of [onedrive.impl]) {
            allProviders[impl.name] = impl
        }
    }

    let cl = pxt.appTarget.cloud

    // TODO remove before merging the PR
    if (cl && !cl.cloudProviders) {
        cl.cloudProviders = {
            "onedrive": {
                "client_id": "bf0ee68a-56b5-4b23-bbdb-5daf01a8f6cd"
            }
        }
    }

    if (!cl || !cl.cloudProviders)
        return []

    return Object.keys(cl.cloudProviders).map(id => allProviders[id])
}

// this is generally called by the provier's loginCheck() function
export function setProvider(impl: Provider) {
    provider = impl
}

async function syncOneUpAsync(h: Header) {
    let saveId = {}
    h.saveId = saveId;
    let text = await ws.getTextAsync(h.id)

    text = U.flatClone(text)
    text[HEADER_JSON] = JSON.stringify(h, null, 4)

    let firstTime = h.blobId == null

    let info: FileInfo

    try {
        info = await provider.uploadAsync(h.blobId, h.blobVersion, text)
    } catch (e) {
        if (e.statusCode == 409) {
            core.warningNotification(lf("Conflict saving {0}; please do a full cloud sync", h.name))
            return
        } else {
            throw e
        }
    }
    pxt.debug(`synced up ${info.id}`)

    if (firstTime) {
        h.blobId = info.id
    } else {
        U.assert(h.blobId == info.id)
    }
    h.blobVersion = info.version
    if (h.saveId === saveId)
        h.blobCurrent = true
    await ws.saveAsync(h, null, true)
}

export function resetAsync() {
    return Promise.resolve()
}

export function syncAsync(): Promise<void> {
    let numUp = 0
    let numDown = 0
    let blobConatiner = ""
    let updated: pxt.Map<number> = {}

    if (!provider)
        return Promise.resolve(undefined)

    function uninstallAsync(h: Header) {
        pxt.debug(`uninstall local ${h.blobId}`)
        h.isDeleted = true
        h.blobVersion = "DELETED"
        return ws.saveAsync(h, null, true)
    }

    async function resolveConflictAsync(header: Header, cloudHeader: FileInfo) {
        // rename current script
        let text = await ws.getTextAsync(header.id)
        let newHd = await ws.duplicateAsync(header, text)
        header.blobId = null
        header.blobVersion = null
        header.blobCurrent = false
        // TODO update name in pxt.json        
        await ws.saveAsync(header, text)
        // get the cloud version
        await syncDownAsync(newHd, cloudHeader)
        // TODO kick the user out of editor, or otherwise force reload
    }

    function syncDownAsync(header0: Header, cloudHeader: FileInfo) {
        let header = header0
        if (!header) {
            header = <any>{
                blobId: cloudHeader.id
            }
        }

        numDown++
        U.assert(header.blobId == cloudHeader.id)
        let blobId = cloudHeader.version
        pxt.debug(`sync down ${header.blobId} - ${blobId}`)
        return provider.downloadAsync(cloudHeader.id)
            .catch(core.handleNetworkError)
            .then((resp: FileInfo) => {
                U.assert(resp.id == header.blobId)
                let files = resp.content
                let hd = JSON.parse(files[HEADER_JSON] || "{}") as Header
                delete files[HEADER_JSON]

                header.blobCurrent = true
                header.blobVersion = resp.version
                // TODO copy anything else from the cloud?
                header.name = hd.name || header.name || "???"
                header.id = header.id || hd.id || U.guidGen()
                header.pubId = hd.pubId
                header.pubCurrent = hd.pubCurrent
                delete header.isDeleted
                header.saveId = null
                header.target = pxt.appTarget.id
                header.recentUse = hd.recentUse
                header.modificationTime = hd.modificationTime
                if (!header.modificationTime)
                    header.modificationTime = resp.updatedAt || U.nowSeconds()
                if (!header.recentUse)
                    header.recentUse = header.modificationTime
                updated[header.blobId] = 1;

                if (!header0)
                    return ws.importAsync(header, files, true)
                else
                    return ws.saveAsync(header, files, true)
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
        return provider.deleteAsync(h.blobId)
            .then(() => uninstallAsync(h))
    }

    return provider.listAsync()
        .then(entries => {
            let allScripts = ws.getHeaders()
            let cloudHeaders = U.toDictionary(entries, e => e.id)
            let existingHeaders = U.toDictionary(allScripts, h => h.blobId)
            let waitFor = allScripts.map(hd => {
                if (cloudHeaders.hasOwnProperty(hd.blobId)) {
                    let chd = cloudHeaders[hd.blobId]

                    if (hd.isDeleted)
                        return syncDeleteAsync(hd)

                    if (chd.version == hd.blobVersion) {
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
                            return resolveConflictAsync(hd, chd)
                        }
                    }
                } else {
                    if (hd.blobVersion)
                        // this has been pushed once to the cloud - uninstall wins
                        return uninstallAsync(hd)
                    else
                        // never pushed before
                        return syncUpAsync(hd)
                }
            })
            waitFor = waitFor.concat(entries.filter(e => !existingHeaders[e.id]).map(e => syncDownAsync(null, e)))
            progress(0)
            return Promise.all(waitFor)
        })
        .then(() => progressMsg(lf("Syncing done")))
        .then(() => pkg.notifySyncDone(updated))
        .catch(core.handleNetworkError)
}

export function setup(wsimpl_: WorkspaceProvider) {
    wsimpl = wsimpl_
}

export function loginCheck() {
    let prov = providers()

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

export function saveToCloudAsync(h: Header) {
    if (!provider) return Promise.resolve();
    return syncOneUpAsync(h)
}
