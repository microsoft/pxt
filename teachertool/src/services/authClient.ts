import { setUserProfile } from "../transforms/setUserProfile";
import { showToast } from "../transforms/showToast";
import { ErrorCode } from "../types/errorCode";
import { makeToast } from "../utils";
import { logDebug, logError } from "./loggingService";

class AuthClient extends pxt.auth.AuthClient {
    protected async onSignedIn(): Promise<void> {
        logDebug("User signed in");
        const state = await pxt.auth.getUserStateAsync();
        const firstName = pxt.auth.firstName(state?.profile!);
        showToast(makeToast("success", firstName ? lf("Welcome {0}", firstName) : lf("Welcome!")));
    }
    protected async onSignedOut(): Promise<void> {
        logDebug("User signed out");
        setUserProfile(undefined);
        return Promise.resolve();
    }
    protected async onSignInFailed(): Promise<void> {
        logError(ErrorCode.signInFailed);
        return Promise.resolve();
    }
    protected async onUserProfileChanged(): Promise<void> {
        const state = await pxt.auth.getUserStateAsync();
        logDebug(`User profile changed`, state.profile);
        if (state?.profile) {
            pxt.auth.generateUserProfilePicDataUrl(state.profile);
        }
        setUserProfile(state.profile);
    }
    protected async onUserPreferencesChanged(diff: ts.pxtc.jsonPatch.PatchOperation[]): Promise<void> {
        logDebug("User preferences changed", diff);
        return Promise.resolve();
    }
    protected async onProfileDeleted(userId: string): Promise<void> {
        logDebug("Profile deleted", userId);
        return Promise.resolve();
    }
    protected async onApiError(err: any): Promise<void> {
        // Include detailed error separately in case PII (logError goes to our telemetry).
        logError(ErrorCode.loginApiError, "API error");
        logDebug("API error details", err);
        return Promise.resolve();
    }
    protected async onStateCleared(): Promise<void> {
        logDebug("State cleared");
        return Promise.resolve();
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
