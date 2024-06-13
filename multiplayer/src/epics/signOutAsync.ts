import * as gameClient from "../services/gameClient";
import * as collabClient from "../services/collabClient";
import * as authClient from "../services/authClient";

export async function signOutAsync() {
    try {
        gameClient.destroy();
        collabClient.destroy();
        await authClient.logoutAsync();
    } catch (e) {
    } finally {
    }
}
