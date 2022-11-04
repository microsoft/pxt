import * as gameClient from "../services/gameClient";
import { dispatch } from "../state";
import { showToast } from "../state/actions";

export function kickPlayer(clientId: string) {
    try {
        pxt.tickEvent("mp.kickplayer");
        gameClient.kickPlayer(clientId);
        dispatch(
            showToast({
                type: "info",
                text: lf("Player kicked"),
                timeoutMs: 5000,
            })
        );
    } catch (e) {
    } finally {
    }
}
