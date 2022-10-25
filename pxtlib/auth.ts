namespace pxt.auth {

    const EMPTY_USERNAME = "??";

    const AUTH_CONTAINER = "auth"; // local storage "namespace".
    const CSRF_TOKEN_KEY = "csrf-token"; // stored in local storage.
    const AUTH_LOGIN_STATE_KEY = "login-state"; // stored in local storage.
    const AUTH_USER_STATE_KEY = "user-state"; // stored in local storage.
    const X_PXT_TARGET = "x-pxt-target"; // header passed in auth rest calls.

    export type ApiResult<T> = {
        resp: T;
        statusCode: number;
        success: boolean;
        err: any;
    };

    const DEV_BACKEND_DEFAULT = "";
    const DEV_BACKEND_PROD = "https://www.makecode.com";
    const DEV_BACKEND_STAGING = "https://staging.pxt.io";
    // Localhost endpoints. Ensure matching port number in pxt-backend/node/.vscode/launch.json
    const DEV_BACKEND_LOCALHOST_5500 = "http://localhost:5500"; // if running in Docker container
    const DEV_BACKEND_LOCALHOST_8080 = "http://localhost:8080"; // if not running in Docker

    const DEV_BACKEND = DEV_BACKEND_STAGING;

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
    export type State = {
        profile?: UserProfile;
        preferences?: UserPreferences;
    };

    let _client: AuthClient;
    export function client(): AuthClient { return _client; }

    const PREFERENCES_DEBOUNCE_MS = 1 * 1000;
    const PREFERENCES_DEBOUNCE_MAX_MS = 10 * 1000;
    let debouncePreferencesChangedTimeout = 0;
    let debouncePreferencesChangedStarted = 0;

    export abstract class AuthClient {
        /**
         * In-memory cache of user profile state. This is persisted in local storage.
         * DO NOT ACCESS DIRECTLY UNLESS YOU KNOW IT IS OK. Functions allowed direct
         * access are marked as such below.
         */
        private state$: Readonly<State>;

        constructor() {
            // Set global instance.
            _client = this;
        }

        public async initAsync() {
            // Load state from local storage
            try {
                this.state$ = await pxt.storage.shared.getAsync<State>(AUTH_CONTAINER, AUTH_USER_STATE_KEY);
            } catch { }
            if (!this.state$) {
                this.state$ = {};
            }
            this.setUserProfileAsync(this.state$.profile);
            this.setUserPreferencesAsync(this.state$.preferences);
        }

        protected abstract onSignedIn(): Promise<void>;
        protected abstract onSignedOut(): Promise<void>;
        protected abstract onSignInFailed(): Promise<void>;
        protected abstract onUserProfileChanged(): Promise<void>;
        protected abstract onUserPreferencesChanged(diff: ts.pxtc.jsonPatch.PatchOperation[]): Promise<void>;
        protected abstract onProfileDeleted(userId: string): Promise<void>;
        protected abstract onApiError(err: any): Promise<void>;
        protected abstract onStateCleared(): Promise<void>

        public async authTokenAsync(): Promise<string> {
            return await pxt.storage.shared.getAsync(AUTH_CONTAINER, CSRF_TOKEN_KEY);
        }

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

            const state = this.getState();

            // See if we have a valid access token already.
            if (!state.profile) { await this.authCheckAsync(); }

            const currIdp = state.profile?.idp;

            // Check if we're already signed into this identity provider.
            if (currIdp === idp) {
                pxt.debug(`loginAsync: Already signed into ${idp}.`);
                return;
            }

            this.clearState();

            // Store some continuation state in local storage so we can return to what
            // the user was doing before signing in.
            const genId = () => (Math.PI * Math.random()).toString(36).slice(2);
            const loginState: LoginState = {
                key: genId(),
                callbackState,
                callbackPathname: window.location.pathname,
                idp,
            };
            await pxt.storage.shared.setAsync(AUTH_CONTAINER, AUTH_LOGIN_STATE_KEY, loginState);

            // Redirect to the login endpoint.
            const loginUrl = pxt.Util.stringifyQueryString('/api/auth/login', {
                response_type: "token",
                provider: idp,
                persistent,
                redirect_uri: `${window.location.origin}${window.location.pathname}?authcallback=1&state=${loginState.key}`
            })
            const apiResult = await this.apiAsync<LoginResponse>(loginUrl);

            if (apiResult.success) {
                pxt.tickEvent('auth.login.start', { 'provider': idp });
                window.location.href = apiResult.resp.loginUrl;
            } else {
                await this.onSignInFailed();
            }
        }

        /**
         * Sign out the user and clear the auth token cookie.
         */
        public async logoutAsync(continuationHash?: string) {
            if (!hasIdentity()) { return; }

            pxt.tickEvent('auth.logout');

            // backend will clear the cookie token and pass back the provider logout endpoint.
            await this.apiAsync('/api/auth/logout');

            // Clear csrf token so we can no longer make authenticated requests.
            await pxt.storage.shared.delAsync(AUTH_CONTAINER, CSRF_TOKEN_KEY);

            // Update state and UI to reflect logged out state.
            this.clearState();
            const hash = continuationHash ? continuationHash.startsWith('#') ? continuationHash : `#${continuationHash}` : "";

            // Redirect to home screen, or skillmap home screen
            if (pxt.BrowserUtils.hasWindow()) {
                window.location.href = `${window.location.origin}${window.location.pathname}${hash}`;
                location.reload();
            }
        }

        public async deleteProfileAsync() {
            // only if we're logged in
            if (!await this.loggedInAsync()) { return; }

            const userId = this.getState().profile?.id;

            const res = await this.apiAsync('/api/user', null, 'DELETE');
            if (res.err) {
                await this.onApiError((res.err));
            } else {
                try {
                    // Clear csrf token so we can no longer make authenticated requests.
                    await pxt.storage.shared.delAsync(AUTH_CONTAINER, CSRF_TOKEN_KEY);

                    try {
                        await this.onProfileDeleted(userId);
                    } catch {
                        pxt.tickEvent('auth.profile.cloudToLocalFailed');
                    }

                    // Update state and UI to reflect logged out state.
                    this.clearState();
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
            const state = this.getState();
            return { ...state.profile };
        }

        public async userPreferencesAsync(): Promise<UserPreferences | undefined> {
            //if (!await this.loggedInAsync()) { return undefined; } // allow even when not signed in.
            const state = this.getState();
            return { ...state.preferences };
        }

        private initialAuthCheck_: Promise<UserProfile | undefined> = undefined;
        /**
         * Checks to see if we're already logged in by trying to fetch user info from
         * the backend. If we have a valid auth token cookie, it will succeed.
         */
        public async authCheckAsync(): Promise<UserProfile | undefined> {
            if (!hasIdentity()) { return undefined; }

            // Fail fast if we don't have csrf token.
            if (!(await pxt.storage.shared.getAsync(AUTH_CONTAINER, CSRF_TOKEN_KEY))) { return undefined; }

            const state = this.getState();

            if (state.profile?.id) {
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
            await this.authCheckAsync();
            return this.hasUserId();
        }

        public async updateUserProfileAsync(opts: {
            username?: string,
            avatarUrl?: string
        }): Promise<boolean> {
            if (!await this.loggedInAsync()) { return false; }
            const state = this.getState();
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

        /*protected*/ hasUserId(): boolean {
            if (!hasIdentity()) { return false; }
            const state = this.getState();
            return !!state.profile?.id;
        }

        private async fetchUserAsync(): Promise<UserProfile | undefined> {
            if (!hasIdentity()) { return undefined; }

            const state = this.getState();

            // We already have a user, no need to get it again.
            if (state.profile?.id) {
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
            const wasLoggedIn = this.hasUserId();
            this.transformUserProfile(profile);
            const isLoggedIn = this.hasUserId();
            this.onUserProfileChanged();
            //pxt.data.invalidate(USER_PROFILE);
            if (isLoggedIn && !wasLoggedIn) {
                await this.onSignedIn();
                //pxt.data.invalidate(LOGGED_IN);
            } else if (!isLoggedIn && wasLoggedIn) {
                await this.onSignedOut();
                //pxt.data.invalidate(LOGGED_IN);
            }
        }

        private async setUserPreferencesAsync(newPref: Partial<UserPreferences>) {
            const oldPref = this.getState().preferences ?? DEFAULT_USER_PREFERENCES()
            const diff = ts.pxtc.jsonPatch.diff(oldPref, newPref);
            // update
            this.transformUserPreferences({
                ...oldPref,
                ...newPref
            });
            await this.onUserPreferencesChanged(diff);
        }

        private async fetchUserPreferencesAsync(): Promise<UserPreferences | undefined> {
            // Wait for the initial auth
            if (!await this.loggedInAsync()) { return undefined; }

            const state = this.getState();

            const result = await this.apiAsync<Partial<UserPreferences>>('/api/user/preferences');
            if (result.success) {
                // Set user profile from returned value
                if (result.resp) {
                    // Note the cloud should send partial information back if it is missing
                    // a field. So e.g. if the language has never been set in the cloud, it won't
                    // overwrite the local state.
                    this.setUserPreferencesAsync(result.resp);

                    // update our one-time promise for the initial load
                    return state.preferences;
                }
            }
            return undefined;
        }

        /**
         * Updates user profile state and writes it to local storage.
         * Direct access to state$ allowed.
         */
        private transformUserProfile(profile: UserProfile) {
            this.state$ = {
                ...this.state$,
                profile: {
                    ...profile
                }
            };
            this.saveState();
        }

        /**
         * Updates user preference state and writes it to local storage.
         * Direct access to state$ allowed.
         */
        protected transformUserPreferences(preferences: UserPreferences) {
            this.state$ = {
                ...this.state$,
                preferences: {
                    ...preferences
                }
            };
            this.saveState();
        }

        /**
         * Read-only access to current state.
         * Direct access to state$ allowed.
         */
        /*private*/ getState(): Readonly<State> {
            return this.state$;
        };

        /**
         * Write auth state to local storage.
         * Direct access to state$ allowed.
         */
        private saveState() {
            pxt.storage.shared.setAsync(AUTH_CONTAINER, AUTH_USER_STATE_KEY, this.state$).then(() => { });
        }

        /**
         * Clear all auth state.
         * Direct access to state$ allowed.
         */
        private clearState() {
            this.state$ = {};
            pxt.storage.shared.delAsync(AUTH_CONTAINER, AUTH_USER_STATE_KEY)
                .then(() => this.onStateCleared());
        }

        /*protected*/ async apiAsync<T = any>(url: string, data?: any, method?: string): Promise<ApiResult<T>> {
            const headers: pxt.Map<string> = {};
            const csrfToken = await pxt.storage.shared.getAsync<string>(AUTH_CONTAINER, CSRF_TOKEN_KEY);
            if (csrfToken) {
                headers["authorization"] = `mkcd ${csrfToken}`;
            }
            headers[X_PXT_TARGET] = pxt.appTarget?.id;

            url = pxt.BrowserUtils.isLocalHostDev() ? `${DEV_BACKEND}${url}` : url;

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
                    await this.logoutAsync();
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
    };

    type LoginResponse = {
        loginUrl: string;
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

            // Store csrf token in local storage. It is ok to do this even when
            // "Remember me" wasn't selected because this token is not usable
            // without its cookie-based counterpart. When "Remember me" is false,
            // the cookie is not persisted.
            await pxt.storage.shared.setAsync(AUTH_CONTAINER, CSRF_TOKEN_KEY, authToken);

            pxt.tickEvent('auth.login.success', { 'provider': loginState.idp });
        } while (false);

        // Clear url parameters and redirect to the callback location.
        const hash = callbackState.hash.startsWith('#') ? callbackState.hash : `#${callbackState.hash}`;
        const params = pxt.Util.stringifyQueryString('', callbackState.params);
        const pathname = loginState.callbackPathname.startsWith('/') ? loginState.callbackPathname : `/${loginState.callbackPathname}`;
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

    function idpEnabled(idp: pxt.IdentityProviderId): boolean {
        return identityProviders().filter(prov => prov.id === idp).length > 0;
    }

    export function enableAuth(enabled = true) {
        authDisabled = !enabled;
    }

    export function userName(user: pxt.auth.UserProfile): string {
        return user?.idp?.displayName ?? user?.idp?.username ?? EMPTY_USERNAME;
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
