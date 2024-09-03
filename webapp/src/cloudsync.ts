// TODO cloud save indication in the editor somewhere

import * as core from "./core";
import * as data from "./data";

import U = pxt.Util;
import UserInfo = pxt.editor.UserInfo;

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
    rememberMe: boolean;
    expiresIn?: number; // seconds
}

export interface IdentityProvider {
    name: string;
    friendlyName: string;
    icon: string;
    loginCheck(): void;
    loginAsync(redirect?: boolean, silent?: boolean): Promise<ProviderLoginResponse>;
    logout(): void;
    loginCallback(rememberMe: boolean, queryString: pxt.Map<string>): void;
    getUserInfoAsync(): Promise<UserInfo>;
    user(): UserInfo;
    setUser(user: UserInfo): void;
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
export const OAUTH_REMEMBER_STATE = "oauthRememberState"; // if state matches this key, store in local storage
const TOKEN = "token"
const TOKEN_EXP = "tokenExp"
const AUTO_LOGIN = "AutoLogin"
const CLOUD_USER = "cloudUser"

export function setOauth(type: string, rememberMe: boolean, redirect?: string, hash?: string) {
    const state = ts.pxtc.Util.guidGen();
    pxt.storage.setLocal(OAUTH_TYPE, type);
    pxt.storage.setLocal(OAUTH_STATE, state);
    pxt.storage.setLocal(OAUTH_REDIRECT, redirect || window.location.hash)
    pxt.storage.setLocal(OAUTH_HASH, hash)
    if (rememberMe)
        pxt.storage.setLocal(OAUTH_REMEMBER_STATE, state);
    else
        pxt.storage.removeLocal(OAUTH_REMEMBER_STATE)
    return state;
}

function clearOauth() {
    pxt.storage.removeLocal(OAUTH_TYPE)
    pxt.storage.removeLocal(OAUTH_STATE)
    pxt.storage.removeLocal(OAUTH_REDIRECT)
    pxt.storage.removeLocal(OAUTH_HASH)
    pxt.storage.removeLocal(OAUTH_REMEMBER_STATE)
}

export class ProviderBase {
    // in-memory token, for sessions where token is not stored
    private _token: string;

    constructor(public name: string, public friendlyName: string, public icon: string, public urlRoot: string) {
        this._token = pxt.storage.getLocal(this.name + TOKEN)
    }

    syncError(msg: string) {
        throw mkSyncError(msg)
    }

    user(): UserInfo {
        const user = pxt.Util.jsonTryParse(pxt.storage.getLocal(this.name + CLOUD_USER)) as UserInfo;
        return user;
    }

    setUser(user: UserInfo) {
        if (user)
            pxt.storage.setLocal(this.name + CLOUD_USER, JSON.stringify(user))
        else
            pxt.storage.removeLocal(this.name + CLOUD_USER);
            data.invalidate("sync:user")
            data.invalidate("github:user")
    }

