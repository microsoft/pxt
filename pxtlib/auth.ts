namespace pxt.auth {

    const EMPTY_USERNAME = "??";

    const AUTH_CONTAINER = "auth"; // local storage "namespace".
    const CSRF_TOKEN_KEY = "csrf-token"; // stored in local storage.
    const AUTH_LOGIN_STATE_KEY = "login-state"; // stored in local storage.
    const AUTH_USER_STATE_KEY = "user-state"; // stored in local storage.
    const X_PXT_TARGET = "x-pxt-target"; // header passed in auth rest calls.
    const INTERACTIVE_LOGIN_UNTIL = "interactive-login-until"; // hint whether to prompt user or try SSO first.

    export type ApiResult<T> = {
        resp: T;
        statusCode: number;
        success: boolean;
        err: any;
    };

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
            pictureUrl?: string;
        };
    };

    export type UserSkillmapState = {
        mapProgress: any;
        completedTags: any;
    };

    export type UserBadgeState = {
        badges: Badge[];
    }

    export type SetPrefResult = {
        success: boolean;
        res: UserPreferences;
    }

    /**
     * User preference state that should be synced with the cloud.
     */
    export type UserPreferences = {
        language?: string;
        highContrast?: boolean;
        reader?: string;
        skillmap?: UserSkillmapState;
        badges?: UserBadgeState;
        email?: boolean;
    };

    export const DEFAULT_USER_PREFERENCES: () => UserPreferences = () => ({
        highContrast: false,
        language: pxt.appTarget.appTheme.defaultLocale,
        reader: "",
        skillmap: { mapProgress: {}, completedTags: {} },
        email: false
    });

    /**
     * Cloud-synced user state.
     */
    export type UserState = {
        profile?: UserProfile;
        preferences?: UserPreferences;
    };

    let _client: AuthClient;
    export function client(): AuthClient {
        if (authDisabled) return undefined;
        return _client;
    }

    const PREFERENCES_DEBOUNCE_MS = 1 * 1000;
    const PREFERENCES_DEBOUNCE_MAX_MS = 10 * 1000;
    let debouncePreferencesChangedTimeout = 0;
    let debouncePreferencesChangedStarted = 0;

    //
    // Local storage of auth token.
    //

    // Last known auth token state. This is provided as a convenience for legacy methods that cannot be made async.
    // Preference hasAuthTokenAsync() over taking a dependency on this cached value.
    export let cachedHasAuthToken = false;

    async function setLocalStorageValueAsync(key: string, value: string | undefined): Promise<void> {
        if (!!value)
            return await pxt.storage.shared.setAsync(AUTH_CONTAINER, key, value);
        else
            return await pxt.storage.shared.delAsync(AUTH_CONTAINER, key);
    }
    async function getLocalStorageValueAsync(key: string): Promise<string | undefined> {
        try { return await pxt.storage.shared.getAsync(AUTH_CONTAINER, key); } catch { return undefined; }
    }

    export async function getAuthTokenAsync(): Promise<string> {
        const token = await getLocalStorageValueAsync(CSRF_TOKEN_KEY);
        cachedHasAuthToken = !!token;
        return token;
    }
    async function setAuthTokenAsync(token: string): Promise<void> {
        cachedHasAuthToken = !!token;
        return await setLocalStorageValueAsync(CSRF_TOKEN_KEY, token);
    }
    export async function hasAuthTokenAsync(): Promise<boolean> {
        return !!(await getAuthTokenAsync());
    }
    async function delAuthTokenAsync(): Promise<void> {
        cachedHasAuthToken = false;
        return await setLocalStorageValueAsync(CSRF_TOKEN_KEY, undefined);
    }

    //
    // Local storage of user state (profile and preferences).
    //

    // Last known user state. This is provided as a convenience for legacy methods that cannot be made async.
    // Preference getUserStateAsync() over taking a dependency on this cached value.
    export let cachedUserState: Readonly<UserState>;

    export async function getUserStateAsync(): Promise<Readonly<UserState>> {
        let userState: UserState;
        try { userState = await pxt.storage.shared.getAsync(AUTH_CONTAINER, AUTH_USER_STATE_KEY); } catch { userState = {}; }
        cachedUserState = userState;
        return userState;
    }
    async function setUserStateAsync(state: UserState): Promise<void> {
        cachedUserState = { ...state };
        return await pxt.storage.shared.setAsync(AUTH_CONTAINER, AUTH_USER_STATE_KEY, state);
    }
    async function delUserStateAsync(): Promise<void> {
        cachedUserState = undefined;
        return await pxt.storage.shared.delAsync(AUTH_CONTAINER, AUTH_USER_STATE_KEY);
    }

    export abstract class AuthClient {
        constructor() {
            // Set global instance.
            _client = this;
        }

        public async initAsync() {
            // Initialize user state from local storage.
            const state = await getUserStateAsync();
            this.setUserProfileAsync(state?.profile);
            this.setUserPreferencesAsync(state?.preferences);
        }

        protected abstract onSignedIn(): Promise<void>;
        protected abstract onSignedOut(): Promise<void>;
        protected abstract onSignInFailed(): Promise<void>;
        protected abstract onUserProfileChanged(): Promise<void>;
        protected abstract onUserPreferencesChanged(diff: ts.pxtc.jsonPatch.PatchOperation[]): Promise<void>;
        protected abstract onProfileDeleted(userId: string): Promise<void>;
        protected abstract onApiError(err: any): Promise<void>;
        protected abstract onStateCleared(): Promise<void>

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
        public async loginAsync(idp: pxt.IdentityProviderId, persistent: boolean, callbackState: CallbackState = undefined) {
            if (!hasIdentity() || !idpEnabled(idp)) { return; }

            callbackState = callbackState ?? NilCallbackState;

            // Clear local auth state so we can no longer make authenticated requests.
            this.clearAuthStateAsync();

            // Store some continuation state in local storage so we can return to what
            // the user was doing before signing in.
            const genId = () => (Math.PI * Math.random()).toString(36).slice(2);
            const loginState: LoginState = {
                key: genId(),
                callbackState,
                callbackPathname: window.location.pathname,
                idp,
                persistent
            };

            // Should the user be prompted to interactively login, or can we try to silently login?
            const interactiveUntil = parseInt(await getLocalStorageValueAsync(INTERACTIVE_LOGIN_UNTIL));
            const interactiveLogin = (interactiveUntil || 0) > Date.now();

            // Redirect to the login endpoint.
            const loginUrl = pxt.Util.stringifyQueryString('/api/auth/login', {
                response_type: "token",
                provider: idp,
                persistent,
                redirect_uri: `${window.location.origin}${window.location.pathname}?authcallback=1&state=${loginState.key}`,
                prompt: interactiveLogin ? "select_account" : "silent"
            });
            const apiResult = await this.apiAsync<LoginResponse>(loginUrl);

            if (apiResult.success) {
                loginState.authCodeVerifier = apiResult.resp.authCodeVerifier; // will be undefined unless configured for the target
                await pxt.storage.shared.setAsync(AUTH_CONTAINER, AUTH_LOGIN_STATE_KEY, loginState);
                pxt.tickEvent('auth.login.start', { 'provider': idp });
                window.location.href = apiResult.resp.loginUrl;
            } else {
                try { await this.onSignInFailed(); } catch {}
            }
        }

        /**
         * Sign out the user and clear the auth token cookie.
         */
        public async logoutAsync(continuationHash?: string) {
            if (!hasIdentity()) { return; }

            await AuthClient.staticLogoutAsync(continuationHash);

            try { await this.onStateCleared(); } catch {}
            try { await this.onSignedOut(); } catch {}
        }

        /**
         * Sign out the user and clear the auth token cookie.
         */
        public static async staticLogoutAsync(continuationHash?: string) {
            if (!hasIdentity()) { return; }

            pxt.tickEvent('auth.logout');

            // Indicate that for the next minute, signin should be interactive.
            // Use case: SSO signed in with the wrong account. User wants to sign in with a different account.
            await setLocalStorageValueAsync(INTERACTIVE_LOGIN_UNTIL, (Date.now() + 60000).toString());

            continuationHash = continuationHash ? continuationHash.startsWith('#') ? continuationHash : `#${continuationHash}` : "";
            const clientRedirect = `${window.location.origin}${window.location.pathname}${window.location.search}${continuationHash}`;

            // Tell backend to clear the http-only auth cookie.
            let logoutUri = "";
            try {
                const uri = pxt.Util.stringifyQueryString('/api/auth/logout', {
                    redirect_uri: clientRedirect,
                    authcallback: '1'
                });
                const apiResult = await AuthClient.staticApiAsync<LogoutResponse>(uri);
                if (apiResult.success) {
                    logoutUri = apiResult.resp.logoutUrl;
                }
            } catch {
                // Ignore errors.
            }

            // Clear local auth state so we can no longer make authenticated requests.
            await delAuthTokenAsync();
            await delUserStateAsync();

            if (pxt.BrowserUtils.hasWindow()) {
                if (logoutUri) {
                    // Redirect to logout endpoint
                    window.location.href = logoutUri;
                } else {
                    // Redirect to home screen
                    window.location.href = clientRedirect;
                    location.reload();
                }
            }
        }

        public async deleteProfileAsync() {
            // only if we're logged in
            if (!await this.loggedInAsync()) { return; }

            const state = await getUserStateAsync();
            const userId = state?.profile?.id;

            const res = await this.apiAsync('/api/user', null, 'DELETE');
            if (res.err) {
                try { await this.onApiError((res.err)); } catch {}
            } else {
                try {
                    // Clear local auth state so we can no longer make authenticated requests.
                    await this.clearAuthStateAsync();

                    try { await this.onProfileDeleted(userId); } catch {}
                }
                finally {
                    pxt.tickEvent('auth.profile.deleted');
                }
            }
        }

        private initialUserPreferences_: Promise<UserPreferences | undefined> = undefined;
        public async initialUserPreferencesAsync(): Promise<UserPreferences | undefined> {
            // only if we're logged in
            if (!await this.loggedInAsync()) { return undefined; }

            if (!this.initialUserPreferences_) {
                this.initialUserPreferences_ = this.fetchUserPreferencesAsync();
            }
            return this.initialUserPreferences_;
        }

        public async userProfileAsync(): Promise<UserProfile | undefined> {
            if (!await this.loggedInAsync()) { return undefined; }
            const state = await getUserStateAsync();
            return { ...state.profile };
        }

        public async userPreferencesAsync(): Promise<UserPreferences | undefined> {
            //if (!await this.loggedInAsync()) { return undefined; } // allow even when not signed in.
            const state = await getUserStateAsync();
            return { ...state.preferences };
        }

        private initialAuthCheck_: Promise<UserProfile | undefined> = undefined;
        /**
         * Checks to see if we're already logged in by trying to fetch user info from
         * the backend. If we have a valid auth token cookie, it will succeed.
         */
        public async authCheckAsync(): Promise<UserProfile | undefined> {
            if (!hasIdentity()) { return undefined; }
            if (!(await hasAuthTokenAsync())) { return undefined; }

            const state = await getUserStateAsync();

            if (state?.profile?.id) {
                // If we already have a user profile, return it.
                if (!this.initialAuthCheck_) {
                    this.initialAuthCheck_ = Promise.resolve(state.profile);
                }
            } else if (!this.initialAuthCheck_) {
                // Optimistically try to fetch user profile. It will succeed if we have a valid
                // session cookie. Upon success, virtual api state will be updated, and the UI
                // will update accordingly.
                this.initialAuthCheck_ = this.fetchUserAsync();
            }
            return this.initialAuthCheck_;
        }

        public async loggedInAsync(): Promise<boolean> {
            const profile = await this.authCheckAsync();
            if (!profile) return false;
            return await this.hasUserIdAsync();
        }

        public async updateUserProfileAsync(opts: {
            username?: string,
            avatarUrl?: string
        }): Promise<boolean> {
            if (!await this.loggedInAsync()) { return false; }
            const state = await getUserStateAsync();
            const result = await this.apiAsync<UserProfile>('/api/user/profile', {
                id: state.profile.id,
                username: opts.username,
                avatarUrl: opts.avatarUrl
            } as UserProfile);
            if (result.success) {
                // Set user profile from returned value
                await this.setUserProfileAsync(result.resp);
            }
            return result.success;
        }

        private patchQueue: {
            ops: ts.pxtc.jsonPatch.PatchOperation[];
            filter?: (op: ts.pxtc.jsonPatch.PatchOperation) => boolean;
        }[] = [];

        public async patchUserPreferencesAsync(patchOps: ts.pxtc.jsonPatch.PatchOperation | ts.pxtc.jsonPatch.PatchOperation[], opts: {
            immediate?: boolean,                                            // Sync the change with cloud immediately, don't debounce
            filter?: (op: ts.pxtc.jsonPatch.PatchOperation) => boolean      // Filter the final set of patch operations
        } = {}): Promise<SetPrefResult> {
            const defaultSuccessAsync = async (): Promise<SetPrefResult> => ({ success: true, res: await this.userPreferencesAsync() });

            patchOps = Array.isArray(patchOps) ? patchOps : [patchOps];
            patchOps = patchOps.filter(op => !!op);
            if (!patchOps.length) { return await defaultSuccessAsync(); }

            const patchDiff = (pSrc: UserPreferences, ops: ts.pxtc.jsonPatch.PatchOperation[], filter?: (op: ts.pxtc.jsonPatch.PatchOperation) => boolean) => {
                // Apply patches to pDst and return the diff as a set of new patch ops.
                const pDst = U.deepCopy(pSrc);
                ts.pxtc.jsonPatch.patchInPlace(pDst, ops);
                let diff = ts.pxtc.jsonPatch.diff(pSrc, pDst);
                // Run caller-provided filter
                if (diff.length && filter) { diff = diff.filter(filter); }
                return diff;
            }

            // Process incoming patch operations to produce a more fine-grained set of diffs. Incoming patches may be overly destructive

            // Apply the patch in isolation and get the diff from original
            const curPref = await this.userPreferencesAsync();
            const diff = patchDiff(curPref, patchOps, opts.filter);
            if (!diff.length) { return await defaultSuccessAsync(); }

            // Apply the new diff to the current state
            ts.pxtc.jsonPatch.patchInPlace(curPref, diff);
            await this.setUserPreferencesAsync(curPref);

            // If the user is not logged in, non-persistent local state is all we'll use (no sync to cloud)
            if (!await this.loggedInAsync()) { return await defaultSuccessAsync(); }

            // If the user is logged in, sync to cloud, but debounce the api call as this can be called frequently from skillmaps

            // Queue the patch for sync with backend
            this.patchQueue.push({ ops: patchOps, filter: opts.filter });

            clearTimeout(debouncePreferencesChangedTimeout);
            const syncPrefs = async () => {
                debouncePreferencesChangedStarted = 0;
                if (!this.patchQueue.length) { return await defaultSuccessAsync(); }

                // Fetch latest prefs from remote
                const getResult = await this.apiAsync<Partial<UserPreferences>>('/api/user/preferences');
                if (!getResult.success) {
                    pxt.reportError("identity", "failed to fetch preferences for patch", getResult as any);
                    return { success: false, res: undefined };
                }

                // Apply queued patches to the remote state in isolation and develop a final diff to send to the backend
                const remotePrefs = U.deepCopy(getResult.resp) || DEFAULT_USER_PREFERENCES();
                const patchQueue = this.patchQueue;
                this.patchQueue = []; // Reset the queue
                patchQueue.forEach(patch => {
                    const diff = patchDiff(remotePrefs, patch.ops, patch.filter);
                    ts.pxtc.jsonPatch.patchInPlace(remotePrefs, diff);
                });

                // Diff the original and patched remote states to get a final set of patch operations
                const finalOps = pxtc.jsonPatch.diff(getResult.resp, remotePrefs);

                const patchResult = await this.apiAsync<UserPreferences>('/api/user/preferences', finalOps, 'PATCH');
                if (patchResult.success) {
                    // Set user profile from returned value so we stay in sync
                    this.setUserPreferencesAsync(patchResult.resp);
                } else {
                    pxt.reportError("identity", "failed to patch preferences", patchResult as any);
                }
                return { success: patchResult.success, res: patchResult.resp };
            }

            if (opts.immediate) {
                return await syncPrefs();
            } else {
                if (!debouncePreferencesChangedStarted) {
                    debouncePreferencesChangedStarted = U.now();
                }
                if (PREFERENCES_DEBOUNCE_MAX_MS < U.now() - debouncePreferencesChangedStarted) {
                    return await syncPrefs();
                } else {
                    debouncePreferencesChangedTimeout = setTimeout(syncPrefs, PREFERENCES_DEBOUNCE_MS);
                    return { success: false, res: undefined }; // This needs to be implemented correctly to return a promise with the debouncer
                }
            }
        }

        private async hasUserIdAsync(): Promise<boolean> {
            if (!hasIdentity()) { return false; }
            if (!(await hasAuthTokenAsync())) { return undefined; }
            const state = await getUserStateAsync();
            return !!state?.profile?.id;
        }

        private async fetchUserAsync(): Promise<UserProfile | undefined> {
            if (!hasIdentity()) { return undefined; }
            if (!(await hasAuthTokenAsync())) { return undefined; }

            const state = await getUserStateAsync();

            // We already have a user, no need to get it again.
            if (state?.profile?.id) {
                return state.profile;
            }

            const result = await this.apiAsync('/api/user/profile');
            if (result.success) {
                const profile: UserProfile = result.resp;
                await this.setUserProfileAsync(profile);
                return profile;
            }
            return undefined
        }

        private async setUserProfileAsync(profile: UserProfile) {
            const wasLoggedIn = await this.hasUserIdAsync();
            await this.transformUserProfileAsync(profile);
            const isLoggedIn = await this.hasUserIdAsync();
            try { await this.onUserProfileChanged(); } catch {}
            //pxt.data.invalidate(USER_PROFILE);
            if (isLoggedIn && !wasLoggedIn) {
                try { await this.onSignedIn(); } catch {}
                //pxt.data.invalidate(LOGGED_IN);
            } else if (!isLoggedIn && wasLoggedIn) {
                try { await this.onSignedOut(); } catch {}
                //pxt.data.invalidate(LOGGED_IN);
            }
        }

        private async setUserPreferencesAsync(newPref: Partial<UserPreferences>): Promise<UserPreferences> {
            const state = await getUserStateAsync();
            const oldPref = state?.preferences ?? DEFAULT_USER_PREFERENCES()
            const diff = ts.pxtc.jsonPatch.diff(oldPref, newPref);
            // update
            const finalPref = await this.transformUserPreferencesAsync({
                ...oldPref,
                ...newPref
            });
            try { await this.onUserPreferencesChanged(diff); } catch {}
            return finalPref;
        }

        private async fetchUserPreferencesAsync(): Promise<UserPreferences | undefined> {
            // Wait for the initial auth
            if (!await this.loggedInAsync()) { return undefined; }

            const state = await getUserStateAsync();

            const result = await this.apiAsync<Partial<UserPreferences>>('/api/user/preferences');
            if (result.success) {
                // Set user profile from returned value
                if (result.resp) {
                    // Note the cloud should send partial information back if it is missing
                    // a field. So e.g. if the language has never been set in the cloud, it won't
                    // overwrite the local state.
                    const prefs = this.setUserPreferencesAsync(result.resp);

                    // update our one-time promise for the initial load
                    return prefs;
                }
            }
            return undefined;
        }

        /**
         * Updates user profile state and writes it to local storage.
         */
        private async transformUserProfileAsync(profile: UserProfile): Promise<UserProfile> {
            let state = await getUserStateAsync();
            state = {
                ...state,
                profile: {
                    ...profile
                }
            };
            await setUserStateAsync(state);
            return state.profile;
        }

        /**
         * Updates user preference state and writes it to local storage.
         */
        protected async transformUserPreferencesAsync(preferences: UserPreferences): Promise<UserPreferences> {
            let state = await getUserStateAsync();
            state = {
                ...state,
                preferences: {
                    ...preferences
                }
            };
            await setUserStateAsync(state);
            return state.preferences;
        }

        /**
         * Clear local auth state then call the onStateCleared callback.
         */
        private async clearAuthStateAsync() {
            await delAuthTokenAsync();
            await delUserStateAsync();
            try { await this.onStateCleared(); } catch {}
        }

        /*protected*/ async apiAsync<T = any>(url: string, data?: any, method?: string, authToken?: string): Promise<ApiResult<T>> {
            return await AuthClient.staticApiAsync(url, data, method, authToken);
        }

        static async staticApiAsync<T = any>(url: string, data?: any, method?: string, authToken?: string): Promise<ApiResult<T>> {
            const headers: pxt.Map<string> = {};
            // authToken = authToken || (await getAuthTokenAsync());
            // if (authToken) {
            //     headers["authorization"] = `mkcd ${authToken}`;
            // }
            const token = pxt.codle.getCookieToken();
            if (token) {
                headers["Authorization"] =  `Bearer ${token}`;
            }
            headers[X_PXT_TARGET] = pxt.appTarget?.id;
            // url = pxt.BrowserUtils.isLocalHostDev() ? `${pxt.cloud.DEV_BACKEND}${url}` : url;
            url = `${Cloud.apiRoot.replace(/\/$/, "")}${url}`;

            return pxt.Util.requestAsync({
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
                    await AuthClient.staticLogoutAsync();
                }
                return {
                    statusCode: e.statusCode,
                    err: e,
                    resp: null,
                    success: false
                }
            });
        }
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
    type LoginState = {
        key: string;
        callbackState: CallbackState;
        callbackPathname: string;
        idp: pxt.IdentityProviderId;
        authCodeVerifier?: string;
        persistent: boolean;
    };

    type LoginResponse = {
        loginUrl: string;
        authCodeVerifier: string;
    };

    type LogoutResponse = {
        logoutUrl?: string;
    };

    export async function loginCallbackAsync(qs: pxt.Map<string>): Promise<void> {
        let loginState: LoginState;
        let callbackState: CallbackState = { ...NilCallbackState };

        do {
            // Read and remove auth state from local storage
            loginState = await pxt.storage.shared.getAsync<LoginState>(AUTH_CONTAINER, AUTH_LOGIN_STATE_KEY);
            if (!loginState) {
                pxt.debug("Auth state not found in storge.");
                return;
            }
            await pxt.storage.shared.delAsync(AUTH_CONTAINER, AUTH_LOGIN_STATE_KEY)

            const stateKey = qs['state'];
            if (!stateKey || loginState.key !== stateKey) {
                pxt.debug("Failed to get auth state for key");
                return;
            }

            callbackState = {
                ...NilCallbackState,
                ...loginState.callbackState
            };

            const error = qs['error'];
            if (error) {
                // Possible values for 'error':
                //  'invalid_request' -- Something is wrong with the request itself.
                //  'access_denied'   -- The identity provider denied the request, or user canceled it.
                const error_description = qs['error_description'];
                pxt.tickEvent('auth.login.error', { 'error': error, 'provider': loginState.idp });
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

            // If this auth request was assigned an auth code, claim it now. This will set
            // the required auth cookie in this domain (for cross-domain authentication).
            if (loginState.authCodeVerifier) {
                const otacCheckUrl = pxt.Util.stringifyQueryString('/api/otac/check', {
                    persistent: loginState.persistent,
                });
                await AuthClient.staticApiAsync(otacCheckUrl, null, null, loginState.authCodeVerifier);
            }

            // Store csrf token in local storage. It is ok to do this even when
            // "Remember me" wasn't selected because this token is not usable
            // without its cookie-based counterpart. When "Remember me" is false,
            // the cookie is not persisted.
            await setAuthTokenAsync(authToken);

            // Clear interactive login flag. Next auth request will try silent SSO first.
            await setLocalStorageValueAsync(INTERACTIVE_LOGIN_UNTIL, undefined);

            pxt.tickEvent('auth.login.success', { 'provider': loginState.idp });
        } while (false);

        // Clear url parameters and redirect to the callback location.
        const hash = callbackState.hash.startsWith('#') ? callbackState.hash : `#${callbackState.hash}`;
        const params = pxt.Util.stringifyQueryString('', callbackState.params);
        const pathname = loginState.callbackPathname.startsWith('/') ? loginState.callbackPathname : `/${loginState.callbackPathname}`;
        const redirect = `${pathname}${params}${hash}`;
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

    function idpEnabled(idp: pxt.IdentityProviderId): boolean {
        return identityProviders().filter(prov => prov.id === idp).length > 0;
    }

    export function enableAuth(enabled = true) {
        authDisabled = !enabled;
    }

    export function userName(user: pxt.auth.UserProfile): string {
        return user?.idp?.displayName ?? user?.idp?.username ?? EMPTY_USERNAME;
    }

    export function identityProviderId(user: pxt.auth.UserProfile): pxt.IdentityProviderId | undefined {
        return user?.idp?.provider;
    }

    export function firstName(user: pxt.auth.UserProfile): string {
        const userName = pxt.auth.userName(user);
        return userName?.split(" ").shift() || userName;
    }

    export function userInitials(user: pxt.auth.UserProfile): string {
        const username = pxt.auth.userName(user);
        return ts.pxtc.Util.initials(username);
    }

    export function generateUserProfilePicDataUrl(profile: pxt.auth.UserProfile) {
        if (profile?.idp?.picture?.encoded) {
            const url = window.URL || window.webkitURL;
            try {
                // Decode the base64 image to a data URL.
                const decoded = pxt.Util.stringToUint8Array(atob(profile.idp.picture.encoded));
                const blob = new Blob([decoded], { type: profile.idp.picture.mimeType });
                profile.idp.picture.dataUrl = url.createObjectURL(blob);
            } catch { }
        }
    }

    /**
     * Checks only the ID and sourceURL
     */
    export function badgeEquals(badgeA: pxt.auth.Badge, badgeB: pxt.auth.Badge) {
        return badgeA.id === badgeB.id && badgeA.sourceURL === badgeB.sourceURL;
    }

    export function hasBadge(preferences: pxt.auth.UserBadgeState, badge: pxt.auth.Badge) {
        return preferences.badges.some(toCheck => badgeEquals(toCheck, badge));
    }
}
