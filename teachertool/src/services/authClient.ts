import { setUserProfile } from "../transforms/setUserProfile";

class AuthClient extends pxt.auth.AuthClient {
    protected async onSignedIn(): Promise<void> {}
    protected async onSignedOut(): Promise<void> {
        setUserProfile(undefined);
    }
    protected async onSignInFailed(): Promise<void> {}
    protected async onUserProfileChanged(): Promise<void> {
        const profile = await this.userProfileAsync();
        setUserProfile(profile);
    }
    protected async onUserPreferencesChanged(diff: ts.pxtc.jsonPatch.PatchOperation[]): Promise<void> {}
    protected async onProfileDeleted(userId: string): Promise<void> {}
    protected async onApiError(err: any): Promise<void> {}
    protected async onStateCleared(): Promise<void> {}
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
