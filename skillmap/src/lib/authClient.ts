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
    protected async onUserPreferencesChanged(diff: ts.pxtc.jsonPatch.PatchOperation[]): Promise<void> {
        if (diff.some(op => op.path[0] === "simulatorThemes")) {
            const state = await pxt.auth.getUserStateAsync();
            store.dispatch(dispatchSetUserPreferences(state.preferences));
        }
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
    const prefs = await userPreferencesAsync();
    if (prefs) {
        return prefs?.colorThemeIds?.[pxt.appTarget.id];
    }
}

export async function getHighContrastPrefAsync(): Promise<boolean | undefined> {
    const prefs = await userPreferencesAsync();
    return prefs?.highContrast;
}

export async function setColorThemeIdAsync(themeId: string): Promise<void> {
    const cli = await clientAsync();
    if (cli) {
        const currentPrefs = await cli.userPreferencesAsync();
        const newColorThemePref = {
            ...currentPrefs?.colorThemeIds,
            [pxt.appTarget.id]: themeId
        };
        await cli.patchUserPreferencesAsync({
            op: 'replace',
            path: ['colorThemeIds'],
            value: newColorThemePref
        }, { immediate: true });
    }
}

export async function getSimulatorThemePreferenceAsync(): Promise<pxt.auth.SimulatorThemePreference | undefined> {
    const prefs = await userPreferencesAsync();
    if (prefs) {
        const cloudPreference = prefs.simulatorThemes?.[pxt.appTarget.id];
        return pxt.auth.isValidSimulatorThemePreference(cloudPreference) ? cloudPreference : undefined;
    }

    const localPrefs = pxt.U.jsonTryParse(
        pxt.storage.getLocal(pxt.auth.SIMULATOR_THEMES_LOCAL_STORAGE_KEY)
    ) as pxt.auth.SimulatorThemesState;
    const localPreference = localPrefs?.[pxt.appTarget.id];
    return pxt.auth.isValidSimulatorThemePreference(localPreference) ? localPreference : undefined;
}

export async function setSimulatorThemePreferenceAsync(preference: pxt.auth.SimulatorThemePreference | undefined): Promise<void> {
    if (preference && !pxt.auth.isValidSimulatorThemePreference(preference)) return;
    const cli = await clientAsync();
    const targetId = pxt.appTarget.id;
    if (cli) {
        const currentPrefs = await cli.userPreferencesAsync();
        const newSimulatorThemePrefs = { ...currentPrefs?.simulatorThemes };
        if (preference) newSimulatorThemePrefs[targetId] = preference;
        else delete newSimulatorThemePrefs[targetId];
        await cli.patchUserPreferencesAsync({
            op: 'replace',
            path: ['simulatorThemes'],
            value: newSimulatorThemePrefs
        }, { immediate: true });
    } else {
        const currentPrefs = pxt.U.jsonTryParse(
            pxt.storage.getLocal(pxt.auth.SIMULATOR_THEMES_LOCAL_STORAGE_KEY)
        ) as pxt.auth.SimulatorThemesState ?? {};
        if (preference) currentPrefs[targetId] = preference;
        else delete currentPrefs[targetId];
        pxt.storage.setLocal(pxt.auth.SIMULATOR_THEMES_LOCAL_STORAGE_KEY, JSON.stringify(currentPrefs));
    }
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
