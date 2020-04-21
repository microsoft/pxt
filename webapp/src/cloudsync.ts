// TODO cloud save indication in the editor somewhere

import * as core from "./core";
import * as pkg from "./package";
import * as ws from "./workspace";
import * as data from "./data";

type Header = pxt.workspace.Header;

import U = pxt.Util;
const lf = U.lf

let allProviders: pxt.Map<IdentityProvider>
let currentProvider: IdentityProvider
let status = ""

const HEADER_JSON = ".cloudheader.json"

export interface FileInfo {
    id: string;
    name: string; // hopefully user-readable
    version: string;
    updatedAt: number; // Unix time
    content?: pxt.Map<string>;
}

export interface ProviderLoginResponse {
    accessToken: string;
    expiresIn?: number; // seconds
}

export interface IdentityProvider {
    name: string;
    friendlyName: string;
    icon: string;
    loginCheck(): void;
    loginAsync(redirect?: boolean, silent?: boolean): Promise<ProviderLoginResponse>;
    logout(): void;
    loginCallback(queryString: pxt.Map<string>): void;
    getUserInfoAsync(): Promise<pxt.editor.UserInfo>;
    hasSync(): boolean;
    user(): pxt.editor.UserInfo;
    setUser(user: pxt.editor.UserInfo): void;
}

export interface Provider extends IdentityProvider {
    listAsync(): Promise<FileInfo[]>;
    // apis below return CloudFile mostly for the version field
    downloadAsync(id: string): Promise<FileInfo>;
    // id can be null - creates a new file then
    uploadAsync(id: string, baseVersion: string, files: pxt.Map<string>): Promise<FileInfo>;
    deleteAsync(id: string): Promise<void>;
    updateAsync(id: string, newName: string): Promise<void>;
}


export interface OAuthParams {
    client_id: string;
    scope: string;
    response_type: string;
    state: string;
    redirect_uri: string;
    expires_in?: number;
    redirect?: boolean;
}

function mkSyncError(msg: string) {
    const e: any = new Error(msg)
    e.isUserError = true;
    e.isSyncError = true;
    return e
}

export const OAUTH_TYPE = "oauthType";
export const OAUTH_STATE = "oauthState"; // state used in OAuth flow
export const OAUTH_REDIRECT = "oauthRedirect"; // hash to be reloaded up loging
export const OAUTH_HASH = "oauthHash"; // hash used in implicit oauth signing

export function setOauth(type: string, redirect?: string, hash?: string) {
    const state = ts.pxtc.Util.guidGen();
    pxt.storage.setLocal(OAUTH_TYPE, type);
    pxt.storage.setLocal(OAUTH_STATE, state);
    pxt.storage.setLocal(OAUTH_REDIRECT, redirect || window.location.hash)
    pxt.storage.setLocal(OAUTH_HASH, hash)
    return state;
}

function clearOauth() {
    pxt.storage.removeLocal(OAUTH_TYPE)
    pxt.storage.removeLocal(OAUTH_STATE)
    pxt.storage.removeLocal(OAUTH_REDIRECT)
    pxt.storage.removeLocal(OAUTH_HASH)
}

export class ProviderBase {
    constructor(public name: string, public friendlyName: string, public icon: string, public urlRoot: string) {
    }

    hasSync(): boolean {
        return true;
    }

    syncError(msg: string) {
        throw mkSyncError(msg)
    }

    user(): pxt.editor.UserInfo {
        const user = pxt.Util.jsonTryParse(pxt.storage.getLocal(this.name + "cloudUser")) as pxt.editor.UserInfo;
        return user;
    }

    setUser(user: pxt.editor.UserInfo) {
        if (user)
            pxt.storage.setLocal(this.name + "cloudUser", JSON.stringify(user))
        else
            pxt.storage.removeLocal(this.name + "cloudUser");
        data.invalidate("sync:user")
        data.invalidate("github:user")
    }

    protected token() {
        if (this.hasTokenExpired())
            return undefined;

        const tok = pxt.storage.getLocal(this.name + "token")
        return tok;
    }