    protected token() {
        if (this.hasTokenExpired())
            return undefined;

        return this._token
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
            if (pxt.storage.getLocal(this.name + AUTO_LOGIN)) {
                this.pleaseLogin()
                return
            }

            pxt.storage.setLocal(this.name + AUTO_LOGIN, "yes")
            this.loginAsync(undefined, true)
                .then((resp) => resp && this.setNewToken(resp.accessToken, resp.rememberMe, resp.expiresIn));
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
        // TODO: rememberme review this when implementing goog/onedrive
        const state = setOauth(ns, false);

        const providerDef = pxt.appTarget.cloud?.cloudProviders?.[this.name];
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

    loginCallback(rememberMe: boolean, qs: pxt.Map<string>) {
        const ns = this.name
        pxt.storage.removeLocal(ns + AUTO_LOGIN)
        this.setNewToken(qs["access_token"], rememberMe, parseInt(qs["expires_in"]));

        // re-compute
        this.setUser(undefined);
    }

    setNewToken(accessToken: string, rememberMe: boolean, expiresIn?: number) {
        const ns = this.name;
        const tokenKey = ns + TOKEN;
        const tokenKeyExp = ns + TOKEN_EXP;

        // in-memory token does not expire
        this._token = accessToken;

        // the user did not check the "remember me" checkbox,
        // do not store credentials in local storage
        if (!rememberMe) {
            pxt.debug(`token storage non-opted in`)
            pxt.storage.removeLocal(tokenKey);
            pxt.storage.removeLocal(tokenKeyExp);
            return;
        }

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
        const exp = parseInt(pxt.storage.getLocal(this.name + TOKEN_EXP) || "0")
        if (!exp || exp < U.nowSeconds()) {
            return false;
        }
        return true;
    }

    logout() {
        pxt.storage.removeLocal(this.name + TOKEN)
        pxt.storage.removeLocal(this.name + TOKEN_EXP)
        pxt.storage.removeLocal(this.name + AUTO_LOGIN)
        this._token = undefined;
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
import * as githubprovider from "./githubprovider";

// All identity providers, including github
function identityProviders(): IdentityProvider[] {
    if (!allProviders) {
        allProviders = {}
        const cl = pxt.appTarget.cloud

        if (cl && cl.githubPackages) {
            const gh = new githubprovider.GithubProvider();
            allProviders[gh.name] = gh;
        }
    }

    return pxt.Util.values(allProviders);
}

export function githubProvider(required?: boolean): githubprovider.GithubProvider {
    const p = identityProviders().filter(p => p.name == githubprovider.PROVIDER_NAME)[0] as githubprovider.GithubProvider;
    if (!p && required)
        U.userError(lf("GitHub not configured in this editor."))
    return p;
}


// requests token to user if needed
export async function ensureGitHubTokenAsync() {
    // check that we have a token first
    await githubProvider(true).loginAsync();
    if (!pxt.github.token)
        U.userError(lf("Please sign in to GitHub to perform this operation."))
}

// this is generally called by the provier's loginCheck() function
function setProvider(impl: IdentityProvider) {
    if (impl !== currentProvider) {
        currentProvider = impl
        invalidateData();
    }
}

export function resetAsync() {
    const ghProvider = githubProvider();
    const ghNeedsLogout = ghProvider && ghProvider.hasToken();

    if (currentProvider)
        currentProvider.logout()
    currentProvider = null

    pxt.storage.removeLocal("cloudId")
    clearOauth();
    invalidateData();

    // the user was signed in with github
    if (ghNeedsLogout)
        ghProvider.logout();

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
            if (!info.initials)
                info.initials = U.initials(info.name);
            provider.setUser(info);
            return null
        })
}

export function refreshToken() {
    if (currentProvider)
        currentProvider.loginAsync(undefined, true);
}

export function syncAsync(): Promise<void> {
    return githubSyncAsync()
        .then(() => { });
}

function githubSyncAsync(): Promise<void> {
    const gp = githubProvider();
    return gp ? updateNameAsync(gp) : Promise.resolve();
}


export function loginCheck() {
    const provs = identityProviders();
    if (!provs.length)
        return

    // implicit OAuth flow, via query argument
    {
        const qs = U.parseQueryString(pxt.storage.getLocal(OAUTH_HASH) || "")
        if (qs["access_token"]) {
            const tp = pxt.storage.getLocal(OAUTH_TYPE)
            const impl = provs.filter(p => p.name == tp)[0];
            if (impl) {
                pxt.storage.removeLocal(OAUTH_HASH);
                const rememberMe = qs["state"] === pxt.storage.getLocal(OAUTH_REMEMBER_STATE)
                impl.loginCallback(rememberMe, qs)
            }
            // cleanup
            clearOauth();
        }
    }

    // auth OAuth flow, via hash
    {
        const qs = U.parseQueryString((location.hash || "#")
            .slice(1)
            .replace(/%23access_token/, "access_token"));
        if (qs["access_token"]) {
            const ex = pxt.storage.getLocal(OAUTH_STATE);
            const tp = pxt.storage.getLocal(OAUTH_TYPE);
            if (ex && ex == qs["state"]) {
                pxt.storage.removeLocal(OAUTH_STATE)
                pxt.storage.removeLocal(OAUTH_TYPE);
                const rememberMe = qs["state"] === pxt.storage.getLocal(OAUTH_REMEMBER_STATE)
                const impl = provs.filter(p => p.name == tp)[0];
                if (impl) {
                    impl.loginCallback(rememberMe, qs);
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

function syncApiHandler(p: string) {
    const provider = currentProvider;
    switch (data.stripProtocol(p)) {
        case "user":
            return provider && provider.user();
        case "loggedin":
            return !!provider;
        case "status":
            return status;
        case "provider":
            return provider && provider.name;
        case "providericon":
            if (provider)
                return provider.icon;
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
data.mountVirtualApi("github", { getSync: githubApiHandler, expirationTime: p => 24 * 3600 * 1000 })
data.mountVirtualApi("ping", {
    getAsync: pingApiHandlerAsync,
    expirationTime: p => 24 * 3600 * 1000,
    isOffline: () => !pxt.Cloud.isOnline()
})

function invalidateData() {
    data.invalidate("sync:status")
    data.invalidate("sync:user")
    data.invalidate("sync:loggedin")
    data.invalidate("sync:provider")
    data.invalidate("sync:providericon")
    data.invalidate("github:user");
}
