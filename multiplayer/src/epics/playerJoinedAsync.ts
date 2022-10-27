import { state, dispatch } from "../state";
import { showToast } from "../state/actions";

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
        }
    } catch (e) {
    } finally {
    }
}
