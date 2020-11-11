import { loginCheck } from "./cloudsync";
import * as core from "./core";
import * as data from "./data";

import U = pxt.Util;

/**
 * Virtual API keys
 */
const MODULE = "auth";
const FIELD_USER = "user";
const FIELD_LOGGED_IN = "logged-in";
export const USER = `${MODULE}:${FIELD_USER}`;
export const LOGGED_IN = `${MODULE}:${FIELD_LOGGED_IN}`;

const CSRF_TOKEN = "csrf-token";
const AUTH_STATE = "auth-login-state";

const USER_PREF_MODULE = "user-pref";
const FIELD_HIGHCONTRAST = "high-contrast";
const FIELD_LANGUAGE = "language";
export const HIGHCONTRAST = `${USER_PREF_MODULE}:${FIELD_HIGHCONTRAST}`
export const LANGUAGE = `${USER_PREF_MODULE}:${FIELD_LANGUAGE}`

export type UserProfile = {
    id?: string;
    idp?: {
        provider?: pxt.IdentityProviderId;
        username?: string;
        displayName?: string;
        picture?: {
            mimeType?: string;
            width?: number;
            height?: number;
            encoded?: string;
            dataUrl?: string;
        };
    };
};

/**
 * User preference state that should be synced with the cloud.
 */
export type UserPreferences = {
    language?: string;
    highContrast?: boolean;
}

const DEFAULT_USER_PREFERENCES: () => UserPreferences = () => ({
    highContrast: false,
    language: pxt.appTarget.appTheme.defaultLocale,
})

/**
 * In-memory auth state. Changes to this state trigger virtual API subscription callbacks.
 */
export type State = {
    user?: UserProfile;
    preferences?: UserPreferences;
};

let state_: State = {};

/**
 * Read-only access to current state.
 */
export const getState = (): Readonly<State> => state_;

export type CallbackState = {
    hash?: string;
    params?: pxt.Map<string>;
};

const NilCallbackState = {
    hash: '',
    params: {}
};

/**
 * During login, we store some state in local storage so we know where to
 * redirect after login completes. This is the shape of that state.
 */
type AuthState = {
    key: string;
    callbackState: CallbackState;
    callbackPathname: string;
    idp: pxt.IdentityProviderId;
};

type LoginResponse = {
    loginUrl: string;
};

/**
 * Starts the process of authenticating the user against the given identity
 * provider. Upon success the backend will write an http-only session cookie
 * to the response, containing the authorization token. This cookie is not
 * accessible in code, but will be included in all subsequent http requests.
 * @param idp The id of the identity provider.
 * @param persistent Whether or not to remember this login across sessions.
 * @param callbackState The URL hash and params to return to after the auth
 *  flow completes.
 */
export async function loginAsync(idp: pxt.IdentityProviderId, persistent: boolean, callbackState: CallbackState = NilCallbackState) {
    if (!hasIdentity() || !idpEnabled(idp)) { return; }

    const state = getState();

    // See if we have a valid access token already.
    if (!state.user) {
        await authCheck();
    }

    const currIdp = state.user?.idp;

    // Check if we're already signed into this identity provider.
    if (currIdp === idp) {
        pxt.debug(`loginAsync: Already signed into ${idp}.`);
        return;
    }

    clearState();

    // Store some continuation state in local storage so we can return to what
    // the user was doing before signing in.
    const genId = () => (Math.PI * Math.random()).toString(36).slice(2);
    const stateObj: AuthState = {
        key: genId(),
        callbackState,
        callbackPathname: window.location.pathname,
        idp,
    };
    const stateStr = JSON.stringify(stateObj);
    pxt.storage.setLocal(AUTH_STATE, stateStr);

    // Redirect to the login endpoint.
    const loginUrl = core.stringifyQueryString('/api/auth/login', {
        response_type: "token",
        provider: idp,
        persistent,
        redirect_uri: `${window.location.origin}${window.location.pathname}?authcallback=1&state=${stateObj.key}`
    })
    const apiResult = await apiAsync<LoginResponse>(loginUrl);

    if (apiResult.success) {
        pxt.tickEvent('auth.login.start', { 'provider': idp });
        window.location.href = apiResult.resp.loginUrl;
    } else {
        core.errorNotification(lf("Sign in failed. Something went wrong."));
    }
}

