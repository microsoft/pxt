import { stateAndDispatch } from "@/state";
import { showToast, setNetState } from "@/state/actions";
import { Ticks } from "@/constants";
import { GameOverReason } from "@/types";
import { makeToast } from "@/components/Toaster";

export function notifyDisconnected(reason?: GameOverReason) {
    const { dispatch } = stateAndDispatch();
    try {
        dispatch(setNetState(undefined));
        switch (reason) {
            case "kicked":
                pxt.tickEvent(Ticks.Disconnected_Kicked);
                return dispatch(
                    showToast(
                        makeToast({
                            type: "info",
                            text: lf("Host kicked you out"),
                            icon: "🤔",
                            timeoutMs: 5000,
                        })
                    )
                );
            case "ended":
                pxt.tickEvent(Ticks.Disconnected_Ended);
                return dispatch(
                    showToast(
                        makeToast({
                            type: "info",
                            text: lf("Game ended"),
                            timeoutMs: 5000,
                        })
                    )
                );
            case "left":
                pxt.tickEvent(Ticks.Disconnected_Left);
                return dispatch(
                    showToast(
                        makeToast({
                            type: "info",
                            text: lf("You left the game"),
                            timeoutMs: 5000,
                        })
                    )
                );
            case "full":
                pxt.tickEvent(Ticks.Disconnected_Full);
                return dispatch(
                    showToast(
                        makeToast({
                            type: "warning",
                            text: lf("Game is full"),
                            timeoutMs: 5000,
                            icon: "😤",
                        })
                    )
                );
            case "rejected":
                pxt.tickEvent(Ticks.Disconnected_Rejected);
                return dispatch(
                    showToast(
                        makeToast({
                            type: "error",
                            text: lf("Game rejected your join request"),
                            timeoutMs: 5000,
                        })
                    )
                );
            case "not-found":
                pxt.tickEvent(Ticks.Disconnected_NotFound);
                return dispatch(
                    showToast(
                        makeToast({
                            type: "warning",
                            text: lf("Game not found"),
                            timeoutMs: 5000,
                            icon: "😟",
                        })
                    )
                );
            default:
                pxt.tickEvent(Ticks.Disconnected_Unknown);
                return dispatch(
                    showToast(
                        makeToast({
                            type: "error",
                            text: lf("Game disconnected"),
                            timeoutMs: 5000,
                        })
                    )
                );
        }
    } catch {
    } finally {
    }
}
