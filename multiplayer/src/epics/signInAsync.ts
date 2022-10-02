import * as authClient from "../services/authClient"

export async function signInAsync(
    idp: pxt.IdentityProviderId,
    persistent: boolean,
    callbackState?: pxt.auth.CallbackState
) {
    try {
        await authClient.loginAsync(idp, persistent, callbackState)
    } catch (e) {
    } finally {
    }
}
