import { dispatch } from "../state"
import { setUiMode, showToast } from "../state/actions"

export function gameDisconnected() {
    try {
        dispatch(setUiMode("home"))
        dispatch(
            showToast({
                type: "error",
                text: lf("Game disconnected."),
                timeoutMs: 5000,
            })
        )
    } catch (e) {
    } finally {
    }
}
