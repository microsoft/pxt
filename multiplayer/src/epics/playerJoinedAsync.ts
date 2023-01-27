import { state, dispatch } from "../state";
import { showToast } from "../state/actions";
import { simDriver } from "../services/simHost";
import { SimMultiplayer } from "../types";

export async function playerJoinedAsync(clientId: string) {
    try {
        const user = state.presence.users.find(u => u.id === clientId);
        if (user) {
            dispatch(
                showToast({
                    type: "info",
                    text: lf("Player {0} joined the game.", user.slot),
                    timeoutMs: 5000,
                })
            );
            simDriver()?.postMessage({
                type: "multiplayer",
                content: "Connection",
                slot: user.slot,
                connected: true,
            } as SimMultiplayer.MultiplayerConnectionMessage);
        }
    } catch (e) {
    } finally {
    }
}