/**
 * Sign out the user and clear the auth token cookie.
 */
export async function logout() {
    if (!hasIdentity()) { return; }

    pxt.tickEvent('auth.logout');

    // backend will clear the cookie token and pass back the provider logout endpoint.
    await apiAsync('/api/auth/logout');

    // Clear csrf token so we can no longer make authenticated requests.
    pxt.storage.removeLocal(CSRF_TOKEN);

    // Update state and UI to reflect logged out state.
    clearState();

    // Redirect to home screen.
    window.location.href = `${window.location.origin}${window.location.pathname}`;
}

let initialAuthCheck_: Promise<UserProfile | undefined> = undefined;
/**
 * Checks to see if we're already logged in by trying to fetch user info from
 * the backend. If we have a valid auth token cookie, it will succeed.
 */
export async function authCheck(): Promise<UserProfile | undefined> {
    if (!hasIdentity()) {
        return undefined;
    }

    // Fail fast if we don't have csrf token.
    if (!pxt.storage.getLocal(CSRF_TOKEN)) { return undefined; }

    if (state_.user) {
        if (!initialAuthCheck_) {
            initialAuthCheck_ = Promise.resolve(state_.user)
        }
        return state_.user
    }
    if (!initialAuthCheck_) {
        // Optimistically try to fetch user profile. It will succeed if we have a valid
        // session cookie. Upon success, virtual api state will be updated, and the UI
        // will update accordingly.
        initialAuthCheck_ = fetchUserAsync();
    }
    return initialAuthCheck_;
}

export async function loginCallback(qs: pxt.Map<string>) {
    if (!hasIdentity()) { return; }

    let state: AuthState;
    let callbackState: CallbackState = { ...NilCallbackState };

    do {
        // Read and remove auth state from local storage
        const stateStr = pxt.storage.getLocal(AUTH_STATE);
        if (!stateStr) {
            pxt.debug("Auth state not found in storge.");
            break;
        }
        pxt.storage.removeLocal(AUTH_STATE);

        state = JSON.parse(stateStr);
        if (typeof state !== 'object') {
            pxt.debug("Failed to parse auth state.");
            break;
        }

        const stateKey = qs['state'];
        if (!stateKey || state.key !== stateKey) {
            pxt.debug("Failed to get auth state for key");
            break;
        }

        callbackState = {
            ...NilCallbackState,
            ...state.callbackState
        };

        const error = qs['error'];
        if (error) {
            // Possible values for 'error':
            //  'invalid_request' -- Something is wrong with the request itself.
            //  'access_denied'   -- The identity provider denied the request, or user canceled it.
            const error_description = qs['error_description'];
            pxt.tickEvent('auth.login.error', { 'error': error, 'provider': state.idp });
            pxt.log(`Auth failed: ${error}:${error_description}`);
            // TODO: Is it correct to clear continuation hash?
            callbackState = { ...NilCallbackState };
            // TODO: Show a message to the user (via rewritten continuation path)?
            break;
        }

        const authToken = qs['token'];
        if (!authToken) {
            pxt.debug("Missing authToken in auth callback.")
            break;
        }

        // Store csrf token in local storage. It is ok to do this even when
        // "Remember me" wasn't selected because this token is not usable
        // without its cookie-based counterpart. When "Remember me" is false,
        // the cookie is not persisted.
        pxt.storage.setLocal(CSRF_TOKEN, authToken);

        pxt.tickEvent('auth.login.success', { 'provider': state.idp });
    } while (false);

    // Clear url parameters and redirect to the callback location.
    const hash = callbackState.hash.startsWith('#') ? callbackState.hash : `#${callbackState.hash}`;
    const params = core.stringifyQueryString('', callbackState.params);
    const pathname = state.callbackPathname.startsWith('/') ? state.callbackPathname : `/${state.callbackPathname}`;
    const redirect = `${pathname}${hash}${params}`;
    window.location.href = redirect;
}

