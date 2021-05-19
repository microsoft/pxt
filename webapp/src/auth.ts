import * as core from "./core";
import * as data from "./data";
import * as cloud from "./cloud";

import U = pxt.Util;

/**
 * Virtual API keys
 */
const MODULE = "auth";
const FIELD_PROFILE = "profile";
const FIELD_LOGGED_IN = "logged-in";
export const PROFILE = `${MODULE}:${FIELD_PROFILE}`;
export const LOGGED_IN = `${MODULE}:${FIELD_LOGGED_IN}`;

const USER_PREF_MODULE = "user-pref";
const FIELD_HIGHCONTRAST = "high-contrast";
const FIELD_LANGUAGE = "language";
const FIELD_READER = "reader";
export const HIGHCONTRAST = `${USER_PREF_MODULE}:${FIELD_HIGHCONTRAST}`
export const LANGUAGE = `${USER_PREF_MODULE}:${FIELD_LANGUAGE}`
export const READER = `${USER_PREF_MODULE}:${FIELD_READER}`

const CSRF_TOKEN = "csrf-token";
const AUTH_LOGIN_STATE = "auth:login-state";
const AUTH_USER_STATE = "auth:user-state";
const X_PXT_TARGET = "x-pxt-target";

let authDisabled = false;

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
    reader?: string;
}

const DEFAULT_USER_PREFERENCES: () => UserPreferences = () => ({
    highContrast: false,
    language: pxt.appTarget.appTheme.defaultLocale,
    reader: ""
})

/**
 * In-memory auth state. Changes to this state trigger virtual API subscription callbacks.
 */
export type State = {
    profile?: UserProfile;
    preferences?: UserPreferences;
};

/**
 * In-memory cache of user profile state. This is persisted in local storage.
 * DO NOT ACCESS DIRECTLY UNLESS YOU KNOW IT IS OK. Functions allowed direct
 * access are marked as such below.
 */
let state$: Readonly<State> = null;;

/**
 * Read-only access to current state.
 * Direct access to state$ allowed.
 */
export function getState(): Readonly<State> {
    if (!state$) {
        loadState();
        if (state$) {
            generateUserProfilePicDataUrl(state$.profile);
            data.invalidate("auth:*");
            data.invalidate("user-pref:*");
        }
    }
    if (!state$) {
        state$ = {};
    }
    return state$;
};

/**
 * Updates user profile state and writes it to local storage.
 * Direct access to state$ allowed.
 */
function transformUserProfile(profile: UserProfile) {
    state$ = {
        ...state$,
        profile: {
            ...profile
        }
    };
    saveState();
}

/**
 * Updates user preference state and writes it to local storage.
 * Direct access to state$ allowed.
 */
function transformUserPreferences(preferences: UserPreferences) {
    state$ = {
        ...state$,
        preferences: {
            ...preferences
        }
    };
    saveState();
}

/**
 * Write auth state to local storage.
 * Direct access to state$ allowed.
 */
function saveState() {
    pxt.storage.setLocal(AUTH_USER_STATE, JSON.stringify(state$));
}

/**
 * Read cached auth state from local storage.
 * Direct access to state$ allowed.
 */
function loadState() {
    const str = pxt.storage.getLocal(AUTH_USER_STATE);
    if (str) {
        try {
            state$ = JSON.parse(str);
        } catch { }
    }
}

/**
 * Clear all auth state.
 * Direct access to state$ allowed.
 */
