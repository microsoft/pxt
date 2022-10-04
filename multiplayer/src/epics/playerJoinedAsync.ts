import { state, dispatch } from "../state";
import { showToast } from "../state/actions";

export async function playerJoinedAsync(userId: string) {
    try {
        const user = state.presence.users.find(u => u.id === userId);
        if (user) {
            dispatch(
                showToast({
                    type: "info",
                    text: lf("{0} joined the game.", user.name),
                    timeoutMs: 5000,
                })
            );
        }
    } catch (e) {
    } finally {
    }
}
