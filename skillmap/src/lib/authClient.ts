import { dispatchSetUserProfile, dispatchSetUserPreferences, dispatchLogout } from '../actions/dispatch';
import { saveUserStateAsync } from './workspaceProvider';
import store from '../store/store';

class AuthClient extends pxt.auth.AuthClient {
    protected onSignedIn(): Promise<void> {
        // Show a notification?
        return Promise.resolve();
    }
    protected onSignedOut(): Promise<void> {
        // Show a notification?
        store.dispatch(dispatchLogout());
        return Promise.resolve();
    }
    protected onSignInFailed(): Promise<void> {
        // Show a notification?
        return Promise.resolve();
    }
    protected async onUserProfileChanged(): Promise<void> {
        const state = await pxt.auth.getUserStateAsync();
        if (state?.profile) {
            pxt.auth.generateUserProfilePicDataUrl(state.profile);
        }
        store.dispatch(dispatchSetUserProfile(state.profile));
    }
    protected onUserPreferencesChanged(diff: ts.pxtc.jsonPatch.PatchOperation[]): Promise<void> {
        // TODO: Dispatch individual preference fields individually (if changed): language, highContrast, etc.
        return Promise.resolve();
    }
    protected onStateCleared(): Promise<void> {
        return Promise.resolve();
    }
    protected async onProfileDeleted(userId: string): Promise<void> {
        // Show a notification?
        const state = store.getState();
        await state.readyResources?.exportCloudProjectsToLocal(userId);
    }
    protected onApiError(err: any): Promise<void> {
        // Show a notification?
        return Promise.resolve();
    }
    public async logoutAsync(hash: string) {
        // Do a final save while signed in to ensure cloud and local progress are persisted separately.
        const state = store.getState();
        const user = state.user;
        await saveUserStateAsync(user);
        super.logoutAsync(hash);
    }
}

let authClientPromise: Promise<AuthClient>;

export async function clientAsync(): Promise<AuthClient | undefined> {
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

export async function authCheckAsync(): Promise<pxt.auth.UserProfile | undefined> {
    const cli = await clientAsync();
    return await cli?.authCheckAsync();
}

export async function loggedInAsync(): Promise<boolean | undefined> {
    const cli = await clientAsync();
    return await cli?.loggedInAsync();
}

export async function loginCallbackAsync(qs: pxt.Map<string>): Promise<void> {
    return await pxt.auth.loginCallbackAsync(qs);
}

export async function logoutAsync(hash: string) {
    const cli = await clientAsync();
    return await cli?.logoutAsync(hash);
}

export async function saveSkillmapStateAsync(skillmap: pxt.auth.UserSkillmapState): Promise<void> {
    const cli = await clientAsync();
    const state = store.getState();
    const page = state.pageSourceUrl;
    await cli?.patchUserPreferencesAsync({
        op: 'replace',
        path: ['skillmap'],
        value: skillmap
    }, {
        // Protect against stomping the state of other skillmaps. We may not have the most up-to-date state for every skillmap.
        filter: op => op.path.includes(page)
    });
}

export async function grantBadgesAsync(badges: pxt.auth.Badge[], current: pxt.auth.Badge[]): Promise<void> {
    const cli = await clientAsync();
    current = current.filter(existing => !badges.some(badge => pxt.auth.badgeEquals(badge, existing)));

    badges = badges.map(badge => ({
        ...badge,
        timestamp: Date.now()
    }))

    await cli?.patchUserPreferencesAsync({
        op: 'replace',
        path: ['badges'],
        value: {
            badges: [...current, ...badges]
        }
    });
}

export async function removeBadgeAsync(toRemove: pxt.auth.Badge, current: pxt.auth.Badge[]): Promise<void> {
    const cli = await clientAsync();
    await cli?.patchUserPreferencesAsync({
        op: 'replace',
        path: ['badges'],
        value: {
            badges: current.filter(badge => !pxt.auth.badgeEquals(badge, toRemove))
        }
    });
}

export async function getSkillmapStateAsync(): Promise<pxt.auth.UserSkillmapState | undefined> {
    const cli = await clientAsync();
    if (cli) {
        const prefs = await cli.userPreferencesAsync();
        return prefs?.skillmap;
    }
}

export async function getBadgeStateAsync(): Promise<pxt.auth.UserBadgeState | undefined> {
    const cli = await clientAsync();
    if (cli) {
        const prefs = await cli.userPreferencesAsync();
        if (prefs) return prefs.badges;
    }
}

export async function getColorThemeIdAsync(): Promise<string | undefined> {
    const cli = await clientAsync();
    const prefs = await cli?.userPreferencesAsync();
    return prefs?.colorThemeIds?.[pxt.appTarget.id];
}

export async function userPreferencesAsync(): Promise<pxt.auth.UserPreferences | undefined> {
    const cli = await clientAsync();
    if (cli) {
        return await cli.userPreferencesAsync();
    }
}

export async function patchUserPreferencesAsync(ops: ts.pxtc.jsonPatch.PatchOperation | ts.pxtc.jsonPatch.PatchOperation[], opts: {
    immediate?: boolean,
    filter?: (op: pxtc.jsonPatch.PatchOperation) => boolean
} = {}): Promise<pxt.auth.SetPrefResult | undefined> {
    const cli = await clientAsync();
    return await cli?.patchUserPreferencesAsync(ops, opts)
}

export async function setEmailPrefAsync(pref: boolean): Promise<pxt.auth.SetPrefResult | undefined> {
    return await patchUserPreferencesAsync({
        op: 'replace',
        path: ['email'],
        value: pref
    }, { immediate: true })
}

export async function setHighContrastPrefAsync(pref: boolean): Promise<pxt.auth.SetPrefResult | undefined> {
    return await patchUserPreferencesAsync({
        op: 'replace',
        path: ['highContrast'],
        value: pref
    }, { immediate: true })
}

export async function setLanguagePreference(pref: string): Promise<pxt.auth.SetPrefResult | undefined> {
    return await patchUserPreferencesAsync({
        op: 'replace',
        path: ['language'],
        value: pref
    }, { immediate: true })
}
