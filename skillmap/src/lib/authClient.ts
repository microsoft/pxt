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
    protected onUserProfileChanged(): Promise<void> {
        const state = this.getState();
        if (state.profile) {
            pxt.auth.generateUserProfilePicDataUrl(state.profile);
        }
        store.dispatch(dispatchSetUserProfile(state.profile));
        return Promise.resolve();
    }
    protected onUserPreferencesChanged(diff: ts.pxtc.jsonPatch.PatchOperation[]): Promise<void> {
        // TODO: Dispatch individual preference fields individually (if changed): language, highContrast, etc.
        return Promise.resolve();
    }
    protected onStateCleared(): Promise<void> {
        return Promise.resolve();
    }
    protected onProfileDeleted(userId: string): Promise<void> {
        // Show a notification?
        return Promise.resolve();
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

export async function saveSkillmapStateAsync(state: pxt.auth.UserSkillmapState): Promise<void> {
    const cli = await clientAsync();
    await cli?.patchUserPreferencesAsync({
        op: 'replace',
        path: ['skillmap'],
        value: state
    });
}

export async function getSkillmapStateAsync(): Promise<pxt.auth.UserSkillmapState | undefined> {
    const cli = await clientAsync();
    if (cli) {
        const prefs = await cli.userPreferencesAsync();
        return prefs?.skillmap;
    }
}