export function identityProviders(): pxt.AppCloudProvider[] {
    return Object.keys(pxt.appTarget.cloud?.cloudProviders)
        .map(id => pxt.appTarget.cloud.cloudProviders[id])
        .filter(prov => prov.identity)
        .sort((a, b) => a.order - b.order);
}

export function identityProvider(id: pxt.IdentityProviderId): pxt.AppCloudProvider {
    return identityProviders().filter(prov => prov.id === id).shift();
}

export function hasIdentity(): boolean {
    // Must read storage for this rather than app theme because this method
    // gets called before experiments are synced to the theme.
    const experimentEnabled = pxt.editor.experiments.isEnabled("identity");
    return experimentEnabled && identityProviders().length > 0;
}

export async function loggedIn(): Promise<boolean> {
    await authCheck();
    return loggedInSync();
}

export async function updateUserProfile(opts: {
    username?: string,
    avatarUrl?: string
}): Promise<boolean> {
    if (!await loggedIn()) { return false; }
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
    return result.success;
}

export async function deleteAccount() {
    if (!await loggedIn()) { return; }
    await apiAsync('/api/user', null, 'DELETE');
    clearState();
}

export class Component<TProps, TState> extends data.Component<TProps, TState> {
    public getUser(): UserProfile {
        return this.getData<UserProfile>(USER);
    }
    public isLoggedIn(): boolean {
        return this.getData<boolean>(LOGGED_IN);
    }
}

export async function updateUserPreferencesAsync(newPref: Partial<UserPreferences>) {
    // Update our local state
    internalPrefUpdateAndInvalidate(newPref)

    // If we're not logged in, non-persistent local state is all we'll use
    if (!await loggedIn()) { return; }

    // If the user is logged in, save to cloud
    const result = await apiAsync<UserPreferences>('/api/user/preferences', newPref);
    if (result.success) {
        pxt.debug("Updating local user preferences w/ cloud data after result of POST")
        // Set user profile from returned value so we stay in-sync
        internalPrefUpdateAndInvalidate(result.resp)
    } else {
        pxt.reportError("identity", "update preferences failed failed", result as any);
    }
}

function internalPrefUpdateAndInvalidate(newPref: Partial<UserPreferences>) {
    // TODO is there a generic way to do this so we don't need to add new branches
    //  for each field that changes?

    // remember old
    const oldPref = state_.preferences ?? DEFAULT_USER_PREFERENCES()
    // update
    state_.preferences = { ...oldPref, ...newPref }
    // invalidate fields that change
    if (oldPref?.highContrast !== state_.preferences?.highContrast) {
        data.invalidate(HIGHCONTRAST)
    }
    if (oldPref?.language !== state_.preferences?.language) {
        data.invalidate(LANGUAGE)
    }
}

let initialUserPreferences_: Promise<UserPreferences | undefined> = undefined;
export async function initialUserPreferences(): Promise<UserPreferences | undefined> {
    // only if we're logged in
    if (!await loggedIn()) {
        return undefined;
    }

    if (!initialUserPreferences_) {
        initialUserPreferences_ = fetchUserPreferencesAsync();
    }
    return initialUserPreferences_;
}

/**
 * Private functions
 */
function loggedInSync(): boolean {
    if (!hasIdentity()) { return false; }
    const state = getState();
    return !!state.user?.id;
}

