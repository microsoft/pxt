import { setUserProfileAsync } from "../transforms/setUserProfileAsync";

class AuthClient extends pxt.auth.AuthClient {
    protected async onSignedIn(): Promise<void> {
    }
    protected async onSignedOut(): Promise<void> {
        await setUserProfileAsync(undefined);
    }
    protected onSignInFailed(): Promise<void> {
        return Promise.resolve();
    }
    protected async onUserProfileChanged(): Promise<void> {
        const state = await pxt.auth.getUserStateAsync();
        if (state?.profile) {
            pxt.auth.generateUserProfilePicDataUrl(state.profile);
        }
        await setUserProfileAsync(state.profile);
    }
    protected onUserPreferencesChanged(
        diff: ts.pxtc.jsonPatch.PatchOperation[]
    ): Promise<void> {
        return Promise.resolve();
    }
    protected onStateCleared(): Promise<void> {
        return Promise.resolve();
    }
    protected async onProfileDeleted(userId: string): Promise<void> {}
    protected onApiError(err: any): Promise<void> {
        return Promise.resolve();
    }

    public async firstNameAsync(): Promise<string | undefined> {
        const state = await pxt.auth.getUserStateAsync();
        return pxt.auth.firstName(state?.profile!);
    }
}

let authClientPromise: Promise<AuthClient>;

export async function clientAsync(): Promise<AuthClient | undefined> {
    if (!pxt.auth.hasIdentity()) {
        return undefined;
    }
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

export async function authCheckAsync(): Promise<
    pxt.auth.UserProfile | undefined
> {
    const cli = await clientAsync();
    const query = pxt.Util.parseQueryString(window.location.href);
    if (query["authcallback"]) {
        await pxt.auth.loginCallbackAsync(query);
    } else {
        return await cli?.authCheckAsync();
    }
}

export async function loggedInAsync(): Promise<boolean | undefined> {
    const cli = await clientAsync();
    return await cli?.loggedInAsync();
}

export async function loginCallbackAsync(qs: pxt.Map<string>): Promise<void> {
    return await pxt.auth.loginCallbackAsync(qs);
}

export async function logoutAsync(hash?: string): Promise<void> {
    const cli = await clientAsync();
    return await cli?.logoutAsync(hash);
}

export async function loginAsync(
    idp: pxt.IdentityProviderId,
    persistent: boolean,
    callbackState?: pxt.auth.CallbackState
): Promise<void> {
    const cli = await clientAsync();
    return await cli?.loginAsync(idp, persistent, callbackState);
}

export async function authTokenAsync(): Promise<string | undefined> {
    return await pxt.auth.getAuthTokenAsync();
}

export async function addCustomColorThemeAsync(theme: pxt.ColorThemeInfo): Promise<boolean> {
    const cli = await clientAsync();
    if (cli) {
        const prefs = await cli.userPreferencesAsync();
        if (!prefs) return false;

        const themes: pxt.ColorThemeInfo[] = prefs.customColorThemes?.themes ?? [];
        if (themes.some(t => t.id === theme.id)) {
            pxt.error(lf("A theme with this ID already exists"));
            return false;
        }
        themes.push(theme);
        return setCustomColorThemesAsync(themes);
    }
    // Not supported without sign-in
    return false;
}

export async function removeCustomColorThemeAsync(themeId: string): Promise<boolean> {
    const cli = await clientAsync();
    if (cli) {
        const prefs = await cli.userPreferencesAsync();
        if (!prefs) return false;

        const themes: pxt.ColorThemeInfo[] = prefs.customColorThemes?.themes ?? [];
        const newThemes = themes.filter(t => t.id !== themeId);
        return setCustomColorThemesAsync(newThemes);
    }
    // Not supported without sign-in
    return false;
}

export async function setCustomColorThemesAsync(themes: pxt.ColorThemeInfo[]): Promise<boolean> {
    const cli = await clientAsync();
    if (cli) {
        const result = await cli.patchUserPreferencesAsync({
            op: 'replace',
            path: ['customColorThemes'],
            value: { themes }
        });
        return true; // todo thsparks : result.success but it seems to be false even when it works?
    }
    // Not supported without sign-in
    return false;
}

export async function getCustomColorThemesAsync(): Promise<pxt.ColorThemeInfo[]> {
    const cli = await clientAsync();
    if (cli) {
        const prefs = await cli.userPreferencesAsync();
        return prefs?.customColorThemes?.themes ?? [];
    }
    // Not supported without sign-in
    return [];
}
