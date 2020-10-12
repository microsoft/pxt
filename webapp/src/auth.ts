import { loginCheck } from "./cloudsync";
import * as core from "./core";
import * as data from "./data";

import U = pxt.Util;

/**
 * Virtual API keys
 */
const MODULE = "auth";
const F_USER = "user";
const F_LOGGED_IN = "logged-in";
const F_NEEDS_SETUP = "needs-setup";
export const USER = `${MODULE}:${F_USER}`;
export const LOGGED_IN = `${MODULE}:${F_LOGGED_IN}`;
export const NEEDS_SETUP = `${MODULE}:${F_NEEDS_SETUP}`;

export type UserProfile = {
    id?: string;
    idp?: pxt.IdentityProviderId;
    username?: string;
    avatarUrl?: string;
};

/**
 * In-memory auth state. Changes to this state trigger virtual API subscription callbacks.
 */
export type State = {
    user?: UserProfile;
};

let state_: State = {};

/**
 * Read-only access to current state.
 */
export const getState = (): Readonly<State> => state_;

/**
 * During login, we store some state in local storage so we know where to
 * redirect after login completes. This is the shape of that state.
 */
type AuthState = {
    continuationState?: string;
    idp?: pxt.IdentityProviderId;
}

/**
 * Starts the process of authenticating the user against the given identity
 * provider. Upon success the backend will write an http-only session cookie
 * to the response, containing the authorization token. This cookie is not
 * accessible in code, but will be included in all subsequent http requests.
 * @param idp The id of the identity provider.
 * @param persistent Whether or not to remember this login across sessions.
 * @param continuationState App state to return to after authentication completes.
 */
export async function loginAsync(idp: pxt.IdentityProviderId, persistent: boolean, continuationState: string) {
    if (!hasIdentity() || !idpEnabled(idp)) return;

    const state = getState();

    // See if we have a valid access token already.
    if (!state.user) {
        await fetchUserAsync();
    }

    const currIdp = state.user?.idp;

    // Check if we're already signed into this identity provider.
    if (currIdp === idp) {
        pxt.debug(`loginAsync: Already signed into ${idp}.`);
        return;
    }

    clearState();

    pxt.tickEvent('auth.login.start', { 'provider': idp });

    const stateKey = ts.pxtc.Util.guidGen();
    const stateObj: AuthState = {
        continuationState,
        idp,
    };
    const stateStr = JSON.stringify(stateObj);

    pxt.storage.setLocal('auth:login:state', stateStr);

    // Redirect to the login endpoint.
    const loginUrl = core.stringifyQueryString(
        `${pxt.Cloud.getServiceUrl()}/auth/login`, {
        state: stateKey,
        response_type: "token",
        provider: idp,
        persistent,
        redirect_uri: `${window.location.origin}/#authcallback`
    });

    window.location.href = loginUrl;
}

/**
 * Sign out the user and clear the auth token cookie.
 */
export async function logout() {
    if (!hasIdentity()) return;

    pxt.tickEvent('auth.logout');

    const wasLoggedIn = loggedIn();
    await apiAsync('/api/auth/logout');
    clearState();
    if (wasLoggedIn) {
        core.infoNotification(lf("Signed out"));
    }
}

/**
 * Checks to see if we're already logged in by trying to fetch user info from
 * the backend. If we have a valid auth token cookie, it will succeed.
 */
export async function authCheck() {
    if (!hasIdentity()) return;

    // Optimistically try to fetch user profile. It will succeed if we have a valid
    // session cookie. Upon success, virtual api state will be updated, and the UI
    // will update accordingly.
    await fetchUserAsync();
}

