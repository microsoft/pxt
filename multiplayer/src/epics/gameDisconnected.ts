import { dispatch } from "../state";
import { showToast, setClientRole, setNetMode } from "../state/actions";

export function gameDisconnected() {
    try {
        dispatch(setClientRole(undefined));
        dispatch(setNetMode("init"));
        dispatch(
            showToast({
                type: "error",
                text: lf("Game disconnected."),
                timeoutMs: 5000,
            })
        );
    } catch (e) {
    } finally {
    }
}