    protected reqAsync(opts: U.HttpRequestOptions): Promise<U.HttpResponse> {
        const tok = this.token();
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

    protected createFileNameWithSuffix(name: string): string {
        const xname = name.replace(/[~"#%&*:<>?/\\{|}]+/g, "_");
        return xname + this.fileSuffix()
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
        const tok = this.token();
        if (!tok)
            return

        if (this.hasTokenExpired()) {
            // if we already attempted autologin (and failed), don't do it again
            if (pxt.storage.getLocal(this.name + "AutoLogin")) {
                this.pleaseLogin()
                return
            }

            pxt.storage.setLocal(this.name + "AutoLogin", "yes")
            this.loginAsync(undefined, true)
                .then((resp) => resp && this.setNewToken(resp.accessToken, resp.expiresIn))
                .done();
        } else {
            setProvider(this as any)
        }
    }

    loginAsync(redirect?: boolean, silent?: boolean): Promise<ProviderLoginResponse> {
        U.userError("Not implemented")
        return Promise.resolve(undefined);
    }

    protected loginInner() {
        const ns = this.name
        core.showLoading(ns + "login", lf("Signing you in to {0}...", this.friendlyName))
        const state = setOauth(ns);

        const providerDef = pxt.appTarget.cloud && pxt.appTarget.cloud.cloudProviders && pxt.appTarget.cloud.cloudProviders[this.name];
        const redir = window.location.protocol + "//" + window.location.host + "/oauth-redirect"
        const r: OAuthParams = {
            client_id: providerDef.client_id,
            response_type: "token",
            state: state,
            redirect_uri: redir,
            scope: "",
            expires_in: 60 * 60 * 24, // in seconds (1 day)
        }
        if (providerDef.redirect) r.redirect = providerDef.redirect;
        return r;
    }

    protected loginCompleteInner() {
        const ns = this.name
        core.hideLoading(ns + "login");
    }

    loginCallback(qs: pxt.Map<string>) {
        const ns = this.name
        pxt.storage.removeLocal(ns + "AutoLogin")
        this.setNewToken(qs["access_token"], parseInt(qs["expires_in"]));

        // re-compute
        this.setUser(undefined);
    }

    setNewToken(accessToken: string, expiresIn?: number) {
        const ns = this.name;
        const tokenKey = ns + "token";
        const tokenKeyExp = ns + "tokenExp";
        if (!accessToken) {
            pxt.storage.removeLocal(tokenKey);
            pxt.storage.removeLocal(tokenKeyExp);
        } else {
            pxt.storage.setLocal(tokenKey, accessToken)
            if (expiresIn) {
                let time = Math.round(Date.now() / 1000 + (0.75 * expiresIn));
                pxt.storage.setLocal(tokenKeyExp, time + "")
            } else
                pxt.storage.removeLocal(tokenKeyExp);
        }
        invalidateData();
    }

    hasTokenExpired() {
        const exp = parseInt(pxt.storage.getLocal(this.name + "tokenExp") || "0")
        if (!exp || exp < U.nowSeconds()) {
            return false;
        }
        return true;
    }

    logout() {
        pxt.storage.removeLocal(this.name + "token")
        pxt.storage.removeLocal(this.name + "tokenExp")
        pxt.storage.removeLocal(this.name + "AutoLogin")
        this.setUser(undefined)
        invalidateData();
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
import * as githubprovider from "./githubprovider";

// All identity providers, including github
function identityProviders(): IdentityProvider[] {
    if (!allProviders) {
        allProviders = {}
        const cl = pxt.appTarget.cloud

        if (cl && cl.cloudProviders) {
            [new onedrive.Provider(), new googledrive.Provider()]
                .filter(p => !!cl.cloudProviders[p.name])
                .forEach(p => allProviders[p.name] = p);
        }
        if (cl && cl.githubPackages) {
            const gh = new githubprovider.GithubProvider();
            allProviders[gh.name] = gh;
        }
    }

    return pxt.Util.values(allProviders);
}

/**
 * All cloud synchronization providers
 */
export function providers(): Provider[] {
    return identityProviders().filter(p => p.hasSync()).map(p => <Provider>p);
}

export function githubProvider(): githubprovider.GithubProvider {
    return identityProviders().filter(p => p.name == githubprovider.PROVIDER_NAME)[0] as githubprovider.GithubProvider;
}


// requests token to user if needed
export async function ensureGitHubTokenAsync() {
    // check that we have a token first
    await githubProvider().loginAsync();
    if (!pxt.github.token)
        U.userError(lf("Please sign in to GitHub to perform this operation."))
}

// this is generally called by the provier's loginCheck() function
export function setProvider(impl: IdentityProvider) {
    if (impl !== currentProvider) {
        currentProvider = impl
        invalidateData();
    }
}

async function syncOneUpAsync(provider: Provider, h: Header) {
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

export async function renameAsync(h: Header, newName: string) {
    const provider = currentProvider && currentProvider.hasSync() && currentProvider as Provider;
    try {
        await provider.updateAsync(h.blobId, newName)
    } catch (e) {

    }
}

export function resetAsync() {
    if (currentProvider)
        currentProvider.logout()
    currentProvider = null

    pxt.storage.removeLocal("cloudId")
    clearOauth();
    invalidateData();

    return Promise.resolve()
}

function updateNameAsync(provider: IdentityProvider) {
    if (!provider)
        return Promise.resolve()
    const user = provider.user();
    if (user)
        return Promise.resolve()
    return provider.getUserInfoAsync()
        .then(info => {
            if (!info) // invalid token or info
                return Promise.resolve();
            // check for new identity
            if (provider.hasSync()) {
                const id = provider.name + ":" + info.id
                const currId = pxt.storage.getLocal("cloudId")
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
                                    // FIXME: should call ProjectView.reloadEditor()
                                    location.hash = "#reload"
                                    location.reload()
                                })
                        } else {
                            console.log("Show the cloud sign in dialog")
                            //dialogs.showCloudSignInDialog()
                        }
                    })
                    // never return
                    return new Promise<void>(() => { })
                } else {
                    pxt.storage.setLocal("cloudId", id)
                }
            }
            if (!info.initials)
                info.initials = userInitials(info.name);
            provider.setUser(info);
            return null
        })
}

