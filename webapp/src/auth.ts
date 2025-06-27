import * as core from "./core";
import * as data from "./data";
import * as cloud from "./cloud";
import * as workspace from "./workspace";

/**
 * Virtual API keys
 */
const MODULE = "auth";
const FIELD_USER_PROFILE = "profile";
const FIELD_LOGGED_IN = "logged-in";
export const USER_PROFILE = `${MODULE}:${FIELD_USER_PROFILE}`;
export const LOGGED_IN = `${MODULE}:${FIELD_LOGGED_IN}`;

const USER_PREF_MODULE = "user-pref";
const FIELD_USER_PREFERENCES = "preferences";
const FIELD_HIGHCONTRAST = "high-contrast";
const FIELD_KEYBOARD_CONTROLS = "keyboard-controls";
const FIELD_COLOR_THEME_IDS = "colorThemeIds";
const FIELD_LANGUAGE = "language";
const FIELD_READER = "reader";
export const USER_PREFERENCES = `${USER_PREF_MODULE}:${FIELD_USER_PREFERENCES}`
export const HIGHCONTRAST = `${USER_PREF_MODULE}:${FIELD_HIGHCONTRAST}`
export const ACCESSIBLE_BLOCKS = `${USER_PREF_MODULE}:${FIELD_KEYBOARD_CONTROLS}`
export const COLOR_THEME_IDS = `${USER_PREF_MODULE}:${FIELD_COLOR_THEME_IDS}`
export const LANGUAGE = `${USER_PREF_MODULE}:${FIELD_LANGUAGE}`
export const READER = `${USER_PREF_MODULE}:${FIELD_READER}`
export const HAS_USED_CLOUD = "has-used-cloud"; // Key into local storage to see if this computer has logged in before

export class Component<TProps, TState> extends data.Component<TProps, TState> {
    public getUserProfile(): pxt.auth.UserProfile {
        return this.getData<pxt.auth.UserProfile>(USER_PROFILE);
    }
    public getUserPreferences(): pxt.auth.UserPreferences {
        return this.getData<pxt.auth.UserPreferences>(USER_PREFERENCES);
    }
    public isLoggedIn(): boolean {
        return this.getData<boolean>(LOGGED_IN);
    }
}

class AuthClient extends pxt.auth.AuthClient {
    protected async onSignedIn(): Promise<void> {
        const state = await pxt.auth.getUserStateAsync();
        core.infoNotification(lf("Signed in: {0}", pxt.auth.userName(state.profile)));
        if (!!workspace.getWorkspaceType())
            await cloud.syncAsync();
        pxt.storage.setLocal(HAS_USED_CLOUD, "true");
    }
    protected onSignedOut(): Promise<void> {
        core.infoNotification(lf("Signed out"));
        return Promise.resolve();
    }
    protected onSignInFailed(): Promise<void> {
        core.errorNotification(lf("Sign in failed. Something went wrong."));
        return Promise.resolve();
    }
    protected async onUserProfileChanged(): Promise<void> {
        const state = await pxt.auth.getUserStateAsync();
        pxt.auth.generateUserProfilePicDataUrl(state?.profile);
        data.invalidate("auth:*");
    }
    protected onUserPreferencesChanged(diff: ts.pxtc.jsonPatch.PatchOperation[]): Promise<void> {
        for (const op of diff) {
            switch (op.path.join('/')) {
                case "language": data.invalidate(LANGUAGE); break;
                case "highContrast": data.invalidate(HIGHCONTRAST); break;
                case "accessibleBlocks": data.invalidate(ACCESSIBLE_BLOCKS); break;
                case "colorThemeIds": data.invalidate(COLOR_THEME_IDS); break;
                case "reader": data.invalidate(READER); break;
            }
        }
        return Promise.resolve();
    }
    protected async onProfileDeleted(userId: string): Promise<void> {
        try {
            // Convert cloud-saved projects to local projects.
            await cloud.convertCloudToLocal(userId);
        } catch {
            pxt.tickEvent('auth.profile.cloudToLocalFailed');
        }
    }
    protected async onStateLoaded(): Promise<void> {
        const state = await pxt.auth.getUserStateAsync();
        pxt.auth.generateUserProfilePicDataUrl(state.profile);
        data.invalidate("auth:*");
        data.invalidate("user-pref:*");
    }
    protected async onApiError(err: any): Promise<void> {
        core.handleNetworkError(err);
    }
    protected async onStateCleared(): Promise<void> {
        data.invalidate("auth:*");
        //data.invalidate("user-prefs:*"); // Should we invalidate this? Or would it be jarring visually?
    }

