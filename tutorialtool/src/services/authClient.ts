import { setUserProfileAsync } from "../transforms/setUserProfileAsync";

class AuthClient extends pxt.auth.AuthClient {
    protected async onSignedIn(): Promise<void> {
        // await userSignedInAsync((await this.firstNameAsync())!);
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