export async function loginCallback(qs: pxt.Map<string>) {
    if (!hasIdentity()) return;

    // @eanders investigate: `state` parameter is getting stripped from the url somewhere in the redirect.
    // if (!qs['state']) throw new Error("Missing 'state' parameter on auth callback");

    const stateStr = pxt.storage.getLocal('auth:login:state');
    if (stateStr) {
        pxt.debug("Auth state not found in storge.");
    } else {
        const stateObj: AuthState = JSON.parse(stateStr);
        const { idp, continuationState } = stateObj;

        const error = qs['error'];
        if (error) {
            // Possible values for 'error':
            //  'invalid_request' -- Something is wrong with the request itself.
            //  'access_denied'   -- The identity provider denied the request, or user canceled it.
            const error_description = qs['error_description'];
            pxt.tickEvent('auth.login.fail', { 'error': error, 'provider': idp });
            pxt.log(`Auth failed: ${error}:${error_description}`);
            // TODO: Show a message to the user
        } else {
            await fetchUserAsync();
            pxt.tickEvent('auth.login.success', { 'provider': idp });
            // TODO: How to process continuationState? New hash condition? For now, redirect to remove hash.
        }
    }
    pxt.BrowserUtils.changeHash("#");
    window.location.reload();
}

export function identityProviders(): pxt.AppCloudProvider[] {
    return Object.keys(pxt.appTarget.cloud?.cloudProviders)
        .map(id => pxt.appTarget.cloud.cloudProviders[id])
        .filter(prov => prov.identity);
}

export function hasIdentity(): boolean {
    return identityProviders().length > 0;
}

export function loggedIn(): boolean {
    if (!hasIdentity()) return false;
    const state = getState();
    return !!state.user?.id
}

export function profileNeedsSetup(): boolean {
    const state = getState();
    return loggedIn() && !state.user.username;
}

export async function updateUserProfile(opts: {
    username?: string,
    avatarUrl?: string
}) {
    if (!loggedIn()) return;
    const state = getState();
    const result = await apiAsync<UserProfile>('/api/user/profile', {
        id: state.user.id,
        username: opts.username,
        avatarUrl: opts.avatarUrl
    } as UserProfile);
    if (result.success) {
        // Set user profile from returned value
        setUser(result.resp);
    }
}

/**
 * Private functions
 */

async function fetchUserAsync() {
    const state = getState();

    // We already have a user, no need to get it again.
    if (state.user) return;

    const result = await apiAsync('/api/user/profile');
    if (result.success) {
        setUser(result.resp);
    }
}

function idpEnabled(idp: pxt.IdentityProviderId): boolean {
    return identityProviders().filter(prov => prov.id === idp).length > 0;
}

function setUser(user: UserProfile) {
    const wasLoggedIn = loggedIn();
    state_.user = user;
    const isLoggedIn = loggedIn();
    data.invalidate(USER);
    data.invalidate(LOGGED_IN);
    data.invalidate(NEEDS_SETUP);
    if (isLoggedIn && !wasLoggedIn) {
        core.infoNotification(`Signed in: ${user.username}`);
    }
}

type ApiResult<T> = {
    resp: T;
    statusCode: number;
    success: boolean;
    errmsg: string;
};

function apiAsync<T = any>(path: string, data?: any): Promise<ApiResult<T>> {
    return U.requestAsync({
        url: path,
        headers: { "Cache-Control": "no-store" },   // don't cache responses
        method: data ? "POST" : "GET",
        data: data || undefined,
        withCredentials: true,  // include access token in request
        allowHttpErrors: true,  // don't show network failures to the user
    }).then(r => {
        return {
            statusCode: r.statusCode,
            resp: r.json,
            success: Math.floor(r.statusCode / 100) === 2,
            errmsg: null
        }
    }).catch(e => {
        return {
            statusCode: e.statusCode,
            errmsg: e.message,
            resp: null,
            success: false
        }
    });
}

function authApiHandler(p: string) {
    const field = data.stripProtocol(p);
    const state = getState();
    switch (field) {
        case F_USER: return state.user;
        case F_LOGGED_IN: return loggedIn();
        case F_NEEDS_SETUP: return profileNeedsSetup();
    }
    return null;
}

function clearState() {
    state_ = {};
    data.invalidate(USER);
    data.invalidate(LOGGED_IN);
    data.invalidate(NEEDS_SETUP);
}

data.mountVirtualApi("auth", { getSync: authApiHandler });
