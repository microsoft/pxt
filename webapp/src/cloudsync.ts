// TODO cloud save indication in the editor somewhere

import * as core from "./core";
import * as pkg from "./package";
import * as ws from "./workspace";
import * as data from "./data";
import * as dialogs from "./dialogs";

type Header = pxt.workspace.Header;
type WorkspaceProvider = pxt.workspace.WorkspaceProvider;

import U = pxt.Util;
const lf = U.lf

let allProviders: pxt.Map<Provider>
let provider: Provider
let status = ""

const HEADER_JSON = ".cloudheader.json"

export interface FileInfo {
    id: string;
    name: string; // hopefully user-readable
    version: string;
    updatedAt: number; // Unix time
    content?: pxt.Map<string>;
}

export interface UserInfo {
    id: string;
    name: string;
}

export interface Provider {
    name: string;
    friendlyName: string;
    loginCheck(): void;
    login(): void;
    loginCallback(queryString: pxt.Map<string>): void;
    getUserInfoAsync(): Promise<UserInfo>;
    listAsync(): Promise<FileInfo[]>;
    // apis below return CloudFile mostly for the version field
    downloadAsync(id: string): Promise<FileInfo>;
    // id can be null - creates a new file then
    uploadAsync(id: string, baseVersion: string, files: pxt.Map<string>): Promise<FileInfo>;
    deleteAsync(id: string): Promise<void>;
}


export interface OAuthParams {
    client_id: string;
    scope: string;
    response_type: string;
    state: string;
    redirect_uri: string;
}

function mkSyncError(msg: string) {
    const e: any = new Error(msg)
    e.isUserError = true;
    e.isSyncError = true;
    return e
}

export class ProviderBase {
    constructor(public name: string, public friendlyName: string, public urlRoot: string) {
    }

    syncError(msg: string) {
        throw mkSyncError(msg)
    }

    protected reqAsync(opts: U.HttpRequestOptions): Promise<U.HttpResponse> {
        let tok = pxt.storage.getLocal(this.name + "token")

        if (!tok) {
            throw this.pleaseLogin()
        }

        if (!opts.headers) {
            opts.headers = {}
        }
        opts.headers["Authorization"] = "Bearer " + tok

        if (!/^https:\/\//.test(opts.url)) {
            opts.url = this.urlRoot + opts.url
        }

        opts.allowHttpErrors = true

        return U.requestAsync(opts)
        // TODO detect expired token here
    }

    protected getJsonAsync(path: string) {
        return this.reqAsync({ url: path })
            .then(resp => {
                if (resp.statusCode < 300)
                    return resp.json
                throw this.syncError(lf("Invalid {0} response {1} at {2}",
                    this.friendlyName, resp.statusCode, path))
            })
    }

    fileSuffix() {
        return ".mkcd-" + pxt.appTarget.id
    }

    parseTime(s: string) {
        return Math.round(new Date(s).getTime() / 1000)
    }

    pleaseLogin() {
        let msg = lf("Please log in to {0}", this.friendlyName)

        core.infoNotification(msg)

        let e = mkSyncError(msg)
        e.isLoginError = true;
        return e;
    }

    loginCheck() {
        let tok = pxt.storage.getLocal(this.name + "token")

        if (!tok)
            return

        let exp = parseInt(pxt.storage.getLocal(this.name + "tokenExp") || "0")

        if (exp && exp < U.nowSeconds()) {
            // if we already attempted autologin (and failed), don't do it again
            if (pxt.storage.getLocal(this.name + "AutoLogin")) {
                this.pleaseLogin()
                return
            }

            pxt.storage.setLocal(this.name + "AutoLogin", "yes")
            this.login();
        } else {
            setProvider(this as any)
        }
    }

    login() {
        U.userError("Not implemented")
    }

    protected loginInner() {
        const ns = this.name
        core.showLoading(ns + "login", lf("Logging you in to {0}...", this.friendlyName))
        const state = ts.pxtc.Util.guidGen();
        pxt.storage.setLocal("oauthState", state)
        pxt.storage.setLocal("oauthType", ns)
        pxt.storage.setLocal("oauthRedirect", window.location.href)
        const redir = window.location.protocol + "//" + window.location.host + "/oauth-redirect"
        const r: OAuthParams = {
            client_id: (pxt.appTarget.cloud.cloudProviders[this.name] as any)["client_id"],
            response_type: "token",
            state: state,
            redirect_uri: redir,
            scope: ""
        }
        return r
    }