function clearState() {
    state$ = {};
    pxt.storage.removeLocal(AUTH_USER_STATE);
    data.invalidate("auth:*");
    //data.invalidate("user-prefs:*"); // Should we invalidate this? Or would it be jarring visually?
}

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
    if (!state.profile) {
        await authCheck();
    }

    const currIdp = state.profile?.idp;

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
    pxt.storage.setLocal(AUTH_LOGIN_STATE, stateStr);

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

    const state = getState();

    if (state.profile) {
        if (!initialAuthCheck_) {
            initialAuthCheck_ = Promise.resolve(state.profile);
        }
        return state.profile;
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
    let state: AuthState;
    let callbackState: CallbackState = { ...NilCallbackState };

    do {
        // Read and remove auth state from local storage
        const stateStr = pxt.storage.getLocal(AUTH_LOGIN_STATE);
        if (!stateStr) {
            pxt.debug("Auth state not found in storge.");
            break;
        }
        pxt.storage.removeLocal(AUTH_LOGIN_STATE);

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
    return Object.keys(pxt.appTarget?.cloud?.cloudProviders || {})
        .map(id => pxt.appTarget.cloud.cloudProviders[id])
        .filter(prov => prov.identity)
        .sort((a, b) => a.order - b.order);
}

export function identityProvider(id: pxt.IdentityProviderId): pxt.AppCloudProvider {
    return identityProviders().filter(prov => prov.id === id).shift();
}

export function hasIdentity(): boolean {
    return !authDisabled && !pxt.BrowserUtils.isPxtElectron() && identityProviders().length > 0;
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
        id: state.profile.id,
        username: opts.username,
        avatarUrl: opts.avatarUrl
    } as UserProfile);
    if (result.success) {
        // Set user profile from returned value
        setUserProfile(result.resp);
    }
    return result.success;
}

export async function deleteAccount() {
    if (!await loggedIn()) { return; }

    const userId = getState()?.profile?.id;

    const res = await apiAsync('/api/user', null, 'DELETE');
    if (res.err) {
        core.handleNetworkError(res.err);
    } else {
        try {
            // Clear csrf token so we can no longer make authenticated requests.
            pxt.storage.removeLocal(CSRF_TOKEN);

            try {
                // Convert cloud-saved projects to local projects.
                await cloud.convertCloudToLocal(userId);
            } catch {
                pxt.tickEvent('auth.profile.cloudToLocalFailed');
            }

            // Update state and UI to reflect logged out state.
            clearState();
        }
        finally {
            pxt.tickEvent('auth.profile.deleted');
        }
    }
}

