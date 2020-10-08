import * as core from "../core";
import * as data from "../data";

import U = pxt.Util;
const lf = U.lf

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

export interface UserInfo {
    id: string;
    userName?: string;
    name: string;
    profile?: string;
    loginHint?: string;
    initials?: string;
    photo?: string;
}

export interface IdentityProvider {
    name: string;
    friendlyName: string;
    icon: string;
    loginCheck(): void;
    loginAsync(redirect?: boolean, silent?: boolean): Promise<ProviderLoginResponse>;
    logout(): void;
    loginCallback(queryString: pxt.Map<string>): void;
    getUserInfoAsync(): Promise<UserInfo>;
    user(): UserInfo;
    setUser(user: UserInfo): void;
    invalidateData(): void;
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

export function clearOauth() {
    pxt.storage.removeLocal(OAUTH_TYPE)
    pxt.storage.removeLocal(OAUTH_STATE)
    pxt.storage.removeLocal(OAUTH_REDIRECT)
    pxt.storage.removeLocal(OAUTH_HASH)
}

export abstract class ProviderBase {
    static currentProvider: IdentityProvider;

    constructor(public name: string, public friendlyName: string, public icon: string, public urlRoot: string) {
    }

    user(): UserInfo {
        const user = pxt.Util.jsonTryParse(pxt.storage.getLocal(this.name + "cloudUser")) as UserInfo;
        return user;
    }

    setUser(user: UserInfo) {
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

    fileSuffix() {
        return ".mkcd-" + pxt.appTarget.id
    }

    protected createFileNameWithSuffix(name: string): string {
        const xname = name.replace(/[~"#%&*:<>?/\\{|}]+/g, "_");
        return xname + this.fileSuffix()
    }

    invalidateData() {
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
        this.invalidateData();
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
        this.invalidateData();
    }
}

// this is generally called by the provier's loginCheck() function
export function setProvider(impl: IdentityProvider) {
    if (impl !== ProviderBase.currentProvider) {
        ProviderBase.currentProvider?.invalidateData();
        ProviderBase.currentProvider = impl
    }
}

function syncApiHandler(p: string): any {
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
data.mountVirtualApi("ping", {
    getAsync: pingApiHandlerAsync,
    expirationTime: p => 24 * 3600 * 1000,
    isOffline: () => !pxt.Cloud.isOnline()
})