    loginCallback(qs: pxt.Map<string>) {
        const ns = this.name
        pxt.storage.removeLocal(ns + "AutoLogin")
        pxt.storage.setLocal(ns + "token", qs["access_token"])
        let expIn = parseInt(qs["expires_in"])
        if (expIn) {
            let time = Math.round(Date.now() / 1000 + (0.75 * expIn))
            pxt.storage.setLocal(ns + "tokenExp", time + "")
        } else {
            pxt.storage.removeLocal(ns + "tokenExp")
        }
        // re-compute
        pxt.storage.removeLocal("cloudName")
    }
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

// these imports have to be after the ProviderBase class definition; otherwise we get crash on startup
import * as onedrive from "./onedrive";
import * as googledrive from "./googledrive";

export function providers() {
    if (!allProviders) {
        allProviders = {}
        for (let impl of [new onedrive.Provider(), new googledrive.Provider()]) {
            allProviders[impl.name] = impl
        }
    }

    let cl = pxt.appTarget.cloud

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

function updateNameAsync() {
    let name = pxt.storage.getLocal("cloudName");
    if (name || !provider)
        return Promise.resolve()
    return provider.getUserInfoAsync()
        .then(info => {
            let id = provider.name + ":" + info.id
            let currId = pxt.storage.getLocal("cloudId")
            if (currId && currId != id) {
                core.confirmAsync({
                    header: lf("Sign in mismatch"),
                    body: lf("You have previously signed in with a different account. You can sign out now, which will locally clear all projects, or you can try to sign in again."),
                    agreeClass: "red",
                    agreeIcon: "sign out",
                    agreeLbl: lf("Sign out"),
                    disagreeLbl: lf("Sign in again"),
                    disagreeIcon: "user circle"
                }).then(res => {
                    if (res) {
                        ws.resetAsync()
                            .then(() => {
                                location.hash = "#reload"
                                location.reload()
                            })
                    } else {
                        dialogs.showCloudSignInDialog()
                    }
                })
                // never return
                return new Promise<void>(() => { })
            } else {
                pxt.storage.setLocal("cloudId", id)
            }
            pxt.storage.setLocal("cloudName", info.name)
            data.invalidate("sync:username")
            return null
        })
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
        let newHd = await ws.duplicateAsync(header, text, true)
        header.blobId = null
        header.blobVersion = null
        header.blobCurrent = false
        await ws.saveAsync(header, text)
        // get the cloud version
        await syncDownAsync(newHd, cloudHeader)
        // TODO move the user out of editor, or otherwise force reload
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

    setStatus("syncing");

    return updateNameAsync()
        .then(() => provider.listAsync())
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
        .then(() => {
            setStatus("")
            progressMsg(lf("Syncing done"))
        })
        .then(() => pkg.notifySyncDone(updated))
        .catch(e => {
            if (e.isSyncError) {
                // for login errors there was already a notification
                if (!e.isLoginError)
                    core.warningNotification(e.message)
                return
            } else {
                core.handleNetworkError(e)
            }
        })
}

export function loginCheck() {
    let prov = providers()

    if (!prov.length)
        return

    let qs = core.parseQueryString(pxt.storage.getLocal("oauthHash") || "")
    if (qs["access_token"]) {
        for (let impl of prov) {
            if (impl.name == pxt.storage.getLocal("oauthType")) {
                pxt.storage.removeLocal("oauthHash");
                impl.loginCallback(qs)
                break
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

function setStatus(s: string) {
    if (s != status) {
        status = s
        data.invalidate("sync:status")
    }
}

/*
    sync:username
    sync:loggedin
    sync:status
*/
data.mountVirtualApi("sync", {
    getSync: p => {
        switch (data.stripProtocol(p)) {
            case "username":
                return pxt.storage.getLocal("cloudName")
            case "loggedin":
                return provider != null
            case "status":
                return status
            case "hascloud":
                return providers().length > 0
        }
        return null
    },
})