    public static authApiHandler(p: string): pxt.auth.UserProfile | boolean | string {
        const field = data.stripProtocol(p);
        const state = pxt.auth.cachedUserState;
        const hasToken = pxt.auth.cachedHasAuthToken;
        switch (field) {
            case FIELD_USER_PROFILE: return hasToken ? { ...state?.profile } : null;
            case FIELD_LOGGED_IN: return hasToken && state?.profile != null;
        }
        return null;
    }

    public static userPreferencesHandler(path: string): pxt.auth.UserPreferences | boolean | string {
        const cli = pxt.auth.client();
        const state = pxt.auth.cachedUserState;
        if (cli && state) {
            if (!state.preferences) {
                cli.initialUserPreferencesAsync().then(() => { });
            }
            return AuthClient.internalUserPreferencesHandler(path);
        } else {
            // Identity not available, read from local storage
            switch (path) {
                case HIGHCONTRAST: return /^true$/i.test(pxt.storage.getLocal(HIGHCONTRAST));
                case ACCESSIBLE_BLOCKS: return /^true$/i.test(pxt.storage.getLocal(ACCESSIBLE_BLOCKS));
                case COLOR_THEME_IDS: return pxt.U.jsonTryParse(pxt.storage.getLocal(COLOR_THEME_IDS)) as pxt.auth.ColorThemeIdsState;
                case LANGUAGE: return pxt.storage.getLocal(LANGUAGE);
                case READER: return pxt.storage.getLocal(READER);
            }
        }
        return null;
    }

    private static internalUserPreferencesHandler(path: string): pxt.auth.UserPreferences | boolean | string {
        const cli = pxt.auth.client();
        const state = pxt.auth.cachedUserState;
        if (cli && state) {
            const field = data.stripProtocol(path);
            switch (field) {
                case FIELD_USER_PREFERENCES: return { ...state.preferences };
                case FIELD_HIGHCONTRAST: return state.preferences?.highContrast ?? pxt.auth.DEFAULT_USER_PREFERENCES().highContrast;
                case FIELD_KEYBOARD_CONTROLS: return state.preferences?.accessibleBlocks ?? pxt.auth.DEFAULT_USER_PREFERENCES().accessibleBlocks;
                case FIELD_COLOR_THEME_IDS: return state.preferences?.colorThemeIds ?? pxt.auth.DEFAULT_USER_PREFERENCES().colorThemeIds;
                case FIELD_LANGUAGE: return state.preferences?.language ?? pxt.auth.DEFAULT_USER_PREFERENCES().language;
                case FIELD_READER: return state.preferences?.reader ?? pxt.auth.DEFAULT_USER_PREFERENCES().reader;
            }
            return state.preferences
        }
        return null;
    }
}

export async function initAsync() {
    initVirtualApi();
    const cli = await clientAsync();
    await cli?.authCheckAsync();
}

function initVirtualApi() {
    data.mountVirtualApi(USER_PREF_MODULE, {
        getSync: AuthClient.userPreferencesHandler,
    });
    data.mountVirtualApi(MODULE, {
        getSync: AuthClient.authApiHandler
    });
}

let authClientPromise: Promise<AuthClient>;

async function clientAsync(): Promise<AuthClient | undefined> {
    if (!pxt.auth.hasIdentity()) { return undefined; }
    if (authClientPromise) return authClientPromise;
    authClientPromise = new Promise<AuthClient>(async (resolve, reject) => {
        const cli = new AuthClient();
        await cli.initAsync();
        await cli.authCheckAsync();
        await cli.initialUserPreferencesAsync();
        resolve(cli as AuthClient);
    });
    return authClientPromise;
}

export function hasIdentity(): boolean {
    return pxt.auth.hasIdentity();
}

export function loggedIn(): boolean {
    return data.getData<boolean>(LOGGED_IN);
}

export function userProfile(): pxt.auth.UserProfile {
    return data.getData<pxt.auth.UserProfile>(USER_PROFILE);
}

export function userPreferences(): pxt.auth.UserPreferences {
    return data.getData<pxt.auth.UserPreferences>(USER_PREFERENCES);
}

export async function authCheckAsync(): Promise<pxt.auth.UserProfile | undefined> {
    const cli = await clientAsync();
    return await cli?.authCheckAsync();
}

export async function initialUserPreferencesAsync(): Promise<pxt.auth.UserPreferences | undefined> {
    const cli = await clientAsync();
    return await cli?.initialUserPreferencesAsync();
}

export async function loginAsync(idp: pxt.IdentityProviderId, persistent: boolean, callbackState: pxt.auth.CallbackState = undefined): Promise<void> {
    const cli = await clientAsync();
    await cli?.loginAsync(idp, persistent, callbackState);
}

