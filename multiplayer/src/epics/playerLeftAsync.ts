import { state, dispatch } from "../state";
import { showToast } from "../state/actions";

export async function playerLeftAsync(clientId: string) {
    try {
        const user = state.presence.users.find(u => u.id === clientId);
        if (user) {
            dispatch(
                showToast({
                    type: "info",
                    text: lf("{0} left the game.", user.name),
                    timeoutMs: 5000,
                })
            );
        }
    } catch (e) {
    } finally {
    }
}