export function refreshToken() {
    if (currentProvider)
        currentProvider.loginAsync(undefined, true).done();
}

export function syncAsync(): Promise<void> {
    return Promise.all([githubSyncAsync(), cloudSyncAsync()])
        .then(() => { });
}

function githubSyncAsync(): Promise<void> {
    const gp = githubProvider();
    return gp ? updateNameAsync(gp) : Promise.resolve();
}

function cloudSyncAsync(): Promise<void> {
    if (!currentProvider)
        return Promise.resolve(undefined)
    if (!currentProvider.hasSync())
        return updateNameAsync(currentProvider);

    const provider = currentProvider as Provider;
    let numUp = 0
    let numDown = 0
    let updated: pxt.Map<number> = {}

    function uninstallAsync(h: Header) {
        pxt.debug(`uninstall local ${h.blobId}`)
        h.isDeleted = true
        h.blobVersion = "DELETED"
        h.blobCurrent = false
        return ws.saveAsync(h, null, true)
    }

    async function resolveConflictAsync(header: Header, cloudHeader: FileInfo) {
        // rename current script
        let text = await ws.getTextAsync(header.id)
        let newHd = await ws.duplicateAsync(header, text)
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

                header.cloudSync = true
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
        return syncOneUpAsync(provider, h)
            .then(() => progress(--numUp))
    }

    function syncDeleteAsync(h: Header) {
        return provider.deleteAsync(h.blobId)
            .then(() => uninstallAsync(h))
    }

    setStatus("syncing");

    return updateNameAsync(provider)
        .then(() => provider.listAsync())
        .then(entries => {
            // Get all local headers including those that had been deleted
            const allScripts = ws.getHeaders(true)
            const cloudHeaders = U.toDictionary(entries, e => e.id)
            const existingHeaders = U.toDictionary(allScripts.filter(h => h.blobId), h => h.blobId)
            //console.log('all', allScripts);
            //console.log('cloud', cloudHeaders);
            //console.log('existing', existingHeaders);
            //console.log('syncthese', allScripts.filter(hd => hd.cloudSync));
            // Only syncronize those that have been marked with cloudSync
            let waitFor = allScripts.filter(hd => hd.cloudSync).map(hd => {
                if (cloudHeaders.hasOwnProperty(hd.blobId)) {
                    let chd = cloudHeaders[hd.blobId]

                    // The script was deleted locally, delete on cloud
                    if (hd.isDeleted) {
                        console.log("deleted header: " + hd.id)
                        return syncDeleteAsync(hd)
                    }

                    if (chd.version == hd.blobVersion) {
                        if (hd.blobCurrent) {
                            // nothing to do
                            return Promise.resolve()
                        } else {
                            console.log('might have synced up: ', hd.name);
                            return syncUpAsync(hd)
                        }
                    } else {
                        if (hd.blobCurrent) {
                            console.log('might have synced down: ', hd.name);
                            return syncDownAsync(hd, chd)
                        } else {
                            console.log("there's a conflict with these two: ", hd, chd);
                            return resolveConflictAsync(hd, chd)
                        }
                    }
                } else {
                    if (hd.blobVersion)
                        // this has been pushed once to the cloud - uninstall wins
                        return uninstallAsync(hd)
                    else {
                        // never pushed before
                        console.log('might have synced up: ', hd.name);
                        return syncUpAsync(hd)
                    }
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
    const provs = identityProviders();
    if (!provs.length)
        return

    // implicit OAuth flow, via query argument
    {
        const qs = core.parseQueryString(pxt.storage.getLocal(OAUTH_HASH) || "")
        if (qs["access_token"]) {
            const tp = pxt.storage.getLocal(OAUTH_TYPE)
            const impl = provs.filter(p => p.name == tp)[0];
            if (impl) {
                pxt.storage.removeLocal(OAUTH_HASH);
                impl.loginCallback(qs)
            }
            // cleanup
            clearOauth();
        }
    }

    // auth OAuth flow, via hash
    {
        const qs = core.parseQueryString((location.hash || "#")
            .slice(1)
            .replace(/%23access_token/, "access_token"));
        if (qs["access_token"]) {
            const ex = pxt.storage.getLocal(OAUTH_STATE);
            const tp = pxt.storage.getLocal(OAUTH_TYPE);
            if (ex && ex == qs["state"]) {
                pxt.storage.removeLocal(OAUTH_STATE)
                pxt.storage.removeLocal(OAUTH_TYPE);
                const impl = provs.filter(p => p.name == tp)[0];
                if (impl) {
                    impl.loginCallback(qs);
                    const hash = pxt.storage.getLocal(OAUTH_REDIRECT) || "";
                    location.hash = hash;
                }
            }
            // cleanup
            clearOauth();
        }
    }

    // notify cloud providers
    for (const impl of provs)
        impl.loginCheck();
}

export function saveToCloudAsync(h: Header) {
    if (!currentProvider || !currentProvider.hasSync())
        return Promise.resolve();

    const provider = currentProvider as Provider;
    if (provider)
        return syncOneUpAsync(provider, h)

    return Promise.resolve();
}

function setStatus(s: string) {
    if (s != status) {
        status = s
        data.invalidate("sync:status")
    }
}

function userInitials(username: string): string {
    if (!username) return "?";
    // Parse the user name for user initials
    const initials = username.match(/\b\w/g) || [];
    return ((initials.shift() || '') + (initials.pop() || '')).toUpperCase();
}

function syncApiHandler(p: string) {
    const provider = currentProvider;
    switch (data.stripProtocol(p)) {
        case "user":
            return provider && provider.user();
        case "loggedin":
            return !!provider;
        case "status":
            return status;
        case "hascloud":
            return providers().length > 0
        case "hassync":
            return provider && provider.hasSync();
        case "provider":
            return provider && provider.name;
        case "providericon":
            if (provider)
                return provider.icon;
            const prs = providers();
            if (prs.length == 1)
                return prs[0].icon;
            return "user";
    }
    return null
}


function githubApiHandler(p: string) {
    const provider = githubProvider();
    switch (data.stripProtocol(p)) {
        case "user":
            return provider && provider.user();
    }
    return null
}

function pingApiHandlerAsync(p: string): Promise<any> {
    const url = data.stripProtocol(p);
    // special case favicon.ico
    if (/\.ico$/.test(p)) {
        const imgUrl = pxt.BrowserUtils.isEdge()
            ? url
            : `${url}?v=${Math.random()}&origin=${encodeURIComponent(window.location.origin)}`;
        const img = document.createElement("img")
        return new Promise<boolean>((resolve, reject) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = imgUrl;
        });
    }
    // other request
    return pxt.Util.requestAsync({
        url,
        method: "GET",
        allowHttpErrors: true
    }).then(r => r.statusCode === 200 || r.statusCode == 403 || r.statusCode == 400)
        .catch(e => false)
}

data.mountVirtualApi("sync", { getSync: syncApiHandler })
data.mountVirtualApi("github", { getSync: githubApiHandler })
data.mountVirtualApi("ping", {
    getAsync: pingApiHandlerAsync,
    expirationTime: p => 24 * 3600 * 1000,
    isOffline: () => !pxt.Cloud.isOnline()
})

function invalidateData() {
    data.invalidate("sync:status")
    data.invalidate("sync:user")
    data.invalidate("sync:loggedin")
    data.invalidate("sync:hascloud")
    data.invalidate("sync:hassync")
    data.invalidate("sync:provider")
    data.invalidate("sync:providericon")
    data.invalidate("github:user");
}