export async function loginCallbackAsync(qs: pxt.Map<string>): Promise<void> {
    await pxt.auth.loginCallbackAsync(qs);
}

export async function logoutAsync(): Promise<void> {
    const cli = await clientAsync();
    await cli?.logoutAsync("#");
}

export async function deleteProfileAsync(): Promise<void> {
    const cli = await clientAsync();
    await cli?.deleteProfileAsync();
}

export async function patchUserPreferencesAsync(ops: ts.pxtc.jsonPatch.PatchOperation | ts.pxtc.jsonPatch.PatchOperation[], opts: {
    immediate?: boolean,
    filter?: (op: pxtc.jsonPatch.PatchOperation) => boolean
} = {}): Promise<pxt.auth.SetPrefResult> {
    const cli = await clientAsync();
    return await cli?.patchUserPreferencesAsync(ops, opts);
}

export async function setHighContrastPrefAsync(highContrast: boolean): Promise<void> {
    const cli = await clientAsync();
    if (cli) {
        await cli.patchUserPreferencesAsync({
            op: 'replace',
            path: ['highContrast'],
            value: highContrast
        });
    } else {
        // Identity not available, save this setting locally
        pxt.storage.setLocal(HIGHCONTRAST, highContrast.toString());
        data.invalidate(HIGHCONTRAST);
    }
}

export async function setAccessibleBlocksPrefAsync(accessibleBlocks: boolean, eventSource: string): Promise<void> {
    const cli = await clientAsync();

    pxt.tickEvent(
        "auth.setAccessibleBlocks",
        {
            enabling: accessibleBlocks ? "true" : "false",
            eventSource: eventSource,
            local: !cli ? "true" : "false"
        }
    );

    if (cli) {
        await cli.patchUserPreferencesAsync({
            op: 'replace',
            path: ['accessibleBlocks'],
            value: accessibleBlocks
        });
    } else {
        // Identity not available, save this setting locally
        pxt.storage.setLocal(ACCESSIBLE_BLOCKS, accessibleBlocks.toString());
        data.invalidate(ACCESSIBLE_BLOCKS);
    }
}

export async function setThemePrefAsync(themeId: string): Promise<void> {
    const cli = await clientAsync();
    const targetId = pxt.appTarget.id;

    if (cli) {
        const currentPrefs = await cli.userPreferencesAsync();
        const newColorThemePref = {
            ...currentPrefs?.colorThemeIds,
            [targetId]: themeId
        };
        await cli.patchUserPreferencesAsync({
            op: 'replace',
            path: ['colorThemeIds'],
            value: newColorThemePref
        });
    } else {
        // Identity not available, save this setting locally
        const currentPrefsStr = pxt.storage.getLocal(COLOR_THEME_IDS);
        const currentPrefs = pxt.U.jsonTryParse(currentPrefsStr) as pxt.auth.ColorThemeIdsState ?? {};
        const newColorThemePref = {
            ...currentPrefs,
            [targetId]: themeId
        };
        const serialized = JSON.stringify(newColorThemePref);
        pxt.storage.setLocal(COLOR_THEME_IDS, serialized);
        data.invalidate(COLOR_THEME_IDS);
    }
}

export async function setLanguagePrefAsync(lang: string): Promise<void> {
    const cli = await clientAsync();
    if (cli) {
        await cli.patchUserPreferencesAsync({
            op: 'replace',
            path: ['language'],
            value: lang
        }, { immediate: true }); // sync this change immediately, as the page is about to reload.
    } else {
        // Identity not available, save this setting locally
        pxt.storage.setLocal(LANGUAGE, lang);
        data.invalidate(LANGUAGE);
    }
}

export async function setImmersiveReaderPrefAsync(pref: string): Promise<void> {
    const cli = await clientAsync();
    if (cli) {
        await cli.patchUserPreferencesAsync({
            op: 'replace',
            path: ['reader'],
            value: pref
        });
    } else {
        // Identity not available, save this setting locally
        pxt.storage.setLocal(READER, pref);
        data.invalidate(READER);
    }
}

export async function setEmailPrefAsync(pref: boolean): Promise<pxt.auth.SetPrefResult> {
    return await patchUserPreferencesAsync({
        op: 'replace',
        path: ['email'],
        value: pref
    }, { immediate: true })
}

export async function apiAsync<T = any>(url: string, data?: any, method?: string): Promise<pxt.auth.ApiResult<T>> {
    const cli = await clientAsync();
    return await cli?.apiAsync(url, data, method);
}
