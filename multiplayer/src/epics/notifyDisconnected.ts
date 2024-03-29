import { dispatch } from "../state";
import { showToast, setNetMode } from "../state/actions";
import { GameOverReason } from "../types";

export function notifyDisconnected(reason: GameOverReason | undefined) {
    try {
        dispatch(setNetMode("init"));
        switch (reason) {
            case "kicked":
                pxt.tickEvent("mp.gotkicked");
                return dispatch(
                    showToast({
                        type: "info",
                        text: lf("Host kicked you from the game"),
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
            case "full":
                pxt.tickEvent("mp.gamefull");
                return dispatch(
                    showToast({
                        type: "warning",
                        text: lf("Game is full"),
                        timeoutMs: 5000,
                        icon: "😤",
                    })
                );
            case "rejected":
                pxt.tickEvent("mp.gamerejected");
                return dispatch(
                    showToast({
                        type: "error",
                        text: lf("Game rejected your join request"),
                        timeoutMs: 5000,
                    })
                );
            case "not-found":
                pxt.tickEvent("mp.gamenotfound");
                return dispatch(
                    showToast({
                        type: "warning",
                        text: lf("Game not found"),
                        timeoutMs: 5000,
                        icon: "😟",
                    })
                );
            case "compile-failed":
                pxt.tickEvent("mp.compilefailed");
                return dispatch(
                    showToast({
                        type: "error",
                        text: lf("There was a problem loading this game"),
                        timeoutMs: 5000,
                        icon: "😟",
                    })
                );
            default:
                pxt.tickEvent("mp.disconnected");
                return dispatch(
                    showToast({
                        type: "error",
                        text: lf("Game disconnected"),
                        timeoutMs: 5000,
                    })
                );
        }
    } catch (e) {
    } finally {
    }
}