export class Component<TProps, TState> extends data.Component<TProps, TState> {
    public getUser(): UserProfile {
        return this.getData<UserProfile>(PROFILE);
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
    const oldPref = getState().preferences ?? DEFAULT_USER_PREFERENCES()
    // update
    transformUserPreferences({
        ...oldPref,
        ...newPref
    });
    // invalidate fields that change
    if (oldPref?.highContrast !== getState().preferences?.highContrast) {
        data.invalidate(HIGHCONTRAST)
    }
    if (oldPref?.language !== getState().preferences?.language) {
        data.invalidate(LANGUAGE)
    }
    if (oldPref?.reader !== getState().preferences?.reader) {
        data.invalidate(READER)
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

export function loggedInSync(): boolean {
    if (!hasIdentity()) { return false; }
    const state = getState();
    return !!state.profile?.id;
}

export function user(): UserProfile {
    if (!hasIdentity()) { return null; }
    const state = getState();
    return { ...state.profile };
}

async function fetchUserAsync(): Promise<UserProfile | undefined> {
    const state = getState();

    // We already have a user, no need to get it again.
    if (state.profile) {
        return state.profile;
    }

    const result = await apiAsync('/api/user/profile');
    if (result.success) {
        const profile: UserProfile = result.resp;
        generateUserProfilePicDataUrl(profile);
        setUserProfile(profile);
        return profile;
    }
    return undefined
}

function generateUserProfilePicDataUrl(profile: UserProfile) {
    if (profile?.idp?.picture?.encoded) {
        const url = window.URL || window.webkitURL;
        try {
            // Decode the base64 image to a data URL.
            const decoded = U.stringToUint8Array(atob(profile.idp.picture.encoded));
            const blob = new Blob([decoded], { type: profile.idp.picture.mimeType });
            profile.idp.picture.dataUrl = url.createObjectURL(blob);
        } catch { }
    }
}

async function fetchUserPreferencesAsync(): Promise<UserPreferences | undefined> {
    // Wait for the initial auth
    if (!await loggedIn()) return undefined;

    const state = getState();

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
            return state.preferences
        }
    } else {
        pxt.reportError("identity", `fetch ${api} failed:\n${JSON.stringify(result)}`)
    }
    return undefined
}


function idpEnabled(idp: pxt.IdentityProviderId): boolean {
    return identityProviders().filter(prov => prov.id === idp).length > 0;
}

function setUserProfile(profile: UserProfile) {
    const wasLoggedIn = loggedInSync();
    transformUserProfile(profile);
    const isLoggedIn = loggedInSync();
    data.invalidate(PROFILE);
    data.invalidate(LOGGED_IN);
    if (isLoggedIn && !wasLoggedIn) {
        core.infoNotification(`Signed in: ${profile.idp.displayName}`);
    }
}

export type ApiResult<T> = {
    resp: T;
    statusCode: number;
    success: boolean;
    err: any;
};

const DEV_BACKEND_DEFAULT = "";
const DEV_BACKEND_PROD = "https://www.makecode.com";
const DEV_BACKEND_STAGING = "https://staging.pxt.io";
const DEV_BACKEND_LOCALHOST = "http://localhost:5500";

const DEV_BACKEND = DEV_BACKEND_STAGING;

export async function apiAsync<T = any>(url: string, data?: any, method?: string): Promise<ApiResult<T>> {
    const headers: pxt.Map<string> = {};
    const csrfToken = pxt.storage.getLocal(CSRF_TOKEN);
    if (csrfToken) {
        headers["authorization"] = `mkcd ${csrfToken}`;
    }
    headers[X_PXT_TARGET] = pxt.appTarget?.id;

    url = pxt.BrowserUtils.isLocalHostDev() ? `${DEV_BACKEND}${url}` : url;

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
            err: null
        }
    }).catch(async (e) => {
        if (!/logout/.test(url) && e.statusCode == 401) {
            // 401/Unauthorized. logout now.
            await logout();
        }
        return {
            statusCode: e.statusCode,
            err: e,
            resp: null,
            success: false
        }
    });
}

function authApiHandler(p: string) {
    const field = data.stripProtocol(p);
    const state = getState();
    switch (field) {
        case FIELD_PROFILE: return state.profile;
        case FIELD_LOGGED_IN: return loggedInSync();
    }
    return null;
}

function internalUserPreferencesHandler(path: string): UserPreferences | boolean | string {
    const state = getState();
    const field = data.stripProtocol(path);
    switch (field) {
        case FIELD_HIGHCONTRAST: return state.preferences.highContrast;
        case FIELD_LANGUAGE: return state.preferences.language;
        case FIELD_READER: return state.preferences.reader;
    }
    return state.preferences
}
function userPreferencesHandlerSync(path: string): UserPreferences | boolean | string {
    const state = getState();
    if (!state.preferences) {
        transformUserPreferences(DEFAULT_USER_PREFERENCES());
        /* await */ initialUserPreferences();
    }
    return internalUserPreferencesHandler(path);
}
async function userPreferencesHandlerAsync(path: string): Promise<UserPreferences | boolean | string> {
    const state = getState();
    if (!state.preferences) {
        transformUserPreferences(DEFAULT_USER_PREFERENCES());
        await initialUserPreferences();
    }
    return internalUserPreferencesHandler(path);
}

export function init() {
    data.mountVirtualApi(USER_PREF_MODULE, {
        getSync: userPreferencesHandlerSync,
        // TODO: virtual apis don't support both sync & async
        // getAsync: userPreferencesHandlerAsync
    });

    data.mountVirtualApi(MODULE, { getSync: authApiHandler });
}

export function enableAuth(enabled = true) {
    authDisabled = !enabled
}