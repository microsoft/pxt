import * as core from "./core";
import * as data from "./data";

import U = pxt.Util;

/**
 * Virtual API keys
 */
const AUTH_USER = 'auth:user';

/**
 * In-memory auth state. Changes to this state trigger virtual API subscription callbacks.
 */
export type State = {
    user?: pxt.UserProfile;
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
    callbackHash?: string;
    idp?: pxt.IdentityProviderId;
}

/**
 * Starts the process of authenticating the user against the given identity
 * provider. Upon success the backend will write an http-only session cookie
 * to the response, containing the authorization token. This cookie is not
 * accessible in code, but will be included in all subsequent http requests.
 * @param idp The id of the identity provider.
 * @param persistent Whether or not to remember this login across sessions.
 * @param callbackHash Where to redirect after authentication completes.
 */
export function startLogin(idp: pxt.IdentityProviderId, persistent: boolean, callbackHash: string) {
    if (!authEnabled() || !idpEnabled(idp)) return;

    const state = getState();

    const currIdp = state.user?.idp;

    // Check if already signed into this identity provider.
    if (currIdp === idp) {
        pxt.debug(`startLogin: Already signed into ${idp}.`);
        return;
    }

    // If the user is signing into a non-GitHub provider, or
    // if they're signed into a non-GitHub provider
    if ((currIdp && currIdp !== "github") && idp === "github") {
        clearState();
    }

    pxt.tickEvent('auth.login.start', { "idp": idp });

    const stateKey = ts.pxtc.Util.guidGen();
    const stateObj: AuthState = {
        callbackHash,
        idp,
    };
    const stateStr = JSON.stringify(stateObj);

    // Store the state and we will read it back in loginCallback.
    pxt.storage.setLocal(mkLoginStateKey(stateKey), stateStr);

    // Redirect to the login endpoint.
    const loginUrl = core.stringifyQueryString(
        `${pxt.Cloud.getServiceUrl()}/auth/login`, {
            state: stateKey,
            response_type: "token",
            client_id: idp,
            persistent,
            redirect_uri: `${redirBase()}/#login-callback`
        });
    window.location.href = loginUrl;
}

/**
 * Sign out the user and clear the auth token cookie.
 */
export function logout() {
    if (!authEnabled()) return;

    pxt.tickEvent('auth.logout');

    clearState();

    // Redirect to the logout endpoint.
    const logoutUrl = core.stringifyQueryString(
        `${pxt.Cloud.getServiceUrl()}/auth/logout`, {
            redirect_uri: redirBase()
        });
    window.location.href = logoutUrl;
}

/**
 * Checks to see if we're already logged in by trying to fetch user info from
 * the backend. If we have a valid auth token cookie, it will succeed.
 */
export async function authCheck() {
    if (!authEnabled()) return;

    // Optimistically try to fetch user profile. It will succeed if we have a valid
    // session cookie. Upon success, virtual api state will be updated, and the UI
    // will update accordingly.
    await fetchUserAsync();
}

export async function loginCallback(qs: pxt.Map<string>) {
    if (!authEnabled()) return;

    if (!qs['state']) throw new Error("Missing 'state' parameter on auth callback");

    const stateKey = mkLoginStateKey(qs['state']);
    pxt.storage.removeLocal(stateKey);

    const stateStr = pxt.storage.getLocal(stateKey);
    const stateObj: AuthState = JSON.parse(stateStr);
    const { idp, callbackHash } = stateObj;

    const error = qs['error'];
    if (error) {
        // Possible values for 'error':
        //  'invalid_request' -- Something is wrong with the request itself.
        //  'access_denied'   -- The identity provider denied the request, or user canceled it.
        const error_description = qs['error_description'];
        pxt.tickEvent('auth.login.fail', { 'error': error, 'idp': idp });
        pxt.log(`Auth failed: ${error_description}`);
        const url = core.stringifyQueryString(
            `${redirBase()}/#login-failed`, {
                idp,
                error,
            });
        window.location.href = url;
    } else {
        pxt.tickEvent('auth.login.success', { 'idp': idp });
        window.location.href = `${redirBase()}/#${encodeURIComponent(callbackHash)}`;
    }
}

/**
 * Private functions
 */

const redirBase = () => `${window.location.protocol}//${window.location.host}`;

async function fetchUserAsync() {
    const state = getState();
    if (state.user) return;

    const resp = await apiAsync('user/profile');
    const user: pxt.UserProfile = resp.json;

    setUser(user);
}

function mkLoginStateKey(id: string): string {
    return `auth.login.state:${id}`;
}

function authEnabled(): boolean {
    return pxt.appTarget.auth.enabled;
}

function idpEnabled(idp: pxt.IdentityProviderId): boolean {
    return pxt.appTarget.auth.providers.indexOf(idp) >= 0;
}

function setUser(user: pxt.UserProfile) {
    state_.user = user;
    data.invalidate(AUTH_USER);
}

function apiAsync(path: string, data?: any): Promise<any> {
    return U.requestAsync({
        url: "/api/" + path,
        headers: { "Cache-Control": "no-store" },
        method: data ? "POST" : "GET",
        data: data || undefined
    }).then(r => r.json).catch(core.handleNetworkError);
}

function authApiHandler(p: string) {
    const field = data.stripProtocol(p);
    const state = getState();
    switch (field) {
        case "user": return state.user;
    }
    return null;
}

function clearState() {
    state_ = {};
    data.invalidate(AUTH_USER);
}

data.mountVirtualApi("auth", { getSync: authApiHandler });
