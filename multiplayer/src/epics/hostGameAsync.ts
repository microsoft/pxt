import * as gameClient from "../services/gameClient";
import { dispatch } from "../state";
import {
    dismissToast,
    setUiMode,
    setNetMode,
    setGameInfo,
    showToast,
    setGameId,
} from "../state/actions";

export async function hostGameAsync(shareCode: string) {
    const connectingToast = showToast({
        type: "info",
        text: lf("Connecting..."),
        showSpinner: true,
    });
    try {
        dispatch(setUiMode("host"));
        dispatch(setNetMode("connecting"));
        dispatch(connectingToast);

        const gameInfo = await gameClient.hostGameAsync(shareCode);
        console.log(gameInfo);

        dispatch(
            showToast({
                type: "success",
                text: lf("Connected!"),
                timeoutMs: 5000,
            })
        );

        dispatch(setGameInfo(gameInfo));
        dispatch(setGameId(shareCode));
        dispatch(setNetMode("connected"));
    } catch (e) {
        console.log("error", e);
        dispatch(setNetMode("init"));
        dispatch(
            showToast({
                type: "error",
                text: lf("Something went wrong. Please try again."),
                timeoutMs: 5000,
            })
        );
    } finally {
        dispatch(dismissToast(connectingToast.toast.id));
    }
}