async function fetchUserAsync(): Promise<UserProfile | undefined> {
    const state = getState();

    // We already have a user, no need to get it again.
    if (state.user) {
        return state.user;
    }

    const result = await apiAsync('/api/user/profile');
    if (result.success) {
        const user: UserProfile = result.resp;
        if (user?.idp?.picture?.encoded) {
            const url = window.URL || window.webkitURL;
            try {
                // Decode the base64 image to a data URL.
                const decoded = U.stringToUint8Array(atob(user.idp.picture.encoded));
                const blob = new Blob([decoded], { type: user.idp.picture.mimeType });
                user.idp.picture.dataUrl = url.createObjectURL(blob);
                // This is a pretty big buffer and we don't need it anymore so free it.
                delete user.idp.picture.encoded;
            } catch { }
        }
        setUser(user);
        return user
    }
    return undefined
}

async function fetchUserPreferencesAsync(): Promise<UserPreferences | undefined> {
    // Wait for the initial auth
    if (!await loggedIn()) return undefined;
    
    const api = '/api/user/preferences';
    const result = await apiAsync<Partial<UserPreferences>>('/api/user/preferences');
    if (result.success) {
        // Set user profile from returned value
        if (result.resp) {
            // Note the cloud should send partial information back if it is missing
            // a field. So e.g. if the language has never been set in the cloud, it won't
            // overwrite the local state.
            internalPrefUpdateAndInvalidate(result.resp);

            // update our one-time promise for the initial load
            return state_.preferences
        }
    } else {
        pxt.reportError("identity", `fetch ${api} failed:\n${JSON.stringify(result)}`)
    }
    return undefined
}


function idpEnabled(idp: pxt.IdentityProviderId): boolean {
    return identityProviders().filter(prov => prov.id === idp).length > 0;
}

function setUser(user: UserProfile) {
    const wasLoggedIn = loggedInSync();
    state_.user = user;
    const isLoggedIn = loggedInSync();
    data.invalidate(USER);
    data.invalidate(LOGGED_IN);
    if (isLoggedIn && !wasLoggedIn) {
        core.infoNotification(`Signed in: ${user.idp.displayName}`);
    }
}

type ApiResult<T> = {
    resp: T;
    statusCode: number;
    success: boolean;
    errmsg: string;
};

async function apiAsync<T = any>(url: string, data?: any, method?: string): Promise<ApiResult<T>> {
    const headers: pxt.Map<string> = {};
    const csrfToken = pxt.storage.getLocal(CSRF_TOKEN);
    if (csrfToken) {
        headers["authorization"] = `mkcd ${csrfToken}`;
    }
    return U.requestAsync({
        url,
        headers,
        data,
        method: method ? method : data ? "POST" : "GET",
        withCredentials: true,  // Include cookies and authorization header in request, subject to CORS policy.
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
        case FIELD_USER: return state.user;
        case FIELD_LOGGED_IN: return loggedInSync();
    }
    return null;
}

function clearState() {
    state_ = {};
    data.invalidate(USER);
    data.invalidate(LOGGED_IN);
}

function internalUserPreferencesHandler(path: string): UserPreferences | boolean | string {
    const field = data.stripProtocol(path);
    switch (field) {
        case FIELD_HIGHCONTRAST: return state_.preferences.highContrast;
        case FIELD_LANGUAGE: return state_.preferences.language;
    }
    return state_.preferences
}
function userPreferencesHandlerSync(path: string): UserPreferences | boolean | string {
    if (!state_.preferences) {
        state_.preferences = DEFAULT_USER_PREFERENCES();
        /* await */ initialUserPreferences();
    }
    return internalUserPreferencesHandler(path);
}
async function userPreferencesHandlerAsync(path: string): Promise<UserPreferences | boolean | string> {
    if (!state_.preferences) {
        state_.preferences = DEFAULT_USER_PREFERENCES();
        await initialUserPreferences();
    }
    return internalUserPreferencesHandler(path);
}

data.mountVirtualApi(USER_PREF_MODULE, {
    getSync: userPreferencesHandlerSync,
    // TODO: virtual apis don't support both sync & async
    // getAsync: userPreferencesHandlerAsync
});

data.mountVirtualApi(MODULE, { getSync: authApiHandler });
