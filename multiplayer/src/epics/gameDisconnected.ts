import { dispatch } from "../state";
import { showToast, setClientRole, setNetMode, clearGameInfo, clearGameMetadata } from "../state/actions";
import { GameOverReason } from "../types";

export function gameDisconnected(reason: GameOverReason | undefined) {
    try {
        dispatch(setClientRole(undefined));
        dispatch(setNetMode("init"));
        dispatch(clearGameInfo());
        dispatch(clearGameMetadata());
        switch (reason) {
            case "kicked":
                pxt.tickEvent("mp.gotkicked");
                return dispatch(
                    showToast({
                        type: "info",
                        text: lf("Host kicked you from the game."),
                        icon: "🤔",
                        timeoutMs: 5000,
                    })
                );
            case "ended":
                pxt.tickEvent("mp.gameover");
                return dispatch(
                    showToast({
                        type: "info",
                        text: lf("Game ended"),
                        timeoutMs: 5000,
                    })
                );
            case "left":
                pxt.tickEvent("mp.leftgame");
                return dispatch(
                    showToast({
                        type: "info",
                        text: lf("You left the game"),
                        timeoutMs: 5000,
                    })
                );
            default:
                pxt.tickEvent("mp.disconnected");
                return dispatch(
                    showToast({
                        type: "error",
                        text: lf("Game disconnected."),
                        timeoutMs: 5000,
                    })
                );
        }
    } catch (e) {
    } finally {
    }
}
