import { dispatchSetUserProfile, dispatchSetUserPreferences, dispatchLogout } from '../actions/dispatch';
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
    protected onUserPreferencesChanged(part: pxt.auth.UserPreferencePart): Promise<void> {
        store.dispatch(dispatchSetUserPreferences(this.getState().preferences));
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
}

async function clientAsync(): Promise<AuthClient | undefined> {
    if (!pxt.auth.hasIdentity()) { return undefined; }
    let cli = pxt.auth.client();
    if (cli) { return cli as AuthClient; }
    cli = new AuthClient();
    await cli.initAsync();
    return cli as AuthClient;
}

export async function authCheckAsync() {
    const cli = await clientAsync();
    await cli?.authCheckAsync();
}

export async function loginCallbackAsync(qs: pxt.Map<string>): Promise<void> {
    return await pxt.auth.loginCallbackAsync(qs);
}
