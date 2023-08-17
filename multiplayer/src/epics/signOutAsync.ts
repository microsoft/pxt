import * as gameClient from "../services/gameClient";
import * as authClient from "../services/authClient";

export async function signOutAsync() {
    try {
        gameClient.destroy();
        await authClient.logoutAsync();
    } catch (e) {
    } finally {
    }
}
